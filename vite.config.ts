import { defineConfig } from 'vite';
import {
  demoStreamPlugin,
  signallingPlugin,
  remoteLogsPlugin,
  loadtestResultsPlugin,
  uxTracePlugin,
  wasmServePlugin,
  httpsOptions,
} from './dev/index.ts';

export default defineConfig(({ command }) => ({
  plugins: [
    demoStreamPlugin(),
    signallingPlugin(),
    remoteLogsPlugin(),
    loadtestResultsPlugin(),
    uxTracePlugin(),
    wasmServePlugin(),
  ],
  server: {
    host: true,
    https: httpsOptions(command),
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  preview: {
    // Localhost only: the dev-only signalling/demo-stream plugins mount in
    // preview too, and `host: true` would expose them to the LAN. Dev (serve)
    // stays `host: true` because the Quest workflow needs LAN reachability.
    host: false,
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
