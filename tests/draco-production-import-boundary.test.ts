import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SRC_ROOT = path.resolve(process.cwd(), 'src');
const ALLOWED = new Set([
  'ui/FileLoader.ts',
  'vr/coordinators/LiveStreamCoordinator.ts',
  'vr/coordinators/WorldRendererLifecycle.ts',
]);

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    return entry.isFile() && /\.[cm]?[jt]sx?$/.test(entry.name) ? [absolute] : [];
  });
}

describe('Draco production compatibility boundary', () => {
  it('does not allow new production imports from src/draco', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC_ROOT)) {
      const relative = path.relative(SRC_ROOT, file).replaceAll(path.sep, '/');
      if (relative.startsWith('draco/')) continue;
      const source = fs.readFileSync(file, 'utf8');
      if (!/(?:from\s+['\"]|import\s*\(\s*['\"])[^'\"]*\/draco\//.test(source)) continue;
      if (!ALLOWED.has(relative)) offenders.push(relative);
    }

    expect(offenders, 'new production Draco imports must use Moneta directly').toEqual([]);
  });
});
