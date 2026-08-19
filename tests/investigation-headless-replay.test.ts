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

function createMockBridge(): WasmRuntimeBridgeFull {
  let datasetVersion = 1;
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
    runOperation: vi.fn().mockImplementation(() => {
      datasetVersion += 1;
      return datasetVersion;
    }),
    executeOperation: vi.fn().mockReturnValue(dsJson),
    getDatasetJson: vi.fn().mockReturnValue(dsJson),
    statistics: vi.fn().mockReturnValue({}),
    inferTopology: vi.fn().mockReturnValue('TABULAR'),
    inferEncodings: vi.fn().mockReturnValue({}),
    parseDatasetBytes: vi.fn().mockReturnValue(dsJson),
    kernelProvenance: vi.fn().mockReturnValue({
      kernelVersion: '0.2.0',
      datasetFingerprint: 'mock-fp',
      timestamp: 1787180000000,
    }),
  };
}

describe('Gate 5 InvestigationReplayRunner', () => {
  it('packs an investigation, replays headlessly, and verifies complete analytical and evidence state', async () => {
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

    // 1. Perform analytical operations
    atlas.applyAnalysis(toAnalysisSpec('filter', atlas.dataset!, atlas));
    atlas.applyAnalysis(toAnalysisSpec('sort', atlas.dataset!, atlas));

    // 2. Record observations and findings
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

    // 3. Export .nemosyne package
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

    expect(packageBytes.length).toBeGreaterThan(100);

    // 4. Replay in a clean-room runner
    const replayBridge = createMockBridge();
    const runner = new InvestigationReplayRunner(replayBridge);

    const result = await runner.replayArchive(packageBytes);

    expect(result.discrepancies).toEqual([]);
    expect(result.success).toBe(true);
    expect(result.commandsReplayed).toBe(2);
    expect(result.evidenceCount.observations).toBe(1);
    expect(result.evidenceCount.findings).toBe(1);
    expect(result.datasetFingerprint).toBe(String(initialDataset.fingerprint));
    expect(result.finalOutputHash).toBe(atlas.datasetSpace?.fingerprint ?? atlas.datasetFingerprint);
  });
});
