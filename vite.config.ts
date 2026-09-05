import { defineConfig } from 'vite';
import {
  demoStreamPlugin,
  signallingPlugin,
  remoteLogsPlugin,
  validationFinalizationPlugin,
  loadtestResultsPlugin,
  uxTracePlugin,
  wasmServePlugin,
  spatialSceneInspectorPlugin,
  httpsOptions,
} from './dev/index.ts';

export default defineConfig(({ command }) => ({
  plugins: [
    demoStreamPlugin(),
    signallingPlugin(),
    remoteLogsPlugin(),
    // Must precede the existing sink: it write-locks finalized sessions and
    // finalizes successful governed writes without replacing collection.
    validationFinalizationPlugin(),
    loadtestResultsPlugin(),
    uxTracePlugin(),
    wasmServePlugin(),
    spatialSceneInspectorPlugin(),
  ],
  server: {
    // Security boundary: all dev middleware, including signalling, remote logs,
    // load-test results and UX trace endpoints, is loopback-only by default.
    // Quest/LAN validation must opt in explicitly with `vite --host 0.0.0.0`
    // (the repository exposes that as `npm run dev:lan`).
    host: '127.0.0.1',
    https: httpsOptions(command),
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  preview: {
    // Localhost only: the dev-only signalling/demo-stream plugins mount in
    // preview too. LAN preview must be an explicit operator choice.
    host: '127.0.0.1',
    https: httpsOptions(command),
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      // The wasm-pack output is optional in production; externalise it so
      // `npm run build` (which does not run wasm-pack) still succeeds. When the
      // wasm module is present the dynamic import fetches it at runtime.
      external: ['/wasm/pkg/nemosyne_wasm.js'],
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('/src/data/serializers/')) return 'serializers';
          if (id.includes('/src/vr/ui/')) return 'vr-ui';
          return undefined;
        },
      },
    },
  },
}));
