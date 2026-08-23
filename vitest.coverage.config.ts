import { defineConfig } from 'vitest/config';

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
      thresholds: { lines: 75, statements: 75, functions: 70, branches: 60 },
    },
  },
});
