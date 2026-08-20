import fs from 'node:fs';
import path from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';

export function wasmServePlugin(): Plugin {
  const wasmPkgDir = path.resolve(process.cwd(), 'wasm', 'pkg');
  
  const serveMiddleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    let relative = (req.url || '').replace(/^\//, '').split('?')[0];
    if (relative.startsWith('pkg/')) {
      relative = relative.replace(/^pkg\//, '');
    }
    // Path-traversal guard: reject any `..` segment and require the
    // resolved path to stay inside the wasm pkg directory.
    if (relative.includes('..')) {
      next();
      return;
    }
    const filePath = path.resolve(wasmPkgDir, relative);
    if (!filePath.startsWith(wasmPkgDir + path.sep)) {
      next();
      return;
    }
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
  };

  return {
    name: 'nemosyne-wasm-serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/wasm', serveMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/wasm', serveMiddleware);
    },
    async writeBundle(bundleOptions) {
      const outDir = bundleOptions.dir || path.resolve(process.cwd(), 'dist');
      if (!fs.existsSync(wasmPkgDir)) return;

      const destPkgDir = path.join(outDir, 'wasm', 'pkg');
      const destWasmDir = path.join(outDir, 'wasm');
      fs.mkdirSync(destPkgDir, { recursive: true });

      for (const entry of fs.readdirSync(wasmPkgDir)) {
        const src = path.join(wasmPkgDir, entry);
        if (fs.statSync(src).isFile()) {
          fs.copyFileSync(src, path.join(destPkgDir, entry));
          fs.copyFileSync(src, path.join(destWasmDir, entry));
        }
      }
    },
  };
}
