# RF-051 worker registration fix-forward — adversarial contract

Date: 28 August 2026
Base: `main@d2c4eb6f36959b233ece81f18a693dc356dc055e`
Stream: B — merged-state review / fix-forward
Status: blockers found after #478

## Invariant

Worker registration must preserve the kernel semantics required by the operations that can consume the registered dataset. A payload labelled `type: "typed"` must be the one governed typed-column ABI (`NTC1`) consumed by Rust/WASM; an optimization may not invent a second wire format, silently discard scientific semantics, or substitute a columnar-only handle where the shared Worker contract still permits row-backed operations.

Row-backed Atlas datasets therefore retain canonical `DatasetJSON` registration until RF-035 provides an operation-aware resident/transfer contract. Explicit NTC1/columnar-first sources remain typed and must expose canonical identity/shape metadata through the same public handle API without forcing row materialisation.

## Authority / production path

Row-backed path:

`AtlasCore.loadDataset()` -> `_setWorkerPayloadFromDataset()` -> `WorkerAnalyticalPort.registerDataset()` -> `analytical.worker.ts::loadRegistrationPayload()` -> Rust `data_load_dataset_json()` -> canonical registry.

Explicit typed path:

`AtlasCore.loadTypedDataset()` -> canonical NTC1 bytes -> Rust `data_load_typed_columns_named()` -> columnar-only entry in the same registry -> public dataset fingerprint/shape metadata -> Worker registration using the original NTC1 payload.

`src/wasm/TypedColumnsCodec.ts` and `wasm/src/data/typed_ingest.rs` define the governed NTC1 data-plane contract. Rust's registry owns canonical identity and shape metadata for both row-backed and columnar-only entries.

## Blockers found on merged #478 and during falsification

### Blocker 1 — private non-NTC1 wire format

#478 introduced `_buildTypedPayloadFromDataset()` for row-backed datasets at >=50,000 rows, but its bytes were a bespoke column-name/length/Float64 layout with no `NTC1` magic or governed type/validity encoding. The Worker nevertheless passed those bytes directly to `loadTypedColumns()`. The implementation selected only `NUMERIC` columns and had no graph-edge representation, so it could be rejected by Rust or silently lose science.

A shape-only unit test of that private buffer passed because it never exercised the real Rust boundary.

### Blocker 2 — automatic columnar substitution was operation-incompatible

Even after replacing the private bytes with valid NTC1, the shared Worker registration is used by generic mutations/statistics as well as handle-native TDA. Columnar-only NTC1 handles deliberately do not materialise a row `Dataset`, while generic `data_operation` still consumes the row-backed `with_dataset` path. Automatically converting arbitrary row-backed datasets to NTC1 would therefore change which kernel operations are valid.

The real-WASM falsifier also exposed that the public `dataset_fingerprint`/shape metadata accessors were row-only even though row-backed and columnar-only entries share one registry. This made genuine explicit typed handles difficult to verify through the ordinary public metadata surface.

## Fix-forward contract

This bounded tranche will:

1. remove #478's automatic row-backed -> typed Worker conversion entirely;
2. keep row-backed Worker registration canonical JSON, regardless of row count, until RF-035 owns operation-aware residency/transfer;
3. preserve explicit NTC1 payloads supplied through `AtlasCore.loadTypedDataset()` as typed registration material;
4. make Rust's public dataset fingerprint, row-count and column-count accessors use canonical registry/columnar metadata so they work for row-backed and columnar-only handles without row materialisation;
5. retain fail-closed Worker fingerprint verification for typed registration.

## Falsifying evidence

Real-WASM regression evidence must prove:

- a >=50,000-row row-backed numeric Atlas dataset remains JSON registration material, rather than being silently substituted with a columnar-only capability;
- an explicit canonical NTC1 Atlas dataset loads successfully, retains NTC1 Worker registration bytes and exposes the same authoritative fingerprint/shape through the public Rust handle metadata surface;
- a >=50,000-row mixed numeric/categorical dataset remains JSON with categorical schema/value intact;
- a >=50,000-row graph dataset remains JSON with edge content intact.

The regression must exercise Atlas's actual registration material and the real Rust/WASM boundary. Restoring the #478 automatic conversion or the old row-only metadata accessors must make it fail.

## Non-goals / dependencies

This tranche does **not** close RF-035 or RF-051. Row-backed Worker registration remains O(N) JSON; asynchronous mutations still return full `DatasetJSON` and can pay Worker -> JS -> Worker rematerialisation; handle-only DatasetSpace projection remains incomplete; and browser/WASM/transfer/GC/device measurements are still required. No generic 10M-row or Quest qualification claim is promoted.

No new durable architecture/public format is introduced. The fix restores the existing distinction between operation-complete row-backed registration and explicitly columnar NTC1 sources while preserving one Rust registry authority.