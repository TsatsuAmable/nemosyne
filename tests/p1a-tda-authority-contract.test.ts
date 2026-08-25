import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

describe('P1-A TDA analytical authority contract', () => {
  it('keeps Atlas TDA on the durable current capability without Dataset.toJSON rematerialisation', () => {
    const atlas = source('../src/atlas/AtlasCore.ts');
    const start = atlas.indexOf('// --- Parse, Sample & TDA');
    const end = atlas.indexOf('// --- Facts & compatibility FactProvider');

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);

    const tdaBoundary = atlas.slice(start, end);
    expect(tdaBoundary).not.toContain('dataset.toJSON()');
    expect(tdaBoundary).toContain('_requireCurrentTdaHandle(dataset)');
    expect(tdaBoundary).toContain('computePersistenceIntervalsForHandle');
    expect(tdaBoundary).toContain('computeMapperGraphForHandle');
    expect(tdaBoundary).toContain('computeBetti0CurveForHandle');
  });

  it('forbids presentation code from constructing TDA inputs by traversing raw rows', () => {
    const planes = source('../src/vr/artifacts/TDAPlanes.ts');
    const start = planes.indexOf('export function buildTDASummaryGroup');

    expect(start).toBeGreaterThanOrEqual(0);

    const summaryBoundary = planes.slice(start);
    expect(summaryBoundary).not.toMatch(/dataset\.rows/);
    expect(summaryBoundary).not.toMatch(/filterValues\s*:/);
    expect(summaryBoundary).toContain('featureColumns: orderedFeatureColumns');
  });
});
