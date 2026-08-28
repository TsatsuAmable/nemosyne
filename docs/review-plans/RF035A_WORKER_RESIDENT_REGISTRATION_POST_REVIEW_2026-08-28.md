# RF-035A Worker-resident registration — post-implementation adversarial review

Date: 28 August 2026
Merged implementation: `main@34c08b9e9582a5f9c237fb22f45daf56c2181aa8` (#480)
First green implementation head: `62993990eef2cc0e463d505fe9d2e0584f486af6`
Stream: B — merged-state review / evidence follow-up
Disposition: bounded implementation valid; RF-035 remains open

## Production path attacked

`AtlasCore.applyAnalysisAsync()` -> `_registerCurrentDatasetInWorker()` -> `WorkerAnalyticalPort` registration/residency state -> `analytical.worker.ts` resident fingerprint/handle map -> Rust mutation output -> RESULT -> Atlas version transition -> next async operation.

The review distinguishes two costs that were previously conflated: a second Worker `REGISTER` message and constructing a fresh O(rows × columns) `Dataset.toJSON()` registration snapshot before the port can decide that no REGISTER is needed. Before #480 the second cost remained even though the port already knew the mutation output fingerprint was resident.

## Implementation reviewed

- `AnalyticalExecutionPort` exposes optional `hasRegisteredDataset(generation, fingerprint)` as a transport-local capability query.
- `WorkerAnalyticalPort` answers from the same generation/fingerprint `_registered` set that governs its REGISTER fast path.
- Atlas queries residency before `_workerRegistrationPayload()`, so a resident dataset does not trigger hidden JSON materialization.
- After a successful mutation Atlas advances the identity/version and drops only the cached registration payload when the active port still attests the output fingerprint as resident.
- The main-thread `Dataset` remains intact. If residency disappears, canonical JSON can be reconstructed lazily.
- Ports that cannot attest residency keep the conservative materialized-registration behavior.

## Adversarial checks

### Output adoption ordering

`analytical.worker.ts` calls `replaceRegisteredHandle(outFingerprint, outHandle)` before posting a successful RESULT. `WorkerAnalyticalPort._handleMessage()` records the same output fingerprint before resolving the pending request. Atlas therefore does not observe a normal successful mutation result before the standard Worker port has established its local residency claim.

### Version supersession

After commit, Atlas calls `supersede()` with the output fingerprint. `WorkerAnalyticalPort` retains only the current generation/output key. The Worker receives the same fence and `clearRegisteredHandles(retainFingerprint)` preserves the output handle while discarding obsolete inputs.

### Generation loss

A generation advance clears port registration state and the Worker handle map. The regression proves the next operation performs exactly one lazy `Dataset.toJSON()` reconstruction and one fresh REGISTER before dispatch.

### Dataset replacement

A normal Atlas dataset replacement advances identity/version and supersedes the port. The evidence follow-up regression proves the old fingerprint is no longer reported resident, the new fingerprint is not falsely claimed resident and the replacement dataset must register before execution.

### Port substitution / unsupported query

The query is optional. A custom async port that cannot attest its own residency never activates the optimization, so Atlas preserves the ordinary registration path. Correctness is preferred over speculative reuse.

### Signalling failure

If local supersession advances but a Worker SUPERSEDE post fails, the Worker's older fence can reject the later request rather than executing it under a mismatched identity. That is an availability/recovery concern, not a silent identity fallback.

## Falsifying evidence

`tests/rf035-worker-resident-registration.test.ts` exercises the real `AtlasCore` + `WorkerAnalyticalPort` orchestration boundary with a controlled transport. It asserts:

- one initial REGISTER across two chained mutation results;
- zero registration `Dataset.toJSON()` snapshots while output fingerprints remain resident;
- normal main-thread Dataset/output-fingerprint semantics after each mutation;
- generation advance revokes residency and causes one lazy JSON snapshot plus one fresh REGISTER;
- replacing the current Atlas dataset revokes the prior fingerprint and requires the replacement to register.

The expected-red source state was committed before the production fix in `RF035A_EXPECTED_RED.md`. Its CI run was cancelled by later branch pushes, so it remains historical source-level falsification evidence rather than a completed red CI run.

The first implementation head `62993990eef2cc0e463d505fe9d2e0584f486af6` passed CI run 1266 and CodeQL run 799: Rust tests, typecheck, lint/documentation checks, production build, all three Vitest coverage shards, merged coverage gate and Chromium production smoke were green before #480 auto-merged.

## Evidence limitation

The regression uses production Atlas/port classes but a controlled Worker transport; it does not instantiate a real browser module Worker with real WASM. The actual Worker source was reviewed for the matching adoption/supersession contract, but RF-015 still owns real Worker+WASM/browser scheduling and transfer evidence. #480 is not device or complete end-to-end transport qualification.

## Residual RF-035 / RF-051 work

RF-035A removes the JS -> Worker half of the redundant re-registration loop for same-generation mutation chains, including the hidden registration snapshot. It does not remove the Worker -> JS full mutation result:

- the Worker still calls `getDatasetJson(outHandle)`;
- a full `DatasetJSON` still crosses the Worker boundary;
- Atlas still constructs a main-thread `Dataset` and the analytical state maintains its own lifecycle copy;
- presentation/history/replay still rely on main-thread materialization;
- browser transfer bytes, JS heap, GC and WASM resident/transient peaks remain unmeasured here.

The next bounded tranche should be RF-035B: define an identity-first resident mutation result plus explicit/materialize-on-demand presentation/export semantics, with production-consumer inventory before removing the existing DatasetJSON result.

## Final disposition

- **Fixed forward in #480:** same-generation mutation output no longer causes a redundant Worker-registration JSON snapshot before the next operation.
- **Still open:** Worker -> JS full DatasetJSON transfer, handle-only/presentation materialization, real Worker+WASM measurement, transfer/heap/GC/device evidence and broader compact transfer.
- **Status:** RF-035 remains **IMPLEMENTATION PARTIAL / REVIEW ACTIVE**. RF-051 remains **IMPLEMENTATION LANDED / REVIEW ACTIVE, NOT COMPLETE**. No generic large-N or Quest qualification claim is promoted.