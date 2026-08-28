# RF-035A Worker-resident registration — post-implementation adversarial review

Date: 28 August 2026
Base: `main@8cdc19030815dccf45b0bd9471de11395c5f2367`
First green implementation head reviewed: `62993990eef2cc0e463d505fe9d2e0584f486af6`
Stream: B — review / fix-forward
Disposition: bounded implementation valid; RF-035 remains open

## Production path attacked

`AtlasCore.applyAnalysisAsync()` -> `_registerCurrentDatasetInWorker()` -> `WorkerAnalyticalPort` registration/residency state -> `analytical.worker.ts` resident fingerprint/handle map -> Rust mutation output -> RESULT -> Atlas version transition -> next async operation.

The review specifically distinguishes two costs that were previously conflated:

1. a second Worker `REGISTER` message; and
2. constructing a fresh O(rows × columns) `Dataset.toJSON()` registration snapshot before the port can decide that no REGISTER is needed.

Before RF-035A, the second cost remained even though `WorkerAnalyticalPort` already knew the mutation output fingerprint was registered.

## Implementation reviewed

- `AnalyticalExecutionPort` exposes optional `hasRegisteredDataset(generation, fingerprint)` as a transport-local capability query.
- `WorkerAnalyticalPort` answers from the same generation/fingerprint `_registered` set that governs its existing REGISTER fast path.
- Atlas asks that query before `_workerRegistrationPayload()`, so a resident dataset does not trigger a hidden JSON snapshot.
- After a successful mutation, Atlas calls `supersede()` to advance the dataset identity/version and then drops only the cached registration payload when the active port still attests the output fingerprint as resident.
- The main-thread `Dataset` remains intact. If residency disappears, `_workerRegistrationPayload()` can reconstruct canonical JSON lazily.
- Ports that do not implement the residency query keep the conservative materialized-registration behavior.

## Adversarial checks

### Output adoption ordering

`analytical.worker.ts` calls `replaceRegisteredHandle(outFingerprint, outHandle)` before posting the successful RESULT. `WorkerAnalyticalPort._handleMessage()` records the same output fingerprint before resolving the pending request. Atlas therefore cannot observe a successful mutation result before the normal Worker port has established its local residency claim.

### Dataset-version supersession

After commit, Atlas advances the dataset version and calls `WorkerAnalyticalPort.supersede()` with the output fingerprint. The port retains only the current generation/output key. The Worker receives the same fence and `clearRegisteredHandles(retainFingerprint)` preserves the output handle while discarding obsolete inputs.

### Generation loss

A generation advance clears the port registration set and the Worker handle map. The regression proves the next operation performs exactly one lazy `Dataset.toJSON()` reconstruction and one fresh REGISTER before dispatch. RF-035A therefore does not convert stale Worker capabilities into silent authority.

### Dataset replacement

A normal Atlas dataset replacement advances identity/version and supersedes the port. The regression proves the old fingerprint is no longer reported resident and the replacement dataset must register before execution.

### Port substitution / unsupported residency query

The query is optional. A custom/inline async port that cannot attest its own residency never activates the optimization, so Atlas retains the ordinary payload path. This deliberately prefers extra work over a false capability claim.

### Transport signalling failure

If local supersession advances but a Worker SUPERSEDE post fails, a later request can be rejected as superseded by the Worker's older fence; it does not silently execute against a different fingerprint. This is an availability failure, not an identity fallback. Runtime/transport error handling remains responsible for recovery.

## Falsifying evidence

`tests/rf035-worker-resident-registration.test.ts` exercises the real `AtlasCore` + `WorkerAnalyticalPort` orchestration boundary with a controlled transport. It asserts:

- one initial REGISTER across two chained mutation results;
- zero registration `Dataset.toJSON()` snapshots while those output fingerprints remain resident;
- normal main-thread Dataset/output-fingerprint semantics after each mutation;
- generation advance revokes residency and causes one lazy JSON snapshot plus one fresh REGISTER;
- replacing the current dataset revokes the prior fingerprint and requires the replacement to register.

The expected-red state was committed before the production fix in `RF035A_EXPECTED_RED.md`. The original CI attempt was cancelled by subsequent branch pushes, so it is historical source-level falsification evidence rather than a completed red CI run.

First implementation head `62993990eef2cc0e463d505fe9d2e0584f486af6` then passed CI run 1266 and CodeQL run 799: Rust tests, typecheck, lint/documentation checks, production build, all three Vitest coverage shards, merged coverage gate and Chromium production smoke were green.

## Evidence limitation

This regression uses the production Atlas/port classes but a controlled Worker transport; it does **not** instantiate a real browser module Worker with real WASM. The actual Worker source was inspected for the matching adoption/supersession contract, but RF-015 still owns real Worker+WASM/browser scheduling and transfer evidence. RF-035A must not be described as device or complete end-to-end transport qualification.

## Residual RF-035 / RF-051 work

RF-035A removes the JS -> Worker half of the redundant re-registration loop for same-generation mutation chains, including the hidden registration snapshot. It does **not** remove the Worker -> JS full mutation result:

- the Worker still calls `getDatasetJson(outHandle)`;
- a full `DatasetJSON` still crosses the Worker boundary;
- Atlas still constructs a main-thread `Dataset` and the analytical state maintains its own lifecycle copy;
- presentation/history/replay still rely on main-thread materialization;
- browser transfer bytes, JS heap, GC and WASM resident/transient peaks remain unmeasured here.

The next bounded tranche should therefore be RF-035B: define an identity-first resident mutation result plus explicit/materialize-on-demand presentation/export semantics, with production consumer inventory before removing the existing DatasetJSON result.

## Final disposition

- **BLOCKER addressed in this tranche:** same-generation mutation output no longer causes a redundant Worker-registration JSON snapshot before the next operation.
- **DEFER / still open:** Worker -> JS full DatasetJSON transfer, handle-only/presentation materialization, real Worker+WASM measurement, transfer/heap/GC/device evidence, mixed/graph compact transport.
- **Status:** RF-035 remains **IMPLEMENTATION PARTIAL / REVIEW ACTIVE**. RF-051 remains **IMPLEMENTATION LANDED / REVIEW ACTIVE, NOT COMPLETE**. No generic large-N or Quest qualification claim is promoted.