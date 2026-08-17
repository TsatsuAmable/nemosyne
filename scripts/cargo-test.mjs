import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

const cargoBin = path.join(os.homedir(), '.cargo', 'bin');
const currentPath = process.env.PATH || '';
const env = {
  ...process.env,
  PATH: currentPath.includes(cargoBin) ? currentPath : `${cargoBin}${path.delimiter}${currentPath}`,
};

const cargoExecutable = process.platform === 'win32' ? 'cargo.exe' : 'cargo';
let res = spawnSync(cargoExecutable, ['test', '--manifest-path', 'wasm/Cargo.toml', ...process.argv.slice(2)], { stdio: 'inherit', env });

if (res.error) {
  const localCargo = path.join(cargoBin, cargoExecutable);
  res = spawnSync(localCargo, ['test', '--manifest-path', 'wasm/Cargo.toml', ...process.argv.slice(2)], { stdio: 'inherit', env });
  if (res.error) {
    console.error(`[cargo-test] Error executing cargo:`, res.error.message);
    process.exit(1);
  }
}

process.exit(res.status ?? 0);
