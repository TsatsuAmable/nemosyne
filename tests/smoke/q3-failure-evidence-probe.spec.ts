import { test, expect } from './q3FailureEvidence.ts';

const SECRET_CANARY = 'q3-secret-canary-20260828';
const QUERY_CANARY = 'q3-query-canary-20260828';

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

  const runtimeSnapshot = await page.evaluate(() => window.__NEMOSYNE_DIAGNOSTICS__?.() ?? null);
  expect(runtimeSnapshot, 'instrumented runtime diagnostic hook is installed').not.toBeNull();

  // Canary values prove the evidence collector redacts secret-like console text
  // and strips URL query strings before the bundle is uploaded.
  await page.evaluate(
    ({ secret, query }) => {
      console.error(`Q3 probe secret=${secret}`);
      void fetch(`/__q3-evidence-probe?token=${query}`);
    },
    { secret: SECRET_CANARY, query: QUERY_CANARY }
  );
  await page.waitForTimeout(250);

  // Intentional falsifier. The pilot workflow is successful only when this test
  // fails and the verifier finds the expected trace/screenshot/video/JSON bundle.
  expect('q3-probe-actual').toBe('q3-probe-expected');
});
