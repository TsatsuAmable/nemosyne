import {
  PAIRWISE_FEATURE_SCHEMA_VERSION,
  PAIRWISE_FEATURE_SNAPSHOT_SCHEMA_VERSION,
  type PairwiseCandidateFeatureSnapshot,
} from './PairwiseLearning.ts';

export const PAIRWISE_FEATURE_SNAPSHOT_LEDGER_SCHEMA_VERSION = '1.0.0' as const;

export interface PairwiseFeatureSnapshotLedgerSnapshot {
  schemaVersion: typeof PAIRWISE_FEATURE_SNAPSHOT_LEDGER_SCHEMA_VERSION;
  snapshotSchemaVersion: typeof PAIRWISE_FEATURE_SNAPSHOT_SCHEMA_VERSION;
  featureSchemaVersion: typeof PAIRWISE_FEATURE_SCHEMA_VERSION;
  snapshots: readonly PairwiseCandidateFeatureSnapshot[];
}

function keyOf(snapshot: PairwiseCandidateFeatureSnapshot): string {
  return `${snapshot.datasetFingerprint}\u0000${snapshot.graphId}\u0000${snapshot.fitnessModelVersion}`;
}

function validate(snapshot: PairwiseCandidateFeatureSnapshot): void {
  if (snapshot.schemaVersion !== PAIRWISE_FEATURE_SNAPSHOT_SCHEMA_VERSION) {
    throw new Error(`Unsupported pairwise feature snapshot schema: ${snapshot.schemaVersion}`);
  }
  if (snapshot.featureSchemaVersion !== PAIRWISE_FEATURE_SCHEMA_VERSION) {
    throw new Error(`Unsupported pairwise feature schema: ${snapshot.featureSchemaVersion}`);
  }
  if (!snapshot.graphId.trim() || !snapshot.datasetFingerprint.trim() || !snapshot.fitnessModelVersion.trim()) {
    throw new Error('Pairwise feature snapshot provenance fields must be non-empty');
  }
  if (snapshot.features.length === 0 || snapshot.features.some((value) => !Number.isFinite(value))) {
    throw new Error('Pairwise feature snapshot features must be finite and non-empty');
  }
  if (!Number.isFinite(snapshot.bootstrapUtility)) {
    throw new Error('Pairwise feature snapshot bootstrapUtility must be finite');
  }
}

/** Append-only store for candidate features captured at researcher judgement time. */
export class PairwiseFeatureSnapshotLedger {
  private readonly snapshots = new Map<string, PairwiseCandidateFeatureSnapshot>();

  all(): readonly PairwiseCandidateFeatureSnapshot[] {
    return [...this.snapshots.values()].map((snapshot) => structuredClone(snapshot));
  }

  appendBatch(batch: readonly PairwiseCandidateFeatureSnapshot[]): void {
    const staged = new Set<string>();
    for (const snapshot of batch) {
      validate(snapshot);
      const key = keyOf(snapshot);
      if (this.snapshots.has(key) || staged.has(key)) {
        throw new Error(`Pairwise feature snapshot already exists: ${key}`);
      }
      staged.add(key);
    }
    for (const snapshot of batch) this.snapshots.set(keyOf(snapshot), structuredClone(snapshot));
  }

  toJSON(): PairwiseFeatureSnapshotLedgerSnapshot {
    return {
      schemaVersion: PAIRWISE_FEATURE_SNAPSHOT_LEDGER_SCHEMA_VERSION,
      snapshotSchemaVersion: PAIRWISE_FEATURE_SNAPSHOT_SCHEMA_VERSION,
      featureSchemaVersion: PAIRWISE_FEATURE_SCHEMA_VERSION,
      snapshots: this.all(),
    };
  }

  restore(snapshot: PairwiseFeatureSnapshotLedgerSnapshot): void {
    if (snapshot.schemaVersion !== PAIRWISE_FEATURE_SNAPSHOT_LEDGER_SCHEMA_VERSION) {
      throw new Error(`Unsupported feature snapshot ledger schema: ${snapshot.schemaVersion}`);
    }
    if (snapshot.snapshotSchemaVersion !== PAIRWISE_FEATURE_SNAPSHOT_SCHEMA_VERSION) {
      throw new Error(`Unsupported pairwise feature snapshot schema: ${snapshot.snapshotSchemaVersion}`);
    }
    if (snapshot.featureSchemaVersion !== PAIRWISE_FEATURE_SCHEMA_VERSION) {
      throw new Error(`Unsupported pairwise feature schema: ${snapshot.featureSchemaVersion}`);
    }
    const staged = new PairwiseFeatureSnapshotLedger();
    staged.appendBatch(snapshot.snapshots);
    this.snapshots.clear();
    for (const item of staged.all()) this.snapshots.set(keyOf(item), item);
  }
}
