import { defineConfig } from 'vite';
import { resolve } from 'path';

const baseConfig = {
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
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
    rollupOptions: {
      external: ['aframe'],
      output: {
        globals: {
          'aframe': 'AFRAME'
        }
      }
    }
  },
  server: {
    port: 3000,
    open: '/examples/hello-world/'
  },
  preview: {
    port: 4173,
    open: '/examples/hello-world/'
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.js']
  }
};

// Export based on mode
export default ({ mode }) => {
  if (mode === 'umd') {
    return defineConfig({
      ...baseConfig,
      build: {
        ...baseConfig.build,
        lib: {
          entry: resolve(__dirname, 'src/index-v2.js'),
          name: 'Nemosyne',
          formats: ['umd'],
          fileName: () => 'nemosyne.umd.js'
        }
      }
    });
  }
  
  if (mode === 'iife') {
    return defineConfig({
      ...baseConfig,
      build: {
        ...baseConfig.build,
        lib: {
          entry: resolve(__dirname, 'src/index-v2.js'),
          name: 'Nemosyne',
          formats: ['iife'],
          fileName: () => 'nemosyne.iife.js'
        }
      }
    });
  }
  
  // Default: ES Module
  return defineConfig({
    ...baseConfig,
    build: {
      ...baseConfig.build,
      lib: {
        entry: resolve(__dirname, 'src/index-v2.js'),
        name: 'Nemosyne',
        formats: ['es'],
        fileName: () => 'nemosyne.es.js'
      }
    }
  });
};