import http from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';

import handler from 'serve-handler';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = {
    patterns: null,
    outDir: 'test/output',
    writePdf: true,
    headful: false,
    timeoutMs: 120_000,
    concurrency: Math.max(1, Math.min(4, os.cpus()?.length || 1)),
    renderer: 'fallback',
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--pattern' && argv[i + 1]) {
      if (!args.patterns) args.patterns = [];

      // Accept multiple values after a single --pattern until the next flag.
      // This makes quoted and shell-expanded globs behave predictably.
      while (argv[i + 1] && !String(argv[i + 1]).startsWith('--')) {
        args.patterns.push(argv[++i]);
      }
    }
    else if (a === '--out' && argv[i + 1]) args.outDir = argv[++i];
    else if (a === '--write-pdf') args.writePdf = true;
    else if (a === '--headful') args.headful = true;
    else if (a === '--timeout' && argv[i + 1]) args.timeoutMs = Number(argv[++i]);
    else if (a === '--concurrency' && argv[i + 1]) args.concurrency = Math.max(1, Number(argv[++i]));
    else if (a === '--renderer' && argv[i + 1]) args.renderer = argv[++i];
  }

  return args;
}

async function listMarkdownFiles(globPattern) {
  // Minimal globbing: supports patterns like test/fixtures/markdown/**/*.md
  // We intentionally keep this dependency-free.
  if (!globPattern.includes('/**/')) {
    const rel = globPattern.replaceAll('\\', '/');
    const abs = path.resolve(repoRoot, rel);
    const st = await fs.stat(abs).catch(() => null);
    if (!st) throw new Error(`--pattern not found: ${globPattern}`);

    if (st.isFile()) {
      if (!rel.endsWith('.md')) throw new Error(`--pattern must be a .md file: ${globPattern}`);
      return [rel];
    }

    if (st.isDirectory()) {
      const out = [];
      async function walk(dir) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const e of entries) {
          const full = path.join(dir, e.name);
          if (e.isDirectory()) await walk(full);
          else if (e.isFile() && e.name.endsWith('.md')) {
            out.push(path.relative(repoRoot, full).replaceAll(path.sep, '/'));
          }
        }
      }
      await walk(abs);
      out.sort();
      return out;
    }

    throw new Error(`Unsupported --pattern type: ${globPattern}`);
  }

  const parts = globPattern.split('/**/');
  if (parts.length !== 2) {
    throw new Error(
      `Unsupported --pattern. Use something like test/fixtures/markdown/**/*.md (got: ${globPattern})`,
    );
  }

  const baseDir = path.resolve(repoRoot, parts[0]);
  const suffix = parts[1];
  const suffixRegex = new RegExp(
    '^' + suffix.replaceAll('.', '\\.')
      .replaceAll('*', '[^/]*') + '$',
  );

  const out = [];

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else if (e.isFile()) {
        const relFromBase = path.relative(baseDir, full).replaceAll(path.sep, '/');
        if (suffixRegex.test(relFromBase.split('/').pop())) {
          out.push(path.relative(repoRoot, full).replaceAll(path.sep, '/'));
        }
      }
    }
  }

  await walk(baseDir);
  out.sort();
  return out;
}

async function startStaticServer() {
  const server = http.createServer((req, res) => {
    return handler(req, res, {
      public: repoRoot,
      cleanUrls: false,
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return { server, baseUrl };
}

async function getPdfBytes(page) {
  const bytes = await page.evaluate(async () => {
    const api = globalThis.__mdtypst;
    if (!api) throw new Error('__mdtypst test API missing');
    const blob = api.getPdfBlob();
    if (!blob) return null;
    const buf = await blob.arrayBuffer();
    return Array.from(new Uint8Array(buf));
  });
  if (!bytes) return null;
  return Buffer.from(bytes);
}

async function getTypstSource(page) {
  try {
    return await page.evaluate(() => {
      const api = globalThis.__mdtypst;
      if (!api || typeof api.getTypstSource !== 'function') return null;
      return api.getTypstSource();
    });
  } catch {
    return null;
  }
}

async function getDebugInfo(page) {
  try {
    return await page.evaluate(() => {
      const api = globalThis.__mdtypst;
      if (!api) return null;
      return {
        sidecarUrl: typeof api.getSidecarUrl === 'function' ? api.getSidecarUrl() : null,
        templateUrl: typeof api.getTemplateUrl === 'function' ? api.getTemplateUrl() : null,
      };
    });
  } catch {
    return null;
  }
}

async function readJsonIfExists(absPath) {
  try {
    const raw = await fs.readFile(absPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function toStringParamValue(v) {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

function hasOwn(o, k) {
  return Object.prototype.hasOwnProperty.call(o, k);
}

async function runOne(page, baseUrl, srcPath, { timeoutMs, writePdf, outDir, renderer }) {
  const paramsPath = path.resolve(repoRoot, srcPath.replace(/\.md$/i, '.params.json'));
  const expectPath = path.resolve(repoRoot, srcPath.replace(/\.md$/i, '.expect.json'));
  const extraParams = await readJsonIfExists(paramsPath);
  const expectations = await readJsonIfExists(expectPath);

  const params = new URLSearchParams({
    src: srcPath,
    renderer: renderer || 'fallback',
  });

  if (extraParams && typeof extraParams === 'object') {
    for (const [k, v] of Object.entries(extraParams)) {
      const s = toStringParamValue(v);
      if (s != null) params.set(k, s);
    }
  }
  const url = `${baseUrl}/render.html?${params.toString()}`;

  // Playwright's waitForFunction signature differs across versions (arg vs options position).
  // Set defaults to make timeouts consistent and avoid API differences.
  page.setDefaultTimeout(timeoutMs);
  page.setDefaultNavigationTimeout(timeoutMs);

  const consoleErrors = [];
  const pageErrors = [];
  const requestFailures = [];
  const onConsole = (msg) => {
    const type = msg.type();
    if (type === 'error') consoleErrors.push(msg.text());
  };
  page.on('console', onConsole);
  const onPageError = (err) => {
    pageErrors.push(String(err?.message ?? err));
  };
  page.on('pageerror', onPageError);
  const onRequestFailed = (req) => {
    try {
      requestFailures.push(`${req.failure()?.errorText || 'request failed'}: ${req.url()}`);
    } catch {
      requestFailures.push('request failed');
    }
  };
  page.on('requestfailed', onRequestFailed);

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });

    // Wait for either success or error.
    try {
      await page.waitForFunction(
        () => {
          const el = document.getElementById('status');
          if (!el) return false;
          return el.classList.contains('success') || el.classList.contains('error');
        },
      );
    } catch (e) {
      const status = await page.evaluate(() => {
        const el = document.getElementById('status');
        return {
          text: el?.textContent ?? '',
          className: el?.className ?? '',
        };
      }).catch(() => ({ text: '', className: '' }));

      const details = [
        status?.text ? `Status: ${status.text}` : null,
        status?.className ? `Status class: ${status.className}` : null,
        pageErrors[0] ? `Page error: ${pageErrors[0]}` : null,
        consoleErrors[0] ? `Console error: ${consoleErrors[0]}` : null,
        requestFailures[0] ? `Request failed: ${requestFailures[0]}` : null,
      ].filter(Boolean).join('\n');

      throw new Error(details || String(e?.message ?? e));
    }

    const status = await page.evaluate(() => document.getElementById('status')?.textContent ?? '');
    const isSuccess = await page.evaluate(() => document.getElementById('status')?.classList.contains('success') ?? false);

    if (!isSuccess) {
      const err = pageErrors[0] || consoleErrors[0] || status || 'Unknown error';
      const typstSource = await getTypstSource(page);
      if (typstSource) {
        throw new Error(`${err}\n\n--- Typst source ---\n${typstSource}`);
      }
      throw new Error(err);
    }

    if (expectations && typeof expectations === 'object') {
      const typstSource = await getTypstSource(page);
      if (typstSource == null) {
        throw new Error('Expected Typst source but none was produced');
      }

      const debugInfo = await getDebugInfo(page);

      const mustContain = hasOwn(expectations, 'mustContainTypst') ? expectations.mustContainTypst : null;
      const mustNotContain = hasOwn(expectations, 'mustNotContainTypst') ? expectations.mustNotContainTypst : null;
      const mustContainSidecarUrl = hasOwn(expectations, 'mustContainSidecarUrl')
        ? expectations.mustContainSidecarUrl
        : null;
      const mustContainTemplateUrl = hasOwn(expectations, 'mustContainTemplateUrl')
        ? expectations.mustContainTemplateUrl
        : null;

      if (Array.isArray(mustContain)) {
        for (const needle of mustContain) {
          if (needle == null) continue;
          if (!String(typstSource).includes(String(needle))) {
            throw new Error(
              `Typst source missing expected substring: ${needle}\n\n--- Typst source ---\n${typstSource}`,
            );
          }
        }
      }

      if (Array.isArray(mustNotContain)) {
        for (const needle of mustNotContain) {
          if (needle == null) continue;
          if (String(typstSource).includes(String(needle))) {
            throw new Error(
              `Typst source unexpectedly contained substring: ${needle}\n\n--- Typst source ---\n${typstSource}`,
            );
          }
        }
      }

      if (Array.isArray(mustContainSidecarUrl)) {
        const sidecarUrl = debugInfo?.sidecarUrl;
        if (!sidecarUrl) {
          throw new Error(`Expected sidecarUrl but none was reported`);
        }
        for (const needle of mustContainSidecarUrl) {
          if (needle == null) continue;
          if (!String(sidecarUrl).includes(String(needle))) {
            throw new Error(`sidecarUrl missing expected substring: ${needle}\nsidecarUrl=${sidecarUrl}`);
          }
        }
      }

      if (Array.isArray(mustContainTemplateUrl)) {
        const templateUrl = debugInfo?.templateUrl;
        if (!templateUrl) {
          throw new Error(`Expected templateUrl but none was reported`);
        }
        for (const needle of mustContainTemplateUrl) {
          if (needle == null) continue;
          if (!String(templateUrl).includes(String(needle))) {
            throw new Error(`templateUrl missing expected substring: ${needle}\ntemplateUrl=${templateUrl}`);
          }
        }
      }
    }

    const pdf = await getPdfBytes(page);
    if (!pdf || pdf.length < 1000) {
      throw new Error('PDF output missing or too small');
    }

    if (writePdf) {
      // Preserve input directory structure under outDir.
      // Examples:
      // - test/fixtures/markdown/basic/links.md -> test/output/test/fixtures/markdown/basic/links.pdf
      // - examples/article.md                  -> test/output/examples/article.pdf
      const outRelPdf = srcPath.replace(/\.md$/i, '.pdf');
      const outPath = path.resolve(repoRoot, outDir, outRelPdf);
      await fs.mkdir(path.dirname(outPath), { recursive: true });
      await fs.writeFile(outPath, pdf);
    }

    return { ok: true, status };
  } finally {
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
    page.off('requestfailed', onRequestFailed);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const patterns = (args.patterns && args.patterns.length)
    ? args.patterns
    : ['test/fixtures/markdown/**/*.md'];

  const fileLists = await Promise.all(patterns.map((p) => listMarkdownFiles(p)));
  const files = Array.from(new Set(fileLists.flat())).sort();
  if (files.length === 0) {
    console.error(`No files matched --pattern ${patterns.join(' ')}`);
    process.exit(2);
  }

  const { server, baseUrl } = await startStaticServer();

  if (args.writePdf) {
    const outPath = path.resolve(repoRoot, args.outDir);
    await fs.mkdir(outPath, { recursive: true });
    console.log(`Writing PDFs to ${path.relative(repoRoot, outPath)}`);
  }

  const browser = await chromium.launch({ headless: !args.headful });
  const context = await browser.newContext();

  const concurrency = Math.max(1, Math.min(args.concurrency || 1, files.length));
  const pages = [];
  for (let i = 0; i < concurrency; i++) {
    pages.push(await context.newPage());
  }

  let passed = 0;
  let nextIndex = 0;
  let abort = false;
  const failed = [];

  try {
    console.log(`Running ${files.length} fixtures (concurrency=${concurrency})...`);

    const worker = async (page) => {
      while (true) {
        if (abort) return;
        const idx = nextIndex++;
        if (idx >= files.length) return;

        const f = files[idx];
        try {
          await runOne(page, baseUrl, f, args);
          passed++;
          if (passed % 25 === 0 || passed === files.length) {
            console.log(`... ${passed}/${files.length} ok`);
          }
        } catch (e) {
          if (!abort) {
            abort = true;
            failed.push({ file: f, error: String(e?.message ?? e) });
            console.log(`FAIL: ${f}`);
          }
          return;
        }
      }
    };

    await Promise.all(pages.map((p) => worker(p)));
  } finally {
    await Promise.all(pages.map((p) => p.close().catch(() => {})));
    await context.close();
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }

  if (failed.length) {
    console.error(`\nFailed: ${failed[0].file}`);
    console.error(failed[0].error);
    process.exit(1);
  }

  console.log(`\nAll good: ${passed}/${files.length} fixtures passed.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
