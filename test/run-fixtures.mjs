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
const fixturesMarkdownRoot = 'test/fixtures/markdown';

function parseArgs(argv) {
  const args = {
    pattern: 'test/fixtures/markdown/**/*.md',
    outDir: 'test/output',
    writePdf: true,
    headful: false,
    timeoutMs: 120_000,
    concurrency: Math.max(1, Math.min(4, os.cpus()?.length || 1)),
    renderer: 'fallback',
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--pattern' && argv[i + 1]) args.pattern = argv[++i];
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

async function runOne(page, baseUrl, srcPath, { timeoutMs, writePdf, outDir, renderer }) {
  const params = new URLSearchParams({
    src: srcPath,
    renderer: renderer || 'fallback',
  });
  const url = `${baseUrl}/render.html?${params.toString()}`;

  const consoleErrors = [];
  const onConsole = (msg) => {
    const type = msg.type();
    if (type === 'error') consoleErrors.push(msg.text());
  };
  page.on('console', onConsole);

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });

    // Wait for either success or error.
    await page.waitForFunction(
      () => {
        const el = document.getElementById('status');
        if (!el) return false;
        return el.classList.contains('success') || el.classList.contains('error');
      },
      { timeout: timeoutMs },
    );

    const status = await page.evaluate(() => document.getElementById('status')?.textContent ?? '');
    const isSuccess = await page.evaluate(() => document.getElementById('status')?.classList.contains('success') ?? false);

    if (!isSuccess) {
      const err = consoleErrors[0] || status || 'Unknown error';
      const typstSource = await getTypstSource(page);
      if (typstSource) {
        throw new Error(`${err}\n\n--- Typst source ---\n${typstSource}`);
      }
      throw new Error(err);
    }

    const pdf = await getPdfBytes(page);
    if (!pdf || pdf.length < 1000) {
      throw new Error('PDF output missing or too small');
    }

    if (writePdf) {
      // Mirror the folder structure under test/fixtures/markdown so outputs are easy to locate.
      // Example:
      //   srcPath: test/fixtures/markdown/basic/links.md
      //   outDir:  test/output
      //   out:     test/output/basic/links.pdf
      const relativeFromMarkdownRoot = path
        .relative(fixturesMarkdownRoot, srcPath)
        .replaceAll(path.sep, '/');
      const relativeOut = relativeFromMarkdownRoot.startsWith('..')
        ? srcPath
        : relativeFromMarkdownRoot;
      const outRelPdf = relativeOut.replace(/\.md$/i, '.pdf');
      const outPath = path.resolve(repoRoot, outDir, outRelPdf);
      await fs.mkdir(path.dirname(outPath), { recursive: true });
      await fs.writeFile(outPath, pdf);
    }

    return { ok: true, status };
  } finally {
    page.off('console', onConsole);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const files = await listMarkdownFiles(args.pattern);
  if (files.length === 0) {
    console.error(`No files matched --pattern ${args.pattern}`);
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
