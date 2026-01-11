import path from 'node:path';
import fs from 'node:fs/promises';

import { generateFixtureManifest } from './generate-fixture-manifest.mjs';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const distDir = path.join(repoRoot, 'dist');

async function copyDir(src, dest) {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.cp(src, dest, { recursive: true });
}

async function copyFile(src, dest) {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(distDir, { recursive: true });

  const filesToCopy = [
    'index.html',
    'render.html',
    'render.js',
    'sample.md',
    'serve.json',
  ];

  for (const rel of filesToCopy) {
    const src = path.join(repoRoot, rel);
    if (await pathExists(src)) {
      await copyFile(src, path.join(distDir, rel));
    }
  }

  const vendorSrc = path.join(repoRoot, 'vendor');
  if (!(await pathExists(vendorSrc))) {
    throw new Error('Missing vendor/. Run `npm run offline:prepare` before building Pages artifacts.');
  }
  await copyDir(vendorSrc, path.join(distDir, 'vendor'));

  const srcDir = path.join(repoRoot, 'src');
  if (await pathExists(srcDir)) {
    await copyDir(srcDir, path.join(distDir, 'src'));
  }

  // Include fixture documents for the index.html fixture browser.
  const fixturesDir = path.join(repoRoot, 'test', 'fixtures');
  if (await pathExists(fixturesDir)) {
    await copyDir(fixturesDir, path.join(distDir, 'test', 'fixtures'));
  }

  // Include curated examples alongside fixtures.
  const examplesDir = path.join(repoRoot, 'examples');
  if (await pathExists(examplesDir)) {
    await copyDir(examplesDir, path.join(distDir, 'examples'));
  }

  // Generate a manifest that index.html can fetch in both dev and Pages builds.
  await generateFixtureManifest({ repoRoot, outFile: path.join(distDir, 'fixtures-manifest.json') });

  console.log(`Built ${path.relative(repoRoot, distDir)}/ for GitHub Pages.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
