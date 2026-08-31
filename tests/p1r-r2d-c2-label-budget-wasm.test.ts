import { beforeAll, describe, expect, it } from 'vitest';
import * as bridge from '../src/wasm/RuntimeBridge.ts';
import { buildClusterSemanticEmbodimentV1 } from '../src/wasm/runtime/SemanticEmbodimentBridge.ts';
import {
  MAX_CLUSTER_PARTITION_LABEL_BYTES_V1,
  type ClusterEmbodimentRequestV1,
} from '../src/moneta/representation/ClusterEmbodimentPayload.ts';

const request: ClusterEmbodimentRequestV1 = {
  schemaVersion: 1,
  candidateId: 'CLUSTER_REGIONS',
  partitionField: 'group',
  coordinateFields: ['x', 'y'],
};

describe('P1-R2D C2 retained-label byte envelope', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    if (!bridge.isReady()) throw new Error('R2D C2 requires the real WASM runtime');
  });

  it('refuses an exact source label that would exceed the bounded semantic payload budget', () => {
    const handle = bridge.loadDatasetJson({
      name: 'c2-cluster-label-budget',
      columns: [
        { name: 'group', type: 'CATEGORICAL' },
        { name: 'x', type: 'NUMERIC' },
        { name: 'y', type: 'NUMERIC' },
      ],
      rows: [
        {
          group: 'x'.repeat(MAX_CLUSTER_PARTITION_LABEL_BYTES_V1 + 1),
          x: 0,
          y: 0,
        },
      ],
    });
    expect(handle).toBeGreaterThan(0);
    try {
      const envelope = buildClusterSemanticEmbodimentV1(handle, request);
      expect(envelope?.result.status).toBe('REFUSED');
      if (envelope?.result.status === 'REFUSED') {
        expect(envelope.result.refusal.code).toBe('RESOURCE_LIMIT');
      }
      expect(envelope?.resource.elementCount).toBe(0);
    } finally {
      bridge.destroyDataset(handle);
    }
  });
});
