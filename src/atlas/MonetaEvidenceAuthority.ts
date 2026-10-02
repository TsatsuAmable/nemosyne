import {
  evidenceRequirementProfileByIdV1,
  evaluateEvidenceReceiptAgainstProfileV1,
  isEvidenceRequirementProfileV1,
  parseEvidenceReceiptBundleV1,
  parseGovernedConsumerAttestationV1,
  structureProfileToDatasetEvidence,
  type DatasetEvidence,
  type EvidenceReceiptResolutionV1,
  type EvidenceReceiptV1,
  type EvidenceRequirementProfileV1,
  type RustDatasetStructureProfile,
} from '../data/evidence/index.ts';
import { governedConsumerPolicyV1 } from '../data/evidence/ConsumerPolicyRegistry.ts';
import { canonicalJsonStringify } from '../security/CryptoHash.ts';
import {
  parsePersistedEvidenceReceiptsV1,
  type PersistedEvidenceReceiptsV1,
  type PersistedEvidenceUseV1,
} from '../data/evidence/PersistedEvidenceReceipts.ts';

/** Narrow kernel contract for the Moneta evidence composition boundary. */
export interface DatasetStructureProfileKernel {
  computeDatasetStructureProfile(handle: number): unknown | null;
  datasetFingerprint?(handle: number): string | null;
}

/**
 * Narrow kernel contract for Rust-issued statistics evidence receipts.
 *
 * Issue #834: this boundary is given the analytical authority, never a module
 * singleton it can reach on its own. Which runtime satisfies it — the
 * main-thread kernel for inline execution, the Worker-owned runtime for a
 * transport port — is decided by the caller that injects it.
 */
export interface StatisticsEvidenceReceiptKernel {
  statisticsEvidenceReceiptBundle(handle: number): unknown | null;
  datasetFingerprint?(handle: number): string | null;
  kernelVersion?(): string | null;
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
  /**
   * Resolve a receipt against an authority-owned requirement profile
   * (RFC 0007 section 3). Returns the immutable receipt only when every
   * requirement of the profile is met; otherwise returns a typed governed
   * refusal naming the unmet requirement. A stale or replaced dataset handle
   * still revokes the capability by throwing, exactly like `resolve`.
   * Callers may not author profiles: only the frozen registry minted in the
   * evidence contract layer is accepted, so a candidate, UI caller or
   * learned model cannot weaken an operation's evidence requirements.
   */
  resolveAgainst(
    profile: EvidenceRequirementProfileV1,
    receiptId: string,
  ): EvidenceReceiptResolutionV1;
}

/**
 * Mint a live statistics receipt resolver from the current Rust dataset capability.
 * Serialized receipt data alone cannot construct this authority.
 *
 * Issue #834: the analytical authority is injected, so a caller cannot obtain
 * this capability from a module-global runtime the caller never chose. Live
 * identity reads and every revocation check go through the injected kernel.
 */
export function statisticsEvidenceReceiptAuthority(
  kernel: StatisticsEvidenceReceiptKernel,
  handle: number,
): LiveEvidenceReceiptAuthorityV1 {
  if (!Number.isInteger(handle) || handle <= 0) {
    throw new Error('[AtlasCore] EvidenceReceipt authority requires a valid Rust dataset handle');
  }

  const readDatasetFingerprint = kernel.datasetFingerprint;
  const readKernelVersion = kernel.kernelVersion;
  const produceReceiptBundle = kernel.statisticsEvidenceReceiptBundle;
  if (
    typeof readDatasetFingerprint !== 'function' ||
    typeof readKernelVersion !== 'function' ||
    typeof produceReceiptBundle !== 'function'
  ) {
    throw new Error(
      '[AtlasCore] EvidenceReceipt authority requires an injected kernel that produces statistics evidence receipts',
    );
  }

  const datasetFingerprint = readDatasetFingerprint.call(kernel, handle);
  const kernelVersion = readKernelVersion.call(kernel);
  if (!datasetFingerprint || !kernelVersion) {
    throw new Error('[AtlasCore] EvidenceReceipt authority cannot establish live kernel identity');
  }

  const rawBundle = produceReceiptBundle.call(kernel, handle);
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
    const currentFingerprint = readDatasetFingerprint.call(kernel, handle);
    const currentKernelVersion = readKernelVersion.call(kernel);
    if (
      currentFingerprint !== datasetFingerprint ||
      currentKernelVersion !== kernelVersion
    ) {
      throw new Error('[AtlasCore] EvidenceReceipt authority is stale for the current Rust dataset');
    }
  };

  const byId = new Map(bundle.receipts.map((receipt) => [receipt.receiptId, receipt] as const));
  const receiptIds = Object.freeze([...byId.keys()]);
  const lookup = (receiptId: string): EvidenceReceiptV1 | null => {
    assertLiveIdentity();
    if (typeof receiptId !== 'string' || receiptId.length === 0) return null;
    return byId.get(receiptId) ?? null;
  };
  return Object.freeze({
    datasetFingerprint,
    kernelVersion,
    receiptIds,
    resolve(receiptId: string): EvidenceReceiptV1 | null {
      return lookup(receiptId);
    },
    resolveAgainst(
      profile: EvidenceRequirementProfileV1,
      receiptId: string,
    ): EvidenceReceiptResolutionV1 {
      // Live identity first, so a revoked capability reports its revocation
      // exactly like `resolve` and revocation telemetry stays primary.
      const receipt = lookup(receiptId);
      if (!isEvidenceRequirementProfileV1(profile)) {
        throw new Error(
          '[AtlasCore] EvidenceReceipt requirement profile is not authority-owned; ' +
            'caller-supplied profiles cannot weaken evidence requirements',
        );
      }
      return evaluateEvidenceReceiptAgainstProfileV1(profile, receiptId, receipt);
    },
  });
}

export interface GovernedEvidenceReceiptSnapshotV1 {
  readonly bytes: Uint8Array;
  readonly envelope: PersistedEvidenceReceiptsV1;
}

/**
 * One producer read: the unparsed Rust payload plus the live kernel identity it
 * was read under. Issue #834: this is the *only* input the composition step
 * accepts, so receipt content and the identity it claims come from the
 * analytical authority that was actually consulted.
 */
export interface GovernedEvidenceProducerReadoutV1 {
  readonly rawBundle: unknown;
  readonly datasetFingerprint: string;
  readonly kernelVersion: string;
  /**
   * RFC 0009 tranche 3 slice 2: the kernel-issued governed-consumer
   * attestation, in its raw (unparsed) wire form — which governed consumers
   * consume this bundle's receipts, minted by the Rust kernel alongside the
   * bundle. Composition parses it and refuses anything the kernel could not
   * have minted; it is never a caller parameter.
   */
  readonly governedConsumers: unknown;
}

/**
 * RFC 0009 tranche 2: compose the authoritative governed-evidence snapshot from
 * one producer readout.
 *
 * The bytes are the one owned serialization of a closed v1 envelope holding
 * exactly the bundle the Rust kernel produced; no TypeScript code derives or
 * re-ranks receipt content. An identity drift between the bundle and the
 * identity the read was taken under throws instead of returning a stale
 * capture.
 *
 * This function is deliberately **pure**: it cannot reach a kernel, so no
 * module-global runtime can be substituted for the authority whose readout it
 * was handed. Acquiring the readout is the analytical execution port's job —
 * including the governed-consumer attestation, which is kernel-minted
 * (`wasm/src/data/governed_consumer.rs`) and travels inside the readout.
 *
 * RFC 0009 tranche 3 slice 2: the envelope now mints the consumer-*use*
 * records (`PersistedEvidenceUseV1`) instead of composing `uses: []`. Every
 * use is authored entirely from three authorities, and composition refuses
 * unless all three agree, so nothing unbindable can be serialized:
 *
 * - the **kernel** decides *which consumers consume which receipts*: each
 *   minted use's `consumerId` and `receiptId` are copied from the kernel-issued
 *   attestation over this exact bundle (a receipt id the attestation names but
 *   the bundle lacks — a dangling reference — refuses here, never at replay);
 * - the **authority policy** (`ConsumerPolicyRegistry.ts`) decides *which
 *   profile each governed consumer requires*, and its profile id is copied
 *   verbatim into the use — a kernel-minted consumer the policy does not
 *   govern, and a governed consumer no attestation names, both refuse here;
 * - the **closed profile registry** decides whether that profile resolves in
 *   this build, and each minted use's receipt must resolve under it before the
 *   envelope is serialized, so an export never writes a use its own replay
 *   loader would refuse to bind.
 */
export function composeGovernedEvidenceReceiptSnapshot(
  readout: GovernedEvidenceProducerReadoutV1,
): GovernedEvidenceReceiptSnapshotV1 {
  if (!readout.datasetFingerprint || !readout.kernelVersion) {
    throw new Error('[AtlasCore] Governed evidence capture cannot establish live kernel identity');
  }
  if (!readout.rawBundle) {
    throw new Error('[AtlasCore] Rust statistics evidence receipts unavailable for current dataset');
  }

  const bundle = parseEvidenceReceiptBundleV1(readout.rawBundle);
  if (
    bundle.datasetFingerprint !== readout.datasetFingerprint ||
    bundle.kernelVersion !== readout.kernelVersion
  ) {
    throw new Error(
      '[AtlasCore] Governed evidence capture bundle identity drift: ' +
        `bundle=${bundle.datasetFingerprint}@${bundle.kernelVersion}, ` +
        `kernel=${readout.datasetFingerprint}@${readout.kernelVersion}`,
    );
  }

  const attestation = parseGovernedConsumerAttestationV1(readout.governedConsumers);
  if (
    attestation.datasetFingerprint !== bundle.datasetFingerprint ||
    attestation.kernelVersion !== bundle.kernelVersion
  ) {
    throw new Error(
      '[AtlasCore] Governed evidence capture consumer-attestation identity drift: ' +
        `attestation=${attestation.datasetFingerprint}@${attestation.kernelVersion}, ` +
        `bundle=${bundle.datasetFingerprint}@${bundle.kernelVersion}`,
    );
  }

  // The authority snapshot is read once, as the loader does: the same policy
  // decides what export may mint and what replay will bind, so a registry
  // change moves both sides together instead of the export minting uses
  // against a policy the loader no longer holds.
  const policy = governedConsumerPolicyV1();
  const receiptsById = new Map(bundle.receipts.map((receipt) => [receipt.receiptId, receipt]));
  const uses: PersistedEvidenceUseV1[] = [];
  for (const consumer of attestation.consumers) {
    const requiredProfileId = policy.get(consumer.consumerId);
    if (requiredProfileId === undefined) {
      throw new Error(
        `[AtlasCore] Governed evidence capture attests consumer '${consumer.consumerId}' that the authority-owned policy does not govern`
      );
    }
    if (consumer.receiptIds.length === 0) {
      throw new Error(
        `[AtlasCore] Governed evidence capture attests consumer '${consumer.consumerId}' over no receipts; a governed use must name one`
      );
    }
    const profile = evidenceRequirementProfileByIdV1(requiredProfileId);
    if (profile === null) {
      throw new Error(
        `[AtlasCore] Governed evidence capture would mint a use under profile '${requiredProfileId}' that this build does not resolve`
      );
    }
    for (const receiptId of consumer.receiptIds) {
      const receipt = receiptsById.get(receiptId) ?? null;
      if (receipt === null) {
        throw new Error(
          `[AtlasCore] Governed evidence capture attests receipt '${receiptId}' absent from the bundle`
        );
      }
      if (
        evaluateEvidenceReceiptAgainstProfileV1(profile, receiptId, receipt).status !== 'RESOLVED'
      ) {
        throw new Error(
          `[AtlasCore] Governed evidence capture would mint a use whose receipt does not resolve under '${requiredProfileId}'`
        );
      }
      uses.push({
        consumerId: consumer.consumerId,
        receiptId,
        requirementProfileId: requiredProfileId,
      });
    }
  }
  for (const consumerId of policy.keys()) {
    if (!attestation.consumers.some((consumer) => consumer.consumerId === consumerId)) {
      throw new Error(
        `[AtlasCore] Governed evidence capture attests no receipts for governed consumer '${consumerId}'; the replay loader would refuse the envelope with MISSING_USE`
      );
    }
  }

  const envelope = parsePersistedEvidenceReceiptsV1({
    schemaVersion: '1',
    bundle,
    uses,
  });
  const bytes = new TextEncoder().encode(canonicalJsonStringify(envelope));
  return Object.freeze({ bytes, envelope });
}
