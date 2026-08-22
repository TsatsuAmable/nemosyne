import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dataDir = fileURLToPath(new URL('../../../src/data/', import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

function moduleSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const pattern = /(?:from\s+|import\s*\()\s*['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(pattern)) specifiers.push(match[1]);
  return specifiers;
}

describe('Feature 1: Data layer remains independent of recommendation and VR layers', () => {
  it('F01-TC1: scans a non-empty data source surface', () => {
    expect(sourceFiles(dataDir).length).toBeGreaterThan(0);
  });

  it('F01-TC2: src/data has no reverse imports into Moneta/legacy Draco', () => {
    const violations = sourceFiles(dataDir).flatMap((file) =>
      moduleSpecifiers(readFileSync(file, 'utf8'))
        .filter((specifier) => /(?:^|\/)(?:moneta|draco)(?:\/|$)/i.test(specifier))
        .map((specifier) => `${file}: ${specifier}`)
    );
    expect(violations).toEqual([]);
  });

  it('F01-TC3: src/data has no reverse imports into the VR presentation layer', () => {
    const violations = sourceFiles(dataDir).flatMap((file) =>
      moduleSpecifiers(readFileSync(file, 'utf8'))
        .filter((specifier) => /(?:^|\/)vr(?:\/|$)/i.test(specifier))
        .map((specifier) => `${file}: ${specifier}`)
    );
    expect(violations).toEqual([]);
  });

  it('F01-TC4: every scanned data source file is readable TypeScript source', () => {
    for (const file of sourceFiles(dataDir)) {
      expect(readFileSync(file, 'utf8').trim().length, file).toBeGreaterThan(0);
    }
  });

  it('F01-TC5: the decoupling guard covers both static and dynamic imports', () => {
    expect(moduleSpecifiers("import x from '../moneta/x'; import('../vr/y')")).toEqual([
      '../moneta/x',
      '../vr/y',
    ]);
  });
});
