import { describe, expect, it } from 'vitest';
import { rendererRowId } from '../src/data/RowIdentity.ts';

describe('renderer row identity', () => {
  it('is stable for a reused row object across derived JS datasets', () => {
    const row = { id: 1, value: 42 };
    expect(rendererRowId(row)).toBe(rendererRowId(row));
  });

  it('does not collapse equal-valued but distinct rows', () => {
    const first = { value: 42 };
    const second = { value: 42 };
    expect(rendererRowId(first)).not.toBe(rendererRowId(second));
  });

  it('is explicitly process-local rather than content-derived provenance', () => {
    const row = { id: 'alpha' };
    expect(rendererRowId(row)).toMatch(/^row:\d+$/);
  });
});
