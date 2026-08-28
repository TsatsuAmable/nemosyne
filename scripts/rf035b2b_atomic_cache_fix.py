from pathlib import Path

root = Path(__file__).resolve().parents[1]
path = root / 'src/data/DatasetVersionStore.ts'
text = path.read_text()
old = '''    for (let index = 0; index < view.rowIds.length; index += 1) {\n      const rowId = view.rowIds[index];\n      const row = view.rows[index];\n      const existing = rowValues.get(rowId);\n      if (existing) {\n        if (!valuesEqual(existing, row)) {\n          throw new Error(`[DatasetVersionStore] verified row ${rowId} changed value within one row-preserving lineage`);\n        }\n        continue;\n      }\n      rowValues.set(rowId, cloneRow(row));\n    }\n\n    this._setEntry({\n'''
new = '''    const pendingRows = new Map<string, Record<string, unknown>>();\n    for (let index = 0; index < view.rowIds.length; index += 1) {\n      const rowId = view.rowIds[index];\n      const row = view.rows[index];\n      const existing = rowValues.get(rowId);\n      if (existing) {\n        if (!valuesEqual(existing, row)) {\n          throw new Error(`[DatasetVersionStore] verified row ${rowId} changed value within one row-preserving lineage`);\n        }\n        continue;\n      }\n      pendingRows.set(rowId, cloneRow(row));\n    }\n    // Validation is transaction-like: do not mutate durable row-value state\n    // until every existing lineage value has passed the equality fence.\n    for (const [rowId, row] of pendingRows) rowValues.set(rowId, row);\n\n    this._setEntry({\n'''
if old not in text:
    raise SystemExit('row cache registration loop not found')
path.write_text(text.replace(old, new, 1))
(root / 'scripts/rf035b2b_atomic_cache_fix.py').unlink(missing_ok=True)
(root / '.github/workflows/rf035b2b-atomic-cache-fix.yml').unlink(missing_ok=True)
