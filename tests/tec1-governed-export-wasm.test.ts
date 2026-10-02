import { beforeAll, describe, expect, it } from 'vitest';
import { strFromU8 } from 'fflate';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { NemosyneSession } from '../src/session/NemosyneSession.ts';
import { NemosynePackageManager } from '../src/session/NemosynePackage.ts';
import { parsePersistedEvidenceReceiptsV1 } from '../src/data/evidence/PersistedEvidenceReceipts.ts';
import { ColumnType, Dataset } from '../src/data/Dataset.ts';
import * as bridge from '../src/wasm/RuntimeBridge.ts';
import { sha256Hex } from '../src/security/CryptoHash.ts';

/**
 * Real-kernel falsifiers for RFC 0009 tranche 2 + slice 2: the governed V3
 * export path must mint its receipt bytes and its governing-consumer `uses`
 * from the live Rust production bridge, commit them into the closed v1
 * envelope, and refuse every identity incoherence instead of silently
 * downgrading to V2. Replay consumption of what is exported is pinned by the
 * tranche-3 production-path falsifiers.
 */
import {
  DESCRIPTIVE_STATISTICS_CONSUMER_ID_V1,
} from '../src/data/evidence/GovernedConsumerAttestation.ts';
import {
  DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1,
} from '../src/data/evidence/EvidenceRequirementProfile.ts';

function fixtureDataset(): Dataset {
  return new Dataset(
    'tec1-governed-export',
    [
      { name: 'x', type: ColumnType.NUMERIC },
      { name: 'y', type: ColumnType.NUMERIC },
    ],
    [{ x: 1, y: 2 }, { x: 2, y: 4 }, { x: null, y: 6 }]
  );
}

function driftDataset(): Dataset {
  return new Dataset(
    'tec1-governed-export-drifted',
    [{ name: 'x', type: ColumnType.NUMERIC }],
    [{ x: 42 }, { x: 43 }]
  );
}

function liveGovernedSession(dataset: Dataset = fixtureDataset()): { atlas: AtlasCore; handle: number; session: NemosyneSession } {
  const atlas = new AtlasCore({ kernel: bridge });
  atlas.loadDataset(dataset);
  const handle = atlas.aggregate.analytical.currentHandle;
  return { atlas, handle, session: new NemosyneSession({ atlas }) };
}

function evidenceEnvelopeOf(bytes: Uint8Array) {
  return parsePersistedEvidenceReceiptsV1(JSON.parse(strFromU8(bytes)));
}

describe('TEC1 governed V3 export (RFC 0009 tranche 2)', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    if (!bridge.isReady()) {
      throw new Error(
        'RuntimeBridge failed to initialize WASM. Run npm run wasm:dev before this integration test.'
      );
    }
  });

  it('captures the Rust-issued bundle deterministically with coherent live identity and minted uses', async () => {
    const { atlas, handle } = liveGovernedSession();
    try {
      const first = await atlas.captureGovernedEvidenceReceipt();
      expect(first).not.toBeNull();
      // Widened from its tranche-2 pin (`uses` exactly empty): since slice 2 the
      // composition mints one use per kernel-attested (consumer, receipt) pair
      // from the same capture's kernel-issued attestation, under the authority's
      // profile. One consumer claims every bundle receipt, in bundle order.
      const firstBundle = first!.envelope.bundle;
      expect(first!.envelope.uses).toEqual(
        firstBundle.receipts.map((receipt) => ({
          consumerId: DESCRIPTIVE_STATISTICS_CONSUMER_ID_V1,
          receiptId: receipt.receiptId,
          requirementProfileId: DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1.profileId,
        })),
      );
      expect(first!.envelope.bundle.receipts.length).toBeGreaterThan(0);
      expect(first!.envelope.bundle.datasetFingerprint).toBe(bridge.datasetFingerprint(handle));
      expect(first!.envelope.bundle.kernelVersion).toBe(bridge.kernelVersion());
      const second = await atlas.captureGovernedEvidenceReceipt();
      expect(Buffer.from(second!.bytes).equals(Buffer.from(first!.bytes))).toBe(true);
      // An explicit governed export must be available from the live capture path.
      const bytes = sha256Hex(first!.bytes);
      expect(bytes).toMatch(/^[0-9a-f]{64}$/);
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('returns null without a live dataset handle instead of manufacturing evidence', async () => {
    expect(await new AtlasCore({ kernel: null }).captureGovernedEvidenceReceipt()).toBeNull();
    expect(await new AtlasCore({ kernel: bridge }).captureGovernedEvidenceReceipt()).toBeNull();
  });

  it('performs no analytical acquisition during serialization, and fails a governed export closed when nothing can attest one', async () => {
    // #834 record item (4) in docs/ROADMAP.md: ordinary serialization is a pure
    // snapshot. A session that has neither restored nor captured a carrier must
    // serialize without one rather than reaching a kernel, a port or an
    // importable module global for evidence it never acquired.
    const { handle, session } = liveGovernedSession();
    try {
      const json = session.serialize();
      expect(json.evidenceReceiptSnapshot).toBeUndefined();

      // Detached from any live kernel and holding no carrier, the governed
      // request must refuse instead of manufacturing evidence from a global.
      const detached = NemosyneSession.deserialize(json, new AtlasCore({ kernel: null }));
      await expect(
        detached.exportPortablePackage({}, undefined, { governedEvidence: true })
      ).rejects.toThrow(/none is available for this session/);
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('exports a governed V3 package from the live session with committed receipt bytes and identity', async () => {
    const { handle, session } = liveGovernedSession();
    try {
      const bytes = await session.exportPortablePackage({}, undefined, { governedEvidence: true });
      const payload = NemosynePackageManager.unpack(bytes);
      expect(payload.manifest.formatVersion).toBe(3);
      expect(payload.evidenceReceiptBytes).toBeDefined();
      expect(payload.manifest.investigationDigestAlgorithm).toBe(
        'sha256-canonical-investigation-v3'
      );
      const envelope = evidenceEnvelopeOf(payload.evidenceReceiptBytes!);
      // Minted, not empty: one use per bundle receipt under the governing
      // consumer and the authority-required profile (slice 2).
      expect(envelope.uses).toEqual(
        envelope.bundle.receipts.map((receipt) => ({
          consumerId: DESCRIPTIVE_STATISTICS_CONSUMER_ID_V1,
          receiptId: receipt.receiptId,
          requirementProfileId: DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1.profileId,
        })),
      );
      expect(envelope.bundle.datasetFingerprint).toBe(bridge.datasetFingerprint(handle));
      expect(payload.manifest.analyticalDatasetFingerprint).toBe(envelope.bundle.datasetFingerprint);
      expect(payload.manifest.analyticalKernelVersion).toBe(bridge.kernelVersion());
      expect(payload.manifest.evidenceReceiptDigest).toBe(sha256Hex(payload.evidenceReceiptBytes!));

      // Export determinism where it is semantically required: the receipt
      // commitment and governed digest are stable across repeated exports
      // (manifest.createdAt is capture metadata and intentionally varies).
      const again = await session.exportPortablePackage({}, undefined, { governedEvidence: true });
      const repacked = NemosynePackageManager.unpack(again);
      expect(repacked.manifest.investigationDigest).toBe(payload.manifest.investigationDigest);
      expect(repacked.manifest.evidenceReceiptDigest).toBe(payload.manifest.evidenceReceiptDigest);
      expect(Buffer.from(repacked.evidenceReceiptBytes!).equals(payload.evidenceReceiptBytes!)).toBe(true);
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('keeps the default export on the V2 contract and does not reuse the V2 digest for governed export', async () => {
    const { handle, session } = liveGovernedSession();
    try {
      const v2Bytes = await session.exportPortablePackage({});
      const v2 = NemosynePackageManager.unpack(v2Bytes);
      expect(v2.manifest.formatVersion).toBe(2);
      expect(v2.manifest.investigationDigestAlgorithm).toBe('sha256-canonical-investigation-v2');
      expect(v2.evidenceReceiptBytes).toBeUndefined();

      const governed = NemosynePackageManager.unpack(
        await session.exportPortablePackage({}, undefined, { governedEvidence: true })
      );
      expect(governed.manifest.investigationDigest).not.toBe(v2.manifest.investigationDigest);
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('refuses a governed export whose kernel-version override differs from the bundle identity', async () => {
    const { handle, session } = liveGovernedSession();
    try {
      await expect(
        session.exportPortablePackage({}, 'not-the-captured-kernel', { governedEvidence: true })
      ).rejects.toThrow(/kernel-version override/);
      // The refusal must not be remembered: `_evidenceReceiptBytes` is adopted
      // only after every coherence check passes, so a capture this export
      // rejected cannot become the carrier a later serialization persists.
      // Without this, hoisting the adoption above the checks would fail nothing.
      expect(session.serialize().evidenceReceiptSnapshot).toBeUndefined();
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('omits a carrier that no longer describes the dataset a snapshot commits', async () => {
    // A capture is adopted for the state that validated it, but the dataset can
    // move on afterwards. Persisting the old carrier beside the new identity
    // would commit evidence for dataset A under the identity of dataset B — a
    // corrupt artifact for the replay loader RFC 0009 tranche 3 will add, and a
    // violation of this field's own contract (NemosyneSessionJSON
    // `evidenceReceiptSnapshot`: bytes "for the analytical dataset this snapshot
    // commits"). Serialization stays pure: it compares an identity it already
    // holds, and reaches no kernel, port or module global to do it.
    const { atlas, session } = liveGovernedSession();
    try {
      await session.exportPortablePackage({}, undefined, { governedEvidence: true });
      // Coherent while the dataset is the one the carrier attests.
      expect(session.serialize().evidenceReceiptSnapshot).toBeDefined();

      atlas.loadDataset(driftDataset());
      const driftedJson = session.serialize();
      expect(driftedJson.evidenceReceiptSnapshot).toBeUndefined();
      // The omission is the carrier's incoherence, not the loss of the live
      // dataset — the snapshot still commits the drifted analytical identity.
      expect(driftedJson.datasetFingerprint).toBe(
        bridge.datasetFingerprint(atlas.aggregate.analytical.currentHandle)
      );
    } finally {
      bridge.destroyDataset(atlas.aggregate.analytical.currentHandle);
    }
  });


  it('preserves the receipt carrier through session JSON and re-exports governed from the snapshot', async () => {
    const { handle, session } = liveGovernedSession();
    try {
      // Acquisition happens in the governed export (#834 record item (3)) and the
      // accepted capture becomes this session's carrier (item 4), so ordinary
      // serialization carries exactly the bytes the authoritative path
      // committed — asserted here, because an operation named `export…` that
      // silently changes what a later `serialize()` persists must be pinned.
      const exported = await session.exportPortablePackage({}, undefined, {
        governedEvidence: true,
      });
      const committed = NemosynePackageManager.unpack(exported).evidenceReceiptBytes!;
      const json = session.serialize();
      expect(json.evidenceReceiptSnapshot).toBeDefined();
      const liveEnvelope = evidenceEnvelopeOf(
        new Uint8Array(Buffer.from(json.evidenceReceiptSnapshot!, 'base64'))
      );
      expect(liveEnvelope.uses).toEqual(
        liveEnvelope.bundle.receipts.map((receipt) => ({
          consumerId: DESCRIPTIVE_STATISTICS_CONSUMER_ID_V1,
          receiptId: receipt.receiptId,
          requirementProfileId: DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1.profileId,
        })),
      );
      expect(
        Buffer.from(new Uint8Array(Buffer.from(json.evidenceReceiptSnapshot!, 'base64'))).equals(
          Buffer.from(committed)
        )
      ).toBe(true);

      const roundTrip = NemosyneSession.deserialize(
        json,
        new AtlasCore({ kernel: null })
      ).serialize();
      expect(roundTrip.evidenceReceiptSnapshot).toBe(json.evidenceReceiptSnapshot);

      const governedSnapshot = await NemosyneSession.exportPortableSnapshot(
        json,
        {},
        bridge.kernelVersion()!,
        { governedEvidence: true }
      );
      const payload = NemosynePackageManager.unpack(governedSnapshot);
      expect(payload.manifest.formatVersion).toBe(3);
      const snapshotEnvelope = evidenceEnvelopeOf(payload.evidenceReceiptBytes!);
      expect(snapshotEnvelope.bundle).toEqual(liveEnvelope.bundle);

      // The same snapshot re-exported without the governed request stays V2.
      const v2Snapshot = await NemosyneSession.exportPortableSnapshot(json, {}, bridge.kernelVersion()!);
      expect(NemosynePackageManager.unpack(v2Snapshot).manifest.formatVersion).toBe(2);
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('refuses a governed snapshot re-export whose carrier does not match the committed analytical state', async () => {
    const governed = liveGovernedSession();
    const drifted = liveGovernedSession(driftDataset());
    try {
      // Each session acquires its own carrier through its own injected port, so
      // the carriers below describe two different datasets on purpose.
      await governed.session.exportPortablePackage({}, undefined, { governedEvidence: true });
      await drifted.session.exportPortablePackage({}, undefined, { governedEvidence: true });
      const governedJson = governed.session.serialize();
      const driftedJson = drifted.session.serialize();
      expect(driftedJson.datasetFingerprint).not.toBe(governedJson.datasetFingerprint);
      // Issue #834 falsifier: the save-time capture a session carries describes
      // its *own* dataset. A session that serializes another session's — or
      // another runtime's — bundle is the cross-runtime aliasing this repair
      // removes, so the identity is pinned to the kernel read for each handle.
      const driftedEnvelope = evidenceEnvelopeOf(
        new Uint8Array(Buffer.from(driftedJson.evidenceReceiptSnapshot!, 'base64'))
      );
      const governedEnvelope = evidenceEnvelopeOf(
        new Uint8Array(Buffer.from(governedJson.evidenceReceiptSnapshot!, 'base64'))
      );
      expect(driftedEnvelope.bundle.datasetFingerprint).toBe(
        bridge.datasetFingerprint(drifted.handle)
      );
      expect(governedEnvelope.bundle.datasetFingerprint).toBe(
        bridge.datasetFingerprint(governed.handle)
      );

      const mismatched = {
        ...driftedJson,
        evidenceReceiptSnapshot: governedJson.evidenceReceiptSnapshot,
      };
      await expect(
        NemosyneSession.exportPortableSnapshot(
          mismatched,
          {},
          bridge.kernelVersion()!,
          { governedEvidence: true }
        )
      ).rejects.toThrow(/different analytical dataset state/);
    } finally {
      bridge.destroyDataset(governed.handle);
      bridge.destroyDataset(drifted.handle);
    }
  });

  it('refuses to re-pack tampered receipt bytes against the original governed manifest', async () => {
    const { handle, session } = liveGovernedSession();
    try {
      const bytes = await session.exportPortablePackage({}, undefined, { governedEvidence: true });
      const payload = NemosynePackageManager.unpack(bytes);
      const tampered = new Uint8Array(payload.evidenceReceiptBytes!);
      tampered[tampered.length - 1] ^= 0xff;
      expect(() =>
        NemosynePackageManager.pack({
          manifest: payload.manifest,
          datasetBytes: payload.datasetBytes,
          commandLogBytes: payload.commandLogBytes,
          representationDecisionBytes: payload.representationDecisionBytes,
          discoveryEpisodesBytes: payload.discoveryEpisodesBytes,
          nilOutcomesBytes: payload.nilOutcomesBytes,
          evidenceReceiptBytes: tampered,
        })
      ).toThrow(/digest mismatch/i);
    } finally {
      bridge.destroyDataset(handle);
    }
  });
});