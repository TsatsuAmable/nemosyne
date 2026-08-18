import { defineConfig } from 'vite';
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULE_ROOT = join(HERE, '..');
const ORT_DIST = join(MODULE_ROOT, 'node_modules', 'onnxruntime-web', 'dist');
const WASM_DEST = join(HERE, 'public', 'ort-wasm');

function copyOrtWasm() {
  return {
    name: 'copy-ort-wasm',
    configResolved() {
      if (!existsSync(ORT_DIST)) return;
      mkdirSync(WASM_DEST, { recursive: true });
      for (const f of readdirSync(ORT_DIST)) {
        if (f.endsWith('.wasm')) copyFileSync(join(ORT_DIST, f), join(WASM_DEST, f));
      }
    },
  };
}

export default defineConfig({
  root: HERE,
  plugins: [copyOrtWasm()],
  server: { host: true },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});