# RF-061 Q3E verification rerun — 29 August 2026

**Status:** VERIFIED COMPLETE for RF-061 scope

**Measurement baseline:** `main` at `d1132d998dacc076120d0d8124d308c6b54af113`.

**Measurement PR/head:** #519 at `dcabeb8d131f1b866e46deb4c674bff35f0cd208`.

The measurement branch was reset to the exact baseline before the documentation-only trigger marker was added. `compare` confirmed the marker was the only branch delta: runtime, test, build, WASM, TypeScript and workflow source were identical to the stated `main` baseline.

The governed Q3D/Q3E run was `33244206140`; artifact `9712325393` (`q3d-browser-envelope-pilot`) completed successfully. The measured production identities were:

- production bundle SHA-256: `2fcabd602334e5b15252a49f6b047af524dbd84ee48fe2cae14b57cccf877d4b`;
- WASM SHA-256: `275a1722702a3d43420224d1121fefa4d09ae4d25bc90dc6583a91b5245bc692`.

## Falsification result

| Rows | Controller | Derived settlement after mutation | Requested | Completed | Refused | Failed | Stale | Derived registrations | Structure records |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1,000 | 184.40 ms | 467.21 ms | 1 | 1 | 0 | 0 | 0 | 1 | 2 |
| 8,000 | 617.01 ms | 1,001.10 ms | 1 | 0 | 1 | 0 | 0 | 1 | 0 |
| 32,000 | 817.95 ms | 383.58 ms | 1 | 0 | 1 | 0 | 0 | 1 | 0 |

All three deterministic compact-sort scenarios committed exactly one authoritative dataset-version increment. The Q3E assertion also proved zero duplicate/coalesced schedule for the same version.

The supported 1k case completed and published two authoritative structure records. The 8k and 32k cases terminated through the explicit governed refusal path, published no fabricated structures, and reported zero generic failures and zero stale settlements. The Rust/WASM refusal remained authoritative: persistence reported `resultKind = none` with zero kernel work for the refused scenarios.

This satisfies the RF-061 decision rule. Automatic post-mutation derived recomputation is preserved, version-correct, no longer hidden inside the blocking controller envelope, coalesced to one generation/registration, and distinguishes governed scale refusal from real execution failure.

## Residual whole-pipeline finding

The same artifact exposed a separate presentation/resource-envelope cliff that does **not** invalidate RF-061:

- 8k rendered 8,000 individual node meshes and 4,304 render calls; render settlement after the controller was ~1,289.81 ms;
- 32k had already moved to a compact one-mesh representation with 83 render calls; render settlement after the controller was ~289.86 ms;
- the 8k refused persistence request spent only ~23.35 ms inside the Worker with zero kernel work, while the browser-observed `workerPort.execute.tda.persistence` span was ~1,088.92 ms. The delay therefore cannot be attributed to expensive Rust TDA computation.

This is a measured browser presentation/scheduling threshold problem, not a reason to relax the Rust resource guard or reopen RF-061. It is assigned to the existing RF-051/RF-029 whole-pipeline resource programme, coordinated with RF-001/P1-R representation-scale ownership. The next scale tranche should capture the chosen representation/geometry alongside scene/render counters and falsify the 8k threshold discontinuity before selecting an optimization.

Physical Quest evidence remains required for device frame-pacing/perceptual qualification; this synthetic CI browser artifact is not Quest evidence.
