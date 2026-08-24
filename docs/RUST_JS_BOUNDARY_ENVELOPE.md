# Rust/JS Boundary Envelope

## Purpose

This benchmark characterizes the current Rust/WASM-to-JavaScript dataset boundary without creating JavaScript row objects. It separates two claims that must not be conflated:

1. Rust can ingest, retain, identify and expose borrowed primitive columns for a 10M-row typed dataset.
2. The same columnar handle can produce the compact authoritative `DatasetStructureProfile` required by production Moneta.

The report is an architectural envelope, not a production-promotion gate. Timings describe the named hardware/runtime and should be interpreted as scaling evidence rather than universal latency thresholds. Neither the local Apple Silicon run nor the hosted Linux runner is representative of a Meta Quest 3S: the headset's CPU, memory pressure, Quest Browser WASM implementation and thermal envelope require a physical-device run before any supported-device claim.

## Running the envelope

Build the real WASM package, then run all deterministic scenarios:

```bash
npm run wasm:dev
npm run benchmark:rust-js-boundary -- --json
```

Run an isolated tier while developing:

```bash
npm run benchmark:rust-js-boundary -- --scenario=tall10k --json
npm run benchmark:rust-js-boundary -- --scenario=tall1m --json
npm run benchmark:rust-js-boundary -- --scenario=tall10m --json
```

The scheduled/manual `Rust JS Boundary Envelope` workflow runs the complete 10K-through-10M matrix and publishes the `rust-js-boundary-envelope` artifact.

## Measured contract

For each scenario the artifact records:

- typed payload construction size and latency;
- host allocation/copy latency into WASM;
- Rust typed-column ingest latency and WASM growth;
- canonical SHA-256 fingerprint latency and 64-byte identity transfer;
- cold, warm and reload borrowed-column scans;
- compact `DatasetStructureProfile` generation, transfer and JSON decode when available;
- compatibility row-materialisation count around the evidence request;
- destroy/reload memory retention plus checksum and fingerprint parity.

The final assessment is one of:

- `END_TO_END_10M_BOUNDARY_READY`: resident columnar operation and authoritative compact evidence are both available at 10M;
- `COLUMNAR_CAPACITY_ONLY`: 10M resident operation succeeds but authoritative evidence is unavailable for that handle;
- `BELOW_10M_RESIDENT_CAPACITY`: the 10M resident/reload invariants fail;
- `INCOMPLETE_NO_10M_SCENARIO`: an isolated developer run did not include the 10M tier.

## Local checkpoint finding

The first checkpoint run used Node 25.6.1 on an 8-core Apple M1 Pro with 16 GiB host memory. These are single-run development-baseline values; the hosted workflow artifact is a reproducible second development baseline, not a Quest 3S proxy.

| Tier     |       Payload | Cold host copy | Cold Rust ingest | Cold fingerprint | Cold scan | First WASM growth |
| -------- | ------------: | -------------: | ---------------: | ---------------: | --------: | ----------------: |
| 10K tall |     320,190 B |        0.21 ms |          0.89 ms |          19.6 ms |   0.77 ms |         655,360 B |
| 1M tall  |  32,000,190 B |        4.32 ms |         11.06 ms |       1,034.5 ms |  13.31 ms |      64,487,424 B |
| 10M tall | 320,000,190 B |      114.36 ms |        131.50 ms |      10,601.2 ms | 109.19 ms |     640,221,184 B |

The 10M reload preserved checksum and fingerprint identity, required no additional WASM growth and scanned in 112.75 ms. This proves resident typed-column capacity at 10M on the measured machine.

## Hosted checkpoint finding

GitHub Actions run [32701995846](https://github.com/TsatsuAmable/nemosyne/actions/runs/32701995846) completed the full matrix on Node 24.19.0, Linux x64, four logical Intel Xeon Platinum 8573C CPUs and approximately 16 GiB host memory. The 10M case copied in 74.41 ms, loaded in Rust in 203.58 ms, scanned in 118.26 ms and fingerprinted in 13,036.4 ms. Its reload retained checksum and fingerprint identity with no additional WASM growth. The assessment remained `COLUMNAR_CAPACITY_ONLY`; this hosted result is reproducibility evidence, not a Quest 3S proxy.

The boundary is **not end-to-end ready**:

- `data_compute_structure_profile` returns unavailable for the columnar-only handle at 10K, 1M and 10M;
- the probe causes zero compatibility row materialisations, so it fails closed rather than silently constructing rows;
- Rust-to-JS authoritative evidence transfer is therefore 0 bytes because no evidence is produced;
- canonical fingerprinting scales linearly and dominates the measured 10M path at approximately 10.6 seconds cold and on reload;
- destroyed dataset pages remain retained by wasm32 linear memory, with approximately 640 MB retained after the 10M case.

## Consequence

Nemosyne may claim demonstrated 10M **resident columnar capacity on the measured development machine**, but it must not claim practical 10M end-to-end representation performance or Quest 3S support. The next blocking work is to provide a columnar-native Rust `DatasetStructureProfile`, re-run this envelope to measure real evidence latency and transfer bytes, and then execute the browser benchmark on a physical Quest 3S while recording frame time, memory pressure, thermal behaviour and reduction/LOD output.

The superseded `benchmark:data-boundary` 10M tier is not a substitute. It intentionally creates and rematerializes 10M JavaScript row objects to characterize the former compatibility boundary, which violates the current large-data hot-path invariant.
