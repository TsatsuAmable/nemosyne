import { describe, expect, it } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { ColumnType } from '../src/data/Dataset.ts';
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

const DATASET_JSON = {
  name: 'tec1-governed-carrier',
  columns: [{ name: 'x', type: ColumnType.NUMERIC }],
  rows: [{ x: 1 }, { x: 2 }],
};

function minimalSessionJson(): NemosyneSessionJSON {
  return {
    schemaVersion: 2,
    savedAt: 0,
    datasetVersion: 1,
    datasetFingerprint: 'carrier-fingerprint',
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
      datasetFingerprint: 'carrier-fingerprint',
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
            datasetFingerprint: 'carrier-fingerprint',
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