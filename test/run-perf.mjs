import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import handler from 'serve-handler';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = {
    page: null, // if null, we start a local server and use /render.html
    src: null,
    renderer: 'auto',
    runs: 3,
    headful: false,
    timeoutMs: 180_000,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--page' && argv[i + 1]) args.page = argv[++i];
    else if (a === '--src' && argv[i + 1]) args.src = argv[++i];
    else if (a === '--renderer' && argv[i + 1]) args.renderer = argv[++i];
    else if (a === '--runs' && argv[i + 1]) args.runs = Math.max(1, Number(argv[++i]));
    else if (a === '--headful') args.headful = true;
    else if (a === '--timeout' && argv[i + 1]) args.timeoutMs = Number(argv[++i]);
  }

  if (!args.src) {
    throw new Error('Missing --src <markdown-url-or-path>');
  }

  return args;
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

function buildRenderUrl(basePageUrl, src, renderer) {
  const u = new URL(basePageUrl);
  const params = new URLSearchParams(u.search);
  params.set('src', src);
  if (renderer) params.set('renderer', renderer);
  u.search = params.toString();
  return u.toString();
}

function ms(n) {
  return `${Math.round(n)}ms`;
}

async function runOnce(page, url, timeoutMs) {
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });

  await page.waitForFunction(
    () => {
      const el = document.getElementById('status');
      if (!el) return false;
      return el.classList.contains('success') || el.classList.contains('error');
    },
    { timeout: timeoutMs },
  );

  const status = await page.evaluate(() => document.getElementById('status')?.textContent ?? '');
  const ok = await page.evaluate(() => document.getElementById('status')?.classList.contains('success') ?? false);
  const timings = await page.evaluate(() => globalThis.__mdtypst?.getTimings?.() ?? null);

  const totalMs = Date.now() - t0;
  if (!ok) {
    throw new Error(`Render failed in ${totalMs}ms: ${status}`);
  }

  return { totalMs, timings };
}

function summarizeTimings(t) {
  if (!t || !t.marks) return null;
  const m = t.marks;
  const d = (a, b) => (m[a] != null && m[b] != null ? m[b] - m[a] : null);

  return {
    fetch: d('fetch:start', 'fetch:done'),
    mermaid: d('mermaid:start', 'mermaid:done'),
    images: d('images:scan:start', 'images:mounted'),
    typstConvert: d('typst:convert:start', 'typst:convert:done'),
    pdfCompile: d('typst:convert:done', 'pdf:compiled'),
    toDisplayed: d('compile:start', 'pdf:displayed'),
    counters: t.counters || {},
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  let server = null;
  let basePageUrl = args.page;

  if (!basePageUrl) {
    const started = await startStaticServer();
    server = started.server;
    basePageUrl = `${started.baseUrl}/render.html`;
  }

  const url = buildRenderUrl(basePageUrl, args.src, args.renderer);
  console.log(`URL: ${url}`);

  const browser = await chromium.launch({ headless: !args.headful });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const results = [];
    for (let i = 0; i < args.runs; i++) {
      const r = await runOnce(page, url, args.timeoutMs);
      results.push(r);
      const s = summarizeTimings(r.timings);
      if (s) {
        console.log(
          `run ${i + 1}/${args.runs}: total=${ms(r.totalMs)} fetch=${s.fetch != null ? ms(s.fetch) : 'n/a'} images=${s.images != null ? ms(s.images) : 'n/a'} pdf=${s.pdfCompile != null ? ms(s.pdfCompile) : 'n/a'} mounted=${s.counters.imagesMounted ?? 0}/${s.counters.imagesTotal ?? 0} failed=${s.counters.imagesFailed ?? 0}`,
        );
      } else {
        console.log(`run ${i + 1}/${args.runs}: total=${ms(r.totalMs)}`);
      }
    }

    const avg = results.reduce((acc, r) => acc + r.totalMs, 0) / results.length;
    const min = Math.min(...results.map((r) => r.totalMs));
    const max = Math.max(...results.map((r) => r.totalMs));
    console.log(`avg=${ms(avg)} min=${ms(min)} max=${ms(max)}`);
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    if (server) await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
