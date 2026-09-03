/**
 * Tests for Gate 5 Headless Investigation Replay & .nemosyne Verification Runner.
 */

import { describe, it, expect, vi } from 'vitest';
import { strToU8 } from 'fflate';
import { NemosynePackageManager } from '../src/session/NemosynePackage.ts';
import { InvestigationReplayRunner } from '../src/session/InvestigationReplayRunner.ts';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset } from '../src/data/Dataset.ts';
import { toAnalysisSpec } from '../src/vr/interactions/DataOperations.ts';
import type { WasmRuntimeBridgeFull } from '../src/atlas/AtlasCore.ts';
import type { Provenance } from '../src/data/types.ts';

function createMockBridge({ fingerprintPrefix = 'mock-fp', kernelVersion = '0.2.0' } = {}): WasmRuntimeBridgeFull {
  let datasetVersion = 1;
  let lastProvenance: Provenance | null = null;
  const dsJson = {
    name: 'replay-dataset',
    topology: 'TABULAR' as const,
    columns: [
      { name: 'val', type: 'float' as const, values: [10, 20, 30] },
      { name: 'cat', type: 'string' as const, values: ['a', 'b', 'c'] },
    ],
  };
  return {
    isReady: () => true,
    capabilities: () => 0xff,
    loadDatasetJson: vi.fn().mockReturnValue(1),
    loadCsv: vi.fn().mockReturnValue(1),
    loadJson: vi.fn().mockReturnValue(1),
    loadSample: vi.fn().mockReturnValue(1),
    sampleKeys: () => [],
    destroyDataset: vi.fn(),
    runOperation: vi.fn().mockImplementation((inputHandle: number, operation: { op: string; [key: string]: unknown }) => {
      datasetVersion += 1;
      lastProvenance = {
        kernel: 'nemosyne-wasm',
        kernelVersion,
        operation: operation.op,
        parameters: operation as Provenance['parameters'],
        inputFingerprint: `${fingerprintPrefix}-${inputHandle}`,
        outputFingerprint: `${fingerprintPrefix}-${datasetVersion}`,
        timestamp: 1787180000000 + datasetVersion,
      };
      return datasetVersion;
    }),
    executeOperation: vi.fn().mockReturnValue(dsJson),
    getDatasetJson: vi.fn().mockReturnValue(dsJson),
    statistics: vi.fn().mockReturnValue({
      rowCount: 3,
      columnCount: 2,
      numeric: [{
        name: 'val',
        count: 3,
        sum: 60,
        mean: 20,
        median: 20,
        std: 10,
        var: 100,
        min: 10,
        max: 30,
        skew: 0,
        kurtosis: 0,
        outlierCount: 0,
      }],
      correlation: [],
      categorical: [{
        name: 'cat',
        cardinality: 3,
        entropy: 1.584962500721156,
        top: [
          { value: 'a', count: 1 },
          { value: 'b', count: 1 },
          { value: 'c', count: 1 },
        ],
      }],
      temporal: [],
      temporalStats: [],
    }),
    inferTopology: vi.fn().mockReturnValue('TABULAR'),
    inferEncodings: vi.fn().mockReturnValue({}),
    parseDatasetBytes: vi.fn().mockReturnValue(dsJson),
    kernelVersion: () => kernelVersion,
    kernelProvenance: () => lastProvenance,
    datasetFingerprint: (handle: number) => `${fingerprintPrefix}-${handle}`,
  };
}

function buildInvestigationPackage() {
  const bridge = createMockBridge();
  const atlas = new AtlasCore({ kernel: bridge });

  const initialDataset = Dataset.fromJSON({
    name: 'replay-dataset',
    topology: 'TABULAR',
    columns: [
      { name: 'val', type: 'float', values: [10, 20, 30, 40] },
      { name: 'cat', type: 'string', values: ['a', 'b', 'a', 'b'] },
    ],
  });
  atlas.loadDataset(initialDataset);

  atlas.applyAnalysis(toAnalysisSpec('filter', atlas.dataset!, atlas));
  atlas.applyAnalysis(toAnalysisSpec('sort', atlas.dataset!, atlas));

  const obs = atlas.recordObservation({
    notes: 'Bimodal distribution observed in replay source',
    spatialContext: { position: [1, 2, -3] },
    tags: ['replay-test'],
  });

  atlas.recordFinding({
    title: 'Valid Cohorts',
    description: 'Confirmed cohorts a and b',
    confidence: 'validated',
    observationIds: [obs.id],
    resultIds: [],
  });

  const manifest = {
    formatVersion: 1,
    sessionId: atlas.sessionId,
    datasetFingerprint: String(initialDataset.fingerprint),
    datasetName: initialDataset.name,
    kernelVersion: '0.2.0',
    createdAt: Date.now(),
    commandCount: atlas.evidenceLedger.ledger.length,
    environment: {
      userAgent: 'test-runner',
      platform: 'headless',
      webxrSupported: false,
    },
  };

  const packageBytes = NemosynePackageManager.pack({
    manifest,
    datasetBytes: strToU8(JSON.stringify(initialDataset.toJSON())),
    commandLogBytes: strToU8(JSON.stringify(atlas.evidenceLedger.ledger)),
  });

  return { atlas, initialDataset, packageBytes };
}

describe('Gate 5 InvestigationReplayRunner', () => {
  it('packs an investigation, replays headlessly, and verifies analytical provenance and evidence state', async () => {
    const { atlas, initialDataset, packageBytes } = buildInvestigationPackage();

    expect(packageBytes.length).toBeGreaterThan(100);
    const recordedAnalysisEvents = atlas.evidenceLedger.ledger.filter((event) => event.kind === 'analysis');
    expect(recordedAnalysisEvents).toHaveLength(2);
    expect(recordedAnalysisEvents.every((event) => event.result?.provenance != null)).toBe(true);

    const runner = new InvestigationReplayRunner(createMockBridge());
    const result = await runner.replayArchive(packageBytes);

    expect(result.discrepancies).toEqual([]);
    expect(result.success).toBe(true);
    expect(result.commandsReplayed).toBe(2);
    expect(result.provenanceEventsVerified).toBe(2);
    expect(result.evidenceCount.observations).toBe(1);
    expect(result.evidenceCount.findings).toBe(1);
    expect(result.datasetFingerprint).toBe(String(initialDataset.fingerprint));
    expect(result.finalOutputHash).toBe(atlas.datasetSpace?.fingerprint ?? atlas.datasetFingerprint);
  });

  it('fails replay when the kernel identity or analytical provenance drifts', async () => {
    const { packageBytes } = buildInvestigationPackage();
    const runner = new InvestigationReplayRunner(
      createMockBridge({ fingerprintPrefix: 'different-fp', kernelVersion: '0.3.0' })
    );

    const result = await runner.replayArchive(packageBytes);

    expect(result.success).toBe(false);
    expect(result.provenanceEventsVerified).toBe(0);
    expect(result.discrepancies.some((entry) => entry.includes('Kernel version mismatch'))).toBe(true);
    expect(
      result.discrepancies.some(
        (entry) => entry.includes('Analysis drift') && entry.includes('kernelVersion')
      )
    ).toBe(true);
  });
});
