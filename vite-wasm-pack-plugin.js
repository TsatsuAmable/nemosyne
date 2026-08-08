import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WASM_DIR = path.resolve(__dirname, 'wasm');
const WASM_PKG_DIR = path.resolve(WASM_DIR, 'pkg');

/**
 * Vite plugin that builds the Rust/WASM crate with wasm-pack before serving
 * or bundling, and makes the generated `.wasm` and JS glue available as
 * static assets.
 *
 * In development the `wasm/pkg/` directory is served under `/wasm/`. In
 * production the `.wasm` file is copied into `dist/` so the relative import
 * from the JS host keeps working.
 */
export default function wasmPackPlugin(options = {}) {
  const { target = 'web', outDir = 'pkg', mode = 'release' } = options;
  const devMode = mode === 'dev';

  function runWasmPack() {
    return new Promise((resolve, reject) => {
      const args = ['build', WASM_DIR, '--target', target, '--out-dir', outDir];
      if (!devMode) args.push('--release');
      if (devMode) args.push('--dev');

      // npm scripts can override the binary path via WAM_PACK_PATH.
      const bin = process.env.WASM_PACK_PATH || 'wasm-pack';
      console.log(`[wasm-pack] ${bin} ${args.join(' ')}`);

      const child = spawn(bin, args, {
        stdio: 'inherit',
        shell: false,
        cwd: __dirname,
      });

      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`wasm-pack exited with code ${code}`));
      });
    });
  }

  return {
    name: 'nemosyne-wasm-pack',
    enforce: 'pre',

    async buildStart() {
      if (!fs.existsSync(WASM_DIR)) {
        throw new Error(`WASM source directory not found: ${WASM_DIR}`);
      }
      await runWasmPack();
    },

    configureServer(server) {
      server.middlewares.use('/wasm', (req, res, next) => {
        let relative = req.url.replace(/^\//, '').split('?')[0];
        if (relative.startsWith('pkg/')) {
          relative = relative.replace(/^pkg\//, '');
        }
        const filePath = path.join(WASM_PKG_DIR, relative);
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          next();
          return;
        }

        const ext = path.extname(filePath).toLowerCase();
        let mime = 'application/octet-stream';
        if (ext === '.wasm') mime = 'application/wasm';
        else if (ext === '.js') mime = 'application/javascript';
        else if (ext === '.json') mime = 'application/json';

        res.setHeader('Content-Type', mime);
        fs.createReadStream(filePath).pipe(res);
      });
    },

    async writeBundle(bundleOptions) {
      const outDir = bundleOptions.dir || path.resolve(__dirname, 'dist');
      if (!fs.existsSync(WASM_PKG_DIR)) return;

      // Copy every file from wasm/pkg into dist/wasm so the bundled JS host
      // can resolve the same relative path in production.
      const destDir = path.join(outDir, 'wasm');
      fs.mkdirSync(destDir, { recursive: true });
      for (const entry of fs.readdirSync(WASM_PKG_DIR)) {
        const src = path.join(WASM_PKG_DIR, entry);
        const dest = path.join(destDir, entry);
        if (fs.statSync(src).isFile()) {
          fs.copyFileSync(src, dest);
        }
      }
    },
  };
}
