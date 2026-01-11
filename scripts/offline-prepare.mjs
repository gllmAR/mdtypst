import path from 'node:path';
import fs from 'node:fs/promises';
import https from 'node:https';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function copyDir(src, dest) {
  await fs.rm(dest, { recursive: true, force: true });
  await fs.mkdir(path.dirname(dest), { recursive: true });
  // Node 16+ supports fs.cp
  await fs.cp(src, dest, { recursive: true });
}

async function copyFile(src, dest) {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
}

async function downloadToFile(url, dest) {
  await fs.mkdir(path.dirname(dest), { recursive: true });

  const requestOnce = (u) =>
    new Promise((resolve, reject) => {
      https
        .get(u, (res) => {
          const { statusCode, headers } = res;
          if (statusCode && statusCode >= 300 && statusCode < 400 && headers.location) {
            res.resume();
            resolve({ redirect: headers.location });
            return;
          }
          if (statusCode !== 200) {
            res.resume();
            reject(new Error(`HTTP ${statusCode} for ${u}`));
            return;
          }
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => resolve({ data: Buffer.concat(chunks) }));
        })
        .on('error', reject);
    });

  let current = url;
  for (let i = 0; i < 5; i += 1) {
    const result = await requestOnce(current);
    if (result.redirect) {
      current = new URL(result.redirect, current).toString();
      continue;
    }
    await fs.writeFile(dest, result.data);
    return;
  }
  throw new Error(`Too many redirects for ${url}`);
}

async function main() {
  const vendorRoot = path.join(repoRoot, 'vendor');

  const typstSrc = path.join(
    repoRoot,
    'node_modules',
    '@myriaddreamin',
    'typst-all-in-one.ts',
    'dist',
    'esm',
  );
  const typstDest = path.join(vendorRoot, 'typst');

  const mermaidSrc = path.join(repoRoot, 'node_modules', 'mermaid', 'dist');
  const mermaidDest = path.join(vendorRoot, 'mermaid');

  if (!(await pathExists(typstSrc))) {
    throw new Error(
      `Missing ${typstSrc}. Run \"npm install\" first (needs @myriaddreamin/typst-all-in-one.ts).`,
    );
  }
  if (!(await pathExists(mermaidSrc))) {
    throw new Error(`Missing ${mermaidSrc}. Run \"npm install\" first (needs mermaid).`);
  }

  console.log('Vendoring browser dependencies for offline use...');

  await copyDir(typstSrc, typstDest);
  await copyDir(mermaidSrc, mermaidDest);

  // Vendor Typst preview packages so @preview/... imports work offline / on Pages.
  const packagesDest = path.join(vendorRoot, 'typst-packages', 'preview');
  const previewPackages = [
    { name: 'cmarker', version: '0.1.8' },
    { name: 'tablem', version: '0.3.0' },
    { name: 'mitex', version: '0.2.4' },
  ];

  console.log('Vendoring Typst preview packages...');
  await fs.mkdir(packagesDest, { recursive: true });
  for (const pkg of previewPackages) {
    const filename = `${pkg.name}-${pkg.version}.tar.gz`;
    const url = `https://packages.typst.org/preview/${filename}`;
    const dest = path.join(packagesDest, filename);
    await downloadToFile(url, dest);
    console.log(`- ${path.relative(repoRoot, dest)}`);
  }

  // Helpful marker file.
  await copyFile(
    new URL('../README.md', import.meta.url).pathname,
    path.join(vendorRoot, 'README.source.md'),
  ).catch(() => {});

  console.log('Done. Created:');
  console.log(`- ${path.relative(repoRoot, typstDest)}/ (Typst runtime)`);
  console.log(`- ${path.relative(repoRoot, mermaidDest)}/ (Mermaid runtime)`);
  console.log(`- ${path.relative(repoRoot, packagesDest)}/ (Typst preview packages)`);
  console.log('You can now run the app offline via `npm run serve` after this step.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
