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
type ReadinessService = {
  id: string;
  planes: Array<'product' | 'realtime' | 'data' | 'learning'>;
  targetState: string;
  implementationState: string;
  deploymentState: 'DEFERRED_BY_POLICY' | 'NOT_REQUIRED_YET' | 'READY_TO_DEPLOY' | 'DEPLOYED_UNVERIFIED' | 'DEPLOYED_VERIFIED';
  verificationState: string;
  roadmapRefs: string[];
  capabilityRefs: string[];
  sources: string[];
  summary: string;
  obligationRefs: string[];
};
type VerificationObligation = {
  id: string;
  serviceRef: string;
  kind: 'AUTOMATED' | 'EXTERNAL_SERVICE' | 'PHYSICAL_DEVICE' | 'MANUAL';
  state: 'GREEN' | 'FAILING' | 'MISSING' | 'DEFERRED_BY_POLICY' | 'NOT_REQUIRED';
  evidence?: string[];
  expectedEvidence?: string[];
  closure: string;
};
type ReadinessRegistry = {
  schemaVersion: number;
  policy: string;
  deploymentPolicy: {
    state: 'DEFERRED_BY_OWNER' | 'ACTIVE';
    effectiveDate: string;
    reason: string;
    blocksForwardDevelopment: boolean;
  };
  services: ReadinessService[];
  verificationObligations: VerificationObligation[];
};

const root = process.cwd();
const registry = JSON.parse(
  fs.readFileSync(path.join(root, 'governance/production-capabilities.json'), 'utf8')
) as Registry;
const readiness = JSON.parse(
  fs.readFileSync(path.join(root, 'governance/production-readiness.json'), 'utf8')
) as ReadinessRegistry;

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

  it('keeps desired services and deferred deployment obligations explicit', () => {
    expect(readiness.schemaVersion).toBe(1);
    expect(readiness.policy.length).toBeGreaterThan(80);
    expect(readiness.deploymentPolicy.reason.length).toBeGreaterThan(40);
    expect(readiness.deploymentPolicy.blocksForwardDevelopment).toBe(false);
    expect(readiness.deploymentPolicy.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const capabilityIds = new Set(registry.capabilities.map(({ id }) => id));
    const serviceIds = readiness.services.map(({ id }) => id);
    const obligationIds = readiness.verificationObligations.map(({ id }) => id);
    expect(new Set(serviceIds).size).toBe(serviceIds.length);
    expect(new Set(obligationIds).size).toBe(obligationIds.length);
    expect(serviceIds.length).toBeGreaterThanOrEqual(4);

    const obligationById = new Map(
      readiness.verificationObligations.map((obligation) => [obligation.id, obligation])
    );
    const referencedObligations = readiness.services.flatMap(({ obligationRefs }) => obligationRefs);
    expect(new Set(referencedObligations).size).toBe(referencedObligations.length);
    expect(new Set(referencedObligations)).toEqual(new Set(obligationIds));

    for (const service of readiness.services) {
      expect(service.planes.length, service.id).toBeGreaterThan(0);
      for (const plane of service.planes) {
        expect(['product', 'realtime', 'data', 'learning'], `${service.id}: ${plane}`).toContain(plane);
      }
      expect(service.targetState.trim().length, service.id).toBeGreaterThan(3);
      expect(service.implementationState.trim().length, service.id).toBeGreaterThan(3);
      expect(service.summary.trim().length, service.id).toBeGreaterThan(40);
      expect(service.roadmapRefs.length, service.id).toBeGreaterThan(0);
      expect(service.obligationRefs.length, service.id).toBeGreaterThan(0);

      for (const capabilityRef of service.capabilityRefs) {
        expect(capabilityIds.has(capabilityRef), `${service.id}: unknown capability ${capabilityRef}`).toBe(true);
      }
      for (const source of service.sources) {
        expect(exists(source), `${service.id}: missing source ${source}`).toBe(true);
      }
      for (const obligationRef of service.obligationRefs) {
        const obligation = obligationById.get(obligationRef);
        expect(obligation, `${service.id}: unknown obligation ${obligationRef}`).toBeDefined();
        expect(obligation?.serviceRef, obligationRef).toBe(service.id);
      }
    }
  });

  it('forces service-like capability surfaces into the readiness inventory', () => {
    const readinessCapabilityRefs = new Set(
      readiness.services.flatMap(({ capabilityRefs }) => capabilityRefs)
    );
    for (const capability of registry.capabilities.filter(({ id }) => id.endsWith('-service'))) {
      expect(
        readinessCapabilityRefs.has(capability.id),
        `${capability.id} is service-like but absent from production-readiness.json`
      ).toBe(true);
    }

    const readinessSources = new Set(readiness.services.flatMap(({ sources }) => sources));
    for (const exception of registry.rootExceptions.filter(({ root }) => root.endsWith('-service'))) {
      expect(
        readinessSources.has(`src/${exception.root}`),
        `${exception.root} is a service-like root exception but absent from production-readiness.json`
      ).toBe(true);
    }
  });

  it('does not allow missing or deferred verification work to masquerade as green evidence', () => {
    const serviceIds = new Set(readiness.services.map(({ id }) => id));

    for (const obligation of readiness.verificationObligations) {
      expect(serviceIds.has(obligation.serviceRef), obligation.id).toBe(true);
      expect(['AUTOMATED', 'EXTERNAL_SERVICE', 'PHYSICAL_DEVICE', 'MANUAL']).toContain(obligation.kind);
      expect(['GREEN', 'FAILING', 'MISSING', 'DEFERRED_BY_POLICY', 'NOT_REQUIRED']).toContain(
        obligation.state
      );
      expect(obligation.closure.trim().length, obligation.id).toBeGreaterThan(40);

      if (obligation.state === 'GREEN') {
        expect(obligation.evidence?.length, obligation.id).toBeGreaterThan(0);
        expect(obligation.expectedEvidence, obligation.id).toBeUndefined();
        for (const evidence of obligation.evidence ?? []) {
          expect(exists(evidence), `${obligation.id}: missing green evidence ${evidence}`).toBe(true);
          if (obligation.kind === 'AUTOMATED') {
            expect(evidence.startsWith('tests/'), `${obligation.id}: automated evidence must be a test`).toBe(
              true
            );
            expect(/\.(test|spec)\.[cm]?[jt]sx?$/.test(evidence), `${obligation.id}: ${evidence}`).toBe(true);
          }
        }
      }

      if (obligation.state === 'MISSING') {
        expect(obligation.evidence, obligation.id).toBeUndefined();
        if (obligation.kind === 'AUTOMATED') {
          expect(obligation.expectedEvidence?.length, obligation.id).toBeGreaterThan(0);
          for (const expected of obligation.expectedEvidence ?? []) {
            expect(expected.startsWith('tests/'), `${obligation.id}: expected automated evidence`).toBe(true);
            expect(exists(expected), `${obligation.id}: expected evidence already exists; reclassify state`).toBe(
              false
            );
          }
        }
      }

      if (obligation.state === 'DEFERRED_BY_POLICY') {
        expect(readiness.deploymentPolicy.state, obligation.id).toBe('DEFERRED_BY_OWNER');
        expect(obligation.kind, obligation.id).toBe('EXTERNAL_SERVICE');
        expect(obligation.evidence, obligation.id).toBeUndefined();
      }
    }
  });

  it('keeps the human readiness projection discoverable and complete', () => {
    expect(exists('docs/PRODUCTION_READINESS.md')).toBe(true);
    const report = read('docs/PRODUCTION_READINESS.md');
    expect(report).toContain('docs/ROADMAP.md');
    expect(report).toContain(readiness.deploymentPolicy.state);

    for (const service of readiness.services) expect(report, service.id).toContain(service.id);
    for (const obligation of readiness.verificationObligations) {
      expect(report, obligation.id).toContain(obligation.id);
    }
  });

  it('does not use barrel availability as evidence that dormant research systems are production-working', () => {
    const invariantTest = read('tests/architectural-invariants.test.ts');
    expect(invariantTest).not.toContain('MultimodalPerceptionEngine');
    expect(invariantTest).not.toContain('StudyHarness');
    expect(invariantTest).not.toContain('StudyStatisticalAnalyzer');
  });
});
