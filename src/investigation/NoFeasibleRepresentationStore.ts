import type {
  CandidateScore,
  HardConstraintTrace,
} from '../moneta/representation/RepresentationDecision.ts';
import type { NoFeasibleRepresentationProvenance } from '../moneta/representation/NoFeasibleRepresentationError.ts';

export const NO_FEASIBLE_REPRESENTATION_STORE_SCHEMA_VERSION = '1.0.0' as const;

export interface NoFeasibleRepresentationRecord {
  nilId: string;
  recordedAt: number;
  traces: readonly HardConstraintTrace[];
  nearMisses: readonly CandidateScore[];
  provenance: NoFeasibleRepresentationProvenance;
}

export interface NoFeasibleRepresentationStoreSnapshot {
  schemaVersion: typeof NO_FEASIBLE_REPRESENTATION_STORE_SCHEMA_VERSION;
  outcomes: readonly NoFeasibleRepresentationRecord[];
}

function nonEmpty(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertRecord(record: NoFeasibleRepresentationRecord): void {
  if (!nonEmpty(record.nilId)) throw new Error('NIL outcome id must be non-empty');
  if (!Number.isFinite(record.recordedAt) || record.recordedAt < 0) {
    throw new Error('NIL outcome recordedAt must be a non-negative finite number');
  }
  if (!record.provenance || !nonEmpty(record.provenance.datasetFingerprint)) {
    throw new Error('NIL outcome provenance requires datasetFingerprint');
  }
  if (!nonEmpty(record.provenance.kernelVersion)) {
    throw new Error('NIL outcome provenance requires kernelVersion');
  }
  if (!Array.isArray(record.provenance.evidenceIds)) {
    throw new Error('NIL outcome provenance requires evidenceIds');
  }
  if (record.provenance.evidenceIds.some((id) => !nonEmpty(id))) {
    throw new Error('NIL outcome evidenceIds must contain only non-empty ids');
  }
}

function cloneRecord(record: NoFeasibleRepresentationRecord): NoFeasibleRepresentationRecord {
  return structuredClone(record);
}

export class NoFeasibleRepresentationStore {
  private outcomesById = new Map<string, NoFeasibleRepresentationRecord>();

  get size(): number {
    return this.outcomesById.size;
  }

  all(): readonly NoFeasibleRepresentationRecord[] {
    return [...this.outcomesById.values()].map(cloneRecord);
  }

  record(record: NoFeasibleRepresentationRecord): void {
    assertRecord(record);
    if (this.outcomesById.has(record.nilId)) {
      throw new Error(`NIL outcome already exists: ${record.nilId}`);
    }
    this.outcomesById.set(record.nilId, cloneRecord(record));
  }

  reset(): void {
    this.outcomesById.clear();
  }

  toJSON(): NoFeasibleRepresentationStoreSnapshot {
    return {
      schemaVersion: NO_FEASIBLE_REPRESENTATION_STORE_SCHEMA_VERSION,
      outcomes: this.all(),
    };
  }

  restore(snapshot: NoFeasibleRepresentationStoreSnapshot): void {
    if (snapshot.schemaVersion !== NO_FEASIBLE_REPRESENTATION_STORE_SCHEMA_VERSION) {
      throw new Error(
        `Unsupported NoFeasibleRepresentationStore schema version: ${snapshot.schemaVersion}`,
      );
    }

    const next = new Map<string, NoFeasibleRepresentationRecord>();
    for (const record of snapshot.outcomes) {
      assertRecord(record);
      if (next.has(record.nilId)) {
        throw new Error(`Duplicate NIL outcome in snapshot: ${record.nilId}`);
      }
      next.set(record.nilId, cloneRecord(record));
    }
    this.outcomesById = next;
  }
}
