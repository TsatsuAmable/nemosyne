import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright load-smoke configuration.
 *
 * One job: build the production bundle and verify it boots + renders a frame in
 * real headless Chromium (WebGL2 via SwiftShader). This is an informational /
 * non-required CI job — it does NOT block the owner auto-merge flow and is not
 * in the GitHub branch ruleset. See tests/smoke/README.md.
 *
 * The webServer builds dist/ then serves it with `vite preview` over plain HTTP
 * (NEMOSYNE_FORCE_HTTP=1 bypasses local dev certs so the server is HTTP in every
 * environment — headless Chromium needs no TLS, and CI has no certs).
 */
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
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
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