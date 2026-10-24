// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';
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

afterEach(() => { document.body.replaceChildren(); });

describe('FM2 direct critique controls use the product NIL command path', () => {
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

    // Dataset turnover revokes the old direct compilation's action rights,
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
});
