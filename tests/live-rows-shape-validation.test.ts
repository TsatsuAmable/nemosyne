import { describe, expect, it } from 'vitest';

import { normalizeLiveMessage } from '../src/data/connectors/normalize.ts';

/**
 * Regression evidence for RFL-0004: per-row shape validation at the
 * live-ingest trust boundary. The RFL skipped reproducer in
 * tests/rfl-live-rows-shape.test.ts is deliberately untouched here; its
 * conversion remains RFL's act.
 */
describe('normalizeLiveMessage per-row shape validation', () => {
  it('accepts record rows, including nested arrays as values', () => {
    const update = normalizeLiveMessage(
      { rows: [{ a: 1, tags: ['x', 'y'], nested: { b: null } }] },
      'TIME_SERIES',
    );
    expect(update).not.toBeNull();
    expect(update?.rows).toHaveLength(1);
    expect(update?.topology).toBe('TIME_SERIES');
  });

  it.each([[null], [42], ['x'], [[1, 2]], [{ a: 1 }, 7]] as unknown[][])(
    'refuses a rows array containing a non-record entry',
    (rows) => {
      expect(normalizeLiveMessage({ rows } as any)).toBeNull();
    },
  );

  it('preserves the pre-existing missing/empty/non-array refusals', () => {
    expect(normalizeLiveMessage(null)).toBeNull();
    expect(normalizeLiveMessage({})).toBeNull();
    expect(normalizeLiveMessage({ rows: [] })).toBeNull();
    expect(normalizeLiveMessage({ rows: 'nope' })).toBeNull();
  });
});
