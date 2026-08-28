from pathlib import Path

root = Path(__file__).resolve().parents[1]

store = root / 'src/data/DatasetVersionStore.ts'
text = store.read_text()
text = text.replace(
    "snapshot.edges?.map((edge) => cloneValue(edge) as DatasetJSON['edges'][number])",
    "snapshot.edges?.map((edge) => cloneValue(edge) as NonNullable<DatasetJSON['edges']>[number])",
)
old = '''  private _setEntry(entry: DatasetVersionEntry): void {\n    this._entries.set(versionKey(entry.ref), entry);\n    if (!this._entriesByFingerprint.has(entry.ref.datasetFingerprint)) {\n      this._entriesByFingerprint.set(entry.ref.datasetFingerprint, entry);\n    }\n  }\n'''
new = '''  private _setEntry(entry: DatasetVersionEntry): void {\n    const key = versionKey(entry.ref);\n    const previous = this._entries.get(key);\n    this._entries.set(key, entry);\n    const fingerprintEntry = this._entriesByFingerprint.get(entry.ref.datasetFingerprint);\n    // Preserve the earliest content entry for fingerprint fallback, except when\n    // this is a metadata refresh of that exact logical entry (for example after\n    // Rust row IDs are hydrated). In that case the fallback must not remain\n    // pinned to stale lineage metadata.\n    if (!fingerprintEntry || fingerprintEntry === previous) {\n      this._entriesByFingerprint.set(entry.ref.datasetFingerprint, entry);\n    }\n  }\n'''
if old not in text:
    raise SystemExit('DatasetVersionStore _setEntry block not found')
store.write_text(text.replace(old, new, 1))

ledger = root / 'src/atlas/domain/EvidenceLedger.ts'
text = ledger.read_text()
needle = '''  registerDatasetVersion(ref: DatasetVersionRef, dataset: Dataset): void {\n    this._datasetVersions.registerBorrowed(ref, dataset);\n  }\n\n'''
replacement = '''  registerDatasetVersion(ref: DatasetVersionRef, dataset: Dataset): void {\n    this._datasetVersions.registerBorrowed(ref, dataset);\n  }\n\n  refreshBorrowedDatasetVersion(ref: DatasetVersionRef, dataset: Dataset): void {\n    if (this._datasetVersions.storageKind(ref) === 'borrowed') {\n      this._datasetVersions.registerBorrowed(ref, dataset);\n    }\n  }\n\n'''
if needle not in text:
    raise SystemExit('EvidenceLedger baseline registration block not found')
ledger.write_text(text.replace(needle, replacement, 1))

atlas = root / 'src/atlas/AtlasCore.ts'
text = atlas.read_text()
needle = '''    const compactRowView = this._canUseWorkerRowView(inputDataset, spec.operation);\n    const res = await this._executionPort.execute<AnalyticalOperationOutput | {\n'''
replacement = '''    const compactRowView = this._canUseWorkerRowView(inputDataset, spec.operation);\n    if (compactRowView && inputDataset) {\n      // The initial baseline may have been indexed before Rust hydrated durable\n      // row IDs. Refresh metadata only when that exact source is still a borrowed\n      // baseline; compact/snapshot historical entries are never overwritten.\n      this._aggregate.ledger.refreshBorrowedDatasetVersion(\n        { datasetVersion: version, datasetFingerprint: inputFingerprint },\n        inputDataset\n      );\n    }\n    const res = await this._executionPort.execute<AnalyticalOperationOutput | {\n'''
if needle not in text:
    raise SystemExit('AtlasCore compact row-view dispatch marker not found')
atlas.write_text(text.replace(needle, replacement, 1))

(root / 'scripts/rf035b2b_metadata_refresh.py').unlink(missing_ok=True)
