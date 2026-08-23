# Bulk Data-Plane Migration

## Decision under test

JSON remains the metadata and control-plane format. Bulk scientific observations are candidates for a typed columnar transport, with Apache Arrow IPC as the preferred interoperable format if the benchmark demonstrates a material advantage without weakening identity, provenance, missingness, or analytical semantics.

## Current compatibility path

`Dataset.toJSON()` -> UTF-8 JSON -> `Dataset::from_js_json()` -> row-major `HashMap<String, Value>` store -> `ColumnarDataset::from_dataset()` -> analytical column views.

The 1M-row profile has shown that this path can take tens of seconds and exceed 1 GiB of WASM memory. PR #283 established that row-ID generation is not the dominant 1M cost and that primitive pointer acquisition is effectively free once the columnar representation exists.

## Phase gate

Before adding Arrow or another binary dependency, the profiler must identify which Rust phase dominates:

1. UTF-8 validation of the incoming compatibility payload;
2. compatibility dataset construction: JSON decoding, row-object/value materialisation, and row identity handling;
3. columnar sidecar construction: row-major to primitive/categorical vectors;
4. registry insertion/other fixed overhead.

If UTF-8 validation dominates, transport encoding itself needs attention before changing storage. If compatibility dataset construction dominates, the next experiment will ingest typed column buffers directly and compare them against JSON at 100K and 1M. If sidecar construction dominates, the next experiment will build column vectors during ingestion rather than walking row maps afterward.

## Architectural boundary

The target architecture is:

- JSON for schema, measurement semantics, provenance, configuration, operation requests, and small results;
- Arrow IPC or equivalent typed buffers for bulk observations and large analytical outputs;
- Rust-owned columnar memory as the canonical resident representation;
- JS access through handles and typed-array views rather than reconstructed row objects;
- row-major objects only as explicit compatibility materialisations.

No storage cutover is authorized by this document alone. Promotion requires 100K/1M performance evidence, analytical parity, deterministic identity, provenance parity, missingness parity, mutation/lifetime tests, and bounded memory amplification.
