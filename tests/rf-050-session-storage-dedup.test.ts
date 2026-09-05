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

function payloadDataset(name: string, rowCount: number, payloadBytes: number) {
  return {
    name,
    columns: [
      { name: 'id', type: 'NUMERIC' },
      { name: 'payload', type: 'CATEGORICAL' },
    ],
    rows: Array.from({ length: rowCount }, (_, id) => ({
      id,
      payload: `${id}:`.padEnd(payloadBytes, String(id % 10)),
    })),
  };
}

function jsonBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

describe('RF-050 session persistence dataset deduplication', () => {
  it('stores repeated DatasetJSON values once, pools shared rows, and restores the exact schema-v2 logical snapshot', () => {
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

    expect(compact.storageSchemaVersion).toBe(2);
    expect(Object.keys(compact.datasets)).toHaveLength(2);
    expect(Object.keys(compact.rows)).toHaveLength(3);
    expect(JSON.stringify(compact).match(/"rows"/g)).toHaveLength(1);
    expect(expandSessionSnapshotFromStorage(compact)).toEqual(snapshot);
  });

  it('keeps expensive row payload copies constant across many distinct derived snapshots', () => {
    const baseline = payloadDataset('baseline', 120, 4096);
    const makeSnapshot = (operationCount: number): SessionSnapshot => {
      const derived = Array.from({ length: operationCount }, (_, index) => ({
        ...baseline,
        name: `derived-${index}`,
        rows: baseline.rows.slice(index % 30),
      }));
      return {
        schemaVersion: 2,
        originalDataset: baseline,
        currentDataset: derived.at(-1) ?? baseline,
        analysisResults: derived.map((resultDataset, index) => ({
          resultId: `r${index}`,
          dataset: resultDataset,
        })),
        eventLedger: derived.map((resultDataset, index) => ({
          eventId: `e${index}`,
          result: { dataset: resultDataset },
        })),
      };
    };

    const oneOperation = makeSnapshot(1);
    const fiftyOperations = makeSnapshot(50);
    const compactOne = compactSessionSnapshotForStorage(oneOperation);
    const compactFifty = compactSessionSnapshotForStorage(fiftyOperations);

    // Distinct filters/slices still require lightweight row-order references and
    // per-operation metadata, but the 4 KiB row payload pool must not multiply
    // with operation count. This is the RF-050 bounded-growth invariant.
    expect(Object.keys(compactOne.rows)).toHaveLength(120);
    expect(Object.keys(compactFifty.rows)).toHaveLength(120);

    const logicalGrowth = jsonBytes(fiftyOperations) - jsonBytes(oneOperation);
    const storedGrowth = jsonBytes(compactFifty) - jsonBytes(compactOne);
    expect(storedGrowth).toBeGreaterThan(0);
    expect(storedGrowth).toBeLessThan(logicalGrowth / 8);
    expect(expandSessionSnapshotFromStorage(compactFifty)).toEqual(fiftyOperations);
  });

  it('accepts legacy uncompact schema-v2 records unchanged', () => {
    const legacy: SessionSnapshot = {
      schemaVersion: 2,
      originalDataset: dataset('legacy', [1]),
    };
    expect(expandSessionSnapshotFromStorage(legacy)).toEqual(legacy);
  });

  it('accepts storage-schema-v1 compact records during migration', () => {
    const legacyDataset = dataset('legacy-v1', [1, 2]);
    const legacyCompact = {
      storageSchemaVersion: 1,
      snapshot: {
        schemaVersion: 2,
        originalDataset: { __nemosyneDatasetRef: 'd0' },
      },
      datasets: { d0: legacyDataset },
    };

    expect(expandSessionSnapshotFromStorage(legacyCompact)).toEqual({
      schemaVersion: 2,
      originalDataset: legacyDataset,
    });
  });

  it('fails closed when a compact record contains a dangling dataset reference', () => {
    const compact = compactSessionSnapshotForStorage({
      schemaVersion: 2,
      originalDataset: dataset('baseline', [1]),
    });
    compact.datasets = {};

    expect(() => expandSessionSnapshotFromStorage(compact)).toThrow(/references missing dataset/);
  });

  it('fails closed when a compact record contains a dangling row reference', () => {
    const compact = compactSessionSnapshotForStorage({
      schemaVersion: 2,
      originalDataset: dataset('baseline', [1]),
    });
    compact.rows = {};

    expect(() => expandSessionSnapshotFromStorage(compact)).toThrow(/references missing row/);
  });

  it('fails closed on a malformed storage-v2 envelope instead of reclassifying it as a logical snapshot', () => {
    const malformed = {
      storageSchemaVersion: 2,
      snapshot: {
        schemaVersion: 2,
        originalDataset: { __nemosyneDatasetRef: 'd0' },
      },
      datasets: {
        d0: { metadata: { name: 'broken', columns: [] }, rowRefs: 'not-an-array' },
      },
      rows: {},
    };

    expect(() => expandSessionSnapshotFromStorage(malformed)).toThrow(
      /Unsupported or malformed session storage schema 2/,
    );
  });
});
