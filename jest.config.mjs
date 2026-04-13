/**
 * Jest configuration for Nemosyne - ES Module config
 * Supports ES modules natively
 * Target: 95% coverage
 */
export default {
  testEnvironment: 'node',
  transform: {},
  setupFiles: ['<rootDir>/tests/setup.mjs'],
  collectCoverageFrom: [
    'src/core/*.js',
  ],
  coverageThreshold: {
    global: {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
  testMatch: [
    '<rootDir>/tests/core.test.mjs',
    '<rootDir>/tests/data-native-engine.test.mjs',
    '<rootDir>/tests/data-native-engine-additional.test.mjs',
    '<rootDir>/tests/index.test.mjs',
    '<rootDir>/tests/layout-engine.test.mjs',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/framework/',
    '/docs/',
    '/examples/',
  ],
  moduleFileExtensions: ['js', 'json', 'mjs'],
};
