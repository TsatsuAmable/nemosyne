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
npm run benchmark:rust-js-boundary -- --scenario=tall10m --repeat=3 --json
```

The scheduled/manual `Rust JS Boundary Envelope` workflow runs the complete 10K-through-10M matrix plus three 10M repetitions and publishes both reports in the `rust-js-boundary-envelope` artifact.

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

## Bounded evidence and streaming identity follow-up

The in-progress analytical-core-v3 follow-up keeps canonical SHA-256 identity exact while removing avoidable per-cell lookup, encoding and small-hash-update overhead. Spectral evidence uses an explicitly reported full-series FFT through 65,536 observations and deterministic contiguous mean-pooling of the full observed sequence above that limit. Bootstrap cluster evidence uses all complete rows through 65,536 and a fixed-seed content-hash bottom-k sample of 65,536 complete rows above that limit; canonical sample ordering makes the estimator row-order invariant, and full-population min/max bounds remain authoritative. Both estimators report their method, support, reduction or sample ratio, parameters and limitations through the Rust profile and canonical DatasetEvidence provenance.

The local Apple M1 Pro full matrix measured the following 10M tall result after those changes:

| Metric | Result |
| --- | ---: |
| Canonical fingerprint | 3,383.4 ms |
| Evidence generation | 834.3 ms |
| Evidence write/decode | 0.30 ms |
| Evidence transfer | 3,240 B |
| Rows materialised | 0 |
| Retained WASM after destroy | 640,221,184 B |

A separate three-run 10M local envelope measured fingerprint median/max at 3,385.3/3,921.6 ms, evidence median/max at 839.1/1,734.3 ms and exactly 640,221,184 retained bytes in every run. The first evidence invocation includes process/WASM warm-up; the maximum remains part of the reported envelope. Fingerprint/checksum reload parity held in every run and no evidence request materialised rows.

This improves the merged local baseline from approximately 10.7 seconds fingerprint, 3.2 seconds evidence and 1.25 GB retained WASM. It does not change the scientific identity contract, declare a universal latency threshold or qualify a headset.

The boundary is still **not device ready**:

- exact canonical fingerprinting remains linear in canonical content size;
- the new repeated envelope has not yet been reproduced on the provisioned hosted runner;
- the result has not run in Quest Browser on a physical Meta Quest 3S;
- Quest Browser memory pressure, first-run latency, thermal behaviour and frame-time interaction remain unknown.

## Consequence

Nemosyne may claim demonstrated 10M **resident columnar capacity and a row-free authoritative evidence path on the measured development machine**, plus a materially improved local analytical-core-v3 envelope. It must not claim Quest 3S support. The next blocking work is to reproduce the repeated regression envelope on the provisioned runner and execute the browser benchmark on a physical Quest 3S while recording first-run latency, frame time, memory pressure, thermal behaviour and reduction/LOD output.

The superseded `benchmark:data-boundary` 10M tier is not a substitute. It intentionally creates and rematerializes 10M JavaScript row objects to characterize the former compatibility boundary, which violates the current large-data hot-path invariant.
