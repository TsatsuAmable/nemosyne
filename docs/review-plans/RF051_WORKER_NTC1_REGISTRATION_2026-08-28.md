# RF-051 worker registration NTC1 fix-forward — adversarial contract

Date: 28 August 2026
Base: `main@d2c4eb6f36959b233ece81f18a693dc356dc055e`
Stream: B — merged-state review / fix-forward
Status: blocker found after #478

## Invariant

Any worker-registration payload labelled `type: "typed"` must use the one governed typed-column ABI (`NTC1`) consumed by Rust/WASM, and it must preserve every scientific column/edge represented by the source dataset. A browser-side optimization may not invent a second wire format or silently discard categorical, temporal, text, unknown, graph, validity or other scientific semantics.

If the canonical compact format cannot represent a row-backed dataset losslessly, registration must retain the canonical JSON path until RF-035 provides a richer durable resident capability or bounded transfer contract.

## Authority / production path

Production path under review:

`AtlasCore.loadDataset()` -> `_setWorkerPayloadFromDataset()` -> `WorkerAnalyticalPort.registerDataset()` -> `analytical.worker.ts::loadRegistrationPayload()` -> `RuntimeBridge.loadTypedColumns()` -> Rust `data_load_typed_columns_named()` -> canonical dataset registry.

`src/wasm/TypedColumnsCodec.ts::encodeTypedColumnsPayload()` is the TypeScript encoder for the Rust `NTC1` format defined in `wasm/src/data/typed_ingest.rs`. Atlas must reuse that codec rather than define a parallel binary layout.

## Blocker found on merged #478

#478 introduced `_buildTypedPayloadFromDataset()` for row-backed datasets at >=50,000 rows, but its bytes were a bespoke column-name/length/Float64 layout with no `NTC1` magic or governed type/validity encoding. The Worker nevertheless passed those bytes directly to `loadTypedColumns()`. The same implementation selected only `NUMERIC` columns, silently dropping mixed-schema semantics, and had no graph-edge representation.

A shape-only unit test of the bespoke buffer therefore passed while the real Rust boundary could reject the payload. This is exactly the production-path evidence failure Stream B is intended to catch.

## Fix-forward contract

This bounded tranche will:

1. remove the bespoke worker-registration encoder from `AtlasCore`;
2. reuse `encodeTypedColumnsPayload()` for canonical `NTC1` bytes;
3. enable the compact path only for edge-free, all-numeric row-backed datasets where the current NTC1 mapping is lossless;
4. preserve JSON registration for mixed-schema and graph datasets rather than dropping scientific semantics;
5. keep Worker-side canonical fingerprint verification unchanged so any identity mismatch fails closed.

## Falsifying evidence

A regression must prove through real WASM that:

- a >=50,000-row numeric Atlas registration payload begins with `NTC1`;
- Rust accepts that exact payload through `loadTypedColumns()` and computes the same canonical dataset fingerprint and shape as Atlas;
- a >=50,000-row mixed numeric/categorical dataset falls back to JSON with its categorical schema/value intact;
- a >=50,000-row graph dataset falls back to JSON with its edge content intact.

The test must inspect the actual Atlas worker-registration material, not independently call the codec and declare success.

## Non-goals / dependencies

This tranche does **not** close RF-035 or RF-051. JSON fallback for mixed/graph datasets remains O(N), asynchronous mutations still return full `DatasetJSON` and can pay Worker -> JS -> Worker rematerialisation, handle-only DatasetSpace projection remains incomplete, and browser/WASM/transfer/GC/device measurements are still required. No generic 10M-row or Quest qualification claim is promoted.

No new durable architecture/public format is introduced. The fix restores the already-governed NTC1/Rust-authority boundary.