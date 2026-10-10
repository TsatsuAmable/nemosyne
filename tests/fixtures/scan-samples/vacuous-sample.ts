// Deliberately vacuous scanner fixture: a test block with no assertions.
// NOT a .test.ts file, so vitest never executes it; ast-grep still scans it
// by language. The reviewer-loop contract test pins this as its known
// positive so live findings can be fixed without breaking the scanner proof.
import { describe, it } from 'vitest';

describe('scanner fixture', () => {
  it('is a test block with no assertions', () => {
    const value = 1 + 1;
    void value;
  });
});
