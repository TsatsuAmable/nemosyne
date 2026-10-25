// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';
import * as rustBridge from '../src/wasm/RuntimeBridge.ts';
import { InlineAnalyticalPort } from '../src/atlas/ports/InlineAnalyticalPort.ts';
import { NilExecutor, bindAtlasNilHandlers } from '../src/interaction/nil/index.ts';
import { mountDesktopDirectLoopControls } from '../src/app/investigation/DesktopDirectLoopControls.ts';
import { computeSnapshotId, type SemanticSnapshotV1 } from '../src/moneta/representation/SemanticSnapshotV1.ts';

function mountRail(): void {
  document.body.innerHTML =
    '<section id="investigation-shell"><aside><details id="desktop-review-recovery-rail"><p id="review-direct-variants"></p></details></aside></section>';
}

function snapshot(fingerprint: string): SemanticSnapshotV1 {
  const body: SemanticSnapshotV1['body'] = {
    analyticalDatasetFingerprint: fingerprint,
    kernelVersion: 'unit-mock-not-scientific-evidence',
    semanticVocabulary: { id: 'vocab-test', version: '1', digest: 'test-vocab' },
    normalizer: { id: 'normalizer-test', version: '1', digest: 'test-normalizer' },
    coverage: [{ family: 'DISTRIBUTION', analyticalRequestDigest: 'req-1', status: 'AVAILABLE' }],
    sources: [{
      sourceId: 'src-distribution',
      family: 'DISTRIBUTION',
      analyticalRequestIdentity: 'request-1',
      method: 'test-kernel-only',
      methodVersion: '1',
      parametersDigest: 'test-params',
      state: { status: 'AVAILABLE', approximation: { mode: 'EXACT_AGGREGATE', representedRowCount: 32 } },
      evidenceReferences: [{
        datasetFingerprint: fingerprint, kernelVersion: 'unit-mock-not-scientific-evidence',
        bundleContentDigest: 'test-bundle', receiptId: 'test-receipt',
        receiptContentDigest: 'test-content', consumerId: 'test-consumer',
        requirementProfileId: 'test-profile', requirementProfileDigest: 'test-profile-digest',
        admissionPolicyId: 'test-policy', admissionPolicyDigest: 'test-policy-digest',
      }],
      limitations: [],
    }],
    nodes: Array.from({ length: 8 }, (_, index) => ({
      nodeId: `node-${index}`,
      sourceId: 'src-distribution',
      producerSemanticId: `bin-${index}`,
      propertyPath: `bin.${index}.density`,
      descriptor: { label: `Density ${index}`, valueType: 'number' as const, unit: 'probability_density' },
      value: index / 8,
      state: { status: 'AVAILABLE' as const },
    })),
    relations: [], limitations: [],
  };
  return { schemaVersion: 1, snapshotId: computeSnapshotId(body), body };
}

function liveAtlas(): AtlasCore {
  const atlas = new AtlasCore({ kernel: makeKernelMockBridge() as never });
  const rows = Array.from({ length: 32 }, (_, index) => ({ val: index, group: index % 2 ? 'A' : 'B' }));
  atlas.loadDataset(new Dataset('direct-browser-test', [
    { name: 'val', type: ColumnType.NUMERIC },
    { name: 'group', type: ColumnType.CATEGORICAL },
  ], rows));
  atlas.compileDirectEmbodiment({ snapshot: snapshot(atlas.dataset.fingerprint) });
  return atlas;
}

function commitDirectContext(atlas: AtlasCore): void {
  atlas.commitInvestigationContext('fm2-runtime-turnover', {
    schemaVersion: 2,
    nodeId: 'fm2-runtime-turnover',
    epistemicPurpose: 'CLAIM_BEARING',
    intent: {
      schemaVersion: 1,
      researchQuestion: 'Inspect a direct empirical distribution',
      currentTask: 'fm2-runtime-turnover',
    },
  });
}

afterEach(() => { document.body.replaceChildren(); });

describe('FM2 direct critique controls use the product NIL command path', () => {
  it('exposes a compile action and reports disclosure state only after the authority callback returns', async () => {
    mountRail();
    const atlas = new AtlasCore({ kernel: makeKernelMockBridge() as never });
    atlas.loadDataset(new Dataset('direct-compile-control', [
      { name: 'val', type: ColumnType.NUMERIC },
    ], [{ val: 1 }, { val: 2 }, { val: 3 }]));
    // The fixture is presentation evidence only: the callback stands in for
    // the already-authoritative production Atlas method, while the browser
    // journey below proves the real Rust binding path separately.
    const compileDirectDistribution = vi.fn(async () => {
      const result = atlas.compileDirectEmbodiment({ snapshot: snapshot(atlas.dataset!.fingerprint) });
      return result;
    });
    const executor = new NilExecutor();
    const controls = mountDesktopDirectLoopControls(
      atlas,
      executor,
      undefined,
      undefined,
      undefined,
      compileDirectDistribution,
    );

    expect(document.getElementById('review-direct-compile')).not.toBeNull();
    expect(document.getElementById('review-direct-critique')?.hasAttribute('disabled')).toBe(true);
    expect(document.getElementById('review-direct-prefer')?.hasAttribute('disabled')).toBe(true);

    document.getElementById('review-direct-compile')?.click();
    await vi.waitFor(() => {
      expect(compileDirectDistribution).toHaveBeenCalledTimes(1);
      expect(document.getElementById('review-direct-action-state')?.textContent)
        .toContain('Governed direct compilation ready');
    });
    expect(document.getElementById('review-direct-disclosures')?.textContent)
      .toContain('0 conjectural elements');
    expect(document.getElementById('review-direct-critique')?.hasAttribute('disabled')).toBe(false);

    controls.dispose();
  });

  it('shows a governed evidence refusal without enabling a representation branch', async () => {
    mountRail();
    const atlas = new AtlasCore({ kernel: makeKernelMockBridge() as never });
    atlas.loadDataset(new Dataset('evidence-probe', [
      { name: 'val', type: ColumnType.NUMERIC },
    ], [{ val: 1 }, { val: 2 }]));
    const executor = new NilExecutor();
    const probe = vi.fn(async () => ({
      status: 'REFUSED' as const, code: 'DIRECT_CONSUMER_UNATTESTED' as const,
    }));
    const controls = mountDesktopDirectLoopControls(atlas, executor, undefined, undefined, probe);
    document.getElementById('review-direct-check-evidence')?.click();
    await vi.waitFor(() => {
      expect(probe).toHaveBeenCalledTimes(1);
      expect(document.getElementById('review-direct-evidence-status')?.textContent)
        .toContain('authorize descriptive statistics, not this semantic representation');
    });
    expect(atlas.getActiveDirectCompileResult()).toBeUndefined();
    expect(document.getElementById('review-direct-prefer')?.hasAttribute('disabled')).toBe(true);
    controls.dispose();
  });
  it('refuses to create a direct-loop decision from ordinary analysis or an absent compilation', () => {
    mountRail();
    const atlas = new AtlasCore({ kernel: makeKernelMockBridge() as never });
    const executor = new NilExecutor();
    const disposeNil = bindAtlasNilHandlers(executor, atlas);
    const controls = mountDesktopDirectLoopControls(atlas, executor);
    expect(document.getElementById('review-direct-action-state')?.textContent)
      .toContain('no governed direct compilation');
    expect(document.getElementById('review-direct-critique')?.hasAttribute('disabled')).toBe(true);
    expect(document.getElementById('review-direct-prefer')?.hasAttribute('disabled')).toBe(true);
    document.getElementById('review-direct-critique')?.click();
    expect(atlas.getActiveDirectCompileResult()).toBeUndefined();
    expect(atlas.getDirectFeedbackLinks()).toHaveLength(0);
    controls.dispose();
    disposeNil();
    expect(document.getElementById('review-direct-actions')).toBeNull();
  });

  it('records an attributable critique through NIL REJECT, then links a distinct alternative through NIL PREFER', async () => {
    mountRail();
    const atlas = liveAtlas();
    const initial = atlas.getActiveDirectCompileResult();
    expect(initial?.plan.elements.length).toBeGreaterThan(0);
    const executor = new NilExecutor();
    const disposeNil = bindAtlasNilHandlers(executor, atlas);
    const onChanged = vi.fn();
    const controls = mountDesktopDirectLoopControls(atlas, executor, undefined, onChanged);
    expect(document.getElementById('review-direct-critique')?.hasAttribute('disabled')).toBe(false);
    expect(document.getElementById('review-direct-prefer')?.hasAttribute('disabled')).toBe(true);

    const note = document.getElementById('review-direct-note') as HTMLTextAreaElement;
    note.value = 'The aggregate needs more constrained detail for inspection.';
    document.getElementById('review-direct-critique')?.click();
    await vi.waitFor(() => {
      expect(atlas.getActiveDirectCompileResult()?.critiqueLedger).toHaveLength(1);
      expect(onChanged).toHaveBeenCalledTimes(1);
    });
    const recorded = atlas.getActiveDirectCompileResult()?.critiqueLedger[0];
    expect(recorded?.note).toBe('The aggregate needs more constrained detail for inspection.');
    expect(recorded?.investigatorId).toBe('researcher');
    expect(recorded?.targetElementId).toBe(initial!.plan.elements[0]!.id);
    expect(executor.expectedSequence(atlas.aggregate.sessionId)).toBe(1);
    expect(document.getElementById('review-direct-prefer')?.hasAttribute('disabled')).toBe(false);

    const activeBeforePrefer = atlas.getActiveDirectCompileResult()!.compilationId;
    document.getElementById('review-direct-prefer')?.click();
    await vi.waitFor(() => {
      expect(atlas.getDirectFeedbackLinks()).toHaveLength(1);
      expect(onChanged).toHaveBeenCalledTimes(2);
    });
    const link = atlas.getDirectFeedbackLinks()[0]!;
    expect(link.critiqueId).toBe(recorded!.critiqueId);
    expect(link.priorCompilationId).toBe(activeBeforePrefer);
    expect(link.alternativeCompilationId).not.toBe(activeBeforePrefer);
    expect(atlas.getActiveDirectCompileResult()?.compilationId).toBe(activeBeforePrefer);
    expect(executor.expectedSequence(atlas.aggregate.sessionId)).toBe(2);
    expect(document.getElementById('review-direct-action-state')?.textContent)
      .toContain('Device performance unverified');

    // A committed intent revision revokes a prior direct compilation before
    // the UI can dispatch any more NIL mutation against stale framing.
    const context = atlas.getActiveInvestigationContext()!;
    atlas.commitInvestigationContext(context.nodeId, {
      ...context, intent: { ...context.intent, researchQuestion: 'Revised question for the same dataset' },
    });
    controls.refresh();
    expect(document.getElementById('review-direct-critique')?.hasAttribute('disabled')).toBe(true);
    expect(document.getElementById('review-direct-prefer')?.hasAttribute('disabled')).toBe(true);

    // Dataset turnover also revokes the old direct compilation's action rights,
    // even if an Atlas implementation retains a prior result temporarily.
    atlas.loadDataset(new Dataset('replacement', [
      { name: 'val', type: ColumnType.NUMERIC },
    ], [{ val: 20 }, { val: 30 }]));
    controls.refresh();
    expect(document.getElementById('review-direct-critique')?.hasAttribute('disabled')).toBe(true);
    expect(document.getElementById('review-direct-prefer')?.hasAttribute('disabled')).toBe(true);
    controls.dispose();
    disposeNil();
  });

  it('revokes direct controls after execution-port turnover without changing recorded feedback links', async () => {
    mountRail();
    const atlas = new AtlasCore({ kernel: rustBridge });
    const data = new Dataset('runtime-turnover', [
      { name: 'val', type: ColumnType.NUMERIC },
    ], Array.from({ length: 20 }, (_, index) => ({ val: index + 1 })));
    atlas.loadDataset(data);
    commitDirectContext(atlas);
    const executor = new NilExecutor();
    const disposeNil = bindAtlasNilHandlers(executor, atlas);
    const controls = mountDesktopDirectLoopControls(atlas, executor);

    try {
      await atlas.compileDirectDistributionEmbodiment({
        schemaVersion: 1,
        candidateId: 'DISTRIBUTION_FIELD',
        measureField: 'val',
        histogramBinCount: 8,
        ecdfKnotCount: 8,
        quantileProbabilities: [0, 0.5, 1],
      });
      controls.refresh();
      expect(document.getElementById('review-direct-critique')?.hasAttribute('disabled')).toBe(false);

      const note = document.getElementById('review-direct-note') as HTMLTextAreaElement;
      note.value = 'Record a feedback link before runtime turnover.';
      document.getElementById('review-direct-critique')?.click();
      await vi.waitFor(() => expect(atlas.getActiveDirectCompileResult()?.critiqueLedger).toHaveLength(1));
      await vi.waitFor(() =>
        expect(document.getElementById('review-direct-prefer')?.hasAttribute('disabled')).toBe(false),
      );
      (document.getElementById('review-direct-critique-id') as HTMLSelectElement).value =
        atlas.getActiveDirectCompileResult()!.critiqueLedger[0]!.critiqueId;
      document.getElementById('review-direct-prefer')?.click();
      await vi.waitFor(() => expect(atlas.getDirectFeedbackLinks()).toHaveLength(1));
      const linksBeforeTurnover = [...atlas.getDirectFeedbackLinks()];

      atlas.setExecutionPort(new InlineAnalyticalPort(rustBridge));
      controls.refresh();

      expect(atlas.getActiveDirectCompileResult()).toBeUndefined();
      expect(document.getElementById('review-direct-critique')?.hasAttribute('disabled')).toBe(true);
      expect(document.getElementById('review-direct-prefer')?.hasAttribute('disabled')).toBe(true);
      expect(atlas.getDirectFeedbackLinks()).toEqual(linksBeforeTurnover);
      expect(() => atlas.recordDirectLedgerCritique({
        investigatorId: 'researcher',
        targetElementId: 'stale-target',
        targetPhenomenon: 'DISTRIBUTION',
        critiqueKind: 'CUSTOM',
        note: 'This must not append after turnover.',
      })).toThrow('active direct snapshot is stale');
      expect(() => atlas.resolveDirectAlternativeFromCritique(linksBeforeTurnover[0]!.critiqueId))
        .toThrow('active direct snapshot is stale');
    } finally {
      controls.dispose();
      disposeNil();
      atlas.dispose();
    }
  }, 60000);

  it('refuses Atlas REJECT and PREFER mutations after committed context turnover', async () => {
    const atlas = new AtlasCore({ kernel: rustBridge });
    const data = new Dataset('context-turnover-authority', [
      { name: 'val', type: ColumnType.NUMERIC },
    ], Array.from({ length: 20 }, (_, index) => ({ val: index + 1 })));
    atlas.loadDataset(data);
    commitDirectContext(atlas);

    try {
      const initial = await atlas.compileDirectDistributionEmbodiment({
        schemaVersion: 1,
        candidateId: 'DISTRIBUTION_FIELD',
        measureField: 'val',
        histogramBinCount: 8,
        ecdfKnotCount: 8,
        quantileProbabilities: [0, 0.5, 1],
      });
      const recorded = atlas.recordDirectLedgerCritique({
        investigatorId: 'researcher',
        targetElementId: initial.plan.elements[0]!.id,
        targetPhenomenon: 'DISTRIBUTION',
        critiqueKind: 'CUSTOM',
        note: 'Record a critique before committed context turnover.',
      });
      const context = atlas.getActiveInvestigationContext()!;
      atlas.commitInvestigationContext(context.nodeId, {
        ...context,
        intent: { ...context.intent, researchQuestion: 'A different committed question' },
      });
      expect(atlas.getActiveDirectCompileResult()).toBeUndefined();

      expect(() => atlas.recordDirectLedgerCritique({
        investigatorId: 'researcher',
        targetElementId: initial.plan.elements[0]!.id,
        targetPhenomenon: 'DISTRIBUTION',
        critiqueKind: 'CUSTOM',
        note: 'This must be refused after context turnover.',
      })).toThrow();
      expect(() => atlas.resolveDirectAlternativeFromCritique(recorded.critique.critiqueId))
        .toThrow();
      expect(atlas.getDirectFeedbackLinks()).toHaveLength(0);
    } finally {
      atlas.dispose();
    }
  }, 60000);

  it('refuses Atlas REJECT and PREFER mutations after epistemic purpose turnover', async () => {
    const atlas = new AtlasCore({ kernel: rustBridge });
    const data = new Dataset('purpose-turnover-authority', [
      { name: 'val', type: ColumnType.NUMERIC },
    ], Array.from({ length: 20 }, (_, index) => ({ val: index + 1 })));
    atlas.loadDataset(data);
    commitDirectContext(atlas);

    try {
      const initial = await atlas.compileDirectDistributionEmbodiment({
        schemaVersion: 1,
        candidateId: 'DISTRIBUTION_FIELD',
        measureField: 'val',
        histogramBinCount: 8,
        ecdfKnotCount: 8,
        quantileProbabilities: [0, 0.5, 1],
      });
      const recorded = atlas.recordDirectLedgerCritique({
        investigatorId: 'researcher',
        targetElementId: initial.plan.elements[0]!.id,
        targetPhenomenon: 'DISTRIBUTION',
        critiqueKind: 'CUSTOM',
        note: 'Record a critique before epistemic purpose turnover.',
      });

      atlas.aggregate.setEpistemicPurpose('EXPLORATORY_ABDUCTION');

      expect(atlas.getActiveInvestigationContext()?.epistemicPurpose).toBe('EXPLORATORY_ABDUCTION');
      expect(atlas.getActiveDirectCompileResult()).toBeUndefined();
      expect(() => atlas.recordDirectLedgerCritique({
        investigatorId: 'researcher',
        targetElementId: initial.plan.elements[0]!.id,
        targetPhenomenon: 'DISTRIBUTION',
        critiqueKind: 'CUSTOM',
        note: 'This must be refused after purpose turnover.',
      })).toThrow('no active direct compilation');
      expect(() => atlas.resolveDirectAlternativeFromCritique(recorded.critique.critiqueId))
        .toThrow('no active direct compilation');
      expect(atlas.getDirectFeedbackLinks()).toHaveLength(0);
    } finally {
      atlas.dispose();
    }
  }, 60000);
});
