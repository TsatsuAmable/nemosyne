import { beforeAll, describe, expect, it } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import * as bridge from '../src/wasm/RuntimeBridge.ts';
import {
  buildAggregateSemanticEmbodimentV1,
  buildDistributionSemanticEmbodimentV1,
  buildDensitySemanticEmbodimentV1,
} from '../src/wasm/runtime/SemanticEmbodimentBridge.ts';
import {
  diagnoseDirectEvidenceReadiness,
  isSemanticEnvelopeV1,
} from '../src/app/investigation/DirectEvidenceReadiness.ts';
import { DESCRIPTIVE_STATISTICS_CONSUMER_ID_V1 } from '../src/data/evidence/GovernedConsumerAttestation.ts';

/**
 * The REAL Rust producer and governed snapshot are independently available,
 * but this build's minted consumer authorizes descriptive uses only. A shared
 * fingerprint is insufficient to grant a direct representation permission.
 */
describe('FM2 producer-to-direct evidence admission is fail closed on real Rust/WASM', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    if (!bridge.isReady()) throw new Error('Missing real Rust WASM for FM2 readiness test');
  });

  it('refuses cross-purpose authority even when both real producers agree on the dataset', async () => {
    const atlas = new AtlasCore({ kernel: bridge });
    atlas.loadDataset(new Dataset('fm2-real-source-and-receipt', [
      { name: 'x', type: ColumnType.NUMERIC },
      { name: 'y', type: ColumnType.NUMERIC },
    ], Array.from({ length: 32 }, (_, i) => ({ x: i + 1, y: (i + 1) * 2 }))));
    const handle = atlas.aggregate.analytical.currentHandle;
    try {
      const source = buildDistributionSemanticEmbodimentV1(handle, {
        schemaVersion: 1, candidateId: 'DISTRIBUTION_FIELD',
        measureField: 'x', histogramBinCount: 8,
        ecdfKnotCount: 8, quantileProbabilities: [0, 0.5, 1],
      });
      expect(isSemanticEnvelopeV1(source)).toBe(true);
      expect(source?.result.status).toBe('READY');
      expect(source?.provenance.kernelVersion).toBe(bridge.kernelVersion());
      // The other V1 semantic producers must not drift to Cargo package
      // version just because distribution was repaired.
      const aggregate = buildAggregateSemanticEmbodimentV1(handle, {
        schemaVersion: 1, candidateId: 'AGGREGATE_VOLUME',
        groupingField: 'x', measure: { function: 'COUNT' },
      });
      const density = buildDensitySemanticEmbodimentV1(handle, {
        schemaVersion: 1, candidateId: 'DENSITY_FIELD',
        measureFieldX: 'x', measureFieldY: 'y', binsX: 4, binsY: 4,
      });
      expect(aggregate?.provenance.kernelVersion).toBe(bridge.kernelVersion());
      expect(density?.provenance.kernelVersion).toBe(bridge.kernelVersion());
      const capture = await atlas.captureGovernedEvidenceReceipt();
      expect(capture).not.toBeNull();
      expect(capture!.envelope.bundle.datasetFingerprint).toBe(source!.datasetFingerprint);
      expect(capture!.envelope.uses.length).toBeGreaterThan(0);
      expect(capture!.envelope.uses.every((use) =>
        use.consumerId === DESCRIPTIVE_STATISTICS_CONSUMER_ID_V1)).toBe(true);
      const readiness = diagnoseDirectEvidenceReadiness({
        source,
        capture,
        liveDatasetFingerprint: atlas.datasetFingerprint,
        liveKernelVersion: atlas.kernelVersion(),
      });
      expect(readiness).toEqual({ status: 'REFUSED', code: 'DIRECT_CONSUMER_UNATTESTED' });
      expect(atlas.getActiveDirectCompileResult()).toBeUndefined();
      expect(atlas.getDirectFeedbackLinks()).toHaveLength(0);

      const differentIdentity = diagnoseDirectEvidenceReadiness({
        source,
        capture,
        liveDatasetFingerprint: 'replacement-dataset',
        liveKernelVersion: atlas.kernelVersion(),
      });
      expect(differentIdentity).toEqual({ status: 'REFUSED', code: 'IDENTITY_MISMATCH' });
      expect(diagnoseDirectEvidenceReadiness({
        source,
        capture: null,
        liveDatasetFingerprint: atlas.datasetFingerprint,
        liveKernelVersion: atlas.kernelVersion(),
      }).code).toBe('CAPTURE_UNAVAILABLE');
    } finally {
      bridge.destroyDataset(handle);
    }
  }, 60000);
});
