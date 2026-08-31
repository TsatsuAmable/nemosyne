import { beforeAll, describe, expect, it } from 'vitest';
import * as bridge from '../src/wasm/RuntimeBridge.ts';
import { buildClusterSemanticEmbodimentV1 } from '../src/wasm/runtime/SemanticEmbodimentBridge.ts';
import type {
  ClusterEmbodimentRequestV1,
  ClusterRegionsPayloadV1,
} from '../src/moneta/representation/ClusterEmbodimentPayload.ts';

const request: ClusterEmbodimentRequestV1 = {
  schemaVersion: 1,
  candidateId: 'CLUSTER_REGIONS',
  partitionField: 'group',
  coordinateFields: ['x', 'y'],
};

function load(name: string, xs: number[]): number {
  return bridge.loadDatasetJson({
    name,
    columns: [
      { name: 'group', type: 'CATEGORICAL' },
      { name: 'x', type: 'NUMERIC' },
      { name: 'y', type: 'NUMERIC' },
    ],
    rows: xs.map((x, index) => ({ group: 'A', x, y: index % 2 })),
  });
}

function payload(handle: number): ClusterRegionsPayloadV1 {
  const envelope = buildClusterSemanticEmbodimentV1(handle, request);
  if (envelope?.result.status !== 'READY') throw new Error('expected READY cluster payload');
  return envelope.result.payload.data;
}

describe('P1-R2D C2 deterministic centroid reduction', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    if (!bridge.isReady()) throw new Error('R2D C2 requires the real WASM runtime');
  });

  it('is exactly row-order invariant even under catastrophic-cancellation permutations', () => {
    const first = load('c2-centroid-order', [1e16, -1e16, 1]);
    const second = load('c2-centroid-order', [1, -1e16, 1e16]);
    try {
      expect(payload(first)).toEqual(payload(second));
    } finally {
      bridge.destroyDataset(first);
      bridge.destroyDataset(second);
    }
  });
});
