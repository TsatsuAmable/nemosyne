import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

describe('V3 Gate 0 representation authority', () => {
  it('keeps the retired src/draco compatibility shadow tree deleted', () => {
    // The migration window that allowed src/draco as re-export-only adapters
    // is closed. No legacy module tree may reappear alongside src/moneta, so
    // representation authority cannot silently fork back.
    expect(existsSync(join(ROOT, 'src', 'draco'))).toBe(false);
  });
});
