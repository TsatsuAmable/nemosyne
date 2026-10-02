/**
 * RFC 0009 tranche 3 (F1) fixtures: a real governed package, built here rather
 * than inline, because more than one falsifier needs one and a fixture that
 * drifts between them would let each suite test a different archive shape.
 *
 * Everything here is derived from the replay path's own reconstruction — the
 * fingerprint and kernel a package must commit to in order to reach step 4 are
 * read out of a probe refusal, never hardcoded. A hardcoded identity would rot
 * silently the moment the kernel changed, and every step-3 assertion built on
 * it would degrade into a test of an unreachable branch.
 */
import {
  GOVERNED_NEMOSYNE_PACKAGE_FORMAT_VERSION,
  NEMOSYNE_PACKAGE_FORMAT_VERSION,
  NemosynePackageManager,
  type NemosynePackagePayload,
} from '../../src/session/NemosynePackage.ts';
import { InvestigationReplayRunner } from '../../src/session/InvestigationReplayRunner.ts';
import {
  GOVERNED_INVESTIGATION_DIGEST_ALGORITHM,
  INVESTIGATION_DIGEST_ALGORITHM,
} from '../../src/investigation/index.ts';
import { CANONICAL_DATASET_IDENTITY_ALGORITHM } from '../../src/data/DatasetIdentity.ts';
import { Dataset } from '../../src/data/Dataset.ts';
import { sha256Hex } from '../../src/security/CryptoHash.ts';
import { DESCRIPTIVE_STATISTICS_CONSUMER_ID_V1 } from '../../src/data/evidence/GovernedConsumerAttestation.ts';
import { DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1 } from '../../src/data/evidence/EvidenceRequirementProfile.ts';
import { makeKernelMockBridge } from './kernelMock.ts';

/** Deliberately not the fingerprint this build reconstructs — see falsifier 3. */
export const UNREPRODUCIBLE_FINGERPRINT = 'a'.repeat(64);
export const DECLARED_KERNEL = 'f1-kernel-1.0.0';
/** A syntactically valid placeholder; no fixture verifies against it. */
export const DIGEST = 'b'.repeat(64);

export const FIXTURE_DATASET = {
  name: 'f1-dataset',
  columns: [{ name: 'x', type: 'NUMERIC' as const }],
  rows: [{ x: 1 }, { x: 2 }],
} as const;

export const FIXTURE_DATASET_BYTES = new TextEncoder().encode(JSON.stringify(FIXTURE_DATASET));

/**
 * The canonical *dataset* identity, which is a different commitment from the
 * analytical fingerprint the envelope's bundle carries. The real V3 exporter
 * sets exactly this pair (`NemosyneSession.exportPortableSnapshot`), and an
 * earlier draft put the analytical value in both fields — a manifest no exporter
 * can produce, which masked a standing `Dataset fingerprint mismatch`
 * discrepancy behind every fixture built on it.
 */
export const FIXTURE_DATASET_FINGERPRINT = Dataset.fromJSON(FIXTURE_DATASET).fingerprint;

export interface PersistedUse {
  consumerId: string;
  receiptId: string;
  requirementProfileId: string;
}

export interface FixtureIdentity {
  analyticalFingerprint: string;
  kernelVersion: string;
}

export const DEFAULT_IDENTITY: FixtureIdentity = {
  analyticalFingerprint: UNREPRODUCIBLE_FINGERPRINT,
  kernelVersion: DECLARED_KERNEL,
};

export function runner(): InvestigationReplayRunner {
  return new InvestigationReplayRunner(makeKernelMockBridge());
}

/**
 * The receipt id the Rust statistics producer mints for the fixture dataset's
 * first numeric column (receipt_id == claim_id, per-claim receipts).
 */
export const FIXTURE_RECEIPT_ID = 'descriptive:x';

/**
 * A Rust-shaped standalone receipt, mirroring `wasm/src/data/statistics_evidence.rs`
 * for a `descriptive:<column>` numeric claim: no established measurement
 * context, empty assumptions, no uncertainty/stability/geometry, and
 * method provenance that agrees with the bundle identity (the structural parse
 * refuses a receipt whose provenance disagrees with its bundle).
 */
export function fixtureReceipt(identity: FixtureIdentity): Record<string, unknown> {
  return {
    receiptId: FIXTURE_RECEIPT_ID,
    claimId: FIXTURE_RECEIPT_ID,
    estimand: 'descriptive finite-value summary for column x',
    measurementContext: { status: 'NOT_ESTABLISHED' },
    geometry: null,
    assumptions: [],
    sampleSupport: {
      totalRows: 2,
      rowsUsed: 2,
      rowsExcluded: 0,
      columns: ['x'],
      policy: 'fullDataset',
      exclusionReasons: [],
    },
    uncertainty: null,
    stability: null,
    sensitivity: [],
    limitations: ['descriptive summary only; no population uncertainty has been estimated'],
    methodProvenance: {
      method: 'descriptive/finite-numeric',
      methodVersion: 'statistics-v1',
      kernelVersion: identity.kernelVersion,
      datasetFingerprint: identity.analyticalFingerprint,
      parameters: [],
    },
  };
}

/** The one conforming use the governed producer mints under the current policy. */
export function defaultGovernedUse(): PersistedUse {
  return {
    consumerId: DESCRIPTIVE_STATISTICS_CONSUMER_ID_V1,
    receiptId: FIXTURE_RECEIPT_ID,
    requirementProfileId: DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1.profileId,
  };
}

/**
 * A structurally valid closed v1 envelope. The bundle carries the Rust-shaped
 * fixture receipt so the falsifiers can exercise real binding (identity
 * agreement plus receipt evaluation) against the live authority policy, while
 * staying independent of the Rust binary so they run in the non-wasm suite.
 */
export function governedEnvelope(
  uses: readonly PersistedUse[],
  identity: FixtureIdentity,
): { bytes: Uint8Array } {
  const envelope = {
    schemaVersion: '1',
    bundle: {
      schemaVersion: '1',
      datasetFingerprint: identity.analyticalFingerprint,
      kernelVersion: identity.kernelVersion,
      receipts: [fixtureReceipt(identity)],
    },
    uses,
  };
  return { bytes: new TextEncoder().encode(JSON.stringify(envelope)) };
}

/**
 * Build a V3 payload directly, without `pack`/`unpack`. `replayPayload` is a
 * public entry point, so the loader must be safe against a payload that never
 * passed through transport validation — that is one of the properties under
 * falsification.
 *
 * `uses` defaults to the conforming use the governed producer mints under the
 * current policy; an empty `uses` array is a deliberate refusal case now (the
 * descriptive consumer is governed, so emptiness refuses MISSING_USE) and must
 * be requested explicitly. `evidenceReceiptDigest` is always computed over the
 * bytes actually handed over. An earlier draft pinned it to a *different*
 * envelope's bytes, which made the malformed-envelope case pass via the digest
 * check instead of the structural parse it was supposed to isolate. Digest
 * mismatches are requested explicitly through `manifestOverrides`.
 */
export function governedPayload(options: {
  uses?: readonly PersistedUse[];
  bytes?: Uint8Array;
  identity?: FixtureIdentity;
  manifestOverrides?: Record<string, unknown>;
} = {}): NemosynePackagePayload {
  const identity = options.identity ?? DEFAULT_IDENTITY;
  const receiptBytes =
    options.bytes ?? governedEnvelope(options.uses ?? [defaultGovernedUse()], identity).bytes;
  // This manifest is deliberately narrower than `exportPortableSnapshot`'s: it
  // omits `researchContext`, `evidenceSummary`, `discoveryCount`,
  // `nilOutcomeCount` and simplifies `environment`. Every omission is inert for
  // these falsifiers — canonical serialization drops undefined-valued keys, and
  // a fully exporter-shaped manifest (all five added, with nulled environment
  // fields) reaches the same pinned digest — but it does mean the
  // `evidenceSummary` count checks and the `researchContext` digest branch are
  // exercised elsewhere, not here.
  return {
    manifest: {
      formatVersion: GOVERNED_NEMOSYNE_PACKAGE_FORMAT_VERSION,
      sessionId: 'f1-session',
      datasetFingerprint: FIXTURE_DATASET_FINGERPRINT,
      datasetIdentityAlgorithm: CANONICAL_DATASET_IDENTITY_ALGORITHM,
      analyticalDatasetFingerprint: identity.analyticalFingerprint,
      analyticalKernelVersion: identity.kernelVersion,
      datasetName: FIXTURE_DATASET.name,
      kernelVersion: identity.kernelVersion,
      createdAt: 0,
      commandCount: 0,
      investigationDigestAlgorithm: GOVERNED_INVESTIGATION_DIGEST_ALGORITHM,
      investigationDigest: DIGEST,
      evidenceReceiptDigest: sha256Hex(receiptBytes),
      environment: {},
      ...options.manifestOverrides,
    } as NemosynePackagePayload['manifest'],
    datasetBytes: FIXTURE_DATASET_BYTES,
    commandLogBytes: new TextEncoder().encode('[]'),
    evidenceReceiptBytes: receiptBytes,
  };
}

/** Pack a governed payload into a real archive, so `pack`'s own contract applies. */
export function governedArchive(
  identity: FixtureIdentity,
  digest: string,
  uses: readonly PersistedUse[] = [defaultGovernedUse()],
): Uint8Array {
  const payload = governedPayload({
    identity,
    uses,
    manifestOverrides: { investigationDigest: digest },
  });
  return NemosynePackageManager.pack({
    manifest: payload.manifest,
    datasetBytes: payload.datasetBytes,
    commandLogBytes: payload.commandLogBytes,
    evidenceReceiptBytes: payload.evidenceReceiptBytes,
  });
}

/**
 * The same semantic state under a format-v2 declaration. `evidenceReceiptBytes`
 * is a V3-only digest input, so this is the contrast that proves the V3
 * composition is not the V2 one.
 */
export function v2Archive(digest: string, kernelVersion: string): Uint8Array {
  return NemosynePackageManager.pack({
    manifest: {
      formatVersion: NEMOSYNE_PACKAGE_FORMAT_VERSION,
      sessionId: 'f1-session',
      datasetFingerprint: FIXTURE_DATASET_FINGERPRINT,
      datasetIdentityAlgorithm: CANONICAL_DATASET_IDENTITY_ALGORITHM,
      datasetName: FIXTURE_DATASET.name,
      kernelVersion,
      createdAt: 0,
      commandCount: 0,
      investigationDigestAlgorithm: INVESTIGATION_DIGEST_ALGORITHM,
      investigationDigest: digest,
      environment: {},
    } as NemosynePackagePayload['manifest'],
    datasetBytes: FIXTURE_DATASET_BYTES,
    commandLogBytes: new TextEncoder().encode('[]'),
  });
}

/**
 * The analytical fingerprint this build's replay path actually reconstructs for
 * the fixture dataset, read out of a probe refusal rather than hardcoded.
 *
 * If the reconstruction ever stops diverging from the declared identity, the
 * probe stops matching and this throws — so a step-3 falsifier cannot quietly
 * degrade into a test of an unreachable branch.
 */
export async function reconstructedAnalyticalFingerprint(): Promise<string> {
  const probe = await runner().replayPayload(governedPayload());
  const match = /replay reconstructed '([^']+)'/.exec(probe.discrepancies.join(' '));
  if (!match) {
    throw new Error(
      'F1 fixture could not derive the reconstructed analytical fingerprint; ' +
        `probe discrepancies were ${JSON.stringify(probe.discrepancies)}`,
    );
  }
  return match[1];
}

/** Counterpart of the above for the kernel, read out of the same probe refusal. */
export async function replayedKernelVersion(): Promise<string> {
  const probe = await runner().replayPayload(
    governedPayload({
      identity: {
        analyticalFingerprint: await reconstructedAnalyticalFingerprint(),
        kernelVersion: 'f1-probe-kernel-that-never-ran',
      },
    }),
  );
  const match = /replay kernel is '([^']+)'/.exec(probe.discrepancies.join(' '));
  if (!match) {
    throw new Error(
      'F1 fixture could not derive the replay kernel version; ' +
        `probe discrepancies were ${JSON.stringify(probe.discrepancies)}`,
    );
  }
  return match[1];
}

/**
 * The identity under which a package reproduces: the fingerprint and kernel the
 * replay path actually reconstructs. A governing package commits to exactly
 * these, so a fixture that wants to reach step 4 has to use them.
 */
export async function reproducibleIdentity(): Promise<FixtureIdentity> {
  return {
    analyticalFingerprint: await reconstructedAnalyticalFingerprint(),
    kernelVersion: await replayedKernelVersion(),
  };
}
