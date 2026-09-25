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

function booleanField(record: Record<string, unknown>, field: string): boolean {
  return typeof record[field] === 'boolean';
}

function requireFiniteNumber(
  record: Record<string, unknown>,
  owner: string,
  field: string,
): void {
  if (!finiteNumberField(record, field)) {
    throw new Error(
      `[AtlasCore] Rust DatasetStructureProfile '${owner}' has invalid or missing '${field}'`,
    );
  }
}

function requireBoolean(record: Record<string, unknown>, owner: string, field: string): void {
  if (!booleanField(record, field)) {
    throw new Error(
      `[AtlasCore] Rust DatasetStructureProfile '${owner}' has invalid or missing '${field}'`,
    );
  }
}

/**
 * Reject a name that TEC2 retired. This is deliberately a one-way ratchet: the
 * only way to see one of these keys is a stale kernel build or a
 * `#[serde(alias)]` that re-published the old name. A genuine estimator must
 * arrive under a new name with its own contract, so silently accepting the
 * retired key would let a heuristic score re-enter as a statistical claim.
 */
function requireRetiredFieldAbsent(
  record: Record<string, unknown>,
  owner: string,
  field: string,
): void {
  if (Object.prototype.hasOwnProperty.call(record, field)) {
    throw new Error(
      `[AtlasCore] Rust DatasetStructureProfile '${owner}' still carries retired field '${field}'; ` +
        'this name was renamed or removed by TEC2 and must not be transported',
    );
  }
}

/**
 * Runtime guard for the JSON returned by the WASM structure-profile ABI.
 * The adapter below consumes the nested analytical records, so this guard
 * verifies their presence plus the identity/cardinality fields before any
 * payload is admitted as authoritative evidence.
 *
 * TEC2 extended this from object-presence to per-field checks on the records
 * the evidence adapter reads, and added explicit rejection of the retired
 * pre-TEC2 names. This is intentionally not a closed key set: the payload has
 * no schema-version field and Rust does not deny unknown fields, so a closed
 * set would turn every future additive kernel field into a hard throw at the
 * evidence boundary with nothing to version it against.
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

  // The records the evidence adapter reads. Checking presence of the object is
  // not enough: without per-field checks a renamed kernel field arrives as
  // `undefined` and the adapter transports it silently.
  const correlations = value.correlations as Record<string, unknown>;
  requireFiniteNumber(correlations, 'correlations', 'maxCorrelation');
  requireFiniteNumber(correlations, 'correlations', 'pairsAboveMagnitudeThreshold');
  requireBoolean(correlations, 'correlations', 'isRankDeficient');
  requireRetiredFieldAbsent(correlations, 'correlations', 'significantPairsCount');
  if (!Array.isArray(correlations.pairs)) {
    throw new Error("[AtlasCore] Rust DatasetStructureProfile 'correlations' has invalid or missing 'pairs'");
  }
  for (const pair of correlations.pairs) {
    if (!isRecord(pair)) {
      throw new Error("[AtlasCore] Rust DatasetStructureProfile 'correlations.pairs' entries must be objects");
    }
    requireBoolean(pair, 'correlations.pairs[]', 'exceedsMagnitudeThreshold');
    requireRetiredFieldAbsent(pair, 'correlations.pairs[]', 'isStrong');
  }

  const clusters = value.clusters as Record<string, unknown>;
  requireFiniteNumber(clusters, 'clusters', 'separationScore');
  requireFiniteNumber(clusters, 'clusters', 'heuristicSilhouettePartitionScore');
  requireBoolean(clusters, 'clusters', 'hasClusters');
  requireRetiredFieldAbsent(clusters, 'clusters', 'stabilityConfidence');
  // TEC2 removed the cluster density-variation proxy (a two-valued constant
  // with no estimand behind it) from the Rust producer. Accepting the retired
  // key would let a stale kernel build or a `#[serde(alias)]` re-publish the
  // bogus density quantity at the transport silently.
  requireRetiredFieldAbsent(clusters, 'clusters', 'densityVariation');

  const density = value.density as Record<string, unknown>;
  requireFiniteNumber(density, 'density', 'heuristicScaleDensityProxy');
  requireFiniteNumber(density, 'density', 'modeCount');
  requireBoolean(density, 'density', 'heuristicSparseByRowCount');
  requireRetiredFieldAbsent(density, 'density', 'localDensityVariation');

  const spectral = value.spectral;
  if (spectral !== null && spectral !== undefined) {
    if (!isRecord(spectral)) {
      throw new Error('[AtlasCore] Rust DatasetStructureProfile has invalid spectral record');
    }
    requireFiniteNumber(spectral, 'spectral', 'periodicityHeuristicScore');
    requireBoolean(spectral, 'spectral', 'hasPeriodicity');
    requireRetiredFieldAbsent(spectral, 'spectral', 'periodicityConfidence');
  }

  const temporal = value.temporal;
  if (temporal !== null && temporal !== undefined) {
    if (!isRecord(temporal) || !Array.isArray(temporal.periodicities)) {
      throw new Error(
        "[AtlasCore] Rust DatasetStructureProfile 'temporal' has invalid or missing 'periodicities'",
      );
    }
    for (const periodicity of temporal.periodicities) {
      if (!isRecord(periodicity)) {
        throw new Error(
          "[AtlasCore] Rust DatasetStructureProfile 'temporal.periodicities' entries must be objects",
        );
      }
      requireFiniteNumber(periodicity, 'temporal.periodicities[]', 'heuristicScore');
      requireRetiredFieldAbsent(periodicity, 'temporal.periodicities[]', 'confidence');
    }
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
