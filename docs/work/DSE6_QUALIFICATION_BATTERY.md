# DSE6 — Dataset-first qualification evidence and remaining gates

**Status:** SYNTHETIC BATTERY LANDED / PRODUCTION, DEVICE AND HUMAN QUALIFICATION OPEN.
**Execution authority:** [ROADMAP.md](../ROADMAP.md). Architecture: [ADR-0013](../architecture/decisions/0013-minimum-nemosyne-architecture.md).

## Retained implementation and evidence

The direct DSE1–DSE3 compilation, traversal and feedback implementation is landed. The development battery in [`DSE6LoopQualification.ts`](../../src/moneta/representation/DSE6LoopQualification.ts) exercises direct compilation, obligation-preserving budget variants, traversal and conjectural disclosure. [`dse6-loop-qualification.test.ts`](../../tests/dse6-loop-qualification.test.ts) exercises that battery.

The prior document promoted its `CONTINUE` result to physical Quest qualification, N-independent computation, leak-free endurance and semantic/accessibility recovery. Source inspection on 17 October 2026 does not support those claims:

| Reported dimension | What the implementation actually checks | Limit on the claim |
| --- | --- | --- |
| Physical Quest | Compiles synthetic snapshots against desktop and constrained budget constants. | No physical device, frame-time or measured memory evidence. |
| N-independence | Changes represented-row-count metadata while retaining a fixed-size synthetic snapshot. | Bounded fixture plan cardinality; no real dataset-scale analytical or ingestion complexity measurement. |
| Endurance / recovery | Repeated traversal through `makeMockPort`; checks rebuild success and an empty current page. | `memoryGrowthBytes: 0` and `memoryLeakDetected: false` are fixed fields. Rebuild success is not a byte-equality comparison. No measured leak-freedom or long-session claim. |
| Semantic recovery | Compiles generated distribution/cluster snapshots and checks traversal lineage. | No real kernel known-structure recovery or investigator comprehension evidence. |
| Accessibility / disclosure | Exercises disclosure/refusal and color-remapping helpers. | No physical interaction or human accessibility qualification. |

Synthetic receipt/digest references are created by `createMockEvidenceReferences`; they are not evidence of real Rust/Worker analytical admission. The exported report's dimension names and verdict rationale still overstate these boundaries. Treat the report as a development fixture result, never promotion authority; correcting its runtime contract needs a separately scoped high-risk change.

## Remaining qualification and falsifiers

Before FM-DSE completion, acquire evidence through the actual import → Rust/Worker evidence → aggregate → direct compiler → rendered surface → interaction/replay path:

1. **Production authority:** real datasets and receipt-bearing analytical outputs, including malformed/refused/stale cases; no fixture authority substituted for the production Worker/kernel.
2. **Physical resource envelope:** attributable Quest runs with build/device/workload identities, frame/latency and measured memory; paired desktop/constrained variants preserve required semantic obligations.
3. **Scale:** vary actual input datasets, measure analytical and boundary costs separately from bounded plan cardinality, and record resource refusals honestly.
4. **Endurance/recovery:** measured long-session heap/WASM/resource behavior and explicit content-identity comparisons after evict/rebuild, cancellation and recovery.
5. **Human semantics/accessibility:** governed investigator tasks for semantic recoverability, disclosure comprehension and usable interaction, following the [study governance](../study/README.md).

Freeze acceptance criteria and evidence custody before acquisition; use STOP / CONTINUE / REVISE against those criteria. No physical, scientific, memory or human outcome is established by this documentation correction. DSE4/DSE5 remain conditional and are not prerequisites for acquiring this evidence.

## DSE6 report evidence-scope repair (2026-10-22)

**Pre-implementation adversarial contract; high-risk evidence/promotional reporting boundary.** Base: `main@46d663e`. Only `DSE6LoopQualification.ts`, its focused test, and this task are owned by this tranche; the canonical roadmap is unchanged until a status gate actually closes.

- **Invariant:** A programmatic consumer must never mistake synthetic direct-plan compilation, fixed-size snapshots with varied row-count metadata, mock traversal, or colour-remap helpers for Quest, memory-leak, N-scaling, real analytical recovery, or human-accessibility qualification. The development fixtures may still PASS their *own* bounded assertions, but cannot issue a DSE6 completion/CONTINUE result.
- **Authority and path:** `runDSE6Qualification` constructs and exports the report. No call to the production Rust/Worker analytical path or physical device is present. An in-repository symbol search finds only the report source and its focused test as consumers. This permits replacing the non-persisted report shape with an explicitly versioned V2 rather than silently retaining the misleading V1 semantics.
- **Failure modes:** Existing report field names or zero/false constants still masquerade as measurements; a consumer mistakes a fixture PASS for field qualification; mocks silently satisfy an evidence gate; the reporter returns CONTINUE based only on fixtures; a new test merely asserts a warning string while leaving a machine-readable completion flag.
- **Falsifiers:** A bounded test must prove explicit `SYNTHETIC_FIXTURE_ONLY` scope, named missing real-world gates, no invented memory or byte-identity metrics, fixture-status separation and a non-CONTINUE decision. Existing direct compiler/traversal/admission tests and hosted CI must remain green. Report schema increments to V2; readers requiring V1 must fail rather than silently reinterpret it.
- **STOP / limits:** This does not acquire device, worker, real-N, human or authenticated-origin evidence; no production representation logic is changed. If any consumer beyond this module's tests, any persisted/public report reader, or a promotion pipeline is discovered, STOP for explicit migration/ADR rather than silently changing its contract.

**Expected exit:** The report becomes an honest *synthetic-development battery* with separate outstanding qualification gates. Production/device/human DSE6 status stays open. The work is corrective; it does not upgrade DSE6 readiness.
