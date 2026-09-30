import { describe, expect, it } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { ColumnType, Dataset } from '../src/data/Dataset.ts';
import { canonicalDatasetIdentityHex } from '../src/data/DatasetIdentity.ts';
import type { DatasetJSON } from '../src/data/types.ts';
import {
  NemosyneSession,
  type NemosyneSessionJSON,
} from '../src/session/NemosyneSession.ts';
import { NemosynePackageManager } from '../src/session/NemosynePackage.ts';

/**
 * Kernel-less falsifiers for the RFC 0009 tranche-2 session evidence carrier.
 * The real-kernel governed export success path is pinned separately in the
 * WASM lane; here the fail-closed carrier and refusal semantics are pinned
 * without a Rust runtime.
 */

const DATASET_JSON: DatasetJSON = {
  name: 'tec1-governed-carrier',
  columns: [{ name: 'x', type: ColumnType.NUMERIC }],
  rows: [{ x: 1 }, { x: 2 }],
};

/**
 * The analytical identity this dataset actually has.
 *
 * A kernel-less session has no Rust kernel to supply one, so the identity it
 * commits is the canonical cross-language projection of the dataset content
 * (`AnalyticalState.getFingerprint`). A carrier attesting any other fingerprint
 * describes a *different* dataset, and serialization omits it rather than
 * persisting evidence for dataset A beside the identity of dataset B.
 *
 * Derived rather than written as a literal so the fixture stays coherent with
 * `DATASET_JSON` by construction: a hand-written value here would silently
 * turn these fixtures into carriers for a dataset that does not exist.
 */
const DATASET_IDENTITY = canonicalDatasetIdentityHex(DATASET_JSON);

function minimalSessionJson(): NemosyneSessionJSON {
  return {
    schemaVersion: 2,
    savedAt: 0,
    datasetVersion: 1,
    datasetFingerprint: DATASET_IDENTITY,
    originalDataset: DATASET_JSON,
    currentDataset: DATASET_JSON,
    datasetSpace: null,
    analysisResults: [],
    eventLedger: [],
    analysisHistory: { index: 0, maxFrames: 0, frames: [] },
    activeRecommendation: null,
    decisionHistory: [],
    structures: [],
    entry: { name: 'dataset' },
    analysisSpecs: [],
    presentation: {
      camera: { position: [0, 0, 0], rotationY: 0 },
      settings: {},
      tour: { stepIndex: 0, finished: true },
      theme: 'neonMidnight',
      panelPositions: [],
      entry: { name: 'dataset' },
    },
  };
}

function carrierFor(value: string): string {
  return Buffer.from(value, 'utf-8').toString('base64');
}

function validSyntheticEnvelope(): Record<string, unknown> {
  return {
    schemaVersion: '1',
    bundle: {
      schemaVersion: '1',
      datasetFingerprint: DATASET_IDENTITY,
      kernelVersion: 'kernel',
      receipts: [
        {
          receiptId: 'descriptive:x',
          claimId: 'descriptive:x',
          estimand: 'descriptive finite-value summary for column x',
          measurementContext: { status: 'NOT_ESTABLISHED' },
          geometry: null,
          assumptions: [],
          sampleSupport: {
            totalRows: 2,
            rowsUsed: 2,
            rowsExcluded: 0,
            columns: ['x'],
            policy: 'completeCase',
            exclusionReasons: [],
          },
          uncertainty: null,
          stability: null,
          sensitivity: [],
          limitations: ['descriptive only'],
          methodProvenance: {
            method: 'descriptive/finite-numeric',
            methodVersion: 'statistics-v1',
            kernelVersion: 'kernel',
            datasetFingerprint: DATASET_IDENTITY,
            parameters: [],
          },
        },
      ],
    },
    uses: [],
  };
}

function kernellessSession(json: NemosyneSessionJSON): NemosyneSession {
  return NemosyneSession.deserialize(json, new AtlasCore({ kernel: null }));
}

describe('TEC1 governed evidence session carrier', () => {
  it('rejects malformed carriers fail-closed at load instead of silently dropping them', () => {
    const atlas = () => new AtlasCore({ kernel: null });

    expect(() =>
      NemosyneSession.deserialize(
        { ...minimalSessionJson(), evidenceReceiptSnapshot: '!!!not-base64!!!' },
        atlas(),
      )
    ).toThrow();

    expect(() =>
      NemosyneSession.deserialize(
        { ...minimalSessionJson(), evidenceReceiptSnapshot: carrierFor('not json') },
        atlas(),
      )
    ).toThrow();

    expect(() =>
      NemosyneSession.deserialize(
        {
          ...minimalSessionJson(),
          evidenceReceiptSnapshot: carrierFor(JSON.stringify({ schemaVersion: '9' })),
        },
        atlas(),
      )
    ).toThrow(/unsupported|schemaVersion/i);
  });

  it('omits the carrier when the session has no governed evidence', () => {
    const restored = kernellessSession(minimalSessionJson());
    const serialized = restored.serialize();
    expect(serialized.evidenceReceiptSnapshot).toBeUndefined();
  });

  it('preserves captured carrier bytes verbatim through a serialize/deserialize round trip', () => {
    const carrier = carrierFor(JSON.stringify(validSyntheticEnvelope()));
    const json = { ...minimalSessionJson(), evidenceReceiptSnapshot: carrier };
    const restored = kernellessSession(json);
    expect(restored.serialize().evidenceReceiptSnapshot).toBe(carrier);
  });

  it('omits a carrier once the dataset no longer matches the identity it attests', () => {
    // The counterpart to the verbatim round trip above, and the reason that
    // test is not vacuous: the carrier survives only while it still describes
    // the dataset the snapshot commits. The WASM lane pins this against a live
    // Rust kernel; here the same rule is pinned kernel-lessly, where the
    // committed identity is the canonical content projection, so removing the
    // identity comparison fails in the fast lane too.
    const carrier = carrierFor(JSON.stringify(validSyntheticEnvelope()));
    const json = { ...minimalSessionJson(), evidenceReceiptSnapshot: carrier };
    const restored = kernellessSession(json);
    expect(restored.serialize().evidenceReceiptSnapshot).toBe(carrier);

    restored.atlas.loadDataset(
      new Dataset('tec1-governed-carrier-drifted', [{ name: 'x', type: ColumnType.NUMERIC }], [
        { x: 42 },
        { x: 43 },
      ])
    );

    const drifted = restored.serialize();
    expect(drifted.evidenceReceiptSnapshot).toBeUndefined();
    expect(drifted.datasetFingerprint).not.toBe(DATASET_IDENTITY);
  });

  it('keeps the default portable export on the V2 contract without receipts', async () => {
    const bytes = await NemosyneSession.exportPortableSnapshot(minimalSessionJson());
    const payload = NemosynePackageManager.unpack(bytes);
    expect(payload.manifest.formatVersion).toBe(2);
    expect(payload.evidenceReceiptBytes).toBeUndefined();
  });

  it('refuses an explicitly governed export when no Rust-issued bundle is available', async () => {
    await expect(
      NemosyneSession.exportPortableSnapshot(
        minimalSessionJson(),
        {},
        undefined,
        { governedEvidence: true },
      )
    ).rejects.toThrow(/Rust-issued statistics evidence receipt bundle/);
  });

  it('refuses a governed export whose carrier envelope carries consumer-use assertions', async () => {
    const envelope = {
      ...validSyntheticEnvelope(),
      uses: [{ consumerId: 'future-consumer', receiptId: 'descriptive:x', requirementProfileId: 'profile' }],
    };
    const json = {
      ...minimalSessionJson(),
      evidenceReceiptSnapshot: carrierFor(JSON.stringify(envelope)),
    };
    await expect(
      NemosyneSession.exportPortableSnapshot(json, {}, undefined, { governedEvidence: true })
    ).rejects.toThrow(/consumer-use assertions/);
  });

  it('refuses a non-boolean governedEvidence option instead of silently exporting V2', async () => {
    await expect(
      NemosyneSession.exportPortableSnapshot(
        minimalSessionJson(),
        {},
        undefined,
        { governedEvidence: 'yes' as unknown as boolean },
      )
    ).rejects.toThrow(/boolean governedEvidence option/);
  });

  it('refuses governed receipt bytes composed with the legacy schema-v1 digest projection', async () => {
    await expect(
      new AtlasCore({ kernel: null }).aggregate.computeDigest('kernel', {
        evidenceReceiptBytes: new Uint8Array([1]),
        legacyDigestSchemaV1: true,
      })
    ).rejects.toThrow(/legacy schema-v1 lossy projection/);
  });
});