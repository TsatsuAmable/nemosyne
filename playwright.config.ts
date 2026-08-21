import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright load-smoke configuration.
 *
 * Local runs build the production bundle before verifying that it boots and
 * renders a frame in real headless Chromium (WebGL2 via SwiftShader). CI sets
 * NEMOSYNE_SMOKE_PREBUILT=1 and downloads the exact dist/ artifact produced by
 * the Node job, so the smoke gate validates the already-tested build instead of
 * compiling WASM and the Vite bundle a second time.
 */
const previewCommand = process.env.NEMOSYNE_SMOKE_PREBUILT === '1'
  ? 'npx vite preview --port 4173 --strictPort'
  : 'npm run build && npx vite preview --port 4173 --strictPort';

export default defineConfig({
  testDir: './tests/smoke',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',

  use: {
    headless: true,
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },

  webServer: {
    command: previewCommand,
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      NEMOSYNE_FORCE_HTTP: '1',
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});