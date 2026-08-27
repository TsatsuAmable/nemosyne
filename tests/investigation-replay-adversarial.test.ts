// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset } from '../src/data/Dataset.ts';
import { CANONICAL_DATASET_IDENTITY_ALGORITHM } from '../src/data/DatasetIdentity.ts';
import { INVESTIGATION_DIGEST_ALGORITHM } from '../src/investigation/InvestigationDigest.ts';
import { NemosynePackageManager } from '../src/session/NemosynePackage.ts';
import { InvestigationReplayRunner } from '../src/session/InvestigationReplayRunner.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';
import { strToU8 } from 'fflate';

/**
 * Replay verification now treats kernel identity and provenance as part of the
 * reproducibility contract. The general-purpose canned kernel intentionally
 * does not manufacture provenance, so this suite wraps it with the minimal
 * deterministic provenance behavior required to model a replay-capable kernel.
 */
function makeReplayKernelMockBridge() {
  const base = makeKernelMockBridge();
  let lastProvenance = null;

  return {
    ...base,
    kernelVersion: () => '0.2.0',
    kernelProvenance: () => lastProvenance,
    runOperation: (handle, op) => {
      const inputFingerprint = base.datasetFingerprint(handle);
      const outHandle = base.runOperation(handle, op);
      if (outHandle === 0) {
        lastProvenance = null;
        return 0;
      }
      const outputFingerprint = base.datasetFingerprint(outHandle);
      lastProvenance = {
        kernel: 'nemosyne-wasm',
        kernelVersion: '0.2.0',
        operation: op.op,
        parameters: op,
        inputFingerprint: inputFingerprint ?? '',
        outputFingerprint: outputFingerprint ?? '',
        timestamp: Date.now(),
      };
      return outHandle;
    },
  };
}

describe('Investigation Replay Runner Adversarial & Tamper Verification', () => {
  let mockBridge: any;
  let runner: InvestigationReplayRunner;

  beforeEach(() => {
    mockBridge = makeReplayKernelMockBridge();
    runner = new InvestigationReplayRunner(mockBridge);
  });

  it('successfully verifies a valid investigation package with bit-for-bit canonical digest parity', async () => {
    const atlas = new AtlasCore({ kernel: mockBridge, sessionId: 'adv-session-1' });
    const dataset = Dataset.fromJSON({
      name: 'SalesGraph',
      columns: [{ name: 'revenue', type: 'number' }],
      rows: [{ revenue: 1000 }, { revenue: 2500 }, { revenue: 5000 }],
    });
    atlas.loadDataset(dataset);

    const spec = {
      datasetFingerprint: atlas.datasetFingerprint!,
      datasetVersion: 0,
      operation: { op: 'filter', column: 'revenue', min: 2000 },
      algorithmVersion: '0.2.0',
    };
    atlas.applyAnalysis(spec);

    const obs = atlas.recordObservation('Filtered out revenue < 2000');
    atlas.recordFinding({
      title: 'High-Value Segment',
      description: 'Retained transactions above 2000',
      confidence: 'validated',
      observationIds: [obs.id],
      resultIds: [],
    });

    const digest = await atlas.computeDigest();
    const manifest = {
      formatVersion: 2,
      sessionId: 'adv-session-1',
      datasetFingerprint: String(dataset.fingerprint),
      datasetIdentityAlgorithm: CANONICAL_DATASET_IDENTITY_ALGORITHM,
      datasetName: 'SalesGraph',
      kernelVersion: '0.2.0',
      createdAt: Date.now(),
      commandCount: 1,
      investigationDigest: digest,
      investigationDigestAlgorithm: INVESTIGATION_DIGEST_ALGORITHM,
      evidenceSummary: {
        observationsCount: 1,
        findingsCount: 1,
        annotationsCount: 0,
      },
      environment: { userAgent: 'test-agent' },
    };

    const packageBytes = NemosynePackageManager.pack({
      manifest,
      datasetBytes: strToU8(JSON.stringify(dataset.toJSON())),
      commandLogBytes: strToU8(JSON.stringify(atlas.ledger)),
    });

    const replayResult = await runner.replayArchive(packageBytes);
    expect(replayResult.success, replayResult.discrepancies.join('\n')).toBe(true);
    expect(replayResult.discrepancies.length).toBe(0);
    expect(replayResult.eventsMatched).toBeGreaterThan(0);
    expect(replayResult.provenanceEventsVerified).toBe(1);
    expect(replayResult.investigationDigest).toBe(digest);
    expect(replayResult.evidenceCount.observations).toBe(1);
    expect(replayResult.evidenceCount.findings).toBe(1);
  });

  it('preserves recorded dataset versions when a replay starts from a fresh aggregate', async () => {
    const atlas = new AtlasCore({ kernel: mockBridge, sessionId: 'versioned-session' });
    atlas.loadDataset(Dataset.fromJSON({
      name: 'Priming Dataset',
      columns: [{ name: 'x', type: 'number' }],
      rows: [{ x: 1 }],
    }));
    const dataset = Dataset.fromJSON({
      name: 'Versioned Dataset',
      columns: [{ name: 'revenue', type: 'number' }],
      rows: [{ revenue: 1000 }, { revenue: 2500 }],
    });
    atlas.loadDataset(dataset);
    atlas.applyAnalysis({
      datasetFingerprint: atlas.datasetFingerprint!,
      datasetVersion: atlas.datasetVersion,
      operation: { op: 'filter', column: 'revenue', min: 2000 },
      algorithmVersion: '0.2.0',
    });

    const digest = await atlas.computeDigest();
    const packageBytes = NemosynePackageManager.pack({
      manifest: {
        formatVersion: 2,
        sessionId: atlas.sessionId,
        datasetFingerprint: String(dataset.fingerprint),
        datasetIdentityAlgorithm: CANONICAL_DATASET_IDENTITY_ALGORITHM,
        datasetName: dataset.name,
        kernelVersion: '0.2.0',
        createdAt: Date.now(),
        commandCount: atlas.ledger.length,
        investigationDigest: digest,
        investigationDigestAlgorithm: INVESTIGATION_DIGEST_ALGORITHM,
        evidenceSummary: { observationsCount: 0, findingsCount: 0, annotationsCount: 0 },
        environment: { userAgent: 'test-agent' },
      },
      datasetBytes: strToU8(JSON.stringify(dataset.toJSON())),
      commandLogBytes: strToU8(JSON.stringify(atlas.ledger)),
    });

    const replayResult = await runner.replayArchive(packageBytes);
    expect(replayResult.success, replayResult.discrepancies.join('\n')).toBe(true);
    expect(replayResult.investigationDigest).toBe(digest);
  });

  it('detects adversarial dataset tampering', async () => {
    const dataset = Dataset.fromJSON({
      name: 'TamperedDataset',
      columns: [{ name: 'x', type: 'number' }],
      rows: [{ x: 10 }],
    });

    // Manifest states original fingerprint, but dataset bytes are altered
    const manifest = {
      formatVersion: 1,
      sessionId: 'adv-tamper-1',
      datasetFingerprint: 'original-fingerprint-1234',
      datasetName: 'TamperedDataset',
      kernelVersion: '0.2.0',
      createdAt: Date.now(),
      commandCount: 0,
      environment: {},
    };

    const payload = {
      manifest,
      datasetBytes: strToU8(JSON.stringify(dataset.toJSON())),
      commandLogBytes: strToU8('[]'),
    };

    const result = await runner.replayPayload(payload);
    expect(result.success).toBe(false);
    expect(result.discrepancies.some((d) => d.includes('Dataset fingerprint mismatch'))).toBe(true);
  });

  it('detects adversarial investigation digest tampering', async () => {
    const dataset = Dataset.fromJSON({
      name: 'DigestTampered',
      columns: [{ name: 'val', type: 'number' }],
      rows: [{ val: 100 }],
    });

    const manifest = {
      formatVersion: 1,
      sessionId: 'adv-digest-tamper',
      datasetFingerprint: String(dataset.fingerprint),
      datasetName: 'DigestTampered',
      kernelVersion: '0.2.0',
      createdAt: Date.now(),
      commandCount: 0,
      investigationDigest: 'fabricated-fake-digest-0000000000000000000000000000000000000000',
      environment: {},
    };

    const payload = {
      manifest,
      datasetBytes: strToU8(JSON.stringify(dataset.toJSON())),
      commandLogBytes: strToU8('[]'),
    };

    const result = await runner.replayPayload(payload);
    expect(result.success).toBe(false);
    expect(result.discrepancies.some((d) => d.includes('Investigation digest mismatch'))).toBe(true);
  });

  it('rejects unsupported or unknown adversarial event kinds instead of silently ignoring them', async () => {
    const dataset = Dataset.fromJSON({
      name: 'UnknownEventDataset',
      columns: [{ name: 'score', type: 'number' }],
      rows: [{ score: 50 }],
    });

    const manifest = {
      formatVersion: 1,
      sessionId: 'adv-unknown-event',
      datasetFingerprint: String(dataset.fingerprint),
      datasetName: 'UnknownEventDataset',
      kernelVersion: '0.2.0',
      createdAt: Date.now(),
      commandCount: 1,
      environment: {},
    };

    const loggedEvents = [
      {
        eventId: 'adv:1',
        timestamp: Date.now(),
        kind: 'unsupported_alien_operation',
        command: { op: 'alien_op' },
        datasetVersion: 0,
        datasetFingerprint: String(dataset.fingerprint),
        stateHash: 'state-hash',
      },
    ];

    const payload = {
      manifest,
      datasetBytes: strToU8(JSON.stringify(dataset.toJSON())),
      commandLogBytes: strToU8(JSON.stringify(loggedEvents)),
    };

    const result = await runner.replayPayload(payload);
    expect(result.success).toBe(false);
    expect(result.discrepancies.some((d) => d.includes('Unsupported or unrecognized event kind'))).toBe(true);
  });
});
