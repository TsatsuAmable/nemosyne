import { test, expect } from './q3FailureEvidence.ts';

const SECRET_CANARY = 'q3-secret-canary-20260828';
const QUERY_CANARY = 'q3-query-canary-20260828';
const NETWORK_CANARY_PATH = '/__q3-evidence-probe';

test('Q3 deliberate failure emits a reproducible failure evidence bundle', async ({ page }) => {
  test.skip(
    process.env.NEMOSYNE_Q3_FAILURE_PROBE !== '1',
    'Q3 deliberate failure probe only runs in the isolated evidence pilot.'
  );

  await page.goto('/');

  const telemetry = page.locator('#telemetry');
  await expect
    .poll(async () => (await telemetry.textContent()) ?? '', {
      timeout: 15_000,
      message: 'instrumented production build reached its first rendered frame',
    })
    .toContain('LAYOUT:');

  await expect
    .poll(
      async () => page.evaluate(() => window.__NEMOSYNE_DIAGNOSTICS__?.().schemaVersion ?? null),
      {
        timeout: 5_000,
        message: 'instrumented runtime diagnostic hook is installed',
      }
    )
    .toBe(1);

  // Abort one explicitly synthetic request so the collector exercises its
  // request-failure path independently of Vite preview's SPA fallback behavior.
  await page.route(`**${NETWORK_CANARY_PATH}**`, async (route) => route.abort('failed'));

  await page.evaluate(
    async ({ secret, query, networkCanaryPath }) => {
      console.error(`Q3 probe secret=${secret}`);
      try {
        await fetch(`${networkCanaryPath}?token=${query}`, { cache: 'no-store' });
      } catch {
        // Expected: Playwright aborts this synthetic request to create a stable
        // requestfailed event for the diagnostic collector.
      }
    },
    { secret: SECRET_CANARY, query: QUERY_CANARY, networkCanaryPath: NETWORK_CANARY_PATH }
  );

  // Intentional falsifier. The pilot workflow is successful only when this test
  // fails here and the verifier finds the expected trace/screenshot/video/JSON bundle.
  expect('q3-probe-actual').toBe('q3-probe-expected');
});
