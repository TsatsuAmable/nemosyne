import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';

const isDev = process.argv.includes('--dev');
const cargoBin = path.join(os.homedir(), '.cargo', 'bin');

const currentPath = process.env.PATH || '';
const env = {
  ...process.env,
  PATH: currentPath.includes(cargoBin) ? currentPath : `${cargoBin}${path.delimiter}${currentPath}`,
};

const args = ['build', 'wasm', '--target', 'web', '--out-dir', 'pkg'];
if (isDev) {
  args.push('--dev');
}

const require = createRequire(import.meta.url);
let wasmPackRunner;
try {
  wasmPackRunner = require.resolve('wasm-pack/run.js');
} catch {
  // The Cargo-installed executable below remains available for environments
  // that intentionally install production dependencies without devDependencies.
}

let res = wasmPackRunner
  ? spawnSync(process.execPath, [wasmPackRunner, ...args], { stdio: 'inherit', env })
  : { error: new Error('The project-local wasm-pack npm package is not installed') };

if (res.error) {
  const localWasmPack = path.join(cargoBin, process.platform === 'win32' ? 'wasm-pack.exe' : 'wasm-pack');
  res = spawnSync(localWasmPack, args, { stdio: 'inherit', env });
  if (res.error) {
    console.error(`[build-wasm] Error executing wasm-pack:`, res.error.message);
    process.exit(1);
  }
}

process.exit(res.status ?? 0);
