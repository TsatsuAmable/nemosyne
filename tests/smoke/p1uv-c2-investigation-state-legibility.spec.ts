import { mkdir, writeFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import type { C2ProductEvidenceSnapshot } from '../../src/app/c2ProductEvidenceDiagnostics.ts';
import { PANEL_LAYOUT, UI_TREATMENT_VERSION } from '../../src/vr/ui/panelLayout.ts';

function sourceMetadata() {
  return {
    sourceHeadSha: process.env.NEMOSYNE_SOURCE_HEAD_SHA ?? null,
    checkoutHeadSha: process.env.NEMOSYNE_CHECKOUT_HEAD_SHA ?? null,
    workflowEventSha: process.env.NEMOSYNE_WORKFLOW_EVENT_SHA ?? process.env.GITHUB_SHA ?? null,
    productionBundleSha256: process.env.NEMOSYNE_C2_BUNDLE_SHA256 ?? null,
    wasmSha256: process.env.NEMOSYNE_C2_WASM_SHA256 ?? null,
  };
}

function expectGrounded(snapshot: C2ProductEvidenceSnapshot): void {
  expect(snapshot.lines).toHaveLength(4);
  expect(snapshot.statusPanelParent).toBe('analystAnchor');
  expect(snapshot.statusPanelVisible).toBe(true);
  expect(snapshot.uiTreatmentVersion).toBe(UI_TREATMENT_VERSION);
  snapshot.statusPanelLocalPosition.forEach((value, index) => {
    expect(value).toBeCloseTo(PANEL_LAYOUT.statusStrip[index], 6);
  });
  expect(['IDLE', 'PENDING', 'REFUSED', 'INVALID', 'UNAVAILABLE', 'READY']).toContain(
    snapshot.status.analyticalStatus,
  );
  expect(['PENDING', 'DECISIVE', 'AMBIGUOUS', 'UNDERDETERMINED', 'INFEASIBLE']).toContain(
    snapshot.status.decisionState,
  );
}

test('P1-UV C2 proves investigation state is legible on the normal product surface', async ({ page }) => {
  test.setTimeout(180_000);
  test.skip(
    process.env.NEMOSYNE_C2_BROWSER_PROBE !== '1',
    'C2 product evidence runs only in its isolated exact-head workflow.',
  );

  await mkdir('p1uv-c2-results', { recursive: true });
  await page.goto('/');
  await expect
    .poll(
      async () => page.evaluate(() => window.__NEMOSYNE_C2_EVIDENCE__?.schemaVersion ?? null),
      { timeout: 15_000, message: 'C2 product evidence hook is installed' },
    )
    .toBe(1);

  const initial = await page.evaluate(() => {
    const hook = window.__NEMOSYNE_C2_EVIDENCE__;
    if (!hook) throw new Error('C2 product evidence hook unavailable.');
    return hook.snapshot();
  });
  expectGrounded(initial);
  expect(initial.status.representationState).toBe('COMMITTED');
  expect(initial.status.origin.activeNodeId).not.toBeNull();
  await page.waitForTimeout(150);
  await page.screenshot({ path: 'p1uv-c2-results/c2-grounded-baseline.png', fullPage: true });

  const focused = await page.evaluate(() => {
    const hook = window.__NEMOSYNE_C2_EVIDENCE__;
    if (!hook) throw new Error('C2 product evidence hook unavailable.');
    return hook.focusFirstStructure();
  });
  expectGrounded(focused);
  expect(focused.status.focusLevel).toBe('structure');
  expect(focused.status.focusTarget).toBe(focused.structureId);

  const preview = await page.evaluate(() => {
    const hook = window.__NEMOSYNE_C2_EVIDENCE__;
    if (!hook) throw new Error('C2 product evidence hook unavailable.');
    return hook.previewOperation('sort');
  });
  expect(preview.status.representationState).toBe('PREVIEW');
  expect(preview.status.lastAction).toContain('Preview sort');
  expect(preview.status.nextAffordance).toBe('Commit or cancel preview');
  await page.waitForTimeout(150);
  await page.screenshot({ path: 'p1uv-c2-results/c2-preview-state.png', fullPage: true });

  const cleared = await page.evaluate(() => {
    const hook = window.__NEMOSYNE_C2_EVIDENCE__;
    if (!hook) throw new Error('C2 product evidence hook unavailable.');
    return hook.clearPreview();
  });
  expect(cleared.status.representationState).toBe('COMMITTED');

  const marked = await page.evaluate(() => {
    const hook = window.__NEMOSYNE_C2_EVIDENCE__;
    if (!hook) throw new Error('C2 product evidence hook unavailable.');
    return hook.markObservation('C2 production-browser evidence observation');
  });
  expect(marked.observationId.length).toBeGreaterThan(0);
  expect(marked.status.evidence.observations).toBeGreaterThan(initial.status.evidence.observations);

  const applied = await page.evaluate(async () => {
    const hook = window.__NEMOSYNE_C2_EVIDENCE__;
    if (!hook) throw new Error('C2 product evidence hook unavailable.');
    return hook.applyOperation('sort');
  });
  expect(applied.status.representationState).toBe('COMMITTED');
  expect(applied.status.recovery.canUndo).toBe(true);
  expect(applied.status.origin.activeNodeId).not.toBe(initial.status.origin.activeNodeId);

  const undone = await page.evaluate(() => {
    const hook = window.__NEMOSYNE_C2_EVIDENCE__;
    if (!hook) throw new Error('C2 product evidence hook unavailable.');
    return hook.undo();
  });
  expect(undone.status.recovery.canRedo).toBe(true);
  expect(undone.status.origin.activeNodeId).toBe(initial.status.origin.activeNodeId);

  const frozen = await page.evaluate(async () => {
    const hook = window.__NEMOSYNE_C2_EVIDENCE__;
    if (!hook) throw new Error('C2 product evidence hook unavailable.');
    return hook.freezeInvestigation();
  });
  expect(frozen.status.recovery.archiveCount).toBeGreaterThan(initial.status.recovery.archiveCount);
  await page.waitForTimeout(150);
  await page.screenshot({ path: 'p1uv-c2-results/c2-recovery-state.png', fullPage: true });

  const report = {
    schemaVersion: 1,
    classification: 'p1uv-c2-production-browser-evidence',
    source: sourceMetadata(),
    claims: {
      physicalQuestEvidence: false,
      analyticalAuthorityChanged: false,
      inferredEpistemicRelationships: false,
      newPersistentPanelAdded: false,
      statusSurfaceAnalystAnchored: true,
      statusSurfaceUsesGovernedLayout: true,
      uiTreatmentVersionPinned: true,
      historyRecoveryOriginReconciled: true,
      screenshotsRetained: true,
    },
    initial,
    focused,
    preview,
    cleared,
    marked,
    applied,
    undone,
    frozen,
  };

  expect(report.source.sourceHeadSha).toMatch(/^[0-9a-f]{40}$/);
  expect(report.source.checkoutHeadSha).toBe(report.source.sourceHeadSha);
  expect(report.source.workflowEventSha).toMatch(/^[0-9a-f]{40}$/);
  expect(report.source.productionBundleSha256).toMatch(/^[0-9a-f]{64}$/);
  expect(report.source.wasmSha256).toMatch(/^[0-9a-f]{64}$/);

  await writeFile(
    'p1uv-c2-results/c2-investigation-state-legibility.json',
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
});
