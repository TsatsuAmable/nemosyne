import { mkdir, writeFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

function sourceMetadata() {
  return {
    sourceHeadSha: process.env.NEMOSYNE_SOURCE_HEAD_SHA ?? null,
    checkoutHeadSha: process.env.NEMOSYNE_CHECKOUT_HEAD_SHA ?? null,
    workflowEventSha: process.env.NEMOSYNE_WORKFLOW_EVENT_SHA ?? process.env.GITHUB_SHA ?? null,
    productionBundleSha256: process.env.NEMOSYNE_A5_BUNDLE_SHA256 ?? null,
    wasmSha256: process.env.NEMOSYNE_A5_WASM_SHA256 ?? null,
  };
}

test('A5 proves Aggregate starts as bounded dataset structure without opening row detail', async ({ page }) => {
  test.setTimeout(180_000);
  test.skip(
    process.env.NEMOSYNE_A5_PRODUCT_EVIDENCE !== '1',
    'A5 aggregate evidence runs only in the exact-head product-evidence workflow.',
  );

  await mkdir('stream-a-a5-results', { recursive: true });
  await page.goto('/');
  await expect
    .poll(
      async () => page.evaluate(() => window.__NEMOSYNE_A5_PRODUCT_EVIDENCE__?.schemaVersion ?? null),
      { timeout: 15_000, message: 'A5 product evidence hook is installed' },
    )
    .toBe(1);

  const scenario = await page.evaluate(async () => {
    const hook = window.__NEMOSYNE_A5_PRODUCT_EVIDENCE__;
    if (!hook) throw new Error('A5 product evidence hook is unavailable.');
    return hook.runAggregateScenario({ rowCount: 8_000, groupCount: 16 });
  });

  expect(scenario.schemaVersion).toBe(1);
  expect(scenario.sourceRowCount).toBe(8_000);
  expect(scenario.groupCount).toBe(16);
  expect(scenario.candidateId).toBe('AGGREGATE_VOLUME');
  expect(scenario.representationFamily).toBe('AGGREGATE');
  expect(scenario.datasetFingerprint).toMatch(/^[0-9a-f]{64}$/);
  expect(scenario.decisionId.length).toBeGreaterThan(0);
  expect(scenario.envelope.datasetFingerprint).toBe(scenario.datasetFingerprint);
  expect(scenario.envelope.provenance.decisionId).toBe(scenario.decisionId);
  expect(scenario.envelope.result.status).toBe('READY');
  if (scenario.envelope.result.status !== 'READY') throw new Error('unreachable refusal');
  expect(scenario.envelope.result.payload.kind).toBe('AGGREGATE_VOLUME');
  if (scenario.envelope.result.payload.kind !== 'AGGREGATE_VOLUME') {
    throw new Error('A5 aggregate received the wrong READY payload kind.');
  }

  expect(scenario.envelope.resource.sourceRowCount).toBe(8_000);
  expect(scenario.envelope.resource.elementCount).toBe(16);
  expect(scenario.envelope.resource.elementCount).toBeLessThanOrEqual(
    scenario.envelope.resource.maxElementCount,
  );
  expect(scenario.artifact.nodeMeshCount).toBe(16);
  expect(new Set(scenario.artifact.semanticIds).size).toBe(16);
  expect(scenario.artifact.semanticIds.every((id) => id.startsWith('aggregate-group:'))).toBe(true);
  expect(scenario.artifact.representationKinds).toEqual(Array(16).fill('AGGREGATE_VOLUME'));

  // The structure is unopened: there must be no semantic-detail row query yet,
  // regardless of the source row count used to create the aggregate authority.
  expect(scenario.semanticDetailExecutionsBeforeOpen).toBe(0);
  expect(scenario.scene.renderCallsLastFrame).toBeGreaterThan(0);
  await expect(page.locator('#dataset-indicator')).toContainText('p1r-a5-aggregate-8000-16');

  await page.screenshot({
    path: 'stream-a-a5-results/a5-aggregate-overview.png',
    fullPage: true,
  });
  await writeFile(
    'stream-a-a5-results/a5-aggregate.json',
    `${JSON.stringify({ schemaVersion: 1, source: sourceMetadata(), scenario }, null, 2)}\n`,
    'utf8',
  );
});
