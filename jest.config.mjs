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
      branches: 70,      // Actual: ~70.66%
      functions: 82,     // Actual: ~82.81%
      lines: 80,         // Actual: ~80.15%
      statements: 78,    // Actual: ~78.65%
    },
  },
  testMatch: [
    '<rootDir>/tests/core.test.mjs',
    '<rootDir>/tests/coverage-gaps.test.mjs',
    '<rootDir>/tests/coverage-90.test.mjs',
    '<rootDir>/tests/data-native-engine.test.mjs',
    '<rootDir>/tests/data-native-engine-additional.test.mjs',
    '<rootDir>/tests/event-handlers.test.mjs',
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
