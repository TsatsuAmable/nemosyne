import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SRC_ROOT = path.resolve(process.cwd(), 'src');

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    return entry.isFile() && /\.[cm]?[jt]sx?$/.test(entry.name) ? [absolute] : [];
  });
}

describe('Draco production compatibility boundary', () => {
  it('allows no production imports from src/draco', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC_ROOT)) {
      const relative = path.relative(SRC_ROOT, file).replaceAll(path.sep, '/');
      if (relative.startsWith('draco/')) continue;
      const source = fs.readFileSync(file, 'utf8');
      const hasDracoImport = /from\s+(?:'|")[^'"]*\/draco\//.test(source)
        || /import\s*\(\s*(?:'|")[^'"]*\/draco\//.test(source);
      if (hasDracoImport) offenders.push(relative);
    }

    expect(offenders, 'production code must import Moneta directly; Draco is compatibility-only').toEqual([]);
  });
});
