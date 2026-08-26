import { defineConfig } from 'vitest/config';

// Coverage shards collect partial coverage but cannot meaningfully enforce a
// repository-global threshold. Only the merged aggregate runs without this
// flag, so the canonical thresholds below remain the authoritative merge gate.
const reportOnlyShard = process.env.NEMOSYNE_COVERAGE_REPORT_ONLY === '1';

export default defineConfig({
  test: {
    projects: [
      { extends: './vitest.fast.config.ts', test: { sequence: { groupOrder: 0 } } },
      { extends: './vitest.ui.config.ts', test: { sequence: { groupOrder: 1 } } },
      { extends: './vitest.config.ts', test: { sequence: { groupOrder: 2 } } },
      { extends: './vitest.wasm.config.ts', test: { sequence: { groupOrder: 3 } } },
    ],
    coverage: {
      provider: 'v8',
      ...(reportOnlyShard
        ? {}
        : {
            thresholds: { lines: 75, statements: 75, functions: 70, branches: 60 },
          }),
    },
  },
});
