import { describe, it, expect } from 'vitest';
import { buildReviewBundle, formatReviewBundle, DEFAULT_ACCESSIBILITY } from '../src/utils/ReviewBundle.ts';
import type { PrivacyLevel, TelemetryReport, PerformanceViolation } from '../src/vr/coordinators/types.ts';

function makeCollector(report: Partial<TelemetryReport> = {}) {
  return {
    getReport: (): TelemetryReport => ({
      version: 1,
      timestamp: Date.now(),
      enabled: true,
      session: {
        durationSeconds: 123,
        datasetName: 'sales-table',
        datasetTopology: 'TABULAR',
      },
      frames: {
        count: 1000,
        dropped: 5,
        averageMs: 12,
        lastMs: 14,
        histogram: { under16: 900, under33: 100, under50: 0, under100: 0, over100: 0 },
      },
      operations: { filter: 3, sort: 1 },
      gestures: { pinchTogether: 2 },
      errors: {
        count: 1,
        warnings: 0,
        unhandledRejections: 0,
        last: {
          message: 'sample error',
          time: Date.now(),
          isWarning: false,
        },
      },
      ...report,
    }),
  };
}

function makeBudget(violations: PerformanceViolation[] = []) {
  return {
    getViolations: () => violations,
  };
}

function makeDataset() {
  return {
    name: 'sales-table',
    columns: [
      { name: 'region', type: 'CATEGORICAL' },
      { name: 'revenue', type: 'NUMERIC' },
    ],
    rows: [{ region: 'NA', revenue: 100 }],
    rowCount: 1,
  };
}

describe('buildReviewBundle', () => {
  it('builds a telemetry-only bundle', () => {
    const collector = makeCollector();
    const budget = makeBudget([{ id: 'frameMs', severity: 'warning', message: 'exceeded', value: 20, budget: 16.67 }]);

    const bundle = buildReviewBundle({ telemetryCollector: collector, performanceBudget: budget });

    expect(bundle.version).toBe(1);
    expect(bundle.privacyLevel).toBe('telemetry-only');
    expect(bundle.telemetry.session.datasetName).toBe('sales-table');
    expect(bundle.performance).toHaveLength(1);
    expect(bundle.metadata).toBeUndefined();
    expect(bundle.session).toBeUndefined();
  });

  it('includes metadata at metadata level without row values', () => {
    const collector = makeCollector();
    const budget = makeBudget([]);
    const dataset = makeDataset();

    const bundle = buildReviewBundle({
      telemetryCollector: collector,
      performanceBudget: budget,
      privacyLevel: 'metadata',
      dataset,
      datasetTopology: 'TABULAR',
      sessionDurationSeconds: 60,
    });

    expect(bundle.metadata).toBeDefined();
    expect(bundle.metadata!.datasetName).toBe('sales-table');
    expect(bundle.metadata!.datasetTopology).toBe('TABULAR');
    expect(bundle.metadata!.rowCount).toBe(1);
    expect(bundle.metadata!.columnSchema).toEqual([
      { name: 'region', type: 'CATEGORICAL' },
      { name: 'revenue', type: 'NUMERIC' },
    ]);
    expect(bundle.metadata!.sessionDurationSeconds).toBe(60);
    expect(bundle.metadata!.operations).toEqual({ filter: 3, sort: 1 });
    expect(bundle.metadata!.gestures).toEqual({ pinchTogether: 2 });
    expect(bundle.session).toBeUndefined();
  });

  it('includes full session snapshot at full-session level', () => {
    const collector = makeCollector();
    const budget = makeBudget([]);
    const dataset = makeDataset();
    const sessionSnapshot = { dataset, history: [] };

    const bundle = buildReviewBundle({
      telemetryCollector: collector,
      performanceBudget: budget,
      privacyLevel: 'full-session',
      dataset,
      sessionSnapshot,
      userNotes: 'looks slow on Quest 3',
    });

    expect(bundle.metadata).toBeDefined();
    expect(bundle.session).toBe(sessionSnapshot);
    expect(bundle.userNotes).toBe('looks slow on Quest 3');
  });

  it('sanitizes error messages to a single line', () => {
    const collector = makeCollector({
      errors: {
        count: 1,
        warnings: 0,
        unhandledRejections: 0,
        last: {
          message: `Failed at C:\\Users\\analyst\\file.js:42\n    at nested (https://example.com/app.js:10)`,
          time: 1234567890,
          isWarning: false,
        },
      },
    });
    const budget = makeBudget([]);

    const bundle = buildReviewBundle({ telemetryCollector: collector, performanceBudget: budget });

    expect(bundle.telemetry.errors.last!.message).not.toContain('\n');
    expect(bundle.telemetry.errors.last!.message).not.toContain('https://');
  });

  it('omits empty user notes', () => {
    const collector = makeCollector();
    const budget = makeBudget([]);

    const bundle = buildReviewBundle({
      telemetryCollector: collector,
      performanceBudget: budget,
      userNotes: '',
    });

    expect(bundle.userNotes).toBeUndefined();
  });

  it('throws on invalid privacy level', () => {
    expect(() =>
      buildReviewBundle({
        telemetryCollector: makeCollector(),
        performanceBudget: makeBudget(),
        privacyLevel: 'everything' as PrivacyLevel,
      })
    ).toThrow('Invalid privacyLevel');
  });

  it('throws without telemetry collector', () => {
    expect(() =>
      // @ts-expect-error testing invalid parameter
      buildReviewBundle({ telemetryCollector: null, performanceBudget: makeBudget() })
    ).toThrow('telemetryCollector');
  });

  it('throws without performance budget', () => {
    expect(() =>
      // @ts-expect-error testing invalid parameter
      buildReviewBundle({ telemetryCollector: makeCollector(), performanceBudget: null })
    ).toThrow('performanceBudget');
  });

  it('derives row count from rows array when rowCount getter is absent', () => {
    const collector = makeCollector();
    const budget = makeBudget([]);
    const dataset = { name: 'x', columns: [], rows: [{}, {}, {}] };

    const bundle = buildReviewBundle({
      telemetryCollector: collector,
      performanceBudget: budget,
      privacyLevel: 'metadata',
      dataset,
    });

    expect(bundle.metadata!.rowCount).toBe(3);
  });

  it('handles string column names in dataset schema', () => {
    const collector = makeCollector();
    const budget = makeBudget([]);
    const dataset = { name: 'x', columns: ['raw'], rows: [] };

    const bundle = buildReviewBundle({
      telemetryCollector: collector,
      performanceBudget: budget,
      privacyLevel: 'metadata',
      dataset,
    });

    expect(bundle.metadata!.columnSchema).toEqual([{ name: 'raw', type: 'UNKNOWN' }]);
  });
});

describe('formatReviewBundle', () => {
  it('returns indented JSON', () => {
    const bundle = buildReviewBundle({
      telemetryCollector: makeCollector(),
      performanceBudget: makeBudget([]),
    });
    const formatted = formatReviewBundle(bundle);

    expect(typeof formatted).toBe('string');
    expect(formatted).toContain('"version": 1');
    expect(JSON.parse(formatted)).toEqual(bundle);
  });
});

describe('DEFAULT_ACCESSIBILITY', () => {
  it('exports the default accessibility preset', () => {
    expect(DEFAULT_ACCESSIBILITY.textScale).toBe(1);
    expect(DEFAULT_ACCESSIBILITY.highContrast).toBe(false);
    expect(DEFAULT_ACCESSIBILITY.colorblindMode).toBe('none');
  });
});
