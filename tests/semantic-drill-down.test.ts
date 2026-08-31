import { beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as bridge from '../src/wasm/RuntimeBridge.ts';
import {
  SEMANTIC_DETAIL_SCHEMA_VERSION,
  MAX_DETAIL_OBSERVATION_LIMIT_V1,
  type SemanticDetailEnvelopeV1,
} from '../src/moneta/representation/SemanticDrillDown.ts';

function detailFixture(): SemanticDetailEnvelopeV1 {
  return {
    schemaVersion: SEMANTIC_DETAIL_SCHEMA_VERSION,
    generation: 1,
    request: {
      schemaVersion: SEMANTIC_DETAIL_SCHEMA_VERSION,
      target: {
        datasetFingerprint: 'a'.repeat(64),
        decisionId: 'decision-fixture-123',
        representationFamily: 'CLUSTER',
        semanticObjectId: 'cluster-0',
      },
      limit: 100,
      offset: 0,
      investigationContext: 'Inspect cluster-0 observations for outlier detection.',
    },
    result: {
      status: 'READY',
      totalMemberCount: 150,
      returnedCount: 2,
      observationIds: ['obs-1', 'obs-2'],
      compactViews: [
        { id: 'obs-1', value: 42.0 },
        { id: 'obs-2', value: 43.5 },
      ],
    },
  };
}

describe('Stream A A1 semantic drill-down V1 contract', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) {
      await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    }
    if (!bridge.isReady()) {
      throw new Error('A1 tests require the real WASM runtime');
    }
  });

  it('successfully round-trips a valid READY detail envelope', () => {
    const fixture = detailFixture();
    const result = bridge.roundTripSemanticDetailEnvelopeV1(fixture);
    expect(result).not.toBeNull();
    expect(result).toEqual(fixture);
  });

  it('successfully round-trips a valid REFUSED detail envelope', () => {
    const fixture: SemanticDetailEnvelopeV1 = {
      ...detailFixture(),
      result: {
        status: 'REFUSED',
        refusal: {
          code: 'RESOURCE_LIMIT',
          message: 'Requested offset out of bounds.',
        },
      },
    };
    const result = bridge.roundTripSemanticDetailEnvelopeV1(fixture);
    expect(result).not.toBeNull();
    expect(result).toEqual(fixture);
  });

  it('rejects envelope with invalid schema version', () => {
    const fixture = {
      ...detailFixture(),
      schemaVersion: 99 as any,
    };
    const result = bridge.roundTripSemanticDetailEnvelopeV1(fixture);
    expect(result).toBeNull();
  });

  it('rejects request with invalid schema version', () => {
    const fixture = detailFixture();
    (fixture.request as any).schemaVersion = 99;
    const result = bridge.roundTripSemanticDetailEnvelopeV1(fixture);
    expect(result).toBeNull();
  });

  it('rejects target with invalid fingerprint length', () => {
    const fixture = detailFixture();
    (fixture.request.target as any).datasetFingerprint = 'abc';
    const result = bridge.roundTripSemanticDetailEnvelopeV1(fixture);
    expect(result).toBeNull();
  });

  it('rejects target with non-hex fingerprint characters', () => {
    const fixture = detailFixture();
    (fixture.request.target as any).datasetFingerprint = 'g' + 'a'.repeat(63);
    const result = bridge.roundTripSemanticDetailEnvelopeV1(fixture);
    expect(result).toBeNull();
  });

  it('rejects target with uppercase hex fingerprint characters', () => {
    const fixture = detailFixture();
    (fixture.request.target as any).datasetFingerprint = 'A' + 'a'.repeat(63);
    const result = bridge.roundTripSemanticDetailEnvelopeV1(fixture);
    expect(result).toBeNull();
  });

  it('rejects request with 0 limit', () => {
    const fixture = detailFixture();
    (fixture.request as any).limit = 0;
    const result = bridge.roundTripSemanticDetailEnvelopeV1(fixture);
    expect(result).toBeNull();
  });

  it('rejects request with limit exceeding MAX_DETAIL_OBSERVATION_LIMIT_V1', () => {
    const fixture = detailFixture();
    (fixture.request as any).limit = MAX_DETAIL_OBSERVATION_LIMIT_V1 + 1;
    const result = bridge.roundTripSemanticDetailEnvelopeV1(fixture);
    expect(result).toBeNull();
  });

  it('rejects request with overly large investigation context', () => {
    const fixture = detailFixture();
    (fixture.request as any).investigationContext = 'a'.repeat(1025);
    const result = bridge.roundTripSemanticDetailEnvelopeV1(fixture);
    expect(result).toBeNull();
  });

  it('rejects READY result with mismatched returnedCount', () => {
    const fixture = detailFixture();
    if (fixture.result.status === 'READY') {
      (fixture.result as any).returnedCount = 3;
    }
    const result = bridge.roundTripSemanticDetailEnvelopeV1(fixture);
    expect(result).toBeNull();
  });

  it('rejects READY result with returnedCount exceeding limit', () => {
    const fixture = detailFixture();
    (fixture.request as any).limit = 1;
    if (fixture.result.status === 'READY') {
      (fixture.result as any).returnedCount = 2;
      (fixture.result as any).observationIds = ['obs-1', 'obs-2'];
    }
    const result = bridge.roundTripSemanticDetailEnvelopeV1(fixture);
    expect(result).toBeNull();
  });

  it('rejects READY result with totalMemberCount less than returnedCount', () => {
    const fixture = detailFixture();
    if (fixture.result.status === 'READY') {
      (fixture.result as any).totalMemberCount = 1;
    }
    const result = bridge.roundTripSemanticDetailEnvelopeV1(fixture);
    expect(result).toBeNull();
  });

  it('rejects READY result with invalid compactViews size', () => {
    const fixture = detailFixture();
    if (fixture.result.status === 'READY') {
      (fixture.result as any).compactViews = [{ id: 'obs-1' }];
    }
    const result = bridge.roundTripSemanticDetailEnvelopeV1(fixture);
    expect(result).toBeNull();
  });

  it('rejects REFUSED result with too large refusal message', () => {
    const fixture: SemanticDetailEnvelopeV1 = {
      ...detailFixture(),
      result: {
        status: 'REFUSED',
        refusal: {
          code: 'RESOURCE_LIMIT',
          message: 'a'.repeat(1025),
        },
      },
    };
    const result = bridge.roundTripSemanticDetailEnvelopeV1(fixture);
    expect(result).toBeNull();
  });

  describe('Architectural Boundary Falsifier', () => {
    const checkedFiles = [
      'src/moneta/embodiment/ClusterSemanticEmbodiment.ts',
      'src/moneta/embodiment/DensitySemanticEmbodiment.ts',
      'src/moneta/embodiment/ScalableTopologyEmbodiment.ts',
      'src/vr/presentation/representation/RepresentationSurface.ts',
    ];

    it('ensures representation embodiment files do not scan or rematerialize raw rows directly', () => {
      for (const relPath of checkedFiles) {
        const filePath = path.resolve(process.cwd(), relPath);
        const content = fs.readFileSync(filePath, 'utf8');
        expect(content, `${relPath} must not directly scan dataset rows`).not.toContain('dataset.rows');
        expect(content, `${relPath} must not directly scan dataInput rows`).not.toContain('dataInput.rows');
      }
    });
  });
});
