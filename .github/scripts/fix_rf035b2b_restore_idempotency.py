from pathlib import Path

root = Path(__file__).resolve().parents[2]
ledger = root / 'src/atlas/domain/EvidenceLedger.ts'
text = ledger.read_text()
old = '''  ): void {\n    this._results = [];\n    this._resultsById.clear();\n    this._datasetVersions.clear();\n    for (const result of results) this.addResult(result);\n    this._ledger = ledger.map((event) => {\n'''
new = '''  ): void {\n    // RF-035B2B: restore is an input/persistence boundary. Materialize and copy\n    // incoming results before clearing the current version store because an\n    // in-memory session snapshot may be restored repeatedly and may reference\n    // results that were made lazy by an earlier restore. Never attach lazy\n    // getters to caller-owned persisted result objects.\n    const restoredResults = results.map((result) => ({\n      ...result,\n      dataset: result.dataset,\n    }));\n\n    this._results = [];\n    this._resultsById.clear();\n    this._datasetVersions.clear();\n    for (const result of restoredResults) this.addResult(result);\n    this._ledger = ledger.map((event) => {\n'''
if old not in text:
    raise SystemExit('EvidenceLedger restore block not found')
ledger.write_text(text.replace(old, new, 1))

(root / '.github/workflows/rf035b2b-restore-idempotency-fix.yml').unlink(missing_ok=True)
Path(__file__).unlink(missing_ok=True)
