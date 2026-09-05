// @ts-nocheck
/**
 * Analyzer calibration-report tests: miss classes via rayValid, drift
 * conditioned on selection outcome, and hand-height suppression exposure.
 *
 * Runs the real `scripts/analyze-ux-trace.mjs` CLI against a synthetic
 * legacy-JSONL fixture so the numbers future calibration depends on are
 * pinned without requiring on-device traces.
 */
import { describe, expect, it, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function ctx({
  drift = null,
  ptrTarget = null,
  gazeTarget = null,
  gazeKind = null,
  hands = [],
} = {}) {
  return {
    head: { p: [0, 1.6, 0], yaw: 0, pitch: 0 },
    gaze: { target: gazeTarget, kind: gazeKind, dist: 1.5 },
    ptr: {
      target: ptrTarget,
      kind: ptrTarget ? 'panel' : null,
      dist: 1.5,
      hand: 'left',
      driftDeg: drift,
    },
    hands,
    ui: {},
  };
}

function fixtureLines() {
  const sid = 'calibration-fixture-sid';
  const records = [
    { t: 0, sid, seq: 1, type: 'meta', startedAt: '2026-09-06T00:00:00.000Z' },
    {
      t: 1,
      sid,
      seq: 2,
      type: 'context',
      ctx: ctx({
        drift: 20,
        ptrTarget: 'Panel A',
        gazeTarget: 'Panel A',
        gazeKind: 'panel',
        hands: [
          { h: 'left', y: 1.6 },
          { h: 'right', y: 1.2 },
        ],
      }),
    },
    {
      t: 2,
      sid,
      seq: 3,
      type: 'context',
      ctx: ctx({
        drift: 90,
        ptrTarget: null,
        gazeTarget: 'VR MENU',
        gazeKind: 'panel',
        hands: [{ h: 'left', y: 1.7 }],
      }),
    },
    {
      t: 3,
      sid,
      seq: 4,
      type: 'selection',
      hit: 'scene',
      target: 'Node 1',
      rayValid: true,
      ctx: ctx({ drift: 12, ptrTarget: 'Node 1', gazeTarget: 'Node 1', gazeKind: 'scene' }),
    },
    {
      t: 4,
      sid,
      seq: 5,
      type: 'selection',
      hit: 'none',
      target: null,
      rayValid: false,
      ctx: ctx({ drift: 80, ptrTarget: null, gazeTarget: null, gazeKind: null }),
    },
    {
      t: 5,
      sid,
      seq: 6,
      type: 'selection',
      hit: 'none',
      target: null,
      rayValid: true,
      ctx: ctx({ drift: 50, ptrTarget: null, gazeTarget: 'VR MENU', gazeKind: 'panel' }),
    },
    {
      t: 6,
      sid,
      seq: 7,
      type: 'selection',
      hit: 'none',
      target: null,
      ctx: ctx({ drift: 60, ptrTarget: null, gazeTarget: null, gazeKind: null }),
    },
    {
      t: 7,
      sid,
      seq: 8,
      type: 'pinch',
      phase: 'start',
      gating: 'select',
      hand: 'left',
      d: 0.03,
      ctx: ctx({ drift: 50, ptrTarget: null, gazeTarget: 'VR MENU', gazeKind: 'panel' }),
    },
    { t: 8, sid, seq: 9, type: 'system', kind: 'both-pinch-suppressed', y0: 1.6, y1: 1.1 },
  ];
  return records.map((r) => JSON.stringify(r)).join('\n') + '\n';
}

function analyze(fixture: string): string {
  const directory = mkdtempSync(join(tmpdir(), 'nemosyne-analyzer-'));
  tempDirectories.push(directory);
  const file = join(directory, 'trace.jsonl');
  writeFileSync(file, fixture, 'utf8');
  return execFileSync(process.execPath, ['scripts/analyze-ux-trace.mjs', file], {
    encoding: 'utf8',
  });
}

describe('analyze-ux-trace calibration report', () => {
  it('splits misses into no-ray, aimed, and legacy-unknown classes', () => {
    const output = analyze(fixtureLines());
    expect(output).toContain(
      'Miss classes: no-ray (tracking loss)=1 aimed (valid ray, no target)=1 unknown-ray (legacy records)=1'
    );
  });

  it('conditions drift on selection outcome', () => {
    const output = analyze(fixtureLines());
    expect(output).toContain('drift at selection:none: n=3 median=60.0° p90=80.0°');
    expect(output).toContain('drift at selection:scene: n=1 median=12.0° p90=12.0°');
  });

  it('reports hand-height exposure above the suppression line', () => {
    const output = analyze(fixtureLines());
    expect(output).toContain('hand heights: n=3 max=1.70m above 1.5m=2 (67%)');
  });
});
