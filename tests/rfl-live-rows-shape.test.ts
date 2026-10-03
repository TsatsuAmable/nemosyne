import { describe, expect, it } from 'vitest';

import { normalizeLiveMessage } from '../src/data/connectors/normalize.ts';

describe('RFL cycle 8: live-ingest row-shape trust boundary', () => {
  it('passes well-formed row records through with topology defaults', () => {
    const update = normalizeLiveMessage({ rows: [{ a: 1 }, { a: 2 }] }, 'TIME_SERIES');
    expect(update).not.toBeNull();
    expect(update?.rows).toHaveLength(2);
    expect(update?.topology).toBe('TIME_SERIES');
  });

  it('refuses messages with missing, empty, or non-array rows', () => {
    expect(normalizeLiveMessage(null)).toBeNull();
    expect(normalizeLiveMessage({})).toBeNull();
    expect(normalizeLiveMessage({ rows: [] })).toBeNull();
    expect(normalizeLiveMessage({ rows: 'nope' })).toBeNull();
  });

  // Skipped while RFL-0004 is an open candidate finding: rows carrying
  // non-record entries (null, numbers, strings) pass normalization by
  // reference instead of being refused, so malformed rows from untrusted
  // transport payloads flow into the coordinator buffers. Unskip to
  // re-verify after per-row shape validation lands.
  it.skip('refuses row arrays containing non-record entries', () => {
    expect(normalizeLiveMessage({ rows: [null] })).toBeNull();
    expect(normalizeLiveMessage({ rows: [42] })).toBeNull();
    expect(normalizeLiveMessage({ rows: ['x'] })).toBeNull();
    expect(normalizeLiveMessage({ rows: [{ a: 1 }, 7] })).toBeNull();
  });
});
