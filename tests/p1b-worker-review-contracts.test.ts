import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('P1-B Stream B production-boundary guards', () => {
  it('does not rerun synchronous TDA discovery after asynchronous panel results', () => {
    const tda = source('src/vr/artifacts/TDAPlanes.ts');
    const asyncStart = tda.indexOf('if (atlas.executionPort?.isAsync)');
    const syncStart = tda.indexOf('} else {', asyncStart);
    expect(asyncStart).toBeGreaterThan(-1);
    expect(syncStart).toBeGreaterThan(asyncStart);
    const asyncBranch = tda.slice(asyncStart, syncStart);
    expect(asyncBranch).not.toContain('discoverPersistenceStructures(');
    expect(asyncBranch).not.toContain('discoverMapperStructures(');
    expect(asyncBranch).not.toContain('computePersistenceIntervalsForCurrent(');
    expect(asyncBranch).not.toContain('computeMapperGraphForCurrent(');
  });

  it('keeps worker execution requests identity-only after explicit registration', () => {
    const atlas = source('src/atlas/AtlasCore.ts');
    const first = atlas.indexOf('async computePersistenceIntervalsAsync');
    const end = atlas.indexOf('computeSpectralFacts(', first);
    const asyncTda = atlas.slice(first, end);
    expect(asyncTda).toContain('_registerCurrentDatasetInWorker');
    expect(asyncTda).not.toContain('datasetPayload:');
    expect(asyncTda).not.toContain('handle,');
  });

  it('has no JS fallback for authoritative async output identity', () => {
    const atlas = source('src/atlas/AtlasCore.ts');
    const start = atlas.indexOf('async applyAnalysisAsync');
    const end = atlas.indexOf('resetAnalysis()', start);
    const applyAsync = atlas.slice(start, end);
    expect(applyAsync).toContain('outputFingerprint');
    expect(applyAsync).toContain('produced no authoritative output fingerprint');
    expect(applyAsync).not.toContain('JSON.stringify(json.rows)');
    expect(applyAsync).not.toContain('fnv1aHex(');
  });

  it('does not hard-code generation 1 in Atlas lifecycle supersession', () => {
    const atlas = source('src/atlas/AtlasCore.ts');
    expect(atlas).not.toContain('supersede({ generation: 1');
  });
});
