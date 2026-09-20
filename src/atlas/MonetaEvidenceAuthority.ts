import {
  parseEvidenceReceiptBundleV1,
  structureProfileToDatasetEvidence,
  type DatasetEvidence,
  type EvidenceReceiptV1,
  type RustDatasetStructureProfile,
} from '../data/evidence/index.ts';
import {
  datasetFingerprint as liveDatasetFingerprint,
  kernelVersion as liveKernelVersion,
  statisticsEvidenceReceiptBundle,
} from '../wasm/RuntimeBridge.ts';

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

export interface LiveEvidenceReceiptAuthorityV1 {
  readonly datasetFingerprint: string;
  readonly kernelVersion: string;
  readonly receiptIds: readonly string[];
  resolve(receiptId: string): EvidenceReceiptV1 | null;
}

/**
 * Mint a live statistics receipt resolver from the current Rust dataset capability.
 * Serialized receipt data alone cannot construct this authority.
 */
export function statisticsEvidenceReceiptAuthority(
  handle: number,
): LiveEvidenceReceiptAuthorityV1 {
  if (!Number.isInteger(handle) || handle <= 0) {
    throw new Error('[AtlasCore] EvidenceReceipt authority requires a valid Rust dataset handle');
  }

  const datasetFingerprint = liveDatasetFingerprint(handle);
  const kernelVersion = liveKernelVersion();
  if (!datasetFingerprint || !kernelVersion) {
    throw new Error('[AtlasCore] EvidenceReceipt authority cannot establish live kernel identity');
  }

  const rawBundle = statisticsEvidenceReceiptBundle(handle);
  if (!rawBundle) {
    throw new Error('[AtlasCore] Rust statistics evidence receipts unavailable for current dataset');
  }
  const bundle = parseEvidenceReceiptBundleV1(rawBundle);
  if (
    bundle.datasetFingerprint !== datasetFingerprint ||
    bundle.kernelVersion !== kernelVersion
  ) {
    throw new Error(
      '[AtlasCore] EvidenceReceipt bundle identity drift: ' +
        `bundle=${bundle.datasetFingerprint}@${bundle.kernelVersion}, ` +
        `kernel=${datasetFingerprint}@${kernelVersion}`,
    );
  }

  const assertLiveIdentity = (): void => {
    const currentFingerprint = liveDatasetFingerprint(handle);
    const currentKernelVersion = liveKernelVersion();
    if (
      currentFingerprint !== datasetFingerprint ||
      currentKernelVersion !== kernelVersion
    ) {
      throw new Error('[AtlasCore] EvidenceReceipt authority is stale for the current Rust dataset');
    }
  };

  const byId = new Map(bundle.receipts.map((receipt) => [receipt.receiptId, receipt] as const));
  const receiptIds = Object.freeze([...byId.keys()]);
  return Object.freeze({
    datasetFingerprint,
    kernelVersion,
    receiptIds,
    resolve(receiptId: string): EvidenceReceiptV1 | null {
      assertLiveIdentity();
      if (typeof receiptId !== 'string' || receiptId.length === 0) return null;
      return byId.get(receiptId) ?? null;
    },
  });
}
