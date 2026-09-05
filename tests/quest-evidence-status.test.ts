// @ts-nocheck
import { describe, expect, it, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { summarizeEvidence, formatEvidenceReport } from '../scripts/quest-evidence-status.mjs';

const tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function tempRoot(): string {
  const directory = mkdtempSync(join(tmpdir(), 'nemosyne-evidence-status-'));
  tempDirectories.push(directory);
  return directory;
}

function writeSession(
  root: string,
  label: string,
  { manifest = true, disposition = true, results = true, mtimeMs = Date.now() } = {}
): string {
  const dir = join(root, 'logs', 'validation', label);
  mkdirSync(dir, { recursive: true });
  if (manifest) {
    writeFileSync(
      join(dir, 'manifest.json'),
      JSON.stringify({
        sessionLabel: label,
        buildId: 'abc1234def5678abc1234def5678abc1234def56',
        validationMode: 'quest-perf',
        gates: ['PERF-04'],
      })
    );
  }
  if (disposition) {
    writeFileSync(
      join(dir, 'disposition.json'),
      JSON.stringify({ gateDisposition: { status: null, reasons: [] } })
    );
  }
  if (results) {
    const file = join(dir, 'loadtest-results.jsonl');
    writeFileSync(file, JSON.stringify({ profileName: 'quest-3s-qualification' }) + '\n');
    const atime = new Date(mtimeMs);
    utimesSync(file, atime, atime);
  }
  const dirTime = new Date(mtimeMs);
  utimesSync(dir, dirTime, dirTime);
  return dir;
}

describe('quest-evidence-status', () => {
  it('reports DELIVERED-TO-DISK when session results are present', () => {
    const root = tempRoot();
    writeSession(root, 'PERF04-abc1234-20260906T120000');
    const summary = summarizeEvidence(root);

    expect(summary.sessions).toHaveLength(1);
    expect(summary.sessions[0].verdict).toBe('DELIVERED-TO-DISK');
    expect(summary.sessions[0].manifest?.buildId7).toBe('abc1234');
    expect(summary.sessions[0].manifest?.gates).toEqual(['PERF-04']);

    const report = formatEvidenceReport(summary);
    expect(report).toContain('PERF04-abc1234-20260906T120000 [DELIVERED-TO-DISK]');
  });

  it('reports NO-RESULTS when the manifest exists but nothing was delivered', () => {
    const root = tempRoot();
    writeSession(root, 'PERF04-abc1234-20260906T120000', { results: false });
    const summary = summarizeEvidence(root);

    expect(summary.sessions[0].verdict).toBe('NO-RESULTS');
    expect(formatEvidenceReport(summary)).toContain('results: absent');
  });

  it('flags generic-sink routing when the generic file is newer than session results', () => {
    const root = tempRoot();
    const old = Date.now() - 3_600_000;
    writeSession(root, 'PERF04-abc1234-20260906T110000', { mtimeMs: old });
    mkdirSync(join(root, 'logs'), { recursive: true });
    writeFileSync(
      join(root, 'logs', 'loadtest-results.jsonl'),
      JSON.stringify({ profileName: 'tabular-staircase', recordedAt: Date.now() }) + '\n'
    );

    const summary = summarizeEvidence(root);
    expect(summary.generic.exists).toBe(true);
    expect(summary.generic.lastProfile).toBe('tabular-staircase');
    expect(summary.guidance.some((line) => line.includes('generic sink is newer'))).toBe(true);
  });

  it('reports empty state with launch guidance when no sessions exist', () => {
    const root = tempRoot();
    const summary = summarizeEvidence(root);

    expect(summary.sessions).toEqual([]);
    expect(summary.generic.exists).toBe(false);
    const report = formatEvidenceReport(summary);
    expect(report).toContain('No validation sessions found');
    expect(report).toContain('npm run dev:quest:perf');
  });
});
