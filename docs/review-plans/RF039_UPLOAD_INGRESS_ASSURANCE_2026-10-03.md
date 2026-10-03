# RF-039 Upload Ingress Assurance — Closure Record

Date: 3 October 2026
Base: `main@fa153116860e53a4bb7fab6c355d5a41085a40e4`
Finding: RF-039 (High) — Upload hardening policy is duplicated and production evidence targets the wrong module
Status: VERIFIED COMPLETE

## Invariant

Untrusted tabular/graph artifacts uploaded to Nemosyne must be validated and bounded exclusively along the authoritative production entry path `FileLoaderUI -> AtlasCore -> Rust/WASM analytical kernel -> Dataset`. 

Hardening guarantees must never rely on dead or duplicate JavaScript helper classes (`UploadSanitizer.ts`), shadow parsers, or unit tests over un-wired mocks. Ingress boundaries must fail closed before file allocation or memory exhaustion can occur.

## Production Path

`FileLoaderUI._handleFile()` 
  -> Ingress validation: filename sanitization, pre-read size check (`MAX_IMPORT_BYTES = 256MB`), non-numeric/negative size check, early extension allow-list (`.csv` / `.json`)
  -> `file.arrayBuffer()` -> `Uint8Array` byteLength re-verification
  -> `AtlasCore.parseBytes()`
  -> `RustAnalyticalEvidenceAdapter` -> WASM `RuntimeBridge` (`loadCsv` / `loadJson` -> `parse_csv` / `parse_json`)
  -> `Dataset.fromJSON()` -> `columns.filter(!DANGEROUS_ROW_KEYS)` & `rows.map(sanitizeRow)`
  -> `validateImport()` (`MAX_IMPORT_ROWS = 100_000`, `MAX_IMPORT_COLUMNS = 1_000`, `NO_ROWS`, `NO_COLUMNS`, `ROW_LENGTH_MISMATCH`)
  -> `onLoad({ name, topology, dataset, encodings })`

## Primary Failure Modes Prevented

1. **Pre-read memory exhaustion:** Oversized uploads (>256MB) are rejected before `arrayBuffer()` or `text()` is invoked.
2. **Spoofed or corrupted metadata:** Files with non-numeric, negative, or NaN sizes fail closed before reading. Post-read byte length is also verified.
3. **Unexpected binary/script payloads:** Files with extensions other than `.csv` or `.json` are rejected before reading file content into memory.
4. **Filename injection & traversal:** Malicious names containing `../`, `..\\`, control characters (0-31, 127), null bytes `\0`, or exceeding 128 characters are rejected before reading.
5. **Prototype pollution via CSV:** Headers and row values containing `__proto__`, `constructor`, or `prototype` are parsed by the Rust kernel and sanitized by `Dataset`, completely eliminating dangerous keys from column schemas and row properties without polluting `Object.prototype`.
6. **Prototype pollution via JSON:** Deeply nested exploit payloads are converted to `null` by the Rust parser and recursively stripped by `Dataset`, keeping `Object.prototype` pristine.
7. **Malformed inputs:** Broken or truncated CSV/JSON payloads fail closed in the Rust parser; `FileLoaderUI` captures the error, displays user-facing refusal, clears schema preview, and blocks `onLoad`.
8. **Shape and dimension bombs:** Datasets exceeding 100,000 rows or 1,000 columns, or with row-length mismatches exceeding 5% tolerance, are refused by `validateImport`.
9. **Shadow parser regression:** Rust/WASM remains the single analytical authority; no JavaScript parser fallback is permitted.

## Verification Evidence

- Dedicated live-path adversarial integration suite: `tests/upload-ingress-assurance.test.ts` (15 tests passing in `real-wasm-boundary` lane).
- Live FileLoader DOM harness: `tests/file-loader.test.ts` (12 tests passing in `jsdom-integration` lane).
- Elimination of orphaned helper: `UploadSanitizer.ts` deleted and verified absent from production barrels (`tests/security-hardening.test.ts`).
- Column and row prototype-pollution defense: `src/data/Dataset.ts` sanitizes both columns and deep row objects.
