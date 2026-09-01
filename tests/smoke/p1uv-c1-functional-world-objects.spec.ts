import { mkdir, writeFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import type { C1ProductEvidenceSnapshot } from '../../src/app/c1ProductEvidenceDiagnostics.ts';

function sourceMetadata() {
  return {
    sourceHeadSha: process.env.NEMOSYNE_SOURCE_HEAD_SHA ?? null,
    checkoutHeadSha: process.env.NEMOSYNE_CHECKOUT_HEAD_SHA ?? null,
    workflowEventSha: process.env.NEMOSYNE_WORKFLOW_EVENT_SHA ?? process.env.GITHUB_SHA ?? null,
    productionBundleSha256: process.env.NEMOSYNE_C1_BUNDLE_SHA256 ?? null,
    wasmSha256: process.env.NEMOSYNE_C1_WASM_SHA256 ?? null,
  };
}

function expectBounded(snapshot: C1ProductEvidenceSnapshot): void {
  expect(snapshot.memoryPalace.objectCount).toBeLessThanOrEqual(48);
  expect(snapshot.memoryPalace.relationshipCount).toBeLessThanOrEqual(24);
}

test('P1-UV C1 proves persistent world objects carry product semantics', async ({ page }) => {
  test.setTimeout(180_000);
  test.skip(
    process.env.NEMOSYNE_C1_BROWSER_PROBE !== '1',
    'C1 product evidence runs only in its isolated exact-head workflow.',
  );

  await mkdir('p1uv-c1-results', { recursive: true });
  await page.goto('/');
  await expect
    .poll(
      async () => page.evaluate(() => window.__NEMOSYNE_C1_EVIDENCE__?.schemaVersion ?? null),
      { timeout: 15_000, message: 'C1 product evidence hook is installed' },
    )
    .toBe(1);

  const initial = await page.evaluate(() => {
    const hook = window.__NEMOSYNE_C1_EVIDENCE__;
    if (!hook) throw new Error('C1 product evidence hook unavailable.');
    return hook.snapshot();
  });
  expect(['DECISIVE', 'AMBIGUOUS', 'UNDERDETERMINED', 'INFEASIBLE']).toContain(
    initial.technoCore.state,
  );
  expect(initial.technoCore.preview).toBe(false);
  expect(initial.vault.archiveCount).toBe(0);
  expect(initial.vault.state).toBe('empty');
  expect(initial.portals.overview).toBe('available');
  expect(initial.portals.saved).toBe('unavailable');
  expectBounded(initial);

  const beforeLens = initial.lensEnabled;
  const beforeResults = initial.analysisResultCount;
  const afterTechnoCore = await page.evaluate(() => {
    const hook = window.__NEMOSYNE_C1_EVIDENCE__;
    if (!hook) throw new Error('C1 product evidence hook unavailable.');
    hook.focus('technocore');
    return hook.selectTechnoCore();
  });
  expect(afterTechnoCore.recommendationPanelVisible).toBe(true);
  expect(afterTechnoCore.lensEnabled).toBe(beforeLens);
  expect(afterTechnoCore.analysisResultCount).toBe(beforeResults);
  expect(afterTechnoCore.technoCore.state).toBe(initial.technoCore.state);
  await page.waitForTimeout(150);
  await page.screenshot({ path: 'p1uv-c1-results/c1-technocore-guidance.png', fullPage: true });

  const marked = await page.evaluate(() => {
    const hook = window.__NEMOSYNE_C1_EVIDENCE__;
    if (!hook) throw new Error('C1 product evidence hook unavailable.');
    const result = hook.markObservation('C1 browser-evidence observation');
    hook.focus('memory-palace');
    return result;
  });
  expect(marked.observationId.length).toBeGreaterThan(0);
  expect(marked.snapshot.memoryPalace.visible).toBe(true);
  expect(marked.snapshot.memoryPalace.objectIds).toContain(marked.observationId);
  expectBounded(marked.snapshot);
  await page.waitForTimeout(150);
  await page.screenshot({ path: 'p1uv-c1-results/c1-memory-palace.png', fullPage: true });

  const afterFreeze = await page.evaluate(async () => {
    const hook = window.__NEMOSYNE_C1_EVIDENCE__;
    if (!hook) throw new Error('C1 product evidence hook unavailable.');
    const result = await hook.freezeInvestigation();
    hook.focus('vault');
    return result;
  });
  expect(afterFreeze.vault.archiveCount).toBeGreaterThan(0);
  expect(afterFreeze.vault.state).toBe('frozen');
  expect(afterFreeze.portals.saved).toBe('available');
  expectBounded(afterFreeze);
  await page.waitForTimeout(150);
  await page.screenshot({ path: 'p1uv-c1-results/c1-vault-ready.png', fullPage: true });

  const report = {
    schemaVersion: 1,
    classification: 'p1uv-c1-production-browser-evidence',
    source: sourceMetadata(),
    claims: {
      physicalQuestEvidence: false,
      analyticalAuthorityChanged: false,
      inferredEpistemicRelationships: false,
      screenshotsRetained: true,
    },
    initial,
    afterTechnoCore,
    marked,
    afterFreeze,
  };

  expect(report.source.sourceHeadSha).toMatch(/^[0-9a-f]{40}$/);
  expect(report.source.checkoutHeadSha).toBe(report.source.sourceHeadSha);
  expect(report.source.workflowEventSha).toMatch(/^[0-9a-f]{40}$/);
  expect(report.source.productionBundleSha256).toMatch(/^[0-9a-f]{64}$/);
  expect(report.source.wasmSha256).toMatch(/^[0-9a-f]{64}$/);

  await writeFile(
    'p1uv-c1-results/c1-functional-world-objects.json',
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
});