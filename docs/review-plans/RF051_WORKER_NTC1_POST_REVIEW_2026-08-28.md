# RF-051 worker-registration fix-forward — pre-PR adversarial review

Date: 28 August 2026
Branch head reviewed: `f77ce093986a96e9767304e5b89c07c88b45eadb`
Base: `main@d2c4eb6f36959b233ece81f18a693dc356dc055e`

## Production path attacked

`AtlasCore.loadDataset()` -> `_setWorkerPayloadFromDataset()` -> worker registration material -> `WorkerAnalyticalPort.registerDataset()` -> `analytical.worker.ts::loadRegistrationPayload()` -> `RuntimeBridge.loadTypedColumns()` -> Rust `data_load_typed_columns_named()`.

## Original blocker

Merged #478 generated a private binary layout for >=50k row-backed datasets and labelled it `typed`; the Worker passed those bytes to the canonical Rust NTC1 loader. The buffer lacked the `NTC1` magic/type/validity contract and selected only numeric columns, so the production path could reject large datasets or silently lose mixed/graph scientific semantics.

## Fix review

- Atlas now imports and reuses `encodeTypedColumnsPayload()` rather than owning a second wire format.
- The compact conversion is deliberately restricted to edge-free, all-numeric row-backed datasets.
- Non-finite/missing numeric observations are represented through NTC1 validity bytes rather than silently becoming analytical zero.
- Mixed-schema and graph datasets retain canonical JSON registration; this is slower but lossless and keeps RF-035/RF-051 open honestly.
- Worker-side fingerprint verification remains unchanged, so a typed conversion that does not preserve canonical scientific identity fails closed at registration.
- Temporary implementation workflows self-deleted and are not part of the branch's intended product diff.

## Newly inferred failure modes checked

1. **Self-referential buffer test:** a test could inspect the new bytes without proving Rust accepts them. The new regression loads Atlas's actual payload through real WASM and requires canonical fingerprint/shape parity.
2. **Optimization widens silently:** supporting NTC1 categorical/temporal primitives at codec level does not mean a generic row-backed conversion is automatically safe for every Dataset semantic. The branch intentionally declines that expansion.
3. **Graph semantics disappear:** explicit edges cannot travel in NTC1 today, so any edge-bearing dataset is forced to JSON.
4. **Roadmap overclaim survives code fix:** reconciliation explicitly keeps RF-035, handle-only projection, mixed/graph transfer and measured whole-pipeline qualification open. RF-051 is not `VERIFIED COMPLETE`.

## Disposition

- **BLOCKER:** #478 non-NTC1/lossy typed worker registration — fixed forward on this branch, pending CI and real-WASM regression execution.
- **DEFER:** mixed/graph compact transfer, handle-only DatasetSpace, Worker mutation residency, peak-memory/transfer/GC/device evidence — remain RF-035/RF-051/RF-029 work.
- **DEFER:** P1-U6 IceVault/archive/portal implementation — roadmap corrected; #478 title is not evidence that U6 landed.

Completion remains **IMPLEMENTATION LANDED / REVIEW ACTIVE** if CI is green. This tranche cannot promote RF-051 or P1-U6 to `VERIFIED COMPLETE`.