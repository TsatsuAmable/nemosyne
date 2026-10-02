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
 * fixtures exercise the loader's binding step through a Rust-shaped fixture
 * receipt (kept here, not live, so the falsifiers run without the Rust binary),
 * but the success path they pin is that a verifying run reports enforcement;
 * TEC1 closure is claimed by the production-path falsifiers on the wasm lane.
 */
import { describe, expect, it } from 'vitest';
import {
  NEMOSYNE_PACKAGE_FORMAT_VERSION,
  NemosynePackageManager,
  type NemosynePackagePayload,
} from '../src/session/NemosynePackage.ts';
import {
  type ReplayVerificationResult,
} from '../src/session/InvestigationReplayRunner.ts';
import {
  GOVERNED_INVESTIGATION_DIGEST_ALGORITHM,
  INVESTIGATION_DIGEST_ALGORITHM,
} from '../src/investigation/index.ts';
import { DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1 } from '../src/data/evidence/EvidenceRequirementProfile.ts';
import { governedConsumerPolicyV1 } from '../src/data/evidence/ConsumerPolicyRegistry.ts';
import { sha256Hex } from '../src/security/CryptoHash.ts';
import {
  DIGEST,
  FIXTURE_DATASET,
  FIXTURE_DATASET_FINGERPRINT,
  DEFAULT_IDENTITY,
  governedArchive,
  governedEnvelope,
  governedPayload,
  reconstructedAnalyticalFingerprint,
  reproducibleIdentity,
  runner,
  v2Archive,
} from './helpers/f1GovernedArchive.ts';

describe('F1 falsifier 2: version/algorithm cross-product dispatch', () => {
  it('refuses a V3 declaration that does not carry the governed digest algorithm', async () => {
    const payload = governedPayload({
      manifestOverrides: { investigationDigestAlgorithm: INVESTIGATION_DIGEST_ALGORITHM },
    });
    const result = await runner().replayPayload(payload);

    expect(result.success).toBe(false);
    // Step 1 refuses before the envelope is ever checked, so its integrity was
    // never established — but it *is* present, and this must not read as
    // "no envelope exists".
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
      refusal: { code: 'CONSUMER_NOT_GOVERNED' },
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
      refusal: { code: 'CONSUMER_NOT_GOVERNED' },
    });
  });
});

describe('F1: an empty uses array cannot bypass the governing policy', () => {
  it('refuses an empty uses array once a governed consumer exists', async () => {
    // Widened honestly from its slice-1 form, which asserted the opposite: with
    // no governed consumer, emptiness was preservation and success was reachable.
    // Since the first registry entry landed (RFC 0009 tranche 3 slice 2), the
    // descriptive consumer *is* governed, so an envelope with a receipt bundle
    // but zero uses leaves it unnamed — and per the RFC, emptiness cannot bypass
    // policy. The digest is pinned from a *conforming* probe (an empty-uses run
    // refuses before recomputing a digest), so this refusal is not merely the
    // first of several: on an unpinned digest step 4 would refuse
    // `not-established` and this line would green for an unrelated reason.
    const identity = await reproducibleIdentity();
    const probe = await runner().replayPayload(governedPayload({ identity }));
    const result = await runner().replayPayload(governedPayload({
      identity,
      uses: [],
      manifestOverrides: { investigationDigest: probe.investigationDigest },
    }));

    expect(result.success).toBe(false);
    expect(result.evidence).toEqual({
      envelope: 'present',
      integrity: 'verified',
      enforcement: 'none',
      refusal: { code: 'CONSUMER_NOT_GOVERNED' },
    });
    // Still a build-policy limit, not a corrupt package.
    expect(result.discrepancies).toEqual([]);
  });

  it('does not let a bare success flag stand in for an attestation', () => {
    // Type-level, because that is where the property lives: the attestation is a
    // *required* member. An optional one would let the whole build compile while
    // any consumer could ignore it, which is the absence-reads-as-legacy
    // encoding F1 exists to close.
    // @ts-expect-error `evidence` is required; omitting it must not compile.
    const withoutAttestation: ReplayVerificationResult = {
      success: true,
      sessionId: 'f1-session',
      datasetName: FIXTURE_DATASET.name,
      datasetFingerprint: FIXTURE_DATASET_FINGERPRINT,
      commandsReplayed: 0,
      eventsMatched: 0,
      provenanceEventsVerified: 0,
      representationProvenanceVerified: false,
      discoveryProvenanceVerified: 0,
      nilProvenanceVerified: 0,
      remediationEventsVerified: 0,
      refusalEventsVerified: 0,
      finalOutputHash: '',
      investigationDigest: '',
      evidenceCount: { observations: 0, findings: 0, annotations: 0 },
      discrepancies: [],
    };
    expect(withoutAttestation.success).toBe(true);
  });
});

describe('F1 falsifier 12: the governed happy path is reachable and commits the envelope', () => {
  it('replays a governed V3 archive against its recomputed investigation digest', async () => {
    const identity = await reproducibleIdentity();

    // Pass 1: a fixture cannot know the replay digest in advance, so read the
    // one the loader actually recomputed and pin it in, exactly as the producer
    // that minted the package would have. Without this pass the suite below
    // would only ever assert refusals, and a step-4 regression that made every
    // governed archive unopenable would leave all of them passing.
    const probe = await runner().replayArchive(governedArchive(identity, DIGEST));
    expect(probe.investigationDigest).toMatch(/^[0-9a-f]{64}$/);

    // Pass 2: nothing is left to disagree, so this must be a clean success.
    const result = await runner().replayArchive(
      governedArchive(identity, probe.investigationDigest),
    );

    expect(result.discrepancies).toEqual([]);
    expect(result.success).toBe(true);
    expect(result.evidence).toEqual({
      envelope: 'present',
      integrity: 'verified',
      enforcement: 'consumer-policy',
    });

    // Coupled to the registry on purpose. `enforcement: 'consumer-policy'` is a
    // claim about this run, and it is true only while the authority-owned
    // consumer policy actually governs the consumer the fixture's use names —
    // here the descriptive-statistics consumer at exactly the one entry slice 2
    // landed. It sits beside the literal it keeps honest, so a policy change
    // that un-governs that consumer (or a re-run on a build without any entry)
    // fails this line and sends the author back to the attestation union rather
    // than silently making an attestation that no longer describes the run.
    expect(governedConsumerPolicyV1().size).toBe(1);
  });

  it('commits the envelope bytes, so it is not the legacy digest composition', async () => {
    const identity = await reproducibleIdentity();
    const v3 = await runner().replayArchive(governedArchive(identity, DIGEST));
    const committed = v3.investigationDigest;

    // Identical semantic state and identical kernel, declared as v2. The only
    // digest input that differs is the evidence envelope, so a match here would
    // mean the V3 composition silently fell back to the v2 one — the archive
    // would then not be committed to its own receipts.
    const v2 = await runner().replayArchive(v2Archive(committed, identity.kernelVersion));

    expect(v2.discrepancies.join(' ')).toMatch(/Investigation digest mismatch/);

    // ...and the converse, so a single-direction mismatch cannot pass for an
    // unrelated reason (a differing kernel input, say). If the V3 arm ignored
    // the envelope bytes the two digests would be interchangeable and the
    // second assertion below would fail.
    expect(v2.investigationDigest).not.toBe(committed);
    const v3AgainstLegacyDigest = await runner().replayArchive(
      governedArchive(identity, v2.investigationDigest),
    );
    expect(v3AgainstLegacyDigest.discrepancies.join(' ')).toMatch(
      /Investigation digest mismatch/,
    );
    expect(v3AgainstLegacyDigest.evidence).toMatchObject({
      refusal: { code: 'INVESTIGATION_DIGEST_MISMATCH' },
    });
  });
});

describe('F1 falsifier 14: a governed package that commits to nothing cannot succeed', () => {
  // The identity must reproduce, and it is load-bearing: on the unreproducible
  // default identity step 1's guard never gets to run, because step 3 refuses
  // with `DATASET_MISMATCH` first. These cases then "pass" against the buggy
  // loader for a reason that has nothing to do with the digest — they would be
  // green before the fix. With a reproducing identity the run reaches the
  // missing-digest state, which is exactly the shape that returned `success:
  // true` before it.
  for (const digest of [undefined, null, '']) {
    it(`refuses a V3 payload whose investigationDigest is ${JSON.stringify(digest)}`, async () => {
      const result = await runner().replayPayload(
        governedPayload({
          identity: await reproducibleIdentity(),
          manifestOverrides: { investigationDigest: digest },
        }),
      );

      // `pack`/`unpack` require a 64-hex digest for V3, so an archive cannot
      // reach this state — but `replayPayload` is public and the contract makes
      // this loader the gate owner rather than transport. Without the dispatch
      // check the step-4 comparison is skipped entirely (`if
      // (manifest.investigationDigest && ...)`) and this returned `success:
      // true` with `not-established`: a V3 archive reporting success while
      // committing to nothing.
      expect(result.success).toBe(false);
      expect(result.evidence).toEqual({ envelope: 'present', integrity: 'not-established' });
    });
  }

  it('refuses a digest that is present but not a SHA-256 shape', async () => {
    // Presence is not well-formedness. Comparison can only ever disagree with a
    // malformed digest, so without a shape check this reports as a
    // reconstruction disagreement — telling the analyst their investigation was
    // substituted when the manifest is simply not valid V3 input.
    for (const digest of ['x', 'not-a-digest', 'A'.repeat(64)]) {
      const result = await runner().replayPayload(
        governedPayload({
          identity: await reproducibleIdentity(),
          manifestOverrides: { investigationDigest: digest },
        }),
      );

      expect(result.success).toBe(false);
      expect(result.evidence).toEqual({ envelope: 'present', integrity: 'not-established' });
      expect(result.discrepancies.join(' ')).toContain('lowercase SHA-256');
    }
  });

  it('never reports success for a V3 run whose commitment was not established', async () => {
    // The invariant the dispatch check restores, stated once so it holds for
    // every governed path rather than only the one case above.
    const identity = await reproducibleIdentity();
    const probe = await runner().replayPayload(governedPayload({ identity }));
    const governedPayloads = [
      governedPayload(),
      governedPayload({ uses: [] }),
      governedPayload({ manifestOverrides: { investigationDigest: '' } }),
      governedPayload({ manifestOverrides: { investigationDigestAlgorithm: INVESTIGATION_DIGEST_ALGORITHM } }),
      governedPayload({ manifestOverrides: { formatVersion: 99 } }),
      governedPayload({
        uses: [{ consumerId: 'c', receiptId: 'r', requirementProfileId: 'p' }],
      }),
      governedPayload({ identity }),
      // The one case that distinguishes this invariant from the buggy loader:
      // reproducing identity, so step 3 does not refuse first, and a falsy
      // digest, so the step-4 comparison is skipped. Pre-fix this returned
      // `success: true` and `succeeded` reached 2.
      governedPayload({ identity, manifestOverrides: { investigationDigest: '' } }),
      governedPayload({
        identity,
        manifestOverrides: { investigationDigest: probe.investigationDigest },
      }),
    ];

    let succeeded = 0;
    for (const payload of governedPayloads) {
      const result = await runner().replayPayload(payload);
      if (result.success) {
        succeeded += 1;
        expect(result.evidence).toEqual({
          envelope: 'present',
          integrity: 'verified',
          enforcement: 'consumer-policy',
        });
      }
    }

    // Without this the loop could pass by never taking its own branch, which is
    // the failure mode this whole falsifier exists to rule out — and it is a
    // real falsifier only while at least one listed payload reaches success
    // *after* another one was refused for the commitment being absent.
    expect(succeeded).toBe(1);
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
    const payload = governedPayload();
    const archive = NemosynePackageManager.pack({
      manifest: payload.manifest,
      datasetBytes: payload.datasetBytes,
      commandLogBytes: payload.commandLogBytes,
      evidenceReceiptBytes: payload.evidenceReceiptBytes,
    });

    // The reserved entry is not exempt from the existing budget. A limit below
    // the total payload must fail rather than let receipts bypass the bound.
    expect(() =>
      NemosynePackageManager.unpack(archive, { totalUncompressedBytes: 16 }),
    ).toThrow(/uncompressed size budget/i);
  });
});
