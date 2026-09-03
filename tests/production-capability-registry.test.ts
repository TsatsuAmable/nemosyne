import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

type DiscoveryMarker = { path: string; contains: string };
type ForbiddenPublicExport = { path: string; symbols: string[] };
type Capability = {
  id: string;
  classification: 'production' | 'experimental-production' | 'development-only';
  sources: string[];
  entrypoints?: string[];
  discovery?: DiscoveryMarker[];
  evidence?: string[];
  reason?: string;
  forbiddenPublicExports?: ForbiddenPublicExport[];
};
type RootException = {
  root: string;
  classification: 'development-only' | 'compatibility-only';
  reason: string;
};
type Registry = {
  schemaVersion: number;
  policy: string;
  rootExceptions: RootException[];
  capabilities: Capability[];
};

const root = process.cwd();
const registry = JSON.parse(
  fs.readFileSync(path.join(root, 'governance/production-capabilities.json'), 'utf8')
) as Registry;

function exists(repoPath: string): boolean {
  return fs.existsSync(path.join(root, repoPath));
}

function read(repoPath: string): string {
  return fs.readFileSync(path.join(root, repoPath), 'utf8');
}

function topLevelSourceRoot(source: string): string | null {
  if (!source.startsWith('src/')) return null;
  const relative = source.slice('src/'.length);
  const first = relative.split('/')[0];
  if (!first || first.includes('.')) return null;
  return first;
}

describe('P1-W production capability registry', () => {
  it('has one explicit classification for every inventoried capability', () => {
    expect(registry.schemaVersion).toBe(1);
    expect(registry.policy.length).toBeGreaterThan(40);

    const ids = registry.capabilities.map((capability) => capability.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(registry.capabilities.length).toBeGreaterThanOrEqual(20);

    for (const capability of registry.capabilities) {
      expect(['production', 'experimental-production', 'development-only']).toContain(
        capability.classification
      );
      expect(capability.sources.length).toBeGreaterThan(0);
      for (const source of capability.sources) expect(exists(source)).toBe(true);
    }
  });

  it('requires production capabilities to have a real runtime entrypoint, discovery marker, and product-path evidence', () => {
    const productCapabilities = registry.capabilities.filter(
      ({ classification }) => classification !== 'development-only'
    );
    expect(productCapabilities.length).toBeGreaterThan(0);

    for (const capability of productCapabilities) {
      expect(capability.entrypoints?.length, capability.id).toBeGreaterThan(0);
      expect(capability.discovery?.length, capability.id).toBeGreaterThan(0);
      expect(capability.evidence?.length, capability.id).toBeGreaterThan(0);

      for (const entrypoint of capability.entrypoints ?? []) {
        expect(entrypoint.startsWith('src/'), `${capability.id}: ${entrypoint}`).toBe(true);
        expect(exists(entrypoint), `${capability.id}: ${entrypoint}`).toBe(true);
      }

      for (const marker of capability.discovery ?? []) {
        expect(exists(marker.path), `${capability.id}: ${marker.path}`).toBe(true);
        expect(read(marker.path), `${capability.id}: ${marker.contains}`).toContain(marker.contains);
      }

      for (const evidence of capability.evidence ?? []) {
        expect(exists(evidence), `${capability.id}: ${evidence}`).toBe(true);
      }
    }
  });

  it('covers every top-level src domain with a production capability or an explicit root exception', () => {
    const sourceRoots = fs
      .readdirSync(path.join(root, 'src'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== '.agent')
      .map((entry) => entry.name)
      .sort();

    const productRoots = new Set<string>();
    for (const capability of registry.capabilities) {
      if (capability.classification === 'development-only') continue;
      for (const source of capability.sources) {
        const sourceRoot = topLevelSourceRoot(source);
        if (sourceRoot) productRoots.add(sourceRoot);
      }
    }

    const exceptionRoots = registry.rootExceptions.map(({ root: exceptionRoot }) => exceptionRoot);
    expect(new Set(exceptionRoots).size).toBe(exceptionRoots.length);

    for (const exception of registry.rootExceptions) {
      expect(['development-only', 'compatibility-only']).toContain(exception.classification);
      expect(exception.reason.trim().length, exception.root).toBeGreaterThan(20);
      expect(exists(`src/${exception.root}`), exception.root).toBe(true);
      expect(productRoots.has(exception.root), `${exception.root} is both production-covered and excepted`).toBe(
        false
      );
    }

    const exceptions = new Set(exceptionRoots);
    for (const sourceRoot of sourceRoots) {
      expect(
        productRoots.has(sourceRoot) || exceptions.has(sourceRoot),
        `unclassified top-level src domain: ${sourceRoot}`
      ).toBe(true);
    }
  });

  it('keeps development-only exceptions explicit and out of misleading production barrels', () => {
    const devOnly = registry.capabilities.filter(
      ({ classification }) => classification === 'development-only'
    );
    expect(devOnly.length).toBeGreaterThan(0);

    for (const capability of devOnly) {
      expect(capability.reason?.trim().length, capability.id).toBeGreaterThan(20);
      for (const rule of capability.forbiddenPublicExports ?? []) {
        expect(exists(rule.path), `${capability.id}: ${rule.path}`).toBe(true);
        const barrel = read(rule.path);
        for (const symbol of rule.symbols) {
          expect(barrel, `${capability.id}: ${symbol} leaked from ${rule.path}`).not.toContain(symbol);
        }
      }
    }
  });

  it('does not use barrel availability as evidence that dormant research systems are production-working', () => {
    const invariantTest = read('tests/architectural-invariants.test.ts');
    expect(invariantTest).not.toContain('MultimodalPerceptionEngine');
    expect(invariantTest).not.toContain('StudyHarness');
    expect(invariantTest).not.toContain('StudyStatisticalAnalyzer');
  });
});
