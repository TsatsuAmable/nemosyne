from pathlib import Path

root = Path(__file__).resolve().parents[2]

# Preserve the exact AnalysisResult object returned by AtlasCore. Replacing only
# its dataset data-property with the lazy getter releases the transient payload
# without breaking the established result/event object-identity contract.
ledger = root / 'src/atlas/domain/EvidenceLedger.ts'
text = ledger.read_text()
old = '''  private _referenceBackedResult(result: AnalysisResult, ref: DatasetVersionRef): AnalysisResult {\n    const { dataset: _transientDataset, ...rest } = result;\n    const stored = rest as AnalysisResult;\n    Object.defineProperty(stored, 'dataset', {\n      enumerable: true,\n      configurable: false,\n      get: () => {\n        const dataset = this._datasetVersions.materializeJSON(ref);\n        if (!dataset) {\n          throw new Error(`[EvidenceLedger] dataset version ${ref.datasetVersion}:${ref.datasetFingerprint} is unavailable`);\n        }\n        return dataset;\n      },\n    });\n    return stored;\n  }\n'''
new = '''  private _referenceBackedResult(result: AnalysisResult, ref: DatasetVersionRef): AnalysisResult {\n    Object.defineProperty(result, 'dataset', {\n      enumerable: true,\n      configurable: false,\n      get: () => {\n        const dataset = this._datasetVersions.materializeJSON(ref);\n        if (!dataset) {\n          throw new Error(`[EvidenceLedger] dataset version ${ref.datasetVersion}:${ref.datasetFingerprint} is unavailable`);\n        }\n        return dataset;\n      },\n    });\n    return result;\n  }\n'''
if old not in text:
    raise SystemExit('EvidenceLedger reference-backed result block not found')
ledger.write_text(text.replace(old, new, 1))

# Full-result compatibility must preserve the runtime payload exactly. Some
# legacy/mock bridges accepted by the replay suite still return the historical
# columnar JSON shape without rows[]. B2B must not strengthen that boundary.
store = root / 'src/data/DatasetVersionStore.ts'
text = store.read_text()
old = '''function cloneJson(snapshot: DatasetJSON): DatasetJSON {\n  return {\n    name: snapshot.name,\n    columns: cloneColumns(snapshot.columns),\n    rows: snapshot.rows.map(cloneRow),\n    edges: snapshot.edges?.map((edge) => cloneValue(edge) as NonNullable<DatasetJSON['edges']>[number]),\n    ...(snapshot.rowIds ? { rowIds: snapshot.rowIds.slice() } : {}),\n  };\n}\n'''
new = '''function cloneJson(snapshot: DatasetJSON): DatasetJSON {\n  // Full snapshots are a compatibility/persistence boundary. Deep-clone the\n  // payload as received rather than normalising it to the current DatasetJSON\n  // surface: legacy replay fixtures and third-party bridges may still carry\n  // the historical columnar shape without rows[].\n  return cloneValue(snapshot) as DatasetJSON;\n}\n'''
if old not in text:
    raise SystemExit('DatasetVersionStore cloneJson block not found')
text = text.replace(old, new, 1)
old = '''    if (entry.kind === 'snapshot') {\n      return {\n        ref: { ...requestedRef },\n        name: entry.snapshot.name,\n        rowCount: entry.snapshot.rows.length,\n        columnCount: entry.snapshot.columns.length,\n      };\n    }\n'''
new = '''    if (entry.kind === 'snapshot') {\n      return {\n        ref: { ...requestedRef },\n        name: entry.snapshot.name,\n        rowCount: entry.snapshot.rows?.length ?? 0,\n        columnCount: entry.snapshot.columns?.length ?? 0,\n      };\n    }\n'''
if old not in text:
    raise SystemExit('DatasetVersionStore snapshot descriptor block not found')
store.write_text(text.replace(old, new, 1))

# Add focused regressions rather than weakening the existing suites that found
# the compatibility failures.
test = root / 'tests/rf035b2b-compatibility-regressions.test.ts'
test.write_text(r'''import { describe, expect, it } from 'vitest';
import { EvidenceLedger } from '../src/atlas/domain/EvidenceLedger.ts';
import { DatasetVersionStore } from '../src/data/DatasetVersionStore.ts';
import type { AnalysisResult } from '../src/atlas/types.ts';
import type { DatasetJSON } from '../src/data/types.ts';

function analysisResult(dataset: DatasetJSON): AnalysisResult {
  return {
    resultId: 'fp-out:2:filter:1',
    datasetFingerprint: 'fp-out',
    datasetVersion: 2,
    spec: {
      datasetFingerprint: 'fp-in',
      datasetVersion: 1,
      operation: { op: 'filter' },
      algorithmVersion: 'test-kernel',
    },
    dataset,
    metrics: null,
    provenance: null,
    implementationVersion: 'test-kernel',
    outputHash: 'fp-out',
    evidenceStatus: 'exploratory',
  };
}

describe('RF-035B2B compatibility regressions', () => {
  it('preserves the exact AnalysisResult object across results and analysis events', () => {
    const ledger = new EvidenceLedger();
    const dataset: DatasetJSON = {
      name: 'result',
      columns: [{ name: 'value', type: 'NUMERIC' }],
      rows: [{ value: 2 }],
      rowIds: ['r2'],
    };
    const result = analysisResult(dataset);

    ledger.addResult(result);
    const event = ledger.appendEvent({
      timestamp: 1,
      kind: 'analysis',
      command: result.spec,
      result,
      datasetVersion: result.datasetVersion,
      datasetFingerprint: result.datasetFingerprint,
      stateHash: result.outputHash,
    }, 'session');

    expect(ledger.results[0]).toBe(result);
    expect(event.result).toBe(result);
    expect(result.dataset).toStrictEqual(dataset);
  });

  it('deep-clones legacy full snapshots without requiring rows[]', () => {
    const legacy = {
      name: 'legacy-columnar',
      topology: 'TABULAR',
      columns: [{ name: 'value', type: 'float', values: [1, 2, 3] }],
    } as unknown as DatasetJSON;
    const ref = { datasetVersion: 2, datasetFingerprint: 'legacy-fp' };
    const store = new DatasetVersionStore();

    store.register(ref, legacy);

    expect(store.materializeJSON(ref)).toStrictEqual(legacy);
    expect(store.describe(ref)).toMatchObject({ rowCount: 0, columnCount: 1 });
  });
});
''')

# Self-delete the temporary patch mechanism from the net PR tree.
(root / '.github/workflows/rf035b2b-ci-compat-fix.yml').unlink(missing_ok=True)
Path(__file__).unlink(missing_ok=True)
