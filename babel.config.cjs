/**
 * Babel configuration for Jest
 * Transforms ES modules to CommonJS
 */
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
  ],
};
