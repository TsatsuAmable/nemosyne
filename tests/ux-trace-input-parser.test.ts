// @ts-nocheck
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  UX_TRACE_EXPORT_SCHEMA_VERSION,
  UX_TRACE_INTEGRITY_ALGORITHM,
  UXTraceInputError,
  canonicalSha256Hex,
  parseUXTraceText,
} from '../scripts/lib/ux-trace-input.mjs';

function records() {
  return [
    { sid: 'trace-1', t: 0, seq: 1, type: 'trace-lifecycle', event: 'trace-start' },
    { sid: 'trace-1', t: 0.2, seq: 2, type: 'selection', hit: 'scene' },
  ];
}

function envelope(overrides = {}) {
  const recs = records();
  return {
    schemaVersion: UX_TRACE_EXPORT_SCHEMA_VERSION,
    createdAt: '2026-09-05T16:00:00.000Z',
    exportedAt: '2026-09-05T16:01:00.000Z',
    sid: 'trace-1',
    recordCount: recs.length,
    droppedCount: 0,
    firstSeq: 1,
    lastSeq: 2,
    traceOpen: true,
    endpointDead: true,
    integrity: {
      algorithm: UX_TRACE_INTEGRITY_ALGORITHM,
      recordsSha256: canonicalSha256Hex(recs),
    },
    records: recs,
    ...overrides,
  };
}

describe('UX trace canonical input parser', () => {
  it('accepts and verifies a versioned production export envelope', () => {
    const parsed = parseUXTraceText(JSON.stringify(envelope()), { source: 'fixture.json' });
    expect(parsed.format).toBe('envelope-v1');
    expect(parsed.integrityVerified).toBe(true);
    expect(parsed.records).toEqual(records());
  });

  it('lets the canonical analyzer consume a production export directly', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nemosyne-ux-trace-'));
    const file = join(dir, 'trace.json');
    try {
      writeFileSync(file, JSON.stringify(envelope()), 'utf8');
      const output = execFileSync(process.execPath, ['scripts/analyze-ux-trace.mjs', file], {
        cwd: process.cwd(),
        encoding: 'utf8',
      });
      expect(output).toContain('Input: envelope-v1 | schema=1 | integrity=verified');
      expect(output).toContain('Trace completeness & integrity');
      expect(output).toContain('envelope: schema=v1 integrity=verified seq=1..2 dropped=0');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('accepts legacy dev JSONL records without pretending integrity was verified', () => {
    const text = records().map((record) => JSON.stringify(record)).join('\n');
    const parsed = parseUXTraceText(text, { source: 'fixture.jsonl' });
    expect(parsed.format).toBe('jsonl');
    expect(parsed.integrityVerified).toBe(false);
    expect(parsed.records).toEqual(records());
  });

  it('accepts interleaved legacy dev sessions with independent sequence counters', () => {
    const text = [
      { sid: 'a', t: 0, seq: 1, type: 'context' },
      { sid: 'b', t: 0, seq: 1, type: 'context' },
      { sid: 'a', t: 1, seq: 2, type: 'context' },
      { sid: 'b', t: 1, seq: 2, type: 'context' },
    ]
      .map((record) => JSON.stringify(record))
      .join('\n');
    expect(parseUXTraceText(text, { source: 'multi.jsonl' }).records).toHaveLength(4);
  });

  it('accepts the unversioned PR #674 export envelope for backward compatibility', () => {
    const legacy = {
      exportedAt: '2026-09-05T16:01:00.000Z',
      sid: 'trace-1',
      recordCount: 2,
      droppedCount: 0,
      endpointDead: true,
      records: records(),
    };
    const parsed = parseUXTraceText(JSON.stringify(legacy), { source: 'legacy.json' });
    expect(parsed.format).toBe('legacy-envelope');
    expect(parsed.integrityVerified).toBe(false);
    expect(parsed.records).toHaveLength(2);
  });

  it('rejects malformed/truncated JSONL instead of silently deleting evidence', () => {
    const text = `${JSON.stringify(records()[0])}\n{"sid":"trace-1","t":0.2`;
    expect(() => parseUXTraceText(text, { source: 'truncated.jsonl' })).toThrow(
      /malformed or truncated JSON at line 2/
    );
  });

  it('rejects a versioned envelope whose declared record count is false', () => {
    expect(() =>
      parseUXTraceText(JSON.stringify(envelope({ recordCount: 99 })), { source: 'count.json' })
    ).toThrow(/recordCount 99 does not match records.length 2/);
  });

  it('rejects digest tampering', () => {
    const tampered = envelope();
    tampered.records[1].hit = 'none';
    expect(() => parseUXTraceText(JSON.stringify(tampered), { source: 'tampered.json' })).toThrow(
      /trace record digest mismatch/
    );
  });

  it('rejects a false sequence-range claim', () => {
    expect(() =>
      parseUXTraceText(JSON.stringify(envelope({ firstSeq: 2 })), { source: 'seq.json' })
    ).toThrow(/sequence range/);
  });

  it('rejects cross-session records inside one versioned envelope', () => {
    const mixed = envelope();
    mixed.records[1].sid = 'other-trace';
    mixed.integrity.recordsSha256 = canonicalSha256Hex(mixed.records);
    expect(() => parseUXTraceText(JSON.stringify(mixed), { source: 'mixed.json' })).toThrow(
      /does not match envelope sid/
    );
  });

  it('rejects unsupported future schemas fail-closed', () => {
    expect(() =>
      parseUXTraceText(JSON.stringify(envelope({ schemaVersion: 99 })), { source: 'future.json' })
    ).toThrow(UXTraceInputError);
  });
});
