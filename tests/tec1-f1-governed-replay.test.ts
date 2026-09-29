/**
 * RFC 0009 tranche 3 (F1) falsifying evidence: governed replay loader and its
 * typed evidence attestation.
 *
 * These are written against the *properties* F1 claims, not against the
 * implementation. Each one fails on the pre-F1 code for a reason that is the
 * point of the tranche, and fails again if the property regresses.
 *
 * Scope note: F1 may claim integrity and preservation only. Nothing here may be
 * read as evidence of governance, consumer enforcement, or TEC1 closure — the
 * fixtures deliberately use an envelope with no receipts and no usable consumer
 * registry, because none exists in this build.
 */
import { describe, expect, it } from 'vitest';
import {
  GOVERNED_NEMOSYNE_PACKAGE_FORMAT_VERSION,
  NEMOSYNE_PACKAGE_FORMAT_VERSION,
  NemosynePackageManager,
  type NemosynePackagePayload,
} from '../src/session/NemosynePackage.ts';
import { InvestigationReplayRunner } from '../src/session/InvestigationReplayRunner.ts';
import {
  GOVERNED_INVESTIGATION_DIGEST_ALGORITHM,
  INVESTIGATION_DIGEST_ALGORITHM,
} from '../src/investigation/index.ts';
import { CANONICAL_DATASET_IDENTITY_ALGORITHM } from '../src/data/DatasetIdentity.ts';
import { DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1 } from '../src/data/evidence/EvidenceRequirementProfile.ts';
import { sha256Hex } from '../src/security/CryptoHash.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';

/** Deliberately not the fingerprint this build reconstructs — see falsifier 3. */
const UNREPRODUCIBLE_FINGERPRINT = 'a'.repeat(64);
const DECLARED_KERNEL = 'f1-kernel-1.0.0';
const DIGEST = 'b'.repeat(64);

interface PersistedUse {
  consumerId: string;
  receiptId: string;
  requirementProfileId: string;
}

interface FixtureIdentity {
  analyticalFingerprint: string;
  kernelVersion: string;
}

const DEFAULT_IDENTITY: FixtureIdentity = {
  analyticalFingerprint: UNREPRODUCIBLE_FINGERPRINT,
  kernelVersion: DECLARED_KERNEL,
};

/**
 * A structurally valid closed v1 envelope. `receipts: []` is deliberate: it is
 * the only envelope shape this build can mint, and it keeps these falsifiers
 * independent of the Rust producer so they can run in the non-wasm suite.
 */
function governedEnvelope(
  uses: readonly PersistedUse[],
  identity: FixtureIdentity,
): { bytes: Uint8Array } {
  const envelope = {
    schemaVersion: '1',
    bundle: {
      schemaVersion: '1',
      datasetFingerprint: identity.analyticalFingerprint,
      kernelVersion: identity.kernelVersion,
      receipts: [],
    },
    uses,
  };
  return { bytes: new TextEncoder().encode(JSON.stringify(envelope)) };
}

/**
 * Build a V3 payload directly, without `pack`/`unpack`. `replayPayload` is a
 * public entry point, so the loader must be safe against a payload that never
 * passed through transport validation — that is one of the properties under
 * falsification here.
 *
 * `evidenceReceiptDigest` is always computed over the bytes actually handed
 * over. An earlier draft pinned it to a *different* envelope's bytes, which made
 * the malformed-envelope case pass via the digest check instead of the
 * structural parse it was supposed to isolate. Digest mismatches are now
 * requested explicitly through `manifestOverrides`.
 */
function governedPayload(options: {
  uses?: readonly PersistedUse[];
  bytes?: Uint8Array;
  identity?: FixtureIdentity;
  manifestOverrides?: Record<string, unknown>;
} = {}): NemosynePackagePayload {
  const identity = options.identity ?? DEFAULT_IDENTITY;
  const receiptBytes =
    options.bytes ?? governedEnvelope(options.uses ?? [], identity).bytes;
  const dataset = {
    name: 'f1-dataset',
    columns: [{ name: 'x', type: 'NUMERIC' as const }],
    rows: [{ x: 1 }, { x: 2 }],
  };
  return {
    manifest: {
      formatVersion: GOVERNED_NEMOSYNE_PACKAGE_FORMAT_VERSION,
      sessionId: 'f1-session',
      datasetFingerprint: identity.analyticalFingerprint,
      datasetIdentityAlgorithm: CANONICAL_DATASET_IDENTITY_ALGORITHM,
      analyticalDatasetFingerprint: identity.analyticalFingerprint,
      analyticalKernelVersion: identity.kernelVersion,
      datasetName: dataset.name,
      kernelVersion: identity.kernelVersion,
      createdAt: 0,
      commandCount: 0,
      investigationDigestAlgorithm: GOVERNED_INVESTIGATION_DIGEST_ALGORITHM,
      investigationDigest: DIGEST,
      evidenceReceiptDigest: sha256Hex(receiptBytes),
      environment: {},
      ...options.manifestOverrides,
    } as NemosynePackagePayload['manifest'],
    datasetBytes: new TextEncoder().encode(JSON.stringify(dataset)),
    commandLogBytes: new TextEncoder().encode('[]'),
    evidenceReceiptBytes: receiptBytes,
  };
}

function runner(): InvestigationReplayRunner {
  return new InvestigationReplayRunner(makeKernelMockBridge());
}

/**
 * The analytical fingerprint this build's replay path actually reconstructs for
 * the fixture dataset, read out of a probe refusal rather than hardcoded.
 *
 * If the reconstruction ever stops diverging from the declared identity, the
 * probe stops matching and this throws — so the step-3 kernel falsifier below
 * cannot quietly degrade into a test of an unreachable branch.
 */
async function reconstructedAnalyticalFingerprint(): Promise<string> {
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

describe('F1 falsifier 2: version/algorithm cross-product dispatch', () => {
  it('refuses a V3 declaration that does not carry the governed digest algorithm', async () => {
    const payload = governedPayload({
      manifestOverrides: { investigationDigestAlgorithm: INVESTIGATION_DIGEST_ALGORITHM },
    });
    const result = await runner().replayPayload(payload);

    expect(result.success).toBe(false);
    // The envelope is present but its governed replay integrity was never
    // established — this must not read as "no envelope exists".
    expect(result.evidence).toEqual({ envelope: 'present', integrity: 'not-established' });
  });

  it('does not let a V3 package reach governed replay through a V2 algorithm label', async () => {
    const payload = governedPayload({
      manifestOverrides: {
        formatVersion: NEMOSYNE_PACKAGE_FORMAT_VERSION,
        investigationDigestAlgorithm: GOVERNED_INVESTIGATION_DIGEST_ALGORITHM,
      },
    });
    const result = await runner().replayPayload(payload);

    expect(result.success).toBe(false);
    // A V2 declaration carries no governed envelope at all.
    expect(result.evidence).toEqual({ envelope: 'absent' });
  });

  it('refuses an unrecognised format version without claiming an envelope', async () => {
    const payload = governedPayload({ manifestOverrides: { formatVersion: 99 } });
    const result = await runner().replayPayload(payload);

    expect(result.success).toBe(false);
    expect(result.evidence).toEqual({ envelope: 'absent' });
  });
});

describe('F1 falsifier 1: the loader re-runs RFC 0009 steps 1-2 itself', () => {
  it('refuses receipt entry bytes that do not match the declared digest', async () => {
    const original = governedEnvelope([], DEFAULT_IDENTITY).bytes;
    // Tamper with the entry while still declaring the *original* digest: this is
    // a payload that could have reached the loader without transport validation.
    const tampered = new Uint8Array(original);
    tampered[0] = original[0] === 0x7b ? 0x5b : 0x7b;
    const payload = governedPayload({
      bytes: tampered,
      manifestOverrides: { evidenceReceiptDigest: sha256Hex(original) },
    });

    const result = await runner().replayPayload(payload);

    expect(result.success).toBe(false);
    expect(result.evidence).toEqual({ envelope: 'present', integrity: 'not-established' });
    expect(result.discrepancies.join(' ')).toMatch(/integrity failure/i);
  });

  it('refuses a V3 package whose reserved evidence entry is missing', async () => {
    const payload = governedPayload();
    delete (payload as { evidenceReceiptBytes?: Uint8Array }).evidenceReceiptBytes;

    const result = await runner().replayPayload(payload);

    expect(result.success).toBe(false);
    expect(result.evidence).toEqual({ envelope: 'present', integrity: 'not-established' });
  });

  it('refuses a structurally invalid envelope even when its byte digest matches', async () => {
    // The digest is computed over these exact malformed bytes, so the digest
    // check passes and closed structural parsing is the only thing that can
    // catch this. If parsing were permissive, this test would reach step 3.
    const malformed = new TextEncoder().encode(
      JSON.stringify({ schemaVersion: '1', bundle: {}, uses: [] }),
    );
    const payload = governedPayload({ bytes: malformed });

    const result = await runner().replayPayload(payload);

    expect(result.success).toBe(false);
    expect(result.evidence).toEqual({ envelope: 'present', integrity: 'not-established' });
  });
});

describe('F1 falsifier 3: bundle identity is checked against the reconstruction', () => {
  it('refuses a bundle whose dataset identity the replay does not reproduce', async () => {
    const result = await runner().replayPayload(governedPayload());

    expect(result.success).toBe(false);
    // The envelope is intact and fully verified — the refusal is that the
    // restored dataset is not the committed one. Collapsing this into
    // `not-established` would blame the archive's bytes for a reconstruction
    // disagreement, which is a different remediation.
    expect(result.evidence).toEqual({
      envelope: 'present',
      integrity: 'verified',
      enforcement: 'none',
      refusal: { code: 'DATASET_MISMATCH' },
    });
  });

  it('refuses a bundle whose kernel identity the replay does not reproduce', async () => {
    const reconstructed = await reconstructedAnalyticalFingerprint();
    const payload = governedPayload({
      identity: {
        // Match the reconstruction so the dataset check passes and the kernel
        // comparison at step 3 is actually reached.
        analyticalFingerprint: reconstructed,
        kernelVersion: 'f1-kernel-that-never-ran',
      },
    });

    const result = await runner().replayPayload(payload);

    expect(result.success).toBe(false);
    expect(result.evidence).toEqual({
      envelope: 'present',
      integrity: 'verified',
      enforcement: 'none',
      refusal: { code: 'KERNEL_MISMATCH' },
    });
  });
});

describe('F1 falsifier 4a: non-empty uses are typed unavailable, not corruption', () => {
  function nonEmptyUsesPayload(): NemosynePackagePayload {
    return governedPayload({
      uses: [
        {
          consumerId: 'fixture:inspected-claim',
          receiptId: 'receipt-1',
          requirementProfileId: DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1.profileId,
        },
      ],
    });
  }

  it('refuses a claimed consumer use this build cannot govern', async () => {
    const result = await runner().replayPayload(nonEmptyUsesPayload());

    expect(result.success).toBe(false);
    expect(result.evidence).toEqual({
      envelope: 'present',
      integrity: 'verified',
      enforcement: 'none',
      refusal: { code: 'uses-not-governable-by-this-build' },
    });
  });

  it('keeps the refusal distinguishable from a corrupt package', async () => {
    const result = await runner().replayPayload(nonEmptyUsesPayload());

    // A build-capability limit is not an archive defect. Reporting it through
    // `discrepancies` would make it indistinguishable from malformed input and
    // would hide the day consumer binding lands and this archive becomes
    // openable without anyone re-examining the classification.
    expect(result.discrepancies).toEqual([]);
  });

  it('resolves the uses refusal before it can be mistaken for an identity refusal', async () => {
    // The fixture identity is unreproducible, so step 3 would also refuse. A use
    // this build cannot govern must win: the archive is never even opened far
    // enough to compare identities against it.
    const result = await runner().replayPayload(nonEmptyUsesPayload());

    expect(result.evidence).toMatchObject({
      refusal: { code: 'uses-not-governable-by-this-build' },
    });
  });
});

describe('F1: an empty uses array is preserved, never read as enforcement', () => {
  it('never raises the uses refusal when there are no uses to govern', async () => {
    const result = await runner().replayPayload(governedPayload({ uses: [] }));

    expect(result.evidence.envelope).toBe('present');
    if (result.evidence.envelope === 'present' && result.evidence.integrity === 'verified') {
      // Preservation only: this build enforces nothing, and the *capability*
      // refusal is reserved for archives that actually claim a use.
      expect(result.evidence.enforcement).toBe('none');
      expect(result.evidence.refusal?.code).not.toBe('uses-not-governable-by-this-build');
    }
  });

  it('does not let a bare success flag stand in for an attestation', async () => {
    const result = await runner().replayPayload(governedPayload({ uses: [] }));

    // The property F1 exists to establish: the result always carries a typed
    // attestation, so no caller can infer governed standing from `success`.
    expect(result).toHaveProperty('evidence');
    expect(['absent', 'present']).toContain(result.evidence.envelope);
  });
});

describe('F1 falsifier 11: historical V2 routing is keyed on the declared algorithm', () => {
  // The semantic path is observable through its own validation: only the
  // semantic branch compares the persisted command count against the log. Using
  // that as the probe keeps this falsifier free of any digest reproduction, so
  // it pins the *routing decision* rather than a package's ability to verify.
  it('routes an unlabeled historical V2 package through the legacy contract', async () => {
    const payload = governedPayload({
      manifestOverrides: {
        formatVersion: NEMOSYNE_PACKAGE_FORMAT_VERSION,
        investigationDigestAlgorithm: undefined,
        commandCount: 99,
      },
    });
    const result = await runner().replayPayload(payload);

    // Pre-RF-046 packages carry no algorithm label and were digested with the
    // legacy schema-v1 contract. Routing them semantically breaks every
    // historical package that still opens — which is exactly what happened while
    // fixing the V3 downgrade, and this is the guard against repeating it.
    expect(result.discrepancies.join(' ')).not.toMatch(/Semantic-v2 command count mismatch/);
  });

  it('routes a labelled V2 package through the semantic contract', async () => {
    const payload = governedPayload({
      manifestOverrides: {
        formatVersion: NEMOSYNE_PACKAGE_FORMAT_VERSION,
        investigationDigestAlgorithm: INVESTIGATION_DIGEST_ALGORITHM,
        commandCount: 99,
      },
    });
    const result = await runner().replayPayload(payload);

    expect(result.discrepancies.join(' ')).toMatch(/Semantic-v2 command count mismatch/);
  });
});

describe('F1: receipt entry obeys the archive decompression budget', () => {
  it('rejects a pack whose receipt entry exceeds the total uncompressed budget', () => {
    const bytes = governedEnvelope([], DEFAULT_IDENTITY).bytes;
    const dataset = {
      name: 'f1-budget',
      columns: [{ name: 'x', type: 'NUMERIC' as const }],
      rows: [{ x: 1 }],
    };
    const archive = NemosynePackageManager.pack({
      manifest: {
        formatVersion: GOVERNED_NEMOSYNE_PACKAGE_FORMAT_VERSION,
        sessionId: 'f1-budget',
        datasetFingerprint: DEFAULT_IDENTITY.analyticalFingerprint,
        datasetIdentityAlgorithm: CANONICAL_DATASET_IDENTITY_ALGORITHM,
        analyticalDatasetFingerprint: DEFAULT_IDENTITY.analyticalFingerprint,
        analyticalKernelVersion: DEFAULT_IDENTITY.kernelVersion,
        datasetName: dataset.name,
        kernelVersion: DEFAULT_IDENTITY.kernelVersion,
        createdAt: 0,
        commandCount: 0,
        investigationDigestAlgorithm: GOVERNED_INVESTIGATION_DIGEST_ALGORITHM,
        investigationDigest: DIGEST,
        evidenceReceiptDigest: sha256Hex(bytes),
        environment: {},
      },
      datasetBytes: new TextEncoder().encode(JSON.stringify(dataset)),
      commandLogBytes: new TextEncoder().encode('[]'),
      evidenceReceiptBytes: bytes,
    });

    // The reserved entry is not exempt from the existing budget. A limit below
    // the total payload must fail rather than let receipts bypass the bound.
    expect(() =>
      NemosynePackageManager.unpack(archive, { totalUncompressedBytes: 16 }),
    ).toThrow(/uncompressed size budget/i);
  });
});
