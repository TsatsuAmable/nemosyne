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
 * Real-kernel falsifiers for RFC 0009 tranche 2: the governed V3 export path
 * must mint its receipt bytes from the live Rust production bridge, commit
 * them into the closed v1 envelope, and refuse every identity incoherence
 * instead of silently downgrading to V2. Production replay continues to
 * refuse V3 (pinned in tests/tec1-v3-package.test.ts); this slice makes no
 * replay-consumption claim.
 */

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

  it('captures the Rust-issued bundle deterministically with coherent live identity and empty uses', async () => {
    const { atlas, handle } = liveGovernedSession();
    try {
      const first = await atlas.captureGovernedEvidenceReceipt();
      expect(first).not.toBeNull();
      expect(first!.envelope.uses).toEqual([]);
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
      expect(envelope.uses).toEqual([]);
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
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('preserves the receipt carrier through session JSON and re-exports governed from the snapshot', async () => {
    const { handle, session } = liveGovernedSession();
    try {
      // Issue #834: governed evidence is acquired by awaiting capture through
      // the analytical execution port. Ordinary serialization preserves an
      // already-captured carrier; it never acquires one.
      await session.exportPortablePackage({}, undefined, { governedEvidence: true });

      const json = session.serialize();
      expect(json.evidenceReceiptSnapshot).toBeDefined();
      const liveEnvelope = evidenceEnvelopeOf(
        new Uint8Array(Buffer.from(json.evidenceReceiptSnapshot!, 'base64'))
      );
      expect(liveEnvelope.uses).toEqual([]);

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
      await governed.session.exportPortablePackage({}, undefined, { governedEvidence: true });
      const governedJson = governed.session.serialize();
      const driftedJson = drifted.session.serialize();
      expect(driftedJson.datasetFingerprint).not.toBe(governedJson.datasetFingerprint);
      // Issue #834 falsifier: with a live kernel and a loaded dataset available,
      // ordinary serialization still acquires nothing. A save-time capture here
      // is exactly the module-global path this repair removes.
      expect(driftedJson.evidenceReceiptSnapshot).toBeUndefined();

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