from pathlib import Path
import re


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'missing expected block in {path}: {old[:80]!r}')
    if text.count(old) != 1:
        raise SystemExit(f'expected one match in {path}, found {text.count(old)}')
    p.write_text(text.replace(old, new, 1))

# Runtime export ABI
replace_once(
    'src/wasm/runtime/RuntimeExports.ts',
    '  dataset_column_count(handle: number): number;\n  dataset_destroy(handle: number): void;\n',
    '  dataset_column_count(handle: number): number;\n  dataset_row_view(handle: number, ptr: number, len: number): number;\n  dataset_destroy(handle: number): void;\n',
)

# Rust compact row-view ABI
replace_once(
    'wasm/src/lib.rs',
    '''#[wasm_bindgen]\npub fn dataset_destroy(handle: u32) {\n    data::destroy_dataset(handle);\n}\n''',
    '''#[wasm_bindgen]\npub fn dataset_row_view(handle: u32, out_ptr: u32, out_len: u32) -> u32 {\n    let json = match data::with_dataset(handle, |dataset| {\n        serde_json::to_string(&serde_json::json!({\n            "name": dataset.name,\n            "rowIds": dataset.row_ids,\n            "rowCount": dataset.row_count(),\n            "columnCount": dataset.column_count(),\n            // `Some([])` is still explicit graph topology in the durable JSON\n            // contract. Compact B2A is limited to datasets with no edge field.\n            "edgesPresent": dataset.edges.is_some(),\n        }))\n        .unwrap_or_default()\n    }) {\n        Some(value) if !value.is_empty() => value,\n        _ => return 0,\n    };\n    write_str_out(&json, out_ptr, out_len)\n}\n\n#[wasm_bindgen]\npub fn dataset_destroy(handle: u32) {\n    data::destroy_dataset(handle);\n}\n''',
)

# JS/WASM bridge compact query
replace_once(
    'src/wasm/runtime/DatasetHandleBridge.ts',
    '''export type TdaExportName =\n  | 'data_compute_mapper_graph'\n  | 'data_compute_persistence_intervals'\n  | 'data_compute_betti0_curve';\n''',
    '''export interface DatasetRowView {\n  name: string;\n  rowIds: string[];\n  rowCount: number;\n  columnCount: number;\n  edgesPresent: boolean;\n}\n\nexport type TdaExportName =\n  | 'data_compute_mapper_graph'\n  | 'data_compute_persistence_intervals'\n  | 'data_compute_betti0_curve';\n''',
)
replace_once(
    'src/wasm/runtime/DatasetHandleBridge.ts',
    '''export function datasetColumnCount(handle: number): number {\n  return getRuntimeExports().dataset_column_count(handle);\n}\n\nexport function destroyDataset(handle: number): void {\n''',
    '''export function datasetColumnCount(handle: number): number {\n  return getRuntimeExports().dataset_column_count(handle);\n}\n\nexport function datasetRowView(handle: number): DatasetRowView | null {\n  const wasm = getRuntimeExports();\n  const json = readStringExport((outPtr, outLen) => wasm.dataset_row_view(handle, outPtr, outLen));\n  if (!json) return null;\n  try {\n    const value = JSON.parse(json) as Partial<DatasetRowView>;\n    if (\n      typeof value.name !== 'string' ||\n      !Array.isArray(value.rowIds) ||\n      value.rowIds.some((id) => typeof id !== 'string' || id.length === 0) ||\n      !Number.isSafeInteger(value.rowCount) ||\n      (value.rowCount ?? -1) < 0 ||\n      !Number.isSafeInteger(value.columnCount) ||\n      (value.columnCount ?? -1) < 0 ||\n      value.rowIds.length !== value.rowCount ||\n      new Set(value.rowIds).size !== value.rowIds.length ||\n      typeof value.edgesPresent !== 'boolean'\n    ) {\n      return null;\n    }\n    return value as DatasetRowView;\n  } catch {\n    return null;\n  }\n}\n\nexport function destroyDataset(handle: number): void {\n''',
)
replace_once(
    'src/wasm/RuntimeBridge.ts',
    '''  datasetRowCount,\n  datasetColumnCount,\n  destroyDataset,\n''',
    '''  datasetRowCount,\n  datasetColumnCount,\n  datasetRowView,\n  destroyDataset,\n''',
)
replace_once(
    'src/wasm/RuntimeBridge.ts',
    '''  type AnalyticalResourceDecision,\n  type AnalyticalResourceEstimate,\n''',
    '''  type DatasetRowView,\n  type AnalyticalResourceDecision,\n  type AnalyticalResourceEstimate,\n''',
)

# Transport result contract
replace_once(
    'src/atlas/ports/AnalyticalExecutionPort.ts',
    "import type { Provenance } from '../../data/types.ts';\n",
    "import type { DatasetJSON, Provenance } from '../../data/types.ts';\n",
)
replace_once(
    'src/atlas/ports/AnalyticalExecutionPort.ts',
    '''export type DatasetPayload = AnalyticalDatasetPayload;\n\nexport interface AnalyticalDatasetRegistration {\n''',
    '''export type DatasetPayload = AnalyticalDatasetPayload;\n\nexport interface AnalyticalRowView {\n  readonly name: string;\n  readonly rowIds: readonly string[];\n  readonly rowCount: number;\n  readonly columnCount: number;\n  readonly edgesPresent: boolean;\n}\n\nexport type AnalyticalOperationOutput =\n  | {\n      readonly kind: 'dataset';\n      readonly dataset: DatasetJSON;\n      readonly outputFingerprint: string;\n    }\n  | {\n      readonly kind: 'row-view';\n      readonly view: AnalyticalRowView;\n      readonly outputFingerprint: string;\n    };\n\nexport interface AnalyticalDatasetRegistration {\n''',
)

# Worker: compact only on explicit Atlas opt-in and lossless row-preserving outputs.
replace_once(
    'src/atlas/ports/analytical.worker.ts',
    '''          let adopted = false;\n          try {\n            const outJson = bridge.getDatasetJson(outHandle);\n            if (!outJson) {\n              throw new Error('Worker kernel operation produced no dataset output');\n            }\n            const outFingerprint = bridge.datasetFingerprint(outHandle);\n            if (!outFingerprint) {\n              throw new Error('Worker kernel operation produced no authoritative output fingerprint');\n            }\n            replaceRegisteredHandle(outFingerprint, outHandle);\n            adopted = true;\n            value = {\n              dataset: outJson,\n              outputFingerprint: outFingerprint,\n            };\n          } finally {\n''',
    '''          let adopted = false;\n          try {\n            const outFingerprint = bridge.datasetFingerprint(outHandle);\n            if (!outFingerprint) {\n              throw new Error('Worker kernel operation produced no authoritative output fingerprint');\n            }\n\n            const operation = req.params.operation as OperationSpec;\n            const compactRequested = req.params.resultMode === 'row-view-if-lossless';\n            const rowPreserving = ['filter', 'sort', 'slice'].includes(operation.op);\n            const rowView = compactRequested && rowPreserving\n              ? bridge.datasetRowView(outHandle)\n              : null;\n\n            if (\n              rowView &&\n              !rowView.edgesPresent &&\n              rowView.rowIds.length === rowView.rowCount &&\n              new Set(rowView.rowIds).size === rowView.rowIds.length\n            ) {\n              value = { kind: 'row-view', view: rowView, outputFingerprint: outFingerprint };\n            } else {\n              const outJson = bridge.getDatasetJson(outHandle);\n              if (!outJson) {\n                throw new Error('Worker kernel operation produced no dataset output');\n              }\n              value = { kind: 'dataset', dataset: outJson, outputFingerprint: outFingerprint };\n            }\n\n            replaceRegisteredHandle(outFingerprint, outHandle);\n            adopted = true;\n          } finally {\n''',
)

# AnalyticalState can adopt an internally-owned row-view Dataset without cloning it.
replace_once(
    'src/atlas/domain/AnalyticalState.ts',
    '''  provenance?: unknown;\n  versionBump?: boolean;\n}\n''',
    '''  provenance?: unknown;\n  versionBump?: boolean;\n  /** Adopt an Atlas-internal Dataset instance instead of defensively cloning it. */\n  adoptDataset?: boolean;\n}\n''',
)
replace_once(
    'src/atlas/domain/AnalyticalState.ts',
    '''    const { handle, dataset, fingerprint, versionBump = true } = options;\n    this._sourceRef = null;\n    const nextDataset = dataset?.clone?.() ?? emptyDataset();\n''',
    '''    const { handle, dataset, fingerprint, versionBump = true, adoptDataset = false } = options;\n    this._sourceRef = null;\n    const nextDataset = adoptDataset ? dataset : (dataset?.clone?.() ?? emptyDataset());\n''',
)

# Atlas compact reconstruction and async result handling.
replace_once(
    'src/atlas/AtlasCore.ts',
    "import { Dataset } from '../data/Dataset.ts';\n",
    "import { Dataset } from '../data/Dataset.ts';\nimport { canonicalDatasetIdentityHex } from '../data/DatasetIdentity.ts';\n",
)
replace_once(
    'src/atlas/AtlasCore.ts',
    "import type { AnalyticalExecutionPort, DatasetPayload } from './ports/AnalyticalExecutionPort.ts';\n",
    "import type { AnalyticalExecutionPort, AnalyticalOperationOutput, AnalyticalRowView, DatasetPayload } from './ports/AnalyticalExecutionPort.ts';\n",
)
replace_once(
    'src/atlas/AtlasCore.ts',
    '''  private async _registerCurrentDatasetInWorker(\n    fingerprint: string,\n    version: number\n  ): Promise<boolean> {\n''',
    '''  private _canUseWorkerRowView(dataset: Dataset | null, operation: OperationSpec): boolean {\n    const rowIds = dataset?.rowIds;\n    return Boolean(\n      dataset &&\n      dataset.edges === undefined &&\n      rowIds &&\n      rowIds.length === dataset.rowCount &&\n      new Set(rowIds).size === rowIds.length &&\n      ['filter', 'sort', 'slice'].includes(operation.op)\n    );\n  }\n\n  private _materializeWorkerRowView(\n    input: Dataset,\n    view: AnalyticalRowView,\n    outputFingerprint: string\n  ): { dataset: Dataset; json: DatasetJSON } {\n    if (input.edges !== undefined || view.edgesPresent) {\n      throw new KernelUnavailableError('[AtlasCore] compact row-view cannot represent dataset edges.');\n    }\n    const sourceIds = input.rowIds;\n    if (\n      !sourceIds ||\n      sourceIds.length !== input.rowCount ||\n      new Set(sourceIds).size !== sourceIds.length ||\n      view.rowCount !== view.rowIds.length ||\n      view.columnCount !== input.columnCount ||\n      new Set(view.rowIds).size !== view.rowIds.length\n    ) {\n      throw new KernelUnavailableError('[AtlasCore] invalid compact row-view identity metadata.');\n    }\n\n    const byId = new Map(sourceIds.map((id, index) => [id, input.rows[index]] as const));\n    const rows = view.rowIds.map((id) => {\n      const row = byId.get(id);\n      if (!row) {\n        throw new KernelUnavailableError(`[AtlasCore] compact row-view references unknown row id ${id}.`);\n      }\n      return row;\n    });\n    const dataset = new Dataset(view.name, input.columns.slice(), rows, undefined, [...view.rowIds]);\n    const json = dataset.toJSON();\n    if (canonicalDatasetIdentityHex(json) !== outputFingerprint) {\n      throw new KernelUnavailableError(\n        '[AtlasCore] compact row-view reconstruction does not match the authoritative output fingerprint.'\n      );\n    }\n    return { dataset, json };\n  }\n\n  private async _registerCurrentDatasetInWorker(\n    fingerprint: string,\n    version: number\n  ): Promise<boolean> {\n''',
)
replace_once(
    'src/atlas/AtlasCore.ts',
    '''    const version = this.datasetVersion;\n    const generation = this._generation;\n    if (!(await this._registerCurrentDatasetInWorker(inputFingerprint, version))) {\n''',
    '''    const version = this.datasetVersion;\n    const generation = this._generation;\n    const inputDataset = this._aggregate.analytical.currentNullable;\n    if (!(await this._registerCurrentDatasetInWorker(inputFingerprint, version))) {\n''',
)
replace_once(
    'src/atlas/AtlasCore.ts',
    '''    const res = await this._executionPort.execute<{\n      dataset: DatasetJSON;\n      outputFingerprint: string;\n    }>({\n''',
    '''    const compactRowView = this._canUseWorkerRowView(inputDataset, spec.operation);\n    const res = await this._executionPort.execute<AnalyticalOperationOutput | {\n      dataset: DatasetJSON;\n      outputFingerprint: string;\n    }>({\n''',
)
replace_once(
    'src/atlas/AtlasCore.ts',
    '''      params: { operation: spec.operation },\n    });\n''',
    '''      params: {\n        operation: spec.operation,\n        ...(compactRowView ? { resultMode: 'row-view-if-lossless' } : {}),\n      },\n    });\n''',
)
replace_once(
    'src/atlas/AtlasCore.ts',
    '''    if (\n      typeof res.value !== 'object' ||\n      !('dataset' in res.value) ||\n      !('outputFingerprint' in res.value) ||\n      typeof res.value.outputFingerprint !== 'string' ||\n      !res.value.outputFingerprint\n    ) {\n      throw new KernelUnavailableError(\n        `[AtlasCore] async op "${spec.operation.op}" produced no authoritative output fingerprint.`\n      );\n    }\n\n    const json = res.value.dataset;\n    const outputHash = res.value.outputFingerprint;\n    const nextDataset = Dataset.fromJSON(json);\n\n    this._aggregate.analytical.commitKernelResult(\n      {\n        handle: 0,\n        dataset: nextDataset,\n        fingerprint: outputHash,\n        versionBump: true,\n      },\n''',
    '''    if (\n      typeof res.value !== 'object' ||\n      !('outputFingerprint' in res.value) ||\n      typeof res.value.outputFingerprint !== 'string' ||\n      !res.value.outputFingerprint\n    ) {\n      throw new KernelUnavailableError(\n        `[AtlasCore] async op "${spec.operation.op}" produced no authoritative output fingerprint.`\n      );\n    }\n\n    const outputHash = res.value.outputFingerprint;\n    let json: DatasetJSON;\n    let nextDataset: Dataset;\n    let adoptDataset = false;\n\n    if ('kind' in res.value && res.value.kind === 'row-view') {\n      if (!compactRowView || !inputDataset) {\n        throw new KernelUnavailableError('[AtlasCore] unexpected compact row-view Worker result.');\n      }\n      const materialized = this._materializeWorkerRowView(inputDataset, res.value.view, outputHash);\n      nextDataset = materialized.dataset;\n      json = materialized.json;\n      adoptDataset = true;\n    } else {\n      // `kind: dataset` is the current production full path. The untagged shape\n      // is retained temporarily for third-party/test execution-port compatibility.\n      const datasetJson = 'dataset' in res.value ? res.value.dataset : null;\n      if (!datasetJson) {\n        throw new KernelUnavailableError(\n          `[AtlasCore] async op "${spec.operation.op}" produced no dataset payload.`\n        );\n      }\n      json = datasetJson;\n      nextDataset = Dataset.fromJSON(json);\n    }\n\n    this._aggregate.analytical.commitKernelResult(\n      {\n        handle: 0,\n        dataset: nextDataset,\n        fingerprint: outputHash,\n        versionBump: true,\n        adoptDataset,\n      },\n''',
)

# Fix the pre-implementation controlled-port tests to use the public setter.
p = Path('tests/rf035b2-row-view-transfer.test.ts')
text = p.read_text()
text, count = re.subn(
    r"const atlas = new AtlasCore\(\{ kernel: kernel as any, executionPort: port \}\);",
    "const atlas = new AtlasCore({ kernel: kernel as any });\n    atlas.setExecutionPort(port);",
    text,
)
if count != 3:
    raise SystemExit(f'expected 3 Atlas test constructor replacements, found {count}')
p.write_text(text)

# Helpers must not survive the patch commit.
Path('.github/workflows/rf035b2-patch.yml').unlink(missing_ok=True)
Path('scripts/apply-rf035b2-row-view.py').unlink(missing_ok=True)
