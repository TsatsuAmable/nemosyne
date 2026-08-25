import { defineConfig, devices } from '@playwright/test';

/**
 * Real-browser collaboration resilience gate.
 *
 * Unlike the production-bundle smoke, this config runs a Vite dev server so a
 * test-only HTML harness can import the real TypeScript networking modules. The
 * harness is never part of the production bundle. Two isolated Chromium
 * contexts then exercise the actual WebSocket signalling plugin and WebRTC data
 * channels under deliberate transport faults.
 */
export default defineConfig({
  testDir: './tests/smoke',
  testMatch: 'collaboration-recovery.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',

  use: {
    headless: true,
    baseURL: 'http://127.0.0.1:4174',
    trace: 'on-first-retry',
  },

  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 4174 --strictPort',
    port: 4174,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      NEMOSYNE_FORCE_HTTP: '1',
    },
  },

  projects: [
    {
      name: 'chromium-collaboration',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
