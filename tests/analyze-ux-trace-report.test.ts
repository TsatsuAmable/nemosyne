/**
 * Analyzer calibration-report tests: miss classes via rayValid, drift
 * conditioned on selection outcome, and hand-height suppression exposure.
 *
 * Runs the real `scripts/analyze-ux-trace.mjs` CLI against synthetic
 * legacy-JSONL fixtures so the numbers future calibration depends on are
 * pinned without requiring on-device traces.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tempDirectories: string[] = [];

type GazeKind = 'panel' | 'hud' | 'scene' | null;
interface HandSample {
  h: string;
  y: number;
}
interface ContextOptions {
  drift?: number | null;
  ptrTarget?: string | null;
  gazeTarget?: string | null;
  gazeKind?: GazeKind;
  hands?: HandSample[];
}

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
}: ContextOptions = {}) {
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

function fixtureLines(): string {
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
        hands: [
          { h: 'left', y: 1.7 },
          { h: 'right', y: 1.3 },
        ],
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
      ctx: ctx({ drift: 80 }),
    },
    {
      t: 5,
      sid,
      seq: 6,
      type: 'selection',
      hit: 'none',
      target: null,
      rayValid: true,
      ctx: ctx({ drift: 50, gazeTarget: 'VR MENU', gazeKind: 'panel' }),
    },
    {
      t: 6,
      sid,
      seq: 7,
      type: 'selection',
      hit: 'none',
      target: null,
      ctx: ctx({ drift: 60 }),
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
      ctx: ctx({ drift: 50, gazeTarget: 'VR MENU', gazeKind: 'panel' }),
    },
    { t: 8, sid, seq: 9, type: 'system', kind: 'both-pinch-suppressed', y0: 1.6, y1: 1.1 },
  ];
  return records.map((record) => JSON.stringify(record)).join('\n') + '\n';
}

function selectionOnlyFixtureLines(): string {
  const sid = 'selection-only-sid';
  const records = [
    { t: 0, sid, seq: 1, type: 'meta', startedAt: '2026-09-06T00:00:00.000Z' },
    { t: 1, sid, seq: 2, type: 'selection', hit: 'scene', rayValid: true, ctx: ctx({ drift: 10 }) },
    { t: 2, sid, seq: 3, type: 'selection', hit: 'none', rayValid: true, ctx: ctx({ drift: 70 }) },
  ];
  return records.map((record) => JSON.stringify(record)).join('\n') + '\n';
}

function analyze(fixture: string, extraArgs: string[] = []): string {
  const directory = mkdtempSync(join(tmpdir(), 'nemosyne-analyzer-'));
  tempDirectories.push(directory);
  const file = join(directory, 'trace.jsonl');
  writeFileSync(file, fixture, 'utf8');
  return execFileSync(process.execPath, ['scripts/analyze-ux-trace.mjs', file, ...extraArgs], {
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

  it('conditions drift on selection outcome even when no standalone context records exist', () => {
    const output = analyze(selectionOnlyFixtureLines());
    expect(output).toContain('drift at selection:none: n=1 median=70.0° p90=70.0°');
    expect(output).toContain('drift at selection:scene: n=1 median=10.0° p90=10.0°');
  });

  it('reports context-level hand-height exposure instead of hand-observation exposure', () => {
    const output = analyze(fixtureLines());
    expect(output).toContain('hand-height exposure: contexts=2 max=1.70m above 1.5m=2 (100%)');
  });

  it('can evaluate exposure against an explicit candidate reach-zone threshold', () => {
    const output = analyze(fixtureLines(), ['--reach-zone-y', '1.65']);
    expect(output).toContain('hand-height exposure: contexts=2 max=1.70m above 1.65m=1 (50%)');
  });
});
