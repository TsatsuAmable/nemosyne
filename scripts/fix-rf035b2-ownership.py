from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if text.count(old) != 1:
        raise SystemExit(f'{path}: expected one match, found {text.count(old)}')
    p.write_text(text.replace(old, new, 1))

replace_once(
    'src/atlas/domain/AnalyticalState.ts',
    '''  provenance?: unknown;\n  versionBump?: boolean;\n  /** Adopt an Atlas-internal Dataset instance instead of defensively cloning it. */\n  adoptDataset?: boolean;\n}\n''',
    '''  provenance?: unknown;\n  versionBump?: boolean;\n}\n''',
)
replace_once(
    'src/atlas/domain/AnalyticalState.ts',
    '''    const { handle, dataset, fingerprint, versionBump = true, adoptDataset = false } = options;\n    this._sourceRef = null;\n    const nextDataset = adoptDataset ? dataset : (dataset?.clone?.() ?? emptyDataset());\n''',
    '''    const { handle, dataset, fingerprint, versionBump = true } = options;\n    this._sourceRef = null;\n    const nextDataset = dataset?.clone?.() ?? emptyDataset();\n''',
)
replace_once(
    'src/atlas/AtlasCore.ts',
    '''    let json: DatasetJSON;\n    let nextDataset: Dataset;\n    let adoptDataset = false;\n\n''',
    '''    let json: DatasetJSON;\n    let nextDataset: Dataset;\n\n''',
)
replace_once(
    'src/atlas/AtlasCore.ts',
    '''      nextDataset = materialized.dataset;\n      json = materialized.json;\n      adoptDataset = true;\n''',
    '''      nextDataset = materialized.dataset;\n      json = materialized.json;\n''',
)
replace_once(
    'src/atlas/AtlasCore.ts',
    '''        fingerprint: outputHash,\n        versionBump: true,\n        adoptDataset,\n''',
    '''        fingerprint: outputHash,\n        versionBump: true,\n''',
)
replace_once(
    'tests/rf035b2-row-view-transfer.test.ts',
    '''    expect(atlas.dataset.rows).toEqual([beforeRows[1], beforeRows[2], beforeRows[0]]);\n    expect(atlas.dataset.rows[0]).toBe(beforeRows[1]);\n    expect(atlas.dataset.rowIds).toEqual(['rid-b', 'rid-c', 'rid-a']);\n''',
    '''    expect(atlas.dataset.rows).toEqual([beforeRows[1], beforeRows[2], beforeRows[0]]);\n    // Preserve the established Atlas defensive-copy boundary: a stale reference\n    // to the prior dataset must not share mutable top-level row objects with the\n    // newly committed current dataset.\n    expect(atlas.dataset.rows[0]).not.toBe(beforeRows[1]);\n    expect(atlas.dataset.rowIds).toEqual(['rid-b', 'rid-c', 'rid-a']);\n''',
)

p = Path('docs/review-plans/RF035B2_ROW_VIEW_TRANSFER_2026-08-28.md')
text = p.read_text()
text = text.replace(
    "7. Atlas adopts the internally constructed compact Dataset rather than immediately cloning it again. Direct/external dataset setters and ordinary kernel commits retain defensive-clone behavior.\n8. Atlas builds the durable schema-v2 `AnalysisResult.dataset` from the reconstructed dataset so session/replay/digest contracts stay unchanged.\n9. Full-path operations and synchronous execution remain behaviorally unchanged.\n",
    "7. Atlas preserves the established `commitKernelResult()` defensive-copy boundary. The compact reconstruction may borrow source rows transiently, but the committed current Dataset does not share mutable top-level row objects with stale references to the prior Atlas dataset.\n8. Atlas builds the durable schema-v2 `AnalysisResult.dataset` from the reconstructed dataset so session/replay/digest contracts stay unchanged.\n9. Full-path operations and synchronous execution remain behaviorally unchanged.\n",
)
text = text.replace(
    "For eligible edge-free row-preserving operations, Worker -> main transfer becomes O(number of output row IDs) rather than O(rows × columns + nested values). The main-thread current dataset reuses existing source row objects instead of allocating a second transformed row object graph. A schema-v2 durable result snapshot is still materialized on the main thread, so RF-035 remains open.\n",
    "For eligible edge-free row-preserving operations, Worker -> main transfer becomes O(number of output row IDs) rather than O(rows × columns + nested values). Atlas avoids Worker-side row-value serialization and `Dataset.fromJSON()` on the compact path, while retaining its defensive current-dataset clone and the schema-v2 durable result snapshot on the main thread. RF-035 therefore remains open.\n",
)
text += "\n## Post-implementation ownership review\n\nAdversarial review rejected an initial zero-copy commit optimization because `AtlasCore.dataset` is publicly reachable and Dataset rows are not deeply immutable. Reusing the exact prior row objects in the new committed state would let stale references mutate current state. B2A therefore preserves `commitKernelResult()` defensive cloning. This narrows the claim to the proven Worker-transfer and deserialization reduction; any future zero-copy main-thread ownership model requires a separate immutability/borrowing contract.\n"
p.write_text(text)

Path('.github/workflows/rf035b2-ownership-fix.yml').unlink(missing_ok=True)
Path('scripts/fix-rf035b2-ownership.py').unlink(missing_ok=True)
