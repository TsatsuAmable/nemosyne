from pathlib import Path


def replace_one(path: str, old: str, new: str, label: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    p.write_text(text.replace(old, new, 1))


ledger = 'src/atlas/domain/EvidenceLedger.ts'
replace_one(
    ledger,
    "import { Dataset } from '../../data/Dataset.ts';\n",
    "import { Dataset } from '../../data/Dataset.ts';\nimport { DatasetVersionStore, type DatasetVersionRef } from '../../data/DatasetVersionStore.ts';\n",
    'ledger import',
)
replace_one(
    ledger,
    "  private _annotations: Annotation[] = [];\n  private _historyView: AnalysisHistory | null = null;\n",
    "  private _annotations: Annotation[] = [];\n  private readonly _datasetVersions = new DatasetVersionStore();\n  private _historyView: AnalysisHistory | null = null;\n",
    'ledger store field',
)
replace_one(
    ledger,
    "  addResult(result: AnalysisResult): void {\n    this._results.push(result);\n  }\n",
    "  addResult(result: AnalysisResult): void {\n    this._results.push(result);\n    this._datasetVersions.register(\n      {\n        datasetVersion: result.datasetVersion,\n        datasetFingerprint: result.datasetFingerprint,\n      },\n      result.dataset\n    );\n  }\n",
    'addResult registration',
)
replace_one(
    ledger,
    "    this._annotations = [];\n    this._resultCounter = 0;\n",
    "    this._annotations = [];\n    this._datasetVersions.clear();\n    this._resultCounter = 0;\n",
    'reset store',
)
replace_one(
    ledger,
    "    this._results = results.slice();\n    this._ledger = ledger.slice();\n",
    "    this._results = results.slice();\n    this._datasetVersions.clear();\n    for (const result of this._results) {\n      this._datasetVersions.register(\n        {\n          datasetVersion: result.datasetVersion,\n          datasetFingerprint: result.datasetFingerprint,\n        },\n        result.dataset\n      );\n    }\n    this._ledger = ledger.slice();\n",
    'restore store',
)
old_history = '''  private _buildHistoryFromLedger(original: Dataset | null): AnalysisHistory {\n    const history = new AnalysisHistory();\n    let current = original?.clone?.() ?? null;\n    for (const event of this._ledger) {\n      switch (event.kind) {\n        case 'load':\n          current = original?.clone?.() ?? null;\n          break;\n        case 'analysis': {\n          if (!event.result?.dataset) break;\n          const before = current?.clone?.() ?? null;\n          const after = Dataset.fromJSON(event.result.dataset);\n          current = after;\n          const spec = event.command as AnalysisSpec;\n          const label = spec.label ?? spec.operation.op;\n          history.push(label, before, after, spec.operation as Record<string, unknown>);\n          break;\n        }\n        case 'reset': {\n          const before = current?.clone?.() ?? null;\n          current = original?.clone?.() ?? null;\n          if (before) history.push('reset', before, current, {});\n          break;\n        }\n        case 'undo': {\n          const entry = history.undo();\n          if (entry) current = entry.dataset;\n          break;\n        }\n        case 'redo': {\n          const entry = history.redo();\n          if (entry) current = entry.dataset;\n          break;\n        }\n        case 'seek': {\n          const index = (event.command as { index?: number }).index;\n          if (index != null) {\n            const entry = history.seek(index);\n            if (entry) current = entry.dataset;\n          }\n          break;\n        }\n        default:\n          // Non-mutating ledger-only events (`structure`, `recommendation`,\n          // `embodiment`, `preview`, `observation`, `finding`, `annotation`,\n          // `remediation`, `refusal`) intentionally do NOT create undo history\n          // frames — they record evidence/provenance, not dataset transitions.\n          // RF-030: `refusal` is durable provenance for a withheld analytical\n          // attempt; it changes no dataset and so has no history cursor entry.\n          break;\n      }\n    }\n    return history;\n  }\n'''
new_history = '''  private _buildHistoryFromLedger(original: Dataset | null): AnalysisHistory {\n    const loadEvent = this._ledger.find((event) => event.kind === 'load');\n    const originalRef: DatasetVersionRef | null =\n      loadEvent && loadEvent.datasetFingerprint\n        ? {\n            datasetVersion: loadEvent.datasetVersion,\n            datasetFingerprint: loadEvent.datasetFingerprint,\n          }\n        : null;\n\n    const resolvesToOriginal = (ref: DatasetVersionRef): boolean =>\n      Boolean(original && originalRef && ref.datasetFingerprint === originalRef.datasetFingerprint);\n\n    const materialize = (ref: DatasetVersionRef): Dataset | null =>\n      this._datasetVersions.materialize(ref) ??\n      (resolvesToOriginal(ref) ? original!.clone() : null);\n\n    const rowCountFor = (ref: DatasetVersionRef | null): number | undefined => {\n      if (!ref) return undefined;\n      const descriptor = this._datasetVersions.describe(ref);\n      if (descriptor) return descriptor.rowCount;\n      return resolvesToOriginal(ref) ? original!.rowCount : undefined;\n    };\n\n    const history = new AnalysisHistory({ resolveDatasetVersion: materialize });\n    let currentRef = originalRef ? { ...originalRef } : null;\n\n    for (const event of this._ledger) {\n      switch (event.kind) {\n        case 'load':\n          currentRef = event.datasetFingerprint\n            ? {\n                datasetVersion: event.datasetVersion,\n                datasetFingerprint: event.datasetFingerprint,\n              }\n            : null;\n          break;\n        case 'analysis': {\n          const result = event.result;\n          if (!result?.dataset) break;\n          const spec = result.spec as AnalysisSpec;\n          const beforeRef: DatasetVersionRef = {\n            datasetVersion: spec.datasetVersion,\n            datasetFingerprint: spec.datasetFingerprint,\n          };\n          const afterRef: DatasetVersionRef = {\n            datasetVersion: result.datasetVersion,\n            datasetFingerprint: result.datasetFingerprint,\n          };\n          if (!this._datasetVersions.has(afterRef)) {\n            // Legacy/event-only restoration may omit the parallel results array.\n            // Index the already persisted event DatasetJSON without cloning rows.\n            this._datasetVersions.register(afterRef, result.dataset);\n          }\n          const label = spec.label ?? spec.operation.op;\n          history.pushReference(\n            label,\n            beforeRef,\n            afterRef,\n            spec.operation as Record<string, unknown>,\n            {\n              before: rowCountFor(beforeRef),\n              after: result.dataset.rows.length,\n            }\n          );\n          currentRef = afterRef;\n          break;\n        }\n        case 'reset': {\n          const afterRef: DatasetVersionRef | null = event.datasetFingerprint\n            ? {\n                datasetVersion: event.datasetVersion,\n                datasetFingerprint: event.datasetFingerprint,\n              }\n            : originalRef;\n          if (currentRef && afterRef) {\n            history.pushReference('reset', currentRef, afterRef, {}, {\n              before: rowCountFor(currentRef),\n              after: rowCountFor(afterRef),\n            });\n          }\n          currentRef = afterRef ? { ...afterRef } : null;\n          break;\n        }\n        case 'undo': {\n          const ref = history.moveUndoReference();\n          if (ref) currentRef = ref;\n          break;\n        }\n        case 'redo': {\n          const ref = history.moveRedoReference();\n          if (ref) currentRef = ref;\n          break;\n        }\n        case 'seek': {\n          const index = (event.command as { index?: number }).index;\n          if (index != null) {\n            const ref = history.moveSeekReference(index);\n            if (ref) currentRef = ref;\n          }\n          break;\n        }\n        default:\n          // Non-mutating ledger-only events (`structure`, `recommendation`,\n          // `embodiment`, `preview`, `observation`, `finding`, `annotation`,\n          // `remediation`, `refusal`) intentionally do NOT create undo history\n          // frames — they record evidence/provenance, not dataset transitions.\n          // RF-030: `refusal` is durable provenance for a withheld analytical\n          // attempt; it changes no dataset and so has no history cursor entry.\n          break;\n      }\n    }\n    return history;\n  }\n'''
replace_one(ledger, old_history, new_history, 'history builder')

replace_one(
    'src/vr/ui/NarrativeStrip.ts',
    "      const count = frame.datasetAfter?.rowCount ?? frame.datasetBefore?.rowCount;\n",
    "      const count =\n        frame.rowCountAfter ??\n        frame.rowCountBefore ??\n        frame.datasetAfter?.rowCount ??\n        frame.datasetBefore?.rowCount;\n",
    'narrative row count',
)
replace_one(
    'src/vr/coordinators/AnalysisStoryExporter.ts',
    "        rowCountAfter: f.datasetAfter?.rowCount,\n",
    "        rowCountAfter: f.rowCountAfter ?? f.datasetAfter?.rowCount,\n",
    'story row count',
)
