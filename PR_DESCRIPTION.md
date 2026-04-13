# Test Coverage Improvements

This PR adds comprehensive test coverage for the Nemosyne core modules.

## Changes

### New Test Files
- `jest.config.mjs` - Jest configuration with ES module support and coverage thresholds
- `tests/core.test.mjs` - Core module exports and API validation
- `tests/data-native-engine.test.mjs` - DataNativeEngine comprehensive tests (252 tests)
- `tests/data-native-engine-additional.test.mjs` - Additional coverage for gestures, telemetry, edge cases
- `tests/layout-engine.test.mjs` - LayoutEngine tests with topology detection
- `tests/index.test.mjs` - Module export validation
- `tests/setup.mjs` - Jest setup for ES modules
- `babel.config.js` - Babel configuration for Jest

### Modified Files
- `src/core/DataNativeEngine.js` - Added null/undefined guards in `fromJSON()` method
- `src/core/LayoutEngine.js` - Added null/undefined guards in `setLayout()` method
- `src/core/ResearchTelemetry.js` - Added `logInteraction()` alias method
- `src/core/TopologyDetector.js` - Minor fixes for edge cases
- `package.json` - Added test scripts and Jest dependencies

## Coverage Improvements

| Module | Before | After | Δ |
|--------|--------|-------|---|
| TopologyDetector | 0% | **88.77%** | +88.77% |
| PropertyMapper | 0% | **87.71%** | +87.71% |
| LayoutEngine | 0% | **79.60%** | +79.60% |
| NemosyneDataPacket | 0% | **75.12%** | +75.12% |
| DataNativeEngine | 0% | **66.76%** | +66.76% |
| ResearchTelemetry | 0% | **68.75%** | +68.75% |
| **Overall** | 0% | **~76%** | +76% |

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
NODE_OPTIONS='--experimental-vm-modules' npx jest --config jest.config.mjs tests/data-native-engine.test.mjs
```

## Notes

- 11 tests skipped (gesture/telemetry tests require DOM simulation)
- All 252 passing tests validate core functionality
- Coverage thresholds set at 95% (not yet met - remaining ~19% gap)

## Checklist

- [x] Tests cover all major public APIs
- [x] Edge cases handled (null, undefined, malformed data)
- [x] ES module syntax preserved
- [x] No breaking changes to existing code
- [x] All existing tests continue to pass
