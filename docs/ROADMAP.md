# Nemosyne Roadmap

> **Canonical implementation-status and execution index.** Product/research direction remains governed by [Nemosyne Definitive Vision and Roadmap](Nemosyne_Definitive_Vision_and_Roadmap.md). This file deliberately contains only current state, dependency order, ownership constraints and links to bounded work documents. Historical detail lives in the [roadmap historical ledger](archive/ROADMAP_HISTORY_THROUGH_2026-10-03.md).

## Roadmap hygiene contract

This roadmap is an **index, not a diary or design document**.

1. Keep `docs/ROADMAP.md` below **20,000 characters**. CI enforces the cap.
2. New non-trivial work gets a focused file under `docs/work/` (or an existing scoped programme/RFC document) containing purpose, scope, evidence, exit/STOP criteria and dependencies. The roadmap gets one concise row linking to it.
3. Do not paste PR changelogs, incident narratives, experiment transcripts, implementation detail, completed checklists or historical rationale into this file.
4. When work completes, update its task/spec with final evidence, reduce/remove its live roadmap row, and append a concise completion record to the single [historical ledger](archive/ROADMAP_HISTORY_THROUGH_2026-10-03.md). Do not create another roadmap-history file.
5. A roadmap status line states only **status + next dependency/action + link**. Mutable review-finding status remains generated from its ledger.
6. Agents must read this contract before editing the roadmap. If detail does not change sequencing or current status, it belongs in the linked document, not here.
7. Prefer small task documents, normally one concern and well under 150 lines. Split work when a file starts mixing independent experiments or promotion gates.

Generic engineering/authority rules remain in [AGENTS.md](../AGENTS.md). The historical ledger preserves the pre-compaction 259k-character roadmap verbatim, so compaction is not information deletion.

## Status snapshot - 4 October 2026

**Integration base:** `main@22c64025`.

- Architecture 2027 decisions are integrated: A27-0 and A27-1 accepted; L0 semantic snapshot, L1 committed perspective/context V2 and L2 Forma admission/KB0 contracts landed in PRs #936-#938. These are enabling contracts, not automatic product-capability promotion.
- **P1-TEC / FM0 remains active**. Governed replay/consumer-policy work is substantially landed; remaining evidence-identity, calibration/qualification and downstream evidence-reference closure must remain fail-closed. See [RFC 0009](rfcs/0009-persisted-governed-evidence-replay.md).
- **UXR0-UXR3 are at bounded software exits. UXR4/UXR5 remain physical-evidence open.** See [UXR programme](roadmap/P1_UXR_SEMANTIC_EFFICIENCY_UX_RUNTIME_AND_VERIFICATION.md) and [Quest validation operations](roadmap/P1_QV_QUEST_VALIDATION_OPERATIONS.md).
- **Full Moneta remains IMPLEMENTATION PARTIAL.** Bounded FMA-01–13 repairs, static Forma rendering/reverse explanation, V4 replay, FM3/4 composition/resolution fidelity and FM6/FM7 qualification batteries are landed. Remaining work includes FM1/FM2 product actions, measured FM5 target-device value, the proposed FM-DSE dataset-first integration, and integrated human/device evidence. See the [4 October completeness audit](review-plans/FULL_MONETA_COMPLETENESS_AUDIT_2026-10-04.md), [incremental plan](roadmap/P1_FULL_MONETA_INCREMENTAL_CAPABILITY_PLAN.md) and [architecture](architecture/FULL_MONETA_SEMANTIC_EMBODIMENT_ARCHITECTURE_PLAN.md).
- **Quest Compute Acceleration is active as a bounded parallel performance lane.** QCA0 captured an operator-accepted Quest 3S engineering baseline; its governed `INVALID_RUN` is unchanged and a corrected physical rerun remains required. QCA1-QCA4 attribution/comparisons remain open. See [QCA index](work/quest-compute/README.md).
- **Memory Palace authority cleanup is complete:** the duplicate mutable `MemoryPalaceGraph` store was retired under ADR-0012/#964; the product palace remains a deterministic projection of `InvestigationAggregate` state.
- **scriptc is parked for Quest/WebXR.** It may be reconsidered only for a real native CLI/sidecar/tool deployment with measured benefit. See [scriptc evaluation](roadmap/SCRIPTC_NATIVE_TYPESCRIPT_EVALUATION.md).

Current order:

```text
P1-TEC / FM0 finite evidence closure
  -> applicable grounded-evidence gates for each downstream claim
owner review of RFC0012 minimum architecture + retained FM-DSE contracts
  -> DSE0 schema/falsifiers -> DSE1 bounded grounded overview -> DSE2/DSE3
  -> smallest complete investigation loop; DSE6 qualification starts at DSE1
conditional later: DSE4 multi-dataset / DSE5 runtime intelligence -> remaining Full Moneta exits
residual before FM8 completion: FM1/FM2 user-facing intent/alternative actions
remaining FM5: measured advisory value and target-device qualification
parallel when disjoint: UXR4/5 physical qualification + QCA physical attribution/controlled probes
then: P1-WP -> P1-WQ -> PT9/PT10
```

## Forward dependency spine

| Work | Status | Next action / dependency | Detail |
| --- | --- | --- | --- |
| **P1-TEC / FM0 trustworthy evidence** | **ACTIVE** | Finish finite evidence identity/calibration/consumer qualification required by claim-bearing downstream work. | [RFC 0009](rfcs/0009-persisted-governed-evidence-replay.md), generated RF table below |
| **FM1 perspective/context** | **CORE IMPLEMENTATION LANDED / PRODUCT INTEGRATION OPEN** | Context identity, explicit epistemic purpose, history and production adoption guards are landed (#957/#960/#961). Wire/qualify researcher-facing intent and perspective actions through the real product path before claiming the FM1 exit. | [Incremental plan](roadmap/P1_FULL_MONETA_INCREMENTAL_CAPABILITY_PLAN.md) |
| **FM2 alternative-aware / Road Not Taken** | **CORE + NIL ACTIONS LANDED / SURFACE QUALIFICATION OPEN** | Atomic branch/revisit (#957) and NIL alternative/intent bindings with replay battery (#988) landed. Qualify investigator-visible surfaces and dataset-body use; Memory Palace remains an aggregate projection (#964). | [Incremental plan](roadmap/P1_FULL_MONETA_INCREMENTAL_CAPABILITY_PLAN.md), [ADR-0012](architecture/decisions/0012-memory-palace-graph-authority.md) |
| **FM3 Forma first vertical slice / L2-FORMA-1** | **STATIC PRODUCT SLICE LANDED / SEMANTIC QUALIFICATION OPEN** | Typed grounded/conjectural admission, production adoption guard, 3D Forma rendering, reverse explanation and V4 static replay are landed (#960/#961). Qualify multi-phenomenon semantic comprehension and product usefulness before the full FM3 exit. | [Incremental plan](roadmap/P1_FULL_MONETA_INCREMENTAL_CAPABILITY_PLAN.md) |
| **FM3/4 composition + resolution adaptation / L2-FORMA-2 + L4-RUNTIME-BUDGET** | **IMPLEMENTATION LANDED / DEVICE QUALIFICATION OPEN** | Final-content identity, budget/generation refusal and selected-graph fidelity are landed (#962). Qualify semantic recoverability and information-loss disclosure across materially different Quest/desktop budgets. | [Incremental plan](roadmap/P1_FULL_MONETA_INCREMENTAL_CAPABILITY_PLAN.md) |
| **FM5 System-1 assistance** | **ADVISORY IMPLEMENTATION / PROBES LANDED; VALUE QUALIFICATION OPEN** | Consumed advice, disclosure, bypass, recorded replay, ABSTAIN and R5/R7/R8 comparison probes are merged. Finite/reproducible deltas alone do not establish benefit; evaluate measured value and target-device cost. | [System-1/System-2 architecture](architecture/MONETA_SYSTEM1_SYSTEM2_ONNX_ARCHITECTURE.md), [evidence inventory](architecture/MONETA_DATASET_FIRST_SEMANTIC_EMBODIMENT.md#132-existing-qualification-evidence-to-retain-and-extend) |
| **FM6 human refinement / Forma knowledge** | **QUALIFICATION VERIFIED** | Qualification battery (`FM6-R6`) merged in #980: verified holdout evaluation gate fail-closed behavior, System-1 proposal scoring improvement with knowledge case identity binding, frozen research mode, and clean registry rollback. | [Incremental plan](roadmap/P1_FULL_MONETA_INCREMENTAL_CAPABILITY_PLAN.md) |
| **FM7 searching / synthesizing Moneta** | **QUALIFICATION VERIFIED** | Qualification battery (`FM7-R7`) merged in #983: verified novel admissible representation graph construction outside fixed catalogue, System-1 advisory seeding and bypass, Pareto non-domination, MCR7 genome handoff analytical gates, and Research Mode bitwise digest invariance. | [Incremental plan](roadmap/P1_FULL_MONETA_INCREMENTAL_CAPABILITY_PLAN.md) |
| **FM8 full Moneta / controlled adaptive representation** | **IMPLEMENTATION PARTIAL / INTEGRATED QUALIFICATION OPEN** | The FMA-01–13 repair set and dual-epistemic core are landed; do not restore completion claims until qualified FM5/FM6/FM7 behavior, residual FM1/FM2 product surfaces and human/device evidence satisfy the integrated V3.1 exit. | [Full Moneta audit + dual-mode addendum](review-plans/FULL_MONETA_COMPLETENESS_AUDIT_2026-10-04.md) |
| **FM-DSE minimum dataset embodiment** | **DSE1 IMPLEMENTED / DSE2 READY** | DSE1 direct deterministic compilation loop, bounded overview, and attributable critique capture landed. Next: DSE2 semantic resolution and reversible traversal. | [RFC 0012](rfcs/0012-minimum-nemosyne-architecture.md), [ADR-0013](architecture/decisions/0013-minimum-nemosyne-architecture.md), [DSE0 inventory](review-plans/DSE0_PREFLIGHT_AND_REMOVAL_INVENTORY.md) |

| **UXR4/UXR5 device qualification** | **EVIDENCE ACQUISITION OPEN** | Capture attributable Quest interaction/render/resource/comfort evidence when hardware is available. | [UXR programme](roadmap/P1_UXR_SEMANTIC_EFFICIENCY_UX_RUNTIME_AND_VERIFICATION.md) |
| **P1-WP → P1-WQ** | **BLOCKED BY REQUIRED UXR/ASSURANCE CLOSURE** | Productionize web surfaces, then ordinary-browser investigator qualification. | [Product transition plan](roadmap/P1_PRODUCT_TRANSITION_PLATFORM_AND_LEARNING_PLAN.md) |
| **PT9/PT10 learned/private-preview work** | **DOWNSTREAM** | Requires WQ and finite evidence closure appropriate to the promoted claims. | [Product transition plan](roadmap/P1_PRODUCT_TRANSITION_PLATFORM_AND_LEARNING_PLAN.md) |

The default execution model remains **one owner-controlled forward tranche plus genuinely disjoint parallel-safe ribs**. Idle agents are preferable to invented work. High-risk authority/scientific changes require pre-implementation falsifiers and independent post-implementation review under [AGENTS.md](../AGENTS.md).

### FM-DSE planned tranches

| Tranche | Gate / outcome |
| --- | --- |
| **DSE0 reduction + preflight** | Review RFC0012; inventory callers/archives for deletion, derive subject identity with existing contracts where possible, freeze N/cardinality falsifiers and evidence plans. |
| **DSE1 grounded bounded overview** | Stable Dataset subject, evidence-bound deterministic composition, two governed structures, bounded cardinality, reverse explanation and attributable critique capture. |
| **DSE2 semantic resolution** | Reversible dataset -> structure -> subset -> observation traversal; obligation-preserving device variants; lifecycle identity survives evict/rebuild. |
| **DSE3 dual-mode feedback loop** | Grounded/conjectural purpose enforcement, visible disclosure, TechnoCore critique -> Road Not Taken alternative, attributable feedback and V4 lineage. |
| **DSE4 multi-dataset comparison** | CONDITIONAL under proposed RFC0012: reopen for a named blocking research task; independent identity and evidence remain required. |
| **DSE5 runtime proposal/search** | CONDITIONAL under proposed RFC0012: offline lab supplies governed artifacts; add resident inference/search only for measured incremental task/resource value. |
| **DSE6 qualification** | Starts with DSE1; corrected physical controls, semantic-recovery/accessibility studies and STOP/CONTINUE/REVISE. Does not wait for DSE4/5. |

Each implementation tranche requires its own reviewed plan and high-risk evidence. The architecture PR does not authorize code changes or promote performance, comprehension, search or learning claims.

RFC0012 proposes removing world/shared-depth model plans, generic modality scaffolding and new subject/working-set stores; merging product-metaphor state and representation orchestration; and moving training/evolutionary campaigns outside the browser product. Hosted collaboration, live streams and native/alternate compute remain conditional. Existing service/readiness obligations change only through their accepted migration, not by this proposal.

## Quest Compute Acceleration — individual tasks

This replaces scriptc as the immediate Quest-browser optimization experiment. Rust/WASM remains analytical authority and ordinary browser/WebXR deployment remains the default topology.

| ID | Status | Dependency | Task |
| --- | --- | --- | --- |
| **QCA0** | **BASELINE CAPTURED / QCA1–QCA4 OPEN** | custody-sealed Quest 3S QCA0 baseline | [Quest performance baseline](work/quest-compute/QCA0_BASELINE.md) |
| **QCA1** | **READY AFTER QCA0** | QCA0 hotspot evidence | [Rust/WASM SIMD128](work/quest-compute/QCA1_WASM_SIMD.md) |
| **QCA2** | **READY AFTER QCA0** | QCA0 main-thread evidence | [Worker/main-thread offload audit](work/quest-compute/QCA2_WORKER_OFFLOAD.md) |
| **QCA3** | **BLOCKED_BY QCA2 MEASUREMENTS** | prove transfer/synchronization cost matters | [Transferable buffers, memory and WASM threads](work/quest-compute/QCA3_TRANSPORT_THREADS.md) |
| **QCA4** | **BOUNDED CHANGES LANDED / PHYSICAL COMPARISON OPEN** | Low-triangle markers (#979) and operator glyph hygiene (#986) merged; physical frame/legibility/selection benefit remains unqualified | [WebXR rendering fast wins](work/quest-compute/QCA4_WEBXR_RENDERING.md) |
| **QCA5** | **EXPERIMENTAL AFTER QCA0** | select one measured non-authoritative parallel workload | [WebGPU compute spike](work/quest-compute/QCA5_WEBGPU_COMPUTE.md) |

QCA1, QCA2 and QCA4 may run concurrently only when their files/ownership do not collide. No Quest performance claim closes from desktop/simulator evidence alone.

## Support loops

| Loop | Status | Authority / rules |
| --- | --- | --- |
| **Adversarial Shadow Review (ASR)** | **READY / advisory** | Candidates require independent validation before becoming obligations. [Shadow governance](../governance/shadow/README.md) |
| **Recursive Falsification Laboratory (RFL)** | **READY / advisory** | Additive falsification only; no production repair/self-adjudication. [Iteration contract](../governance/rfl/iteration-contract.md) |

Validated critical/high findings pre-empt affected feature work. Candidate findings do not. Agents should inspect their assigned validated findings before selecting ordinary work.

## Parked / conditional paths

| Path | Status | Re-open only when |
| --- | --- | --- |
| **scriptc native TypeScript** | **DEFERRED FOR QUEST/WEBXR** | A real native CLI/sidecar/tool target exists and T0-T2 demonstrate semantic parity plus material operational benefit. [Plan](roadmap/SCRIPTC_NATIVE_TYPESCRIPT_EVALUATION.md) |
| **Native Quest/Hexagon escape hatch** | **UNSCHEDULED** | Browser/WASM/render optimizations fail a measured requirement that a native topology can plausibly solve. [Quest SoC report](architecture/QUEST3_SOC_ARCHITECTURE_PERFORMANCE_REPORT.md) |
| **World-model representation substrate** | **UNSCHEDULED** | A named evidence-triggered problem cannot be solved adequately by the bounded Forma/System-1/System-2 path. |

## Completed / historical status

Only completion state belongs here; detailed archaeological material is in the [single historical ledger](archive/ROADMAP_HISTORY_THROUGH_2026-10-03.md).

| Area | Status | Detail |
| --- | --- | --- |
| Progressive Disclosure / Stream A | **VERIFIED COMPLETE / STOP** | [Historical ledger](archive/ROADMAP_HISTORY_THROUGH_2026-10-03.md) |
| Relationship Graph V1 / Stream B | **VERIFIED COMPLETE / STOP FOR FIRST FAMILY** | [Historical ledger](archive/ROADMAP_HISTORY_THROUGH_2026-10-03.md) |
| Visible Investigator C1-C4 | **IMPLEMENTATION LANDED; physical qualification remains elsewhere** | [Historical ledger](archive/ROADMAP_HISTORY_THROUGH_2026-10-03.md) |
| PT0-PT8 | **LANDED AT BOUNDED EXITS** | [Product transition plan](roadmap/P1_PRODUCT_TRANSITION_PLATFORM_AND_LEARNING_PLAN.md) |
| A27-0/A27-1 + L0/L1/L2 foundation contracts | **LANDED / ACCEPTED** | [Architecture 2027 review](architecture/ARCHITECTURE_2027_REVIEW.md) |
| Pre-compaction roadmap records, incidents, PR-by-PR history, old stream checklists | **ARCHIVED** | [Historical ledger](archive/ROADMAP_HISTORY_THROUGH_2026-10-03.md) |

## Mutable review-finding status

<!-- REVIEW_FINDINGS_STATUS:BEGIN -->
> **Generated review-finding disposition.** Mutable RF status is owned by `governance/review-findings.json`; edit the ledger, not this table.

| Finding | Severity | Status | Current disposition |
| --- | --- | --- | --- |
| RF-037 | Critical | `VERIFIED COMPLETE` | Single-replica live admission is verified; multi-replica replay safety remains the explicit RDO-007 deployment obligation. |
| RF-038 | High | `VERIFIED COMPLETE` | Exact role allow-list and production-path rejection evidence are verified. |
| RF-039 | High | `VERIFIED COMPLETE` | Production FileLoader -> Atlas -> Rust -> Dataset policy consolidation, pre-read gating, and adversarial live-path tests are verified. |
| RF-040 | High | `VERIFIED COMPLETE` | Client-wide TelemetryCollector and UXTraceRecorder default-off, revocation halt, and full-erasure contracts are verified; research study helper claims are honestly bounded. |
| RF-041 | Medium | `VERIFIED COMPLETE` | PR #619 removed the remote Three.js import-map/CSP trust and retained a production hygiene regression. |
| RF-042 | Low | `VERIFIED COMPLETE` | PR #647 neutralized C0/C1/ESC terminal control sequences and verified the regression on the promoted exact head. |
| RF-043 | High assurance gap | `VERIFIED COMPLETE` | Systematic hostile-input fuzz and property campaigns verify fail-closed parser and ABI boundary integrity with zero leaks or traps. |
<!-- REVIEW_FINDINGS_STATUS:END -->

## Agent update protocol

When an agent starts a task:

1. refresh `main` and state the exact base SHA in the task/PR;
2. claim one bounded task and identify collision-sensitive files;
3. update the linked work document with implementation evidence, not the roadmap with narrative;
4. change the roadmap only when **status, sequencing, dependency or ownership** changes;
5. on completion, leave a short final evidence record in the task document and append one concise line to the historical ledger;
6. merge only with exact-head evidence appropriate to risk, then refresh before selecting the next task.

This keeps the roadmap small enough to coordinate humans and agents instead of becoming the project itself.
