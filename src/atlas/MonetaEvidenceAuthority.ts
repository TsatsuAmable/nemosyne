import {
  structureProfileToDatasetEvidence,
  type DatasetEvidence,
  type RustDatasetStructureProfile,
} from '../data/evidence/index.ts';

/** Narrow kernel contract for the Moneta evidence composition boundary. */
export interface DatasetStructureProfileKernel {
  computeDatasetStructureProfile(handle: number): unknown | null;
  datasetFingerprint?(handle: number): string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function finiteNumberField(record: Record<string, unknown>, field: string): boolean {
  return typeof record[field] === 'number' && Number.isFinite(record[field]);
}

function stringField(record: Record<string, unknown>, field: string): boolean {
  return typeof record[field] === 'string' && record[field].length > 0;
}

/**
 * Runtime guard for the JSON returned by the WASM structure-profile ABI.
 * The adapter below consumes the nested analytical records, so this guard
 * verifies their presence plus the identity/cardinality fields before any
 * payload is admitted as authoritative evidence.
 */
export function assertRustDatasetStructureProfile(
  value: unknown,
): asserts value is RustDatasetStructureProfile {
  if (!isRecord(value)) {
    throw new Error('[AtlasCore] Rust DatasetStructureProfile payload must be an object');
  }

  if (
    !stringField(value, 'datasetName') ||
    !finiteNumberField(value, 'rowCount') ||
    !finiteNumberField(value, 'columnCount')
  ) {
    throw new Error('[AtlasCore] Rust DatasetStructureProfile has invalid dataset identity/cardinality');
  }

  const requiredObjects = [
    'dimensionality',
    'distributions',
    'correlations',
    'clusters',
    'density',
    'anomalies',
    'missingness',
    'categorical',
    'provenance',
  ] as const;
  for (const field of requiredObjects) {
    if (!isRecord(value[field])) {
      throw new Error(`[AtlasCore] Rust DatasetStructureProfile missing object '${field}'`);
    }
  }

  const provenance = value.provenance as Record<string, unknown>;
  if (
    !stringField(provenance, 'kernelVersion') ||
    !stringField(provenance, 'datasetFingerprint') ||
    !stringField(provenance, 'algorithmSuite') ||
    !finiteNumberField(provenance, 'timestampMs')
  ) {
    throw new Error('[AtlasCore] Rust DatasetStructureProfile has invalid provenance');
  }
}

/**
 * Convert the Rust-owned structure profile for an existing dataset handle into
 * canonical DatasetEvidence. This boundary does no analytical recomputation.
 */
export function datasetEvidenceFromKernelProfile(
  kernel: DatasetStructureProfileKernel,
  handle: number,
): DatasetEvidence {
  if (!Number.isInteger(handle) || handle <= 0) {
    throw new Error('[AtlasCore] DatasetEvidence requires a valid Rust dataset handle');
  }

  const profile = kernel.computeDatasetStructureProfile(handle);
  if (!profile) {
    throw new Error('[AtlasCore] Rust DatasetStructureProfile unavailable for current dataset');
  }
  assertRustDatasetStructureProfile(profile);

  const evidence = structureProfileToDatasetEvidence(profile);
  const kernelFingerprint = kernel.datasetFingerprint?.(handle) ?? null;
  if (kernelFingerprint && kernelFingerprint !== evidence.datasetFingerprint) {
    throw new Error(
      '[AtlasCore] DatasetStructureProfile fingerprint drift: ' +
        `profile=${evidence.datasetFingerprint}, kernel=${kernelFingerprint}`,
    );
  }

  return evidence;
}
