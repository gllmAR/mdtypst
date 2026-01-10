import path from 'node:path';
import fs from 'node:fs/promises';

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

  // Helpful marker file.
  await copyFile(
    new URL('../README.md', import.meta.url).pathname,
    path.join(vendorRoot, 'README.source.md'),
  ).catch(() => {});

  console.log('Done. Created:');
  console.log(`- ${path.relative(repoRoot, typstDest)}/ (Typst runtime)`);
  console.log(`- ${path.relative(repoRoot, mermaidDest)}/ (Mermaid runtime)`);
  console.log('You can now run the app offline via `npm run serve` after this step.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
