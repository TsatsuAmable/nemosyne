import { describe, expect, it } from 'vitest';
import {
  compactSessionSnapshotForStorage,
  expandSessionSnapshotFromStorage,
  type SessionSnapshot,
} from '../src/data/SessionStore.ts';

function dataset(name: string, values: number[]) {
  return {
    name,
    columns: [{ name: 'value', type: 'NUMERIC' }],
    rows: values.map((value) => ({ value })),
  };
}

describe('RF-050 session persistence dataset deduplication', () => {
  it('stores repeated DatasetJSON values once and restores the exact schema-v2 logical snapshot', () => {
    const baseline = dataset('baseline', [1, 2, 3]);
    const derived = dataset('derived', [2, 3]);
    const snapshot: SessionSnapshot = {
      schemaVersion: 2,
      originalDataset: baseline,
      currentDataset: derived,
      analysisHistory: {
        index: 0,
        maxFrames: 50,
        frames: [
          {
            operation: 'filter',
            parameters: {},
            timestamp: 1,
            datasetBefore: baseline,
            datasetAfter: derived,
          },
        ],
      },
      analysisResults: [
        {
          resultId: 'r1',
          dataset: derived,
        },
      ],
      eventLedger: [
        {
          eventId: 'e1',
          result: { dataset: derived },
        },
      ],
    };

    const compact = compactSessionSnapshotForStorage(snapshot);

    expect(Object.keys(compact.datasets)).toHaveLength(2);
    expect(JSON.stringify(compact).match(/\"rows\"/g)).toHaveLength(2);
    expect(expandSessionSnapshotFromStorage(compact)).toEqual(snapshot);
  });

  it('accepts legacy uncompact schema-v2 records unchanged', () => {
    const legacy: SessionSnapshot = {
      schemaVersion: 2,
      originalDataset: dataset('legacy', [1]),
    };
    expect(expandSessionSnapshotFromStorage(legacy)).toEqual(legacy);
  });

  it('fails closed when a compact record contains a dangling dataset reference', () => {
    const compact = compactSessionSnapshotForStorage({
      schemaVersion: 2,
      originalDataset: dataset('baseline', [1]),
    });
    compact.datasets = {};

    expect(() => expandSessionSnapshotFromStorage(compact)).toThrow(/references missing dataset/);
  });
});
