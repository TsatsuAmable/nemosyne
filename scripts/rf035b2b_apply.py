from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace(path: str, old: str, new: str) -> None:
    p = ROOT / path
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing expected block in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))


# DatasetVersionStore: one borrowed/full base plus compact verified row views.
(ROOT / 'src/data/DatasetVersionStore.ts').write_text(r'''import { Dataset } from './Dataset.ts';
import type { DatasetJSON } from './types.ts';

/**
 * Durable logical identity of one investigation dataset state.
 *
 * `datasetVersion` records investigation ordering; `datasetFingerprint` records
 * canonical scientific content identity. Neither field substitutes for the
 * other because equal content may legitimately occur at multiple versions.
 */
export interface DatasetVersionRef {
  datasetVersion: number;
  datasetFingerprint: string;
}

export interface DatasetVersionDescriptor {
  ref: DatasetVersionRef;
  name: string;
  rowCount: number;
  columnCount: number;
}

export interface DatasetRowViewDescriptor {
  name: string;
  columns: DatasetJSON['columns'];
  rowIds: string[];
}

export type DatasetVersionStorageKind = 'borrowed' | 'snapshot' | 'row-view';

type BorrowedEntry = {
  kind: 'borrowed';
  ref: DatasetVersionRef;
  dataset: Dataset;
};

type SnapshotEntry = {
  kind: 'snapshot';
  ref: DatasetVersionRef;
  snapshot: DatasetJSON;
};

type RowViewEntry = {
  kind: 'row-view';
  ref: DatasetVersionRef;
  sourceRef: DatasetVersionRef;
  baseRef: DatasetVersionRef;
  name: string;
  columns: DatasetJSON['columns'];
  rowIds: string[];
};

type DatasetVersionEntry = BorrowedEntry | SnapshotEntry | RowViewEntry;

function versionKey(ref: DatasetVersionRef): string {
  return `${ref.datasetVersion}:${ref.datasetFingerprint}`;
}

function assertRef(ref: DatasetVersionRef): void {
  if (!ref.datasetFingerprint) {
    throw new Error('[DatasetVersionStore] dataset fingerprint is required');
  }
  if (!Number.isSafeInteger(ref.datasetVersion) || ref.datasetVersion < 0) {
    throw new Error('[DatasetVersionStore] dataset version must be a non-negative safe integer');
  }
}

function cloneColumns(columns: DatasetJSON['columns']): DatasetJSON['columns'] {
  return columns.map((column) => ({ name: column.name, type: column.type }));
}

function cloneJson(snapshot: DatasetJSON): DatasetJSON {
  return {
    name: snapshot.name,
    columns: cloneColumns(snapshot.columns),
    rows: snapshot.rows.map((row) => ({ ...row })),
    edges: snapshot.edges?.map((edge) => ({ ...edge })),
    ...(snapshot.rowIds ? { rowIds: snapshot.rowIds.slice() } : {}),
  };
}

function validLineage(rowIds: readonly string[] | undefined, rowCount: number): rowIds is readonly string[] {
  return Boolean(
    rowIds &&
    rowIds.length === rowCount &&
    rowIds.every((id) => typeof id === 'string' && id.length > 0) &&
    new Set(rowIds).size === rowIds.length
  );
}

function columnsEqual(a: DatasetJSON['columns'], b: DatasetJSON['columns']): boolean {
  return a.length === b.length && a.every((column, index) =>
    column.name === b[index]?.name && column.type === b[index]?.type
  );
}

/**
 * Runtime index over dataset states already owned by the investigation.
 *
 * Full/derived results retain a DatasetJSON snapshot. The initial row-backed
 * baseline may be borrowed from AnalyticalState without cloning. A verified
 * RF-035B2 row-preserving result stores only durable output row IDs plus compact
 * metadata and resolves directly against the nearest full/borrowed base.
 *
 * This remains a persistence/orchestration index, not an analytical authority:
 * it never computes membership/order or transforms scientific values.
 */
export class DatasetVersionStore {
  private readonly _entries = new Map<string, DatasetVersionEntry>();
  private readonly _entriesByFingerprint = new Map<string, DatasetVersionEntry>();

  register(ref: DatasetVersionRef, snapshot: DatasetJSON): void {
    assertRef(ref);
    this._setEntry({ kind: 'snapshot', ref: { ...ref }, snapshot });
  }

  registerBorrowed(ref: DatasetVersionRef, dataset: Dataset): void {
    assertRef(ref);
    this._setEntry({ kind: 'borrowed', ref: { ...ref }, dataset });
  }

  registerRowView(
    ref: DatasetVersionRef,
    sourceRef: DatasetVersionRef,
    view: DatasetRowViewDescriptor,
  ): void {
    assertRef(ref);
    assertRef(sourceRef);
    const source = this._resolveEntry(sourceRef);
    if (!source) {
      throw new Error('[DatasetVersionStore] verified row-view source version is unavailable');
    }
    const sourceDescriptor = this._describeEntry(source, sourceRef);
    const sourceRowIds = this._rowIdsForEntry(source);
    if (!validLineage(sourceRowIds, sourceDescriptor.rowCount)) {
      throw new Error('[DatasetVersionStore] verified row-view source has no valid durable row lineage');
    }
    if (!validLineage(view.rowIds, view.rowIds.length)) {
      throw new Error('[DatasetVersionStore] verified row-view output row IDs must be unique and non-empty');
    }
    const allowed = new Set(sourceRowIds);
    if (view.rowIds.some((id) => !allowed.has(id))) {
      throw new Error('[DatasetVersionStore] verified row-view references a row outside its source lineage');
    }
    const sourceColumns = this._columnsForEntry(source);
    if (!columnsEqual(sourceColumns, view.columns)) {
      throw new Error('[DatasetVersionStore] verified row-view schema differs from its source version');
    }
    const baseRef = source.kind === 'row-view' ? source.baseRef : source.ref;
    this._setEntry({
      kind: 'row-view',
      ref: { ...ref },
      sourceRef: { ...sourceRef },
      baseRef: { ...baseRef },
      name: view.name,
      columns: cloneColumns(view.columns),
      rowIds: view.rowIds.slice(),
    });
  }

  storageKind(ref: DatasetVersionRef): DatasetVersionStorageKind | null {
    return this._resolveEntry(ref)?.kind ?? null;
  }

  has(ref: DatasetVersionRef): boolean {
    return this._entries.has(versionKey(ref));
  }

  describe(ref: DatasetVersionRef): DatasetVersionDescriptor | null {
    const entry = this._resolveEntry(ref);
    return entry ? this._describeEntry(entry, ref) : null;
  }

  materializeJSON(ref: DatasetVersionRef): DatasetJSON | null {
    const entry = this._resolveEntry(ref);
    if (!entry) return null;
    if (entry.kind === 'borrowed') return entry.dataset.toJSON();
    if (entry.kind === 'snapshot') return cloneJson(entry.snapshot);

    const base = this._resolveEntry(entry.baseRef);
    if (!base || base.kind === 'row-view') {
      throw new Error('[DatasetVersionStore] verified row-view base version is unavailable');
    }
    const baseJson = base.kind === 'borrowed' ? base.dataset.toJSON() : cloneJson(base.snapshot);
    if (!validLineage(baseJson.rowIds, baseJson.rows.length)) {
      throw new Error('[DatasetVersionStore] verified row-view base has no valid durable row lineage');
    }
    const byId = new Map<string, Record<string, unknown>>();
    for (let index = 0; index < baseJson.rowIds.length; index += 1) {
      byId.set(baseJson.rowIds[index], baseJson.rows[index]);
    }
    const rows = entry.rowIds.map((id) => {
      const row = byId.get(id);
      if (!row) {
        throw new Error(`[DatasetVersionStore] verified row-view base is missing row ${id}`);
      }
      return { ...row };
    });
    return {
      name: entry.name,
      columns: cloneColumns(entry.columns),
      rows,
      edges: undefined,
      rowIds: entry.rowIds.slice(),
    };
  }

  materialize(ref: DatasetVersionRef): Dataset | null {
    const snapshot = this.materializeJSON(ref);
    return snapshot ? Dataset.fromJSON(snapshot) : null;
  }

  clear(): void {
    this._entries.clear();
    this._entriesByFingerprint.clear();
  }

  private _setEntry(entry: DatasetVersionEntry): void {
    this._entries.set(versionKey(entry.ref), entry);
    if (!this._entriesByFingerprint.has(entry.ref.datasetFingerprint)) {
      this._entriesByFingerprint.set(entry.ref.datasetFingerprint, entry);
    }
  }

  private _resolveEntry(ref: DatasetVersionRef): DatasetVersionEntry | null {
    return (
      this._entries.get(versionKey(ref)) ??
      this._entriesByFingerprint.get(ref.datasetFingerprint) ??
      null
    );
  }

  private _rowIdsForEntry(entry: DatasetVersionEntry): readonly string[] | undefined {
    if (entry.kind === 'borrowed') return entry.dataset.rowIds;
    if (entry.kind === 'snapshot') return entry.snapshot.rowIds;
    return entry.rowIds;
  }

  private _columnsForEntry(entry: DatasetVersionEntry): DatasetJSON['columns'] {
    if (entry.kind === 'borrowed') return entry.dataset.columns;
    if (entry.kind === 'snapshot') return entry.snapshot.columns;
    return entry.columns;
  }

  private _describeEntry(entry: DatasetVersionEntry, requestedRef: DatasetVersionRef): DatasetVersionDescriptor {
    if (entry.kind === 'borrowed') {
      return {
        ref: { ...requestedRef },
        name: entry.dataset.name,
        rowCount: entry.dataset.rowCount,
        columnCount: entry.dataset.columnCount,
      };
    }
    if (entry.kind === 'snapshot') {
      return {
        ref: { ...requestedRef },
        name: entry.snapshot.name,
        rowCount: entry.snapshot.rows.length,
        columnCount: entry.snapshot.columns.length,
      };
    }
    return {
      ref: { ...requestedRef },
      name: entry.name,
      rowCount: entry.rowIds.length,
      columnCount: entry.columns.length,
    };
  }
}
''')

# EvidenceLedger: compact result storage and canonical event result references.
p = ROOT / 'src/atlas/domain/EvidenceLedger.ts'
text = p.read_text()
text = text.replace(
    "import { DatasetVersionStore, type DatasetVersionRef } from '../../data/DatasetVersionStore.ts';",
    "import { DatasetVersionStore, type DatasetVersionRef } from '../../data/DatasetVersionStore.ts';"
)
marker = "import type { RemediationProvenance } from '../../moneta/representation/ActionableNil.ts';\n\n"
insert = """import type { RemediationProvenance } from '../../moneta/representation/ActionableNil.ts';\n\nexport interface AnalysisResultStorageHint {\n  kind: 'verified-row-view';\n  sourceRef: DatasetVersionRef;\n}\n\n"""
if marker not in text:
    raise SystemExit('EvidenceLedger import marker missing')
text = text.replace(marker, insert, 1)
text = text.replace(
    "  private _results: AnalysisResult[] = [];\n",
    "  private _results: AnalysisResult[] = [];\n  private readonly _resultsById = new Map<string, AnalysisResult>();\n",
    1,
)
old = """  addResult(result: AnalysisResult): void {\n    this._results.push(result);\n    this._datasetVersions.register(\n      {\n        datasetVersion: result.datasetVersion,\n        datasetFingerprint: result.datasetFingerprint,\n      },\n      result.dataset\n    );\n  }\n"""
new = """  registerDatasetVersion(ref: DatasetVersionRef, dataset: Dataset): void {\n    this._datasetVersions.registerBorrowed(ref, dataset);\n  }\n\n  addResult(result: AnalysisResult, storageHint?: AnalysisResultStorageHint): void {\n    const resultRef: DatasetVersionRef = {\n      datasetVersion: result.datasetVersion,\n      datasetFingerprint: result.datasetFingerprint,\n    };\n\n    if (storageHint?.kind === 'verified-row-view') {\n      if (result.dataset.edges && result.dataset.edges.length > 0) {\n        throw new Error('[EvidenceLedger] verified row-view result cannot carry edges');\n      }\n      const rowIds = result.dataset.rowIds;\n      if (!rowIds || rowIds.length !== result.dataset.rows.length) {\n        throw new Error('[EvidenceLedger] verified row-view result requires aligned durable row IDs');\n      }\n      this._datasetVersions.registerRowView(resultRef, storageHint.sourceRef, {\n        name: result.dataset.name,\n        columns: result.dataset.columns,\n        rowIds,\n      });\n    } else {\n      this._datasetVersions.register(resultRef, result.dataset);\n    }\n\n    const stored = this._referenceBackedResult(result, resultRef);\n    this._results.push(stored);\n    this._resultsById.set(stored.resultId, stored);\n  }\n\n  materializedResults(): AnalysisResult[] {\n    return this._results.map((result) => ({ ...result }));\n  }\n\n  materializedLedger(): ResearchEvent[] {\n    return this._ledger.map((event) =>\n      event.result ? { ...event, result: { ...event.result } } : { ...event }\n    );\n  }\n"""
if old not in text:
    raise SystemExit('EvidenceLedger addResult block missing')
text = text.replace(old, new, 1)
old = """    const fullEvent: ResearchEvent = {\n      ...event,\n      eventId: `${sessionId}:${this._eventCounter}`,\n      sessionId,\n    };\n"""
new = """    const canonicalResult = event.result\n      ? this._resultsById.get(event.result.resultId) ?? event.result\n      : undefined;\n    const fullEvent: ResearchEvent = {\n      ...event,\n      ...(canonicalResult ? { result: canonicalResult } : {}),\n      eventId: `${sessionId}:${this._eventCounter}`,\n      sessionId,\n    };\n"""
if old not in text:
    raise SystemExit('EvidenceLedger appendEvent block missing')
text = text.replace(old, new, 1)
text = text.replace(
    "    this._results = [];\n",
    "    this._results = [];\n    this._resultsById.clear();\n",
    1,
)
old = """    this._results = results.slice();\n    this._datasetVersions.clear();\n    for (const result of this._results) {\n      this._datasetVersions.register(\n        {\n          datasetVersion: result.datasetVersion,\n          datasetFingerprint: result.datasetFingerprint,\n        },\n        result.dataset\n      );\n    }\n    this._ledger = ledger.slice();\n"""
new = """    this._results = [];\n    this._resultsById.clear();\n    this._datasetVersions.clear();\n    for (const result of results) this.addResult(result);\n    this._ledger = ledger.map((event) => {\n      if (!event.result) return { ...event };\n      const canonicalResult = this._resultsById.get(event.result.resultId);\n      return canonicalResult ? { ...event, result: canonicalResult } : { ...event };\n    });\n"""
if old not in text:
    raise SystemExit('EvidenceLedger restore result block missing')
text = text.replace(old, new, 1)
text = text.replace("          if (!result?.dataset) break;", "          if (!result) break;", 1)
old = """          if (!this._datasetVersions.has(afterRef)) {\n            // Legacy/event-only restoration may omit the parallel results array.\n            // Index the already persisted event DatasetJSON without cloning rows.\n            this._datasetVersions.register(afterRef, result.dataset);\n          }\n          const label = spec.label ?? spec.operation.op;\n          history.pushReference(\n            label,\n            beforeRef,\n            afterRef,\n            spec.operation as Record<string, unknown>,\n            {\n              before: rowCountFor(beforeRef),\n              after: result.dataset.rows.length,\n            }\n          );\n"""
new = """          if (!this._datasetVersions.has(afterRef)) {\n            // Legacy/event-only restoration may omit the parallel results array.\n            // Materialize only in that compatibility case; normal live/results-\n            // backed history remains metadata-only.\n            this._datasetVersions.register(afterRef, result.dataset);\n          }\n          const label = spec.label ?? spec.operation.op;\n          history.pushReference(\n            label,\n            beforeRef,\n            afterRef,\n            spec.operation as Record<string, unknown>,\n            {\n              before: rowCountFor(beforeRef),\n              after: rowCountFor(afterRef),\n            }\n          );\n"""
if old not in text:
    raise SystemExit('EvidenceLedger history analysis block missing')
text = text.replace(old, new, 1)
# Add the lazy-result builder before history construction.
needle = "  private _buildHistoryFromLedger(original: Dataset | null): AnalysisHistory {\n"
helper = """  private _referenceBackedResult(result: AnalysisResult, ref: DatasetVersionRef): AnalysisResult {\n    const { dataset: _transientDataset, ...rest } = result;\n    const stored = rest as AnalysisResult;\n    Object.defineProperty(stored, 'dataset', {\n      enumerable: true,\n      configurable: false,\n      get: () => {\n        const dataset = this._datasetVersions.materializeJSON(ref);\n        if (!dataset) {\n          throw new Error(`[EvidenceLedger] dataset version ${ref.datasetVersion}:${ref.datasetFingerprint} is unavailable`);\n        }\n        return dataset;\n      },\n    });\n    return stored;\n  }\n\n"""
if needle not in text:
    raise SystemExit('EvidenceLedger history method marker missing')
text = text.replace(needle, helper + needle, 1)
p.write_text(text)

# InvestigationAggregate: register the borrowed baseline and make toState the explicit materialization boundary.
p = ROOT / 'src/atlas/domain/InvestigationAggregate.ts'
text = p.read_text()
old = """    const fp = this.analytical.getFingerprint() ?? '';\n    this.ledger.appendEvent(\n"""
new = """    const fp = this.analytical.getFingerprint() ?? '';\n    if (fp && this.analytical.originalNullable) {\n      this.ledger.registerDatasetVersion(\n        { datasetVersion: this.analytical.datasetVersion, datasetFingerprint: fp },\n        this.analytical.originalNullable\n      );\n    }\n    this.ledger.appendEvent(\n"""
if old not in text:
    raise SystemExit('InvestigationAggregate load baseline marker missing')
text = text.replace(old, new, 1)
text = text.replace(
    "      analysisResults: this.ledger.results.slice(),\n      eventLedger: this.ledger.ledger.slice(),\n",
    "      analysisResults: this.ledger.materializedResults(),\n      eventLedger: this.ledger.materializedLedger(),\n",
    1,
)
p.write_text(text)

# AtlasCore: only the already verified B2A compact result licenses compact durable storage.
p = ROOT / 'src/atlas/AtlasCore.ts'
text = p.read_text()
old = """    const outputHash = res.value.outputFingerprint;\n    let json: DatasetJSON;\n    let nextDataset: Dataset;\n\n    if ('kind' in res.value && res.value.kind === 'row-view') {\n"""
new = """    const outputHash = res.value.outputFingerprint;\n    let json: DatasetJSON;\n    let nextDataset: Dataset;\n    let verifiedRowViewSourceRef: { datasetVersion: number; datasetFingerprint: string } | null = null;\n\n    if ('kind' in res.value && res.value.kind === 'row-view') {\n"""
if old not in text:
    raise SystemExit('AtlasCore row-view declaration marker missing')
text = text.replace(old, new, 1)
old = """      const materialized = this._materializeWorkerRowView(inputDataset, res.value.view, outputHash);\n      nextDataset = materialized.dataset;\n      json = materialized.json;\n"""
new = """      const materialized = this._materializeWorkerRowView(inputDataset, res.value.view, outputHash);\n      nextDataset = materialized.dataset;\n      json = materialized.json;\n      verifiedRowViewSourceRef = {\n        datasetVersion: version,\n        datasetFingerprint: inputFingerprint,\n      };\n"""
if old not in text:
    raise SystemExit('AtlasCore row-view materialization block missing')
text = text.replace(old, new, 1)
# Replace only the async addResult occurrence by anchoring on provenance: res.provenance.
old = """      evidenceStatus: 'exploratory' as EvidenceStatus,\n    };\n\n    this._aggregate.ledger.addResult(result);\n    this._aggregate.ledger.appendEvent(\n"""
new = """      evidenceStatus: 'exploratory' as EvidenceStatus,\n    };\n\n    this._aggregate.ledger.addResult(\n      result,\n      verifiedRowViewSourceRef\n        ? { kind: 'verified-row-view', sourceRef: verifiedRowViewSourceRef }\n        : undefined\n    );\n    this._aggregate.ledger.appendEvent(\n"""
# There are sync and async identical tails. Find the one after `provenance: res.provenance`.
idx = text.find("provenance: res.provenance ?? null")
if idx < 0:
    raise SystemExit('AtlasCore async result provenance marker missing')
post = text[idx:]
if old not in post:
    raise SystemExit('AtlasCore async addResult block missing')
post = post.replace(old, new, 1)
text = text[:idx] + post
p.write_text(text)

# Roadmap reconciliation through #487 and B2B.
p = ROOT / 'docs/ROADMAP.md'
text = p.read_text()
text = text.replace(
    "**Current remote main at roadmap branch cut:** `4808040` (#483 merged). Since the prior snapshot, #479 corrected #478's worker-registration defect by removing automatic row-backed → typed substitution from the shared operation-complete Worker path: row-backed datasets remain canonical JSON and explicitly typed sources retain governed NTC1. #480 landed RF-035A, allowing same-generation Worker mutation outputs to remain resident so Atlas can skip a redundant `Dataset.toJSON()` registration snapshot before the next operation. #481 added merged-state adversarial evidence for dataset-replacement residency revocation. #483 landed RF-035B0, removing the second `Dataset.fromJSON()` performed by `DataOperationController` after Atlas had already committed the authoritative result. RF-035 remains **IMPLEMENTATION PARTIAL / REVIEW ACTIVE** because the Worker still returns full `DatasetJSON` to the main thread and durable result/history/session surfaces still materialise repeated row payloads. #478's title did **not** implement the P1-U6 IceVault/archive/portal tranche; P1-U6 remains partial. Static resource limits remain kernel safety guards, not Quest qualification and not evidence of generic 10M-row support.",
    "**Current remote main at roadmap branch cut:** `0b0f4b5` (#487 merged). Since #483, #485 landed RF-035B1 reference-backed derived history/version-state foundations, #486 fixed branch-point materialisation after undo/seek → new-branch navigation, and #487 landed RF-035B2A: verified edge-free row-preserving `filter`/`sort`/`slice` Worker results transfer authoritative row IDs/order instead of complete row values. #487 deliberately preserves the main-thread defensive dataset clone and schema-v2 result materialisation. RF-035 remains **IMPLEMENTATION PARTIAL / REVIEW ACTIVE** because live durable `AnalysisResult`/event/session state can still retain/materialise repeated row payloads, graph/derived operations retain full Worker results, and browser/Quest whole-pipeline memory evidence remains open. #478's title did **not** implement the P1-U6 IceVault/archive/portal tranche; P1-U6 remains partial. Static resource limits remain kernel safety guards, not Quest qualification and not evidence of generic 10M-row support.",
    1,
)
text = text.replace(
    "with #479 worker-registration correctness, #480 same-generation Worker residency reuse and #483 controller-copy removal landed; next is RF-035B1 canonical dataset-version state/materialise-on-demand foundations before attacking the remaining Worker → JS full-result transfer;",
    "with #479 worker-registration correctness, #480 same-generation Worker residency reuse, #483 controller-copy removal, #485/#486 version-reference/history foundations and #487 compact row-preserving Worker transfer landed; next is RF-035B2B reference-backed durable result/event storage before whole-pipeline measurement;",
    1,
)
text = text.replace(
    "RF-035A and RF-035B0 are landed bounded reductions of avoidable main-thread/transfer work, not closure of RF-035: Worker → JS full-result materialisation and repeated durable row snapshots remain.",
    "RF-035A, RF-035B0, RF-035B1 and RF-035B2A are landed bounded reductions of avoidable main-thread/transfer/history work, not closure of RF-035: graph/derived Worker results plus durable result/session materialisation and measured whole-pipeline evidence remain.",
    1,
)
old_rf035 = "| RF-035 | P1-B/P1-A / large mutation transport | High | #417 fixed Worker input registration and output identity, but the merged architecture still materialises a full `DatasetJSON` Worker result on the main thread and durable result/history/session surfaces can retain repeated row payloads. | **IMPLEMENTATION PARTIAL / REVIEW ACTIVE:** #480/RF-035A keeps successful same-generation mutation outputs Worker-resident and prevents Atlas from constructing a redundant O(N) registration snapshot before the next operation; #481 adds dataset-replacement residency-revocation evidence; #483/RF-035B0 makes `DataOperationController` reuse Atlas's already committed `Dataset` instead of deserialising the same result a second time. Next: RF-035B1 establishes canonical dataset-version state/fingerprint references and materialise-on-demand boundaries without changing replay/provenance semantics; only then should the Worker → JS full-result envelope be reduced. Measure transfer/heap/GC costs under RF-029/RF-051. |"
new_rf035 = "| RF-035 | P1-B/P1-A / large mutation transport | High | #417 fixed Worker input registration and output identity, but repeated mutation transport/materialisation and durable row snapshots remained browser-scale cliffs. | **IMPLEMENTATION PARTIAL / REVIEW ACTIVE:** #480/#481 RF-035A keeps same-generation mutation outputs Worker-resident and removes the redundant JS → Worker registration snapshot; #483 RF-035B0 removes the controller's second result parse; #485/#486 RF-035B1 makes derived history/version navigation reference-backed and fixes branch-point materialisation; #487 RF-035B2A replaces full Worker → JS row-value transfer with authoritative row-ID views for verified edge-free `filter`/`sort`/`slice` results. Current: RF-035B2B makes those verified results reference-backed in live durable result/event storage while preserving schema-v2 materialisation. Remaining after B2B: graph/derived output transfer, session/package materialisation, handle-only/typed state and real browser/WASM transfer/heap/GC/device measurements under RF-015/RF-029/RF-051. |"
if old_rf035 not in text:
    raise SystemExit('ROADMAP RF-035 row missing')
text = text.replace(old_rf035, new_rf035, 1)
text = text.replace(
    "#473/#476 removed live DatasetSpace re-derivation/duplication, #479 restored operation-complete Worker registration semantics, #480 removed the redundant same-generation JS → Worker registration snapshot, and #483 removed the controller result reparse; Worker → JS result materialisation plus history/session/package duplication remain open;",
    "#473/#476 removed live DatasetSpace re-derivation/duplication, #479 restored operation-complete Worker registration semantics, #480 removed the redundant same-generation JS → Worker registration snapshot, #483 removed the controller result reparse, #485/#486 made derived history/version navigation reference-backed, and #487 compacted verified row-preserving Worker results; durable result/session/package duplication plus graph/derived transfer remain open;",
    1,
)
text = text.replace(
    "- [ ] establish canonical dataset-version state so analysis results, history and session/replay surfaces can reference authoritative identity rather than requiring repeated row payloads by construction;\n- [ ] bound or explicitly export large transformed data rather than returning/materialising full Worker → JS `DatasetJSON` by default;",
    "- [x] establish canonical dataset-version state so derived history/navigation can reference authoritative identity without eager historical row reconstruction (#485/#486);\n- [/] bound or explicitly export large transformed data rather than returning/materialising full Worker → JS `DatasetJSON` by default; #487 lands the verified edge-free row-preserving transfer slice, while RF-035B2B/durable state plus graph/derived operations remain;",
    1,
)
text = text.replace(
    "4. **CURRENT: AR-6 RF-051 with RF-029/RF-035**, plus residual RF-030/RF-031 resource/refusal work. Remove/bound full browser/Worker rematerialisation and measure the complete envelope before representation work inherits unsupported scale assumptions.",
    "4. **CURRENT: AR-6 RF-051 with RF-029/RF-035**, plus residual RF-030/RF-031 resource/refusal work. #485/#486/#487 land version-reference history and the first compact Worker-result slice; RF-035B2B now removes retained row-value duplication from verified row-view results before the real browser/Worker/WASM envelope is measured.",
    1,
)
p.write_text(text)

# Remove temporary patch machinery from the resulting tree.
(ROOT / 'scripts/rf035b2b_apply.py').unlink(missing_ok=True)
(ROOT / '.github/workflows/rf035b2b-apply.yml').unlink(missing_ok=True)
