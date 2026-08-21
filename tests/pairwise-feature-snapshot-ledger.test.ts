import { describe, expect, it } from 'vitest';
import {
  PAIRWISE_FEATURE_SCHEMA_VERSION,
  PAIRWISE_FEATURE_SNAPSHOT_SCHEMA_VERSION,
  PairwiseFeatureSnapshotLedger,
} from '../src/fitness/index.ts';

const snapshot = {
  schemaVersion: PAIRWISE_FEATURE_SNAPSHOT_SCHEMA_VERSION,
  featureSchemaVersion: PAIRWISE_FEATURE_SCHEMA_VERSION,
  graphId: 'graph-1',
  datasetFingerprint: 'dataset-1',
  fitnessModelVersion: 'bootstrap-fitness-v1',
  features: [1, 2, 3, 4, 5, 6],
  bootstrapUtility: 0.5,
} as const;

describe('PairwiseFeatureSnapshotLedger', () => {
  it('stores immutable snapshot evidence and rejects duplicates', () => {
    const ledger = new PairwiseFeatureSnapshotLedger();
    ledger.appendBatch([snapshot]);
    expect(ledger.all()).toEqual([snapshot]);
    expect(() => ledger.appendBatch([snapshot])).toThrow(/already exists/);
  });

  it('restores atomically from validated snapshots', () => {
    const ledger = new PairwiseFeatureSnapshotLedger();
    ledger.appendBatch([snapshot]);
    const saved = ledger.toJSON();
    const restored = new PairwiseFeatureSnapshotLedger();
    restored.restore(saved);
    expect(restored.all()).toEqual([snapshot]);
  });
});
