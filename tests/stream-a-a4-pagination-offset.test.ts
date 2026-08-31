import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Stream A A4 exact datum pagination identity', () => {
  it('resolves an exact datum at the absolute semantic membership offset', () => {
    const source = fs.readFileSync('src/app/dataset/SemanticDetailTransition.ts', 'utf8');

    expect(source).toContain(
      'const exactOffset = context.request.offset + pageOffset;',
    );
    expect(source).toContain('offset: exactOffset,');
    expect(source).not.toContain('const offset = this.snapshotValue.observationIds.indexOf(observationId);');
  });
});
