import { defineConfig } from 'vite';
import { resolve } from 'path';
import { minify } from 'terser';

// Production build configuration for Nemosyne v0.2
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console.logs for debugging
        drop_debugger: true,
        passes: 2
      },
      mangle: {
        reserved: ['Nemosyne', 'AFRAME']
      },
      format: {
        comments: false
      }
    },
    lib: {
      entry: {
        // Main v0.2 entry (recommended)
        'nemosyne': resolve(__dirname, 'src/index-v2.js'),
        'nemosyne.min': resolve(__dirname, 'src/index-v2.js'),
        // Legacy v0.1 entry (backwards compatibility)
        'nemosyne.legacy': resolve(__dirname, 'src/index.js')
      },
      name: 'Nemosyne',
      formats: ['es', 'umd', 'iife']
    },
    rollupOptions: {
      external: ['aframe'],
      output: {
        globals: {
          'aframe': 'AFRAME'
        },
        // Preserve directory structure
        entryFileNames: '[name].[format].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/\.(png|jpe?g|gif|svg|webp|ico)$/i.test(assetInfo.name)) {
            return `assets/images/[name][extname]`;
          }
          if (/\.css$/i.test(assetInfo.name)) {
            return `assets/css/[name][extname]`;
          }
          return `assets/[name][extname]`;
        }
      }
    }
  },
  
  // Development server
  server: {
    port: 3000,
    open: '/examples/hello-world/'
  },
  
  // Preview server for testing production build
  preview: {
    port: 4173,
    open: '/examples/hello-world/'
  },
  
  // Test configuration
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.js']
  }
});
