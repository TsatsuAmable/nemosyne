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

**Integration base:** `main@4f8c6a426d0868326263c5d5888848d3626c9c19` (PR #955, FMA-01–04 immediate authority/compiler containment).

- Architecture 2027 decisions are integrated: A27-0 and A27-1 accepted; L0 semantic snapshot, L1 committed perspective/context V2 and L2 Forma admission/KB0 contracts landed in PRs #936-#938. These are enabling contracts, not automatic product-capability promotion.
- **P1-TEC / FM0 remains active**. Governed replay/consumer-policy work is substantially landed; remaining evidence-identity, calibration/qualification and downstream evidence-reference closure must remain fail-closed. See [RFC 0009](rfcs/0009-persisted-governed-evidence-replay.md).
- **UXR0-UXR3 are at bounded software exits. UXR4/UXR5 remain physical-evidence open.** See [UXR programme](roadmap/P1_UXR_SEMANTIC_EFFICIENCY_UX_RUNTIME_AND_VERIFICATION.md) and [Quest validation operations](roadmap/P1_QV_QUEST_VALIDATION_OPERATIONS.md).
- **Full Moneta is IMPLEMENTATION PARTIAL.** PR #955 landed the immediate FMA-01–04 authority/compiler containment, removing fabricated grounded analytics and hardening several compiler failures. The [4 October completeness audit](review-plans/FULL_MONETA_COMPLETENESS_AUDIT_2026-10-04.md), including its dual-epistemic addendum, remains the repair authority: Full Moneta must preserve RFC 0011's two intended epistemic purposes, grounded/reproducible claim-bearing output and explicitly conjectural exploratory/predictive output. The typed conjectural path and remaining identity/integration/learning work are still open; previous completion labels do not authorize downstream promotion. See [incremental plan](roadmap/P1_FULL_MONETA_INCREMENTAL_CAPABILITY_PLAN.md) and [architecture](architecture/FULL_MONETA_SEMANTIC_EMBODIMENT_ARCHITECTURE_PLAN.md).
- **Quest Compute Acceleration is active as a bounded parallel performance lane.** QCA0 baseline comes first. See [QCA index](work/quest-compute/README.md).
- **scriptc is parked for Quest/WebXR.** It may be reconsidered only for a real native CLI/sidecar/tool deployment with measured benefit. See [scriptc evaluation](roadmap/SCRIPTC_NATIVE_TYPESCRIPT_EVALUATION.md).

Current order:

```text
P1-TEC / FM0 evidence closure
  -> dual-epistemic contract repair DM-0..DM-3 (RFC 0011 / audit addendum)
  -> L2-FORMA-1 first static Forma vertical slice
  -> FM3/4 composition + resolution qualification
  -> FM5 System-1 assistance
  -> FM6 human refinement / Forma knowledge
  -> FM7 searching / synthesizing Moneta
  -> FM8 full Moneta / controlled adaptive representation
parallel when evidence/collision rules allow: UXR4/5 physical qualification + QCA0-QCA5
then: P1-WP -> P1-WQ -> PT9/PT10
```

## Forward dependency spine

| Work | Status | Next action / dependency | Detail |
| --- | --- | --- | --- |
| **P1-TEC / FM0 trustworthy evidence** | **ACTIVE** | Finish finite evidence identity/calibration/consumer qualification required by claim-bearing downstream work. | [RFC 0009](rfcs/0009-persisted-governed-evidence-replay.md), generated RF table below |
| **FM1 perspective/context** | **IMPLEMENTATION PARTIAL — completion claim withdrawn by audit** | DM-0 first: make epistemic purpose explicit/no-default and complete context identity; then restore immutable history, product consumption and render-time activation checks (FMA-06/08). | [Full Moneta audit + dual-mode addendum](review-plans/FULL_MONETA_COMPLETENESS_AUDIT_2026-10-04.md) |
| **FM2 alternative-aware / Road Not Taken** | **IMPLEMENTATION PARTIAL — completion claim withdrawn by audit** | Repair atomic branching and coherent graph/context/decision revisit; wire real product interactions (FMA-06/07/08). | [Full Moneta audit](review-plans/FULL_MONETA_COMPLETENESS_AUDIT_2026-10-04.md) |
| **FM3 Forma first vertical slice / L2-FORMA-1** | **IMPLEMENTATION PARTIAL — immediate FMA-01–04 containment landed in #955** | DM-1..DM-3 next: add typed conjectural proposals and grounded/conjectural Forma bindings on top of the hardened admission/compiler boundary; then deliver real renderer and V4 static restoration (FMA-01–04/09). | [Full Moneta audit + dual-mode addendum](review-plans/FULL_MONETA_COMPLETENESS_AUDIT_2026-10-04.md) |
| **FM3/4 composition + resolution adaptation / L2-FORMA-2 + L4-RUNTIME-BUDGET** | **IMPLEMENTATION PARTIAL — completion claim withdrawn by audit** | Repair final-content identity, enforced budgets, context authorization and selected-graph fidelity (FMA-05/10). | [Full Moneta audit](review-plans/FULL_MONETA_COMPLETENESS_AUDIT_2026-10-04.md) |
| **FM5 System-1 assistance** | **IMPLEMENTATION PARTIAL** | Establish governed advisory influence and baseline/model/device evidence; current FM8 proposals do not drive graph selection (FMA-10). | [Full Moneta audit](review-plans/FULL_MONETA_COMPLETENESS_AUDIT_2026-10-04.md) |
| **FM6 human refinement / Forma knowledge** | **IMPLEMENTATION PARTIAL — completion claim withdrawn by audit** | Repair attributable knowledge qualification, corpus identity and candidate-bound measured promotion (FMA-11–13). | [Full Moneta audit](review-plans/FULL_MONETA_COMPLETENESS_AUDIT_2026-10-04.md) |
| **FM7 searching / synthesizing Moneta** | **IMPLEMENTATION PARTIAL — completion claim withdrawn by audit** | Compile selected bindings/relations and establish real governed product integration (FMA-08/10). | [Full Moneta audit](review-plans/FULL_MONETA_COMPLETENESS_AUDIT_2026-10-04.md) |
| **FM8 full Moneta / controlled adaptive representation** | **IMPLEMENTATION PARTIAL — completion claim withdrawn by audit** | Remove fabricated grounded analytics/evidence **without deleting predictive capability**; route adaptive/search output through ConjecturalProposalV1 + typed Forma admission, then complete integration and durable qualification (FMA-01/08–13; DM-1/DM-5). | [Full Moneta audit + dual-mode addendum](review-plans/FULL_MONETA_COMPLETENESS_AUDIT_2026-10-04.md) |

| **UXR4/UXR5 device qualification** | **EVIDENCE ACQUISITION OPEN** | Capture attributable Quest interaction/render/resource/comfort evidence when hardware is available. | [UXR programme](roadmap/P1_UXR_SEMANTIC_EFFICIENCY_UX_RUNTIME_AND_VERIFICATION.md) |
| **P1-WP → P1-WQ** | **BLOCKED BY REQUIRED UXR/ASSURANCE CLOSURE** | Productionize web surfaces, then ordinary-browser investigator qualification. | [Product transition plan](roadmap/P1_PRODUCT_TRANSITION_PLATFORM_AND_LEARNING_PLAN.md) |
| **PT9/PT10 learned/private-preview work** | **DOWNSTREAM** | Requires WQ and finite evidence closure appropriate to the promoted claims. | [Product transition plan](roadmap/P1_PRODUCT_TRANSITION_PLATFORM_AND_LEARNING_PLAN.md) |

The default execution model remains **one owner-controlled forward tranche plus genuinely disjoint parallel-safe ribs**. Idle agents are preferable to invented work. High-risk authority/scientific changes require pre-implementation falsifiers and independent post-implementation review under [AGENTS.md](../AGENTS.md).

## Quest Compute Acceleration — individual tasks

This replaces scriptc as the immediate Quest-browser optimization experiment. Rust/WASM remains analytical authority and ordinary browser/WebXR deployment remains the default topology.

| ID | Status | Dependency | Task |
| --- | --- | --- | --- |
| **QCA0** | **BASELINE CAPTURED / QUALIFICATION RE-RUN OPEN** | corrected exact-head Quest 3S run | [Quest performance baseline](work/quest-compute/QCA0_BASELINE.md) |
| **QCA1** | **READY AFTER QCA0** | QCA0 hotspot evidence | [Rust/WASM SIMD128](work/quest-compute/QCA1_WASM_SIMD.md) |
| **QCA2** | **READY AFTER QCA0** | QCA0 main-thread evidence | [Worker/main-thread offload audit](work/quest-compute/QCA2_WORKER_OFFLOAD.md) |
| **QCA3** | **BLOCKED_BY QCA2 MEASUREMENTS** | prove transfer/synchronization cost matters | [Transferable buffers, memory and WASM threads](work/quest-compute/QCA3_TRANSPORT_THREADS.md) |
| **QCA4** | **READY AFTER QCA0** | QCA0 render/GPU evidence | [WebXR rendering fast wins](work/quest-compute/QCA4_WEBXR_RENDERING.md) |
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
