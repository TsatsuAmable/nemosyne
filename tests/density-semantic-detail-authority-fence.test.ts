import { beforeAll, describe, expect, it } from 'vitest';
import * as bridge from '../src/wasm/RuntimeBridge.ts';
import {
  buildDensitySemanticEmbodimentV1,
  querySemanticDetailV1,
} from '../src/wasm/runtime/SemanticEmbodimentBridge.ts';
import { SEMANTIC_DETAIL_SCHEMA_VERSION } from '../src/moneta/representation/SemanticDrillDown.ts';

const DECISION_ID = 'density-authority-fence-decision';
const DECISION_ARTIFACT_HASH = 'a'.repeat(64);

describe('P1-R2C density semantic-detail authority fence', () => {
  let handle: number;
  let fingerprint: string;

  beforeAll(async () => {
    if (!bridge.isReady()) {
      await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    }
    if (!bridge.isReady()) throw new Error('density authority-fence tests require real WASM');

    handle = bridge.loadDatasetJson({
      name: 'density-authority-fence',
      columns: [
        { name: 'x', type: 'NUMERIC' as const },
        { name: 'y', type: 'NUMERIC' as const },
        { name: 'other', type: 'NUMERIC' as const },
      ],
      rows: [
        { x: 0, y: 0, other: 100 },
        { x: 1, y: 1, other: 100 },
        { x: 2, y: 2, other: 100 },
        { x: 3, y: 3, other: 100 },
      ],
      rowIds: ['obs-0', 'obs-1', 'obs-2', 'obs-3'],
    });
    expect(handle).toBeGreaterThan(0);
    fingerprint = bridge.datasetFingerprint(handle)!;
  });

  it('uses the retained READY density request rather than caller-supplied reinterpretation parameters', () => {
    const authoritativeRequest = {
      schemaVersion: 1 as const,
      candidateId: 'DENSITY_FIELD' as const,
      measureFieldX: 'x',
      measureFieldY: 'y',
      binsX: 4,
      binsY: 4,
      decisionId: DECISION_ID,
      decisionModelVersion: 'fitness-treatment-v4',
      decisionModelArtifactHash: DECISION_ARTIFACT_HASH,
    };

    const embodiment = buildDensitySemanticEmbodimentV1(handle, authoritativeRequest);
    expect(embodiment).not.toBeNull();
    expect(embodiment!.result.status).toBe('READY');

    const detailRequest = {
      schemaVersion: SEMANTIC_DETAIL_SCHEMA_VERSION,
      target: {
        datasetFingerprint: fingerprint,
        decisionId: DECISION_ID,
        representationFamily: 'DENSITY' as const,
        semanticObjectId: 'density-cell:2-2',
      },
      limit: 10,
      offset: 0,
      investigationContext: 'Verify authoritative density membership.',
    };

    const hostileReinterpretation = {
      ...authoritativeRequest,
      measureFieldX: 'other',
      measureFieldY: 'other',
      binsX: 2,
      binsY: 2,
    };

    const detail = querySemanticDetailV1(
      handle,
      detailRequest,
      hostileReinterpretation,
      1,
    );

    expect(detail).not.toBeNull();
    expect(detail!.result.status).toBe('READY');
    if (detail!.result.status === 'READY') {
      expect(detail!.result.totalMemberCount).toBe(1);
      expect(detail!.result.observationIds).toEqual(['obs-2']);
    }
  });

  it('fails closed when the semantic target names a different decision', () => {
    const detail = querySemanticDetailV1(
      handle,
      {
        schemaVersion: SEMANTIC_DETAIL_SCHEMA_VERSION,
        target: {
          datasetFingerprint: fingerprint,
          decisionId: 'wrong-density-decision',
          representationFamily: 'DENSITY',
          semanticObjectId: 'density-cell:2-2',
        },
        limit: 10,
        offset: 0,
        investigationContext: 'Wrong decision must not resolve authority.',
      },
      {
        schemaVersion: 1,
        candidateId: 'DENSITY_FIELD',
        measureFieldX: 'x',
        measureFieldY: 'y',
        binsX: 4,
        binsY: 4,
      },
      1,
    );

    expect(detail).toBeNull();
  });
});
