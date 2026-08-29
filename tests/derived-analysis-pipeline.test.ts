import { describe, expect, it, vi } from 'vitest';
import { ColumnType, Dataset } from '../src/data/Dataset.ts';
import type { TDAComputationResult } from '../src/vr/artifacts/TDAPlanes.ts';
import { DerivedAnalysisPipeline } from '../src/vr/coordinators/DerivedAnalysisPipeline.ts';
import type { AtlasCore } from '../src/atlas/AtlasCore.ts';
import type { WorldRendererLifecycle } from '../src/vr/coordinators/WorldRendererLifecycle.ts';

function dataset(clustered = false): Dataset {
  return new Dataset(
    'derived',
    [
      { name: 'x', type: ColumnType.NUMERIC },
      ...(clustered ? [{ name: '_cluster', type: ColumnType.NUMERIC }] : []),
    ],
    clustered
      ? [{ x: 1, _cluster: 0 }, { x: 2, _cluster: 1 }, { x: 3, _cluster: 1 }]
      : [{ x: 1 }, { x: 2 }, { x: 3 }],
    undefined,
    ['row-0', 'row-1', 'row-2']
  );
}

function tda(version: number, fingerprint: string): TDAComputationResult {
  return {
    datasetVersion: version,
    datasetFingerprint: fingerprint,
    persistence: [{ birth: 0, death: 1 }],
    mapper: {
      nodes: [{
        id: 7,
        rowIndices: [0, 2],
        level: 0,
        center: [0],
        filterCenter: 0.5,
        size: 2,
      }],
      edges: [],
    },
    betti0: [{ radius: 0.5, betti0: 2 }],
    persistenceProvenance: null,
    mapperProvenance: null,
    bettiProvenance: null,
    persistenceParams: { featureColumns: ['x'] },
    mapperParams: { featureColumns: ['x'], bins: 10, overlap: 0.5 },
    bettiParams: { featureColumns: ['x'], steps: 12 },
  };
}

function immediateDeferrer(callback: () => void): unknown {
  queueMicrotask(callback);
  return callback;
}

function makeAtlas(current: Dataset, fingerprint: string, version = 2) {
  const recorded: unknown[] = [];
  const atlas = {
    hasDataset: true,
    datasetVersion: version,
    datasetFingerprint: fingerprint,
    dataset: current,
    results: [],
    ledger: [{
      timestamp: 42,
      datasetVersion: version,
      datasetFingerprint: fingerprint,
    }],
    datasetSpace: { fingerprint, datumIds: current.rowIds },
    kernelVersion: () => 'test-kernel',
    sessionId: 'session-rf061',
    evidenceLedger: {
      recordStructure: (set: unknown) => recorded.push(set),
    },
    generateRecommendation: vi.fn(),
  };
  return { atlas: atlas as unknown as AtlasCore, recorded };
}

describe('RF-061 derived analysis pipeline', () => {
  it('records mapper/persistence structures from the exact TDA bundle without discover* recomputation', async () => {
    const fp = 'a'.repeat(64);
    const { atlas, recorded } = makeAtlas(dataset(), fp);
    const apply = vi.fn(() => true);
    const renderer = {
      tdaCompute: vi.fn(async () => tda(2, fp)),
      tdaApply: apply,
    } as unknown as Pick<WorldRendererLifecycle, 'tdaCompute' | 'tdaApply'>;
    const markDirty = vi.fn();
    const handles = vi.fn();
    const pipeline = new DerivedAnalysisPipeline({
      atlas,
      rendererLifecycle: renderer,
      publishStructureHandles: handles,
      markRecommendationDirty: markDirty,
      defer: immediateDeferrer,
    });

    expect(pipeline.schedule('sort')).toBe(true);
    await pipeline.whenIdle();

    expect(renderer.tdaCompute).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(recorded).toHaveLength(2);
    expect((recorded[0] as { structures: Array<{ evidence: { method: string } }> }).structures[0].evidence.method)
      .toBe('mapper');
    expect((recorded[1] as { structures: Array<{ evidence: { method: string } }> }).structures[0].evidence.method)
      .toBe('persistence');
    expect(atlas.generateRecommendation).toHaveBeenCalledTimes(1);
    expect(markDirty).toHaveBeenCalledTimes(1);
    expect(handles).toHaveBeenCalledTimes(1);
  });

  it('maps cluster structures from authoritative committed _cluster assignments without another cluster call', async () => {
    const fp = 'b'.repeat(64);
    const current = dataset(true);
    const { atlas, recorded } = makeAtlas(current, fp);
    Object.assign(atlas as unknown as Record<string, unknown>, {
      results: [{
        datasetVersion: 2,
        datasetFingerprint: fp,
        spec: { operation: { op: 'k_means', k: 3 } },
        provenance: null,
      }],
    });
    const renderer = {
      tdaCompute: vi.fn(async () => tda(2, fp)),
      tdaApply: vi.fn(() => true),
    } as unknown as Pick<WorldRendererLifecycle, 'tdaCompute' | 'tdaApply'>;
    const pipeline = new DerivedAnalysisPipeline({
      atlas,
      rendererLifecycle: renderer,
      publishStructureHandles: () => {},
      markRecommendationDirty: () => {},
      defer: immediateDeferrer,
    });

    pipeline.schedule('cluster');
    await pipeline.whenIdle();

    expect(recorded).toHaveLength(1);
    const clusterSet = recorded[0] as {
      structures: Array<{ evidence: { method: string; parameters: Record<string, unknown> }; rowIndices: number[] }>;
    };
    expect(clusterSet.structures.map((entry) => entry.evidence.method)).toEqual(['cluster', 'cluster']);
    expect(clusterSet.structures.map((entry) => entry.rowIndices)).toEqual([[0], [1, 2]]);
    expect(clusterSet.structures[0].evidence.parameters.op).toBe('k_means');
  });

  it('does not publish stale TDA output when Atlas identity changes during computation', async () => {
    const fp = 'c'.repeat(64);
    const { atlas, recorded } = makeAtlas(dataset(), fp);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const renderer = {
      tdaCompute: vi.fn(async () => {
        await gate;
        return tda(2, fp);
      }),
      tdaApply: vi.fn(() => true),
    } as unknown as Pick<WorldRendererLifecycle, 'tdaCompute' | 'tdaApply'>;
    const pipeline = new DerivedAnalysisPipeline({
      atlas,
      rendererLifecycle: renderer,
      publishStructureHandles: () => {},
      markRecommendationDirty: () => {},
      defer: immediateDeferrer,
    });

    pipeline.schedule('sort');
    await Promise.resolve();
    Object.assign(atlas as unknown as Record<string, unknown>, {
      datasetVersion: 3,
      datasetFingerprint: 'd'.repeat(64),
    });
    release();
    await pipeline.whenIdle();

    expect(renderer.tdaApply).not.toHaveBeenCalled();
    expect(recorded).toHaveLength(0);
    expect(pipeline.stats().staleAfterCompute).toBe(1);
  });
});
