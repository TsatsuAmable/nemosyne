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

- `EVIDENCE_PATH_AVAILABLE_AT_10M`: resident columnar operation and authoritative compact evidence are both available at 10M, without implying device qualification;
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

## Columnar profile follow-up

The next local checkpoint implements the columnar-native profile and uses generation-scoped caches so the ABI size probe computes the evidence once and the write call reuses the serialized result.

| Tier     | Cold fingerprint | Evidence generation | Write + decode | Evidence transfer | Rows materialised | Retained WASM after destroy |
| -------- | ---------------: | ------------------: | -------------: | ----------------: | ----------------: | --------------------------: |
| 1M tall  |       1,036.6 ms |            322.8 ms |        0.29 ms |           2,668 B |                 0 |                96,600,064 B |
| 10M tall |      10,664.8 ms |          3,239.3 ms |        0.31 ms |           2,689 B |                 0 |             1,254,621,184 B |

The status is now `EVIDENCE_PATH_AVAILABLE_AT_10M`, with `deviceQualifiedAt10m: false`. The output matches the row-backed Rust profile on an equivalent mixed numeric, temporal, categorical and missing-value fixture. Cluster evaluation streams columnar buffers rather than reconstructing rows.

GitHub Actions run [32704932983](https://github.com/TsatsuAmable/nemosyne/actions/runs/32704932983) reproduced the available evidence path across the complete matrix on Node 24.19.0, Linux x64, two logical Intel Xeon Platinum 8573C CPUs and approximately 8 GiB host memory. At 10M it copied the payload in 76.01 ms, loaded it in Rust in 187.51 ms, fingerprinted it in 14,060.8 ms and generated the profile in 4,014.4 ms. The write/decode step took 5.76 ms, transferred 2,689 bytes and materialised zero rows. Retained WASM memory after destroy was again 1,254,621,184 bytes. The hosted assessment is `EVIDENCE_PATH_AVAILABLE_AT_10M` with `deviceQualifiedAt10m: false`; it is reproducibility evidence, not a Quest 3S proxy.

The boundary is still **not device ready**:

- cold fingerprinting remains linear and takes approximately 10.7 seconds at 10M on the local development machine;
- full-series evidence generation takes approximately 3.2 seconds at 10M;
- full-series evidence work raises retained wasm32 linear memory to approximately 1.25 GB;
- the result has not run in Quest Browser on a physical Meta Quest 3S;
- repeated provisioned runs are still required to define a regression envelope rather than a single-run threshold.

## Consequence

Nemosyne may claim demonstrated 10M **resident columnar capacity and a row-free authoritative evidence path on the measured development machine**, but it must not claim practical 10M representation performance or Quest 3S support. The next blocking work is to bound or reduce full-series fingerprint/spectral evidence cost, establish repeated provisioned regression envelopes, and execute the browser benchmark on a physical Quest 3S while recording frame time, memory pressure, thermal behaviour and reduction/LOD output.

The superseded `benchmark:data-boundary` 10M tier is not a substitute. It intentionally creates and rematerializes 10M JavaScript row objects to characterize the former compatibility boundary, which violates the current large-data hot-path invariant.
