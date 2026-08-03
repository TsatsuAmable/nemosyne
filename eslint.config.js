import js from '@eslint/js';
import globals from 'globals';
import importPlugin from 'eslint-plugin-import';
import vitest from 'eslint-plugin-vitest';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...vitest.environments.env.globals,
      },
    },
    plugins: {
      import: importPlugin,
      vitest,
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-var': 'error',
      'prefer-const': 'error',
      'object-shorthand': 'warn',
      'import/no-cycle': 'error',
      'import/no-unresolved': 'off',
      'vitest/no-disabled-tests': 'warn',
      'vitest/no-focused-tests': 'error',
    },
  },
  {
    files: ['tests/**/*.js'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    ignores: ['node_modules/', 'dist/', 'coverage/', 'docs/nemosyne-world/', 'artefacts/'],
  },
];
