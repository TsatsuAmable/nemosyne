# RF-060 — Authoritative fingerprint retention post-review

**Status:** IMPLEMENTATION LANDED / REVIEW ACTIVE

## Production path attacked

`DataOperationController.applyAsync -> AtlasCore.datasetFingerprint / DatasetSpace -> AnalyticalState -> Rust/WASM fingerprint provider -> Worker registration / operation -> Atlas adoption -> post-operation subscribers`.

The review re-read the real production authority path after implementation rather than treating the new unit tests as sufficient. The cache lives in `AnalyticalState`, where the governed dataset/kernel lifecycle already invalidates or replaces authoritative identity.

## Original failure modes and dispositions

- **Stale fingerprint surviving dataset or kernel state change — PASS.** `loadDataset`, `advanceDataset`, `setCurrentDataset`, `restore`, kernel/handle invalidation and disposal all cross the existing `invalidateHandle` fence, which clears `_authoritativeFingerprint`; focused regressions require a fresh provider call after those transitions.
- **Browser fallback identity promoted into the authoritative cache — PASS.** provider failure still uses the canonical browser fallback for the current call only; the fallback is not retained, and a later valid provider result becomes authoritative.
- **DatasetSpace swallowing a live authority failure — PASS.** when no authoritative scalar is retained, DatasetSpace still calls the live provider directly and propagates a provider exception.
- **Worker mutation output fingerprint replaced by another lookup — PASS.** `commitKernelResult(... fingerprint)` continues to install the explicit authoritative output scalar and subsequent lookup does not call the provider.
- **Performance improvement inferred from nested timings — PASS.** the claim is based on a same-harness post-fix Q3D staircase, and the ~940.8 ms pre-fix fingerprint-stage sum is explicitly not represented as additive wall-clock saving.

## Newly inferred failure mode

A provider returning `null`/empty identity could be mistaken for an authoritative cache entry or cause the browser fallback to be retained. A dedicated regression now proves that an empty provider result falls back for that call, is not cached as authority, and a later valid live-provider fingerprint is still queried and adopted.

## Focused correctness evidence

The RF-060 tests cover:

1. one provider call for repeated lookup on unchanged state;
2. DatasetSpace reuse of the retained authoritative scalar;
3. fresh provider calls after advance/set/restore/invalidation;
4. explicit mutation-output fingerprint reuse without provider work;
5. empty/null provider non-retention;
6. thrown-provider browser fallback non-retention;
7. DatasetSpace fail-closed provider behavior after invalidation.

On the implementation/evidence head, static analysis (typecheck, lint, docs, pinned-actions and architecture enforcement), Rust tests, CodeQL, Q8 supply-chain pilot and approval-gate were green. Those evidence-head ordinary gates are not the final promotion evidence because the Q3D trigger is removed after measurement; the final policy-state head must re-run exact-head gates.

## Post-fix hosted Q3D evidence

Exact evidence head: `40b4455c2f68b64b06636eb97a621c850f51bdd7`

Workflow run: `33203651345`

Structured artifact: `9698807769`, digest `sha256:d6a47887d7592a857ea936ba2246beb6d70292ff0d1f2431ac0ff3361c48bf73`

All Q3D production-path falsifiers passed, including real module Worker + Rust/WASM execution, compact row-view output, authoritative source/output identity and the expected dataset-version transition.

| Rows | Controller before | Controller after | Atlas before | Atlas after | Fingerprint stages before | Fingerprint stages after |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1k | 483.685 ms | 409.350 ms | 409.365 ms | 348.305 ms | 8 / 30.0 ms | 0 / 0 ms |
| 8k | 1432.280 ms | 1041.490 ms | 1252.165 ms | 927.700 ms | 8 / 222.8 ms | 0 / 0 ms |
| 32k | 3237.995 ms | 2195.710 ms | 2610.540 ms | 1794.805 ms | 9 / 940.8 ms | 0 / 0 ms |

At 32k this is a ~32.2% controller reduction and ~31.2% Atlas reduction in this hosted same-harness comparison. Worker-internal operation time moved only from ~580.9 ms to ~541.8 ms, while the repeated main-thread authoritative fingerprint stages disappeared. This supports the bounded conclusion that retaining the already-authoritative identity materially improves the browser/authority-boundary envelope without changing the Rust analytical algorithm.

## Test falsifiability

The focused tests fail if provider reuse disappears, if any tested lifecycle fence leaves stale authority behind, if browser fallback is cached, if explicit Worker output authority is ignored, or if DatasetSpace starts swallowing a live provider failure. Q3D fails if the optimized path falls back to inline execution, changes result kind, drifts identity/version, or skips required production stages.

## Deferred measured work

Not blockers to RF-060:

- main-thread Worker transport/scheduling remains material;
- overlapping TDA/residency work after mutation remains measurable;
- synchronous structure discovery/recommendation remains ~313 ms at 32k post-fix;
- row-view reconstruction remains ~123 ms;
- physical Quest memory/frame/comfort qualification remains separate.

These stay with RF-029/RF-035/RF-051 and follow-on evidence-driven work rather than expanding this PR.

## Disposition

No RF-060 blocker remains in the measured production path. Q3D is restored to manual-only targeted execution. Final promotion still requires the final policy-state head to be fresh against `main`, have green required exact-head gates including Q9 promotion evidence, and have no unresolved review threads.

RF-060 status is **IMPLEMENTATION LANDED / REVIEW ACTIVE**. It is not `VERIFIED COMPLETE` and makes no physical-Quest or generic-large-N claim.
