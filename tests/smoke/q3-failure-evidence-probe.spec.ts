import { test, expect } from './q3FailureEvidence.ts';

const SECRET_CANARY = 'q3-secret-canary-20260828';
const QUERY_CANARY = 'q3-query-canary-20260828';
const MISSING_ASSET_PATH = '/assets/__q3-missing-evidence-probe__.js';

test('Q3 deliberate failure emits a reproducible sanitized diagnostic bundle', async ({ page }) => {
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

  // Canary values prove the evidence collector actually observes and redacts a
  // secret-like console value and strips URL query strings before upload.
  const missingAssetStatus = await page.evaluate(
    async ({ secret, query, missingAssetPath }) => {
      console.error(`Q3 probe secret=${secret}`);
      const response = await fetch(`${missingAssetPath}?token=${query}`, { cache: 'no-store' });
      return response.status;
    },
    { secret: SECRET_CANARY, query: QUERY_CANARY, missingAssetPath: MISSING_ASSET_PATH }
  );
  expect(missingAssetStatus, 'missing static asset produces deterministic HTTP error evidence').toBeGreaterThanOrEqual(400);

  // Intentional falsifier. The pilot workflow is successful only when this test
  // fails here and the verifier finds the expected trace/screenshot/video/JSON bundle.
  expect('q3-probe-actual').toBe('q3-probe-expected');
});
