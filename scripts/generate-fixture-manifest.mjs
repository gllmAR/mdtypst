import path from 'node:path';
import fs from 'node:fs/promises';

function repoRootFromScriptUrl() {
  return path.resolve(new URL('..', import.meta.url).pathname);
}

async function walk(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...(await walk(abs)));
    } else {
      out.push(abs);
    }
  }
  return out;
}

export async function generateFixtureManifest({ repoRoot, outFile } = {}) {
  const root = repoRoot || repoRootFromScriptUrl();
  const sources = [path.join(root, 'test', 'fixtures'), path.join(root, 'examples')];

  const allFiles = [];
  for (const dir of sources) {
    try {
      // Skip missing directories (e.g. when examples/ isn't present).
      await fs.access(dir);
      allFiles.push(...(await walk(dir)));
    } catch {
      // ignore
    }
  }

  const rel = allFiles
    .map((abs) => path.relative(root, abs))
    .map((p) => p.split(path.sep).join('/'))
    .filter((p) => p.endsWith('.md'))
    .sort();

  const payload = {
    generatedAt: new Date().toISOString(),
    files: rel,
  };

  const dest = outFile || path.join(root, 'fixtures-manifest.json');
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, JSON.stringify(payload, null, 2) + '\n', 'utf8');

  return { count: rel.length, outFile: dest };
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  generateFixtureManifest()
    .then(({ count, outFile }) => {
      // eslint-disable-next-line no-console
      console.log(`Wrote ${count} fixture paths to ${outFile}`);
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      process.exit(1);
    });
}
