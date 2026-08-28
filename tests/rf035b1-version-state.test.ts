// @ts-nocheck
// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { ColumnType, Dataset } from '../src/data/Dataset.ts';
import { canonicalDatasetIdentityHex } from '../src/data/DatasetIdentity.ts';
import { EvidenceLedger } from '../src/atlas/domain/EvidenceLedger.ts';

function json(name: string, values: number[]) {
  return {
    name,
    columns: [
      { name: 'id', type: ColumnType.NUMERIC },
      { name: 'value', type: ColumnType.NUMERIC },
    ],
    rows: values.map((value, index) => ({ id: index + 1, value })),
    rowIds: values.map((_, index) => `${name}:row:${index}`),
  };
}

function result(inputVersion, inputFingerprint, outputVersion, output) {
  const outputFingerprint = canonicalDatasetIdentityHex(output);
  const spec = {
    datasetFingerprint: inputFingerprint,
    datasetVersion: inputVersion,
    operation: { op: 'sort', column: 'value', ascending: true },
    algorithmVersion: 'test-kernel',
    label: 'sort',
  };
  return {
    resultId: `${outputFingerprint}:${outputVersion}:sort`,
    datasetFingerprint: outputFingerprint,
    datasetVersion: outputVersion,
    spec,
    dataset: output,
    metrics: null,
    provenance: null,
    implementationVersion: 'test-kernel',
    outputHash: outputFingerprint,
    evidenceStatus: 'exploratory',
  };
}

function appendAnalysis(ledger, sessionId, analysisResult) {
  ledger.addResult(analysisResult);
  ledger.appendEvent({
    timestamp: analysisResult.datasetVersion,
    kind: 'analysis',
    command: analysisResult.spec,
    result: analysisResult,
    datasetVersion: analysisResult.datasetVersion,
    datasetFingerprint: analysisResult.datasetFingerprint,
    stateHash: analysisResult.datasetFingerprint,
  }, sessionId);
}

describe('RF-035B1 canonical dataset-version history', () => {
  it('builds history from version references without materializing historical rows', () => {
    const ledger = new EvidenceLedger();
    const originalJson = json('original', [30, 10, 20]);
    const firstJson = json('first', [10, 20, 30]);
    const secondJson = json('second', [10, 20]);
    const original = Dataset.fromJSON(originalJson);
    const originalFingerprint = canonicalDatasetIdentityHex(originalJson);

    ledger.appendEvent({
      timestamp: 1,
      kind: 'load',
      command: { op: 'load' },
      datasetVersion: 1,
      datasetFingerprint: originalFingerprint,
      stateHash: originalFingerprint,
    }, 'rf035b1');

    const first = result(1, originalFingerprint, 2, firstJson);
    const second = result(2, first.datasetFingerprint, 3, secondJson);
    appendAnalysis(ledger, 'rf035b1', first);
    appendAnalysis(ledger, 'rf035b1', second);

    const fromJson = vi.spyOn(Dataset, 'fromJSON');
    const clone = vi.spyOn(Dataset.prototype, 'clone');

    const history = ledger.getAnalysisHistory(original);
    const frames = history.frames();

    expect(fromJson).not.toHaveBeenCalled();
    expect(clone).not.toHaveBeenCalled();
    expect(frames).toHaveLength(2);
    expect(frames[0].datasetBefore).toBeNull();
    expect(frames[0].datasetAfter).toBeNull();
    expect(frames[0].datasetBeforeRef).toEqual({
      datasetVersion: 1,
      datasetFingerprint: originalFingerprint,
    });
    expect(frames[0].datasetAfterRef).toEqual({
      datasetVersion: 2,
      datasetFingerprint: first.datasetFingerprint,
    });
    expect(frames[0].rowCountBefore).toBe(3);
    expect(frames[0].rowCountAfter).toBe(3);
    expect(frames[1].rowCountAfter).toBe(2);

    fromJson.mockClear();
    clone.mockClear();
    const undone = history.undo();
    expect(undone?.dataset.rows).toEqual(firstJson.rows);
    expect(undone?.dataset.rowIds).toEqual(firstJson.rowIds);
    expect(fromJson).toHaveBeenCalledTimes(1);
    expect(clone).not.toHaveBeenCalled();

    undone.dataset.rows[0].value = 999;
    history.redo();
    const undoneAgain = history.undo();
    expect(undoneAgain?.dataset.rows[0].value).toBe(10);

    fromJson.mockRestore();
    clone.mockRestore();
  });

  it('keeps equal-content logical versions distinct', () => {
    const ledger = new EvidenceLedger();
    const originalJson = json('same', [10, 20, 30]);
    const original = Dataset.fromJSON(originalJson);
    const fp = canonicalDatasetIdentityHex(originalJson);

    ledger.appendEvent({
      timestamp: 1,
      kind: 'load',
      command: { op: 'load' },
      datasetVersion: 1,
      datasetFingerprint: fp,
      stateHash: fp,
    }, 'rf035b1-same');

    const first = result(1, fp, 2, originalJson);
    const second = result(2, fp, 3, originalJson);
    appendAnalysis(ledger, 'rf035b1-same', first);
    appendAnalysis(ledger, 'rf035b1-same', second);

    const frames = ledger.getAnalysisHistory(original).frames();
    expect(frames[0].datasetAfterRef.datasetFingerprint).toBe(fp);
    expect(frames[1].datasetAfterRef.datasetFingerprint).toBe(fp);
    expect(frames[0].datasetAfterRef.datasetVersion).toBe(2);
    expect(frames[1].datasetAfterRef.datasetVersion).toBe(3);
  });

  it('materializes an undo branch-point when Atlas keeps the numeric version but restores older content', () => {
    const ledger = new EvidenceLedger();
    const originalJson = json('original', [30, 10, 20]);
    const firstJson = json('first', [10, 20, 30]);
    const secondJson = json('second', [10, 20]);
    const branchJson = json('branch', [20, 30]);
    const original = Dataset.fromJSON(originalJson);
    const originalFingerprint = canonicalDatasetIdentityHex(originalJson);

    ledger.appendEvent({
      timestamp: 1,
      kind: 'load',
      command: { op: 'load' },
      datasetVersion: 1,
      datasetFingerprint: originalFingerprint,
      stateHash: originalFingerprint,
    }, 'rf035b1-branch');

    const first = result(1, originalFingerprint, 2, firstJson);
    const second = result(2, first.datasetFingerprint, 3, secondJson);
    appendAnalysis(ledger, 'rf035b1-branch', first);
    appendAnalysis(ledger, 'rf035b1-branch', second);

    ledger.appendEvent({
      timestamp: 4,
      kind: 'undo',
      command: { op: 'undo' },
      datasetVersion: 3,
      datasetFingerprint: first.datasetFingerprint,
      stateHash: first.datasetFingerprint,
    }, 'rf035b1-branch');

    const branch = result(3, first.datasetFingerprint, 4, branchJson);
    appendAnalysis(ledger, 'rf035b1-branch', branch);

    const history = ledger.getAnalysisHistory(original);
    const frames = history.frames();
    expect(frames.map((frame) => frame.datasetAfterRef.datasetVersion)).toEqual([2, 4]);
    expect(frames[1].datasetBeforeRef).toEqual({
      datasetVersion: 3,
      datasetFingerprint: first.datasetFingerprint,
    });
    expect(frames[1].rowCountBefore).toBe(firstJson.rows.length);

    const undoneBranch = history.undo();
    expect(undoneBranch?.dataset.rows).toEqual(firstJson.rows);
    expect(undoneBranch?.dataset.rowIds).toEqual(firstJson.rowIds);
  });
});
