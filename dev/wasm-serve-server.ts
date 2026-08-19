import fs from 'node:fs';
import path from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';

export function wasmServePlugin(): Plugin {
  const wasmPkgDir = path.resolve(process.cwd(), 'wasm', 'pkg');
  return {
    name: 'nemosyne-wasm-serve',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/wasm', (req: IncomingMessage, res: ServerResponse, next: () => void) => {
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
      });
    },
  };
}
