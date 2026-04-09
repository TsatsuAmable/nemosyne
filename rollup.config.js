/**
 * Rollup configuration for ESM builds
 * Optimized for tree-shaking
 */

export default {
  input: 'src/index.js',
  
  output: [
    {
      file: 'dist/nemosyne.esm.js',
      format: 'esm',
      sourcemap: true
    },
    {
      file: 'dist/nemosyne.esm.min.js',
      format: 'esm',
      sourcemap: true,
      plugins: [terser()]
    }
  ],
  
  external: ['aframe', 'three'],
  
  plugins: [
    {
      name: 'external',
      resolveId(source) {
        if (source === 'aframe' || source === 'three') {
          return { id: source, external: true };
        }
        return null;
      }
    }
  ]
};

// Terser for minification
function terser() {
  return {
    name: 'terser',
    renderChunk(code) {
      // Simple minification (would use actual terser in production)
      return {
        code: code.replace(/\s+/g, ' ').trim(),
        map: null
      };
    }
  };
}
