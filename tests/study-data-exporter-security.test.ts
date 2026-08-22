import { describe, expect, it } from 'vitest';
import { StudyDataExporter } from '../src/study/StudyDataExporter.ts';
import type { CompletedTrialRecord } from '../src/study/StudyHarness.ts';

function trial(overrides: Partial<CompletedTrialRecord> = {}): CompletedTrialRecord {
  return {
    trialId: 'trial-1',
    datasetId: 'dataset-1',
    taskType: 'anomaly_detection',
    condition: 'VR',
    isCorrect: true,
    durationMs: 1000,
    confidenceScore: 5,
    workloadScore: 20,
    interactionEventsCount: 3,
    completedAt: 123456,
    ...overrides,
  } as CompletedTrialRecord;
}

describe('StudyDataExporter CSV security', () => {
  it.each([
    ['trialId', '=1+1'],
    ['datasetId', '+SUM(A1:A2)'],
    ['taskType', '-2+3'],
    ['condition', '@cmd'],
    ['trialId', '   =HYPERLINK("https://example.invalid")'],
  ] as const)('neutralizes spreadsheet formulas in %s for every public CSV export', (field, payload) => {
    const record = trial({ [field]: payload } as Partial<CompletedTrialRecord>);

    for (const csv of [StudyDataExporter.toCSV([record]), StudyDataExporter.toSpreadsheetSafeCSV([record]), StudyDataExporter.toLosslessCSV([record])]) {
      expect(csv).toContain(`'${payload}`);
    }
  });

  it('preserves ordinary cells and RFC-style CSV quoting', () => {
    const record = trial({ trialId: 'trial,"quoted"' });
    const csv = StudyDataExporter.toLosslessCSV([record]);

    expect(csv).toContain('"trial,""quoted"""');
    expect(csv).not.toContain("'trial");
  });
});
