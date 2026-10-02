/**
 * RFC 0009 tranche 3 slice 2 — the mutated-registry falsifier.
 *
 * The property: the same committed governed bytes must refuse when the
 * authority-owned registry changes, with the code the change implies — the
 * bytes are replayed here twice against the same build, differing only in the
 * substituted policy, which is exactly the coupling RFC 0009 requires between a
 * producer's output and the authority that governs it. A producer that minted
 * uses under a policy this build no longer holds, or an authority that quietly
 * re-labelled the consumer's requirements, would make one of these runs pass.
 *
 * The registry is substituted (as in `tec1-consumer-policy-loader-decision.test.ts`)
 * because a registry mutation in the real module is itself the governance act
 * under review; the bytes are minted *under* an entry in the same run, so the
 * refusal is demonstrated on bytes a conforming producer could have written.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { composeGovernedEvidenceReceiptSnapshot } from '../src/atlas/MonetaEvidenceAuthority.ts';
import {
  DESCRIPTIVE_STATISTICS_CONSUMER_ID_V1,
} from '../src/data/evidence/GovernedConsumerAttestation.ts';
import {
  DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1,
} from '../src/data/evidence/EvidenceRequirementProfile.ts';
import {
  DEFAULT_IDENTITY,
  FIXTURE_RECEIPT_ID,
  fixtureReceipt,
  governedPayload,
  runner,
} from './helpers/f1GovernedArchive.ts';

const policy = vi.hoisted(() => ({ entries: new Map<string, string>() }));

vi.mock('../src/data/evidence/ConsumerPolicyRegistry.ts', () => ({
  governedConsumerPolicyV1: () => new Map(policy.entries),
}));

const ENTRY: readonly [string, string] = [
  DESCRIPTIVE_STATISTICS_CONSUMER_ID_V1,
  DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1.profileId,
];

beforeEach(() => {
  policy.entries.clear();
});

/** Mint the envelope bytes a conforming producer would write under the current policy. */
function mintGovernedBytes(): Uint8Array {
  return composeGovernedEvidenceReceiptSnapshot({
    rawBundle: {
      schemaVersion: '1',
      datasetFingerprint: DEFAULT_IDENTITY.analyticalFingerprint,
      kernelVersion: DEFAULT_IDENTITY.kernelVersion,
      receipts: [fixtureReceipt(DEFAULT_IDENTITY)],
    },
    datasetFingerprint: DEFAULT_IDENTITY.analyticalFingerprint,
    kernelVersion: DEFAULT_IDENTITY.kernelVersion,
    governedConsumers: {
      schemaVersion: '1',
      datasetFingerprint: DEFAULT_IDENTITY.analyticalFingerprint,
      kernelVersion: DEFAULT_IDENTITY.kernelVersion,
      consumers: [{ consumerId: DESCRIPTIVE_STATISTICS_CONSUMER_ID_V1, receiptIds: [FIXTURE_RECEIPT_ID] }],
    },
  }).bytes;
}

describe('TEC1 mutated-policy falsifier: same governed bytes, changed authority', () => {
  it('refuses with CONSUMER_NOT_GOVERNED when the registry stops governing the consumer', async () => {
    // Mint under the governing entry — sanity-check that minting really relied
    // on it — then replay the byte-identical payload with the entry gone.
    policy.entries.set(...ENTRY);
    const bytes = mintGovernedBytes();
    const payload = governedPayload({ bytes, manifestOverrides: {} });

    policy.entries.clear();
    const result = await runner().replayPayload(payload);

    // The minted use names a consumer this policy no longer governs, so the
    // binder refuses UNKNOWN_CONSUMER before any reconstruction — a policy
    // limit, not corrupt bytes.
    expect(result.success).toBe(false);
    expect(result.evidence).toMatchObject({
      envelope: 'present',
      integrity: 'verified',
      enforcement: 'none',
      refusal: { code: 'CONSUMER_NOT_GOVERNED' },
    });
    expect(result.discrepancies).toEqual([]);
  });

  it('refuses with CONSUMER_POLICY_REFUSED when the registry requires a different profile', async () => {
    // Mint under the governing entry, then replay the same bytes after the
    // authority re-labels what profile this consumer's uses must be recorded
    // under. The identities still agree on *which* consumer is governed — what
    // refuses is the recorded requirement profile, the other half of the pair.
    policy.entries.set(...ENTRY);
    const bytes = mintGovernedBytes();
    const payload = governedPayload({ bytes, manifestOverrides: {} });

    policy.entries.set(DESCRIPTIVE_STATISTICS_CONSUMER_ID_V1, 're-negotiated-profile/v1');
    const result = await runner().replayPayload(payload);

    expect(result.success).toBe(false);
    expect(result.evidence).toMatchObject({
      envelope: 'present',
      integrity: 'verified',
      enforcement: 'none',
      refusal: { code: 'CONSUMER_POLICY_REFUSED' },
    });
    expect(result.discrepancies).toEqual([]);
  });
});
