import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  UX_TRACE_APP_EXPORT_SCHEMA_VERSION,
  UX_TRACE_APP_INTEGRITY_ALGORITHM,
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

function envelopeV1(overrides: Record<string, unknown> = {}) {
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
    buildHash: 'build-a',
    validationSession: { label: 'quest-ux-a', id: '00000000-0000-4000-8000-000000000001' },
    integrity: {
      algorithm: UX_TRACE_INTEGRITY_ALGORITHM,
      recordsSha256: canonicalSha256Hex(recs),
    },
    records: recs,
    ...overrides,
  };
}

function envelopeV2(overrides: Record<string, unknown> = {}) {
  const recs = records();
  const payload = {
    schemaVersion: UX_TRACE_APP_EXPORT_SCHEMA_VERSION,
    createdAt: '2026-09-05T16:00:00.000Z',
    exportedAt: '2026-09-05T16:01:00.000Z',
    sid: 'trace-1',
    recordCount: recs.length,
    droppedCount: 0,
    firstSeq: 1,
    lastSeq: 2,
    traceOpen: true,
    endpointDead: true,
    buildHash: 'build-a',
    validationSession: { label: 'quest-ux-a', id: '00000000-0000-4000-8000-000000000001' },
    records: recs,
    ...overrides,
  };
  return {
    ...payload,
    integrity: {
      algorithm: UX_TRACE_APP_INTEGRITY_ALGORITHM,
      payloadSha256: canonicalSha256Hex(payload),
    },
  };
}

describe('UX trace canonical input parser', () => {
  it('accepts v2 only when the complete evidence-bearing envelope verifies', () => {
    const parsed = parseUXTraceText(JSON.stringify(envelopeV2()), { source: 'fixture-v2.json' });
    expect(parsed.format).toBe('envelope-v2');
    expect(parsed.integrityVerified).toBe(true);
    expect(parsed.recordIntegrityVerified).toBe(true);
    expect(parsed.integrityScope).toBe('envelope');
    expect(parsed.records).toEqual(records());
  });

  it('lets the canonical analyzer consume a v2 production export directly', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nemosyne-ux-trace-'));
    const file = join(dir, 'trace.json');
    try {
      writeFileSync(file, JSON.stringify(envelopeV2()), 'utf8');
      const output = execFileSync(process.execPath, ['scripts/analyze-ux-trace.mjs', file], {
        cwd: process.cwd(),
        encoding: 'utf8',
      });
      expect(output).toContain('Input: envelope-v2 | schema=2 | integrity=verified-envelope');
      expect(output).toContain('envelope: schema=v2 integrity=verified-envelope');
      expect(output).toContain('validation session: quest-ux-a / 00000000-0000-4000-8000-000000000001');
      expect(output).toContain('build: build-a');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('keeps v1 readable but labels its integrity as records-only', () => {
    const parsed = parseUXTraceText(JSON.stringify(envelopeV1()), { source: 'fixture-v1.json' });
    expect(parsed.format).toBe('envelope-v1');
    expect(parsed.integrityVerified).toBe(false);
    expect(parsed.recordIntegrityVerified).toBe(true);
    expect(parsed.integrityScope).toBe('records');

    const dir = mkdtempSync(join(tmpdir(), 'nemosyne-ux-trace-v1-'));
    const file = join(dir, 'trace.json');
    try {
      writeFileSync(file, JSON.stringify(envelopeV1()), 'utf8');
      const output = execFileSync(process.execPath, ['scripts/analyze-ux-trace.mjs', file], {
        cwd: process.cwd(),
        encoding: 'utf8',
      });
      expect(output).toContain('integrity=verified-records-only');
      expect(output).toContain('v1 envelope attribution/build/drop metadata is outside the record digest');
      expect(output).toContain('validation session (unverified metadata)');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects v2 build or validation attribution tampering without digest refresh', () => {
    const buildTampered = envelopeV2() as Record<string, any>;
    buildTampered.buildHash = 'build-b';
    expect(() => parseUXTraceText(JSON.stringify(buildTampered), { source: 'build.json' })).toThrow(
      /trace envelope digest mismatch/
    );

    const validationTampered = envelopeV2() as Record<string, any>;
    validationTampered.validationSession.id = '00000000-0000-4000-8000-000000000002';
    expect(() =>
      parseUXTraceText(JSON.stringify(validationTampered), { source: 'validation.json' })
    ).toThrow(/trace envelope digest mismatch/);
  });

  it('still rejects record tampering in both v1 and v2', () => {
    const v1 = envelopeV1() as Record<string, any>;
    v1.records[1].hit = 'none';
    expect(() => parseUXTraceText(JSON.stringify(v1), { source: 'v1-record.json' })).toThrow(
      /trace record digest mismatch/
    );

    const v2 = envelopeV2() as Record<string, any>;
    v2.records[1].hit = 'none';
    expect(() => parseUXTraceText(JSON.stringify(v2), { source: 'v2-record.json' })).toThrow(
      /trace envelope digest mismatch/
    );
  });

  it('accepts legacy dev JSONL records without pretending integrity was verified', () => {
    const text = records().map((record) => JSON.stringify(record)).join('\n');
    const parsed = parseUXTraceText(text, { source: 'fixture.jsonl' });
    expect(parsed.format).toBe('jsonl');
    expect(parsed.integrityVerified).toBe(false);
    expect(parsed.integrityScope).toBe('none');
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

  it('rejects false counts, sequence ranges and cross-session records', () => {
    expect(() =>
      parseUXTraceText(JSON.stringify(envelopeV2({ recordCount: 99 })), { source: 'count.json' })
    ).toThrow(/recordCount 99 does not match records.length 2/);

    expect(() =>
      parseUXTraceText(JSON.stringify(envelopeV2({ firstSeq: 2 })), { source: 'seq.json' })
    ).toThrow(/sequence range/);

    const recs = records();
    recs[1].sid = 'other-trace';
    const mixed = envelopeV2({ records: recs });
    expect(() => parseUXTraceText(JSON.stringify(mixed), { source: 'mixed.json' })).toThrow(
      /does not match envelope sid/
    );
  });

  it('rejects unsupported future schemas fail-closed', () => {
    const future = envelopeV2({ schemaVersion: 99 });
    expect(() => parseUXTraceText(JSON.stringify(future), { source: 'future.json' })).toThrow(
      UXTraceInputError
    );
  });
});
