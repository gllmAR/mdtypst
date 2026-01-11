import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';

function repoRootFromScriptUrl() {
  return path.resolve(new URL('..', import.meta.url).pathname);
}

function run(cmd, args, { cwd } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: 'inherit' });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`));
    });
  });
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
  const root = repoRootFromScriptUrl();
  const dest = path.join(root, 'third_party', 'typst-templates');

  if (await pathExists(dest)) {
    console.log(`Already present: ${path.relative(root, dest)}`);
    console.log('Tip: run `git -C third_party/typst-templates pull --ff-only` to update.');
    return;
  }

  await fs.mkdir(path.dirname(dest), { recursive: true });
  console.log('Cloning https://github.com/typst/templates ...');
  await run('git', ['clone', '--depth', '1', 'https://github.com/typst/templates', dest], { cwd: root });
  console.log(`Cloned into ${path.relative(root, dest)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
