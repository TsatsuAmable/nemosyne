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

## Status snapshot - 17 October 2026

**Integration base:** `main@75adda9c`.

- Architecture 2027 foundation contracts are integrated (#936–#938); accepted contracts alone do not promote product capabilities.
- **P1-TEC / FM0 remains active**. Governed replay/consumer-policy work is substantially landed; remaining evidence-identity, calibration/qualification and downstream evidence-reference closure must remain fail-closed. See [RFC 0009](rfcs/0009-persisted-governed-evidence-replay.md).
- **UXR0-UXR3 are at bounded software exits. UXR4/UXR5 remain physical-evidence open.** See [UXR programme](roadmap/P1_UXR_SEMANTIC_EFFICIENCY_UX_RUNTIME_AND_VERIFICATION.md) and [Quest validation operations](roadmap/P1_QV_QUEST_VALIDATION_OPERATIONS.md).
- **Full Moneta remains IMPLEMENTATION PARTIAL.** Direct-loop lineage (#1012) and headless FM1/FM2 exit battery (#1020) landed. FM5 failed its proxy value gate (#1024); scaled exploration (#1025) does not establish benefit. DSE6 synthetic results do not qualify physical/human/resource claims. See the dependency spine below.
- **Quest Compute Acceleration is active as a bounded parallel performance lane.** QCA0 captured an operator-accepted Quest 3S engineering baseline; its governed `INVALID_RUN` is unchanged and a corrected physical rerun remains required. QCA1-QCA4 attribution/comparisons remain open. See [QCA index](work/quest-compute/README.md).
- **Memory Palace authority cleanup is complete:** ADR-0012/#964 retired the duplicate store; the palace projects `InvestigationAggregate`.
- **scriptc is parked for Quest/WebXR.** It may be reconsidered only for a real native CLI/sidecar/tool deployment with measured benefit. See [scriptc evaluation](roadmap/SCRIPTC_NATIVE_TYPESCRIPT_EVALUATION.md).

Current order:

```text
P1-TEC / FM0 finite evidence closure
  -> applicable grounded-evidence gates for each downstream claim
ADR-0013 accepted minimum architecture; DSE1-DSE3 implementation landed
  -> DSE6 real production/device/resource/human qualification remains open
residual before FM8 completion: rendered FM1/FM2 journeys + human/device evidence
FM5 value gate failed -> advisory design reassessment before renewed value qualification
conditional only: DSE4 multi-dataset / DSE5 runtime intelligence
parallel when disjoint: UXR4/5 physical qualification + QCA physical attribution/controlled probes
then: P1-WP -> P1-WQ -> PT9/PT10
```

## Forward dependency spine

| Work | Status | Next action / dependency | Detail |
| --- | --- | --- | --- |
| **P1-TEC / FM0 trustworthy evidence** | **ACTIVE** | Finish finite evidence identity/calibration/consumer qualification required by claim-bearing downstream work. | [RFC 0009](rfcs/0009-persisted-governed-evidence-replay.md), generated RF table below |
| **FM1 perspective/context** | **HEADLESS EXIT BATTERY LANDED / RENDERED-SURFACE QUALIFICATION OPEN** | #1020 covers NIL → aggregate → view-model → V4 routing/provenance with mock kernels. Qualify rendered intent/perspective surfaces and investigator comprehension. | [Exit evidence](work/FM1_FM2_EXIT_QUALIFICATION.md) |
| **FM2 alternative-aware / Road Not Taken** | **HEADLESS EXIT BATTERY LANDED / RENDERED-SURFACE QUALIFICATION OPEN** | #1020 covers compare/branch/defer/replay on the direct loop. V4 lineage landed in #1012; physical surfaces/comprehension remain open. | [Exit evidence](work/FM1_FM2_EXIT_QUALIFICATION.md), [ADR-0012](architecture/decisions/0012-memory-palace-graph-authority.md) |
| **FM3 Forma first vertical slice / L2-FORMA-1** | **STATIC PRODUCT SLICE LANDED / SEMANTIC QUALIFICATION OPEN** | Typed grounded/conjectural admission, production adoption guard, 3D Forma rendering, reverse explanation and V4 static replay are landed (#960/#961). Qualify multi-phenomenon semantic comprehension and product usefulness before the full FM3 exit. | [Incremental plan](roadmap/P1_FULL_MONETA_INCREMENTAL_CAPABILITY_PLAN.md) |
| **FM3/4 composition + resolution adaptation / L2-FORMA-2 + L4-RUNTIME-BUDGET** | **IMPLEMENTATION LANDED / DEVICE QUALIFICATION OPEN** | Final-content identity, budget/generation refusal and selected-graph fidelity are landed (#962). Qualify semantic recoverability and information-loss disclosure across materially different Quest/desktop budgets. | [Incremental plan](roadmap/P1_FULL_MONETA_INCREMENTAL_CAPABILITY_PLAN.md) |
| **FM5 System-1 assistance** | **STAGE 1 VALUE GATE FAILED / ADVISORY DESIGN REASSESSMENT** | #1024 pins zero positive utility deltas on the pilot cases; #1025 adds report-only scaled exploration, not a passing gate. Reassess advice/objective coupling before seeking renewed proxy, investigator and target-device value evidence. | [Value qualification](work/FM5_VALUE_QUALIFICATION_PLAN.md) |
| **FM6 human refinement / Forma knowledge** | **BOUNDED BATTERY LANDED** | #980 covers holdout gates, prior identity, frozen mode and rollback; no human outcome claim follows from this battery. | [Incremental plan](roadmap/P1_FULL_MONETA_INCREMENTAL_CAPABILITY_PLAN.md) |
| **FM7 searching / synthesizing Moneta** | **BOUNDED BATTERY LANDED** | #983 covers admissible graphs, advisory bypass, Pareto/handoff gates and Research Mode invariance; broader analytical/device claims need their own evidence. | [Incremental plan](roadmap/P1_FULL_MONETA_INCREMENTAL_CAPABILITY_PLAN.md) |
| **FM8 full Moneta / controlled adaptive representation** | **IMPLEMENTATION PARTIAL / INTEGRATED QUALIFICATION OPEN** | The FMA-01–13 repair set, dual-epistemic core and FM1/FM2 direct loop are landed; do not restore completion claims until FM1/FM2 rendered-surface qualification, DSE6 production/device/human evidence, measured FM5 value, SHADOW-0017 independent review and required human/device evidence satisfy the integrated V3.1 exit. | [Full Moneta audit + dual-mode addendum](review-plans/FULL_MONETA_COMPLETENESS_AUDIT_2026-10-04.md) |
| **FM-DSE minimum dataset embodiment** | **DSE1–DSE3 LANDED / DSE6 QUALIFICATION OPEN** | The synthetic DSE6 battery exercises bounded plan compilation and mocked traversal; it does not establish physical Quest behavior, dataset-scale compute, measured memory/leak freedom, or human semantic recovery/accessibility. Acquire attributable production/device/human evidence before completion; DSE4/5 remain conditional. | [RFC 0012](rfcs/0012-minimum-nemosyne-architecture.md), [ADR-0013](architecture/decisions/0013-minimum-nemosyne-architecture.md), [DSE6 battery](work/DSE6_QUALIFICATION_BATTERY.md) |
| **UXR4/UXR5 device qualification** | **EVIDENCE ACQUISITION OPEN** | Capture attributable Quest interaction/render/resource/comfort evidence when hardware is available. | [UXR programme](roadmap/P1_UXR_SEMANTIC_EFFICIENCY_UX_RUNTIME_AND_VERIFICATION.md) |
| **P1-WP → P1-WQ** | **BLOCKED BY REQUIRED UXR/ASSURANCE CLOSURE** | Productionize web surfaces, then ordinary-browser investigator qualification. | [Product transition plan](roadmap/P1_PRODUCT_TRANSITION_PLATFORM_AND_LEARNING_PLAN.md) |
| **PT9/PT10 learned/private-preview work** | **DOWNSTREAM** | Requires WQ and finite evidence closure appropriate to the promoted claims. | [Product transition plan](roadmap/P1_PRODUCT_TRANSITION_PLATFORM_AND_LEARNING_PLAN.md) |

The default execution model remains **one owner-controlled forward tranche plus genuinely disjoint parallel-safe ribs**. Idle agents are preferable to invented work. High-risk authority/scientific changes require pre-implementation falsifiers and independent post-implementation review under [AGENTS.md](../AGENTS.md).

### FM-DSE delivery and remaining evidence

ADR-0013 accepts the minimum four-subsystem architecture proposed by RFC 0012; the RFC header still says proposed and must be read with that accepted decision. DSE1–DSE3 direct compilation, traversal and feedback implementation is landed; do not reschedule those tranches from old planning text.

DSE6 remains open for real analytical/Worker integration, physical budget/latency and measured memory/endurance evidence, semantic recovery and accessibility with investigators. Its synthetic `CONTINUE` result is a development signal only. See the [corrected battery scope](work/DSE6_QUALIFICATION_BATTERY.md).

DSE4 multi-dataset comparison and DSE5 runtime proposal/search remain conditional: reopen only for a named blocking research task or measured incremental value, with separate authorization and evidence. Existing deployment/readiness obligations remain governed by their accepted contracts and registry.

### Next work and ownership

The roles below route work; they do not assert that an agent has claimed it. Named assignment, claim, branch/worktree, blockers and PR belong in the task queue (OpenRig when configured). Each assignment must cite its roadmap ID and specification. No OpenRig queue or agent roster is established by this document.

| ID / priority | Next bounded action and gate | Responsible role | Assignment |
| --- | --- | --- | --- |
| **TEC/FM0 — dependency first** | TEC1 [policy refusals](work/TEC1_REAL_KERNEL_REPLAY_REFUSALS.md), TEC3 [null cases](work/TEC3_REAL_WASM_STATISTICAL_NULL_CONTROLS.md), [Pearson guard](work/TEC3_PEARSON_UNDEFINED_RECEIPT_GUARD.md) landed. Typed capture-refusal diagnostics landed (#1054); wider calibration and governed consumer-scope decision remain open. | Evidence/runtime specialist | Unassigned |
| **FM8-BIND — LANDED** | Refined [RFC 0013](rfcs/0013-fm8-composition-evidence-binding.md) strict multi-snapshot binding and v2 identity merged (#1056); independent SHADOW-0017 revalidation remains. | Representation specialist | Unassigned |
| **DSE6 — evidence closure** | Replace synthetic-only completion evidence with the [production/device/human qualification](work/DSE6_QUALIFICATION_BATTERY.md); coordinate shared hardware with UXR/QCA. | Runtime + XR/research qualification specialists | Unassigned |
| **FM1/FM2 — surface evidence** | Desktop lineage landed (#1059); inspector/browser journey open. [Exit](work/FM1_FM2_EXIT_QUALIFICATION.md). | Interaction/XR specialist | Unassigned |
| **FM5 — revise before promotion** | Reassess failed proxy results under the [value plan](work/FM5_VALUE_QUALIFICATION_PLAN.md); any behavior fix needs its own contract and owner-approved evaluation bar. | Representation + scientific-method specialist | Unassigned |
| **QCA0/QCA4 — parallel when disjoint** | Correct governed baseline attribution and compare landed rendering changes on physical Quest; use the [QCA handoff](work/quest-compute/QCA0_BASELINE.md). | Performance specialist + device operator | Unassigned |
| **UXR4/UXR5 — physical evidence** | Capture remaining attributable interaction/resource/comfort evidence under [Quest operations](roadmap/P1_QV_QUEST_VALIDATION_OPERATIONS.md). | XR qualification specialist + device operator | Unassigned |
| **UX-HOME — specification review** | Review the detailed stationary-workspace/Home specification under owner-approved [RFC 0014](rfcs/0014-stationary-workspace-and-explicit-home.md); runtime/device qualification is still open. | Product owner + interaction specialist | Unassigned |

One forward implementation tranche remains the default. The owner/lead selects and records it before code work; this table is a dependency/decision backlog, not authorization for all rows to execute concurrently. Specialist roles follow [OWNERSHIP.md](OWNERSHIP.md). Queue state cannot promote roadmap status without the required verification/review evidence.

## Quest Compute Acceleration — individual tasks

This replaces scriptc as the immediate Quest-browser optimization experiment. Rust/WASM remains analytical authority and ordinary browser/WebXR deployment remains the default topology.

| ID | Status | Dependency | Task |
| --- | --- | --- | --- |
| **QCA0** | **ENGINEERING BASELINE CAPTURED / GOVERNED RERUN OPEN** | Historical `INVALID_RUN` remains; exclude pre-fix dispatch-only load timings | [Quest performance baseline](work/quest-compute/QCA0_BASELINE.md) |
| **QCA1** | **HOTSPOT AUDIT FIRST** | Baseline does not establish a dominant eligible kernel; SIMD work requires attribution | [Rust/WASM SIMD128](work/quest-compute/QCA1_WASM_SIMD.md) |
| **QCA2** | **CORRECTED MEASUREMENTS REQUIRED** | Measure real load completion and main-thread costs before selecting offload | [Worker/main-thread offload audit](work/quest-compute/QCA2_WORKER_OFFLOAD.md) |
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
2. claim one bounded task by roadmap ID in the task queue, recording the named assignee, branch/worktree and collision-sensitive files;
3. update the linked work document with implementation evidence, not the roadmap with narrative;
4. change the roadmap only when **status, sequencing, dependency or ownership** changes;
5. on completion, leave a short final evidence record in the task document and append one concise line to the historical ledger;
6. merge only with exact-head evidence appropriate to risk, then refresh before selecting the next task.

This keeps the roadmap small enough to coordinate humans and agents instead of becoming the project itself.
