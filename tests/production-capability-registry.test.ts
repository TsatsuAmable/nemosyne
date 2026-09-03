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
type Registry = { schemaVersion: number; policy: string; capabilities: Capability[] };

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

describe('P1-W production capability registry', () => {
  it('has one explicit classification for every inventoried capability', () => {
    expect(registry.schemaVersion).toBe(1);
    expect(registry.policy.length).toBeGreaterThan(40);

    const ids = registry.capabilities.map((capability) => capability.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(registry.capabilities.length).toBeGreaterThanOrEqual(15);

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
