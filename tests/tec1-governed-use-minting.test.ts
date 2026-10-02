/**
 * RFC 0009 tranche 3 slice 2 — production-path falsifier for minted governed
 * uses (kernel-free half).
 *
 * The producer now exists. What this file falsifies is the *minting chain*:
 * a kernel-issued governing-consumer attestation arrives unparsed through the
 * capture readout, and `composeGovernedEvidenceReceiptSnapshot` — the only
 * authority over envelope composition — mints the persisted uses from it under
 * the authority-owned policy. Every refusal case here is a shape that would
 * otherwise produce an envelope this build's own replay loader refuses, or an
 * envelope whose uses no path authored.
 *
 * The final test runs the full loop on this file's fixtures: composition mints,
 * the bytes are committed the way the producing exporter commits them (same
 * canonical commitment over the same envelope bytes), and the real governed
 * loader replays them to an `enforcement: 'consumer-policy'` success. The Rust
 * kernel itself is exercised by the wasm-lane file
 * `tec1-governed-use-minting-live.test.ts`, which runs the same loop against a
 * live kernel export.
 */
import { describe, expect, it } from 'vitest';
import { composeGovernedEvidenceReceiptSnapshot } from '../src/atlas/MonetaEvidenceAuthority.ts';
import { parsePersistedEvidenceReceiptsV1 } from '../src/data/evidence/PersistedEvidenceReceipts.ts';
import { governedConsumerPolicyV1 } from '../src/data/evidence/ConsumerPolicyRegistry.ts';
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
  reproducibleIdentity,
  runner,
} from './helpers/f1GovernedArchive.ts';

const BUNDLE_IDENTITY = {
  datasetFingerprint: DEFAULT_IDENTITY.analyticalFingerprint,
  kernelVersion: DEFAULT_IDENTITY.kernelVersion,
};

function kernelBundle(identity = BUNDLE_IDENTITY): unknown {
  return {
    schemaVersion: '1',
    datasetFingerprint: identity.datasetFingerprint,
    kernelVersion: identity.kernelVersion,
    receipts: [
      fixtureReceipt({
        analyticalFingerprint: identity.datasetFingerprint,
        kernelVersion: identity.kernelVersion,
      }),
    ],
  };
}

/**
 * The attestation shape the kernel mints for a bundle whose receipts are exactly
 * the ones named — mirroring `wasm/src/data/governed_consumer.rs`: identity
 * copied from the bundle, one governed consumer per family claiming the receipts
 * it consumed. The kernel-minted form of this shape is pinned on the wasm lane.
 */
function kernelAttestation(consumers: readonly unknown[], identity = BUNDLE_IDENTITY): unknown {
  return {
    schemaVersion: '1',
    datasetFingerprint: identity.datasetFingerprint,
    kernelVersion: identity.kernelVersion,
    consumers,
  };
}

const GOVERNED_CONSUMER = { consumerId: DESCRIPTIVE_STATISTICS_CONSUMER_ID_V1, receiptIds: [FIXTURE_RECEIPT_ID] };

function compose(governedConsumers: unknown) {
  return composeGovernedEvidenceReceiptSnapshot({
    rawBundle: kernelBundle(),
    datasetFingerprint: BUNDLE_IDENTITY.datasetFingerprint,
    kernelVersion: BUNDLE_IDENTITY.kernelVersion,
    governedConsumers,
  });
}

describe('TEC1 governed-use minting: composition mints only what the kernel attested', () => {
  it('mints one use per kernel-attested receipt, under the authority-required profile', () => {
    const snapshot = compose(kernelAttestation([GOVERNED_CONSUMER]));

    const envelope = parsePersistedEvidenceReceiptsV1(
      JSON.parse(new TextDecoder().decode(snapshot.bytes))
    );
    expect(envelope.uses).toEqual([
      {
        consumerId: DESCRIPTIVE_STATISTICS_CONSUMER_ID_V1,
        receiptId: FIXTURE_RECEIPT_ID,
        requirementProfileId: DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1.profileId,
      },
    ]);
    // The profile a minted use carries is never a caller choice: it is the one
    // the live authority policy requires for this consumer, so a registry change
    // changes what the *next* export mints rather than what bytes it re-labels.
    expect(
      governedConsumerPolicyV1().get(DESCRIPTIVE_STATISTICS_CONSUMER_ID_V1),
    ).toBe(DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1.profileId);
  });

  it('refuses an attestation whose claimed receipt is absent from the bundle', () => {
    // The dangling-receipt refusal: identity agreement alone must not bind a use
    // against a receipt the envelope does not carry — the loader would refuse it
    // later on its unresolved resolution, but the producer must not write it.
    expect(() =>
      compose(kernelAttestation([{
        consumerId: DESCRIPTIVE_STATISTICS_CONSUMER_ID_V1,
        receiptIds: ['descriptive:missing'],
      }]))
    ).toThrow(/absent from the bundle/);
  });

  it('refuses an attested consumer this build does not govern', () => {
    // A kernel attesting a consumer the authority's policy does not govern makes
    // no uses for it: minting one would write an assertion no policy requires,
    // and the loader would refuse it as UNKNOWN_CONSUMER.
    expect(() =>
      compose(kernelAttestation([{
        consumerId: 'semantic-node:v99',
        receiptIds: [FIXTURE_RECEIPT_ID],
      }]))
    ).toThrow(/does not govern/);
  });

  it('refuses an attested consumer that claims no receipt', () => {
    // Emptiness in the attestation is not a zero-assertion consumer to serialize:
    // a use naming no receipt cannot bind, so composition refuses rather than
    // minting a dangling or empty shape.
    expect(() =>
      compose(kernelAttestation([{
        consumerId: DESCRIPTIVE_STATISTICS_CONSUMER_ID_V1,
        receiptIds: [],
      }]))
    // The attestation *parser* refuses an empty claim list before composition
    // ever sees it — fail-closed at both layers either way.
    ).toThrow(/must claim at least one receipt/);
  });

  it('refuses an attestation whose identity drifts from the bundle it describes', () => {
    // The same drift rule the bundle itself obeys: an attestation describing a
    // different analytical identity must never mint uses against this bundle.
    expect(() =>
      compose(kernelAttestation([GOVERNED_CONSUMER], {
        datasetFingerprint: 'f'.repeat(64),
        kernelVersion: BUNDLE_IDENTITY.kernelVersion,
      }))
    ).toThrow(/identity drift/);
  });

  it('refuses a kernel readout that attests no governed consumer', () => {
    // A bundle without receipts (or a kernel older than the slice, refused at
    // the port) leaves no governed consumer to authorize, so there is nothing
    // to mint: composition refuses instead of serializing the legacy empty-uses
    // shape — no envelope whose `uses` no path authored.
    expect(() => compose(kernelAttestation([]))).toThrow(/MISSING_USE/);
  });
});

describe('TEC1 governed-use minting: minted uses bind on the real loader', () => {
  it('replays minted bytes to a verified attestation with the consumer policy applied', async () => {
    const identity = await reproducibleIdentity();
    const bundleIdentity = {
      datasetFingerprint: identity.analyticalFingerprint,
      kernelVersion: identity.kernelVersion,
    };
    const snapshot = composeGovernedEvidenceReceiptSnapshot({
      rawBundle: kernelBundle(bundleIdentity),
      datasetFingerprint: bundleIdentity.datasetFingerprint,
      kernelVersion: bundleIdentity.kernelVersion,
      governedConsumers: kernelAttestation(
        [GOVERNED_CONSUMER],
        bundleIdentity,
      ),
    });

    // Pass 1: a fixture cannot know the replay digest in advance; read the one
    // this loader recomputes over exactly these minted bytes, as the producing
    // exporter would have committed.
    const probe = await runner().replayPayload(governedPayload({ bytes: snapshot.bytes, identity }));
    const digest = probe.investigationDigest;
    expect(digest).toMatch(/^[0-9a-f]{64}$/);

    // Pass 2: every use is BOUND and its receipt RESOLVED — the loader reached a
    // success and reports that the consumer policy was actually applied, not
    // bypassed. This is the minting chain's production-path property: whatever
    // the producer mints under this build's policy opens under the same policy.
    const result = await runner().replayPayload(
      governedPayload({
        bytes: snapshot.bytes,
        identity,
        manifestOverrides: { investigationDigest: digest },
      })
    );
    expect(result.success).toBe(true);
    expect(result.evidence).toEqual({
      envelope: 'present',
      integrity: 'verified',
      enforcement: 'consumer-policy',
    });
  });
});
