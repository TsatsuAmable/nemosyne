import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

describe('Quest telemetry analysis command', () => {
  const directories: string[] = [];

  afterEach(() => {
    for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
  });

  it('validates and aggregates repeated ADB-attributed on-device reports', () => {
    const directory = mkdtempSync(join(tmpdir(), 'nemosyne-quest-telemetry-'));
    directories.push(directory);
    const reportPath = join(directory, 'results.jsonl');
    const makeReport = (p95Ms: number) => ({
      version: '2',
      profileName: 'quest-3s-qualification',
      xrActive: true,
      aborted: false,
      device: {
        declaredDeviceTarget: 'META_QUEST_3S',
        identityBasis: 'adb-system-property',
        userAgent: 'Quest Browser test',
        xr: { nominalFrameRateHz: 72 },
      },
      collection: {
        rawFrameTraceIncluded: false,
        datasetRowsIncluded: false,
        cameraPosesIncluded: false,
      },
      visibility: { interruptionCount: 1 },
      steps: [
        {
          frameCadence: { p95Ms, p99Ms: p95Ms + 1, droppedPct: 2 },
          memory: { jsHeapPeakBytes: 100, wasmPeakBytes: 200 },
          sustainedPerformance: { classification: 'stable', p95DriftPercent: 3 },
          representation: {
            governorLodScaleMinimum: 0.8,
            renderedFraction: 0.5,
            governorThrottleEvents: 2,
          },
        },
      ],
    });
    writeFileSync(
      reportPath,
      `${JSON.stringify(makeReport(12))}\n${JSON.stringify(makeReport(14))}\n`
    );
    const output = execFileSync(
      process.execPath,
      [resolve('scripts/analyze-quest-telemetry.mjs'), reportPath],
      { encoding: 'utf8' }
    );
    const result = JSON.parse(output);
    expect(result.validQuestReportCount).toBe(2);
    const group = Object.values(result.groups)[0] as Record<string, unknown>;
    expect(group.runCount).toBe(2);
    expect(group.worstFrameCadenceP95Ms).toBe(14);
    expect(group.maximumWasmPeakBytes).toBe(200);
    expect(group.totalGovernorThrottleEvents).toBe(4);
  });

  it('continues to analyze explicitly exploratory investigator-declared reports without upgrading them', () => {
    const directory = mkdtempSync(join(tmpdir(), 'nemosyne-quest-telemetry-manual-'));
    directories.push(directory);
    const reportPath = join(directory, 'manual.json');
    writeFileSync(
      reportPath,
      JSON.stringify({
        version: '2',
        profileName: 'quest-3s-qualification',
        xrActive: true,
        aborted: false,
        device: {
          declaredDeviceTarget: 'META_QUEST_3S',
          identityBasis: 'investigator-declared',
          userAgent: 'Quest Browser exploratory test',
          xr: { nominalFrameRateHz: 72 },
        },
        collection: {
          rawFrameTraceIncluded: false,
          datasetRowsIncluded: false,
          cameraPosesIncluded: false,
        },
        visibility: { interruptionCount: 0 },
        steps: [
          {
            frameCadence: { p95Ms: 12, p99Ms: 13, droppedPct: 1 },
            memory: { jsHeapPeakBytes: null, wasmPeakBytes: 200 },
            sustainedPerformance: { classification: 'stable', p95DriftPercent: 2 },
            representation: {
              governorLodScaleMinimum: 1,
              renderedFraction: 1,
              governorThrottleEvents: 0,
            },
          },
        ],
      })
    );
    const output = execFileSync(
      process.execPath,
      [resolve('scripts/analyze-quest-telemetry.mjs'), reportPath],
      { encoding: 'utf8' }
    );
    expect(JSON.parse(output).validQuestReportCount).toBe(1);
  });

  it('aggregates 10M Rust boundary evidence without issuing device qualification', () => {
    const directory = mkdtempSync(join(tmpdir(), 'nemosyne-quest-boundary-'));
    directories.push(directory);
    const reportPath = join(directory, 'boundary.json');
    const report = {
      version: '1',
      profileName: 'quest-3s-rust-boundary-10m',
      xrActive: true,
      device: {
        declaredDeviceTarget: 'META_QUEST_3S',
        identityBasis: 'adb-system-property',
        buildId: 'abc123',
        declaredFirmwareVersion: 'test-fw',
        userAgent: 'Quest Browser test',
        xr: { nominalFrameRateHz: 72 },
      },
      visibility: { interruptionCount: 0 },
      scenario: { rows: 10_000_000 },
      outcome: { status: 'completed', failurePhase: null },
      timings: {
        payloadBuildMs: 100,
        hostAllocationAndCopyMs: 200,
        rustLoadMs: 300,
        fingerprintMs: 400,
        structureProfileMs: 500,
        coldBorrowedScanMs: 600,
        warmBorrowedScanMs: 550,
      },
      memory: {
        jsHeapPeakBytes: 700,
        wasmAfterLoadBytes: 800,
        retainedWasmGrowthBytes: 900,
      },
      evidence: {
        structureProfileRowCount: 10_000_000,
        rowMaterialisations: 0,
        checksumParity: true,
      },
      maximumFrameGapMs: 1000,
      qualification: {
        evidencePathAvailableAt10m: true,
        deviceQualifiedAt10m: false,
        promotionBlockedByAudits: true,
      },
      collection: {
        rawFrameTraceIncluded: false,
        datasetRowsIncluded: false,
        cameraPosesIncluded: false,
      },
    };
    writeFileSync(reportPath, JSON.stringify(report));
    const output = execFileSync(
      process.execPath,
      [resolve('scripts/analyze-quest-telemetry.mjs'), reportPath],
      { encoding: 'utf8' }
    );
    const result = JSON.parse(output);
    expect(result.validBoundaryReportCount).toBe(1);
    const group = Object.values(result.boundaryGroups)[0] as Record<string, unknown>;
    expect(group.evidencePathAvailableRunCount).toBe(1);
    expect(group.maximumFingerprintMs).toBe(400);
    expect(group.maximumFrameGapMs).toBe(1000);
    expect(group.deviceQualifiedAt10m).toBe(false);
    expect(group.promotionBlockedByAudits).toBe(true);
  });
});
