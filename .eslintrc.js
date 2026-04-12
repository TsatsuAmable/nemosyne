/**
 * Nemosyne ESLint Configuration
 * Basic config for research framework JavaScript
 */

module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  globals: {
    // A-Frame globals
    AFRAME: 'readonly',
    THREE: 'readonly',
    // Browser globals
    window: 'readonly',
    document: 'readonly',
    navigator: 'readonly',
    // VR globals
    XRWebGLLayer: 'readonly',
    XRSession: 'readonly'
  },
  rules: {
    // Relaxed rules for research code
    'no-unused-vars': ['warn', { 'argsIgnorePattern': '^_' }],
    'no-console': 'off',
    'no-debugger': 'warn',
    // Allow modern JS features
    'no-undef': 'error',
    'no-duplicate-imports': 'error'
  },
  ignorePatterns: [
    'dist/',
    'node_modules/',
    'coverage/',
    'docs/generated/',
    'examples/**/vendor/',
    'framework/node_modules/'
  ]
};
