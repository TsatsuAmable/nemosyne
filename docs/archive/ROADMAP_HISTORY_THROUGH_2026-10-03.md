# Nemosyne Roadmap Historical Ledger Through 3 October 2026

> **Frozen historical record.** This is the complete pre-compaction operational roadmap captured from `main` on 3 October 2026. It preserves completed tranches, old execution detail, incident notes, historical stream structures, prior status prose and archaeological context. It is not the live execution authority.
>
> Live status and sequencing are owned only by [`docs/ROADMAP.md`](../ROADMAP.md). Detailed evidence/specification documents linked below remain authoritative for their own claims, but their historical status text must not be read as current scheduling.
>
> This file is the single roadmap-history entry point. Older archive files remain immutable provenance/evidence artifacts and need not be re-listed in the live roadmap.

## Future completion ledger

When a live task is completed and removed from `docs/ROADMAP.md`, append one concise record here: **date · task id · final status · PR/evidence · linked task/spec**. Do not copy the task narrative into this ledger. The frozen snapshot below remains unchanged.

---

# Nemosyne Roadmap & Implementation Status

> **Canonical implementation-status and execution authority.** Product and research direction remain governed by `docs/Nemosyne_Definitive_Vision_and_Roadmap.md` V3.1. This file is the current operational map: what is active, which programme owns it, which integration seams are exclusive, what evidence closes a checkpoint, and what must wait. Detailed programme documents remain the scientific, UX, security, or evidence specification for their own scope; their older status headers do not override this live roadmap.

## Status snapshot - 3 October 2026

**Current integration base:** `main@c55165bf94ec0eb0ead44693020ef269922c72ee` (#926, Shadow SHADOW-0001 candidate record, 3 October 2026). Since the previous #871 base (`main@44b98861c89b6b0625e9f78723cd3259b2d32eaa`, RFC 0009 tranche 3 slice 2 follow-up — single-compute governed capture export), the merged tranches are the CMS-5 palette/CVD decision #892 and execution #894, the CMS-6 perception audit/decision #893 and execution #896, the CMS-4 collaboration deletion #895, CMS-1 #888, CMS-2 #890, CMS-3 #889, the CMS-7 test-rent census #891, FM4-UI-CLEAN #897, the FM3-PERCEPT spatial-audio decision #898 and execution #899, the scriptc evaluation plan #900, the RFL cycle-7 RFL-0003 candidate record #901, the Quest 3 SoC report plus Mac assignment #902, the roadmap record housekeeping #903 (reconciling the FM0/FM1-MEM/FM2/FM3/FM4/FM5 rows with those retirements), the RFL-0003 fix-forward #904, the roadmap status reconciliation #905, the roadmap-freshness automation #906 (base-identity plus link checks in `docs:check`), the RF-043 byte-ingest ABI falsifiers #907, the roadmap sync #908, the RFL cycle-8 RFL-0004 candidate record #909, the semantic-embodiment vision clarification #910, the roadmap sync #911, the RFL cycle-9 RFL-0005 candidate record #913, the human-grounded Full Moneta architecture consolidation #912, the roadmap sync #914, the roadmap sync #915, the roadmap sync #916, the RFL-0004 live-ingest fix-forward #917, the RFL-0005 polling-fence fix-forward #918, and the RFL cycle-10 RFL-0006 candidate record #919, the roadmap sync #920, and the RFL cycle-11 RFL-0007 candidate record #921, the roadmap sync #922, and the RFL-0007 fix-forward #924, the roadmap sync #925, the Architecture 2027 adjudication #923, and the SHADOW-0001 candidate record #926. UXR0-UXR3 remain at their bounded software exits; UXR4/UXR5 physical qualification remains open and runs only when attributable headset/human evidence is available, without blocking unrelated software work. P1-TEC has advanced materially: #820 established authority-owned requirement profiles, #821 landed governed replay resolution with typed dataset/kernel/profile refusals, #823 hardened replay identity capture against coercion/substitution, #824 accepted the governed receipt replay-format design, #829 landed the opt-in V3 receipt package/digest contract while preserving historical V1/V2 replay compatibility, #831 added governed V3 capture/export under explicit opt-in, and #833 added governed V3 package loading/replay attestation through the current tranche boundary. A 29 September authority audit identified one remaining tranche-2 blocker in #834: governed evidence capture still reached module-global `RuntimeBridge` functions through `MonetaEvidenceAuthority` rather than the injected analytical execution port, which can diverge from the Worker-owned production Rust instance. That fix-forward is now merged and verified (30 September 2026): #843 landed at `main@f6cfc52c`, its exact head `1924ee58` carrying an adversarial-review PASS and every CI job green. Of the architecture checks, one is load-bearing rather than a repeat of the local result: `architecture:boundaries:test` cannot run on this Windows host at all (`node_modules\.bin\depcruise.cmd` fails with `SyntaxError: Invalid or unexpected token` before the checker executes), so its green on `ubuntu-latest` is evidence this machine could not have produced. `architecture:boundaries` and the ast-grep suite do run here (both exit 0), so their CI result confirms rather than adds. Acquisition routes through the injected port for both inline and Worker execution and ordinary `serialize()` is again the pure carrier snapshot item (4) of the #834 record below already mandated — see the dated record below for the evidence and for what it explicitly does not close. RFC 0009 tranche 3's first slice is likewise merged and verified (1 October 2026): #848 landed at `main@e0fcaf7f`, its exact head `4f2115cc` carrying an adversarial-review PASS against that head and every CI job green, so the governed loader's fifth-step refusal is derived from an authority-owned consumer policy rather than from a hard-coded verdict — see the slice-1 record below for what it does and does not close, including that the shipped policy governs no consumer. TEC1 and TEC2 therefore remain open checkpoints, not completed gates: consumer-policy binding enforcement is now landed for the first governed consumer (descriptive statistics, under the `descriptive-summary/v1` profile) as slice 2 — #866 (2 October 2026), whose Rust-issued consumer identity and minting producer make the loader's binding step reachable end to end — so the seam's fifth step of replay consumption of the carried envelope is no longer a refusal stub, and a governed V3 package carrying conforming `uses` replays with `enforcement: 'consumer-policy'`; the counter-truth is stated in the slice-2 record below, that a governed V3 package with an *empty* `uses` — the shape every earlier build exported — now refuses as `CONSUMER_NOT_GOVERNED` and must be re-exported; DatasetEvidence identity binding and MCR2+ evidence-reference enforcement remain open. #825, #826, #827 and #828 are dependency maintenance only and do not promote a scientific, product or physical-evidence checkpoint. Bounded non-colliding P1-TEC work may continue concurrently; P1-WP, P1-WQ and finite P1-TEC closure remain prerequisites for PT9, and P1-MCR/evolutionary synthesis may not bypass trustworthy-evidence closure.

**R1 transfer closure:** Mapper, persistence intervals, Betti-0, statistics, dataset JSON, the five semantic embodiment builders, semantic detail and direct spectral facts use Rust-owned prepare/read/destroy result transfer through the production bridge. #790 closes the duplicate-authoritative-computation finding with production-path evidence for one substantive computation/materialisation and explicit result lifetime handling. #791 separately removes redundant fresh-load copies at the Atlas handoff. These changes do not by themselves establish measured latency, physical-memory improvement or total semantic-memory bounds; those remain evidence claims for the relevant UXR4/UXR5 envelopes.

**Local verification blocker — this Windows host cannot produce a `test:fast` baseline (2 October 2026; counts re-measured the same day at `main@58c6a91e`):** On `origin/main@a61801c7` (fresh remote main, every CI job green on ubuntu runners), a local `npm run test:fast` fails — the first observation under-counted the suite as 14 failures across seven PT4B governance files; a like-for-like re-run at that base in a temporary worktree and a re-confirmation at `main@58c6a91e` both measure the stable baseline as **31 failed tests across 10 files**: 29 `ProductAnalyticsAuthorityError` mode-0700 failures across the nine PT4B governance files (`pt4b-data-plane-auth`, `pt4b-consent-capture-authority`, `pt4b-runtime-manifest-authority`, `pt4b-lifecycle-export-erasure`, `pt4b-governance-http-surface`, `pt4b-http-resource-budgets`, `pt4b-governed-event-ingestion`, `pt4b-lifecycle-restart`, `pt4b-governance-composition-client-config`), plus the two `quest-loadtest-sink` path-separator failures below (the base `a61801c7` run shows one additional unrelated 5-second timeout flake in `moneta-evidence-scorer-authority` that passes at `58c6a91e`), all of the 29 sharing one root cause: `ProductAnalyticsAuthorityError: governance data directory must be mode 0700`. The durable cause is the constructor-mode-verification block in `src/governance-service/ProductAnalyticsConsentAuthority.ts` (mkdir/chmod at `0o700` with an immediate `statSync().mode & 0o777` recheck for the data directory and at `0o600` for the SQLite database file): Node on Windows cannot satisfy that POSIX contract — `chmodSync` there only toggles the read-only attribute, so the recheck never sees `0o700`/`0o600` and the authority correctly refuses to construct. The durable cause is the constructor-mode-verification block in `src/governance-service/ProductAnalyticsConsentAuthority.ts` (mkdir/chmod at `0o700` with an immediate `statSync().mode & 0o777` recheck for the data directory and at `0o600` for the SQLite database file): Node on Windows cannot satisfy that POSIX contract — `chmodSync` there only toggles the read-only attribute, so the recheck never sees `0o700`/`0o600` and the authority correctly refuses to construct. The enforced property may be exactly right on the intended host; the finding is that Windows is not one, and no existing evidence channel says so. This finding is logged, not acted on. Two owner decisions gate any successor attempt: (a) whether Windows is meant to be a supported development/runtime host at all — CI is ubuntu-only (`runs-on: ubuntu-latest` throughout `.github/workflows/ci.yml`), so today no channel verifies Windows behaviour; (b) if yes, enforce through the production path via Windows ACLs (e.g. `icacls`-equivalent rights checks) or platform-aware verification, never by weakening or silently dropping the mode/refuse construction checks, which sit at a trust boundary and are subject to the production-path evidence rule; if no, make the POSIX-only development environment explicit with an owned, visible skip rather than an unexplained red cluster. Separately on the same host and suite, `tests/quest-loadtest-sink.test.ts` fails 2 of 22: QV3 "writes manifest, analysis, and disposition with launch-gate classification" expects the produced evidence list to include `analysis.json`, and QV3 "adds UX placeholders only for the quest-ux mode" expects `ux-results.json` — *clarified on the same day*: the RFC 0009 tranche-3 slice-1 record (merged in #848, earlier on 1 October 2026) already classifies these two among the pre-existing Windows environment failures of the full fast lane, caused by `split('/')` applied to `join`-built paths, so they are an instance of the same host-availability class above, not expectation/behaviour drift; a maintainer judgement of test truth versus code truth is only needed for how that path class itself should be resolved on Windows, which folds into the same two owner decisions rather than a separate one. These are host-verification availability findings only; they change no P1-TEC, UXR or physical-evidence checkpoint status, and no local claim of a green or red `test:fast` beyond this record is valid until one of the two decisions above is made.

## Mac experimental lane — Quest 3 SoC architecture and performance

The Mac owns a non-colliding Quest 3 performance/architecture programme described in [`architecture/QUEST3_SOC_ARCHITECTURE_PERFORMANCE_REPORT.md`](architecture/QUEST3_SOC_ARCHITECTURE_PERFORMANCE_REPORT.md). This lane optimizes the existing WebXR/Three.js/Rust-WASM path first and treats a native Quest/Hexagon path as a gated escape hatch, not an assumed rewrite.

Execution order is **MAC-Q0 baseline → MAC-Q1 Browser fast wins → MAC-Q2 representation hot path → MAC-Q3 runtime/data plane → MAC-Q4 FM5/device intelligence → MAC-Q5 native feasibility only if triggered**. Mac may implement instrumentation, deterministic tests and simulator-safe changes without a headset; claims about Quest frame pacing, GPU, thermal, power or device behavior remain open until attributable physical Quest 3 evidence is captured. Rust/WASM analytical authority and existing evidence/provenance boundaries are unchanged. The architecture/performance report plus the Mac assignment landed as #902 at the current base.
## Native TypeScript compilation experiment — scriptc

A bounded, non-blocking scriptc evaluation belongs to **L4 Runtime & Device Efficiency** and is currently assigned to Mac experimental capacity. The experiment starts with deterministic canaries and differential testing, then may progress to a bounded native sidecar/tool only if a real deployment topology, semantic parity and measured benefit are demonstrated. It does **not** move analytical authority from Rust/WASM, is not a Full-Moneta dependency, and browser/WebXR/UI paths are excluded. Canonical experiment protocol, candidate families, measurements and adoption gates: [`roadmap/SCRIPTC_NATIVE_TYPESCRIPT_EVALUATION.md`](roadmap/SCRIPTC_NATIVE_TYPESCRIPT_EVALUATION.md).

Execution order: **T0 toolchain baseline → T1 InvestigationDigest canary → T2 contracts/registry census → T3 bounded native sidecar/tool prototype if an actual target exists → T4 selective utility census**. T0-T2 may run now without blocking current P1-TEC or FM0-FM4 work; T3 is conditional rather than an FM5 prerequisite; T4 is conditional on demonstrated value. The evaluation plan plus lane scheduling landed as #900 at the current base.

## Full Moneta incremental capability ladder — product/intelligence integration spine

The canonical integration plan for the path from bootstrap Moneta to Full Moneta is [`roadmap/P1_FULL_MONETA_INCREMENTAL_CAPABILITY_PLAN.md`](roadmap/P1_FULL_MONETA_INCREMENTAL_CAPABILITY_PLAN.md). The architecture preflight that makes semantic embodiment explicit is [`architecture/FULL_MONETA_SEMANTIC_EMBODIMENT_ARCHITECTURE_PLAN.md`](architecture/FULL_MONETA_SEMANTIC_EMBODIMENT_ARCHITECTURE_PLAN.md). It evolves the existing semantic graph → RepresentationGraph → spatial-plan spine by inserting Moneta Forma and a planned modality-independent `PerceptualEmbodimentPlan`; it is not a new analytical authority.

The programme is organised around **researcher-visible capability increments**, not a long architecture-first chain. Each increment must add a bounded form of representation intelligence **and** an experience that can be exercised, falsified and assessed before the next increment is promoted.

| Increment | Product capability | Main specialist work consumed |
| --- | --- | --- |
| **FM0 — Trustworthy Moneta** | Provenance-complete, replayable decisions from one analytical authority. | P1-TEC / RFC 0009; **ACTIVE now** — RFC 0009 tranche 3 slice 2 (kernel-issued consumer identity + governed use minting; the first registry entry, descriptive statistics under `descriptive-summary/v1`, binds end to end) landed in #866 on 2 October 2026 with every CI job green; the next tranche-3 slices are DatasetEvidence alias migration, production consumption qualification and MCR2+ evidence-reference enforcement. |
| **FM1 — Question/Perspective-Aware Moneta** | Research question, hypothesis, task and explicit perspective can legitimately foreground different supported semantics without changing analytical truth. | InvestigationIntent/ResearchContext + `InvestigationPerspectiveV1` + provenance/replay. |
| **FM2 — Alternative-Aware Moneta / Road Not Taken** | Inspect, compare, challenge, reject and branch from meaningful alternatives. | Existing alternative metadata, NIL/judgement, Memory Palace, TechnoCore. |
| **FM3 — Compositional Moneta / Forma** | Several governed semantic phenomena coexist and compile into explainable perceptual embodiment. | L0-SEM-NORM + L2-FORMA-0 + P1-MCR MCR2-MCR4 + product interaction qualification. |
| **FM4 — Resolution-Adaptive Moneta** | Same semantic investigation supports hardware-dependent “stickman ↔ Mona Lisa” richness without changing analytical truth. | P1-MCR + UXR lifecycle/resource work + semantic-resolution contracts. |
| **FM5 — Intuitive / System-1-assisted Moneta** | Small fast specialist models may propose bounded Forma/representation choices and object-centric interaction cues without becoming semantic, representation or analytical authority. | [System-1/System-2 ONNX architecture](architecture/MONETA_SYSTEM1_SYSTEM2_ONNX_ARCHITECTURE.md) + qualified FM3 Forma grammar + pinned proposal/provenance contract + device qualification. |
| **FM6 — Human-Refined Moneta** | Governed human meaning judgments, embodiment critiques and validated discovery outcomes become scoped Forma knowledge and improve future proposal priors. | Forma knowledge retention + PT9 learning evidence/model promotion + PT10/private-preview evidence where available. |
| **FM7 — Searching/Synthesizing Moneta** | Bounded grammar/search and explicit System-2 analogy synthesis produce inspectable representation/metaphor hypotheses beyond the fixed catalogue. | Representation objective/search work + MCR7 handoff + System-2 synthesis + evolutionary/adversarial laboratory evidence; world-model work only if separately justified. |
| **FM8 — Full Moneta** | Evidence, intent, context, learned priors, search and hardware budget jointly drive controlled adaptive representation intelligence. | Integrated qualification and human/device evidence. |

This capability ladder **replaces the old planning assumption that all PT9/PT10 learning must complete before any production compositional capability can be experienced**. Scientific admissibility and trustworthy-evidence closure remain hard gates, but deterministic/reference composition may be promoted at FM3 once its own prerequisites are met. PT9 enters at FM6, where learning actually becomes part of the product capability.

### Full-Moneta architecture gates and build queue

The canonical target architecture is [`architecture/FULL_MONETA_SEMANTIC_EMBODIMENT_ARCHITECTURE_PLAN.md`](architecture/FULL_MONETA_SEMANTIC_EMBODIMENT_ARCHITECTURE_PLAN.md), reconciled with the delivered [Architecture 2027 adjudication](architecture/ARCHITECTURE_2027_REVIEW.md). Before MCR2 hardens the wrong abstraction, settle the authority/version seam and then land the architecture-language tranches below:

| Tranche | Lane | Class | Purpose | Exit |
| --- | --- | --- | --- | --- |
| **A27-0 — authority/version decision** | L0/L2 | ACCEPTED by project owner, 3 October 2026; implementation handoff qualified by A27-1 | [Decision and machine-addressable handoff](architecture/A27_0_AUTHORITY_VERSION_DECISION.md) and [accepted RFC 0010](rfcs/0010-moneta-semantic-snapshot-and-forma-admission.md) fix snapshot identity, Moneta-owned obligations, purpose-scoped admission, refusals, graph V2 and package/digest V4. Acceptance is recorded in PR #927. | After #927 integration, refresh main: Claude/L0 resolves first-family coverage and starts L0-SEM-NORM-A subject to the affected TEC handoff; OpenCode/L1 may start its disjoint perspective contract; Codex/L2 follows their merged contracts. Shared session/digest/adoption integration remains serialized in L2-FORMA-1. No downstream implementation is complete; INVESTIGATE/evidence/lease gates remain. |
| **L0-SEM-NORM-A** | L0 | VERIFIED COMPLETE / shared semantic schema | Normalize authoritative family outputs into a decision-independent semantic snapshot without inventing new science. Preserve missing/refused/approximate state and claim/profile identity. | The same analytical snapshot survives two decisions/perspectives; missing/retracted/wrong-profile evidence refuses; every supported family maps explicitly and unsupported families remain unavailable rather than guessed. |

| **A27-1 — dual epistemic reconciliation** | L1/L2 | ACCEPTED AS AMENDED — delegated architectural adjudication | [Reassessment](architecture/A27_1_DUAL_EPISTEMIC_REASSESSMENT.md) reconciles merged #929 with accepted #927; [RFC 0011](rfcs/0011-dual-epistemic-embodiment-and-preservation.md) now mandates context V2 purpose/identity, validated conjectural bindings and V4 static preservation. | After this decision integrates: L0 grounded first-family normalization and L1 context V2 follow-up are architecturally cleared in disjoint dedicated worktrees, retaining evidence/lease gates. L2 contract work is cleared; final freeze depends on merged verified L0/L1 contracts. L2-FORMA-1 integration remains serialized. No capability or model choice is promoted. |
| **L1-PERSPECTIVE-0** | L1 | VERIFIED COMPLETE / context V2 epistemic purpose | Embed versioned perspective in committed investigation context and distinguish foregrounding from operations that change the analyzed population/derivation. Preserve ADR 0009 lineage. | Draft changes do not mutate history; commit/revisit/branch restores exact context; unchanged evidence identity remains unchanged; any filtering/recomputation crosses the governed analytical path. |

| **L2-FORMA-0 + bounded KB0** | L2 | VERIFIED COMPLETE / admission & KB0 manifest | Define the minimum admission/compilation contract: fixed obligations, typed bindings/channels, immutable plan/result identity, scoped qualification, execution purpose including restricted study use, reverse explanation and a pinned knowledge manifest over distinct rule/judgment/study/promotion authorities. No renderer or new knowledge service. | Untrusted decoding and unsupported mappings fail closed; candidate cannot weaken obligations or choose a weaker evidence profile; study-only eligibility cannot become production promotion; no mutable copy of analytical or human evidence is created. |

After the applicable P1-TEC evidence gate is satisfied, proceed in this order:

**L2-FORMA-1 first static production vertical slice (compiler + spatial backend + exact capture/replay + reverse explanation + non-adaptive critique/meaning capture) -> L2-FORMA-2 multi-element runtime / MCR3-4 -> optional L2-FORMA-3 behaviour/perturbation and additional modalities when justified.**

Run **L6 protocol/control design concurrently with L2 contract work** so restricted study-use semantics, misleading controls and human-required outcomes are defined before experimental mappings execute.

Then the dependent lanes become eligible:

- **L4-RUNTIME-BUDGET:** select only among admitted applicable variants; preserve fixed obligations, reject stale-context adoption and refuse when mandatory meaning has no qualified fallback. A global richness level is not evidence of semantic preservation.
- **L3-S1-FORMA:** deterministic case/rule retrieval baseline -> transparent ranker -> tiny learned/ONNX proposer only if it earns its complexity. System-1 remains advice-only and cannot change admission.
- **L6-EMBODIMENT-STUDY:** test intended-vs-perceived meaning, comprehension, error detection, recall, calibration, task time and transfer under frozen treatment identity; deliberately misleading mappings remain purpose-restricted controls, not production candidates.
- **L5-FORMA-KNOWLEDGE-1 (FM6):** retain qualified human outcomes as scoped knowledge revisions while original judgment/study custody remains with its existing authority; no self-promotion from recommendation acceptance.
- **L5-FORMA-SYNTH-1 + L5-FORMA-SEARCH (FM7):** explicit System-2 analogical synthesis and bounded grammar/search through the same compiler. A world-model experiment remains **unscheduled by default** and requires a named evidence-triggered problem.

Human feedback may be captured in the first FM3 Forma slice but must not adapt production priors until FM6 governance is active. This sequencing incorporates ERA-ASTRA1 without creating a second architecture programme.

### Product-experience recovery

The ladder explicitly restores product ideas that remain part of Nemosyne's identity but have become quieter during architecture/evidence work. They are not exempt from evidence: they should be implemented in bounded form, tested with users, retained when they create value and removed/revised when they do not.

- **Memory Palace** remains the spatial embodiment of investigation history/reasoning. Its bounded projection is already landed; future increments add question/representation lineage, branches, alternatives, outcomes and eventually search lineage.
- **Road Not Taken** becomes a first-class FM2 capability: inspect and inhabit alternative representation hypotheses while preserving semantic correspondence and provenance.
- **Challenge / falsification** remains a first-class interaction: perturb, seek counterexamples, compare representations, run analytical tests and record support/refutation/inconclusive outcomes.
- **TechnoCore** progressively becomes the instrument for asking how Nemosyne is seeing the dataset: provenance at FM0, intent at FM1, alternatives at FM2, composition at FM3, learned/search reasoning later.
- **Evidence Vault / Ice Vault** owns reproducible checkpoints, frozen investigation states and return.
- **Farcaster portals** are reserved for meaningful context travel: declared perspectives, branches, saved/related investigations, semantic-detail contexts and collaborator frames. Perspective changes foreground supported semantics; they do not change analytical truth.
- **Spatial epistemology** returns as an explicit representation-design question at FM3+: spatial relations may encode meaning only when the mapping is governed, inspectable and understood by users.
- **Branching, visible refutation and revisit** remain durable product semantics; disproven paths are history, not garbage.
- **Collaboration / peer challenge** may expose shared focus, counter-hypotheses and independent convergence without treating consensus as scientific authority.
- **Sonification, haptics and voice** remain candidate multimodal representation/interaction channels through versioned mappings and NIL, not decorative effects or parallel semantic authorities.
- **Cross-investigation recurrence/resonance** becomes eligible once enough governed discovery history exists; recurrence must remain visually and semantically distinct from validation.
- **Sparse cyberspace / Datum Plane identity** remains the visual doctrine: the dataset and evidence are protagonist, and every persistent spatial object must earn its volume.

**Semantic embodiment clarification / future review:** [`SEMANTIC_EMBODIMENT_VISION_CLARIFICATION.md`](SEMANTIC_EMBODIMENT_VISION_CLARIFICATION.md) makes explicit that Moneta Forma is a semantic-to-perceptual responsibility, not merely a 3D renderer: dataset semantics may be encoded through governed geometry, motion, sound, interaction and perturbation when the mapping is meaningful and explainable. Review this clarification at the **FM3 STOP / CONTINUE / REVISE gate** against P1-MCR and multimodal evidence, and again before **FM7 representation search** is promoted; preserve, revise or retire mappings according to measured comprehension/discovery value rather than novelty.

Each increment ends with a **STOP / CONTINUE / REVISE** product assessment in addition to its normal software/scientific promotion evidence.


### Feature placement by capability increment

The recovered product ideas and legacy-code decisions are now scheduled rather than held as an undifferentiated backlog. The detailed authority is `roadmap/P1_FULL_MONETA_INCREMENTAL_CAPABILITY_PLAN.md`.

- **FM0:** TechnoCore provenance + Evidence Vault replay/recovery; `FM0-CLEAN` retires safe Draco/serializer/share-link/misleading-alias debt. **Partially executed:** the share-link prototype and the false FlatBuffers serializer are retired (`ShareableSessionURL` and `src/data/serializers/FlatBuffersSerializer.ts` deleted, PRs #855 and #890), and the Draco facade is already a bounded single-file re-export barrel (`src/draco/index.ts` only, the deep mirrors collapsed in the Draco compatibility exit); the remaining `FM0-CLEAN` item is the deprecated representation/hash alias retirement, which is owner-gated (RFC 0007, S13/ERA-AG4) — not yet executed.
- **FM1:** question-aware Memory Palace + branch/revisit + bounded voice-to-NIL experiment; `FM1-MEM` **EXECUTED** (PR #855, merged 1 October 2026 at `a55edaf`): the dormant `MemoryPalaceController` is retired and deleted in full rather than reactivated — the production Memory Palace projection is the bounded separate authority; the live FM1 work is the question-aware increment.
- **FM2:** Road Not Taken, ghost/paired alternatives, Farcaster branch navigation, visible refutation and collaboration/peer-challenge pilot; `FM2-COLLAB-CLEAN` removes superseded collaboration-state/annotation code.
- **FM3:** Moneta Forma foundation: semantic normalization, typed perceptual bindings/plan, compositional semantic embodiment, reverse explanation, perturbation-response semantics, composed Challenge, and only then narrowly governed sonification/haptic experiments; `FM3-PERCEPT` records why the earlier palette/CVD and spatial-audio prototypes were not reusable production authorities. **DECIDED at base `9fca179e` (3 October 2026), merged as #898 at `main@01183b87`: ARCHIVE the spatial-audio prototype** — audit record `docs/review-plans/FM3_PERCEPT_SPATIAL_AUDIO_AUDIT_2026-10-03.md` (closes the FM3-PERCEPT half CMS-5 did not: palette/CVD was ABSORB-then-DELETE #894). Stop-grade clean: `SpatialAudioSynthesizer` (170L, real HRTF WebAudio but with zero src importers; its only code-owned content is two hand-set unprovenanced mappings — proximity pitch 300-1200 Hz and an A-major-7 chord — exactly what a governed FM3 sonification must regenerate, not inherit) and `SpatialAudioNarrator` (35L, zero importers, not barrel-exported; header claims narration wiring for operations/alerts/tour steps that does not exist anywhere) are production-unreachable, presentational-only, no decision path touched. `SelectionFeedback` is production-live (full consumer chain traced: SelectionDispatcher → InputRouter → Engine/World/coordinators, settings toggle at `World.ts:2184-2187`) and excluded. Disposition: delete both classes + the zero-importer `src/vr/audio/index.ts` barrel + `tests/spatial-audio.test.ts` (4 `expect(...).not.toThrow()` vacuities + 1 constructor-default pin, census RESEARCH_FIXTURE) + `tests/voice-spatial-engine.test.ts` (1 instantiate-rent it) — 6 its die, 0 live pins die; `tests/selection-feedback.test.ts` (15) unchanged; registry untouched (no audio entry; directory-grain `src/vr` coverage unaffected). Owed by the deleting PR: convert the P1 plan `P1_FULL_MONETA_INCREMENTAL_CAPABILITY_PLAN.md:510` row to the recorded disposition and fix the stale `.js` citation at `docs/INTERACTIONS.md:367`. Protection gaps observed (mooted by deletion): directory-grain `src/vr` registry coverage masks dormancy; the `vr/audio` barrel was guardian-unprotected. Forward: if FM3 sonification is ever commissioned, the future governed channel inherits nothing and must pin listener-frame authority, authored-position encoding, versioned mappings with provenance, no fabricated certainty, gesture-gated AudioContext lifecycle (audit §6). **EXECUTED at base `01183b87` (3 October 2026, execution PR #899, merged at `ae0e7db6`):** the ARCHIVE package was implemented as decided — `src/vr/audio/SpatialAudioSynthesizer.ts`, `src/vr/audio/SpatialAudioNarrator.ts`, the zero-importer `src/vr/audio/index.ts` barrel, `tests/spatial-audio.test.ts` and `tests/voice-spatial-engine.test.ts` are deleted (6 its, all dies-with-surface, 0 live pins); `SelectionFeedback` and its 15-it suite byte-untouched; registry untouched (18 entries); the P1 plan `SpatialAudioSynthesizer` row converted to the recorded disposition and the stale `.js` citation at `docs/INTERACTIONS.md:367` corrected (`SelectionFeedback.ts`) — both docs-only updates the decision owed to this PR. FM3-PERCEPT is now complete: both of its prototype halves are resolved (palette/CVD by CMS-5 #894, spatial-audio by this PR).
- **FM4:** stickman ↔ Mona Lisa semantic resolution, progressive crystallisation and cross-hardware spatial-memory continuity. Rust scene-command-buffer work remains evidence-triggered only. **FM4-UI-CLEAN EXECUTED via the CMS-7 census §S3 package (landed ahead of FM4 proper; merged as #897 at `main@9fca179e`):** the legacy `MovablePanel` canvas substrate is retired — `src/vr/ui/MovablePanel.ts` (631 lines, production-unreachable, zero src value-importers) and `src/vr/ui/CanvasTextureCacheManager.ts` (its only downstream consumer) are deleted, `MovablePanelOptions` is renamed to the substrate-neutral `PanelOptions` (4 fields read only by the dead class removed; the 7 live type-only consumer panels mechanically re-pointed), and `IPanelContentHandler` died with its only implementor. Also deleted: `dev/benchmark-uikit.ts` + `tests/ui-system/benchmark-uikit.test.ts` (the substrate-comparison benchmark whose only src-side value importer was the dead class). Test rents per the census per-file split: `movable-panel`/`movable-panel-scrollbar`/`canvas-texture-cache` fixture suites deleted (behavior must not survive); 26 `its` dropped in total, all dies-with-surface; 91 `its` survive across the 12 re-hosted files with DashboardManager/WorkspaceSurfaceManager/webxr-simulator fixtures rebuilt on substrate-neutral `PanelLike` shapes driving the real src classes, the free-3d orientation invariants re-hosted on the live `SpatialPanel` + `WorldSceneComposer` body-frame path (per-panel yaw/facing assertion honestly dead with the substrate — disclosed), the tier1/tier2/tier3/tier4 e2e journeys re-pinned on SpatialPanel/WorkspaceSurfaceManager/grab-rail production surfaces (real `MIN/MAX_VIEW_DISTANCE` clamp path), and the census's PROTECT anti-rent pin in `workspace-surface-manager.test.ts` intact. Registry unchanged at 18 entries. Reviewer verdict PASS WITH CONDITIONS (disclosed coverage reduction + 2 NITs; no blocking defects); gates green (`typecheck` clean, lint 0 errors/259 warnings, registry 9/9, re-hosted files 51/51 + 6/6 wasm lane, e2e 11/11 in-lane spot runs, docs:check PASSED; wasm-lane 19 failures pre-existing kernel-artifact class on the Windows host, reproduced identical at base, none of the 9 failing files touch the diff).
- **FM5:** System-1 Forma/representation proposals plus object-centric perception cues through the [System-1/System-2 ONNX architecture](architecture/MONETA_SYSTEM1_SYSTEM2_ONNX_ARCHITECTURE.md); proposal outputs target the qualified FM3 representation/perceptual grammar rather than raw renderer parameters; voice/gaze remain governed modality inputs through NIL, named gestures remain experimental, and `FM5-PERCEPTION` **RESOLVED: ARCHIVE** (3 October 2026) — the heuristic multimodal-perception prototype was audited and archived by CMS-6 (decision PR #893, execution PR #896 at `main@51395b09`: engine + gesture recognizer deleted, `vr/perception` barrel re-pointed to `PerceptualFitnessSampler`-only); a future FM5 perception surface must be governed (cue contracts C1–C5, audit record `docs/review-plans/CMS6_MULTIMODAL_PERCEPTION_AUDIT_2026-10-02.md`), not an inheritance of heuristic scores.
- **FM6:** human-refined Forma knowledge: structured embodiment critique + human meaning judgments + validated discovery outcomes become scoped, provenance-bearing knowledge and proposal priors; outcome lineage, recurrence/resonance and mature collaboration remain distinct from scientific validation.
- **FM7:** bounded representation/metaphor search plus explicit System-2 analogical synthesis, true search/evolutionary Road Not Taken lineage and inspectable trade-offs; a world model, larger generative model or autonomous representation agent remains evidence-triggered laboratory work unless simpler rules/cases/search are shown insufficient.
- **FM8:** integrated product coherence plus `FM8-CLEAN`, a final removal/archive pass for any executable prototype or compatibility surface without a declared product owner and evidence basis.
- **Post-FM:** Gaussian splatting, biosignal salience, federated learning, richer literary metaphors, larger generative representation models and autonomous research/representation agents are evidence-triggered research candidates, not default roadmap commitments.


### Claude parallel maintenance sprints — opportunistic substrate improvement

**Status:** READY / PARALLEL_SAFE when active forward-lane ownership does not overlap.
**Survey base:** `main@a55edaf1` (1 October 2026).
**Purpose:** turn non-forward codebase debt into bounded work for Claude/sub-agents without manufacturing a second critical path. These are optional ribs under the roadmap execution model: the forward dependency spine always wins resource or ownership conflicts.

Each sprint must begin from fresh `main`, declare its exact base SHA and touched paths, and stop if a fresh reachability audit discovers an active forward-lane caller or authority dependency. Production/evidence authority semantics may not be changed merely to make cleanup easier. Each implementation sprint requires focused tests, typecheck/architecture checks relevant to the touched surface, exact-head CI and a bounded adversarial post-review. Prefer one PR per sprint.

| Sprint | Parallelism / dependency | Claude task | Exit criterion |
|---|---|---|---|
| **CMS-1 — collaboration contract extraction** | `PARALLEL_SAFE`; precedes CMS-4 | Remove production `PeerAvatarManager`'s type dependency on superseded `CollaborativeStateSync`. Define/reuse the smallest neutral peer-pose/state contract required by the production avatar/collaboration path; migrate callers/tests without reviving the legacy synchronizer. | No production source imports `CollaborativeStateSync`; production collaboration behavior and focused tests remain green; no second collaboration authority is introduced. **LANDED at base `58c6a91e` (2 October 2026), merged as #888:** `PeerAvatarManager` now owns and exports a neutral `PeerAvatarState` input contract (avatar renderer only — no peer state authority moved; the superseded synchronizer is not imported), `updatePeerTransforms` takes that contract, and every other production/call-site file is untouched. Fast-lane falsifiers in `tests/cms1-collaboration-contract.test.ts` pin: no `src/**` file outside the synchronizer itself contains the `CollaborativeStateSync` string, `PeerAvatarManager` exports the contract without referencing the synchronizer, the network barrel does not re-export it, the production coordination literal shape still drives avatar transforms, and the synchronizer's structurally richer peer-state shape remains assignable to the contract. CMS-4's deletion of the retained synchronizer/annotation surfaces remains open. |
| **CMS-2 — false FlatBuffers retirement** | `PARALLEL_SAFE`, `SPAWNABLE` | Audit tests/E2E fixtures using `FlatBuffersSerializer`; preserve only behavior that belongs to a canonical supported serialization boundary, migrate valuable coverage to Arrow/MessagePack/current package formats, then delete the misleading hand-rolled serializer and its registry entry if reachability remains non-production. | No executable/test dependency on the false FlatBuffers surface; useful boundary/safety assertions survive against a truthful supported format; registry/docs are reconciled. **LANDED at base `67a60a22` (2 October 2026), merged as #890:** the audit confirmed the module was never FlatBuffers interoperability — `src/data/serializers/FlatBuffersSerializer.ts` hand-rolled a bespoke little-endian `NEM\x01` row buffer under the standard's name, was re-exported by no production module (the serializers barrel never exported it), and was reachable only from tests, so it was deleted in full. The valuable length-field-bounds property (malformed untrusted input fails deliberately and descriptively rather than via an opaque or silent success) is repinned in `tests/serializers.test.ts` ("Canonical serializer robustness") against the canonical surfaces: truncated/garbage Arrow IPC throws descriptively (observed `Error('Expected to read N metadata bytes, but only read M')` from apache-arrow), truncated/garbage MessagePack throws (observed `RangeError('Insufficient data')` / `DecodeError('Unrecognized type byte: 0xc1')`, and `@msgpack/msgpack` additionally refuses `__proto__` map keys outright with `DecodeError`), an under-header Arrow buffer degrades to an honest empty Dataset — never bogus rows — pinned as-observed, and `constructor`/`prototype` row keys are stripped at the `Dataset.sanitizeRow` boundary on both canonical parse paths. The four e2e spec files were migrated tier-by-tier onto canonical parsers without weakening surviving assertions: tier1/tier2 F12 bounds cases now pin Arrow/MessagePack truncation, garbage and under-header behaviour; tier3 suite 3.4 keeps its malicious-JSON half and replaces the corrupted-serializer half with a corrupted MessagePack payload that fails deliberately with no unhandled rejection; tier4 scenario 2's state-transmission step round-trips through MessagePack (which, unlike the retired format, preserves the dataset name); the unused `generateCorruptedFlatBuffers` fixture was deleted from `tests/e2e/harness/dataset_fixtures.ts`. Registry/docs reconciliation: the `flatbuffers-prototype` development-only capability entry (source list + barrel forbid-list) was removed from `governance/production-capabilities.json`; `MessagePackSerializer.ts`'s stale comment now names only truthfully-supported formats; the live `docs/examples/INDUSTRIAL_IOT.md` claim was reworded to name the shipped formats; archive/audit docs (`docs/archive/*`, the dated moneta capability plan, dated reviews) were left untouched as historic records. Exit falsifiers in `tests/cms2-serializer-truthfulness.test.ts` (fast lane) pin that no test-file or src/ filename-or-content carries a case-insensitive retired-surface reference, `src/data/serializers/` holds only Arrow/MessagePack plus the barrel, the barrel exports exactly the two canonical serializer pairs, and the governance capability registry carries no entry for the retired surface. CMS-7 census untouched by this sprint. |
| **CMS-3 — dev debug bundling boundary** | `PARALLEL_SAFE`, `SPAWNABLE`; quick-fix candidate | Prove whether the static `src/main.ts` import of development-only `RemoteDebugStreamer` enters production bundles. If it does, replace it with an explicit DEV-only loading boundary and test that production startup/bundling cannot initialize or include the streamer accidentally. If bundler evidence disproves the concern, record STOP rather than churn code. | Reproducible bundle/reachability evidence; either bounded fix with tests or documented STOP. `RemoteDebugStreamer` remains development-only. **Landed — bounded fix path (2026-10-02, base `main@832e8700`), merged as #889:** the probe confirmed the concern and located its mechanism: on the untouched base a local `vite build` produced a production main-bundle containing the streamer's `nemosyne-vr-debug-hud` banner id and its init-time `"Live VR console telemetry initialized"` string — the static `src/main.ts` import survived tree-shaking because the module exports an eagerly-constructed singleton instance whose class methods cannot be statically proven dead (bundler behaviour, not a call-site issue: the call site was already DEV-guarded). Fix: `src/main.ts` now loads the streamer via a dynamic `import()` nested inside the standing `import.meta.env.DEV` guard, which the bundler folds and eliminates wholesale in a production build — post-fix `vite build` + `dist/` marker grep shows zero streamer strings in any production chunk; and `RemoteDebugStreamer.init()` carries its own DEV guard at its head (defence in depth: no future import site can accidentally initialize it in production). Falsifiers `tests/cms3-debug-bundling.test.ts` pin the boundary (no static import form in main.ts, guard-precedes-dynamic-import program order, a full `src/**` identifier sweep allowlisting only the streamer module, main.ts and the observability barrel's comment, streamer refuses to initialize when DEV is false, DEV tooling itself survives unimpaired); the module stays development-only, the existing dev-side tests are unchanged and green. |
| **CMS-4 — superseded collaboration deletion** | `BLOCKED_BY: CMS-1`; otherwise parallel with CMS-2/3 | Re-audit `CollaborativeStateSync` and `src/network/SharedAnnotationManager.ts`; migrate/delete legacy-only tests, then remove implementations and production-capability entries when no production caller remains. Preserve `NetworkManager`/`CollaborationCoordinator` and `src/vr/interactions/SharedAnnotationManager.ts` as canonical authorities. | Superseded implementations absent from executable tree and registry; no lost production behavior; collaboration/security tests remain green. **LANDED at base `9729d584` (3 October 2026), merged as #895:** both superseded surfaces are deleted in full — `src/network/CollaborativeStateSync.ts` (120 lines, zero src importers) and the network-barrel legacy `src/network/SharedAnnotationManager.ts` (64 lines, zero src value importers; the canonical `src/vr/interactions/SharedAnnotationManager.ts` remains untouched as the live authority consumed by `CollaborationCoordinator`/`AsymmetricDesktopCompanion`) — together with the two `legacy-*` registry entries (`legacy-collaborative-state-sync`, `legacy-network-shared-annotations`; 21 → 19 entries) and their retirable tests (`tests/collaborative-sync.test.ts` 2 its; the legacy describe block in `tests/zero-copy-network-sync.test.ts`; 1 legacy annotation its in `tests/peer-avatars-annotations.test.ts`; net −7 its). The census §S1 hard prerequisite was satisfied explicitly: all 5 class-instantiating falsifiers were re-homed or confirmed already pinned on the production `NetworkManager` path before deletion — numeric peer-ID derivation re-homed as new falsifiers pinning `NetworkManager`'s `sha256Uint31` broadcast mechanism (determinism + injectivity), fail-closed-no-untrusted-fallback re-homed as new falsifiers pinning that unadmitted channels get no listener/state and revoked roles drop traffic with no payload-identity fallback (both in `tests/rf057-pose-identity.test.ts`, exercising the real sender/wiring code, not reimplemented mechanisms); channel-bound per-peer key separation, out-of-order drop without overwriting newer state, and numeric-ID-forge anti-poisoning were confirmed already pinned by existing production-path rf057 falsifiers. The 10 serializer-direct `its` in `zero-copy-network-sync` survive unchanged (`BinaryPoseSerializer` is production-reachable at `NetworkManager.ts:447`). The wasm-lane `production-runtime-wiring` surface its migrated onto the production `NetworkManager.broadcastCameraPose` API. `tests/cms1-collaboration-contract.test.ts`'s no-import falsifier was reshaped into an honest surface-absence tombstone (still scans src/; the other 4 its intact). Registry floor updated 20 → 19 with the reason recorded. Reviewer verdict PASS; all gates green (typecheck, lint 260 warnings under the 262 baseline, docs:check; the 3 wasm-lane failures in `production-runtime-wiring` are the documented pre-existing host-class failures, reproduced byte-identical at the base). |
| **CMS-5 — palette/CVD value extraction** | `PARALLEL_SAFE` research/review first; implementation only after decision | Compare development-only `ColorPaletteEngine` with canonical encoding/representation paths. Identify CVD/contrast algorithms and tests that materially improve accessibility semantics. Propose bounded absorption into the canonical authority or deletion; do not create another colour authority. | Written KEEP/ABSORB/DELETE decision with reachability and test evidence. If ABSORB/DELETE is mechanical and non-colliding, a follow-up PR may execute it. **DECIDED at base `e936d5fd` (2 October 2026), merged as #892: ABSORB-then-DELETE (bounded)** — decision record `docs/review-plans/CMS5_PALETTE_CVD_DECISION_2026-10-02.md`. Findings: the engine is reachable from nothing (only its own test imports it; zero call sites for all four public statics; `colord` exists solely for it), and **no production code computes contrast anywhere** — the "high contrast" theme is an accessibility claim with zero executable evidence. ABSORB exactly one capability: a dependency-free WCAG relative-luminance/contrast helper into the canonical `src/vr/ui-system/tokens.ts` with contrast-pair boundary assertions (4.5:1/3:1 + real token pairs incl. `HIGH_CONTRAST_THEME`) in `tests/ui-system/token-convergence.test.ts`. DELETE: the engine, its test, the `colord` dependency, and the `color-palette-engine` registry entry. The CVD simulation is deliberately unreplaced — it applies Viénot matrices to gamma-encoded sRGB (requires linearised), uses BT.601 luma for achromatopsia while its own `isReadable` uses WCAG coefficients, and its tests pin no algorithm (any non-identity matrix passes); canonical CVD semantics are mitigation-by-construction (Okabe-Ito swap, hue-family remap), both already pinned. Executing follow-up PR may implement after this decision lands. **EXECUTED at base `f24257b1` (3 October 2026), merged as #894:** the absorption plan was implemented as decided — dependency-free WCAG 2.x relative-luminance/contrast helpers now live in `src/vr/ui-system/tokens.ts` (numeric `0xrrggbb` and `#rrggbb` string forms; measurement only, no palette generation, no library); `tests/ui-system/token-convergence.test.ts` gained a contrast-evidence block pinning the math anchors (black/white = 21, greys landing at ~4.5:1 and ~3.0:1, symmetric input) and AA clearances on the rendered pairs: `text.primary`/`text.secondary` ≥ 4.5:1 on `surface.base`/`surface.raised`, every `HIGH_CONTRAST_THEME` text ≥ 4.5:1 and accent/danger ≥ 3:1 on its own background, and interaction/epistemic accents ≥ 3:1 on `surface.base`. Deleted: `src/data/ColorPaletteEngine.ts`, `tests/color-palette-colord.test.ts`, the now-unused `colord` dependency, and the `color-palette-engine` registry entry (zero non-test reachability — verified pre-deletion). The colour authority remains `tokens.ts`/`Encodings.ts`/`Accessibility.ts`. |
| **CMS-6 — multimodal perception contract audit** | `PARALLEL_SAFE` research/review; do not promote prototype | Audit `MultimodalPerceptionEngine` heuristic confidence/action semantics against NIL and the System-1/System-2 architecture. Extract candidate typed cue contracts and falsifiers; do not describe heuristic scores as calibrated confidence and do not make the prototype production authority. | Bounded REVISE/ARCHIVE proposal with explicit cue contract, authority boundary and evidence needed before implementation. **DECIDED at base `e936d5fd` (2 October 2026), merged as #893: ARCHIVE** — audit record `docs/review-plans/CMS6_MULTIMODAL_PERCEPTION_AUDIT_2026-10-02.md`. The stop-grade check resolved clean: the prototype is production-unreachable (zero src importers; a registry test exists specifically to keep it out of architectural invariants) and its scores feed no decision path. Audit findings (file:line-cited): raw caller floats copied through as `confidence` unclamped; a `+0.1` fusion bonus that rewards modality disagreement; hand-set thresholds 0.4/0.5/0.6 with no controls while the only measured field (dwell duration) is stored and never read; fallback/ABSTAIN reachable only via gaze-only input with raw gaze confidence in (0.4, 0.5) while the empty state fabricates a mid-confidence snapshot; `personalizationState: 'calibrated'` is a decorative settable label that changes no behavior — the sharpest vocabulary violation against the MA2 `NOT_CALIBRATABLE_FOR_DECISION` rule; `resolvedAction` string synthesis (`filter_outliers:cluster-7`) is a hidden second command vocabulary, not NIL-verb-compatible, bypassing the resolver → `InteractionIntent` → NIL boundary the architecture mandates (pre-flagged by that doc on 2026-09-29, §13 FM5-S1B "replace … or archive it" — this audit confirms it). `GeometricGestureRecognizer`: `_resample` mutates the caller's array (purity violation); `minConfidence` misnames a path-distance score. Five candidate typed cue contracts (C1–C5) extracted as documentation for a future FM5-S1B surface only — gaze-target, trajectory-template-match, voice-provider (`providerScore`), versioned arbitration (no additive bonus; negative control: inconsistent noise must not fuse), and the retainable provenance/freeze-metadata pattern **minus the word "calibrated"**. Protection gap noted for the deleting cleanup PR: the dev-only entry lacks a `forbiddenPublicExports` rule for the `vr/perception` barrel. Test reconciliation: the 4-test engine fixture and the gesture block of `sprint-27-4` retire with the surfaces (CMS-2 pattern); nothing needs new tests. **EXECUTED at base `7129c3f2` (3 October 2026), merged as #896:** the ARCHIVE package was implemented as decided — `src/vr/perception/MultimodalPerceptionEnvelope.ts` (the engine, 168 lines) and `src/vr/perception/GeometricGestureRecognizer.ts` (192 lines) are deleted (fresh pre-deletion greps re-confirmed zero src importers or dynamic imports on this base); the `vr/perception` barrel is re-pointed at exactly `PerceptualFitnessSampler`-only content (sampler + its two pose/target types) per the audit's §8 package, and the barrel's prior re-exports of `GestureMapping` symbols were retired with it after fresh greps proved zero consumers imported them through any `vr/perception` path; `tests/multimodal-perception-envelope.test.ts` (4 its) deleted; the single `GeometricGestureRecognizer` describe block removed from `tests/sprint-27-4-resilience-and-gestures.test.ts` with the two unrelated resilience its kept intact (net −5 its, no new tests); the `multimodal-perception-engine` registry entry deleted (19 → 18, fast-lane floor updated with a comment citing CMS-6 and the CMS-4 precedent). `PerceptualFitnessSampler` byte-untouched and confirmed production-reachable (four `src/app/*EvidenceDiagnostics.ts` importers) — the governed surface was not swept in. The audit §7 barrel forbid-list item is superseded by the deletion: re-exporting the archived symbols from any barrel is now a hard compile error, a strictly stronger guard than a JSON forbid rule, and the entry removal makes the flagged protection gap moot. Reviewer verdict PASS; all gates green (typecheck, lint at baseline, registry 9/9, perceptual-fitness 20/20, F-7 controls 18/18, hygiene 5/5, docs:check). |
| **CMS-7 — legacy-test rent census** | `SPAWNABLE`; may run alongside all above | Inventory tests whose primary purpose is preserving development-only, compatibility-only or explicitly superseded code. Classify each as `PROTECT`, `MIGRATE`, `DELETE_WITH_SURFACE`, or `RESEARCH_FIXTURE`; measure approximate CI/test volume but do not delete tests merely for speed. | Machine-readable or documented census that directly feeds CMS-2/4 and later cleanup packages; every deletion recommendation names the replacement invariant or explains why none remains. **LANDED at base `87502f7d` (2 October 2026), merged as #891:** census delivered read-only as `docs/review-plans/CMS7_LEGACY_TEST_RENT_CENSUS_2026-10-02.md` + machine-readable `cms7_legacy_test_rent_census.json` (19 surfaces; 634 test files/~3,693 tests mapped per lane). Feed results: CMS-4 owns S1+S2 but gains a hard prerequisite — the 5 class-instantiating sequence/peer/channel-binding falsifiers in `tests/zero-copy-network-sync.test.ts` must be re-homed (or confirmed present on the production `NetworkManager` path) before `CollaborativeStateSync.ts` dies (the 10 serializer-direct `its`, incl. the `acceptsSequence` gating `NetworkManager` itself calls, already have named homes); the two `legacy-*` capability entries die with the surface; FM4-UI-CLEAN owns the `MovablePanel` substrate (S3: 9 vitest files + 5 e2e specs/~82 `its`, per-file die-vs-rehost split, `CanvasTextureCacheManager` dies with it — it survives only through the class); ERA-AG4/AG1 owns the alias families (S13 — `fnv1aHex` still has 6+ live callers so its guards are live; dead `src/vr/palette.ts` has no test rent), the test-only-reachable flags (S14), and the stale `uv0-inventory.ts` entry; deletable pure rent is tiny (~4 files/~24 `its` + ~25 partial `its`) — the census's value is the named surfaces, not counts. Truthful ledger (§6) records 7 reachability gaps incl. canonical Arrow/MessagePack serializers having zero src value callers (production persistence uses `NemosynePackage`/fflate) and the unmounted gesture-learning HTTP service — flagged for adjudication, not classified as rent. CMS-2 confirmation row: zero residual FlatBuffers rent at this base. |

**Explicitly not a sprint:** the dormant Rust scene command buffer (`CommandApplier` + `wasm/src/command_buffer.rs`) remains evidence-triggered. Do not spend implementation capacity on it until measured headset/runtime evidence justifies `CAP_SCENE_RUST` / `CAP_COMMAND_BUFFER`.

**Claude scheduling rule:** Claude may run CMS-1, CMS-2, CMS-3 and CMS-7 concurrently, including via sub-agents, provided their path declarations remain disjoint. CMS-4 starts only after CMS-1 lands. CMS-5 and CMS-6 are review/research ribs and may run concurrently without blocking implementation. If any sprint collides with the active forward tranche, park that sprint immediately rather than negotiating ownership or slowing the spine.

## Engineering Renewal & Architecture (ERA) — agent-addressable queue

**Status:** READY as optional parallel ribs. **Queue base:** `main@78e04d59` (1 October 2026). **Priority rule:** the active forward dependency spine and already-assigned CMS paths always win collisions. ERA work discovers and removes engineering drag; it does not invent product scope or silently rewrite scientific/evidence authority.

### Dispatch protocol

An agent may be told simply: **“Find the next READY task assigned to you in `docs/ROADMAP.md`, claim it, and proceed.”** It must select the lowest-numbered READY task for its agent/model whose dependencies are satisfied and whose paths do not overlap an active lease/forward tranche. Before mutation it records fresh base SHA, allowed paths, collision/forbidden paths and exit evidence in its branch/PR. Review-only tasks must not modify production code. Findings are proposals until an implementation task explicitly accepts them.

| ID | State | Assigned agent / model | Mode | Task and allowed scope | Forbidden / dependency | Required deliverable and exit |
|---|---|---|---|---|---|---|
| **ERA-AG1** | **READY** | **Antigravity — Gemini 3.1 Pro High** | architecture survey / adversarial | Reconstruct actual dependency and authority topology across `src/app`, `atlas`, `data`, `moneta`, `investigation`, `session`, `persistence`, `network`, `vr`, `wasm`, governance and architecture tests/docs. Identify reversed dependencies, duplicate authorities, leaky compatibility seams and architecture-policy blind spots. | Review-only. No production mutation. Exclude files under an active forward/CMS implementation lease except read-only analysis. | `docs/review-plans/ERA_AG1_AUTHORITY_TOPOLOGY_<date>.md` with evidence-backed findings ranked by failure mode, affected paths, proposed invariant and suggested implementation slice. STOP is valid where architecture is sound. |
| **ERA-AG2** | **READY** | **Antigravity — Gemini 3.1 Pro High** | deep design review | Review architectural gravity wells, initially `World.ts`, `AtlasCore.ts`, `InvestigationReplayRunner.ts`, `MonetaHypothesisEngine.ts`, `GestureLearningGovernance.ts`, and large governance services. Distinguish legitimate cohesion from responsibility leakage; propose extraction seams only where they reduce coupling or improve falsifiability/testability. | Review-only. No “split because file is large” refactors. Do not alter authority boundaries. May consume ERA-AG1 findings but is not blocked by them. | `docs/review-plans/ERA_AG2_COMPLEXITY_TOPOLOGY_<date>.md`; for each candidate: KEEP / EXTRACT / REDESIGN, coupling evidence, migration risk, tests/invariants needed and bounded follow-up task. |
| **ERA-AG3** | **READY** | **Antigravity — Gemini 3.8 Flash High** | engineering-practice audit | Survey error propagation, fail-open/fail-closed behavior, async/resource lifecycle, Three/WebXR disposal, API/type contracts, browser-vs-Node boundaries, observability and dependency hygiene. Prefer reproducible defects and invariant gaps over style opinions. | Review first. Only trivial isolated fixes may be proposed, not committed, until converted to ERA-CX task. Avoid active CMS paths. | `docs/review-plans/ERA_AG3_ENGINEERING_PRACTICES_<date>.md` plus a table of `DEFECT`, `RISK`, `NO_CHANGE`; each actionable item includes reproduction/failure mode and smallest fix. |
| **ERA-AG4** | **READY** | **Antigravity — Gemini 3.8 Flash Medium** | archaeology / cleanup census | Inventory deprecated aliases, compatibility fallbacks, stale barrels/exports, dead adapters and obsolete vocabulary outside CMS-owned surfaces. Use import/reachability evidence; distinguish historical replay compatibility from removable code. | Do not delete anything. Exclude CMS-1..7 named surfaces to prevent duplicate ownership. | `docs/review-plans/ERA_AG4_COMPATIBILITY_CENSUS_<date>.md` with RETAIN / MIGRATE / DELETE / NEEDS-EVIDENCE classification and exact references. |
| **ERA-AG5** | **READY** | **Antigravity — Gemini 3.8 Flash High** | test architecture review | Review test portfolio for duplicated implementation tests, missing invariant/property/metamorphic tests, false confidence, over-mocking, stale E2E contracts and expensive tests protecting no production capability. Focus beyond CMS-7's legacy-only census. | Review-only; no test deletion. Do not weaken scientific/adversarial gates to optimize CI. | `docs/review-plans/ERA_AG5_TEST_ARCHITECTURE_<date>.md` with gaps and consolidation candidates mapped to production invariants. |
| **ERA-ASTRA1** | **DELIVERED — architecture changes proposed / RFC decision pending** | **GPT-6 Astra — High/XHigh** | architectural adjudication | Architecture 2027 review delivered against the converged Mac specimen and current source topology. The review retains the Full-Moneta destination but requires authority/identity tightening before L2-FORMA-0 freezes durable contracts. | Review/design only; no production capability is promoted by the review. AG1/AG2 artifacts were not available and remain independent follow-up inputs, not implicitly complete. | [`docs/architecture/ARCHITECTURE_2027_REVIEW.md`](architecture/ARCHITECTURE_2027_REVIEW.md). Immediate handoff: **A27-0** authority/version decision, then revised L0/L1/L2 tranches. |
| **ERA-CX1** | **BLOCKED_BY: accepted ERA findings** | **Codex — normal/default reasoning** | precise implementation | Take the smallest accepted mechanical remediation from ERA-AG3/AG4/AG5 that has explicit paths, invariant and tests. One finding or tightly coupled cluster per PR. | Never self-authorize architectural redesign. No forward-lane/CMS collision. | Focused implementation + regression test + typecheck/relevant architecture checks + exact-head CI + PR referencing source finding. |
| **ERA-CX2** | **BLOCKED_BY: accepted ERA-AG1/AG2/Astra slice** | **Codex — high reasoning** | bounded structural refactor | Implement an approved extraction/boundary repair whose desired architecture and migration sequence are already specified. | No speculative redesign, authority migration or broad formatting churn. | Behavior-preserving refactor with characterization tests before change, boundary tests after change and exact-head adversarial review. |
| **ERA-AG6** | **BLOCKED_BY: ERA-CX implementation PR** | **Antigravity — Gemini 3.8 Flash High** | independent adversarial review | Attack an ERA implementation PR for lost behavior, hidden authority changes, incomplete migration, stale docs/registry, resource regressions and test tautologies. | Reviewer must not be the implementation agent/sub-agent. | PASS or concrete fix-forward findings tied to exact head. |

### Agent scheduling

- **Antigravity:** AG1, AG2, AG3, AG4 and AG5 are mutually parallel-safe because they are review-only and produce separate artifacts. Use **Gemini 3.1 Pro High** for architecture/dependency synthesis; **Gemini 3.8 Flash High** for broad engineering/test audits; **Flash Medium** for mechanical archaeology. Sub-agents are allowed when they preserve those output boundaries.
- **GPT-6 Astra:** ERA-ASTRA1 is delivered in `docs/architecture/ARCHITECTURE_2027_REVIEW.md`. Reserve Astra for later explicit architecture/RFC adjudication only when lower-cost review cannot settle an expensive-to-reverse boundary. AG1/AG2 remain independent review inputs when produced.
- **Codex:** consume accepted findings rather than conduct open-ended archaeology. Use default reasoning for mechanical fixes and high reasoning for approved cross-module structural refactors. Remaining quota should preferentially turn already-proven debt into merged code.
- **Claude:** retains CMS ownership from the preceding section. ERA agents may read CMS findings but must not edit CMS-owned paths while those sprints are active.
- **Integration:** discoveries do not become roadmap obligations merely because an agent reports them. Material architectural changes require the normal RFC/ADR/evidence process; small demonstrated defects can enter ERA-CX directly after review.

### RFL support stream — OpenCode / Muse Spark

**Status:** DURABLE support stream. **Base:** `main@c55165bf` (3 October 2026; RFL ledger re-verified at this head: seven `candidate` entries, RFL-0001..RFL-0007). RFL generates falsification experiments; it does not implement product features or repair production code. Open candidates at this base: RFL-0001 (cycle-1 ingest framing, recorded by #868), RFL-0002 (cycle-6 shutdown drain, recorded by #883), RFL-0003 (cycle-7 JWKS refresh coalescing, recorded by #901), RFL-0004 (cycle-8 live rows shape fail-open, recorded by #909), RFL-0005 (cycle-9 polling stale-generation clobber, recorded by #913), RFL-0006 (cycle-10 persistence remove resurrection, recorded by #919), RFL-0007 (cycle-11 EventBus dispatch skip on in-dispatch unsubscribe, recorded by #921) — all remain `candidate`; the independent fix-forward for RFL-0003 merged as #904 and was independently verified post-merge by the maintenance lane (4/4 on the unskipped reproducer plus the new falsifiers, trail on #904), pending RFL's own rerun and reproducer conversion. Assigned fix-forwards for RFL-0004 (per-row validation, #917) and RFL-0005 (polling generation fence, #918) are merged with regression evidence and RFL files untouched; both findings stay `candidate` until RFL reruns and converts. The RFL-0007 fix-forward (#924, snapshot dispatch in `WorldEventBus._emitCore` so an in-dispatch unsubscribe cannot skip a registered handler) is merged with committed falsifiers while leaving the finding `candidate` and its reproducer skipped for RFL's own rerun. The Shadow ledger `governance/shadow/findings.jsonl` holds one `candidate`: SHADOW-0001 (tranche-identifier drift after #923, NORMAL/HIGH), reported to the owning lane on #923 and awaiting independent validation.

- An empty `governance/rfl/findings.jsonl` means begin discovery, never "nothing to do."
- Continuously survey unclaimed surfaces, choose high-information invariants, construct the cheapest useful falsifier, run it, record the evidence, and choose another target. Prefer real production-path questions involving lifecycle/resource ownership, determinism/replay, serialization, malformed inputs, state machines, persistence, WebXR/browser boundaries, representation stability, collaboration, ingestion, and other under-tested seams.
- Refresh active leases, open PRs, and roadmap state before every target. Do not compete with Claude: the TEC1/RFC 0009 evidence/platform spine is Claude's; never mutate its claimed paths.
- RFL may create tests, fixtures, simulations, property/metamorphic tests, benchmarks, harnesses, and narrowly isolated developer tooling. Do not repair production code.
- A reproducible failure becomes a candidate `RFL-*` finding with invariant, exact reproduction command, affected paths, base/head SHAs, observed evidence, and suggested owner. RFL cannot accept or close its own findings; accepted findings intersecting Claude's work become falsifiers for Claude's tranche, and RFL independently reruns the reproducer after fixes.
- A passing experiment means only that this falsifier did not break the invariant; preserve useful coverage where appropriate and continue.
- `STOP_NO_NOVEL_TARGET` is permitted only after a genuine broad survey demonstrates that no worthwhile non-colliding experiment remains — never a busy forward lane, an empty ledger, or a missing roadmap ticket. Do not manufacture low-information tests merely to remain active.

## Historical status snapshot - 16 September 2026

**Current integration base for this planning update:** `main@8adb2c7899d749be5c2676551ed0f5b8a757168e` (#754). Stream A remains closed. Stream B's first selected structural family, source-authoritative Relationship Graph V1, remains `VERIFIED COMPLETE / STOP`. Stream C's bounded C1-C4 software path remains landed, with physical XR fitness still an empirical qualification boundary. PT0-PT8 remain landed at their bounded exits. P1-UXR remains the active pre-PT9 product-development programme: UXR0's bounded software contract and UXR1's canonical UI migration plus purpose/comprehension treatment-v3 fix-forward are landed. #745 remains open because software, browser and simulator evidence cannot establish the required physical human comprehension outcome. The forward engineering frontier is again the UXR2 resource lifecycle governor at its UXR3 bounded-semantic-working-set seam, followed by UXR4/UXR5 evidence, while the #745 Quest retest runs when physical-human evidence is available. PT9 Moneta learning evidence, PT10 private-preview learning, and post-PT9 compositional/full-Moneta work remain downstream. Experimental Full-Moneta work may be preserved off the integration path but may not jump those prerequisites.

The previous A/B/C convergence wave, Stream M distribution wave, Density Truth R2C, source-partition Cluster Regions R2D, Progressive Disclosure Stream A, the first selected Stream B structural family, and the bounded C1-C4 visible-product wave have reached their stated implementation exits. In particular:

- A1 semantic drill-down contract/falsifiers is `VERIFIED COMPLETE` after establishing SemanticDrillDown.ts and drill_down.rs WASM validation boundary.
- A2 resident bounded semantic membership/query capability is `VERIFIED COMPLETE` through the canonical Worker/Rust authority.
- A3 semantic selection lineage, bounded observation reveal, and explicit return-to-structure are `VERIFIED COMPLETE` for the generic production path.
- A4 exact datum/provenance inspection is `VERIFIED COMPLETE` after #605, using a second bounded authority query rather than a whole-dataset UI cache.
- A5 cross-family product evidence and the independent STOP review establish the finite P1-R5 closure for Aggregate, Distribution, Density and source-partition Cluster, with #606 merged and all exact-head gates green.
- Stream B Relationship Graph V1 is `VERIFIED COMPLETE / STOP`: B1 source authority contract merged via #607; B2 resident Rust/WASM bounded topology payload merged via #610; B3 production cutover + thin graph adapter merged via #611; and B4 product/scale/perceptual evidence + independent STOP review merged via #612 at `main@232d952`.
- C1 on #613 is `VERIFIED COMPLETE`: TechnoCore, Evidence Vault, Farcaster portals and a bounded Memory Palace projection are investigator-functional without creating a second analytical/epistemic authority. Its post-review is `review/P1_UV_C1_FUNCTIONAL_WORLD_OBJECTS_POST_REVIEW_2026-09-01.md`.
- C2 on #614 landed investigation-state legibility in the existing Status Strip, including the post-review fix for stale visible origin after undo and historical graph-root compatibility.
- C3 on #615 landed one canonical `Inspect | Compare | Challenge | Record | Navigate | More` selected-object task vocabulary across desktop and XR presentation, with production-browser evidence and no second selection/analytical authority.
- C4 on #616 landed the four canonical visible investigator journeys, including governed investigator-authored reasoning projected through the existing Memory Palace path. Browser/IWER evidence remains non-physical evidence; C4 does not close P1-U9.
- QV0/QV1 validation manifest/launcher and the governed evidence sink are landed; #617 replaced error-prone governed manual Quest firmware/model attribution with fail-closed ADB machine capture; QV4 automatic adjudication and evidence chain of custody landed in #668 and was fidelity-hardened in #669. Physical QV5/QV7 and other explicitly device/human-dependent claims remain open and may not be inferred from browser/simulator evidence.
- #619 completed PT0/E0: removed unused `unpkg` Three.js runtime trust, tightened CSP, refreshed feature truth, made architecture policy an every-PR check, and installed one-way TypeScript hygiene ratchets.
- #621 and #622 completed PT1's bounded CI-feedback work while preserving exact-head evidence. The concrete rolling clean exact-head objective recorded by the historical execution checklist in issue #620 is p50 <= 270 seconds and p95 <= 360 seconds; it remains an operational SLO to monitor rather than an indefinitely open implementation tranche.
- `TsatsuAmable/nemosyne-data#3` completed PT2 at `nemosyne-data@8e6b2dfc74ea1c60283790668cc93030c61423f8`: catalogue schema 2.2 / corpus v0.4.0, five known-answer families, ten direct metamorphic variants and one explicitly production-pending NIL fixture are governed and independently validated outside Nemosyne production code.
- PT3-PT5 reached their bounded reviewed exits; PT6's governed gesture-learning collection/snapshot path landed through #661-#664, PT7's runtime/model registry and reproducible-job path landed in #665, and PT8's repository-runnable governed gesture-model update loop landed in #667. These are software/governance exits, not deployed-service, live-cohort, physical-device or human model-quality evidence.
- UXR0 baseline observability, replacement qualification and selected hot-path work landed through #701-#705; #706-#708 added the XR Experimental Engine, evidence calibration and governed adapters. These establish bounded software/simulator infrastructure, not completed 30/60-minute physical profiles or human evidence.
- #711 preserved the one-forward-PR execution rule while making adversarial review recursive: challenge consequential claims before implementation, turn material disagreement into falsifiers, and attack the resulting evidence again before promotion.
- #712 established the Moneta evidence-admissibility protocol and #713 added the first known-structure control campaign. #747 enforced evidence and grouped-aggregate authority boundaries; #748 accepted RFC 0006; #749 implemented signed certificate verification, explicit scientific `ABSTAIN`, and fail-closed `p >= n` admission. #753 then falsified use of the existing non-constant-column `effectiveDimensions` heuristic as intrinsic/candidate-specific dimensionality authority and added stronger research controls without changing production semantics. These are landed scientific prerequisites for PT9, not PT9 learning-pipeline completion.
- UXR1's canonical UIKit and reachability software migration landed through #716, #720-#728, #734-#744 and #746, and #754 landed the treatment-v3 purpose/comprehension fix-forward: the active panels moved off the legacy `MovablePanel` substrate, VRMenu was retired, the generic panel launcher left the normal analyst path, and GUIDE now presents purpose, the dataset-to-evidence mental model, canonical live next-step guidance and progressively disclosed capabilities. #745 remains open because fresh physical human comprehension evidence is still required; the retained superuser diagnostic launcher and other physical-input/human-utility residuals also prevent a physical or human completion claim.
- #717 added fail-closed unsupported-manifold handling and qualified representation evidence; #718 batched the large-grid projection; #719 made the WASM JSON input boundary reject non-finite/lossy values. They close bounded correctness/performance defects but do not establish the UXR2 lifecycle governor, UXR3 bounded semantic working set, or physical Quest fitness.
- #769 closes the bounded UXR3 lifecycle-continuity tranche: symmetric coarse/refined replacement, identity-only eviction descriptors, fail-closed reconstruction matching and production-path reconstruction are exact-head verified.
- #772 closes UXR3-F1a's first bounded presentation-cost admission tranche: heterogeneous independent cost dimensions are admitted atomically, malformed/missing budgeted cost fails closed, replacement preserves accounting on failure, and release/eviction does not duplicate charging. This is presentation accounting, not a physical-memory measurement claim. Cross-family enforcement and broader bounded streaming remain open.
- #730, #731, #733, #750 and #751 are dependency/tooling maintenance. Their landing changes the integration base but does not promote a product, scientific or physical-evidence checkpoint.
- Aggregate Volume is a verified Rust-owned bounded semantic embodiment.
- Distribution Field is a verified bounded empirical-distribution embodiment rather than a density alias.
- Density Field is a verified Rust-owned governed density embodiment.
- Cluster Regions source-partition V1 is `VERIFIED COMPLETE` after C1-C5, including the #595 evidence-trigger fix-forward and fresh-main STOP review.
- Fresh dataset loads are overview-first rather than silently biasing Moneta toward individual observation identity.
- Aggregate, distribution, density, governed cluster and source-authoritative relationship-graph structures are first-class semantic interaction targets rather than being registered as raw observations.
- Explicit individual-inspection intent can still select `POINT_SET`; progressive disclosure removes point universality, not legitimate observation-level representation.

## UXR2 ownership/lifecycle implementation and evaluation gate

The landed UXR2 execution order remains the governing record: **ownership correctness precedes adaptive lifecycle/eviction policy**. The implementation/evaluation authority is `docs/roadmap/UXR2_RESOURCE_OWNERSHIP_LIFECYCLE_IMPLEMENTATION_EVALUATION.md`; #761 closes its bounded software path while Worker/WASM release and physical E2 evidence remain open.

Execution tranches are sequential unless an adversarial review forces revision:

1. **UXR2-O1 ownership falsifiers:** prove current shared material/texture/non-singleton-geometry teardown hazards with executable tests.
2. **UXR2-O2 ownership/lease authority:** introduce `PRIVATE | SHARED | EXTERNAL` semantics and last-owner destruction; migrate hard-coded sharing exceptions into explicit ownership where feasible.
3. **UXR2-L1 lifecycle governor:** implement atomic `ACTIVE -> WARM -> COLD -> EVICTED` residency with bounded cleanup, revision safety and truthful telemetry.
4. **UXR2-L2 ownership-aware Three.js adapter:** amortise teardown and require all shared-resource destruction to pass through lease authority; keep cold descriptors bounded and non-semantic.
5. **UXR2-L3 production composition:** wire `RepresentationSurface` and `World` while preserving old-authority-on-failure, selection identity and Worker-residency refusal.
6. **UXR2-E1 software qualification:** exact-head unit/integration/architecture/type/lint/CI/CodeQL/promotion evidence plus deterministic repeated-transition evidence for bounded records, leases and cleanup work.
7. **UXR2-E2 physical handoff:** only after E1, collect governed Quest 10/30/60-minute lifecycle evidence. Software boundedness must not be promoted into a physical-memory claim without device evidence.

**Promotion invariants:** ACTIVE semantic focus is protected; shared resources are destroyed exactly once after the last lease; EXTERNAL resources are never destroyed by this subsystem; stale async work cannot mutate newer state; presentation eviction cannot mutate durable investigation/provenance/scientific authority; telemetry counts completed rather than requested reclamation. Material adversarial findings become falsifiers before merge.

**Dependency:** `UXR2-O1 -> O2 -> L1 -> L2 -> L3 -> E1 -> E2`. UXR3 may consume the bounded presentation-residency seam after L3/E1. Adaptive eviction heuristics do not precede ownership correctness. PT9 remains downstream of the existing roadmap prerequisites.

## UXR3 next implementation plan after #769

The next implementation wave stays inside UXR3 until the public semantic working-set contract is closed. Keep fresh-main exact-head promotion, and follow the integration policy above when this wave runs concurrently with another tranche.

1. **UXR3-F1 — family payload/cost authority and inventory. PARTIALLY LANDED.** #772 lands the first independent presentation-cost admission contract and its deterministic accounting/failure falsifiers. Complete the remaining inventory across every production semantic family and materialisation/transfer path, identify which already has hard cardinality/byte/work bounds, and preserve the rule that presentation cost cannot become analytical authority. **Adversarial pre-work:** architecture/authority committee attacks accidental second authority and false genericity; performance committee attacks metrics that do not correspond to retained/transfer/render cost; prior-art committee checks bounded caches, admission control and streaming/backpressure techniques before custom machinery is added.
2. **UXR3-F2 — first generic production enforcement.** Apply F1 to the highest-leverage currently unbounded family/path, preserving old-authority-on-failure and semantic identity. Add deterministic overflow, stale-generation, cancellation and reconstruction falsifiers. **Adversarial post-work:** independent implementation committee attempts bypasses, double-counting, payload retention and identity corruption before promotion.
3. **UXR3-S1 — bounded streaming and transfer lifecycle. LANDED / STOP via #784.** The bounded queue/backpressure, cancellation, generation/revision invalidation and lifecycle-outcome path is closed for its stated software scope. This does not establish physical memory-release timing or latency.
4. **UXR3-R1 — single-computation Rust/WASM result transfer. LANDED / STOP via #790.** Repair the production ABI defect established by the 20 September runtime review: generic size-probe/read calls must not execute expensive authoritative analysis twice. Preserve Rust/WASM analytical authority and provenance. Prefer a bounded Rust-owned prepared-result handle/cache or equivalent explicit prepare/read/free contract over guessed large buffers; make ownership and destruction explicit so the fix cannot trade duplicate computation for unbounded retained results. Cover expensive TDA exports first (Mapper, persistence intervals, Betti-0), then other production exports proven to recompute on the sizing call, including statistics and dataset JSON materialisation where applicable. **Required falsifiers/evidence:** instrument the real production bridge and prove exactly one substantive analytical computation per successful public operation; prove prepared results are released on success, error, cancellation, supersession and runtime teardown; prove output identity/provenance is unchanged; retain existing missing-value and resource-refusal semantics; record static call-graph evidence separately from measured latency/memory evidence. **Automation:** treat `.agents/skills/nemosyne-runtime-review/SKILL.md` as the reusable review contract for this tranche. Convert its five failure classes into focused production-path regression checks where mechanically testable, especially duplicate-computation call counts, runtime/result lifetime cleanup, resident-handle disagreement and copy-amplification counters. Wire the deterministic subset into the normal repository test/promotion path rather than relying on a one-off review; keep profiling-only questions explicitly non-gating until a governed measurement contract exists. **Adversarial pre-work:** architecture/authority review attacks second-authority/caching hazards; lifecycle review attacks leaked prepared results and stale handles; performance review attacks false speedup claims and requires measurement before promotion. **Finite exit:** exact-head production-path tests reject duplicate computation and retained-result growth, post-implementation review finds no unresolved material defect, and repository promotion gates pass.
5. **UXR3-E1 — cross-family qualification and finite STOP decision.** Run known-structure and perturbation cases across Aggregate, Distribution, Density, Cluster, Relationship Graph and any other production family actually covered by the generic contract. Demonstrate that source N does not obligatorily drive visible/retained presentation cardinality, that refine/collapse/evict/reconstruct preserves semantic identity/provenance, and that unsupported cases refuse or remain explicitly unqualified. **Adversarial committee:** evidence/statistical committee attacks the inference from bounded software evidence to scale claims; UX/spatial committee attacks whether progressive materialisation remains legible; definitive-vision committee checks dataset-first alignment. A PASS closes only bounded UXR3 software, not physical Quest fitness.
6. **UXR4 — governed verification profiles bound; physical execution ACTIVE.** #806 binds the governed Quest 5/30/60-minute qualification profiles to the existing evidence chain. Execute the 5-minute functional profile first, adjudicate attributable evidence, and convert material failures into bounded fix-forward work before longer profiles. Browser/IWER/simulator evidence remains non-physical evidence.
7. **UXR5 — physical qualification follows successful UXR4 execution.** Complete attributable physical Quest qualification and the finite P1-UXR STOP review only from governed device evidence. #807 established a single persistent workspace-panel authority/reachability path; #811 then fixed the UIKit visibility regression exposed on that path by making rendered mesh visibility substrate-neutral, and #812 completed the convergence by introducing the explicit `WorkspaceSurface` lifecycle contract so `WorkspaceSurfaceManager` no longer probes `MovablePanel` versus UIKit behavior at runtime. This #807 -> #811 -> #812 sequence closes the bounded software lifecycle/visibility defect but does not itself qualify the physical device experience. Quest is a specialist modality and reference stress environment; its completion does not make VR hardware a prerequisite for later investigator participation.
8. **Then P1-WP — Web Productionization & Deployment.** Trigger **AP-WEB** just before the first tranche that commits production identity/persistence/data/deployment topology, then productionize and deploy the ordinary browser application for internet-accessible investigator use. Close production hosting/build, desktop/browser interaction, security/privacy, dataset isolation/ingestion, persistence/recovery, provenance-preserving replay/export, operational observability, deployment/rollback, and consent/evidence-use boundaries. WP expands access beyond specialist VR hardware but does not by itself establish investigator usability or admissible learning evidence.
9. **Then P1-WQ — Web Investigator Qualification.** Qualify the deployed non-VR browser experience with real investigators: prove the core investigation lifecycle is usable and comprehensible on supported ordinary hardware, validate judgment/evidence capture and provenance, characterize browser/hardware diversity, and keep telemetry distinct from consented evidence and training data. WQ is the population/evidence-access gate before PT9.
10. **P1-TEC closure lane — ACTIVE where non-colliding.** Bounded trustworthy-evidence closure may advance concurrently with UXR4/UXR5 and WP/WQ when it does not collide with the single forward implementation lane. Close end-to-end trustworthy-evidence propagation, transport/identity gaps, heuristic terminology debt, adversarial falsification coverage and the Full-Moneta handoff before any learned representation policy consumes the evidence substrate.
11. **Then PT9.** Begin the Moneta learning-evidence pipeline only after WP deployment, WQ qualification and P1-TEC closure establish both a viable investigator-judgment route and a trustworthy evidence handoff.

### Architecture-preflight triggers

Architecture preflight is a **just-in-time design gate**, not a standing workstream. It runs only when the next tranche crosses a durable shared seam whose reversal would be expensive. The detailed rule and Full Moneta triggers are in [`roadmap/P1_FULL_MONETA_INCREMENTAL_CAPABILITY_PLAN.md`](roadmap/P1_FULL_MONETA_INCREMENTAL_CAPABILITY_PLAN.md#31-architecture-preflight-rule).

Current live triggers:

- **AP-WEB — Production/data topology:** before P1-WP commits to production persistence, identity/tenancy, dataset isolation, consent/data retention, evidence transport or deployment topology. Decide the smallest deployable topology, local/server state boundary, immutable artifact model, deletion/export traversal, telemetry/evidence/training separation, security boundary and rollback/recovery contract.
- **AP-INV — Investigation graph / branching:** immediately before durable FM1 intent/history implementation; the same contract must carry FM2 Road Not Taken, Memory Palace/Farcaster branch projection and later search lineage.
- **AP-SEMRES — Semantic resolution / budget broker:** immediately before FM4 adaptive semantic-resolution implementation.
- **AP-LEARN — Learning evidence:** before PT9/FM6 corpus construction or discovery-outcome attribution.
- **AP-SEARCH — Representation search/synthesis:** before the first FM7 grammar/search implementation.
- **AP-COLLAB — Collaboration/recurrence:** only when FM6+ shared branches or cross-investigation recurrence reach implementation.

Each preflight should normally be one compact ADR/design note with ownership, identities/contracts, failure/replay/migration implications, alternatives and falsifiers. Do not pre-author future ADRs before their frontier. FM0/P1-TEC and the existing MCR architecture are not reopened by default.

### Adversarial committee queue

Committee work is evidence-producing work, not ceremony. Run the F1 architecture/performance/prior-art challenge **before implementation** because its outcome defines the cost contract. Run the S1 concurrency/security challenge before touching streaming. For UXR3-R1, run the architecture/authority, lifecycle and performance challenge before changing the ABI, then convert any material disagreement into executable falsifiers. For each implementation PR, bind a separate post-implementation review to the exact head and convert material findings into executable falsifiers. Before UXR3 STOP, run the evidence/statistical, UX/spatial and definitive-vision reviews against one compact cross-family evidence packet. Physical-device and human-comprehension questions remain ABSTAIN/open until attributable physical evidence exists.

## Execution model

The roadmap retains the A/B/C/D programme names because they encode bounded ownership and finite exits. From 2 October 2026 onward, execution uses **two durable implementation streams plus review/preflight support**. **Claude owns the dependency-critical evidence/platform spine; OpenCode owns a continuously fed, disjoint product/capability stream.** Each stream remains sequential within its own dependency chain and may use optional parallel-safe/spawnable sub-branches. Antigravity supplies architecture preflight, adversarial review and bounded exploratory work rather than becoming a third competing implementation authority. This supersedes the temporary single-spine scheduling assumption while retaining the disjointness and integration controls below. From 11 September 2026 onward, adversarial review is explicitly **recursive rather than merely post-implementation**: consequential choices are attacked before implementation, substantive disagreement becomes falsifying evidence, and results are attacked again before promotion. `roadmap/P1_PRODUCT_TRANSITION_PLATFORM_AND_LEARNING_PLAN.md` remains the strategic tranche specification. Issue #620 is a historical execution checklist whose unchecked items and ordering are stale after PT0-PT8 and the P1-UXR activation; it is not current status authority. This file alone governs live status and next-work sequencing.

Current order:

```text
Stream A STOP
  -> Stream B Relationship Graph V1 STOP
    -> Stream C bounded C1-C4 implementation/evidence LANDED
      -> P1-PT PT0-PT8 LANDED / bounded STOP where declared
        -> P1-UXR ACTIVE (UXR0-UXR3 bounded software landed/STOP; UXR4-UXR5 evidence open)
          -> UXR4 verification refocus
            -> UXR5 physical Quest qualification + P1-UXR STOP
              -> P1-WP web productionization + internet deployment
                -> P1-WQ web investigator qualification
                  -> FM0 / P1-TEC trustworthy-evidence closure
                    -> FM1 question-aware Moneta
                      -> FM2 alternative-aware Moneta / Road Not Taken
                        -> FM3 compositional Moneta (P1-MCR MCR2-MCR4)
                          -> FM4 resolution-adaptive Moneta
                            -> FM5 qualified System-1-assisted proposals
                              -> FM6 human-refined Moneta (PT9; PT10/private-preview evidence loop)
                                -> FM7 bounded representation search / synthesis handoff
                                  -> FM8 controlled Full Moneta

Preparatory contract, UX prototype, research and laboratory work may run earlier when non-colliding, but production promotion follows the capability/evidence prerequisites above. Physical Quest/human evidence gates run when their claims require them; they do not block unrelated software work.
```

### Integration policy (relaxed 29 September 2026)

More than one forward implementation PR may be active concurrently **only when the tranches are provably disjoint**. Each concurrent tranche must declare its changed-file surface in its PR description, and no two concurrent tranches may modify the same file or share an exclusive seam.

Exclusive seams remain strictly serialized: `docs/ROADMAP.md`, `governance/*.json` and their generated projections, shared authority contracts, and `tests/config/test-groups.ts`. A tranche that must touch one of these lands before or after — never concurrently with — another that touches it.

Disjointness must be re-checked against fresh `main` immediately before each PR is opened. When disjointness is uncertain, serialize rather than assume.


#### Parallel lane claims

Parallel capacity is allocated by **roadmap tranche and authority/file surface, not permanently by machine or model**. Agent names below are an operational snapshot, not architectural ownership. Before mutating a tranche, every recruit must fetch fresh `main`, inspect active worktrees/PRs and leases, and claim an isolated worktree with `nemosyne-workstream`. A claim records owner, roadmap item/purpose, branch/PR, expected changed-file surface and any exclusive seam. If the expected surface intersects an active claim, the later recruit must choose another eligible tranche or wait; it may not rely on merge-conflict detection as the collision protocol.

Use three scheduling classes:

- **PARALLEL-SAFE** — bounded research, architecture preflight, tests/contracts or implementation whose expected authority and changed-file surfaces are disjoint from all active claims.
- **CONDITIONAL** — may run concurrently only after an explicit fresh-main collision check proves disjointness; stop and reclassify if the implementation expands into another lane's surface.
- **EXCLUSIVE/SEQUENTIAL** — touches an exclusive seam above, changes a shared authority/persistence/replay contract, or depends on an unlanded predecessor. Only one such claimant may mutate that seam at a time.

Durable work is now organized by **product/architecture theme**, not by machine or model. The machine table below is only the current assignment snapshot.

| Lane | Product theme | Durable scope | Near-term queue | Primary collision seams |
| --- | --- | --- | --- | --- |
| **L0 — Truth & Evidence** | Make every semantic claim trustworthy and replayable. | P1-TEC, analytical/evidence receipts, decision-independent semantic snapshots, evidence binding, typed refusal/ABSTAIN. | Finish current TEC closure; settle **A27-0**; then **L0-SEM-NORM-A** before MCR2 promotion. | Rust/WASM evidence contracts, persisted evidence/replay, semantic snapshot identity/evidence refs. |
| **L1 — Investigation, Perspective & Alternatives** | Make Moneta answer the researcher's question, expose explicit perspectives and preserve reasoning. | FM1 intent/context + `InvestigationPerspectiveV1`, Memory Palace, FM2 Road Not Taken, Challenge, Farcaster context transitions, branch/revisit. | Continue FM1 integration; add L1-PERSPECTIVE-0; then bounded FM2 alternatives/branching. | Atlas/investigation state, NIL orchestration, perspective/representation provenance. |
| **L2 — Forma & Semantic Embodiment** | Turn governed dataset meaning into explainable perceptual form. | RepresentationGraph, fixed obligations, typed bindings, pinned knowledge manifest, deterministic admission/compiler, immutable plan/result identity, explanation/replay/non-adaptive feedback and qualified backends. | After **A27-0 + stable L0/L1 identity**, land **L2-FORMA-0 + bounded KB0 → first static L2-FORMA-1 slice → L2-FORMA-2/MCR3-4**; behavior/modalities follow demonstrated need. | Representation/embodiment schemas, admission/compiler boundary, knowledge manifest, runtime adoption/replay seam. |
| **L3 — Intuitive Interaction & Reflexes** | Make interaction and proposal generation fast without hidden authority. | System-1 object-centric perception, gaze/voice cue contracts, deterministic resolvers, Forma/representation proposal. | FM5-S1A contract/runtime preflight may continue; FM5-S1C output schema waits for qualified FM3 Forma contracts. | System-1 shared contracts, input/NIL boundary, model artifact schema. |
| **L4 — Runtime & Device Efficiency** | Run the same semantics cheaply on constrained hardware. | Quest MAC-Q0..Q5, worker/runtime scheduling, resource/perceptual budgets, adaptive richness, scriptc. | Quest baseline/fast wins; scriptc T0-T2; L4-RUNTIME-BUDGET preflight alongside FM4. | WebXR/Three.js runtime, worker/data plane, device/resource profiles. |
| **L5 — Human-Grounded Learning & Search** | Preserve human metaphor expertise and improve proposals/search from governed outcomes. | Forma knowledge promotion, FM6/PT9 learning, System-1 distillation, RepresentationGenome/search, System-2 synthesis; optional world-model research only if triggered. | Schema/preparatory research only until FM3/F4 contracts and evidence gates stabilize; adaptation begins at FM6. | Forma knowledge/model registry, search/genome contracts, training/promotion artifacts. |
| **L6 — Product Validation & Integration** | Prove the instrument improves understanding and remains coherent. | semantic-fidelity studies, restricted study-use semantics, multimodal experiments, UXR/device evidence, FM STOP reviews, FM8 integration. | Design L6 protocol/controls **concurrently with L2 contracts**; human/physical claims remain open until attributable evidence exists. | frozen treatment/protocols, shared E2E fixtures, human/device evidence custody. |

**Current recruit assignments (not ownership):**

| Recruit / host | Assigned lane | Current/next tranche | Class | Must avoid while claimed |
| --- | --- | --- | --- | --- |
| Claude / Millhouse | **L0 Truth & Evidence** | current TEC/RFC 0009 evidence spine, then highest-priority dependency-safe L0 tranche | EXCLUSIVE/SEQUENTIAL within authority seam | L1/L2 surfaces unrelated to evidence closure while L0 work is available |
| OpenCode + Jev / Millhouse | **L1 Investigation, Perspective & Alternatives** | FM1 Question/Perspective-Aware Moneta, then dependency-safe FM2 or L2 slice | CONDITIONAL / PARALLEL-SAFE after fresh-main collision check | active L0 evidence/replay seams; L2 shared schema files before L2-FORMA-0 lands |
| ChatGPT / Mac | **L3 + L4 experimental/preflight** | System-1 provider-neutral contract/model experiments, Quest/device work, scriptc T0-T2 | PARALLEL-SAFE while prototype-only and disjoint | production Moneta/Forma authority wiring without a separately authorized tranche |
| Antigravity / Mac | **L2 + L6 feeder** | Forma architecture/contracts/adversarial review, validation/study pre-work; implementation only under explicit lease | PARALLEL-SAFE review/pre-work | competing implementation ownership or shared schema edits without exclusive claim |

**System-1 invariant:** L3 owns advisory prototype substrate and comparative experiments: provider-neutral contracts, local/remote adapters, bounded corpora, parity/calibration/latency/memory benchmarks and model-family experiments. It may test ONNX, Rust/tract, small encoder/classifier, Jev/Fastino or other candidates behind the common contract, but it may not wire a candidate into production Moneta/Forma authority or bypass System-2 hard/evidence constraints.

**Lane handoff rule:** a worker is assigned to a concrete tranche, never the whole lane. When a tranche lands, it refreshes `main`, releases/renews its lease, and takes the highest-priority eligible tranche in its assigned lane. If that lane is genuinely blocked, it may assist another lane only through a separately claimed, provably disjoint tranche.

**Current reconciliation (3 October 2026):** #927 is now merged at `5926da8b`; the preflight below records its earlier state. RFC 0011 now resolves that decision gate through delegated adjudication; purpose-bearing context V2 and the amended admission/preservation contracts govern further work. Independent work remains subject to collision and upstream evidence rules.

**L1-PERSPECTIVE-0 preflight record (OpenCode / Millhouse, 3 October 2026, base `main@44f3f0b4`).** Preflight only; no production change and no shared-semantics edit. A27-0 (#927, `architecture/a27-0-authority-version-decision`) is open and unmerged, and its own handoff sets `dispatch_requires: PR927_INTEGRATED`, so this lane stays preflight-only until that integration lands.

Already complete and reusable: `InvestigationIntentV1` + canonicalization + `sha256-intent-v1-` identity (`src/atlas/domain/InvestigationIntent.ts:3-95`, ADR 0009 semantics, 9 tests in `tests/investigation-intent.test.ts`); `InvestigationGraph` as authoritative DAG lineage owner (`src/atlas/domain/InvestigationGraph.ts:52`, `branches_from` edge at `:16-23`); wired Memory Palace projection (`src/vr/presentation/epistemic/FunctionalWorldObjectsPresenter.ts:99` -> `MemoryPalaceWorldView`); Farcaster context transitions.

Verified gaps bounding the L1 slice, each confirmed at this base rather than inferred:

- `InvestigationPerspectiveV1` does not exist as a type, field, or serialization anywhere; `AtlasCoreState` has no perspective field.
- `InvestigationIntent.ts` has **zero** `src/` consumers and is absent from `src/atlas/domain/index.ts`; ADR 0009 records intent as a deliberately isolated first slice.
- Committed context is lossy in all three projections — `InvestigationAggregate.ts:208-212`, `:397-401` and `:405-409` emit only `studyId`/`researchQuestion`/`hypothesis`. `variablesOfInterest`, `currentTask` and `observerMode` are neither persisted nor digest-bound, so a perspective that foregrounds variables would not be covered by existing identity.
- Revisit does not exist. `InvestigationGraph.setActiveNode:195` moves only `_activeNodeId` and restores no analytical state; no `revisit` symbol exists in `src/`.
- The `intent?: AnalyticalIntent` parameter (`src/moneta/representation/MonetaHypothesisEngine.ts:221-223`, `src/moneta/representation/EvidenceBackedMoneta.ts:61`) is never supplied by a production caller: the only two `.arbitrate(` call sites are `src/atlas/domain/RepresentationState.ts:362` and `:417`, matching ADR 0009's "production Moneta does not yet consume intent".

Obsolete / duplicate / abandoned, flagged and deliberately not touched: `InvestigationBranchManager` (`src/session/InvestigationBranchManager.ts:29`, barrel plus smoke test only, unrelated frame-list branching) against ADR 0009's graph-as-lineage-owner; `MemoryPalaceGraph` (`src/memory/MemoryPalaceGraph.ts:40`, no production consumer) against the wired `MemoryPalaceWorldView`; three intent-bearing surfaces (`InvestigationIntent.ts`, `ResearchContext.ts:13-53`, `src/atlas/types.ts:280-287`); `Road Not Taken` absent from `src/`; `Challenge` a verb only (`src/vr/World.ts:474-479` routes to anomaly analysis). None are in this lane's authorized file set, so they are recorded for the owning/integration slice.

Falsifiers and acceptance tests designed, not executed (execution waits on the A27-0 contracts): the four A27-0 L1 contract tests — draft/commit/branch/revisit preserve node IDs and authoritative DAG edges; canonical intent and perspective hash fixtures preserve absence and variable order; a view-only perspective leaves snapshot identity unchanged while any filter requires analytical derivation; context revision plus activation epoch reject A->B->A. Plus invariant coverage **F01** (perspective invariance: foregrounding over equal analytical coverage keeps equal `snapshotId` with distinct `C`/decision identity), **F05** (stale asynchronous adoption: compile for A, commit B, receive A -> `CONTEXT_INCOMPATIBLE` before mutation; A->B->A rejects the stale activation epoch) and **F11** (legacy downgrade: an unmodified V3 fixture keeps identical digest and replay behavior). Each requires a positive control through the same real entry point so universal refusal cannot pass.

Lane boundaries for any future session: this lane owns only `src/atlas/domain/InvestigationIntent.ts`, `src/atlas/domain/ResearchContext.ts`, `src/atlas/domain/InvestigationGraph.ts`, `tests/investigation-intent.test.ts`, and the new `src/atlas/domain/CommittedInvestigationContext.ts`, `src/atlas/domain/InvestigationPerspective.ts`, `tests/investigation-perspective.test.ts`. Durable session/digest/replay integration (`src/atlas/types.ts`, `InvestigationAggregate.ts`, `NemosyneSession.ts`, `NemosynePackage.ts`, `InvestigationReplayRunner.ts`, `InvestigationDigest.ts` and the session/runtime controllers) is the serialized L2-FORMA-1 integration slice and is **not** editable here; if this slice needs it, that is a stop-and-hand-off, not a workaround. This lane does not take A27-0 authority/version semantics, Gemini/Astra architecture adjudication, or Codex-assigned work.

Next executable L1 tranche: after fresh-main collision checks, implement the RFC 0011 context V2 follow-up to the provisional #933 contracts plus focused tests as a **domain contract slice only**, stating explicitly that domain contract tests do not establish production commit/revisit or replay closure.

**L1-PERSPECTIVE-0 domain contract slice (OpenCode / Millhouse, 3 October 2026).** A27-0 integrated via #927 (RFC 0010 `accepted`), which cleared the `dispatch_requires` guard, so the authorized slice is now landed as three new files with no existing file modified: `src/atlas/domain/InvestigationPerspective.ts` (closed, enumeration-only view contract), `src/atlas/domain/CommittedInvestigationContext.ts` (content-addressed `contextId`, monotonic `revision`, `activationEpoch`, single-owner ledger, `CONTEXT_INCOMPATIBLE` compatibility check) and `tests/investigation-perspective.test.ts` (25 tests covering F01, F05, F11, the four A27-0 contract tests, and the ERA-ASTRA1 §4.2 mode requirement).

Design points that are authority, not preference: perspective identity is closed to enumeration values so no field can filter rows, compute statistics or invent a relation (an A27-0 stop condition); `studyId`/`observerMode` are structurally un-admittable because §5 denies them as scientific input or authorization; content identity is a pure function of committed meaning so revisit restores the exact value, while `revision`/`activationEpoch` stay outside the hash so same-content revisit increments the epoch and an A->B->A race stays distinguishable.

Status is deliberately **not** `VERIFIED COMPLETE`: per the A27-0 claim limit these are domain contract tests only. Nothing yet produces production commit/revisit/replay behavior, because durable session/digest integration is owned by the serialized L2-FORMA-1 slice and those files (`src/atlas/types.ts`, `InvestigationAggregate.ts`, `NemosyneSession.ts`, `NemosynePackage.ts`, `InvestigationReplayRunner.ts`, `InvestigationDigest.ts`, session/runtime controllers) are outside this lane's file set. `ResearchContext` is also deliberately unmodified: `InvestigationAggregate` constructs it, so removing session-side research metadata is integration-slice work, not a lane-local edit.

**Aligned to ERA-ASTRA1 §4.2.** Astra requires that a perspective "say whether it merely foregrounds existing meaning or requests a new operation", so `mode` (`foreground` | `request_derivation`) is a mandatory, non-defaulted field rather than an implied convention. Absent mode refuses. This keeps A27-0's stop condition intact: neither mode may carry a filter, threshold, subset or limit, because requesting a governed derivation is not filtering. Per Astra, the request itself still leaves snapshot identity untouched — Atlas schedules the derivation and returns a *new* immutable snapshot, so only that new snapshot changes analysed meaning. The derivation-request vocabulary is deliberately not invented here; it belongs to the integration slice.

**SHADOW-0002 is now tracked (not a lane-local fix).** #931 recorded the lossy committed-context projection as a `HIGH`/`HIGH` `CANDIDATE` finding owned by the A27-0/L1-PERSPECTIVE integration owner. This lane's domain contract commits `variablesOfInterest` and `currentTask` through ADR 0009 `InvestigationIntent` and explicitly excludes `studyId`/`observerMode` as non-scientific, but the durable persistence/digest identity in `InvestigationAggregate` remains three-field and unchanged by this lane. SHADOW-0002 therefore stays open until the integration slice lands; it is not closed here.

**A27-1 adjudication of the #933 provisional slice (3 October 2026):** RFC 0011 is accepted as amended under the project owner’s explicit delegation. The V1 context/hash remains unchanged for compatibility; L1 must add V2 with mandatory purpose, investigation/dataset identity, immutable commit revision and scope binding. Epochs remain runtime-local and outside content identity. L2 must consume the merged verified V2 contract, not widen V1 or infer purpose. L0/L1 disjoint work and L2 bounded contract work are cleared as specified in RFC 0011; shared session/digest/adoption work remains serialized in L2-FORMA-1.

**Historical provisional disposition before adjudication.** A27-1 (merged #932, RFC 0011 proposed) states that L1 preflight and independent intent/perspective work remain useful, but that **closed context identity must incorporate the adjudicated purpose contract before freezing**. The committed context here is closed and deliberately omits purpose, conjectural binding and preservation, so it is a pre-adjudication artifact and must not be treated as a frozen contract. Concretely: nothing may freeze on `CommittedInvestigationContext` until RFC 0011 is adjudicated, and the L2-FORMA-1 integration slice must expect to reopen the closed field set rather than wire it as-is. Widening that field set before adjudication is exactly the material scientific-semantics change that A27-0 routes through the RFC process, so this lane stops here rather than pre-empting A27-1.

**Continuous-feed invariant:** Claude and OpenCode are durable implementation capacity. A merge, STOP decision, or genuine blocker ends only the current tranche, not the worker stream. The administrator must immediately refresh main, release/expire the completed lease, and assign that worker the highest-priority dependency-safe tranche in its stream. Do not leave either implementation worker unassigned while eligible roadmap work exists, and do not manufacture low-value work merely to keep a worker busy. If one stream is genuinely blocked, it may temporarily assist the other only through a separately claimed, provably disjoint sub-branch.

A merged PR, stopped worker or stale worktree ends the *assignment*, not the roadmap item. The coordinator should release/expire its lease, refresh this snapshot when useful, and allocate the newly free recruit to the highest-priority eligible non-colliding tranche. The executable lease/worktree state is the live collision guard; this table is the human-readable traffic map and must not be treated as stronger evidence than current Git/lease state.

Risk classification under `AGENTS.md`, required CI, exact-head promotion gates and the adversarial review owed by each risk tier are unchanged and remain **per-tranche**. Every tranche still fetches fresh `main` before starting, completes the review its own tier requires, runs its own exact-head evidence, fixes forward and merges at its own verified head. Parallel execution never lets one tranche's verification evidence stand in for another's required evidence, and no shared artifact may be promoted as a substitute for an individual tranche's gate.

### Recursive adversarial governance

The authority hierarchy is explicit:

- `docs/Nemosyne_Definitive_Vision_and_Roadmap.md` governs **what Nemosyne is trying to become**;
- this roadmap governs **what happens next and what is currently complete**;
- adversarial review governs **how uncertain claims earn confidence**;
- canonical code/domain authorities remain authoritative for their owned semantics;
- human/domain judgement remains required where meaning or scientific validity cannot be mechanically adjudicated.

For consequential work, use the loop:

```text
roadmap + definitive vision
  -> claim / invariant / failure modes
    -> prior-art assimilation where relevant
      -> independent challenge / alternative proposals
        -> disagreement -> decisive tests or competing bounded implementations
          -> implementation / experiment
            -> empirical evidence
              -> adversarial result review
                -> exact-head promotion, revision or rejection
```

The committees exist to **increase throughput**, not to create ceremony. Reviews run in parallel, use compact evidence packets, reuse existing evidence, and escalate only when risk, uncertainty or disagreement justifies the extra cost. Routine work should spend less time in review because higher-quality pre-design and falsifiers reduce fix-forward cycles. Track review latency, unique defect yield, escaped regressions and rework; reviewer/model routes that consume time without finding distinct useful failures should be demoted or retuned. Over rolling groups of ten comparable tranches, use council-run timestamps plus GitHub PR lifecycle timestamps and defect/fix-forward dispositions to measure review cost and benefit. If median review-to-merge time regresses by more than 10% without a compensating reduction in escaped defects or fix-forward rounds, simplify or reroute the committee path. The 10% threshold is an initial operational tripwire, not a scientific constant; the desired steady-state is faster than the pre-committee cadence.

A compact review packet should identify: the claim/change, governing roadmap and vision anchors, authority boundary, exact SHA/diff or artifact hashes, relevant evidence, known uncertainty, proposed falsifiers, and the accountable decision owner. Reviewers may recommend, challenge or request evidence; they do not acquire authority to edit the vision, reorder the roadmap or declare scientific truth. Unresolved governance or candidate-new-knowledge disputes terminate in explicit human/project-owner judgement, not a model vote.

Stochastic adversarial surveillance runs alongside tranche review and samples security/privacy, connectivity/collaboration, UX/spatial interaction, definitive-vision alignment, architecture/authority, performance/resource behaviour, provenance/replay, prior-art/reuse, statistical/epistemic correctness and candidate scientific contributions. Sampling should combine risk, neglect and a genuine reproducible random component. Persist the seed, repository SHA, evidence packet, reviewer identities and decisive tests.

Random review is a **finding generator, not a roadmap mutation authority**. It stays off the merge critical path unless the underlying evidence is independently validated and the applicable human/project owner explicitly ratifies that the severity warrants interrupting the active tranche. Model-to-model agreement alone cannot pause or reorder the roadmap. Otherwise findings enter explicit roadmap/issue triage. This preserves broad search without random priority thrash.

The definitive vision may also seed exploratory analysis: reviewers may derive testable questions from its principles and search for cheaper algorithms, contradictory evidence, missing capabilities or overlooked adjacent possibilities. Such exploration can create hypotheses or future roadmap candidates, but it cannot silently rewrite the vision or advance work ahead of declared prerequisites.

Claims of **new knowledge** receive the strongest gate. Model consensus is insufficient. Require explicit prior-art/evidence search, measurement and inference audit, alternative explanations, held-out or independent replication where feasible, reproducible provenance, and human/domain-expert judgement proportionate to the claim. Without those controls, classify the result as an engineering result, product observation, hypothesis or supported-but-not-novel research result.

**Full-Moneta scientific evidence boundary:** `docs/research/MONETA_EVIDENCE_PROTOCOL.md` is the persistent public contract for representation-candidate evidence admissibility. Its executable lab gate is `dev/xr-lab/MonetaEvidenceProtocol.ts`; #749 adds the production signed-certificate verifier and first-class `ABSTAIN` path governed by RFC/ADR 0006. PT9 learning evidence and later RepresentationGraph/compositional search may extend these gates but may not bypass them: measurement-scale legality, compositional semantics, adaptive/post-selection calibration, high-dimensional stability requirements, benchmark-oracle authority, abstention and human-required claims remain feasibility/evidence constraints rather than tradeable utility terms. Weakening those boundaries is a high-risk scientific-governance change.

At this integration base, `p >= n` remains fail-closed: absent a verified promotable stability claim, Moneta returns `ABSTAIN` and exposes ranked near misses without choosing or rendering a representation. #749 can authenticate a signed certificate, but deliberately exposes only `VERIFIED_NON_PROMOTABLE` because neither a Rust/WASM authority receipt for candidate-specific effective dimensionality nor a scientifically justified promotable governing policy exists. The existing Rust `effectiveDimensions` value subtracts constant columns from the schema column count; it is a non-constant-column/schema heuristic, not intrinsic-dimensionality or candidate-specific scientific authority. Production therefore continues to use dataset-wide `columnCount` as conservative `p`.

### P1-TEC — Trustworthy Evidence Closure

**Status:** PLANNED GATE / TEC0 AUDIT LANDED (#803); TEC1 RECEIPT-TRANSPORT SLICE LANDED / ADVERSARIAL REVIEW PASS (#805); TEC1 REQUIREMENT-PROFILE/TYPED-REFUSAL SLICE LANDED 2026-09-26 (RFC 0007 SECTION 3 IS NOW IMPLEMENTED AT THE LIVE RESOLVER: REQUIREMENT PROFILES ARE AN AUTHORITY-OWNED CLOSED REGISTRY (`EvidenceRequirementProfileV1`, MINTED ONLY INSIDE THE EVIDENCE CONTRACT LAYER AND ENFORCED BY A MODULE-PRIVATE IDENTITY REGISTRY SO SPREAD/SYMBOL/PROTOTYPE PROFILE FORGERIES ARE REJECTED) EXPRESSING AXIS PRESENCE AND ASSUMPTION-STATUS POLICY ONLY — NO NUMERIC THRESHOLDS — AND `resolveAgainst` RETURNS THE IMMUTABLE RUST-ISSUED RECEIPT OR A TYPED GOVERNED REFUSAL (`RECEIPT_NOT_FOUND`, `MISSING_REQUIRED_AXIS`, `VIOLATED_ASSUMPTION`, `UNRESOLVED_ASSUMPTION`), WITH `DATASET_MISMATCH`/`KERNEL_MISMATCH` RESERVED FOR THE GOVERNED REPLAY RESOLVER; AN EXPLICIT RUST-ISSUED ANALYTICAL-ADMISSION REJECTION CANNOT SATISFY THE ESTABLISHED-CONTEXT AXIS; NO CURRENT STATISTICS RECEIPT SATISFIES THE INFERENTIAL PROFILE, SO INFERENTIAL CONSUMPTION REFUSES RATHER THAN PROMOTING DESCRIPTIVE QUANTITIES; STALE-HANDLE REVOCATION IS PRESERVED; NO MONETA/REPRESENTATION DECISION PATH CHANGED AND NO DOWNSTREAM ADMISSIBILITY OR TEC-CLOSURE CLAIM IS PROMOTED); TEC1 GOVERNED REPLAY RESOLUTION SLICE LANDED 2026-09-26 (RFC 0007'S PERSISTENCE/REPLAY CONTRACT IS IMPLEMENTED AT THE EVIDENCE CONTRACT LAYER: `governedReplayEvidenceReceiptAuthority` MINTS THE REPLAY RESOLUTION CAPABILITY ONLY FROM A STRUCTURALLY VALIDATED PERSISTED `EvidenceReceiptBundleV1` PLUS AN EXPLICIT WELL-FORMED REPLAY-CONTEXT IDENTITY, EXPOSES ONLY GOVERNED PROFILE-BOUND RESOLUTION WITH NO UNGOVERNED LOOKUP, AND FAILS CLOSED WITH THE TYPED REFUSALS `DATASET_MISMATCH`/`KERNEL_MISMATCH` (PERSISTED BUNDLE IDENTITY VS REPLAY CONTEXT, DETERMINISTIC DATASET-THEN-KERNEL ORDER) AND `UNKNOWN_REQUIREMENT_PROFILE` (GOVERNING PROFILE IDENTITY NOT MINTED BY THE CLOSED REGISTRY) — HISTORICAL EVIDENCE IS NEVER SILENTLY RE-JUDGED UNDER A CURRENT DEFAULT POLICY; THE LIVE RESOLVER, REPLAY IMPORT BOUNDARY, PERSISTED PACKAGE FORMAT AND INVESTIGATION DIGEST ARE UNCHANGED, RFC 0008 VERBATIM REPLAY PRESERVED; NO PERSISTED FORMAT YET CARRIED RECEIPT BUNDLES OR PROFILE IDENTITIES AT THIS SLICE, SO THIS WAS THE REPLAY AUTHORITY SEAM, NOT AN END-TO-END REPLAY CLOSURE CLAIM — SUPERSEDED: THE V3 FORMAT AND AUTHORITATIVE CAPTURE/EXPORT LANDED IN #829/#831, AND THE SEAM'S FIFTH STEP OF REPLAY CONSUMPTION OF THE CARRIED ENVELOPE — CONSUMER-POLICY INTERPRETATION OF `uses` — WAS OPEN AT THIS SLICE AND WAS MADE POLICY-DERIVED BY SLICE 1 ON 2026-10-01, THOUGH IT STILL GOVERNS NOTHING; THE LOADER HAVING LANDED STEPS ONE TO FOUR IN `7988fa8f` ON 2026-09-29 (SEE THE RFC 0009 RECORDS BELOW)); TEC1 OPEN PENDING CONSUMER-POLICY BINDING ENFORCEMENT (SLICE 1 WIRED THE GOVERNED LOADER'S FIFTH-STEP REFUSAL TO AN AUTHORITY-OWNED POLICY, BUT THAT POLICY GOVERNS NO CONSUMER, SO BINDING A REAL ONE STILL NEEDS A RUST-ISSUED CONSUMER IDENTITY, A PRODUCER ABLE TO MINT CONFORMING `uses` AND THE REGISTRY ENTRIES THAT FOLLOW), DATASET-EVIDENCE IDENTITY BINDING AND MCR2+ EVIDENCE-REFERENCE ENFORCEMENT; TEC2 HEURISTIC-TERMINOLOGY SLICE LANDED (THE SIX ENUMERATED FIELDS RENAMED IN PLACE AT THE RUST TRANSPORT WITH NO COMPATIBILITY ALIAS, BOUNDARY VALIDATOR HARDENED AGAINST RETIRED NAMES, LIVE TYPESCRIPT PAIR-COUNT RECOMPUTATION DELETED); TEC2 DENSITY-VARIATION SLICE LANDED 2026-09-25 (`ClusterProfile.density_variation` TWO-VALUED PROXY REMOVED FROM THE RUST PRODUCER, TRANSPORT MIRROR, CANONICAL CLUSTER EVIDENCE AND CANONICAL SIGNATURE RECONSTRUCTION; OPTIONAL `DatasetSignature.clusterStructure.densityVariation` RETAINED FOR HISTORICAL PERSISTED SIGNATURES AND EXPLICIT MEASURED/DERIVED EVIDENCE; FitnessModel EPISTEMIC GATE UNCHANGED); TEC2 EVIDENCE-SCORER AUTHORITY SLICE LANDED 2026-09-25 (THE DORMANT TYPESCRIPT `EvidenceWeightedScorer` RE-RANKING REIMPLEMENTATION — DIVERGENT 20.0 SCALE, `(weight || 1.0)` ZERO-SAMPLE INVERSION — WAS DELETED RATHER THAN HARMONISED; THE NEVER-COMPILED `wasm/src/draco/` STALE TWIN DIRECTORY WAS REMOVED; THE SOLE RUST ADJUSTMENT, ITS BRIDGE ALIAS AND ITS FAIL-CLOSED ZERO-SAMPLE SEMANTICS ARE PINNED BY UNIT, SOURCE-SCAN AND REAL-WASM BRIDGE FALSIFIERS); TEC1 GOVERNED CAPTURE/EXPORT AUTHORITY FIX-FORWARD LANDED (#834 → #843 MERGED AT `main@f6cfc52c` 2026-09-30: THE 29 SEPTEMBER AUDIT'S MODULE-GLOBAL AUTHORITY ROUTES ARE CLOSED — ACQUISITION ROUTES THROUGH `AnalyticalExecutionPort` FOR BOTH INLINE AND WORKER EXECUTION, `MonetaEvidenceAuthority` OPERATES ON AN INJECTED NARROW KERNEL CONTRACT, FRESH ACQUISITION IS ASYNCHRONOUS AND PERFORMED FROM `exportPortablePackage()`, `serialize()` IS A PURE CARRIER SNAPSHOT THAT ACQUIRES NOTHING AND OMITS A CARRIER THAT NO LONGER DESCRIBES THE COMMITTED DATASET, THE #838 SYNCHRONOUS MINTING PORT MEMBER IS REMOVED, AND FIVE STATIC GUARDS COVER THE NAMED-IMPORT, RE-EXPORT-SPECIFIER, STAR-RE-EXPORT, NAMESPACE-IMPORT, PRODUCER-READ AND DYNAMIC-`import()` ROUTES INTO THE MODULE-GLOBAL PRODUCER, WITH THEIR RESIDUAL LIMITS AND DELIBERATE OVER-BLOCKS RECORDED RATHER THAN LEFT IMPLIED; ADVERSARIAL REVIEW PASS AT THE EXACT HEAD AND EVERY EXACT-HEAD CI JOB GREEN, INCLUDING `architecture:boundaries:test`, WHOSE DEPCRUISE SHIM CANNOT RUN ON THIS WINDOWS HOST AND WHOSE GREEN ON `ubuntu-latest` IS THEREFORE EVIDENCE THE LOCAL TOOLCHAIN CANNOT PRODUCE; TEC1 CLOSURE IS NOT CLAIMED — RFC 0009 TRANCHE 3 CONSUMER-POLICY BINDING ENFORCEMENT, THE SEAM'S FIFTH STEP OF REPLAY CONSUMPTION OF THE CARRIED ENVELOPE (CONSUMER-POLICY INTERPRETATION OF `uses`, WHICH SLICE 1 MADE POLICY-DERIVED RATHER THAN HARD-CODED WHILE THE SHIPPED POLICY GOVERNS NOTHING AND SO ENFORCES NOTHING; STEPS ONE TO FOUR LANDED IN `7988fa8f` ON 2026-09-29) AND MCR2+ EVIDENCE-REFERENCE ENFORCEMENT REMAIN OPEN); TEC1 RFC 0009 TRANCHE 3 SLICE 1 LANDED (#848 MERGED AT `main@e0fcaf7f` 2026-10-01, EXACT HEAD `4f2115cc` CARRYING AN ADVERSARIAL-REVIEW PASS AGAINST THAT HEAD AND EVERY CI JOB GREEN: THE GOVERNED LOADER'S FIFTH-STEP REFUSAL STOPS BEING A HARD-CODED VERDICT ABOUT WHAT THIS BUILD CAN READ AND BECOMES A DECISION MADE BY AN AUTHORITY-OWNED POLICY — `src/data/evidence/ConsumerPolicyRegistry.ts` IS THAT AUTHORITY, A MODULE-PRIVATE MAP WHOSE ONLY ACCESSOR HANDS OUT A SNAPSHOT, SO "NO MODULE OUTSIDE THE REGISTRY CAN ADD AN ENTRY" IS A RUNTIME PROPERTY RATHER THAN A TYPING CONVENTION; THE SINGLE LITERAL `uses-not-governable-by-this-build` IS REPLACED BY `CONSUMER_NOT_GOVERNED`/`CONSUMER_POLICY_REFUSED`, CLASSIFIED THROUGH AN EXHAUSTIVE RECORD OVER THE BINDER'S REFUSAL STATUSES, SO A STATUS ADDED TO THE BINDER IS A COMPILE ERROR AT THE CLASSIFICATION RATHER THAN A SILENTLY REUSED CODE; A BOUND-BUT-UNRESOLVED USE NOW REFUSES, SINCE BINDING IS IDENTITY AGREEMENT AND ACCEPTING IT WOULD OPEN AN ARCHIVE WHOSE REQUIRED EVIDENCE DOES NOT ACTUALLY RESOLVE; THE SHIPPED POLICY GOVERNS NOTHING, WHICH IS A STATEMENT RATHER THAN A PLACEHOLDER — A CONFORMING USE CAN ONLY BE AUTHORED BY A PRODUCER THAT KNOWS WHICH CONSUMER CONSUMES WHICH RECEIPT UNDER WHICH PROFILE AND THIS BUILD HAS NONE, SO THE FIRST REGISTRY ENTRY WOULD REFUSE EVERY PACKAGE THIS BUILD ITSELF EXPORTS, WHOSE ONLY MINTABLE ENVELOPE SHAPE IS AN EMPTY `uses` ARRAY, AND ENTRIES THEREFORE ARRIVE WITH THE PRODUCER SLICE; `enforcement` STAYS SINGLE-VALUED AT `'none'`, THE DECLARATION'S "WIDENED" IS CORRECTED IN PLACE IN ITS OWN RECORD BELOW, AND THE DECLARATION'S LISTING OF `tests/tec1-f1-continuity-attestation.test.ts` AMONG THE SURFACES THAT MUST CHANGE DID NOT HOLD — ITS CLAIM STAYED TRUE BECAUSE THE REFUSAL STRING WAS RE-DERIVED TO BE TRUE FOR EVERY STATUS IT IS MAPPED FROM RATHER THAN WORDED TO SATISFY A PINNED PHRASE; THIS SLICE RE-TYPES A REFUSAL AND ADDS NO CAPABILITY, AND NO TEC1 CLOSURE IS CLAIMED); TEC2 Q4/Q5 FIXTURE-FIDELITY SLICE LANDED 2026-09-26 (THE MOCK-SEAM KERNEL FIXTURE NO LONGER INVENTS VALUES THE RUST PRODUCER CANNOT EMIT — THE INVERTED NO-CLUSTERS SILHOUETTE SENTINEL, UNREACHABLE DENSITY-PROXY VALUES, THE HARDCODED SPARSE FLAG AND THE LARGE-N SAMPLING MANIFEST NOW MIRROR PRODUCER SEMANTICS; FAST-LANE FIXTURE-CONTRACT FALSIFIERS AND REAL-WASM ROW-COUNT THRESHOLD, EMPTY-PROFILE AND CLUSTERED-RELATION PINS ANCHOR THE SEAM TO THE LIVE KERNEL; TESTS ONLY, NO PRODUCTION NUMERICS/ABI CHANGE; Q2/Q3/Q6 REMAIN OPEN); TEC2 TOPOLOGY-ABSENCE EPISTEMIC HONESTY SLICE LANDED 2026-09-26 (THE CANONICAL SIGNATURE NO LONGER RECORDS THE ABSENCE OF A TOPOLOGY EVIDENCE ITEM AS A `derived` CLASSIFICATION — `topologicalStructure.topology` ABSENCE IS NOW `unknown`, MATCHING THE hasCycles SIBLING; THE TABULAR COMPATIBILITY VALUE, ITS DECISION TREATMENT AND THE PRESENCE BRANCH ARE UNCHANGED; SEE THE DATED CLOSURE RECORD IN THE TEC2 INVENTORY; Q2/Q3/Q6 REMAIN OPEN); TEC2 OPEN FOR INVENTORY-CONFIRMED RESIDUALS  \
**Methodological authority:** `docs/STATISTICAL_FOUNDATIONS.md`  \
**Scientific admissibility authority:** `docs/research/MONETA_EVIDENCE_PROTOCOL.md`

**RFC 0009 bounded format slice (2026-09-28):** accepted receipt-bearing V3 package and digest contract; package pack/unpack now validates the required evidence entry, byte commitment, closed envelope and declared analytical identity, while the V3 semantic digest commits the complete envelope. Default session export remains V2, and production replay refused V3 wholesale at this date — superseded on 2026-09-29 by `7988fa8f` ("load governed V3 packages instead of refusing them"), after which the loader accepts V3 and refuses only an archive that carries consumer `uses`. The earlier resolver-slice observation that no format carried receipts is historical; authoritative capture/export, reconstructed identity and complete digest verification, consumer-policy binding and MCR2+ enforcement remain open (the authority-owned consumer-policy binding *contract* landed concurrently in #842; its governed-loader **wiring** landed as slice 1 on 2026-10-01 — see the slice-1 record below — while its *enforcement*, which needs a consumer the shipped policy does not govern, does not). This slice establishes no governed replay success or TEC1 closure.

**RFC 0009 tranche 2 — governed capture/export slice (2026-09-28):** authoritative governed evidence capture/export landed under an explicit opt-in (`governedEvidence`), never by default. The capture entry point (named `captureGovernedEvidenceReceiptSnapshot` at this slice; the atlas-level method is `captureGovernedEvidenceReceipt` after the #834 port migration, where it no longer reads a module-global bridge) mints the closed v1 envelope only from a live Rust-issued `statisticsEvidenceReceiptBundle` with fail-closed live identity validation (dataset fingerprint and kernel version checked against the bundle before any bytes exist), `NemosyneSession` carries the exact envelope bytes verbatim as a validated base64 carrier through serialize/deserialize (malformed carriers are rejected at load, not silently dropped), and governed export emits a V3 package whose manifest commits the receipt bytes (`evidenceReceiptDigest`), declares the bundle's analytical identity and composes the `sha256-canonical-investigation-v3` digest over the complete envelope; default export remains V2, and production replay still refused V3 wholesale at this date (superseded 2026-09-29 by `7988fa8f`: V3 is now loaded, and only an archive carrying consumer `uses` is refused). Kernel-version overrides, carrier/state dataset drift and tampered receipt bytes fail closed with typed refusals. Not landed at this date: consumer-policy interpretation of the carried envelope's `uses` (the five-step seam's fifth step; steps one to four landed in `7988fa8f` on 2026-09-29), consumer-policy identity binding and MCR2+ evidence-reference enforcement — no governed replay success or TEC1 closure is claimed by this slice. (**Partly superseded 2026-10-01 by slice 1 — see the slice-1 record below: the interpretation is now policy-derived rather than a hard-coded refusal, while the binding it would enforce still governs no consumer.**)

**RFC 0009 tranche 2 fix-forward — analytical authority-path closure (#834, merged in #843 at `main@f6cfc52c` 2026-09-30):** the 29 September audit found the governed capture/export slice was not authority-clean: `NemosyneSession` delegated live receipt acquisition to `AtlasCore.captureGovernedEvidenceReceiptSnapshot()`, which reached `MonetaEvidenceAuthority`; that module imports module-global `datasetFingerprint`, `kernelVersion` and `statisticsEvidenceReceiptBundle` from `RuntimeBridge`, so in Worker-backed production it could observe a different WASM instance/handle from the injected analytical execution authority. Items (1)–(6) of the required repair are implemented: (1) acquisition routes through `AnalyticalExecutionPort` for both inline and Worker execution; (2) `MonetaEvidenceAuthority` operates on an injected narrow kernel contract; (3) fresh acquisition is asynchronous and performed from `exportPortablePackage()`; (4) ordinary synchronous `serialize()` is a pure carrier snapshot that acquires nothing and reaches no kernel, port or module global — it also now *omits* a carrier that no longer describes the dataset the snapshot commits, since a capture is adopted only for the state that validated it and the dataset can move on afterwards, and a snapshot pairing evidence for dataset A with the identity of dataset B would corrupt the artifact the tranche-3 loader will read; (5) a live governed export fails closed when it cannot acquire evidence from the current injected authority, while detached persisted re-export is allowed only from a previously Rust-issued carrier that passes strict identity/envelope validation; (6) V1/V2 compatibility, V3 envelope/digest semantics and Rust/WASM sole analytical authority are preserved. Routing governed capture through the Worker port also required that port's recycle accounting to know about governed captures, so `WorkerAnalyticalPort` now counts `_pendingGovernedCaptures` in `outstandingCount`/`allOutstandingStale`; that has two effects, and neither is the evidence outcome. An in-flight (non-stale) governed capture now *blocks* a recycle that previously could have terminated the worker underneath it, and a worker whose only outstanding work is a *stale* governed capture is now recycled, where before it was never recycled at all because such captures did not count toward the condition. The stale capture resolves `null` (refusal) either way, so no superseded generation's bytes can be returned; the behaviour is pinned by `tests/tec1-governed-capture-ports.test.ts` "recycles a Worker when the only outstanding work is a stale governed capture". **This reverses behaviour that had merged to `main`**: the optional `captureGovernedEvidenceReceiptSync` port member added in #838 is removed, because item (4) already mandated the pure-snapshot `serialize()` and the sync path let an inline session mint evidence at save time. **Evidence at this head:** injected-port-only acquisition, absent/unavailable/stale-generation and stale-fingerprint refusals, foreign-identity refusal, port swap/replacement revoking authority, default export remaining V2, and the refused-capture-not-remembered ordering are pinned in `tests/tec1-governed-capture-authority-wasm.test.ts` and `tests/tec1-governed-export-wasm.test.ts`; Worker-owned capture is pinned by `tests/tec1-governed-capture-worker-runtime.test.ts`, which runs the production `analytical.worker.ts` in a separate Node worker thread with its own WASM instance and handle index space (falsified by modelling the pre-fix main-realm read, which yields the caller's fingerprint) and asserts the transmitted capture request carries only analytical identity, never a caller handle index; and the static guard is five ast-grep rule files covering the static route classes the audit enumerated into a module-global analytical producer — named import (keyed on the producer name in every layer, and on the barrel source in the session layer), re-export specifier, star re-export, namespace import, producer *read* (member access, computed subscript and property string literal) and dynamic `import()` — over narrowed ignore lists — two directory exemptions (`src/wasm/**/*.ts`, in the namespace and dynamic rules) and seven entries naming six specific files whose runtime is already their own authority (the bridge and its dataset-handle bridge, the analytical Worker, the runtime owner, the authority helper and the inline port), with the session rule exempting nothing — and keyed on the source alternation ``/wasm((/\.)*/)+(RuntimeBridge|index)\b|/wasm[/.]*['"`]$``, which matches the bridge and the production barrel `src/wasm/index.ts` in the file spelling, in the bare-directory spelling (`…/wasm`, `…/wasm/`, `…/wasm/.`) that `moduleResolution: "bundler"` resolves to the same barrel, and in the separator variants a resolver normalizes to it (`…/wasm//index.ts`, `…/wasm/./index.ts`), so a specifier that targets the barrel by naming the `wasm` directory cannot take it whole in any of those spellings — namespace import, star re-export or dynamic `import()`, the last including a partially interpolated template, which cannot be decided statically and is therefore refused — from any layer outside the runtime itself (`src/wasm/**/*.ts` is exempt in the namespace and dynamic rules, because a module inside the runtime taking its own barrel is not a boundary crossing), and cannot be reached by name from the session layer. The leading `/` anchors the `wasm` segment, keeping a sibling directory that merely contains it (`'../xwasm/index.ts'`, `'../data-wasm/index.ts'`) out of the ban, and the directory form needs its own end-anchored alternative because `\b` cannot express it without over-matching every other module under `wasm/` (`'../wasm/TypedColumnsCodec.ts'`, pinned as a valid form). Adversarial review reproduced, across four passes, four generations of gaps this guard had left open — four routes through the barrel while the rules keyed on the literal `RuntimeBridge` alone (session-layer named import, session-layer star re-export, atlas-layer star re-export, namespace import); then the bare-directory spelling, the dynamic `import()` of the barrel and its template-literal form; then the separator variants `…/wasm/`, `…/wasm/.`, `…/wasm//index.ts` and `…/wasm/./index.ts`, which no rule family matched; and then the partially interpolated template specifier, which every rule family missed because each branch was anchored on a form that terminates in a quote. Two of those passes also produced over-blocks (the unanchored alternation matched `'../xwasm/index.ts'` and `'../data-wasm/index.ts'`). All are now decided the intended way by a real `ast-grep scan` over a probe tree mirroring the `src/` layout, and the same probes scanned against the pre-change rule set decide them the other way, which is what makes the change load-bearing rather than an incidental rewrite; the widened rules produce zero findings across the real `src/` tree, so no existing form is newly banned. The limits must be stated rather than assumed, and this list is illustrative rather than an exhaustive census: the guard's four cross-layer rules parse `src/**/*.ts` and the session rule `src/session/**/*.ts`, so a `.tsx`, `.mts` or `.mjs` file under `src/` is never opened by any of them and the check is not a proof against every transitive indirection; it does not enforce the *named* form of a non-producer bridge binding (`kernelVersion`, `datasetFingerprint`) imported from the barrel outside the session layer — that route reaches identity reads rather than the evidence producer, and the sanctioned form there remains the injected port, so closing it is left as a separate policy decision rather than assumed here; it matches specifier spellings rather than normalizing paths, so interior traversal (`'../../wasm/x/../index.ts'`, which resolves to the barrel) is not caught; it cannot key on a destructuring read of the producer (`const { statisticsEvidenceReceiptBundle } = ns`), because the same pattern is the *required* form when `ns` is the injected kernel — the guard is import-level for exactly that reason, so the read form is a stated residual rather than an oversight; a fully computed specifier (`await import(specifierVar)`) carries no literal for any static rule to match, and even a literal specifier is only matched when it sits inside the `import()` call itself, so acquisition that never calls `import()` (`require('…/wasm/index.ts')`), acquisition that hands the literal to the bundler (`import.meta.glob('…/wasm/index.ts')`) and acquisition that computes the specifier from it (`new URL('…/wasm/index.ts', import.meta.url)` and then `import(u.href)`) are all out of reach; and the producer-read rule matches the name as a member access, a computed subscript or a property string literal, so a *template-literal* property name (`Reflect.get(ns, \`statisticsEvidenceReceiptBundle\`)`) is not among the forms it bans; and forms are over-blocked rather than routed — some deliberately, because erring closed is the cheaper error (a type-only import or re-export of the barrel in the session layer, a type-only namespace import of it in any layer outside the runtime itself, a `/wasm/`-prefixed template specifier that interpolates, which could resolve to the barrel, and any string literal containing the producer name as a whole word, and any property name that merely *contains* it as a substring (the producer-read rule's member and subscript branches are unanchored), both of which it bans in every file it parses except the three it ignores), and some incidentally, where the end-anchored branch also matches a tail of dots or separators alone (`'../wasm.'`, `'../wasm/..'`), which no resolver resolves at all. Separately, this head's suite results were observed on the local Windows toolchain with pre-existing environment failures of two known classes — POSIX mode-0700 assertions that NTFS cannot satisfy, and path-separator assertions — both of which reproduce on this machine and neither of which is in the changed path; CI (`ubuntu-latest`) is the authority for them. **Not implemented:** enforcement of consumer-policy identity binding — the governed-loader *wiring* landed as slice 1 on 2026-10-01, but the shipped policy governs no consumer, so nothing is enforced yet (see the slice-1 record below; #842 landed the authority-owned binding *contract* concurrently, as a data-only slice with no loader wiring); MCR2+ evidence-reference enforcement; the *fifth* step of replay consumption of the carried envelope (`7988fa8f`, 2026-09-29, landed steps one to four — dispatch, carrier verification, identity against reconstructed state and digest commitment — so what remains open is consumer-policy interpretation of `uses`, now policy-derived but governing nothing, not the loader failing to read the envelope); and TEC1 closure.

**RFC 0009 tranche 3 — declaration (2026-09-30, merged in #847 at `main@48da175c`, on a base of #846's `main@0eee3788`):** DECLARED OPEN against `main@19daddea`, scoped to governed-loader consumer-policy binding wiring and enforcement. DatasetEvidence alias migration, production consumption qualification and MCR2+ evidence-reference enforcement are later, separately-sequenced slices of this tranche and are not bundled into the wiring slice. **Verified starting state:** the governed loader already consumes the carried envelope in four steps — format/algorithm dispatch (`src/session/InvestigationReplayRunner.ts:442`), byte-digest and bundle-identity verification of the carrier (`:494`), identity compared against the *reconstructed* replay state (`:661`, `DATASET_MISMATCH`/`KERNEL_MISMATCH`) and commitment of the envelope bytes into the V3 investigation digest (`:939`) — so the tranche-2 records' "replay consumption of the carried envelope" denotes the seam's *fifth* step in RFC 0009's model — consumer-policy interpretation of `uses` — rather than a loader that fails to read the envelope. In code that step is the refusal at `:532-548`, which sits between step 2 and step 3: an envelope carrying any `uses` is refused with the typed *unavailable* verdict `uses-not-governable-by-this-build` (**superseded 2026-10-01 by slice 1 — see the slice-1 record below: that literal no longer appears under `src/`, and the refusal is now derived from `bindConsumerUsesV1` against an authority-owned policy and reports `CONSUMER_NOT_GOVERNED`**), because no consumer registry exists in this build and accepting a use would let the archive select its own governing profile; an empty-`uses` V3 archive therefore replays to success, pinned by `tests/tec1-f1-governed-replay.test.ts:266-289` and reachable in production from `src/vr/World.ts:1021-1027`. The #842 binding *contract* (`src/data/evidence/ConsumerPolicy.ts`) is data-only: it has no importer under `src/`, it is absent from the evidence barrel, and no authority-owned `requiredConsumers` map exists anywhere in `src/` — supplying one from policy rather than from the archive is the substance of the wiring slice, and is why it is not a one-line change. (**Superseded 2026-10-01 by slice 1 — see the slice-1 record below: the registry now supplies it, and both `ConsumerPolicy.ts` and `ConsumerPolicyRegistry.ts` are exported from `src/data/evidence/index.ts`, which reverses the barrel and importer halves of this verified starting state; the map still exists nowhere outside the registry.**) The replay authority's falsifiers (`tests/tec1-governed-replay-resolution.test.ts`) are not named in `tests/config/test-groups.ts`, but the integration lane sets no `include` and does not exclude them, so its default glob collects them and they do run in CI, where the built WASM package they need is supplied. **Wiring-slice exit:** the hard-coded refusal is replaced by `bindConsumerUsesV1` against an authority-owned policy, with the `enforcement: 'none'` attestation widened through `src/app/investigation/replayAttestationText.ts` (**partly delivered by slice 1 on 2026-10-01: the refusal is now policy-derived, but the attestation was deliberately *not* widened and the shipped policy governs no consumer — see the slice-1 record below; what this exit line predicts for the *whole* tranche still stands**); the expectations that must then change include, but are not limited to, the refusal pins at `tests/tec1-f1-governed-replay.test.ts:182-187` and `:200-209` and at `tests/tec1-v3-package.test.ts:178-183`, together with the surfaces that word the refusal's meaning — `tests/tec1-f1-continuity-attestation.test.ts:93-117`, which pins its rendered message (**not required by slice 1 — that surface's claim stayed true, and see the slice-1 record below for why that was a consequence of getting the refusal string right rather than luck**), and `tests/tec1-f1-replay-attestation-text.test.ts:22-27`, which enumerates its refusal codes. Deliberately not listed are the two `expect(result.success).toBe(false)` lines at `tests/tec1-f1-governed-replay.test.ts:181` and `tests/tec1-v3-package.test.ts:169`: each fixture fails closed for a reason independent of whether a use binds — the first passes no identity and so falls to the unreproducible default, making step 3 refuse too (its own comment at `:201-202`) — so neither is assumed to change, and both must be re-derived when the wiring lands rather than presumed green (**the wiring landed as slice 1 on 2026-10-01 and both lines stood: slice 1's diff touches the refusal-code expectations at `:186`/`:207` of the first file and `:182` of the second — as-of-declaration numbering, which this paragraph uses throughout, so those two sites are `:187`/`:208` at this head — and leaves both `expect(result.success).toBe(false)` assertions outside any changed hunk — the outcome this sentence predicted rather than a case it missed; see the slice-1 record below**). What stays green: the empty-`uses` happy path (`tests/tec1-f1-governed-replay.test.ts:266-289`), the whole `tec1-consumer-policy` contract, and the bridge-untouched assertion (`tests/tec1-v3-package.test.ts:186-190`); a widened `enforcement` union must keep its `'none'` member, because the empty-`uses` path pins that literal. No TEC1 closure is claimed, and these items are not bundled into one PR.

**RFC 0009 tranche 3 slice 1 — consumer-policy wiring (2026-10-01, from `main@48da175c`; merged as #848 at `main@e0fcaf7f`):** the governed loader's fifth-step refusal stops being a claim about what this build can *read* and becomes a decision made by an authority-owned policy. `src/data/evidence/ConsumerPolicyRegistry.ts` (new) is that authority: a module-private `Map` from each governed consumer to the exact requirement profile its owning policy demands, reachable only through `governedConsumerPolicyV1()`, which hands out a **snapshot**. `Object.freeze` does not make a `Map` immutable — its entries live in internal slots — and a `ReadonlyMap` annotation is erased at runtime, so "no module outside the registry can add an entry" is made a runtime property, falsified in `tests/tec1-consumer-policy-wiring.test.ts`, rather than left as a typing convention. At the same site, still between step 2 and step 3 and still before any bridge access, `src/session/InvestigationReplayRunner.ts` now calls `bindConsumerUsesV1({envelope, requiredConsumers: governedConsumerPolicyV1()})` and refuses on the first binding that is not `BOUND` **or** is `BOUND` with `resolution.status !== 'RESOLVED'`; binding is identity agreement, so accepting a bound-but-unresolved use would open an archive whose required evidence does not actually resolve. The single literal `uses-not-governable-by-this-build` is replaced by two typed codes — `CONSUMER_NOT_GOVERNED` for the two ways the archive and the policy can disagree about *which* consumers are governed (`UNKNOWN_CONSUMER`, `MISSING_USE`) and `CONSUMER_POLICY_REFUSED` for the two ways a *governed* consumer's recorded profile can fail under the policy (`PROFILE_MISMATCH`, `UNKNOWN_REQUIREMENT_PROFILE`), plus a bound-but-unresolved use — classified through an exhaustive `Record` over the binder's refusal statuses, so a status added to the binder is a compile error at the classification rather than a silently reused code. The #842 binding contract and the new registry are both now exported from `src/data/evidence/index.ts`, which reverses the declaration's verified starting state that `ConsumerPolicy.ts` had no importer under `src/`; that was the substance of this slice, not a side effect. **What the shipped policy governs: nothing.** The registry ships empty, and that is a statement rather than a placeholder. A conforming use can only be authored by a producer that knows which consumer consumes which receipt under which profile, and this build has none: governed export still refuses to write any non-empty `uses` (`src/session/NemosyneSession.ts:311-317`) and no Rust-issued consumer identity exists in the kernel. `bindConsumerUsesV1` reports `MISSING_USE` for every governed consumer an envelope fails to name, so the first entry would refuse every package this build itself exports, whose only mintable envelope shape is the empty `uses` array — governing a consumer *before* the producer exists would remove capability rather than add it, and entries therefore arrive with the slice that also gives a producer the ability to mint conforming uses, which owes the production-path falsifier proving binding is reachable. **Consequence for the attestation, stated rather than deferred:** `enforcement` was not widened and stays single-valued at `'none'`, because no consumer policy was applied to any accepted run; the declaration's "widened" is corrected in place above. The two facts are coupled in the falsifiers rather than in a comment — `tests/tec1-consumer-policy-wiring.test.ts` asserts the policy governs nothing, and the same assertion sits beside the `enforcement: 'none'` literal it keeps honest in the happy path at `tests/tec1-f1-governed-replay.test.ts`, so the first entry to land fails those lines and sends its author to the union that has to widen with it. **This slice re-types a refusal; it does not add a capability, and it is deliberately shaped that way.** While the policy governs nothing, `uses.length > 0` and "no binding resolves" are extensionally identical for every *archive* this build can mint or read — but not for every *policy*, and an earlier draft of this record wrongly concluded from the first that no behavioural falsifier was possible. The difference is observable through the registry, and `tests/tec1-consumer-policy-loader-decision.test.ts` observes it: one byte-identical empty-`uses` payload is replayed twice and refuses with a reconstruction mismatch under the shipped empty policy but with `CONSUMER_NOT_GOVERNED` once the policy governs a consumer the archive never names. The branch this replaced refused on `uses.length > 0`, which is false for that archive, so it could not have produced the second outcome under any policy — the wiring is falsifiable after all, by substituting the policy rather than the archive. That substitution is also the only coverage the classification map has, since it reaches the four binder outcomes the shipped registry cannot, and its power was checked the other way: a loader mutated to decide from the envelope's shape instead of the policy fails exactly the two policy-dependent cases and passes the rest. What is asserted *without* substitution is the registry's emptiness, that it hands out a snapshot, and a source guard that the loader consults `governedConsumerPolicyV1` and no longer carries the removed literal — that guard being the weakest kind, stated as such in the test, whose remaining job is catching the seam reverted outright rather than a loader that imports the module and ignores it. **Falsifier changes:** `tests/tec1-consumer-policy-wiring.test.ts` (new) holds the shipped registry's properties and the source guard, and `tests/tec1-consumer-policy-loader-decision.test.ts` (new) the substituted-policy falsifiers, both registered in `FAST_NODE_TESTS`; the refusal pins at `tests/tec1-f1-governed-replay.test.ts` and `tests/tec1-v3-package.test.ts` are re-typed to `CONSUMER_NOT_GOVERNED`; `tests/tec1-f1-replay-attestation-text.test.ts` enumerates the two new codes and its framing allowlist was widened to follow their wording — what the pair reports is a limit or disagreement of *this build's policy*, not a disagreement with the replay the archive was checked against. `tests/tec1-f1-continuity-attestation.test.ts` still did **not** have to change, contrary to the declaration listing it among the surfaces that must, but for a narrower reason than an earlier draft of this record gave: its fixture refuses as `CONSUMER_NOT_GOVERNED`, whose phrasing does still carry "cannot resolve", so that surface survived because its claim stayed true rather than because no claim moved. Each refusal string was re-derived so that it is true for *every* status it is mapped from, rather than worded to satisfy a pinned phrase: `CONSUMER_NOT_GOVERNED`'s first draft read "the package requires consumer uses this build's governing policy cannot resolve", which is true of `UNKNOWN_CONSUMER` but false of `MISSING_USE`, where the policy is what requires the use and the package is what omits it — both of those map there, so the claim now covers the disagreement over *which* consumers are governed in either direction, and the continuity surface's pinned phrase survived as a consequence of getting the claim right rather than as the reason for it. `CONSUMER_POLICY_REFUSED` failed the same test later and only under adversarial review: "its evidence cannot resolve under the profile that policy requires" is false for `PROFILE_MISMATCH`, which the binder decides on profile identity without evaluating the receipt at all, so the string would have sent an analyst to amend evidence when the profile id is what disagrees. It now names the disagreement rather than one of its causes, and the framing allowlist in `tests/tec1-f1-replay-attestation-text.test.ts` was widened deliberately to follow that wording — the one place in this slice where a test expectation moved for the wording rather than the reverse, with the reason written in the test. Four comment sites this slice falsified were also corrected in place, across three files: `ConsumerPolicy.ts`'s "wiring … is a later production tranche", its "later: the governed loader", `PersistedEvidenceReceipts.ts`'s "the future governed loader", and `NemosyneSession.ts`'s "until consumer-policy binding lands" — which now states the surviving reason, that no *producer* can mint a conforming use, rather than one that has since been met. Stay-green re-verified at this head rather than assumed: the empty-`uses` happy path, the bridge-untouched assertion with `commandsReplayed: 0` and `discrepancies: []`, and the whole `tec1-consumer-policy` contract. **Local toolchain note, stated rather than glossed:** the changed suites were run as `npm run test:fast -- tests/tec1` (9 files, 107 tests, green) with `typecheck`, `lint` (0 errors) and `docs:check` green too. The *full* fast lane at this head is **not** green locally — it reports 31 failures in 10 files — and all of them are the two pre-existing environment classes on this Windows host: POSIX mode-0700 assertions NTFS cannot satisfy, thrown from `src/governance-service/*` constructors before any test body runs, and `split('/')` assertions applied to `join`-built paths (`tests/quest-loadtest-sink.test.ts`). Those suites import none of the modules this slice changed, and CI on `ubuntu-latest` is the authority for them. **Merged and verified (1 October 2026):** #848 landed at `main@e0fcaf7f`, its exact head `4f2115cc` carrying an adversarial-review PASS against that head, with no failing CI job at that head — the approval gate, CodeQL, the Node 24 lane, all three Vitest coverage shards, the Rust kernel, the production build and the Chromium production smoke were all green, and nothing at that head failed or was cancelled: `gh pr checks` reports 23 checks with zero failures — 20 passing and 3 skipped, the skipped ones being the two `NEUTRAL` Pages/RD deployment-preview checks and the wiki publish that is skipped on pull requests. The GraphQL `statusCheckRollup` shows the Netlify deploy-preview with a null `conclusion`, and that null is a union-type artifact rather than an unfinished check: it is a `StatusContext`, whose `state` is `SUCCESS`, which is why `gh pr checks` counts it among the 20 passing. So the local failures above are settled by `ubuntu-latest` rather than by this machine.

**RFC 0009 tranche 3 slice 2 — kernel-issued consumer identity + governed use minting (2026-10-02, from `main@e0fcaf7f`; merged as #866 at `main@bc8956c8`):** the governed consumer slice 1 could only refuse is now real, and the producer that authors conforming `uses` exists. The Rust kernel mints the consumer identity — `DESCRIPTIVE_STATISTICS_CONSUMER_ID` (`"nemosyne:consumer/descriptive-statistics/v1"`, `wasm/src/data/governed_consumer.rs`) is the single source of it — and `GovernedConsumerAttestationV1::for_receipt_bundle` attests, for a bundle the kernel itself produced, which governed consumers consume its receipts and under which ids, refusing a hand-supplied identity by construction: the mint takes no caller-supplied identity, and its identity fields are copied from the bundle. `validate_for_bundle` runs on every mint, so an attestation disagreeing with its bundle in schema, dataset fingerprint, kernel version or receipt coverage can only exist as a deliberately hand-constructed value, never as a returned one. The attestation crosses to TypeScript through the analytical-execution-port readout as raw bytes (`statisticsGovernedConsumers(handle)`, two-call string-out ABI, provenance-recorded), and `GovernedEvidenceCaptureV1.governedConsumers` is now required — capture refuses when the kernel cannot attest — so composition (`composeGovernedEvidenceReceiptSnapshot`) receives no kernel attestation from any route other than the injected port. Composition parses the attestation, refuses identity drift against the bundle, and mints one `PersistedEvidenceUseV1` per kernel-attested receipt under the profile the authority requires. The TypeScript side contributes the policy, never an identity: `ConsumerPolicyRegistry.ts` ships its first entry (the descriptive-statistics consumer → `DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1`, that is `descriptive-summary/v1`: no epistemic axes required, violated assumptions refused, unresolved-but-not-testable tolerated — the profile identity itself stays owned by the closed profile registry, and the kernel attests only *who consumes what*, never *what quality they require*), and no TypeScript site derives a consumer id from column names or aliases — the RFC 0009 ban — with the TS constant a parser-side pin welded to the Rust one by the wasm integration suite. **Owner decisions (2026-10-02):** the first governed consumer is descriptive statistics, and the persisted format stays archive-scoped — one-`receiptId` `PersistedEvidenceUseV1` per use record, multiple use records, no envelope shape change; the v1 envelope, `EvidenceReceiptBundleV1` and `PersistedEvidenceUseV1` shapes are byte-identical, and the kernel attestation rides only through the ephemeral capture readout, never into persisted bytes. **The slice-1 export refusal lifts together with the producer, in the same slice by design:** `NemosyneSession._validateGovernedUseRecords` no longer refuses all non-empty `uses` — it runs the loader's own binder (`bindConsumerUsesV1` against `governedConsumerPolicyV1()`) over the bytes about to be committed and refuses anything that would fail to bind or resolve on replay, so there is no window in which this build writes a use its own loader would refuse; the validator's predicate mirrors the loader's exactly (a binding must be `BOUND` *and* resolve, and every governed consumer must be named), with the pinned message substrings preserved. **Behaviour change, stated as a pre-contract finding (owner-sanctioned):** with the registry entry landed, a governed V3 package with an empty `uses` — the shape *every* governed package earlier builds exported — now replays as `CONSUMER_NOT_GOVERNED` rather than to success, because emptiness cannot bypass policy once a consumer is governed (the same substituted-policy logic slice 1 pinned in `tests/tec1-f1-governed-replay.test.ts`); this is the first time the loader's refusal is reachable from bytes this build itself used to mint. The slice-1 record's empty-`uses` acceptance therefore survives for **V1/V2 and non-enveloped paths only**; older governed V3 archives must be re-exported. **Replay `enforcement` widens to `'consumer-policy'`, registry-derived**, replacing slice 1's deliberately-unwidened `'none'`: a consumer policy was actually applied to an accepted replay, so the attestation can say so; the union keeps its `'none'` member for the paths where no policy was applied. **Known duplicate compute, recorded rather than hidden:** the kernel attestation is minted fresh on every governed capture, and composition computes the bundle twice per capture — `wasm/src/prepared_results.rs` is a two-call-ABI staging buffer, not a memo (every `prepare` reserves a fresh token and re-invokes the closure), so a review-suggested reuse route was rejected with that evidence and recorded for a separate kernel change (**landed the same day as #871 — see the follow-up record below**). **Evidence at this head:** the production-path falsifier `tests/tec1-governed-use-minting-live.test.ts` exports a governed package with minted uses through the real `exportPortableSnapshot` entry and replays it through the real loader with `enforcement: 'consumer-policy'` (wasm lane); `tests/tec1-mutated-policy-refusal.test.ts` refuses identical bytes under mutated registries; `tests/tec1-governed-use-minting.test.ts` holds the minting-chain refusals, including a *bound-but-unresolved* export refusal through the real session export entry (a violated-assumption receipt under `descriptive-summary/v1`, the only receipt-bound-but-unresolved case that profile permits); `tests/tec1-f1-replay-attestation-text.test.ts` widens to the new enforcement value (and its framing comment now states that the string it pins is the only place that fact is said); the Rust kernel unit tests (minting, wire shape, empty bundle attests nothing, identity/coverage-drift refusals including the dangling-receipt and duplicate cases, coverage independent of receipt quality) run in the CI cargo lane; and the facade-export pin in `tests/runtime-bridge-module-boundaries.test.ts` carries `statisticsGovernedConsumers`. Local: `npm run test:fast -- tests/tec1` 126/126 green (11 files) and `typecheck` green; the wasm-lane positives are CI-verifiable only on this host, where the local wasm lane fails only against the stale prebuilt `wasm/pkg` that lacks the new export (per the standing Windows-host record). **Merged and verified (2 October 2026):** #866 landed at `main@bc8956c8`, its exact head `169ebfede536596b0a74c66dc779976b62226fd3` carrying an adversarial-review PASS against that head (two distinct passes — the first over d82d252e returned PASS-WITH-CONDITIONS with all conditions fixed in-branch, the second a delta re-review at the exact head returning PASS with no blockers across six checks) and every CI job green at that head, including the CI-only Rust kernel lane (whose two initially failing unit tests were fixture-provenance faults, fixed in-branch rather than expectation-weakened). This slice proves binding is *reachable* for one governed consumer; it is not a TEC1-closure claim.

**RFC 0009 tranche 3 slice 2 follow-up — single-compute governed capture export (2026-10-02, from `main@bc8956c8`; merged as #871 at `main@44b98861`):** the duplicate compute the slice-2 record above closes its state on is eliminated at the kernel, and the two-call composition it leaves behind is now the explicit fallback rather than the live path. The new kernel export `data_statistics_evidence_governed_capture` (`wasm/src/lib.rs`) runs one `with_dataset` closure that computes the statistics receipt bundle once via `compute_statistics_evidence_receipt_bundle` and mints `GovernedConsumerAttestationV1::for_receipt_bundle` from that same in-kernel bundle value inside the same closure, emitting `{"receipts": <bundle>, "governedConsumers": <attestation>}` over the two-call string-out ABI with one provenance record — so the attestation is still minted only by the kernel from a bundle the kernel itself produced, and a mint from caller-supplied bytes is impossible by construction rather than by discipline. The bridge method `statisticsGovernedCapture(handle)` (`src/wasm/runtime/DatasetHandleBridge.ts`) splits that combined payload back into the capture object's two existing fields `{ rawBundle, governedConsumers }`, so composition and every downstream consumer receive a shape-identical object: no persisted bytes, no digest, no `uses` minting and no slice-2 falsifier semantics change. Both production acquisition paths (`InlineAnalyticalPort`, `analytical.worker.ts`) prefer the combined read and fall back to the preserved, byte-identical two-call path (`data_prepare_statistics_evidence_receipts` + `data_governed_consumers`) only on an explicit `unsupported` capability marker or method absence — never on kernel refusal, which is `null` and refuses outright without consulting the two-call reads, in both ports. That fallback enters exactly the cases slice 2 needed it for — older wasm builds and narrow kernel contracts — and it was the review's central finding that the first draft could not do so: a slice-2-era wasm pkg paired with this JS build had export absence collapse into "kernel refused" (`null`), so the combined-read preference declined captures slice 2 could produce; that is closed by a three-outcome kernel-contract type `StatisticsGovernedCaptureResult | null | 'unsupported'` in `AnalyticalKernelPort.ts`, on the marker — and only the marker — the fallback is gated. Counters were given exact semantics during review: the receipts-prepare counter (op 12) moves once per prepare and not at all on a governed capture; the new op 13, `STATISTICS_EVIDENCE_RECEIPT_BUNDLE_COMPUTATIONS`, is incremented inside `compute_statistics_evidence_receipt_bundle` itself for every caller (initially it counted closure entries, which could hide a second in-closure compute — the falsifier was made load-bearing instead of superficially green). No caching or memoisation: the prepared-results registry is a staging buffer, not a memo (`readPreparedResult` destroys the token after reading), and an attestation keyed on handle or fingerprint would attest stale state for a mutated or superseded dataset — the kernel stays stateless per call. **Falsifiers:** Rust counter tests assert per capture `delta(op 13) == 1` and `delta(op 12) == 0` while a characterised two-call composition moves op 13 by 2, and a repeated capture moves it by 1 again — so caching, memoisation, a second in-closure compute and a two-call regression each yield a distinct falsified delta; every counter-moving test (lib.rs, `governed_consumer.rs`, `statistics_evidence.rs`) holds one shared test-only `LazyLock<Mutex<()>>` guard because cargo runs them in parallel threads and the delta windows would otherwise race; TypeScript falsifiers pin that a kernel offering the combined read is authoritative for both halves with the two-call reads never called, that the marker still captures via the two-call bytes, that `null` refuses with the two-call reads never called (no mixing), that the facade pin carries `statisticsGovernedCapture`, and a new in-process test drives the real production worker module for all three outcomes (combined read counts 0/2/0) in the fast lane. **Adversarial review trail:** pre-implementation contract, then three passes by one distinct reviewer against it — the first over `4747541c` returned PASS WITH CONDITIONS (F1 counted closure entries, F2 the unreachable fallback, F3 the untested worker branch), the second over the fixes `7654b211` confirmed F1–F3 closed and raised one new condition (C1: the cargo counter assertions could flake under parallel test threads), and the third over `5f38a2cd652b7f81c36fd647da374bcfa8f30da1` confirmed C1 closed and returned PASS with high confidence; every CI job green at that head, merged as #871 at `main@44b98861`. Local verification: `typecheck` green, `npm run test:fast -- tests/tec1` 132/132 green (12 files), `architecture:ast`/`boundaries` green, `lint` 0 errors; the Rust cargo lane cannot run on this Windows host (standing record) and its positives are CI-verifiable only. Residuals recorded rather than hidden: an out-of-contract `undefined` from a combined read throws in the inline port and is caught to refusal in the worker — fail-closed either way, mock-only hazard. No persisted-format change, no owner decisions required, and no TEC1-closure claim is made.

**Still open in this tranche:** DatasetEvidence alias migration, production consumption qualification, MCR2+ evidence-reference enforcement, and TEC1 closure. The registry entry, the Rust-issued identity, the minting producer and the `enforcement` widening landed as slice 2 (#866) on 2026-10-02; TEC1 closure is not claimed by it.

**Current forward TEC order:** the #834 fix-forward to close RFC 0009 tranche-2 analytical authority routing is merged and verified (#843 at `main@f6cfc52c`; exact head `1924ee58` carried an adversarial-review PASS and every CI job green), so it no longer gates the next step — it remains one of the preconditions TEC1 closure requires, alongside the tranche-3 items still open below. Its CI evidence is not a repeat of the local result: `architecture:boundaries:test` cannot run on this Windows host, whereas `architecture:boundaries` and the ast-grep suite were both reproduced green here, so only the former adds evidence. That sequencing held only in intent: RFC 0009 tranche 3's authority-owned consumer-policy binding *contract* landed first, concurrently, as #842 — a data-only slice with no governed-loader wiring — while this fix-forward was in flight. With the #834 exact-head fix-forward merged and verified, RFC 0009 tranche 3 may bind semantic consumers to Rust-issued identities and authority-owned profile requirements, including explicit DatasetEvidence alias migration and production consumption qualification. Slice 1 of that tranche is now merged and verified (2026-10-01): #848 landed at `main@e0fcaf7f`, its exact head `4f2115cc` carrying an adversarial-review PASS against that head and every CI job green, so the governed loader's refusal is derived from `bindConsumerUsesV1` against an authority-owned registry — one that governed no consumer then, which is why binding a *real* consumer still waited on the Rust-issued identity and a producer able to mint conforming uses. Slice 2 of that tranche is now merged and verified (2026-10-02): #866 landed at `main@bc8956c8`, its exact head `169ebfede536596b0a74c66dc779976b62226fd3` carrying an adversarial-review PASS against that head and every CI job green — the first governed consumer (descriptive statistics, `descriptive-summary/v1`) now binds end to end, so what remains of this tranche is the separately-sequenced rest: DatasetEvidence alias migration, production consumption qualification and MCR2+ evidence-reference enforcement, each its own slice rather than a remaining piece of slice 2. The slice-2 duplicate-compute residual was closed the same day by #871 at `main@44b98861` (single-compute governed capture export, adversarial-review PASS at the exact head — see the follow-up record above). Then complete bounded TEC2 migration debt (the two named deferrals — `ClusterProfile.density_variation` and `dependence.maxCorrelation` — are closed under their own contracts; of the remaining residuals Q6 is a closed verified negative, Q2 remains a parked product decision, and Q3's method-selection owner decisions are logged as a hand-off record in `docs/audits/TEC2_HEURISTIC_TERMINOLOGY_INVENTORY_2026-09-21.md` (2026-10-02) that a successor starts from — implementation waits on those decisions) under explicit contracts; then execute TEC3 production-path falsifier coverage from the audited gaps, including the metric-admissibility/calibration tranche below (TEC3-MA1 is the parallel-safe first item there). Do not bundle these into one PR, and do not claim TEC1 closure from V3 persistence, replay loading, renamed fields, fixture count or the mere existence of a benchmark metric.

P1-TEC does **not** create a second evidence architecture. It closes the one already established by Rust/WASM measurement semantics, analytical admission, `EvidenceClaim<T>`, DatasetEvidence, semantic embodiment and the Moneta evidence protocol. Its purpose is to prove that trustworthy evidence survives the full production path without being flattened into stronger-looking booleans, heuristic confidence labels or representation-side inference before learned/compositional Moneta consumes it.

The closure sequence is deliberately finite:

| Checkpoint | Required work | Exit |
| --- | --- | --- |
| **TEC0 — end-to-end evidence propagation audit** | Trace `MeasurementModelRecord -> AnalyticalGeometry -> EvidenceClaim<T> -> Rust/Worker transport -> DatasetEvidence -> DatasetEvidenceSignature -> SemanticEmbodimentGraph -> RepresentationGraph`. Inventory every evidence axis retained, transformed, summarized or lost, including assumptions, support, uncertainty, stability, sensitivity, limitations and provenance. | One exact-main propagation matrix exists; every lossy edge is classified as intentional compatibility, required migration or blocker. No missing field is silently interpreted as a favourable value. |
| **TEC1 — transport and identity closure** | Close blocker-grade losses across the Rust/WASM/TypeScript boundary. Preserve evidence identity and the independently governed epistemic axes required by downstream admissibility. Use references/receipts where copying the full claim would be inappropriate. Any material ABI/public-format change follows RFC/ADR governance. | Moneta and semantic embodiment can distinguish “not measured”, “unsupported”, “unstable”, “assumption unresolved” and “admissible evidence” without manufacturing analytical facts in TypeScript. Replay pins the same evidence identity or fails closed. |
| **TEC2 — heuristic/terminology migration debt** | Inventory the bootstrap fields already called out in `STATISTICAL_FOUNDATIONS.md` such as magnitude thresholds labelled significance, silhouette-derived “stability confidence”, heuristic periodicity/density scores and sample-count “confidence”. Rename, wrap or replace them without breaking serialized consumers silently. **Slice landed:** the six fields enumerated in the inventory (`docs/audits/TEC2_HEURISTIC_TERMINOLOGY_INVENTORY_2026-09-21.md`) are renamed in place at the Rust transport with no compatibility alias, and the boundary validator now rejects a retired name; that slice also deleted a live TypeScript recomputation of a pair count that held shadow analytical authority at a different threshold. **Density-variation slice landed (2026-09-25):** the behaviour-bearing `ClusterProfile.density_variation` two-valued proxy is removed from the Rust producer, the transport mirror, the canonical cluster evidence payload and the canonical signature reconstruction; the boundary validator rejects the retired key in live payloads; the optional `DatasetSignature.clusterStructure.densityVariation` field and fact path are retained for historical persisted signatures and future explicitly measured/derived density evidence, with the `FitnessModel` measured/derived epistemic gate unchanged (see the dated closure record in the inventory). The `dependence.maxCorrelation` epistemic label was closed by #815. **Evidence-scorer authority slice landed (2026-09-25):** the dormant TypeScript `EvidenceWeightedScorer` re-ranking reimplementation of the kernel's sample-count cost adjustment (divergent 20.0 scale, `(weight || 1.0)` zero-sample inversion) was deleted rather than harmonised, and the never-compiled `wasm/src/draco/` stale twin directory was removed; the sole Rust adjustment, its bridge alias and its fail-closed zero-sample semantics are pinned by unit, source-scan and real-WASM bridge falsifiers (see the dated closure record in the inventory). **Topology-absence epistemic honesty slice landed (2026-09-26):** the canonical `datasetEvidenceToSignature` no longer marks the absence of a topology evidence item as a `derived` classification — that absence (which conflates not-applicable and not-declared producer states) is now recorded as `unknown`, matching the `hasCycles` sibling, while the `TABULAR` compatibility value, its decision treatment and the evidence-present branch are unchanged (see the dated closure record in the TEC2 inventory). The inventory's persistence claims are corrected at the signature level (2026-09-23): the two deleted `DatasetSignature` keys (`dependence.significantPairsCount`, `spectralStructure.periodicityConfidence`) persist inside historical v2 `.nemosyne` representation decisions and are digest-bearing, so their verbatim-replay guarantees and the forward migration rule are governed by RFC 0008 (`docs/rfcs/0008-historical-dataset-signature-persistence.md`), pinned by `tests/rfc0008-historical-dataset-signature-replay.test.ts`. | Investigator- or Moneta-visible terminology is mathematically honest; compatibility aliases cannot promote heuristic scores into statistical claims. **Not yet met for TEC2 as a whole** — the landed slices cover the enumerated six, the `dependence.maxCorrelation` epistemic label, the `ClusterProfile.density_variation` proxy, the evidence-scorer authority residual, the Q4/Q5 fixture-fidelity residuals and the topology-absence epistemic mislabel; further inventory-confirmed residuals (Q2/Q3/Q6 and any newly inventoried ones) remain open. |
| **TEC3 — adversarial evidence fixtures, metric admissibility and method coverage** | Turn the existing statistical-foundations test strategy into production-path falsifiers: numeric identifiers, ordinal/metric misuse, compositional closure, circular wraparound, grouped/repeated observations, nonlinear dependence, Simpson-style reversals, null structure, missing/non-finite support, high-dimensional refusal/stability cases, **and calibration of every metric allowed to influence evidence admission, ranking, representation selection or model promotion**. Add new analytical method families only where a concrete representation/discovery requirement justifies them. | Each admitted evidence family has at least one positive, null/negative and invalid-domain/refusal fixture. Every decision-bearing metric has a declared target property, positive/negative controls and a reproducible calibration disposition, or is barred from promotion. “No structure detected” remains distinguishable from “insufficient information”, and an uncalibrated ruler cannot silently become evidence. |
| **TEC4 — Full-Moneta evidence handoff qualification** | Exercise a compact cross-family packet through the real production path into Moneta, semantic embodiment, persistence/replay and the representation boundary. Verify hard evidence/admissibility gates execute before utility/ranking and cannot be learned around, including proof that metrics lacking a valid TEC3 calibration disposition cannot affect a promoted decision. | PT9 learning, MCR2+ production promotion and any evolutionary production handoff may consume the evidence substrate only when the packet proves provenance continuity, honest abstention, metric-admissibility continuity and no shadow analytical authority. Otherwise the dependent promotion remains blocked on the failed evidence property. |


#### TEC3 metric-admissibility calibration tranche

**Motivation:** Miller et al., *Nature Biotechnology* (2026), [“Deep learning perturbation models can outperform baselines on calibrated metrics”](https://doi.org/10.1038/s41587-026-03307-w), demonstrate the failure mode this tranche is intended to prevent: a benchmark metric can be present, conventional and numerically stable while remaining too insensitive to distinguish an informative positive control from an uninformative negative control. Nemosyne adopts the **control-calibration principle**, not the paper's biological metric set or any universal DRF threshold.

**Governing rule:** before a metric may contribute to an admissibility decision, representation ranking, learned-model comparison or promotion gate, the system must possess evidence that the metric can discriminate the property it is being used to judge in the declared task/data regime. Metric presence is not metric admissibility.

| Slice | Parallelism / dependency | Required work | Exit |
| --- | --- | --- | --- |
| **TEC3-MA1 — metric/claim inventory** | **PARALLEL_SAFE / SPAWNABLE** once based on fresh `main`; analysis-only and test-fixture work may proceed while TEC1 finishes if it does not touch collision-sensitive authority surfaces. | Inventory every metric that can influence Moneta fitness, evidence admission, representation comparison, PT9 model comparison or later search promotion. For each metric record: target property/estimand, orientation, scale/domain assumptions, known confounds, aggregation scope, downstream decision consumers, version/implementation authority and whether it is descriptive-only or decision-bearing. Explicitly identify metrics that currently lack a defensible calibration experiment. | A versioned inventory maps every decision-bearing metric to a claim and governing consumer. No metric is treated as self-justifying because it is conventional, normalized or already implemented. **Landed (2026-10-02):** `docs/audits/TEC3_METRIC_ADMISSIBILITY_INVENTORY_2026-10-02.md` — 16 fitness/admission metrics, 13 kernel-fed facts, 5 PT9/promotion metrics, plus the surfaced/descriptive/dormant/interaction classes, each mapped to estimand, implementation authority, confounds and decision consumers; 15 entries lack a defensible calibration experiment (ordered by leverage); and one structural finding — the `measured|derived` epistemic gate in `FitnessModel` vs the canonical producer's `heuristic` labels — that leaves several boosts unreachable under canonical intake, recorded for MA2 to author controls against. |
| **TEC3-MA2 — positive/negative-control harness** | **PARALLEL_SAFE / SPAWNABLE** for isolated laboratory fixtures; **BLOCKED_BY MA1** for promotion claims. | For each decision-bearing metric, define a negative control representing absence of the target property and a positive control carrying known signal; define an ideal/reference endpoint only where scientifically meaningful. Build deterministic synthetic fixtures first, then representative empirical fixtures where available. Record sensitivity with a DRF-like normalized control separation where appropriate, but retain metric-family-specific diagnostics and complementary metrics rather than collapsing calibration into one universal scalar. | Each metric has reproducible controls and a calibration report, or an explicit `NOT_CALIBRATABLE_FOR_DECISION` disposition. Degenerate controls, leakage and candidate-supplied thresholds are rejected. **First slice landed (2026-10-02):** `docs/audits/TEC3_MA2_CONTROL_HARNESS_2026-10-02.md` — deterministic controls and a measured calibration report for five families (F-1/F-9 CLUSTER-boost canonical and legacy dead-gate, the two DISTRIBUTION-boost halves' gate asymmetry, K-8 anomaly floor, K-1 cap/subsample-ordering confounds, K-5 periodicity negative control + null closure), all `NOT_CALIBRATABLE_FOR_DECISION` for now, kernel-side controls CI-only pending cargo; remaining MA1 families open. **Second slice landed (2026-10-02):** the six decision-layer families — F-3 scale envelope (D = 1.0 negative control unreachable in live ranking: out-of-envelope rowCount hard-disqualifies before scoring), F-4 information-preservation (CRITICAL branch shadowed by the `information-loss-critical` hard constraint; half-credit rule measured), F-13 p≥n gate boundary pair (p == n ABSTAIN ↔ p == n−1 promoted), F-14 DecisionPolicy boundary-localized pairs (all three constants flip exactly, uniqueness-only `DECISIVE` at the floor), F-15 weight-sensitivity (±10% flip is constructible at a 1% margin — 2/14 rate — while the canonical fixture reads 0/14), F-16 signature equality gate (15/15 per-field tamper refusals + exact `densityVariation` exclusion) — appended as §6 of the same report, all `NOT_CALIBRATABLE_FOR_DECISION`; fixtures `tests/tec3-ma2-decision-layer-controls.test.ts`; remaining open: F-5, F-7; K-3, K-6, K-7, K-9..K-13; P-1..P-5. **Third slice landed (2026-10-02):** the five PT9 promotion-gate families — P-1 group-balanced pairwise accuracy (positive/below/exact-parity arms through the production artifact-shaping route; the strict-improvement parity refusal pinned, and MA1's supplied-`bootstrapCorrect` confound demonstrated as a verdict flip from identical candidate behaviour), P-2 one-sided exact binomial sign test (boundary-localized p pair around the gate's in-source α fallback — 25 decisive groups/17 wins p = 0.05387607216835022 refused on `GROUP_WIN_EVIDENCE_NOT_SIGNIFICANT` alone vs 37/24 p = 0.04943587479647249 admitted; tail granularity recorded, not manufactured), P-3 leave-one-group-out improvement floor (one group's removal-rate flips the verdict: floor 0.16 admitted / 0.040000000000000036 refused on `ROBUST_IMPROVEMENT_BELOW_THRESHOLD` alone / 0.050000000000000044 double residue admitted under the strict `<`; the <2-group null path pinned as `MISSING_EFFECT_ROBUSTNESS_EVIDENCE` with a null floor, not a pass), P-4 learned feature vector (features verified to be exactly the six bootstrap component rawScores on a production arbitrate decision; `perceptualFitness` exclusion confirmed behaviorally; equal-score twins give identical snapshots, zero `featureDelta`, dot-0 weight-invariance and a zero-vector learner — `NOT_CALIBRATABLE_INDEPENDENTLY_OF_F1_F6`), P-5 gesture quality bar (accuracy and macro-F1 boundary pairs plus an exact-0.85 accumulation fixture pinned behaviourally against the module-private constants; MA1's `profileHash`-only disjointness demonstrated in both directions — a leaked hash erases both users, a shared hash pools them into one profile; a per-user catastrophic failure 0/10 passes the pooled bar at 0.9941520467836257; `promoteDeployment` returns true unconditionally — stage transitions candidate→shadow→canary→rollout carry no quality-gate coupling and card metrics are never consulted) — appended as §7 of the same report, all `NOT_CALIBRATABLE_FOR_DECISION` (= P-4's `NOT_CALIBRATABLE_INDEPENDENTLY_OF_F1_F6`); fixtures `tests/tec3-ma2-promotion-gate-controls.test.ts`; remaining open: F-5, F-7; K-3, K-6, K-7, K-9..K-13; **Fourth slice landed (2026-10-02):** the two remaining TypeScript fitness-model families — F-5 density-handling ladder (through production `BootstrapFitnessModel.evaluate` with no density requirement: the canonical producer never sets `clusterStructure.densityVariation` — source observed `unknown`; the absent-fact default rung is therefore the TOP rung, all 12 candidates scoring 1 — absence of a density claim becomes maximal density credit; after a slice-1-style `markDatasetSignatureFact` gate-flip to `0.42`/`measured` the hand-set rungs measure 0 (POINT_SET, DISTRIBUTION_FIELD, CLUSTER_REGIONS), 0.25 (AGGREGATE, TEMPORAL, HIERARCHICAL, GRAPH, MATRIX, SPATIAL), 1 (DENSITY_FIELD, MANIFOLD, MULTISCALE); MA1's recorded 0/0.25/0.75/1 ladder corrected as a family diagnostic — the 0.75 rung is **dead across all 12 production candidates**, constructible only with synthetic support-without-preservation / preservation-without-support shapes (both observed exactly 0.75); heuristic-source and measured-zero values both refused (gate needs source flip AND `> 0`); an authored density requirement yields the identical flipped map), F-7 perceptual fitness (reachability finding: `PerceptualFitnessSampler` is renderer-free — measured inputs constructible at the TS layer, so the MEASURED blend was exercised, not only the prior; prior blend pins to authored metadata 0.34/0.75/0.54/0.39 (POINT_SET/DENSITY_FIELD/MATRIX/GRAPH) and never reads the evidence item's own `priors` payload; per-input deltas pinned: frustum −0.3, overlap −0.3, ambiguity −0.2, glyph +0.2 at 16 px — exact observed double `0.30000000000000004` for the frustum pair; declared surrogate `labelCrowdingIndex` validated and never read (`0.5 → 1` bit-identical); glyph term clamps at the hand-picked 32 px (64 px no better; through the sampler medians land at `33.00021815331016`/`16.40685104441762` px, blends 1 → 0.9025428190276101); the `frustum-exclusion` hard constraint is engine-reachable in both directions through `arbitrate` — measured 0.90 exclusion disqualified on reason `Candidate frustum exclusion fraction 0.90 exceeds maximum frustum exclusion tolerance 0.30`, score 0, while the passing twin carries the live measured component 0.8362874272772644; RF-023 stale-fingerprint drop fail-closed to 0.34, `stalePerceptualEvidenceDropped = 1`) — appended as §8 of the same report, all `NOT_CALIBRATABLE_FOR_DECISION`; fixtures `tests/tec3-ma2-f5-f7-controls.test.ts`; remaining open: the Rust K-families only — K-3, K-6, K-7, K-9..K-13. **Fifth slice landed (2026-10-02):** the first tranche of the Rust K-families, kernel-side via CI-only `#[cfg(test)]` controls in `wasm/src/data/profile.rs` and `wasm/src/data/statistics_evidence.rs`, appended as §9 of the same report — K-3 correlation magnitude rule (perfect-fit r pinned to exactly ±1.0 with the 0.98 rank-deficiency constant coupling on the same observation; independent-noise negative −0.06041819921132467; threshold straddle 0.6006/0.5994 with exact IEEE negation symmetry; the exactly-0.6 boundary excluded by the strict `>` comparison and not publicly reachable; the MA1 small-n confound demonstrated — a 4-row zero-noise perfect fit passes the gate; nonlinear dependence y=x² reads 0.0604… far below the gate, demonstrating the receipt's own "weak Pearson ≠ absence of nonlinear dependence" limitation; the `NotTestableFromData` observation-independence record pinned on the claim and the Rust-issued receipt bundle), K-6 periodicityHeuristicScore (sinusoid positive 0.692 = the 0.6/0.4 blend of emitted 0.656/0.255; bell-noise negative exactly 0 — the K-5 boolean short-circuits the blend, no low-but-nonzero band; TEC2 rename pinned at the profile level — `periodicityHeuristicScore` present, `periodicityConfidence` absent; cross-family falsifier observed: a pure linear ramp scores 0.871 with periodicity true, out-scoring the genuine sinusoid), K-7 trend/seasonality (monotone up/down pin 0.9999999999999999 — scale-cancelling strength that pins at unity to within one ulp across steepness (the pinned fixture reads 0.9999999999999999; the exact ulp is amplitude-specific); constant column exactly 0.0 with `is_time_series` still presence-based; direction-threshold straddle 0.010499999999999976 up / 0.009500000000000017 flat — nonzero strength under a flat direction, decoupled bands, exact mirrored down arm; integer-period sine reads as a real downtrend 0.23203105348273143 while `has_seasonality` fires on the same window — seasonality observed to inherit the spectral `has_periodicity` boolean), all three `NOT_CALIBRATABLE_FOR_DECISION`, every pinned double verified by exact local TypeScript transcription of the invoked kernels (`pearson_pairwise`, `assemble_temporal_stats`, `compute_regular_fft` naive-DFT stand-in with rounding-margin checks) ahead of pinning, Rust assertions set to execute in the CI "Rust kernel" job; remaining open: the Rust K-families K-9..K-13 (K-13's numerics already pinned by existing Rust unit tests per MA1 — an authority pin, not calibration). **Sixth slice landed (2026-10-02):** the final Rust tranche, kernel-side via 10 new CI-only `#[cfg(test)]` controls in `wasm/src/data/profile.rs`, appended as §10 of the same report — K-9 graph family (directed-triangle positive pinning the exact `GraphProfile` `{is_graph, node_count 3, edge_count 3, has_cycles true, is_connected true}`; disjoint-edges acyclic+disconnected negative; the row-coverage coupling observed — `node_count` reads `max(nodes, row_count)` so a 10-row/1-edge fixture reads `is_connected: false`; both edgeless shapes, absent and explicit-empty, refuse as an explicit `"graph":null` wire-null rather than an emitted `is_graph: false` negative), K-10 density bands/proxy (both band boundaries pinned both sides — 19→20 flips 0.15→0.4, 49→50 flips 0.4→0.7; sparse flag at 14→true/15→false; `mode_count` provenance pinned as literally `clusters.estimated_count` — the capped K-1 estimate — decoupled from the IQR multimodality machinery in both directions: a monotone ramp reports 2 modes while its own column reports 0 binned peaks, and the three-block positive pins separation exactly 1.0 / mode_count 3), K-11 geospatial name sniff (exact-lowercase-name positive with case preservation on `"Lat"`/`"LNG"` and constant `coordinate_dimensions 2`; value-shaped and prefix decoys refuse; type-blind — categorical `lat`/`lng` columns fire; half-pair refusals; last match wins; reachability honestly recorded per MA1 — the sniff's own decision structure is pinned, no production-path firing fixture exists), K-12 effective dimensions (exact subtraction pinned: 4 numeric columns with one numerically-constant → `constant_columns 1`, `effective_dimensions 3`, `max_correlation 0.29411764705882354`, `redundant_columns 0`; the numeric-only scope of "constant" pinned — a constant categorical column does not decrement; the existing duplicate-rank/linear-dependence controls cited, not duplicated), K-13 recorded as an authority pin, not calibration — no new tests added, the existing `wasm/src/moneta/evidence.rs` unit tests (saturated −9/+9 deltas, N=5 half-weight with round-half-away, N=100 saturation, zero-floor, zero/absent fail-closed) cited as the standing pin with two MA1 citation drifts noted (path/line only), all four control families `NOT_CALIBRATABLE_FOR_DECISION`, every float-bearing double verified by exact local TypeScript transcription of the invoked kernels (`evaluate_clusters_from_accessor` with bit-exact BigInt u64 subsample ordering, `pearson_pairwise`, `iqr_and_multimodality`) ahead of pinning with the throwaway probe deleted afterwards, Rust assertions set to execute in the CI "Rust kernel" job; remaining open for MA2: **none** — every MA1 family now has an executed control or an explicit recorded disposition; this is not an MA2 completion of promotion claims per the governing rule, and MA3's governed calibration records plus production qualification remain open |
| **TEC3-MA3 — governed calibration disposition** | **OWNER_ONLY / HIGH-RISK**; **BLOCKED_BY TEC1 identity/receipt closure sufficient to avoid a second persistence/authority path, and by MA2**. | Define the smallest authority-owned calibration record/certificate needed by the existing evidence architecture: metric identity/version, target claim, task/data regime, control identities/digests, diagnostics, governing pre-specified decision rule, kernel/runtime identity, limitations and disposition. Do **not** introduce a parallel evidence store or a universal `evidenceStrength` score. | A metric can resolve only to a governed decision-eligibility state such as `CALIBRATED`, `UNCALIBRATED`, `OUT_OF_REGIME` or `NOT_CALIBRATABLE_FOR_DECISION`; absence or mismatch fails closed. The governing thresholds/rules are authority-owned and pre-specified, never supplied by the candidate being evaluated. |
| **TEC3-MA4 — Moneta fail-closed integration** | **OWNER_ONLY / HIGH-RISK**; **BLOCKED_BY MA3**. | Wire the calibration disposition ahead of utility/ranking for every selected decision-bearing metric. An unavailable, stale, mismatched or out-of-regime calibration must produce `ABSTAIN` / typed `METRIC_UNCALIBRATED`-class refusal for the affected evidence claim rather than falling back to the raw metric. Descriptive display may remain available when clearly labelled non-promotable. | Mutation/falsifier tests prove that removing calibration, swapping positive/negative controls, changing metric version/orientation, changing the declared data regime, tampering with control identity or replaying against a mismatched kernel cannot influence a promoted representation/model decision. |
| **TEC3-MA5 — replay, perturbation and cross-regime qualification** | **OWNER_ONLY integration with PARALLEL_SAFE falsifier ribs**; **BLOCKED_BY MA4**. | Carry the governed calibration identity through the existing receipt/replay path and exercise it under controlled perturbations: resampling, noise, dimensionality changes, scale changes and task-regime shifts chosen per metric family. Calibrate the **ruler**, then separately test stability of the scientific conclusion; do not conflate those two properties. | Replaying the same admissible evidence reproduces the same calibration disposition or fails closed; moving outside the calibrated regime invalidates promotion. At least one deliberate “metric looks good but cannot distinguish controls” fixture is rejected end to end. |

**Promotion boundary:** TEC3 metric calibration is a prerequisite for TEC4 only for metrics that can change a promoted outcome. It does not require calibrating every UI diagnostic or inventing controls for quantities that are never used as evidence. PT9 learned-candidate comparison, MCR2+ production promotion and evolutionary/search promotion may not use an uncalibrated decision-bearing metric. This work therefore strengthens the existing claim-bound architecture rather than delaying unrelated product work.

**Design constraints:** calibration is contextual, not eternal. A metric calibrated for one target property, data regime or aggregation scope is not thereby calibrated for another. Positive/negative controls must be independently justified; a model under evaluation may not define its own calibration controls or pass threshold. Multiple complementary metrics remain permissible and often desirable, but each decision-bearing use must state what property it contributes and what happens when its calibration is absent or contradictory.

P1-TEC non-goals are equally important: it does not require an algorithm zoo; it does not mandate persistent homology, HDBSCAN, knockoffs, PoSI or contextual bandits absent a justified estimand; it does not introduce a universal `evidenceStrength` scalar; it does not merge trustworthy evidence with representation search; and it does not require every conceivable statistical family before PT9. The closure criterion is that every analytical family Nemosyne *does* expose is semantically admissible, honestly named, provenance-bearing and losslessly represented to the degree required by its downstream claim.

Planning/audit work for TEC0 may be performed earlier when it does not collide with the active forward implementation tranche. MCR0/MCR1 contract and validation work may also proceed as bounded pre-work because it does not yet create the production Moneta Forma semantic-to-perceptual compiler; it may not claim that the P1-TEC handoff is closed. Production changes that close TEC1-TEC4 remain subject to the integration policy and the live sequential order above. Because TEC1-TEC4 touch scientific semantics and Rust/WASM/TypeScript authority boundaries, implementation is **high-risk** under `AGENTS.md`; pre-implementation invariants/falsifiers and a distinct post-implementation adversarial review are mandatory.


| Programme | Mission | Current checkpoint | Sequential position | Finite exit |
| --- | --- | --- | --- | --- |
| **A - Progressive Disclosure & Semantic Drill-down** | Make dataset-level structure the normal starting point while preserving exact observations as bounded drill-down. | A5 STOP / #606 | **VERIFIED COMPLETE / STOP** | Structure -> region/group -> bounded observations -> datum/provenance works through the production path without rematerialising the whole dataset. |
| **B - Source-Authoritative Structural Representations** | Add truthful graph/hierarchy/temporal/geospatial/spectral dataset structures without presentation-side inference. | Relationship Graph B4 STOP / #612 | **VERIFIED COMPLETE / STOP FOR FIRST SELECTED FAMILY** | Source-authoritative Relationship Graph V1 is verified complete; selecting another B family requires an explicit fresh-main choice. |
| **C - Visible Investigator Product Convergence** | Turn the landed substrate and semantic representations into the sparse, task-first Nemosyne experience. | C4 visible journeys / #616 | **IMPLEMENTATION LANDED / REVIEW ACTIVE** | Canonical journeys visibly converge on desktop and simulator-testable XR; physical-input/comfort fitness remains later device evidence. |
| **P1-TEC - Trustworthy Evidence Closure** | Close propagation, terminology, metric-calibration, falsification and production handoff gaps in the existing evidence architecture before learned/compositional Moneta consumes it. | TEC0 landed; TEC1 receipts/profiles/governed V3 persistence and replay loading landed through #833; **#834 analytical-port authority fix-forward landed in #843**, then consumer-policy/profile-identity binding and MCR closure | **ACTIVE WHERE NON-COLLIDING / FINITE CLOSURE BEFORE PT9** | Evidence axes needed for admissibility survive Rust/WASM -> Moneta/semantic representation with honest terminology, a single injected analytical authority, fail-closed loss handling, adversarial fixtures and replayable provenance. |
| **P1-FM - Incremental Full Moneta Capability Ladder** | Integrate scientific, representation and product work as observable capability gains with STOP / CONTINUE / REVISE assessment after each increment. | **FM0 ACTIVE** through P1-TEC, now on RFC 0009 tranche 3; FM1 contract/pre-work may proceed where non-colliding. | **NEW PRODUCT/INTELLIGENCE PROMOTION SPINE** | FM0-FM8 are either promoted with capability-specific evidence or explicitly revised/stopped; recovered product experiences are evaluated rather than silently deferred. |
| **P1-PT - Product Transition & Evolutionary Improvement** | Turn the research system into a usable, maintainable, operable product while improving learning velocity without weakening scientific authority. | PT8 governed gesture-model update loop / #667 | **PT0-PT8 LANDED; PT9-PT10 DOWNSTREAM OF P1-UXR -> P1-WP -> P1-WQ -> P1-TEC** | PT0-PT10 are completed or explicitly re-scoped with product, production, data, learning and private-preview evidence correctly classified. |
| **P1-UXR - Semantic-Efficiency UX, Runtime Simplification & Verification** | Make semantic spatial investigation cheaper, more natural and more stable while preserving analytical truth and provenance. | UXR3 bounded semantic working set | **ACTIVE / UXR0-UXR2 BOUNDED SOFTWARE LANDED; UXR3-UXR4 PARTIAL; UXR5 OPEN** | UXR0-UXR5 reach bounded STOP, with physical claims closed only by attributable device evidence; then PT9/PT10 resume. |
| **D / assurance legacy boundary** | Preserve attributable validation, live-path security/privacy assurance and clean-production/device qualification contracts needed by the selected preview scope. | QV4 adjudication/custody landed (#668/#669); QV5/QV7 and selected physical/security residuals open | **CONSUMED BY P1-PT/P1-UXR / ACTIVE WHEN CLAIM-REQUIRED** | Required assurance gates for the selected private-preview scope are satisfied; no browser/simulator evidence is promoted into physical proof. |

A is the shared semantic integration spine and is frozen at its finite P1-R5 boundary. B's first structural family is frozen at its Relationship Graph V1 boundary. C consumes A/B semantic state and may not manufacture analytical facts. PT0-PT8 have landed; P1-UXR owns the current forward implementation stream. PT9/PT10 remain downstream of P1-WP, P1-WQ and the finite P1-TEC evidence-closure gate. Quest remains a useful reference/qualification platform, not a strategic ceiling or master blocker for unrelated product development. Work that does not depend on fresh physical evidence may continue; claims about physical comfort, interaction fitness, sustained device performance or live-human outcomes may not.

### P1-UXR checkpoint status at the integration base

| Checkpoint | Status | Evidence-conservative boundary |
| --- | --- | --- |
| UXR0 | **BOUNDED SOFTWARE CONTRACT LANDED / PHYSICAL PROFILES OPEN** | #701-#708 provide baseline telemetry, replacement qualification, selected allocation work and S0-S3 -> governed S4/S5 calibration plumbing. They do not supply completed 30/60-minute physical-device runs or human validation. |
| UXR1 | **SOFTWARE MIGRATION + PURPOSE-COMPREHENSION FIX-FORWARD LANDED / PHYSICAL VALIDATION OPEN** | #716, #720-#728, #734-#744 and #746 migrate the canonical panels/navigation to UIKit and semantic/contextual surfaces; #754 lands treatment-v3 purpose/mental-model/live-next-step guidance with progressive disclosure. #745 remains open because fresh governed Quest human evidence is still required before the reported comprehension defect can close. |
| UXR2 | **BOUNDED LIFECYCLE SOFTWARE LANDED / PHYSICAL EVIDENCE OPEN** | #761 establishes the production `ACTIVE -> WARM -> COLD -> EVICTED` presentation-resource authority, ownership-aware retirement, bounded cleanup and telemetry. Worker/WASM release and attributable 30/60-minute physical-device evidence remain open. |
| UXR3 | **BOUNDED SOFTWARE PASS / STOP** | #763/#764/#769 establish bounded semantic materialisation, replacement, collapse, identity-only eviction and fail-closed reconstruction; #779/#781/#783 close bounded Worker admission, safe all-stale recycling and lifecycle outcomes; #790 closes the UXR3-R1 duplicate-computation result-transfer finding. `review/UXR3_S1_CLOSURE_REVIEW_2026-09-19.md` records S1 closure; `review/UXR3_E1_STOP_REVIEW_2026-09-20.md` records cross-family Aggregate/Distribution/Density/Cluster/Relationship Graph qualification and the finite UXR3 STOP. **Next:** UXR4 interaction/responsiveness/render/resource/semantic-scale envelopes. Physical memory release timing, latency, Quest fitness and human evidence remain downstream claims. |
| UXR4 | **PARTIAL / GOVERNED 5M/30M/60M EXECUTION SEAM READY / EVIDENCE ACQUISITION OPEN** | QV4 adjudication/custody (#668/#669), the five-class envelope (#794), QV4 lane integration (#797), cohort finalization (#799), headset-loop plumbing and UXR0 telemetry are reusable. Workspace-surface reliability also converged through #807/#811/#812: single persistent-surface authority, substrate-neutral visibility, then explicit `WorkspaceSurface` lifecycle. The governed Quest performance lane now binds the existing 5-minute, 30-minute and 60-minute profiles end-to-end without inventing resource PASS thresholds. Fresh interaction/responsiveness/render/resource/semantic-scale evidence and independent UXR4 adjudication remain open. |
| UXR5 | **OPEN / GOVERNED LONG-SESSION SEAM READY / PHYSICAL EVIDENCE REQUIRED** | The existing 5-minute, 30-minute and 60-minute Quest profiles are now bound end-to-end through the governed launcher/operator/report/custody path, with profile mismatch, duration drift, staircase-count contamination and evidence relabelling rejected fail-closed. No evidence at this integration base yet closes attributable Quest input, comfort, 30-minute resource-trend or 60-minute sustained-device claims. |

---

# Stream A - Progressive Disclosure & Semantic Drill-down

**Status:** VERIFIED COMPLETE / STOP — #606 merged, all exact-head gates green
**Primary programme:** P1-R5 in `roadmap/P1_R_SEMANTIC_EMBODIMENT_CONVERGENCE.md`
**Closure review:** `review/P1_R5_A5_STOP_REVIEW_2026-08-31.md`
**Mission:** make observations an explicit detail capability rather than the universal geometry substrate.

Canonical detail hierarchy:

```text
investigation
  -> dataset representation
    -> semantic structure / region / group
      -> bounded observation subset
        -> exact datum / provenance
```

## A1 - semantic drill-down contract and falsifiers

**Status:** VERIFIED COMPLETE

Freeze the generic contract before implementation fans out.

Required decisions/evidence:

- define a representation-independent semantic target identity for a selected region/group/structure;
- define the bounded request for member observation identities or compact observation views;
- state maximum returned observation IDs/records and explicit pagination/refusal behavior;
- preserve dataset fingerprint, semantic object ID, representation decision identity and investigation context;
- distinguish navigation/detail state from scientific mutation;
- make Moneta observation-level requirements explicitly decide when `POINT_SET` is primary versus deferred;
- define stale-generation, deleted-target, changed-dataset and unsupported-membership failure semantics;
- falsify any implementation that scans/rematerialises the full dataset in UI/renderer code.

**Exit:** one cross-representation contract exists and can be consumed by Aggregate, Distribution, Density, Cluster and later B-family structures without family-specific UI APIs.

## A2 - resident membership/query capability

**Status:** VERIFIED COMPLETE

- implement the bounded membership/detail query at the canonical Rust/Worker dataset authority;
- return only the requested bounded identity/compact view;
- keep full source rows resident;
- apply resource bounds before output growth;
- prove stale/foreign handles and mismatched semantic targets fail closed;
- preserve exact observation identity where the underlying representation contract can support membership.

**Exit:** the production analytical runtime can answer a bounded semantic-target detail request without whole-dataset JS materialisation.

## A3 - representation transition and selection lineage

**Status:** VERIFIED COMPLETE

- reveal observation-level marks only for the selected/focused bounded subset or an explicit observation-level task;
- preserve the selected semantic structure while entering detail;
- keep semantic IDs separate from transient mesh/instance indexes;
- make reverse navigation explicit: observation -> containing semantic structure -> dataset overview;
- integrate P1-F focus/context and existing representation-surface interaction semantics.

**Exit:** the user can move between structure and observations without losing context or replacing the whole dataset with points.

## A4 - exact datum/provenance inspection

**Status:** VERIFIED COMPLETE

- connect selected observations to exact datum/provenance retrieval;
- make missing/unavailable provenance explicit;
- preserve replay/investigation identity;
- ensure UI panels consume bounded exact-detail requests rather than cached whole datasets.

## A5 - product evidence and independent STOP

**Status:** VERIFIED COMPLETE / STOP — #606 merged, all exact-head gates green

Canonical product evidence includes Aggregate/Distribution/Density/Cluster paths and proves:

- overview begins at dataset structure;
- selecting a structure can reveal a bounded observation subset through the shared generic drill-down path;
- source N does not determine the amount of row data transferred for an unopened structure;
- returning to overview restores the semantic representation and selection context;
- explicit observation-level intent can still choose `POINT_SET` legitimately;
- refusal/pending/stale membership cannot silently fall back to all-points rendering.

The exact A5 production-browser run uses one pinned bundle for all four verified families. The closure review deliberately distinguishes family overview evidence from the generic A3/A4 drill-down tests rather than claiming a separate end-to-end gesture run for every family.

**Finite exit:** P1-R5 is `VERIFIED COMPLETE` only for the verified families and bounded query semantics. Do not automatically expand into arbitrary cross-filtering or new scientific analyses.

### Stream A closure boundary

The generic drill-down/selection integration contract around these surfaces is now a **frozen shared contract**, not an active implementation stream:

- `src/app/dataset/LoadDatasetUseCase.ts` where generic investigation requirements/detail state enter;
- generic semantic target/detail request types;
- Worker/runtime detail-query dispatch;
- `MonetaTopologyNode` generic semantic selection lifecycle;
- generic `RepresentationSurface` selection/detail transitions.

B must not create a competing graph-specific member-query API. C may present `Reveal observations` or equivalent controls only by dispatching A's governed intent. D may test or harden these paths but does not own their analytical meaning.

---

# Stream B - Source-Authoritative Structural Representations

**Status:** VERIFIED COMPLETE / STOP FOR RELATIONSHIP GRAPH V1 — B1 #607, B2 #610, B3 #611, B4 #612 merged
**Primary programme:** P1-R2E in `roadmap/P1_R_SEMANTIC_EMBODIMENT_CONVERGENCE.md`
**First selected family:** source-provided `RELATIONSHIP_GRAPH`.
**Closure review:** `review/P1_R2E_B4_STOP_REVIEW_2026-09-01.md`.

## Governing rule

B represents **source-authoritative structure first**. It does not infer structure from visual proximity, color, density, correlation, k-nearest-neighbour search or a force layout unless a later separately governed analytical treatment explicitly authorizes that method.

The first slice is Relationship Graph because source-provided edges create the cleanest authority boundary and exercise a genuinely non-point dataset structure.

## B1 - Relationship Graph scientific/authority contract

**Status:** VERIFIED COMPLETE / #607 MERGED

- define accepted source edge authority and provenance;
- define node identity, edge identity, directionality, multiplicity/self-loop policy, missing endpoint behavior and edge attributes included in V1;
- define hard node/edge/payload bounds and refusal semantics;
- distinguish source graph topology from presentation layout coordinates;
- narrow Moneta candidate claims to exactly what the payload preserves;
- require a new fitness/treatment identity if admissibility/information semantics change ranking;
- add falsifiers proving no k-NN/correlation/layout-derived edge fallback exists.

**Exit:** contract is deterministic, bounded and scientifically reviewable.

## B2 - resident Rust/WASM graph payload

**Status:** VERIFIED COMPLETE / #610 MERGED

- consume source-authoritative nodes/edges from the canonical resident dataset/graph capability;
- emit bounded stable semantic node/edge IDs and authoritative adjacency;
- keep topology independent of Three.js layout;
- preserve missing/dropped/refused counts explicitly;
- prove deterministic ordering, source identity and resource limits across real WASM.

## B3 - production cutover and thin graph adapter

**Status:** VERIFIED COMPLETE / #611 MERGED

- carry the governed graph payload through Worker/WASM using existing generation/fingerprint/decision fences;
- intercept the governed graph representation before row-derived or proximity-derived layout logic can create topology;
- keep presentation layout purely presentational and visibly distinguish it from edge authority;
- bind selection to stable semantic node/edge IDs;
- fail closed on pending/refused/stale/invalid payloads.

A's generic selection/drill-down contract is frozen and consumed here. B3 extends only the family-specific authority/payload/adaptation required by the shared contract and does not fork the generic semantic-detail API.

## B4 - product/scale/perceptual evidence and STOP

**Status:** VERIFIED COMPLETE / STOP — #612 MERGED AT `main@232d952`

B4 proved:

- source graph edges survive the full product path unchanged;
- arbitrary presentation-layout seed changes do not change topology;
- bounded payload/render behavior, including the 4,000-node near-bound fixture;
- no invented graph appears when source authority is absent, even with graph-like proximity/correlation bait;
- mutation/prefix eviction fences stale graph surfaces;
- independent review closed with no unresolved Relationship Graph V1 blocker.

**Finite exit:** source-authoritative Relationship Graph V1 is `VERIFIED COMPLETE` for its evidence scope and B STOPS. Selecting hierarchy, temporal, geospatial or spectral as the next structural slice requires an explicit fresh-main choice rather than automatic continuation.

### Later B candidates, ordered preference

1. Hierarchy with explicit parent/child authority.
2. Temporal trajectory with explicit entity/time-order authority.
3. Geospatial structure with explicit coordinate/reference-system authority.
4. Spectral/frequency structure only after its exact mathematical object is governed.
5. `MANIFOLD_EMBEDDING` and `MULTISCALE_FIELD` remain implement-or-defer candidates; point-like surrogates under stronger labels are forbidden.

### Stream B collision rule

B's Relationship Graph V1 integration contract is frozen. Future B-family work, if explicitly selected, owns representation-specific Rust modules, discriminated payloads, family-specific WASM proof and thin adapters. Shared generic files remain integration windows rather than permanent B ownership and must preserve Stream A's verified invariants.

---

# Stream C - Visible Investigator Product Convergence

**Status:** IMPLEMENTATION LANDED / REVIEW ACTIVE — C1 #613, C2 #614, C3 #615 and C4 #616 merged; physical P1-U9 evidence remains open
**Primary programme:** `roadmap/P1_UV_VISIBLE_PRODUCT_CONVERGENCE.md`
**Baseline authority:** `roadmap/P1_UV0_BASELINE_INVENTORY.md`.

The bounded C1-C4 product-convergence implementation has landed. C consumes analytical/semantic truth from A/B/Moneta/Atlas and may not calculate new scientific facts from visual appearance. Browser and simulator evidence prove production wiring and simulator-testable semantics, not physical controller/direct-touch/comfort fitness.

## C1 - functional epistemic world objects

**Status:** VERIFIED COMPLETE — #613 MERGED AT `main@5c593b57`
**Pre-review:** `review-plans/P1_UV_C1_FUNCTIONAL_WORLD_OBJECTS_PRE_REVIEW_2026-09-01.md`
**Post-review:** `review/P1_UV_C1_FUNCTIONAL_WORLD_OBJECTS_POST_REVIEW_2026-09-01.md`

Re-audit every persistent world object against the rule: **persistent objects earn their volume**.

### TechnoCore

- representation decision state, why/alternatives/constraints/remediation is inspectable through the existing governed RecommendationPanel;
- `DECISIVE`, `INFEASIBLE`, `UNDERDETERMINED` and `AMBIGUOUS` are projected categorically without pretending statistical confidence;
- preview/committed decision identity is legible from the existing Moneta decision state;
- production TechnoCore selection opens guidance rather than hiding a statistical/anomaly-lens mutation inside the landmark.

### Vault and portals

- archive/freeze/recovery state is projected from the real Vault archive path rather than decorative state;
- portal destination/availability semantics are exposed before traversal;
- portals remain semantic navigation/recovery instruments rather than ordinary analysis mutation controls.

### Memory Palace

- explicit ResearchContext, Atlas observations/findings and supported InvestigationGraph nodes are embodied as restrained epistemic objects;
- object count is bounded at 48 and contextual relationship lines at 24;
- reasoning links appear only for explicit source edges incident to the selected object rather than as permanent graph clutter;
- selection uses durable source identity rather than transient mesh indexes;
- the dormant Memory Palace authoring controller is retired: `MemoryPalaceController` was deleted in full by FM1-MEM (PR #855, 1 October 2026) rather than made production-safe, so the C1 hazard is closed at the root — the C1 evidence projection path never depended on it.

**C1 evidence boundary:** production-browser evidence proves TechnoCore guidance without analytical mutation, real observation projection, real archive freeze -> Vault state transition, saved-portal availability, and the bounded Memory Palace envelope. Retained screenshots also show that legacy scale/salience and overall scene hierarchy still require convergence; C1 does not claim final visual hierarchy, XR parity or physical Quest fitness.

**Exit:** SATISFIED for the bounded C1 product-function contract. #613 merged after exact-head CI, CodeQL, architecture, dedicated C1 browser evidence and bounded adversarial review.

## C2 - investigation-state legibility

**Status:** LANDED / #614 MERGED; bounded post-review closed
**Pre-review:** `review-plans/P1_UV_C2_INVESTIGATION_STATE_LEGIBILITY_PRE_REVIEW_2026-09-01.md`
**Post-review:** `review/P1_UV_C2_INVESTIGATION_STATE_LEGIBILITY_POST_REVIEW_2026-09-01.md`

C2 makes the normal Status Strip answer without log reading:

- what changed;
- what is selected/focused;
- what analytical work is pending/ready/refused;
- what evidence supports/refutes the current explicit epistemic state;
- whether a representation change is preview or committed;
- whether the user can undo/redo or recover from a real archive;
- where the current state came from.

Implementation/review invariants:

- the existing Status Strip is reused; no second persistent status panel is added;
- Status Strip placement is governed by `PANEL_LAYOUT.statusStrip`, constructed directly under `analystAnchor`, and pinned to `panel-layout/4+intent-wheel/1+frames/torso-locked`;
- analytical and decision categories are projected from existing authorities without reclassification;
- evidence counts use only explicit incident `supports`/`refutes` edges;
- undo/redo and archive state are read from real Atlas/Vault owners;
- state origin is reconciled against the current analytical fingerprint rather than blindly projecting the graph insertion cursor;
- historical parentless canonical `:vN` load roots remain eligible for exact-fingerprint origin reconciliation because older graph construction normalized their omitted kind to `operation`;
- arbitrary parentless operations are rejected and ambiguous origin matches fail closed;
- no physical Quest claim is made by C2 browser evidence.

**Exit:** bounded desktop/production-browser legibility implementation and review landed through #614. Physical XR fitness remains outside C2's claim.

## C3 - desktop/XR parity

**Status:** LANDED / #615 MERGED
**Post-review:** `review/P1_UV_C3_DESKTOP_XR_PARITY_POST_REVIEW_2026-09-01.md`

- one canonical selected-object task vocabulary: `Inspect | Compare | Challenge | Record | Navigate | More`;
- desktop and XR dispatch through the same contextual task resolver and owning callbacks;
- task availability/disabled reasons are shared across modalities;
- no second analytical authority, selection store or modality-specific semantic command tree was added;
- production-browser evidence proved real selected-object dispatch and dataset-replacement invalidation;
- no physical controller/direct-touch/Quest fitness claim is made.

## C4 - visible-product evidence

**Status:** LANDED / #616 MERGED; canonical browser journeys present; physical evidence still open
**Pre-review:** `review-plans/P1_UV_C4_VISIBLE_PRODUCT_JOURNEYS_PRE_REVIEW_2026-09-01.md`

C4 exercised the canonical journeys:

1. first insight;
2. skeptical investigation / representation challenge;
3. Memory Palace reasoning;
4. archive/replay/recovery.

It also added governed investigator-authored question/hypothesis/conclusion/branch lineage over existing investigation/evidence authorities. Supported/refuted/inconclusive terminal reasoning requires existing analytical evidence rather than being inferred from geometry or visual appearance. The dormant `MemoryPalaceController` has since been retired in full by FM1-MEM (PR #855) — the bounded production Memory Palace projection remains the separate authority.

**Finite exit:** C is `IMPLEMENTATION LANDED / REVIEW ACTIVE`. Canonical journeys visibly converge on desktop and simulator-testable surfaces, but `VERIFIED COMPLETE` still requires the physical-input/comfort evidence owned by later qualification work for whichever target platform is selected.

### Stream C collision rule

C owns product shell/world-object/presentation state and affordances. It consumes A/B semantic contracts. C must not modify Rust analytical reduction, candidate scientific meaning or source membership merely to support a visual treatment.

---

# Stream D - Assurance & Private-Preview Readiness

**Status:** PARTIALLY LANDED / NOW CONSUMED AS BOUNDED ASSURANCE TRANCHES WITHIN P1-PT
**Primary programmes:** `roadmap/P1_QV_QUEST_VALIDATION_OPERATIONS.md`, `docs/archive/STREAM_C_SECURITY_ASSURANCE.md` (legacy execution name), issue #314 hardening backlog, and later P1-U9/P1-W gates.

The file `docs/archive/STREAM_C_SECURITY_ASSURANCE.md` retains its historical name because it is evidence from the previous completed A/B/C wave. Under the current product-transition programme, unresolved security/privacy/live-path findings are selected as bounded forward tranches rather than executed as a parallel stream.

Quest is a concrete reference platform for standalone-XR performance, interaction and comfort evidence. It is not a strategic ceiling and its unfinished qualification work does not block unrelated product-transition work.

## D1 - validation manifest and launcher

**Status:** LANDED through QV0/QV1 (#531) and governed evidence-sink work (#535)

- one versioned validation manifest;
- exact source/build identity and clean/dirty state;
- explicit evidence class separate from result;
- governed run modes/launcher without changing ordinary dev behavior;
- session ID/evidence directory/runtime class/gate/profile attribution;
- no automatic roadmap mutation.

## D2 - evidence attribution, sink and adjudication

**Status:** QV2 attribution + QV3 sink + QV4 adjudication/custody LANDED; physical claim-dependent qualification remains open

- #617 makes host-side ADB machine capture the governed Quest model/build attribution path;
- required machine facts include model, build incremental and build fingerprint, with optional manufacturer/display/security-patch facts;
- raw ADB serial and serial-derived stable identifiers are not persisted;
- missing, unauthorized or ambiguous ADB attribution fails closed for governed runs;
- manually typed model/firmware metadata cannot upgrade an unattributed governed run;
- per-session bounded evidence directories and fail-closed session routing are landed;
- analyzer validity remains separate from gate disposition;
- #668 makes QV4 emit `PASS | FAIL | PARTIAL | INVALID_RUN | BLOCKED` from owned evidence/threshold contracts and binds automatic adjudication to the governed evidence chain;
- #669 hardens finalization fidelity, artifact/custody checks and verdict attribution rather than broadening the physical claims;
- current 10M boundary evidence may not be relabelled as final device qualification.

## D3 - live-path security quick wins

Mutable disposition for the live Stream D security-assurance findings is machine-owned by `governance/review-findings.json`. The table below is a checked projection; update the ledger and regenerate it with `npm run governance:findings:write`.

<!-- REVIEW_FINDINGS_STATUS:BEGIN -->
> **Generated review-finding disposition.** Mutable RF status is owned by `governance/review-findings.json`; edit the ledger, not this table.

| Finding | Severity | Status | Current disposition |
| --- | --- | --- | --- |
| RF-037 | Critical | `VERIFIED COMPLETE` | Single-replica live admission is verified; multi-replica replay safety remains the explicit RDO-007 deployment obligation. |
| RF-038 | High | `VERIFIED COMPLETE` | Exact role allow-list and production-path rejection evidence are verified. |
| RF-039 | High | `IMPLEMENTATION PARTIAL` | Production FileLoader -> Atlas -> Rust -> Dataset policy consolidation and hostile live-path evidence remain incomplete. |
| RF-040 | High | `IMPLEMENTATION PARTIAL` | The authoritative telemetry lifecycle and end-to-end revoke/export/erasure evidence remain incomplete. |
| RF-041 | Medium | `VERIFIED COMPLETE` | PR #619 removed the remote Three.js import-map/CSP trust and retained a production hygiene regression. |
| RF-042 | Low | `VERIFIED COMPLETE` | PR #647 neutralized C0/C1/ESC terminal control sequences and verified the regression on the promoted exact head. |
| RF-043 | High assurance gap | `IMPLEMENTATION PARTIAL` | Systematic hostile-input fuzz/property evidence across parser and exported WASM ABI boundaries remains incomplete. |
<!-- REVIEW_FINDINGS_STATUS:END -->

D3/D4 implementation remains high-risk or production-path evidence-bearing according to `AGENTS.md`; helper-only tests are insufficient.

## D4 - deeper privacy/WASM assurance

- RF-040 telemetry consent/lifecycle truthfulness across actual stores/exports;
- RF-043 parser/WASM ABI fuzz/property campaigns with deterministic regressions for discovered defects;
- post-Moneta trap containment/recovery, stale-handle invalidation and state rehydration where the architecture can prove it safely;
- audit relevant Rust `unsafe` invariants and hostile pointer/length boundaries.

## D5 - guided physical UX validation readiness

**Status:** BOUNDED QV5/QV6 SOFTWARE LOOP LANDED IN #656 / PHYSICAL AND HUMAN OUTCOMES OPEN

#656 implemented the attributable governed launcher/browser/sink loop and bounded guided-task evidence plumbing. Use and extend it when a selected product treatment/platform is stable enough to test:

- controller/direct-touch semantic tasks;
- capture/cancel/tracking-loss recovery;
- precision escape and panel manipulation;
- representation transition semantics;
- accessibility modes;
- bounded comfort/task outcome records;
- dev-only validation dashboard excluded from production artifacts.

IWER/browser evidence may exercise simulator-testable wiring but cannot backfill physical input, comfort or sustained-device claims.

## D6 - physical qualification and P1-W/private-preview handoff

For the selected private-preview platform/scope:

1. collect attributable physical-device evidence where the owning gate requires it;
2. add QV7-equivalent clean-production evidence handoff for the target runtime;
3. execute remaining P1-W production wiring only against surfaces that are no longer scheduled for structural replacement;
4. close required security/privacy/production blockers;
5. assemble the minimal private-preview promotion evidence.

**Finite exit:** assurance has not completed merely because a validation harness exists. The required assurance gates for the selected private-preview scope must be satisfied and evidence classes must remain correctly classified.

---

# P1-PT - Product Transition & Evolutionary Improvement

**Status:** PT0-PT8 LANDED AT THEIR BOUNDED EXITS; P1-UXR ACTIVE BEFORE PT9/PT10

**Primary plan:** `roadmap/P1_PRODUCT_TRANSITION_PLATFORM_AND_LEARNING_PLAN.md`
**Historical execution checklist:** issue #620; stale for live status and sequencing

Current sequential status:

- **PT0: COMPLETE** via #619 at `main@fd53ae22`.
- **PT1: COMPLETE** via #621 and #622; its exact cache miss/hit proof and final green coverage/promotion gates are recorded in the PT1B review, while the p50/p95 objective remains a monitored operational SLO.
- **PT2: COMPLETE** via `TsatsuAmable/nemosyne-data#3` and its PRs #4-#6, ending at `nemosyne-data@8e6b2dfc` with post-merge validation green.
- **PT3A: COMPLETE / RFC ACCEPTED** - RFC 0003 fixes the production identity, purpose-scoped authorization, lifecycle, governed event-envelope, runtime-provenance and Product/Research Mode boundary for implementation.
- **PT3B: COMPLETE** via #625 at `main@bafc4df` - the first closed TypeScript schema/validator tranche, independent adversarial review and exact-head promotion evidence are complete. No production event family or producer is wired, and no live ingestion, storage, export, erasure or production-collection property is claimed.
- **PT4: VERIFIED COMPLETE / STOP FOR THE SELECTED BOUNDED PRODUCT-MODE VERTICAL SLICE** via #627-#641. The authenticated consent-aware ingestion/storage/export/registered-service-erasure path and production persistence boundary are landed. This is not managed-deployment, high-availability, backup/restore, physical-media-erasure or broad collection evidence.
- **PT5: VERIFIED COMPLETE / STOP FOR THE BOUNDED SOFTWARE PATH** via #642-#659. Governed catalogue loading, canonical desktop/XR investigation semantics, continuity/reopen and bounded XR authoring are landed. Physical comfort, reachability, typing ergonomics and human discovery benefit remain open empirical claims.
- **PT6: VERIFIED COMPLETE / STOP FOR THE BOUNDED GOVERNED COLLECTION/SNAPSHOT PATH** via #661-#664. Purpose-separated gesture-learning families, lifecycle, immutable profile-disjoint snapshots and held-out evaluation contracts are landed. This does not claim deployed production collection, raw-trajectory research activation, trained-model quality or human evidence.
- **PT7: IMPLEMENTATION LANDED / BOUNDED REGISTRY-JOB CONTRACT COMPLETE** via #665. Artifact/runtime/model registry identity, reproducible job manifests/receipts and signed staged deployment metadata are repository-runnable. Live service routing, production artifact storage and deployed canary evidence remain unproven.
- **PT8: IMPLEMENTATION LANDED / BOUNDED GOVERNED UPDATE LOOP COMPLETE** via #667. The repository-runnable Python/ONNX gesture training, held-out evaluation, qualification, explicit human promotion decision, signed lifecycle and rollback path are present. No automatic scheduling, production learning-plane deployment, live cohort success or physical/human model-quality claim is made.
- **P1-WP: PLANNED / AFTER UXR5.** Productionize and deploy Nemosyne as an internet-accessible ordinary-browser application so investigator access is not dependent on specialist VR hardware. Deployment readiness includes security/privacy, persistence/recovery, provenance/replay, observability, rollback and consent/evidence-use boundaries.
- **P1-WQ: PLANNED / AFTER P1-WP, BEFORE PT9.** Qualify the deployed browser experience with real investigators and supported ordinary hardware; validate the investigation lifecycle and governed judgment capture without treating raw telemetry as learning evidence.
- **PT9: NOT COMPLETE / DOWNSTREAM OF P1-WQ.** #712, #713 and #747-#749 land scientific-admissibility, falsification and abstention prerequisites only. They do not implement the Moneta learning-evidence pipeline, learned-candidate comparison or governed promotion loop.
- **PT10: NOT STARTED / DOWNSTREAM OF PT9.** No private-preview cohort, interviews, consented product-learning evidence or human discovery-outcome programme is claimed.

P1-PT may select bounded UX, security, reliability, maintainability, CI, documentation and operations ratchets between larger product slices. It must preserve the five product/research authority boundaries and the Notice -> Question -> Hypothesis -> Investigation -> Understanding -> Validation -> Discovery lifecycle.

---

# Sequential execution and integration rules

## Ownership matrix

| Surface | A | B | C | Assurance / P1-PT |
| --- | --- | --- | --- | --- |
| Generic semantic drill-down / selection lineage | **frozen authority** | consumes | consumes | tests/consumes |
| Representation-specific Rust/payload math | consumes | **OWNS while explicitly reactivated** | no | assurance only |
| Generic semantic Worker/loader/translator seam | **frozen contract** | narrow integration window | no scientific changes | tests/security/product integration only |
| Product shell/world objects/presentation hierarchy | consumes | no | **landed C authority** | evolves through bounded product tranches |
| Quest validation scripts/manifests/evidence sink | no | no | consumer | **assurance authority** |
| Upload/auth/privacy/CSP/fuzz/live-path assurance | no | no | consumer | **P1-PT/assurance authority when selected** |
| `docs/ROADMAP.md` status | checkpoint updates | checkpoint updates | checkpoint updates | checkpoint updates |

## Collision-sensitive files

The following are shared integration contracts and should change only in the active sequential tranche when that change is necessary:

- `src/app/dataset/LoadDatasetUseCase.ts`;
- `src/app/dataset/SemanticEmbodimentLoader.ts`;
- `src/moneta/MonetaTopologyNode.ts`;
- `src/moneta/VRTopologyTranslator.ts` or its successor;
- generic representation/requirements contracts;
- `src/vr/presentation/representation/RepresentationSurface.ts`;
- shared analytical Worker/WASM bridge dispatch;
- common CI/promotion workflow files.

Representation-specific Rust modules, payload files, thin adapters, UI components and validation/security modules should be preferred so each tranche remains bounded and reviewable.

## Integration order

1. **A is frozen complete** at the generic progressive-disclosure contract and its four verified families.
2. **B's Relationship Graph V1 is frozen complete**; a new B family requires explicit reactivation rather than automatic continuation.
3. **C1-C4 are landed**; further UX/product refinement proceeds through P1-PT without inventing analytical authority.
4. **P1-PT** is the active sequential programme and selects one bounded forward tranche at a time.
5. **UXR4/UXR5 assurance and device qualification** close the current P1-UXR programme; Quest remains a specialist modality rather than the assumed access platform for the investigator population.
6. **P1-WP web productionization/deployment** follows UXR5 against stable surfaces and required assurance contracts.
7. **P1-WQ web investigator qualification** follows WP and establishes the ordinary-browser investigation/judgment-access gate.
8. **PT9 Learned Moneta** follows WQ **and finite P1-TEC closure**; broad access does not relax evidence admissibility, provenance, holdout or explicit-promotion requirements.

## Sync discipline

Every checkpoint PR must:

1. fetch live `main` before branch creation;
2. state the exact base SHA;
3. confirm the previous checkpoint is merged or abandoned;
4. avoid stacked long-lived checkpoint branches;
5. sync/reconcile any new `main` before final promotion when strict status checks require it;
6. carry pre/post adversarial review for high-risk changes;
7. merge only on exact-head evidence appropriate to the risk surface;
8. fetch fresh `main` before beginning the next checkpoint.

The single forward implementation stream should sync frequently with remote `main`, especially before touching the small but high-leverage shared contracts.

## Forward execution: dependency spine with optional parallel ribs

The default execution unit is one **sequential tranche** on the roadmap dependency spine. One owner is accountable for taking that tranche through integration and promotion. Parallelism is optional capacity, not a delivery requirement: never delay the spine merely to keep multiple agents busy.

Within a tranche, work may be decomposed into bounded sub-branches when ownership and merge dependencies are explicit:

- **OWNER_ONLY**: authority-sensitive, tightly coupled or integration-defining work kept by the tranche owner.
- **PARALLEL_SAFE**: provably disjoint implementation, test, documentation, research or review work that does not change the owner governing assumptions.
- **SPAWNABLE**: a PARALLEL_SAFE slice small and self-contained enough for delegation to a sub-agent or another worker.
- **BLOCKED_BY**: a dependency that must land or resolve before the slice may start or promote.

A tranche has the shape: sequential tranche (one owner) -> owner-only critical path + optional parallel-safe/spawnable ribs -> integration gate on fresh main and exact-head evidence -> next dependency-satisfied tranche.

The administrator should **advance the spine first, then exploit available ribs opportunistically**. Idle agents are preferable to invented work, speculative branches or collisions. A single worker may execute the whole tranche sequentially; multiple workers or sub-agents are used only when decomposition is genuinely independent.

Parallel sub-branches must state their base SHA, owner, allowed scope, forbidden/collision scope, exit criteria and BLOCKED_BY/integration dependency. They should be short-lived and merge back through the tranche integration gate rather than becoming independent long-lived streams. Documentation-only closure/fix-forward work should normally remain with the owning tranche unless explicitly marked PARALLEL_SAFE.

Default maximum remains **one owner-controlled forward tranche**. Concurrent sub-branches are determined by proven independence, not by the number of available agents.

---

# Cross-cutting quality model

Independent adversarial review is not a separate feature stream. It is mandatory process inside the single forward implementation stream.

For high-risk work, use:

```text
pre-implementation adversarial contract
  -> bounded implementation
  -> focused falsifiers
  -> production-path evidence
  -> post-implementation adversarial review
  -> exact-head promotion gates
  -> merge
  -> fresh-main re-fence where the programme requires a STOP review
```

Green CI is necessary, not sufficient. `VERIFIED COMPLETE` requires the evidence claimed by the owning programme plus an independent review disposition.

Status vocabulary:

- **PLANNED:** work is specified but no implementation claim exists.
- **IMPLEMENTATION PARTIAL:** some checkpoints landed but the stream exit is unsatisfied.
- **IMPLEMENTATION LANDED / REVIEW ACTIVE:** implementation path exists and required independent/physical evidence remains.
- **VERIFIED COMPLETE:** finite scope is implemented, exact evidence is satisfied and independent review found no unresolved blocker.
- **BLOCKED:** a named unmet prerequisite or falsified invariant prevents promotion.
- **DEFERRED:** intentionally outside the current wave; no implementation should begin without explicit reactivation.

---

# Work explicitly deferred from this wave

Do **not** start these merely because capacity exists:

- inferred clustering (`k`-means, DBSCAN/HDBSCAN, mixtures, spectral clustering, etc.) under the R2D source-partition identity;
- inferred relationship topology such as k-NN/correlation/similarity edges without a separate governed treatment;
- P2 RepresentationGraph/compositional representation search;
- generative geometry as a substitute for governed semantic payloads;
- broad automatic learned-representation expansion;
- the full major dependency-modernization programme in issue #300 while the current product-transition programme is moving;
- Node/toolchain/Three.js/Rust major migrations that would create cross-programme churn without a specific blocker.

Safe isolated patch/minor dependency maintenance and narrowly justified CI-action updates may proceed only when selected as the current bounded forward tranche and when they retain exact-head evidence.

---

# Completed and subordinate programme authorities

These remain authoritative for their scoped contracts/evidence even when their status headers reflect the checkpoint at which they were written:

- `roadmap/P1_R_SEMANTIC_EMBODIMENT_CONVERGENCE.md` - semantic embodiment architecture and R5/R2E requirements;
- `roadmap/P1_R2C_DENSITY_TRUTH.md` - completed density truth rail;
- `roadmap/P1_R2D_CLUSTER_REGIONS.md` - completed source-partition Cluster Regions V1 rail;
- `review/P1_R2D_C5_STOP_REVIEW_2026-08-31.md` - R2D independent closure evidence;
- `review/P1_R5_A5_STOP_REVIEW_2026-08-31.md` - P1-R5 progressive-disclosure closure evidence;
- `review/P1_R2E_B4_STOP_REVIEW_2026-09-01.md` - Relationship Graph V1 finite STOP evidence;
- `review/P1_UV_C1_FUNCTIONAL_WORLD_OBJECTS_POST_REVIEW_2026-09-01.md` - C1 functional world-object closure review;
- `review/P1_UV_C2_INVESTIGATION_STATE_LEGIBILITY_POST_REVIEW_2026-09-01.md` - C2 investigation-state legibility closure review;
- `review/P1_UV_C3_DESKTOP_XR_PARITY_POST_REVIEW_2026-09-01.md` - C3 desktop/XR task-semantics review;
- #616 - C4 visible investigator journey implementation/evidence record;
- `rfcs/0001-source-partition-cluster-authority.md` - durable R2D scientific decision;
- `roadmap/P1_UV_VISIBLE_PRODUCT_CONVERGENCE.md` - visible product convergence specification;
- `roadmap/P1_UV0_BASELINE_INVENTORY.md` - executable visible baseline/inventory;
- `roadmap/P1_QV_QUEST_VALIDATION_OPERATIONS.md` - Quest validation operations specification;
- `roadmap/P1_PRODUCT_TRANSITION_PLATFORM_AND_LEARNING_PLAN.md` - active product-transition tranche specification;
- `docs/archive/STREAM_C_SECURITY_ASSURANCE.md` - legacy-named security assurance finding set, now consumed by bounded P1-PT assurance tranches;
- `docs/archive/STREAM_A_IMPLEMENTATION_QUALITY_CONTRACT.md` - implementation-quality policy from the prior wave, still useful as process guidance but not the current Stream A mission;
- issue #620 - historical product-transition checklist through the earlier tranches; stale for current status/ordering, which is governed by this roadmap;
- issue #314 - post-Moneta hardening backlog;
- issue #300 - major dependency modernization, deferred as a broad sprint during this wave.

Historical review plans keep their original stream names for provenance. Do not reinterpret those labels as current concurrent ownership.

---

# Private-preview dependency chain

The high-level dependency remains:

```text
preserved source data
  -> truthful analytical evidence
  -> reproducible identity/replay
  -> bounded dataset-level representations
  -> progressive disclosure and structural breadth
  -> coherent investigator UX
  -> simulator-testable XR proof where relevant
  -> governed physical target-platform proof where required
  -> production wiring and security/privacy assurance
  -> minimal private preview
```

A/B/C and the legacy D labels remain useful programme/evidence boundaries, but P1-PT is now the active sequential execution frame. Quest supplies valuable reference evidence for standalone XR; it is not permission to weaken the product thesis, and it is not a blocker for unrelated product-transition work. No programme label permits weakening scientific, UX, security or evidence gates.

- **2026-09-18 Moneta dataset-first prerequisites:** explicit semantic abstraction levels, fail-closed raw-row presentation authority, SemanticEmbodimentGraph V1 and SpatialEmbodimentPlan V1 contracts, plus laboratory specimen capability discovery are landed prerequisites. **2026-09-20 ownership refinement:** `roadmap/P1_MCR_COMPOSITIONAL_REPRESENTATION_EXPANSION.md` now owns the future compositional RepresentationGraph -> SpatialEmbodimentPlan production path. Evolutionary synthesis/search and RepresentationGenome operators remain a separate laboratory workstream and may consume P1-MCR contracts only after their authority/version boundaries are stable.

### Adversarial Shadow Review (ASR) — closed-loop corrective feedback

**Status: READY / non-authoritative review and dispatch.** A high-capability shadow reviewer independently inspects durable outputs from implementation, RFL, architecture and model/agent experiments. Its job is to detect material correctness, scientific-validity, security, governance, production-behaviour and autonomous-loop reliability problems. It does not implement fixes, merge code, silently rewrite roadmap intent, or accept its own findings.

Shadow findings use the append-only ledger `governance/shadow/findings.jsonl`. Every finding must carry a stable id, UTC observation time, severity, confidence, affected artifact/PR/path, violated invariant or claim, observed evidence, causal hypothesis if any, cheapest independent reproduction, suggested owning lane and status. Observation and hypothesis are separate fields. Initial status is always `CANDIDATE`.

**Validation and dispatch protocol:**

1. **Independent validation before obligation.** A shadow finding becomes corrective work only after an independent worker reproduces it or the governing evidence/authority mechanism accepts it. The shadow cannot validate itself. Insufficient evidence produces `ABSTAIN`, not an invented decision.
2. **Severity controls interruption.** A validated critical/high finding affecting correctness, security, evidence authority, production behaviour or governance pre-empts the affected lane before new feature work. A validated normal finding enters that owner's next eligible tranche. Low-value style/process commentary is not admitted.
3. **Uncertain findings route to falsification.** Where the claim is experimentally decidable, send the candidate to RFL or another independent verifier with the exact invariant and cheapest reproducer. Architecture/governance ambiguity routes to an independent architectural/adjudication review instead.
4. **Roadmap changes remain governed.** A finding that implies sequencing, scope or architectural-policy change produces a proposed roadmap amendment for the administrator/maintainer. The shadow does not directly change roadmap intent.
5. **Worker intake is mandatory.** At the start of every Claude, OpenCode and Antigravity loop iteration, after refreshing `main`, inspect open validated shadow findings assigned to that lane before selecting ordinary roadmap work. Do not consume `CANDIDATE` as fact. Respect active leases/collision boundaries when taking corrective work.
6. **Fixes preserve the evidence trail.** Corrective PRs reference the finding id and the independent validation artifact. Do not weaken assertions, thresholds or governing criteria merely to make the reproducer pass.
7. **Independent closure.** After a corrective PR lands, rerun the original reproducer against the exact landed head. Record `VERIFIED_FIXED`, `REJECTED`, `SUPERSEDED` or `ABSTAIN` with evidence. The implementing worker cannot certify its own correction.
8. **No invisible queue.** A validated finding must have an owner or an explicit `UNROUTED` state. Critical/high `UNROUTED` findings are administrator exceptions and should surface immediately rather than waiting for a routine loop.
9. **Measure the reviewer.** Track findings raised, independently validated, rejected/abstained, defects caught before merge versus after merge, corrective latency, and review cost. If the shadow mostly emits false positives or ceremony, narrow or retire it.

The intended control flow is: **worker artifact → shadow candidate → independent validation/adjudication → routed corrective work → independent post-fix verification**. This separation prevents either the builder or the critic from marking its own homework while still closing the feedback loop automatically.

### Recursive Falsification Laboratory (RFL) — autonomous support loop

**Status: READY / non-authoritative support.** OpenCode running a low-cost model such as Spark may operate an open-ended bounded falsification loop through `npm run rfl:loop`. RFL is not a third production implementation stream: it recursively selects non-colliding under-examined surfaces, states an invariant, constructs the cheapest useful falsifier, runs it, and records reproducible candidate findings in `governance/rfl/findings.jsonl`.

Each cycle starts from fresh `main` in a dedicated `rfl/cycle-*` worktree. Before selecting a target it must read `AGENTS.md`, this roadmap, active PRs/worktrees/claims, the findings ledger and recent RFL tests. An empty ledger means begin discovery, not stop. Before promotion it must repeat the collision check because another worker may have claimed the surface while the experiment was running.

**RFL operating guardrails:**

1. **Explicit mutation allowlist, not a forbidden-path guess.** An RFL worker may write only additive falsification surfaces: RFL-owned tests, fixtures, simulations/harnesses, candidate records in `governance/rfl/findings.jsonl`, and narrowly isolated developer tooling explicitly created for the experiment. Production source, production contracts/registries, CI or promotion policy, `docs/ROADMAP.md`, and another worker's claimed paths are out of bounds.
2. **Committed changes count.** Capture the cycle's baseline HEAD before any work. Before commit and again before PR/merge, inspect both (a) the full committed name-status diff from that baseline to the candidate head and (b) dirty/untracked working-tree state. Renames and deletions count as mutations. Any path outside the allowlist produces `BLOCKED` and the cycle stops. A clean `git status` is not evidence that the worker stayed inside bounds.
3. **The worker cannot rewrite its own cage.** RFL iterations must not edit `scripts/rfl-loop.mjs`, `governance/rfl/iteration-contract.md`, `governance/rfl/README.md`, this roadmap section, or the mechanism that evaluates RFL permissions/results. Those surfaces require a separate maintainer/supervisor tranche.
4. **One crisp invariant per cycle.** State the invariant, the production seam being exercised, and the cheapest falsifying experiment before writing the test. A useful falsifier must prove it reached the intended seam and include an appropriate passing/control case so a vacuous test cannot masquerade as evidence. Prefer the real production boundary when practical; mocks are acceptable only when the claim being tested is itself about the mocked contract.
5. **Reduce before recording.** A failing experiment is not yet a finding. Reduce it to the smallest reproducible case, separate observation from causal hypothesis, and record exact base/head identities plus a rerun command. Timing, concurrency, networking and lifecycle findings should reproduce on at least two clean runs before entering the ledger; deterministic failures may use one reduced run when the evidence is intrinsically repeatable and the PR explains why.
6. **No repair and no self-adjudication.** RFL must not change production behavior to make a falsifier pass, set a candidate finding to accepted/closed, weaken an assertion, or change a threshold/authority rule. It may name a suggested owning lane. Independent reproduction/acceptance remains required before implementation.
7. **Novelty before volume.** Compare a proposed target with the ledger, recent RFL PRs and existing tests. Do not add another test that merely restates already-covered behavior. After two consecutive cycles in one subsystem, perform a broad cross-system survey and prefer a materially under-examined subsystem unless an unresolved residual is demonstrably higher-value. If a subsystem already has two unresolved candidate findings, normally pause new mining there until the owner triages them.
8. **Self-merge is limited to the support surface.** RFL may merge its own additive test/harness/finding-record PR only when the mutation audit passes, exact-head CI is green, the branch is current enough to make the collision check meaningful, and no review blocker exists. Any production, authority, roadmap, workflow or shared-contract mutation is handed off and must not be self-merged by RFL.
9. **Skipped reproducers are temporary evidence, not permanent debt.** A skipped reproducer may accompany an active candidate finding so CI remains truthful. Once the owning lane fixes or rejects the finding, RFL must independently rerun it and either convert it into a normal regression test or remove/retire it with the disposition recorded.
10. **Progress is an artifact, not a PID.** Every cycle ends with a machine-readable `PASS`, `FINDING`, `STOP_NO_NOVEL_TARGET` or `BLOCKED` result and either a durable experiment artifact or an explicit no-artifact explanation. A process that remains alive without producing a bounded result is stalled; the supervisor should terminate/recover it from fresh `main` rather than treating process liveness as progress. Repeated invalid/blocked iterations trip the existing circuit breaker.
11. **Cheap cognition stays advisory.** Spark/OpenCode and optional Jev checks may propose targets, experiment designs and interpretations, but neither may change scientific/production authority. Escalate to a stronger reviewer only when target selection, experiment validity or interpretation is genuinely ambiguous; routine execution should stay on the low-cost lane.

The controller imposes iteration/runtime budgets and stops after repeated blocked/invalid iterations or `STOP_NO_NOVEL_TARGET`. `STOP_NO_NOVEL_TARGET` is valid only after a broad survey; a busy forward lane, an empty findings ledger, or the absence of a pre-written roadmap ticket is not by itself a reason to stop. Conversely, the loop must not invent low-information work merely to remain busy.

**Feedback into implementation:** candidate RFL findings become implementation obligations only after independent reproduction/acceptance. A finding that intersects Claude's current or future evidence/platform tranche is attached as a falsifier to that tranche; unrelated accepted findings route to the appropriate future owner. After a fix, RFL independently reruns the reproducer. This keeps discovery and implementation authority separate while allowing continuous machine-generated pressure on the forward streams.


---

# Earlier roadmap snapshots consolidated

The sections below mirror older roadmap-history source files so historical roadmap archaeology has one reading entry point. The original files remain in place only to preserve existing links and provenance; they are not separate status authorities.


---

## Imported source: `ROADMAP_PRE_A_D_STREAMS_2026-08-31.md`

# Nemosyne Roadmap & Implementation Status

> **Canonical implementation-status and execution authority.** Product and research direction remain governed by `docs/Nemosyne_Definitive_Vision_and_Roadmap.md` V3. This file answers the operational questions: what is active now, which stream owns it, which PR comes next, what may run in parallel, what evidence is required, and what must wait. Detailed programme documents remain the specification/evidence authority for their own scope.

## Status snapshot - 31 August 2026

**Roadmap integration base:** `main@3cfbf41032a9760f467dd6a919b8b1fff882d61c` (#577 merged).

The completed three-stream convergence wave established the next representation frontier:

- #518 landed the RF-062A World composition-root guardrail;
- #520 landed RF-062B typed semantic intents;
- #523 landed RF-062C dataset/representation workflow ownership through `LoadDatasetUseCase` and `RepresentationSurface`;
- #519 promoted RF-061 version-coalesced derived analysis to `VERIFIED COMPLETE` on current-main evidence;
- #522 landed the first USIM-A XR lifecycle/async-race conformance scenario;
- #524 planned P1-UV visible product convergence so UI substrate work cannot be mistaken for a visibly converged product;
- #525 planned P1-R Rust-owned semantic embodiment convergence so dataset-level Moneta decisions stop collapsing into row-derived rendering;
- #526 planned P1-QV Quest validation operations so routine headset sessions can produce attributable evidence without laundering evidence classes.
- #528 measured the real browser/Worker/WASM envelope and exposed a presentation threshold cliff plus browser-observed Worker-port cost;
- #529 made the representation inventory and non-observation raw-row falsifier executable;
- #532 established the versioned bounded semantic embodiment payload boundary;
- #533 and #538 made the aggregate candidate the first `VERIFIED COMPLETE` Rust-owned dataset-level embodiment slice;
- #530, #534 and #536 completed the finite Stream C collaboration-authority wave at implementation/review level;
- #531, #535, #539-#543 completed the finite Stream B validation/baseline/task-first/contextual-locus wave at implementation/review level.

The previous A/B/C wave is closed to new scope. **Stream M - Moneta Distribution Truth** has also reached its finite exit: #544 established the stream and model routing, #547/#548 landed M1's governed contract and evidence, #549 landed the Rust/WASM builder, #550 landed the production cutover, #551 closed the density/outlier overclaim found in independent contract review, and #552 landed the visible product/scale/perceptual evidence handoff.

The post-M **UI convergence wave** has completed its substrate and shell convergence:

- #563 landed B-V1 visual system convergence (token canonicalisation, `MovablePanel` cleanup, palette deprecation, `VRMenu` retokenisation/retention pending a replacement for its curated live-source chooser, `SpatialAssetRegistry` removal, CSS variable injection);
- #564 replaced feature-`World` hosts with ports (`World` no longer the service container);
- #565 owned the analytical runtime lifecycle in `AnalyticalRuntimeOwner`;
- #566 isolated dev evidence installation (UV0/RF-062h);
- #567 retired `World` compatibility scaffolding (RF-062i);
- #568 landed the modern unified UI system: shared design-system components (`Card`, `Button`, `Toast`, `Modal`, `Tooltip`, `CommandPalette`), `InvestigationShell` replacing `AnalystJourneyControls`, `PanelRolesManager` simplified to `primary | secondary | diagnostic | system` with `ANALYST | DEVELOPER` modes, and `CommandPalette` (⌘K) parity;
- #572 railed P1-R2C Density Truth and recorded the post-UI/density adversarial findings;
- #573 closed RF-063/RF-067/RF-068 in the unified UI path;
- #576 closed RF-064/RF-065/RF-066 and versioned the truthful density ranking treatment;
- #577 completed the remaining density M1R constant-domain contract and real-WASM proof.

**P1-R2C Density Truth is the active finite representation programme.** M1 (#570), M2 (#571), and M1R (#576/#577) are landed. **M3 production cutover is next.** R2C must stop after M4 and independent review rather than continuing automatically into cluster, inferred topology, or another representation family.

The dependency chain remains:

```text
preserved source data
  -> truthful analytical evidence
  -> reproducible identity/replay
  -> bounded computation
  -> faithful dataset-level representation
  -> coherent investigator UX
  -> simulator-testable XR proof
  -> physical XR proof
  -> production wiring
  -> minimal private preview
```

## How to use this roadmap

An agent may be told simply:

```text
Complete Stream A.
Complete Stream B.
Complete Stream C.
```

Each stream has:

- a finite mission;
- explicit source/file ownership;
- ordered PR checkpoints;
- collision rules;
- evidence requirements;
- a hard exit gate;
- an explicit list of work it must not absorb.

A stream must stop at its exit gate and report. It must not continue into the next attractive roadmap programme automatically.

Detailed authorities used by this execution wave:

- [`roadmap/P1_R_SEMANTIC_EMBODIMENT_CONVERGENCE.md`](roadmap/P1_R_SEMANTIC_EMBODIMENT_CONVERGENCE.md) - P1-R semantic embodiment convergence;
- [`roadmap/P1_R2C_DENSITY_TRUTH.md`](roadmap/P1_R2C_DENSITY_TRUTH.md) - active finite density truth checkpoint rail;
- [`roadmap/P1_UV_VISIBLE_PRODUCT_CONVERGENCE.md`](roadmap/P1_UV_VISIBLE_PRODUCT_CONVERGENCE.md) - visible product convergence;
- [`roadmap/P1_QV_QUEST_VALIDATION_OPERATIONS.md`](roadmap/P1_QV_QUEST_VALIDATION_OPERATIONS.md) - Quest validation operations;
- [`review-plans/RF062_WORLD_COMPOSITION_ROOT_CONVERGENCE_2026-08-29.md`](review-plans/RF062_WORLD_COMPOSITION_ROOT_CONVERGENCE_2026-08-29.md) - World composition-root convergence;
- [`STREAM_C_SECURITY_ASSURANCE.md`](STREAM_C_SECURITY_ASSURANCE.md) - security assurance programme;
- [`STREAM_A_IMPLEMENTATION_QUALITY_CONTRACT.md`](STREAM_A_IMPLEMENTATION_QUALITY_CONTRACT.md) - implementation quality contract;
- [`Nemosyne_VR_UI_Design_System_and_Agent_Spec.md`](Nemosyne_VR_UI_Design_System_and_Agent_Spec.md) - VR/UI design and interaction contract;
- [`P1_ANALYTICAL_RESPONSIVENESS_AND_SPATIAL_FITNESS.md`](P1_ANALYTICAL_RESPONSIVENESS_AND_SPATIAL_FITNESS.md) - analytical and spatial acceptance criteria.

---

# Completed execution wave: A/B/C convergence

| Stream | Mission | Current finite exit |
| --- | --- | --- |
| **A - Analytical Scale & Representation Authority** | A1-A4 merged; A4 aggregate is `VERIFIED COMPLETE` for its bounded scope. | **EXITED** - do not reopen as a generic representation programme. |
| **B - Product UX & Quest Validation Operations** | B1-B5 merged; Quest attribution, visible baseline, task-first shell and contextual locus are implementation-landed/review-active. | **FINITE CHECKPOINTS MERGED** - residual UV/device evidence remains separately gated. |
| **C - Security & Collaboration Authority** | C1-C3 landed/reviewed; finite collaboration admission/framing/class-review exit is satisfied, with recorded residuals. | **EXITED** - later RF-039-RF-043 require a separately railed security wave. |

The old rule prohibiting a fourth stream applied to this now-completed wave. It must not be used to restart A/B/C scope implicitly.

---

# Completed execution wave: Stream M - Moneta Distribution Truth

## Mission and finite exit

Replace the semantically overclaimed `DISTRIBUTION_FIELD -> DENSITY_FIELD` presentation alias with one truthful, Rust-owned, bounded empirical-distribution representation that survives the full production path:

```text
explicit distribution-analysis intent + measure
  -> Moneta DISTRIBUTION_FIELD decision
  -> resident Worker/WASM dataset capability
  -> Rust empirical-distribution summary
  -> bounded semantic payload
  -> thin distribution-specific Three.js adapter
  -> visibly distinct product artifact
```

Stream M stopped after the production `DISTRIBUTION_FIELD` candidate was classified `DATASET_LEVEL_VALID` and exact-head evidence proved that it renders from a bounded Rust-owned payload without source-row traversal or density/PDF overclaim. It does not proceed automatically into density, cluster, progressive disclosure, RepresentationGraph or learned-model expansion.

| Checkpoint                                | Landed evidence                             | Status     |
| ----------------------------------------- | ------------------------------------------- | ---------- |
| **M1 - contract/falsifiers**              | #547 implementation; #548 governed evidence | **MERGED** |
| **M2 - Rust/WASM builder**                | #549                                        | **MERGED** |
| **M3 - production cutover**               | #550; #551 independent contract correction  | **MERGED** |
| **M4 - product/scale/perceptual handoff** | #552; exact-head browser run 33278263468    | **MERGED** |

**Finite exit:** satisfied for the reviewed browser scope. The typed user-facing `Show distribution` action, polished diagnostic composition, generic 100k/500k performance, connected ECDF/axes, progressive disclosure and physical Quest qualification remain explicit residuals rather than hidden completion claims.

## P1 mathematical contract

The first distribution object is a **univariate empirical distribution summary**, not a continuous density estimate. Its governed content is:

- an explicit numeric measure field; no silent field substitution;
- deterministic equal-width histogram bins with explicit domain and bin count;
- deterministic bounded ECDF knots;
- explicit quantiles at governed probabilities;
- source, valid, missing and non-finite observation counts;
- an explicit constant-domain policy;
- recorded binning, interpolation, missingness and bounded-sampling parameters;
- an information contract that preserves empirical-distribution shape while explicitly losing individual observation identity, exact per-observation values, continuous population-density semantics and formal outlier-boundary visibility.

The V1 slice must not use the words PDF, probability density, continuous contour, KDE or density field. Weighted/categorical/multivariate distributions, smoothing and inferential uncertainty are out of scope unless separately governed.

## Checkpoints

### M1 - distribution contract and falsifiers

- record the pre-implementation adversarial contract and independently calculable fixtures;
- add the discriminated request/payload types and Rust validator rules with hard bounds;
- split `DISTRIBUTION_FIELD` from density geometry in the candidate-to-embodiment contract;
- make tests fail if distribution aliases density geometry, accepts an implicit measure, carries rows, exceeds bounds or claims density/PDF semantics.

**Exit:** the cross-language contract is deterministic, fail-closed and mathematically reviewable; no production capability is claimed yet.

**Suggested PR:** `feat(moneta): define empirical distribution payload`

### M2 - Rust builder and real WASM proof

- compute the empirical distribution from the canonical resident columnar dataset handle;
- preserve missing/non-finite counts and legitimate zero values;
- apply resource bounds before output allocation;
- prove reference histograms, ECDF monotonicity/endpoints, quantiles, constant/empty/missing cases and deterministic serialization in Rust;
- cross the real WASM boundary using parameters/provenance only, never rows.

**Exit:** real WASM returns the truthful bounded envelope from a resident dataset capability; TypeScript contains no statistical implementation.

**Suggested PR:** `feat(moneta): build Rust empirical distribution`

### M3 - production cutover and thin embodiment

- extend the semantic loader/Worker operation without weakening generation/version/fingerprint/decision fencing;
- make `DISTRIBUTION_FIELD` consume only its payload through a small distribution adapter;
- remove its density-geometry alias and prohibit row fallback on pending/refused/failed output;
- preserve stable semantic IDs and artifact/payload provenance for selection and later drill-down;
- keep aggregate behavior unchanged.

**Exit:** task/requirements -> decision -> Worker/WASM -> payload -> visible artifact executes through the real production entry point and the A2 raw-row sentinel promotes only this candidate to `DATASET_LEVEL_VALID`.

**Suggested PR:** `feat(moneta): render empirical distribution payload`

### M4 - product, scale and perceptual handoff

- add a canonical fixture and browser evidence in which distribution intent visibly produces a distribution rather than points, aggregate bars or density voxels;
- record source N, payload elements/bytes proxy, rendered primitives and relevant browser timings at representative scales;
- bind perceptual evidence to the actual distribution payload/artifact identity;
- expose explicit pending/refused/unavailable state without fabricating a default visualization;
- record the residual handoff for the UI-owned typed `Show distribution` action if that separate stream has not yet landed it.

**Exit:** the visible result is distinct, truthful, bounded and inspectable; Quest/device qualification remains deferred.

**Suggested PR:** `test(moneta): prove visible distribution path`

## Advisory model routing for speed and quality

Model choice is an execution aid, not evidence. Tests, production-path proof and independent adversarial review remain authoritative. Use the strongest currently available coding/reasoning model where an error could change scientific meaning, authority, lifecycle fencing or product claims; use balanced/fast models only where the work is mechanically bounded.

Current mapping for the available Codex family:

| Profile | Current model example | Appropriate use |
| --- | --- | --- |
| **Frontier** | `gpt-5.6-sol` at `high` or `xhigh` reasoning | Scientific contract, Rust/WASM authority, concurrency/lifecycle, production cutover, adversarial review |
| **Balanced** | `gpt-5.6-terra` at `high` reasoning | Bounded fixtures, browser evidence plumbing, documentation and well-specified integration work |
| **Fast support** | `gpt-5.6-luna` at `medium` or `high` reasoning | Repository inventory, mechanical test enumeration, log triage and formatting; never sole scientific implementer/reviewer |

Recommended routing by checkpoint:

| Checkpoint | Implementer | Independent post-review | Rationale |
| --- | --- | --- | --- |
| **M1 - contract/falsifiers** | **Frontier / high** | **Frontier / xhigh** | The ontology, missingness, quantile/binning semantics and cross-language validator become the durable scientific contract. |
| **M2 - Rust/WASM builder** | **Frontier / high** | **Frontier / high** | Numerical correctness, bounds, canonical-handle authority and ABI behavior require strong systems and scientific reasoning. Fast support may enumerate fixtures only. |
| **M3 - production cutover** | **Frontier / xhigh** | **Frontier / xhigh** | Highest-risk tranche: Worker/runtime identity, stale-result fencing, row-fallback prohibition and visible semantic identity cross several ownership boundaries. |
| **M4 - product/scale evidence** | **Balanced / high** for evidence plumbing; **Frontier / high** for interpretation or fixes | **Frontier / high** | Much of the harness work is bounded, but interpreting performance/perceptual evidence and promoting claims requires frontier judgment. |

Escalate from Balanced/Fast to Frontier immediately when a task reveals an ambiguous scientific definition, a new ABI/public-format decision, inconsistent authority, nondeterminism, a resource-envelope change, or a production-path defect. Do not downgrade reasoning merely to reduce wall-clock time after a tranche becomes high risk.

## Parallel-work and collision rules

Stream M may run beside a separately railed UI stream that adds the typed `Show distribution` task transition. The UI stream owns action presentation and semantic-intent dispatch; Stream M owns analytical method, candidate fidelity, payload, Worker/WASM execution and the thin representation adapter. UI code must not calculate statistics, and Stream M must not redesign the shell.

Collision-sensitive integration files are `src/app/dataset/LoadDatasetUseCase.ts`, `src/app/dataset/SemanticEmbodimentLoader.ts`, `src/moneta/MonetaTopologyNode.ts`, `src/moneta/VRTopologyTranslator.ts`, `src/moneta/representation/RepresentationCandidate.ts`, and `src/vr/presentation/representation/RepresentationSurface.ts`. Only one open PR may change a given integration contract; dependent UI work must consume the merged contract or report `BLOCKED_BY_STREAM_M`.

---

# Universal stream rails

## Branch and PR lifecycle

Before every checkpoint PR:

1. fetch live `origin/main`;
2. record the exact base SHA;
3. confirm the previous checkpoint in the same stream is merged or explicitly abandoned;
4. create a fresh branch from current `main`;
5. implement only that checkpoint;
6. run focused falsifiers and required repository gates;
7. perform post-implementation adversarial review;
8. raise one PR;
9. merge only through the governed repository process;
10. after merge, fetch current `main` again before the next checkpoint.

**No stacked long-lived checkpoint branches.** Checkpoint N+1 may not be based on an unmerged checkpoint N branch.

## One open implementation PR per stream

At most:

```text
0 open Stream M implementation PR (finite stream exited)
1 open P1-R2C density implementation PR (M3 or M4)
1 open Stream A implementation PR
1 open Stream B implementation PR
1 open Stream C implementation PR
```

Streams A/B/C currently have no active implementation checkpoint; their entries remain the reusable concurrency ceiling for future explicitly railed waves. P1-R2C is the active finite representation rail. Do not open speculative future checkpoint PRs. Finish, review, merge, resync, then advance.

## Canonical roadmap ownership

Implementation PRs in Streams A/B/C/M and P1-R2C do **not** edit `docs/ROADMAP.md`.

After a complete wave of checkpoints merges, an integration scribe opens one tiny docs-only roadmap sync PR. This avoids recurring roadmap conflicts and keeps RF/status updates serial.

Detailed checkpoint evidence may be recorded in the owning programme/review document when required.

### Stream M primarily owns

```text
wasm/src/moneta/**
src/moneta/**
src/wasm/runtime/SemanticEmbodimentBridge.ts
the semantic-embodiment Worker operation
distribution request/payload contracts and tests
the narrow dataset-loader and representation adapters required by M2-M3
```

Stream M must not alter general UI surfaces, `World.ts`, collaboration/security, Quest validation tooling, unrelated analytical operations or other candidate mathematics.

## File ownership

### Stream A primarily owns

```text
wasm/src/**
src/moneta/**
src/wasm/**
src/atlas/**
representation authority contracts/tests
representation payload and ABI code
representation-specific embodiment adapters
analytical/browser resource-envelope measurement code
```

Stream A may change the narrow presentation adapter needed to consume its semantic payload. It must not redesign the general product shell, Quest validation tooling, signalling/collaboration, or generic UI.

### Stream B primarily owns

```text
src/ui/**
src/vr/ui/**
src/vr/ui-system/**
dev/xr-simulator/**
Quest validation launcher/tooling
validation evidence plumbing
desktop analyst shell
contextual task surfaces
visible-product evidence
```

During B1/B2, Stream B also owns the necessary `package.json` and `vite.config.ts` validation-mode changes.

Stream B must not implement analytical reductions, alter scientific candidate mathematics, or introduce JavaScript analytical fallbacks.

### Stream C primarily owns

```text
signalling admission and ticket verification
role parsing
NetworkManager collaboration authority
BinaryPoseSerializer / pose framing
security-boundary tests for those paths
```

Stream C must not redesign UI, Moneta, representation rendering, analytical code, Quest validation infrastructure, or generic application architecture.

## Collision-sensitive files

These are hot files:

```text
docs/ROADMAP.md
src/vr/World.ts
src/app/bootstrap.ts
package.json
vite.config.ts
```

Rules:

- `docs/ROADMAP.md`: integration checkpoint only;
- `World.ts`: Stream A and Stream C must avoid it; Stream B may touch it only when no narrower landed seam can express the behavior, and must justify the exception in adversarial review;
- `src/app/bootstrap.ts`: Stream B may use it for product/validation composition; other streams must prefer their existing narrow seams;
- `package.json` and `vite.config.ts`: reserved to Stream B while B1/B2 are active.

If another stream owns a required file, stop and report:

```text
BLOCKED_BY_STREAM_A | BLOCKED_BY_STREAM_B | BLOCKED_BY_STREAM_C
file: <path>
reason: <why it is required>
minimum change: <smallest required contract change>
```

Do not solve merge pressure by combining streams into one broad PR.

## Collision protocol after another stream merges

Before final verification, fetch current `main` and classify external movement as:

```text
NO IMPACT
REBASE ONLY
CONTRACT CHANGED
STREAM BLOCKED
```

If `CONTRACT CHANGED`, adapt only inside the current stream's ownership. If adaptation requires crossing ownership, stop and report the dependency.

## No opportunistic cleanup

Checkpoint PRs must not absorb unrelated:

- renames;
- folder reorganisations;
- dependency upgrades;
- formatting sweeps;
- general lint cleanup;
- unrelated UI restyling;
- test-framework replacement.

Record useful discoveries for a later owning checkpoint.

---

# Universal authority and evidence guardrails

## Analytical authority

Rust/WASM owns scale-sensitive and N-dependent analytical work. No stream may introduce a TypeScript/JavaScript statistical, clustering, density, scientific aggregate or scale-sensitive analytical fallback to keep a product path visually alive.

Unknown analytical evidence remains unknown. A missing Rust-derived structure may not be replaced with a plausible presentation heuristic and then labelled measured.

## Representation truth

Representation names must match mathematics actually computed. Suggestive geometry may not be called density, distribution, cluster boundary, manifold, spectral structure or equivalent unless the owning analytical implementation provides that semantic object with provenance.

Three.js embodies. It does not rediscover dataset-level analytical structure from source rows.

## Evidence classes remain distinct

Never collapse these into one generic `passed` state:

```text
unit/integration evidence
real browser evidence
desktop-simulator/IWER evidence
physical Quest dev-runtime evidence
governed physical Quest validation
clean-production physical qualification
```

Automation may reduce ceremony. It may not upgrade evidence class.

## Product-path evidence

A helper, class or mock proving a property is not sufficient evidence that the normal product path has that property.

Visible-product claims require the actual investigator entry path. Simulator evidence may prove simulator-testable spatial/input/lifecycle invariants, but it cannot qualify Quest frame pacing, through-lens legibility, real hand tracking, haptics, fatigue, comfort or target-device memory.

## Security evidence

A material security claim must prove:

```text
attacker-controlled input
  -> real production ingress
  -> authoritative check
  -> protected production sink
```

A hardened helper that is not the live authority does not close the finding.

## World/architecture rule

> **World may know everybody; nobody else may know World.**

RF-062A/B/C are landed guardrails/seams. Do not create `WorldContext`, `WorldServices`, `ApplicationManager`, `SystemManager`, `ServiceContainer`, a giant coordinator, giant renderer, or giant semantic payload as a disguised replacement god object.

## Lifecycle ownership

The owner that creates listeners, workers, interactables, updatables, panels or Three.js resources owns idempotent disposal. Repeated construct/start/stop/replace/restore cycles must not accumulate stale resources.

## Failure semantics

Unsupported scale, unavailable kernel, invalid evidence, malformed security input and unknown future schema versions fail explicitly. Do not convert refusal/failure into plausible substitute results.

---

# Mandatory adversarial review contract

Before implementing a checkpoint, identify:

```text
authority being changed
primary failure modes
duplicate-authority risk
real production entry point
falsifying evidence required
explicitly out-of-scope neighbouring work
```

After implementation, re-read the production path and answer:

1. Did the new implementation become the production path or is it decorative?
2. Did it create a second authority?
3. Did it create a replacement god class/coordinator/service bag?
4. Does the regression exercise the real authoritative boundary where the claim applies?
5. Are failures, refusals and unknown states still explicit?
6. Are lifecycle/disposal responsibilities owned and idempotent?
7. Did the PR cross another stream's ownership?
8. Is the acceptance claim narrower than or equal to the evidence?

Every implementation PR body must contain the exact heading:

```text
## Post-implementation adversarial review
```

and an explicit disposition such as `High-risk change` or `Low-risk exemption`. The current promotion controller treats that evidence marker as part of exact-head promotion evidence.

---

# Required checkpoint reporting

At every checkpoint, report:

```text
STREAM:
CHECKPOINT:
BASE SHA:
HEAD SHA:
PR:
STATUS:
WHAT LANDED:
WHAT WAS PROVED:
WHAT REMAINS UNPROVED:
NEW FINDINGS:
NEXT CHECKPOINT:
BLOCKERS:
```

At stream exit additionally report:

```text
STREAM EXIT GATE: PASS | PARTIAL | BLOCKED
SAFE NEXT PROGRAMMES:
PROGRAMMES THAT MUST STILL WAIT:
```

---

# Completed A/B/C parallel PR waves

The checkpoint waves below are retained as the execution record of the completed convergence wave. They are not authorization to restart those streams.

## Wave 1

| Stream | Checkpoint | Primary surfaces |
| --- | --- | --- |
| A | **A1 - real browser/Worker/WASM resource envelope** | analytical/browser measurement, Worker/WASM observation; no `package.json`/Vite edits |
| B | **B1 - QV0+QV1 validation manifest and Quest launcher** | validation types, launcher, `package.json`, Vite validation plumbing |
| C | **C1 - RF-037/RF-038 signalling admission authority** | ticket verifier, room admission, role parser, live-path security tests |

After all three merge, resync every stream from current `main`.

## Wave 2

| Stream | Checkpoint | Primary surfaces |
| --- | --- | --- |
| A | **A2 - P1-R0 representation inventory/falsifier** | representation tests/inventory, Moneta/translator call-path evidence |
| B | **B2 - QV2+QV3 local device metadata and session evidence sink** | Quest telemetry/dev evidence plumbing, ignored validation directories |
| C | **C2 - RF-057 channel-bound pose identity/framing** | NetworkManager, pose serializer, forged-sequence/frame adversaries |

After all three merge, resync every stream.

## Wave 3

| Stream | Checkpoint | Primary surfaces |
| --- | --- | --- |
| A | **A3 - P1-R1 semantic embodiment payload contract** | Rust/ABI/TS semantic payload types and parity tests |
| B | **B3 - P1-UV0 visible-product baseline** | screenshots/evidence/inventory; no broad visual redesign |
| C | **C3 - RF-058 collaboration trust-boundary class review** | review plus only material residual fixes; no PR required if clean |

After all three merge, resync every stream.

## Wave 4

| Stream | Checkpoint | Primary surfaces |
| --- | --- | --- |
| A | **A4 - Rust-owned aggregate representation vertical slice** | Rust aggregate builder, semantic payload transport, thin aggregate renderer |
| B | **B4 - P1-UV1 task-first investigator shell** | desktop/XR product shell and navigation hierarchy |
| C | **Review/idle** unless C3 found a material residual | no speculative expansion |

After A4/B4 merge, Stream B may run B5. Stream A performs its stream-exit review.

## Wave 5 - Stream B only

**B5 - P1-UV2 contextual locus of work.** Make common investigator actions visibly selection/object-attached through the landed semantic-intent boundary.

No other stream should begin a new broad programme merely because Stream B has one remaining checkpoint.

---

# Stream A - Analytical Scale & Representation Authority

## Mission

Establish measured whole-pipeline scale evidence and prove the first complete Rust-owned dataset-level semantic representation path. This stream deliberately stops after the aggregate vertical slice; it does not migrate every representation family.

### A1 - Real browser / module Worker / real WASM resource envelope

**Owners:** RF-015, RF-029, RF-035, RF-051, supporting RF-030/RF-031.

Measure the production-shaped path before choosing another optimization:

```text
browser input preparation
  -> Worker registration/transfer
  -> WASM resident state
  -> WASM transient work
  -> kernel execution
  -> result transfer
  -> JS materialisation
  -> presentation cost where relevant
```

Capture at least:

- JS heap trend/peaks where available;
- Worker transfer bytes and timing;
- WASM resident/transient estimates or measurements that can be reconciled with RF-029;
- kernel time;
- serialization/deserialization/materialisation cost;
- GC/scheduling observations where measurable;
- workload shape, row count, numeric dimensions and operation/profile identity.

**Guardrails:** measurement first; preserve kernel-inline refusal; preserve same-generation Worker residency; do not redesign the Worker protocol in this checkpoint; do not claim Quest/device qualification.

**Suggested PR:** `perf(rf-029/rf-051): measure whole-pipeline browser envelope`

**Exit:** evidence identifies the real dominant remaining costs and supplies a before baseline for P1-R/next optimization.

### A2 - P1-R0 production-path inventory and row-first falsifier

For every production-reachable semantic representation classify:

```text
OBSERVATION_LEVEL
DATASET_LEVEL_VALID
DATASET_LEVEL_ROW_DERIVED
SEMANTICALLY_OVERCLAIMED
NOT_PRODUCTION_REACHABLE
```

Trace:

```text
Moneta decision
  -> runtime translation
  -> embodiment
  -> rendered artifact
```

Record source N, JS row traversal, transferred elements, rendered primitives, claimed semantics and actual semantics. Add a mechanical falsifier that would fail if a migrated non-observation representation silently reintroduces raw-row analytical construction.

**Guardrails:** this is inventory/falsification work, not the renderer rewrite.

**Suggested PR:** `test(p1-r0): inventory and falsify row-first embodiment`

### A3 - P1-R1 bounded semantic embodiment payload contract

Define the smallest useful versioned/discriminated contract binding:

- schema version;
- canonical dataset fingerprint;
- candidate/family identity;
- analytical method and parameters;
- approximation/reduction mode;
- information preserved/lost;
- provenance/kernel/model identity as applicable;
- stable semantic IDs needed for selection/drill-down;
- representation-specific bounded payload.

**Guardrails:** no mega-payload; unknown versions fail closed; no JavaScript analytical recomputation; no generic renderer god class; one payload must cross Rust -> WASM/Worker -> TypeScript deterministically without rows.

**Suggested PR:** `feat(p1-r1): define bounded semantic embodiment payload`

### A4 - First vertical slice: aggregate representation

Move grouping/binning/aggregate calculation for the selected aggregate candidate completely into Rust and render only the bounded semantic result:

```text
canonical dataset
  -> Rust aggregate builder
  -> bounded semantic payload
  -> Worker/WASM transport
  -> thin Three.js adapter
  -> production representation artifact
```

Required proof:

- deleting source-row access from the aggregate renderer does not reduce aggregate functionality;
- zero/missingness semantics are preserved;
- no silent default measure is introduced;
- TypeScript performs no scientific grouping/aggregation;
- stable semantic IDs support interaction/provenance;
- before/after transfer and rendered-complexity evidence is recorded.

**Suggested PR:** `feat(p1-r): land Rust-owned aggregate embodiment`

## Stream A exit gate

Stream A stops when A1-A4 have merged and independent post-merge review agrees that:

- the whole browser/Worker/WASM baseline is measured;
- the row-first defect has a durable falsifier;
- the semantic payload contract is production-capable;
- one dataset-level aggregate representation is Rust-owned end to end and source-row-free at the renderer.

**Do not automatically continue** into density, distribution, cluster, manifold, multiscale, broad R3 ABI cutover, P2 RepresentationGraph or another speculative memory rewrite. Recommend the next slice from A1/A4 evidence.

---

# Stream B - Product UX & Quest Validation Operations

## Mission

Make routine Quest sessions attributable and make the normal Nemosyne investigator shell visibly task-first/contextual, while consuming rather than replacing Stream A's scientific authority.

### B1 - P1-QV QV0 + QV1 validation manifest and launcher

Provide explicit validation modes such as:

```text
npm run dev:quest
npm run dev:quest:perf
npm run dev:quest:ux
npm run dev:quest:10m
npm run dev:quest:validate
```

The launcher derives truthfully:

- exact Git/build SHA;
- clean/dirty/unknown worktree state;
- session/run ID;
- selected validation mode;
- owning gate/profile;
- runtime class;
- evidence class;
- local evidence directory.

**Guardrails:** ordinary `npm run dev`/`dev:wasm` remain unchanged; dirty runs remain useful but promotion-ineligible; Vite dev is not clean-production qualification; IWER is not physical evidence; current QUEST 10M cannot close PERF-04; launcher never edits source, roadmap or promotion state.

**Suggested PR:** `feat(p1-qv): add validation manifest and Quest launch modes`

### B2 - P1-QV QV2 + QV3 local device metadata and isolated evidence sink

Add truthful reusable local declaration for facts the browser cannot infer reliably, for example Quest model, firmware and investigator label. Keep investigator-declared values distinct from runtime-measured browser/XR/WebGL facts.

Validation runs receive per-session ignored storage such as:

```text
logs/validation/<session-id>/
  manifest.json
  loadtest-results.jsonl
  analysis.json
  disposition.json
```

**Guardrails:** never guess firmware; preserve failed/aborted evidence; remain git-ignored; do not add raw dataset rows, unrestricted camera trajectories or unnecessary sensitive interaction histories merely for convenience.

**Suggested PR:** `feat(p1-qv): isolate attributable Quest validation evidence`

### B3 - P1-UV0 canonical visible-product baseline

Before redesigning, capture deterministic production-build screenshots/states and inventory every normal-mode persistent surface/object.

Classify each:

```text
KEEP
CONVERGE
DEMOTE
REPLACE
REMOVE
```

Record the fresh-start/first-insight path and obvious subsystem/panel-first friction.

**Guardrails:** B3 changes evidence/inventory, not product treatment. Do not call substrate migration a visible improvement.

**Suggested PR:** `test(p1-uv0): establish visible-product baseline`

### B4 - P1-UV1 task-first investigator shell

Make fresh start visibly oriented around dataset/investigation context and the next meaningful investigator task rather than engineering subsystem controls.

Use RF-062B semantic intents as the application-facing vocabulary. Demote diagnostics and redundant legacy navigation from normal analyst mode. Desktop becomes a deliberate Nemosyne counterpart rather than raw developer controls.

**Guardrails:** no new analytical semantics; no Moneta ranking/candidate-math changes; no duplicate desktop/XR semantic command; data remains more salient than chrome; no persistent decorative object without a tested function.

**Suggested PR:** `feat(p1-uv1): converge task-first investigator shell`

### B5 - P1-UV2 contextual locus of work

Move common tasks toward the selected object/region/context rather than global panel navigation. Canonical novice vocabulary includes:

```text
Inspect
Compare
Challenge
Record
Navigate
More
```

Required operations must resolve to the same semantic intent across desktop, controller/ray and supported direct-touch paths. Disabled/unavailable actions expose reasons. Essential work may not depend on memorised expert gestures.

**Guardrails:** preserve the three-surface budget; do not alter representation mathematics; do not create a second command authority.

**Suggested PR:** `feat(p1-uv2): make investigator actions contextual`

## Stream B exit gate

Stream B stops when B1-B5 have merged and post-merge review agrees that:

- normal Quest validation runs have attributable build/evidence metadata with isolated local evidence;
- UV0 provides a trustworthy baseline;
- normal startup is visibly task-first;
- common investigator actions are contextual and semantically shared across applicable modalities.

**Do not run final P1-U9/PERF-04/UX-03 qualification.** Do not claim final data-world visual convergence until Stream A/P1-R has supplied reviewed dataset-level semantic embodiments. UV3-UV7 and the remaining USIM/physical evidence belong to the next product convergence wave selected after A/B exit review.

---

# Stream C - Security & Collaboration Authority

## Mission

Fix the most immediate collaboration trust-boundary defects independently of product/UI and analytical work. This stream is deliberately narrow enough to delegate to a focused subagent.

### C1 - RF-037 + RF-038 canonical signalling admission authority

Converge to:

- one versioned ticket schema;
- one role ontology;
- exact allowed roles (`observer`, `participant` unless the canonical contract deliberately says otherwise);
- nonce/replay prevention enforced at successful real admission;
- deterministic second-use rejection through `createRoomRegistry().handleConnection()` or the actual canonical live admission path;
- removal/quarantine of the obsolete duplicate ticket authority.

**Guardrails:** do not merely swap verifier imports; resolve schema/role/nonce-lifetime semantics; do not weaken authentication for tests; malformed/unknown roles fail closed; tests attack the real admission path.

**Suggested PR:** `fix(rf-037/rf-038): converge signalling admission authority`

### C2 - RF-057 channel-bound pose sequence identity and framing

Move pose replay/staleness sequence ownership to the signalling-authenticated/channel-bound string peer identity. Embedded numeric identity is non-authoritative metadata or is removed.

Required adversaries:

- peer A forges numeric identity of B with a huge sequence, then B's legitimate next pose is still accepted;
- duplicate same-peer frame rejected;
- out-of-order same-peer frame rejected;
- reconnect/generation reset is safe;
- 39-byte and 41-byte frames rejected where the contract requires exactly 40 bytes;
- NaN/Infinity and invalid bounded pose/quaternion values fail closed;
- numeric-ID collision cannot merge peer sequence state.

**Guardrails:** do not turn this into a collaboration rewrite; the authenticated channel identity remains authoritative.

**Suggested PR:** `fix(rf-057): bind pose sequence authority to channel peer`

### C3 - RF-058 collaboration trust-boundary class review

After C1/C2 merge, search the affected collaboration/security class for duplicate authorities, alternate ingress/admission paths, compatibility bypasses, stale helpers and helper-only tests.

Classify each finding as:

```text
security vulnerability
integrity/robustness problem
maintainability problem
false positive / accepted harmless case
```

Add only material production-path regressions. If no material residual exists, **do not manufacture a PR**.

If residual code work is needed, suggested title:

`fix(rf-058): close collaboration trust-boundary bypasses`

## Stream C exit gate

Stream C stops when C1-C3 establish:

- one authoritative signalling ticket/role protocol;
- replay protection on the live admission path;
- fail-closed role parsing;
- channel-bound pose sequence/replay state;
- exact/finite framing validation;
- no material duplicate/bypass authority in the reviewed collaboration trust boundary.

Do not start USIM-C before C1/C2 have merged and been independently re-read. RF-039/RF-040/RF-041/RF-042/RF-043 remain the candidate **next Stream C wave**, not scope creep for this one.

---

# Roadmap integration checkpoint after each wave

When all checkpoint PRs in a wave are merged:

1. integration scribe fetches current `main`;
2. reads the merged evidence;
3. adversarially checks that status claims match evidence;
4. opens one tiny docs-only PR updating this file;
5. records new RF findings without automatically expanding current scope;
6. does not change scientific/device/security completion merely because CI is green.

This integration PR contains no runtime/product code.

---

# Current programme mapping

| Programme / RF | Current interpretation | Current stream/checkpoint |
| --- | --- | --- |
| RF-015 / RF-029 / RF-035 / RF-051 | A1 measured the current browser/Worker/WASM envelope; generic 10M claims and complete memory/transfer accounting remain blocked. | Consumed by later representation evidence; preserve A1 baseline |
| RF-030 / RF-031 | Kernel-inline refusal exists; approximation/generic-operation residuals remain, and completed distribution work preserved explicit resource refusal. | Preserve through R2C M3/M4 |
| RF-001 / RF-002 / P1-R semantic embodiment convergence | Aggregate and empirical distribution are Rust-owned dataset-level slices. Density M1/M2/M1R are now truthful, bounded, strict and row-free at the Rust/WASM boundary, but `DENSITY_FIELD` is not yet production-cut over. | **P1-R2C M3 NEXT** |
| RF-036 topology/spatial evidence authority | Still open; it must not be silently declared solved by empirical distribution or density work. | Preserve; not R2C scope |
| RF-044 / RF-045 / RF-046 / RF-047 / RF-048 | Implementations landed; remain review-monitored foundations for graph lineage, evidence truth, digest/replay and identity. | Preserve; not current frontier |
| RF-059 | Row-identity scale fix landed/review active; preserve regression. | Preserve under A1 evidence |
| RF-060 | Authoritative dataset fingerprint retention work landed; preserve measured identity path. | Preserve under A1/A3 |
| RF-061 | Version-coalesced derived analysis settlement verified on current-main evidence (#519). | Stable dependency |
| RF-062 | A/B/C tranches landed: composition-root boundary, semantic intents, dataset/representation seam. | D-I require a new explicit rail after hot-file settling |
| P1-QV | B1-B2 implementation landed; broader/final device evidence remains open. | Preserve; next validation work separately railed |
| P1-UV | B3-B5 finite first wave implementation landed/review active; #568 unified the shell and #573 closed the immediate pointer/dev-role/palette regressions. | Separate next UI wave remains queued; no active R2C parallel lane |
| RF-049 | Code-level Direct Touch repair landed; simulator/device verification remains. | Preserve in B; final physical evidence later |
| RF-050 | UI substrate evidence still requires browser/simulator/physical separation. | Next B/product evidence wave; not finalised by B5 |
| P1-USIM | USIM-0 + first USIM-A lifecycle scenario landed/review active. | Preserve; broader USIM-A/USIM-1 selected after B exit |
| RF-037 / RF-038 | C1 canonical admission/replay/role authority landed. | Preserve; deployed-path proof remains later |
| RF-057 | C2 channel-bound collaboration presence integrity fix landed. | Preserve; deployed-path proof remains later |
| RF-058 | C3 collaboration finding-class review completed with recorded residuals. | Preserve review discipline |
| RF-039 / RF-040 / RF-041 / RF-042 / RF-043 | Important security/privacy/supply-chain/hostile-boundary backlog. | Next Stream C wave after C exit |
| P1-U9 / PERF-04 / UX-03 | Final product/device qualification. | **DEFERRED** until P1-UV and relevant P1-R convergence |
| P1-W / RF-053-RF-056 | Clean artifact/deployed-service/release convergence. | **DEFERRED** until product/UI qualification entry gate |
| Minimal private preview | Controlled deployment and research cohort. | **DEFERRED** until P1-W exit and applicable security gates |
| P2 RepresentationGraph | Composition/search. | **DEFERRED** until reviewed P1 prerequisites |
| P3 Adaptive Nemosyne | Autonomous/longitudinal adaptation. | **DEFERRED** until learning/outcome/governance evidence |

---

# Promotion and defer gates

## Do not start final physical Quest qualification yet

P1-U9, PERF-04 and UX-03 must qualify the **converged** product, not the legacy/substrate-only treatment. Final runs wait for:

- the relevant P1-UV treatment convergence;
- Stream A/P1-R dataset-level representation changes needed by the tested journey;
- the required P1-QV evidence tooling where it reduces ceremony without weakening evidence class.

Routine headset trials remain useful under B1/B2 and may produce governed dev-runtime evidence, but they do not automatically close final promotion gates.

## Do not start P1-W production wiring yet

Inventory/design may continue, but product-facing endpoint/capability wiring and release promotion wait until P1-U/P1-UV/P1-U9 have stabilised the surfaces being deployed.

RF-053 clean-artifact re-verification remains important, but do not confuse a clean build smoke with full P1-W completion.

## Do not start USIM-C yet

USIM-C is gated on C1/C2 authoritative security fixes. IWER may drive clients after that point, but simulator success cannot substitute for live security-boundary proof.

## Do not start P2/P3

RepresentationGraph composition and Adaptive Nemosyne remain behind P1 correctness/reproducibility/representation/product gates. The current P1-R work is about making single selected representations truthful and executable, not opening compositional search.

---

# Governing status vocabulary

- **PLANNED:** accepted work with no production implementation claim yet.
- **IMPLEMENTATION PARTIAL:** bounded/scaffolded pieces exist but the required production path is incomplete.
- **IMPLEMENTATION LANDED:** planned production code exists and implementation gates passed.
- **REVIEW ACTIVE:** independent review/evidence still finds unresolved defects, semantic gaps or missing acceptance evidence.
- **VERIFIED COMPLETE:** implementation and independent evidence agree on the governing exit criteria.
- **DEFERRED:** intentionally inactive because prerequisites are unmet.

A merged PR or green CI is implementation evidence, not immunity from review. Review may reopen a completion claim.

---

# Fixed design boundaries

These remain invariant across all streams:

- **Rust owns N-dependent analytical work.** Parsing, filtering, statistics, clustering, topology, spectral analysis, data-derived reduction and scientific aggregate work do not migrate into presentation code.
- **Lossless copies preserve scientific content.** Graph edges/weights/attributes and other governed source semantics may not disappear across ordinary clone/restore/registration paths.
- **Missing is not zero.** Invalid/missing primitive slots do not silently become Euclidean coordinates.
- **Unknown is not neutral.** Missing evidence remains unknown; priors/heuristics are explicitly labelled.
- **Time is data, not row order.** Temporal/spectral evidence uses authoritative time coordinates and governed regularity assumptions.
- **One durable dataset identity.** `datasetFingerprint` means the canonical collision-resistant scientific identity.
- **Investigation digests commit semantic state.** Presentation-only state is deliberately excluded; governed semantic changes alter the digest.
- **Atlas owns durable analytical capabilities.** Reuse handles/references rather than serialising the same dataset back into Rust without need.
- **Moneta is a bounded control plane.** It reasons over compact evidence and semantic requirements, not raw full-dataset traversal.
- **Semantic representation survives embodiment.** Dataset-level candidates may not silently degrade into point-per-row or mathematically different presentation approximations.
- **Observations are detail, not universal geometry.** Observation-level geometry remains valid when explicitly selected or progressively disclosed.
- **JS presents, orchestrates and schedules.** It does not create a shadow analytical authority.
- **Production-path evidence governs shipped claims.** Helper-only evidence cannot prove a production property.
- **Authenticated transport identity outranks payload identity.** Untrusted embedded IDs cannot become a second collaboration authority.
- **Security findings close by threatened class/boundary, not scanner line.** Search bypasses/duplicates and classify severity honestly.
- **A visible capability requires a deployed dependency or honest unavailable state.** Dev-only endpoints are not production capabilities.
- **Interaction completion means semantic parity.** Different modalities may differ mechanically but commit one governed semantic action.
- **UI substrate is not visible product convergence.** Shared components and green tests do not complete P1-U/P1-UV.
- **Source rows are not render primitives or dataset-level analytical reduction inputs.** Large source N must not imply proportional renderer work for bounded representation families.
- **Worker handles are local capabilities.** Cross-thread identity uses canonical identity and explicit registration, not foreign handles.
- **Sparse means sound before fast.** Approximation may omit information only under an explicit, provenance-bearing contract.
- **Unbounded work fails explicitly.** Worker scheduling is not a resource budget.
- **Resource estimates are not device qualification.** Browser/Quest performance claims require measured workload/device evidence.
- **Perceptual evidence is identity-bound.** Candidate/dataset/model/viewpoint/device context must match before affecting ranking.
- **The world is an interface, not scenery.** Persistent world objects must earn their place with an investigator function.
- **Hard constraints precede learning.** Learned ranking cannot resurrect infeasible candidates.
- **Learning never owns research facts.** Learned features consume governed analytical evidence.
- **Skepticism targets claims, not people.** Pattern-fragility/apophenia support remains explainable and actionable evidence about claims.
- **No Gate 9/10 leapfrogging.** P2/P3 cannot substitute for P1 correctness, reproducibility, scale, representation and product evidence.

---

# Verification cadence

For each PR, run the cheapest authoritative proof for the claim plus required repository gates. Depending on scope this includes:

```text
Rust unit/property/metamorphic tests
focused JS/WASM boundary tests
TypeScript typecheck + lint
deterministic Node/UI/integration tests
architecture/import/authority fixtures
real module Worker + real WASM tests when claimed
browser product-path tests when claimed
IWER desktop-simulator tests when simulator-testable XR behavior is claimed
security admission/ingress tests through the live path when security is claimed
portable investigation digest/replay/tamper tests when reproducibility is claimed
scale measurements across JS + Worker + WASM when scale is claimed
physical Quest validation only when device properties are claimed
```

Before merge:

1. sync/rebase on current `main`;
2. run focused falsifiers;
3. run required CI and CodeQL/governance gates;
4. inspect review comments/threads;
5. complete the post-implementation adversarial review;
6. ensure exact-head promotion evidence is present and truthful.

Green engineering CI must never be described as scientific verification, security verification, usability verification or physical Quest qualification unless the required evidence was actually collected.

---

# Active post-M programme: P1-R2C Density Truth

The evidence-selected post-M representation slice is now explicit rather than unselected. Its detailed execution authority is [`roadmap/P1_R2C_DENSITY_TRUTH.md`](roadmap/P1_R2C_DENSITY_TRUTH.md).

Landed checkpoints:

- M1 contract and initial real-WASM falsifiers: #570;
- M2 resident-columnar Rust builder: #571;
- M1R lattice/ontology/ranking/strict-method repair: #576;
- M1R constant-domain closeout: #577.

**Next:** M3 production cutover. `DENSITY_FIELD` must reach the resident Worker/WASM builder and render only from the returned bounded semantic payload. Pending/refused/stale/invalid output must not fall back to row-derived points, voxels, or legacy density geometry.

After M3, M4 must collect bounded product/scale/memory/perceptual evidence, including the current O(N) transient pair-vector cost. R2C then **stops for independent review** before any Cluster Regions, inferred-topology, or other representation programme begins.

Other programmes that remain explicitly queued include:

- RF-036 canonical topology/spatial evidence authority where it blocks truthful representation work;
- remaining P1-UV UV3-UV7 plus selected USIM-A/USIM-1 evidence;
- RF-062D/E/F architecture convergence after current UI/representation hot files settle;
- next Stream C wave: RF-039/RF-040/RF-041/RF-042/RF-043;
- governed physical Quest qualification after the converged treatment exists;
- P1-W only after its product-entry gate;
- minimal private preview only after product, security and release gates converge.



---

## Imported source: `ROADMAP_PHASES_21-26_COMPLETED.md`

# Completed Roadmap Archive: Phases 21–26 & Waves 0–6

> **Archived Historical Document.** This document captures completed work from Phases 21 through 26 and Waves 0 through 6 (August 2026). It is preserved for auditability and historical context. Do not use this document to determine active project status or future sprint commitments.
>
> The governing product and implementation specification is [`../Nemosyne_Definitive_Vision_and_Roadmap.md`](../Nemosyne_Definitive_Vision_and_Roadmap.md).
> The active, forward-looking roadmap is [`../ROADMAP.md`](../ROADMAP.md).

---

## Summary Index of Completed Phases & Waves

| Phase / Wave | Title / Focus | Completion Summary | Key Deliverables & Test Suites |
|---|---|---|---|
| **Wave 0** | Security P0, Dead Code & Hygiene | Dev endpoints bounded, path traversal resolved, constant-time tokens, file size limits. | `RemoteDebugStreamer`, `FileLoader` size checks, Netlify CI consolidation. |
| **Wave 1** | Rust Analytical Kernel ABI (`v0.2.0`) | Deterministic computational substrate: FNV-1a UTF-16 fingerprinting, predicate DSL, statistics, TDA Mapper. | `wasm/src/data/`, `wasm/src/provenance.rs`, `RuntimeBridge.ts` wrappers (85 Rust tests). |
| **Wave 2** | Mandatory WASM Analytical Cutover | JS analytical fallback eliminated; Rust kernel established as sole analytical authority. | `DataOperationController._computeDataset` kernel routing, hard "WASM unavailable" state. |
| **Wave 3** | Orphaned JS Analytical Module Cleanup | Deleted 7 legacy JS analytical engines (`DatasetOperations`, `CSVDataParser`, `TDAMapper`, etc.). | Commit `367cdcd`, clean separation of visual helpers vs computation. |
| **Wave 4** | AtlasCore & NemosyneSession | Single analytical authority owning kernel handle, DatasetSpace, AnalysisResult chain, and provenance ledger. | `src/atlas/AtlasCore.ts`, `src/session/NemosyneSession.ts` (`tests/atlas-core.test.ts`). |
| **Wave 5** | Draco as Pure Embodiment Consumer | Draco performs zero statistical extraction; AtlasCore acts as authoritative `FactProvider`. | `src/draco/ConstraintEngine.ts`, `FactProvider` interface (`tests/evidence-draco.test.ts`). |
| **Wave 6** | Full AtlasCore Routing & Number Parity | All production kernel calls routed via AtlasCore; ledger-derived history; ECMAScript number stringification. | `fingerprint.rs` ECMAScript parity, `_tdaCall` transient handles, clean disposal. |
| **Phase 21** | Rust/WASM Migration | 3D spatial layout simulation (force-directed, grid, time ribbon, geo surface, streamline) & Draco solver in WASM. | `wasm/src/layouts/`, `wasm/src/draco/solver.rs`, continuous Float32Array coordinate bridges. |
| **Phase 22** | UX V2.0: Low-Strain Spatial Interface | TDA glyphs, accessibility steppers, embodied peer avatars, binary quaternion pose, GPU resource disposal. | `ObjectPool` teardown, zero-allocation hot paths, `StatusStripController`. |
| **Phase 23** | Gesture Intelligence & Retraining | 56-dim feature vector, heuristic+ONNX classifier, on-device threshold tuning, consent-gated upload pipeline. | `modules/gesture-intelligence/`, `GestureIntelligenceAdapter`, `GestureRetrainService`. |
| **Phase 24** | Analyst Cockpit & Interaction Hierarchy | InteractionMode FSM (`NAVIGATE/INTERACT/TRANSFORM/OBSERVE`), forgiving 3-level HandWheel, contextual panels. | `InteractionModeController`, `HandWheelCategorizer`, `PanelRolesManager`, `TransientContextCards`. |
| **Phase 25** | Multimodal Perception & On-Device Trials | Quest 3S hardware envelope validation (<13.88ms frame time, <250MB heap), aim-drift mitigation. | `QuestFieldTrialSuite`, `UXHypothesisTriageEngine`, `PositionSemanticClassifier`. |
| **Phase 26** | Empirical Recommender Tuning & Study Eval | 2D-vs-VR statistical analyzer (t-tests, Cohen's d, NASA-TLX), empirical Draco utility tuner. | `StudyStatisticalAnalyzer`, `DracoEmpiricalTuner`, `InvestigationBranchManager`. |

---

## Detailed Sprint & Wave Completion Logs

### Sprint 26.2: Evidence-Informed Draco Recommender Adaptive Loop
- **Empirical Recommender Tuner:** Implemented `DracoEmpiricalTuner` (`src/draco/evidence/DracoEmpiricalTuner.ts`) connecting empirical study trial outcomes (accuracy, completion duration, and NASA-TLX workload) directly to Draco layout utility weights and topology preference costs.
- **Adaptive Preference Scoring:** Promotes spatial representations demonstrating statistically superior task performance while penalizing configurations with high cognitive workload.
- **Unit Test Suite:** Added `tests/draco-empirical-tuner.test.ts` testing empirical weight adjustments, topology preference tuning, and solver override weight synthesis.
- **Gates:** `tsc --noEmit` 0 errors · `eslint` 0 errors · `npm test` 217/217 test files passed (1,444 passed / 26 skipped jsdom-WASM parity by design) · `cargo test` 85/85 passed · `npm run build` exit 0.

### Sprint 26.1: Semantic vs. Structural Position Discipline & Disambiguation Engine
- **Position Semantics Classifier:** Implemented `PositionSemanticsEngine` (`src/draco/PositionSemantics.ts`) distinguishing `SEMANTIC` (coordinates directly map geographic/temporal/vector variables), `STRUCTURAL` (coordinates expose topological graph edges/clusters), and `ALGORITHMIC_LAYOUT` (procedural grid/ring spacing with no semantic distance equivalence).
- **Diegetic Proximity Warning System:** Adds structured warnings to HUD tooltips preventing analysts from falsely assuming that geometric proximity in force-directed graphs or procedural grids implies underlying attribute similarity.
- **Unit Test Suite:** Added `tests/position-semantics-discipline.test.ts` testing layout classification, badge color assignment, and HUD warning formatting.

### Milestone 25.3: 2D-vs-VR Statistical Analysis Engine & Empirical Study Evaluation
- **Empirical Statistical Analyzer:** Implemented `StudyStatisticalAnalyzer` (`src/study/StudyStatisticalAnalyzer.ts`) computing two-sample t-tests, degrees of freedom, p-value estimates via standard Abramowitz-Stegun error function approximation, and Cohen's d effect sizes across task completion duration, anomaly isolation accuracy, F1 score, confidence, and NASA-TLX workload scores.
- **Structured Markdown Report Synthesis:** Synthesizes structured outcome markdown tables comparing 2D desktop controls vs. VR experimental conditions conforming to `docs/study/ANALYSIS_PLAN.md`.
- **Unit Test Suite:** Added `tests/study-statistical-analyzer.test.ts` verifying two-sample t-tests, Cohen's d effect magnitude classifications, and experiment evaluation reporting.

### Milestone 25.2: Quest 3S On-Device Field Trial Suite Execution
- **Automated Field Trial Suite:** Implemented `QuestFieldTrialSuite` (`src/vr/scalability/QuestFieldTrialSuite.ts`) automating multi-stage load-test probe execution across dataset scales (1k, 5k, 20k, 50k, 100k nodes) validating Quest 3S physical compute envelopes (72 Hz / 13.88ms frame budget, <5% dropped frames, <250 MB heap).
- **Audit Certificate Generator:** Generates verifiable field trial compliance certificates with deterministic hashes for research publication bundles.
- **Unit Test Suite:** Added `tests/quest-field-trial-suite.test.ts` testing multi-stage execution, hardware envelope validation, and budget violation reporting.

### Sprint 25.1: Quest Spatial Tracking & Aim-Drift Ergonomics Hardening
- **Aim-Drift Mitigation:** Mitigated pointer ray precision loss by pairing coarse gaze targeting with explicit pinch and dwell confirmation.
- **Biomechanical Zoning:** Enhanced `WorldSpatialContext.ts` with ergonomic reach classification (`SWEET_SPOT`, `NEAR_FIELD`, `EXTENDED`, `PERIPHERAL`).

### Sprint 24.1 through 24.9: Analyst Cockpit & Interaction Hierarchy
- **Sprint 24.1 (Interaction Mode FSM):** Authoritative `NAVIGATE | INTERACT | TRANSFORM | OBSERVE` modes in `InteractionModeController.ts`; unified `FocusState` vocabulary.
- **Sprint 24.2 (HandWheel Categorization):** Analyst-intent categories (`ANALYSE | VIEW | DATA | STUDY | COLLABORATE | SYSTEM`) and gaze+confirm state machine in `HandWheelCategorization.ts`.
- **Sprint 24.3 (Task Surface Decomposition):** `ContextualTaskSurface.ts` filtering actions dynamically by topology, replacing monolithic 29-button menu walls.
- **Sprint 24.4 (Panel Roles Taxonomy):** Enforced `workspace | task | context | diagnostic | transient | system` roles, max 2 task panels rule, and diagnostic gating to `DEVELOPER` mode.
- **Sprint 24.5 (Transient Context Cards):** Ephemeral cards (`TransientContextCards.ts`) for dataset loaded, recommendation, and drift alerts.
- **Sprint 24.6 (Progressive Disclosure):** Profiles (`NOVICE | ANALYST | RESEARCHER | DEVELOPER`) in `ProgressiveDisclosure.ts`.
- **Sprint 24.7 (Gesture Ownership Redesign):** Contextual both-pinch resolution in `GestureOwnershipManager.ts` with zero silent suppression.
- **Sprint 24.8 (Calm Visual Language & Status Strip):** Semantic palette and persistent status strip in `StatusStripController.ts`.
- **Sprint 24.9 (UX Acceptance Quality Gates):** Quantitative CI quality gate evaluator (`UXAcceptanceGate.ts`) tracking UX-001 through UX-012.

### Sprints 23.1 through 23.5: Gesture Intelligence & Lifecycle
- **Sprint 23.1 (Host Integration):** `GestureIntelligenceAdapter.ts` translating Three.js hand tracking into `HandSample` records for `@nemosyne/gesture-intelligence`.
- **Sprint 23.2 (Personalization Loop):** In-experience capture and closed-loop threshold coordinate-search optimization.
- **Sprint 23.3 (Global Capture Pipeline):** Consent-gated upload pipeline with Tier A (56-dim feature only, zero raw biometric coordinates) and rotatable pseudonymous hashes.
- **Sprint 23.4 (Retraining Service):** Central training pipeline with user-disjoint evaluation splits.
- **Sprint 23.5 (Drift Monitoring):** Anonymous heuristic vs ONNX divergence tracking and drift alerts.

### Waves 0 through 6: Rust Analytical Kernel, AtlasCore & Session Provenance
- **Wave 0:** Security hardening, bounded dev endpoints, path traversal fix, constant-time token compare.
- **Wave 1:** Canonical versioned ABI (`v0.2.0`), FNV-1a UTF-16 code unit fingerprinting, Predicate DSL, ndarray correlation.
- **Wave 2:** Complete cutover to Rust kernel for all analytical operations.
- **Wave 3:** Deletion of orphaned JS analytical modules.
- **Wave 4:** `AtlasCore.ts` single analytical authority and `NemosyneSession.ts` schema v2 session serialization.
- **Wave 5:** Draco transformed into pure embodiment consumer; AtlasCore as `FactProvider`.
- **Wave 6:** All kernel call sites routed through AtlasCore; ledger-derived history; ECMAScript number stringification parity.



---

## Imported source: `ROADMAP_PHASES_1-20_COMPLETED.md`

# Archived Roadmap — Phases 1–20 (Completed)

> **Historical archive.** Phases 1–20 are complete and are preserved here as the record of
> what was built. They are **not** a source of current implementation status, product
> direction, or study protocol. For current status, see the **Current Status** block at the
> top of [ROADMAP.md](../ROADMAP.md). For active and proposed work, see Phases 21–24 and
> Atlas V5 in the live roadmap.

> Archived 2026-08-18. The compact summary that replaces these phases in the live roadmap
> lives in the "Completed phases (archived)" section below the Current Status block.

## Audit notes preserved

Several phases carry **BUILT, NOT WIRED** audit notes (2026-08-14 / 2026-08-16) recording
classes that exist with passing tests but were never instantiated in the production runtime.
These notes are preserved verbatim in the phase bodies below so the information is not lost:
- Phase 12.4 — FrustrationResponseManager / GestureConfidenceHUD / JITGestureHintManager
  (resolved: wired in Phase 22.3 via AdaptiveAssistController).
- Phase 13.3 — AnalysisStorybookExporter (built, not wired; export via TelemetryPanel).
- Phase 13.4 — ContextRecoveryManager (built, not wired; logic lives in Engine.ts).
- Phase 17.2 — CSVParserWorker / DracoSolverWorker (built, not wired; main-thread paths
  used instead; recorded as a reference implementation).

The Phase 22.6 dead-code inventory and Phase 24 architectural plan re-examine these where
relevant; the live roadmap is authoritative for disposition.

---

### Completed work-streams

Cross-cutting work-streams that are **done** and recorded here (not in
`.claude/plan.md`) as the single reference:

- **TypeScript migration** ✅ — the entire JS source tree was converted to `.ts`
  (import maps + Vite; `tsc --noEmit` is a required CI gate). The 7 stale `.js`
  re-export stubs left behind were removed in the distillation PR.
- **Docs-site refactor** ✅ — `docs/index.html`, examples, dataset mapping, and
  use-case blurbs.

---

## Phase 1 — Foundation ✅

- [x] Git repository initialized.
- [x] Working three.js/WebXR runtime on Meta Quest 3S.
- [x] WebXR session binding compatible with Quest Browser.
- [x] Controller and hand tracking input routing.
- [x] Basic telemetry and diagnostic panels.
- [x] Unit tests with Vitest.

## Phase 2 — Specification ✅

- [x] Draco-style constraint engine.
- [x] Topology fact extraction (tabular, graph, hierarchy, vector, time-series).
- [x] Hard/soft constraint rule registration and weighted scoring.
- [x] Spec serializable as JSON.

## Phase 3 — Core Framework ✅ 🔄

- [x] `Dataset` with typed columns and encodings.
- [x] `VRTopologyTranslator` synthesizing artefacts.
- [x] World-space data inspection via DataCard.
- [x] Independent, moveable HUD panels (`MovablePanel`, `PanelManager`).
- [x] Live streaming connectors (`WebSocketAdapter`, `PollingAdapter`, `OpenDataSources`).
- [x] Hand-attached radial wheel menu.
- [x] HUD panels clustered around a central anchor point.
- [x] Incremental live-stream updates.

## Phase 4 — Examples & Documentation 🔄

- [x] `README.md`, `docs/ARTEFACTS.md`, `docs/INTERACTIONS.md`, `docs/ARCHITECTURE.md`, `docs/GETTING_STARTED.md`.
- [x] Complete `docs/ROADMAP.md` and keep it current.
- [x] Expand built-in sample datasets (financial, geospatial, process-flow).

## Phase 5 — Artefact Library Expansion ✅ 🔄

- [x] Add Column, Orb, Token, Plinth, Beam, Trail, Ring, Field, Zone artefact variants.
- [x] Add geospatial and flow topologies.
- [x] Add real force-directed, radial-tree, and time-ribbon layout generators.
- [x] Add lightweight TDA artefact glyphs (persistence barcode, mapper graph, Betti curve).
- [x] Add data-operation transforms (filter, aggregate, sort, time-slice, cluster).

## Phase 6 — Real-World Deployments 🔄

- [x] Production build and deployment pipeline (`vite build`, Netlify, Vercel).
- [x] GitHub Actions CI workflow (`.github/workflows/ci.yml`).
- [x] Desktop fallback with mouse/keyboard (`DesktopControls`).
- [x] Efficient data transmission hooks (Apache Arrow IPC, FlatBuffers, MessagePack serializers + `WebSocketAdapter.binaryParser`).
- [x] Multi-user collaborative memory palaces (see Phase 10B).
- [x] Neural predictive layer for soft-constraint weight recommendation (see Phase 11).

## Phase 7 — VR Comfort, Scalability & Interaction Metaphors ✅

- [x] Recalibrate panel anchor to ~0.55 m (Meta Quest comfort zone).
- [x] Detach radial wheel menu from wrist; body-lock it in front of the chest.
- [x] Add procedural audio + visual selection feedback (`SelectionFeedback`).
- [x] Build scalable rendering package (`InstancedPointCloud`, `SpatialIndex`, `LODManager`).
- [x] Add scale-aware facts and hard/soft constraints to `ConstraintEngine`.
- [x] Add `INSTANCED_POINT_CLOUD`, `CLUSTER_VOLUME`, and `AGGREGATE_BARS` artefact paths.
- [x] Implement six interaction metaphors: Resonance Pulse, Fork Plane, Chrono Dial, Constellation, Beacon, Aleph.
- [x] Update tests and documentation for all of the above.

## Phase 8 — Deeper Analytics & TDA Artefacts 🔄

- [x] **Sprint 8.1** — Statistical facts engine (`columnStats`, `correlationMatrix`, `categoryDistribution`, temporal trend/seasonality, outlier detection).
- [x] **Sprint 8.2** — Advanced clustering (`hierarchical`, `dbscan`, k-means++ seeding, `ClusterTransforms.ts`).
- [x] **Sprint 8.3** — Anomaly & outlier layer (`anomaly` operation with IQR/Z-score/isolation methods, ORB halo rendering, outlier lens).
- [x] **Sprint 8.4** — 2D chart planes in VR (`ChartPlane` artefact for bar/line/histogram/box/correlation plots, auto-attached by `VRTopologyTranslator`).
- [x] **Sprint 8.5** — TDA artefact factory (`TDAMapper`, persistence barcode, mapper graph, Betti curve).

## Phase 9 — Production Polish & Game-Inspired UX ✅

- [x] **Sprint 9.1** — Diegetic data inspector (`HolographicInspector.js`).
- [x] **Sprint 9.2** — Contextual gaze tooltips (`TooltipManager`).
- [x] **Sprint 9.3** — Constellation / nested radial menus.
- [x] **Sprint 9.4** — Spatial dashboard wall with snap zones (`DashboardManager.ts`, `ChartPlanePanel.ts`, dashboard reset in wheel menu).
- [x] **Sprint 9.5** — Teleport anchors and comfort vignette (`locomotion.teleportToAnchor`, overview/detail anchors).
- [x] **Sprint 9.6** — Guided tour system (`GuidedTour`, `DefaultTour.js`).
- [x] **Sprint 9.7** — Dual-hand gestures, analysis history undo/redo, settings panel, feedback customization.
- [x] **Sprint 9.8** — Hand-pointer anchoring, gesture cooldown/threshold tuning, production test hardening.
- [x] **Sprint 9.9** — Visual polish and atmosphere presets (`WorldTheme.ts`, ambient particles, portal/TechnoCore glow pulses, dataset-key atmosphere mapping).

----

## Evaluation Checkpoint — End of Phase 9

*Status as of 2026-07-28, written after completing Phase 9. Test counts have grown since; see TEST_READY.md for the current number.*

### Goal delivery

The project’s core thesis — multi-dimensional datasets become interactive 3D memory palaces — is **demonstrated end-to-end**. The constraint-driven Draco pipeline, artefact taxonomy, multi-modal input model, statistical aids, live connectors, and atmosphere layer all work together in a single WebXR/three.js runtime. Most of the foundational vision is implemented and tested, with rough edges and unfinished features remaining — this is a personal, experimental project, not a finished product.

### Strengths

- **Architecture:** Clean separation between Engine, World, artifacts, UI, interactions, and data layers.
- **Test discipline:** A growing Vitest suite (1191 pass / 9 skip — see TEST_READY.md) makes refactoring safe for a WebXR codebase.
- **Constraint-driven synthesis:** `DracoTopologyNode` + `ConstraintEngine` turn data facts into layout/interaction/geometry specs rather than hard-coding one chart per dataset.
- **Unified input:** `HandGestureRecognizer`, `InputRouter`, `HandPointer`, `ControllerPointer`, `DesktopControls` share one model across VR and desktop.
- **Atmosphere as signal:** Theme presets tied to dataset mood make the environment itself convey information.
- **Diegetic UI:** Panels, wheel menus, and inspector live in world space, respecting immersion.

### Critical gaps and missing capabilities

1. **Hardware/runtime validation.** Frame time and draw-call budgets are now enforced in-engine with a live Performance panel; Quest Browser GPU memory and hand-tracking latency still need device-specific measurement.
2. **Broad data ingestion.** No CSV/Excel/Parquet import, SQL/warehouse connectors, schema-mapping UI, or API authentication.
3. **Output, provenance, and sharing.** Screenshot export, JSON analysis-story export, operation-log panel, and opt-in telemetry are implemented; annotations, bookmarks, shared links, and persistent revision history are still missing.
4. **Collaboration.** Single-user only; no voice, avatars, synchronized cursors, or shared state.
5. **Accessibility.** Colorblind palette remapping, text scaling, high-contrast UI mode, and dwell-selection motor alternative are implemented. Audio descriptions and full WCAG-equivalent coverage are still missing.
6. **Graceful degradation.** GPU context loss, tracking loss mid-gesture, malformed CSVs, and network stalls need explicit recovery paths.
7. **Evidence of value.** No user studies, task benchmarks, or telemetry to prove spatial analysis improves insight speed/accuracy over 2D tools.

### How it differs from related work

Nemosyne is a personal exploration of metaphor-first, embodied spatial analysis, not a competitor to shipping products. Compared with notebook/BI tools (Tableau, Power BI, Observable) it trades chart grammar, broad connectors, and provenance for immersion and the memory-palace metaphor; compared with one-off three.js/A-Frame viz demos it adds real analysis operations, undo/redo, live data, and tests; compared with enterprise VR analytics (e.g. Virtualitics) it lacks validated studies, connector breadth, and SSO. It is best understood as an experiment, not a replacement for any of these.

### Recommended decision gate before Phase 10

Do **not** jump straight into multi-user collaboration. First satisfy these four prerequisites:

1. **Quest Browser validation pass** — capture frame-time, GPU memory, and hand-tracking latency baselines.
2. **Canonical file-import flow** — CSV → `Dataset` with encoding inference, so non-developers can use the tool.
3. **First usability benchmark** — define a repeatable task (e.g., “find the top outlier”) and compare Nemosyne against a 2D dashboard.
4. **Non-functional requirements baseline** — performance budget, error boundaries, accessibility targets, telemetry, and state persistence.

Only after those four are met should the roadmap choose between **Phase 10A: Validate & Harden** or **Phase 10B: Scale & Collaborate**.

## Phase 10 — Decision Gate: Validate & Harden OR Scale & Collaborate ⏳

*Phase 10 is intentionally a fork. The prerequisites above determine which track is selected.*

### Track A — Validate & Harden (recommended if hardware/provenance gaps are not closed)

- [x] **Sprint 10A.1** — Quest Browser performance profiling and performance budget enforcement.
- [x] **Sprint 10A.2** — CSV file import with robust parsing, automatic topology/schema inference, and error boundaries (Excel/Parquet deferred to future plugin importers).
- [x] **Sprint 10A.3** — Session persistence (`IndexedDB`): dataset, camera pose, operation history, settings, tour progress, with auto-save and wheel-menu actions.
- [x] **Sprint 10A.4** — Export and provenance: PNG/WebP capture of renderer output, downloadable JSON analysis story, in-VR operation log panel.
- [x] **Sprint 10A.5** — Accessibility pass: colorblind-safe palettes, text scaling, high-contrast, motor-accessible input alternatives.
- [x] **Sprint 10A.6** — Telemetry and observability: session metrics, gesture counts, frame drops, error rates; opt-in only.
- [x] **Sprint 10A.7** — Gesture coaching and controller equivalence: running interaction commentary panel, hand-gesture to Meta Quest controller mapping, controller gesture mapper.

### Track B — Scale & Collaborate (recommended only after Track A prerequisites are satisfied)

- [x] **Sprint 10B.1** — Networking foundation (WebRTC data channels, signalling server, room model, wheel-menu join/leave, in-VR network status panel).
- [x] **Sprint 10B.2** — Free-floating, persisted HUD panels: panels no longer forced into the analyst-anchor arc, drag in cameraGroup local space, positions/visibility saved with the session.
- [x] **Sprint 10B.3** — Shared state synchronisation (dataset, operations, camera pose, selections).
- [x] **Sprint 10B.4** — Presence & avatars (voice-less or voice-optional, hand/controller avatar, name tags).
- [x] **Sprint 10B.5** — Shared annotations, bookmarks, and tours.
- [x] **Sprint 10B.6** — Asymmetric desktop companion (2D view of the same session for non-VR stakeholders).

### Deferred longer-term work

- [x] Neural predictive layer for soft-constraint weight recommendation (`NeuralConstraintPredictor.ts`).
- [ ] Direct SQL / data-warehouse connectors.
- [ ] Scientific user studies comparing spatial vs. 2D analysis workflows.

---

## Phase 11 — On-Device AI Intelligence, Low-Token Observability & WebXR Ergonomics ✅

- [x] **Sprint 11.1 — Analyst Torso Anchor & Ergonomics**: Reparented scene anchor to analyst torso (`analystAnchor`) at `~1.35m` chest height, continuously tracking headset position and yaw orientation.
- [x] **Sprint 11.2 — Dual Vertical Multicoloured Wheel Menus**: Redesigned `HandWheelMenu.ts` into twin vertical arcs on left (`-0.36m`) and right (`+0.36m`) side of torso with wide rectangular pill geometry (`0.24m x 0.075m`), 30px+ fonts, and horizontal action fan-outs.
- [x] **Sprint 11.3 — Guided Tour Onboarding & Sequential Progression**: Fixed single-step auto-advance guards so tour counts sequentially `1/9` through `9/9`. Added Data Loading, Saving/Exporting, Collaboration, and Data Characteristics demonstration steps.
- [x] **Sprint 11.4 — On-Device UX Frustration Engine & Low-Token Observability**: Implemented `UXFrustrationAnalyzer.ts` to detect rapid repeated clicking, window thrashing, air-click misses, WASM errors, gesture misfires, and gaze/laser dwell hesitations locally. Generates 8-line token-compressed UX digests.
- [x] **Sprint 11.5 — Gaze/Laser Dwell & Gesture Confidence Telemetry**: Integrated `recordDwell()` in `SelectionDispatcher.ts` and `recordGestureConfidence()` in `WorldInputCoordinator.ts`.
- [x] **Sprint 11.6 — Geometry & Material Object Pooling**: Built `MeshPool` in `src/utils/ObjectPool.ts` and `executeInTimeSlices()` async batch execution to eliminate >200ms dataset load spikes.
- [x] **Sprint 11.7 — Customization Architecture & AI Developer Team**: Defined 4-agent team in `.agents/team.json` (`technical-architect`, `coder`, `qa-engineer`, `reviewer`) and custom Workspace Skill `.agents/skills/vr-accessibility/SKILL.md`.

----

## Phase 12 — AI Tuning, Gesture Validation & UX Feedback Loop Closure ✅

> **Focus:** Close the loop between the intelligence already built (Draco GA, gesture AI, frustration engine) and measurable, user-visible quality. No new major features — deepen, validate, and surface what's already there.

### Sprint 12.1 — Gesture Recognition Validation Harness

Existing coverage in `tests/hand-gesture-recognizer.test.js` tests the recognizer at unit level with synthetic `makePose` stubs, but lacks recorded trajectory fixtures, accuracy assertions, and edge-case coverage.

- [x] `tests/fixtures/gesture-sequences/` — JSON multi-frame trajectory recordings for 6 core gestures: `pinchTogether`, `pinchApart`, `swipeLeft`, `swipeRight`, `scoopUp`, `pushForward`
- [x] `tests/gesture-recognizer-accuracy.test.ts` — TP rate ≥ 90 %, FP rate ≤ 5 % per gesture, asserted from fixtures
- [x] `tests/gesture-edge-cases.test.ts` — cooldown boundary, rapid alternation, dual-hand conflict, controller-equivalent parity
- [x] `GestureConfidenceThresholds` config object in `HandGestureRecognizer` — per-gesture tunable `floor` / `ceiling` replacing magic numbers
- [x] Update `docs/INTERACTIONS.md` with a gesture confidence spec table

### Sprint 12.2 — Draco Recommender Evaluation Suite

The GA solver runs but its recommendation quality is untested against known-good outputs. `DracoDiagnosticHUD` shows weights live but gives no quality signal back to the analyst.

- [x] `tests/fixtures/draco-golden/` — golden pairs covering all primary topology types (`TABULAR`, `GRAPH`, `HIERARCHY`, `VECTOR_FIELD`, `TIME_SERIES`, `GEO`)
- [x] `tests/draco-recommender-quality.test.ts` — topology match precision ≥ 80 %, soft-constraint score evaluation on golden set
- [x] `ConstraintEngine.evaluateCandidate(spec, facts)` public method — exposed for external testability
- [x] `DracoDiagnosticHUD` improvements: live per-constraint contribution bars, last 5 candidate history, colour-coded score delta (green = improved, red = regressed)

### Sprint 12.3 — AI Module Integration & Fine-Tuning

- [x] **`NeuralConstraintPredictor`** — weight normalization & prediction evaluation
- [x] **`GestureClassifierModel`** — ONNX bridge & heuristic classification
- [x] **`UXFrustrationAnalyzer`** threshold calibration: `RAPID_ABANDONMENT` window, `REPEATED_ACTION` floor, `AIR_CLICK_MISS` rate

### Sprint 12.4 — Usability Feedback Loop Closure

> **Audit note (2026-08-14, resolved 2026-08-16):** Components in this sprint were initially **built** (classes + unit tests complete) but not wired. `AdaptiveAssistController` now mounts and drives the three assist surfaces in production; Quest usability validation remains pending. See `docs/AUDIT_PHASES_1_20.md` for the historical baseline.

- [x] **`FrustrationResponseManager`** (`src/vr/ui/FrustrationResponseManager.ts`) — **WIRED in Phase 22.3.** `AdaptiveAssistController` feeds analyzer actions, applies user mode, and parents the card to `analystAnchor`.
- [x] **`GestureConfidenceHUD`** (`src/vr/ui/GestureConfidenceHUD.ts`) — **WIRED in Phase 22.3.** `AdaptiveAssistController` instantiates, registers, and disposes the per-gesture confidence panel.
- [x] **`JITGestureHintManager`** (`src/vr/ui/JITGestureHintManager.ts`) — **WIRED in Phase 22.3.** `AdaptiveAssistController` sets the scene and drives diegetic hints from gesture and selection context.
- [x] `tests/frustration-response.test.ts` — assert hint cards appear within 2 operations of threshold breach; assert threshold adapts to expert mode

### Sprint 12.5 — UI/UX Polish & Data Transition Animations

- [x] **Artefact transition animation** — smooth lerp via `executeInTimeSlices`
- [x] **Panel visual hierarchy pass** — category-coloured left border strip (analytics `#00ffcc`, settings `#ffaa00`, collaboration `#aa44ff`)
- [x] **Empty state designs** for `DataCard`, `OperationLog`, `ChartPlane`

### Sprint 12.6 — Analyst Benchmark Suite (Evidence of Value)

*First structured evidence that spatial analysis delivers real analyst benefit.*

| # | Task | Dataset | Success criterion |
|---|---|---|---|
| 1 | *Find the top outlier* | Financial scatter | Correct node selected via inspector |
| 2 | *Identify the dominant cluster* | Geospatial | Correct cluster label confirmed |
| 3 | *Trace a causal path* | Process-flow hierarchy | Correct leaf-to-root path activated |
| 4 | *Spot a temporal anomaly* | Time-series | Anomaly node inspected within time budget |
| 5 | *Compare two encodings* | Any | Both carousel candidates evaluated, one confirmed |

- [x] **`BenchmarkSession`** (`src/utils/BenchmarkSession.ts`) — instruments each task with `timeToFirstCorrectSelection`, `gestureCount`, `operationCount`, `frustrationScoreAtCompletion`
- [x] Benchmark results exported as JSON alongside the existing analysis story export
- [x] `tests/benchmark-session.test.ts` — all 5 tasks pass under deterministic simulated input

### Sequencing

```
12.1 → 12.3  (gesture fixtures feed AI accuracy tests)
12.2 → 12.3  (golden Draco set feeds predictor eval)
12.1 + 12.2 → 12.6  (benchmark tasks use both)
12.4 → 12.5  (feedback polish builds on closed loop)
```

---

## Phase 13 — Real-World Data Ingestion & Provenance Export Infrastructure ✅

> **Focus:** Make Nemosyne production-ready for arbitrary analyst datasets. Enable non-developers to load CSV files with automatic schema inference, support binary Arrow IPC streams, export interactive 3D analysis storybooks, and handle WebGL context loss gracefully.

### Sprint 13.1 — CSV/TSV Auto-Inference & Field Mapping UI

- [x] `CSVDataParser.ts` — robust client-side CSV/TSV parser handling quoted fields, escaped delimiters, missing values, and automatic type inference (`NUMERIC`, `CATEGORICAL`, `TEMPORAL`)
- [x] `SchemaMappingPanel.ts` — in-VR panel letting analysts confirm column type assignments, cycle types, and apply updated field mappings
- [x] `tests/csv-parser.test.ts` — test suite verifying quoted field parsing, numeric casting, date detection, and type cycling

### Sprint 13.2 — Apache Arrow IPC & FlatBuffers Binary Parsers

- [x] `ArrowBinaryParser.ts` — zero-copy Apache Arrow IPC stream reader extracting Float32 position buffers directly targeting `InstancedPointCloud` attributes
- [x] `tests/arrow-ipc.test.ts` — test suite asserting zero-copy memory parsing accuracy

### Sprint 13.3 — Spatial Analysis Storybook & Provenance Export

> **Audit note (2026-08-14):** `AnalysisStorybookExporter.ts` class is **BUILT, NOT WIRED.** Export functionality is implemented in `TelemetryPanel.ts` instead; the class is never instantiated. Decision: either wire the class into TelemetryPanel or consolidate export logic into a single path. For now, export works via TelemetryPanel (not misleading, but terminology "Storybook" vs. "Telemetry" should be clarified).

- [x] `AnalysisStorybookExporter.ts` — **BUILT, NOT WIRED.** Packages session state, dataset snapshot, camera poses, selected filters, annotations, and tour checkpoints into a downloadable JSON/HTML bundle (class complete, tests pass, never instantiated)
- [x] `TelemetryPanel.ts` — export functionality actively used; exports raw telemetry + session context as JSON
- [x] `tests/storybook-context-recovery.test.ts` — test suite verifying storybook bundle serialization

### Sprint 13.4 — Session Recovery & WebGL Context Loss Safety

> **Audit note (2026-08-14):** `ContextRecoveryManager.ts` is **BUILT, NOT WIRED.** WebGL context loss handling exists in `Engine.ts` directly (`contextlost`/`contextrestored` listeners) rather than delegated to the manager.

- [x] `ContextRecoveryManager.ts` — **BUILT, NOT WIRED.** Class complete; detects WebGL context loss, preserves state, restores GPU buffers (never instantiated; logic lives in `Engine.ts`)
- [x] `Engine.ts` — `contextlost`/`contextrestored` event listeners active; context loss recovery working in production
- [x] `tests/storybook-context-recovery.test.ts` — test suite simulating WebGL context loss and verifying recovery dispatch

---

## Phase 14 — WebXR Performance, GPU Caching & Memory Optimization ✅

> **Focus:** Eliminate frame-time spikes and memory allocation garbage collection during WebXR analytics sessions on Meta Quest standalone hardware. Implement dynamic canvas texture diff caching, sub-range GPU buffer updates, and an adaptive 90 FPS frame governor.

### Sprint 14.1 — Canvas Texture GPU Re-Upload Caching

- [x] `CanvasTextureCacheManager.ts` — dirty-rect and content hashing manager for `MovablePanel` and `HandWheelMenu` preventing unnecessary dynamic canvas texture GPU re-uploads during user interaction
- [x] `tests/canvas-texture-cache.test.ts` — test suite asserting canvas texture upload skip rate > 80% on unchanged UI frames

### Sprint 14.2 — Sub-Range GPU Buffer Updates for InstancedPointCloud

- [x] `InstancedPointCloud` partial buffer update methods (`updateSubRange(offset, count)`) allowing filtered and clustered point subsets to update GPU attribute sub-ranges without full geometry buffer rebuilds
- [x] `tests/subrange-adaptive-governor.test.ts` — test suite verifying partial GPU attribute buffer updates

### Sprint 14.3 — Adaptive WebXR Frame & Thermal Governor

- [x] `AdaptiveFrameGovernor.ts` — continuously monitors WebXR frame render time; dynamically scales particle counts, LOD culling distances, and shadow resolution when frame time breaches 11.1ms (90 FPS target on Quest 3S)
- [x] `tests/subrange-adaptive-governor.test.ts` — test suite simulating frame time spikes and verifying governor LOD scaling response

---

## Phase 15 — Collaborative Spatial Memory Palaces ✅

> **Focus:** Enable multi-analyst spatial collaboration. Synchronize active datasets, filter states, 3D selection highlights, hand avatars, and spatial pointers across WebRTC peer connections.

### Sprint 15.1 — Multi-User WebRTC Data Channel State Sync

- [x] `CollaborativeStateSync.ts` — P2P WebRTC data channel state synchronizer replicating active dataset selection, filter operations, and camera transform vectors
- [x] `tests/collaborative-sync.test.ts` — test suite verifying state broadcast and peer delta merging

### Sprint 15.2 — Peer Avatars & Synchronized Spatial Pointers

- [x] `PeerAvatarManager.ts` — renders lightweight headset & hand avatars for connected remote analysts with color-coded laser pointers and gaze target indicators
- [x] `tests/peer-avatars-annotations.test.ts` — test suite verifying peer avatar transform updates

### Sprint 15.3 — Shared Annotations & Co-Op Benchmark Sessions

- [x] `SharedAnnotationManager.ts` — synchronized 3D spatial pin drop annotations and collaborative benchmark session scoring
- [x] `tests/peer-avatars-annotations.test.ts` — test suite verifying annotation sync across peer sessions

---

## Phase 16 — Voice & Natural Language Spatial Query Engine ✅

> **Focus:** Enable hands-free natural language spatial interaction. Parse spoken voice commands into Nemosyne operations and generate Web Speech API audio narration for analytics discoveries.

### Sprint 16.1 — Web Speech API Natural Language Query Listener

- [x] `VoiceCommandListener.ts` — Web Speech API speech recognition engine parsing spoken voice phrases (*"filter revenue above 200"*, *"show graph view"*, *"reset layout"*) into executable Nemosyne `Operation` commands
- [x] `tests/voice-spatial-engine.test.ts` — test suite verifying intent classification and query parsing

### Sprint 16.2 — Diegetic Audio Feedback & Narration

- [x] `SpatialAudioNarrator.ts` — Web Speech API speech synthesis engine providing spoken audio narration for operation execution, anomaly alerts, and guided tour steps
- [x] `tests/voice-spatial-engine.test.ts` — test suite verifying audio narration queueing and speech synthesis options

---

## Phase 17 — Architectural Hardening & Structural Refactoring ✅

> **Focus:** Address structural debt, monolithic God objects, main-thread blocking operations, and network fragmentation identified in technical architecture critique.

### Sprint 17.1 — Decompose `World.ts` Monolith

- [x] `SceneGraphController.ts` — extract Three.js scene graph initialization, lighting, camera anchoring, and render loop setup
- [x] `WorkspaceManager.ts` — extract dataset loading, active layout switching, and artifact registration
- [x] `tests/world-controllers.test.ts` — test suite verifying decomposed scene graph & workspace controllers

### Sprint 17.2 — Web Worker Offloading for Heavy Computations

> **Audit note (2026-08-14):** Worker classes are **BUILT, NOT WIRED.** Both classes are complete with tests, but the main-thread parsing/solving paths remain active. Workers are never instantiated. Decision: main-thread performance is acceptable for current datasets (100k points load in <200ms); worker offloading can be revisited if main-thread blocking becomes critical. For now, the built workers serve as a reference implementation.

- [x] `CSVParserWorker.ts` — **BUILT, NOT WIRED.** Class complete; would offload CSV/TSV parsing and type inference off the WebXR main render thread (never instantiated; main-thread parser in `FileLoader.ts` used instead)
- [x] `DracoSolverWorker.ts` — **BUILT, NOT WIRED.** Class complete; would offload statistical fact extraction and Genetic Algorithm constraint solving (never instantiated; main-thread solver in `DracoTopologyNode.ts` used instead)
- [x] `tests/worker-offloading.test.ts` — test suite verifying async worker message passing and result accuracy

### Sprint 17.3 — Unified WebRTC Networking & Binary Pose Streaming

- [x] `BinaryPoseSerializer.ts` — **WIRED.** Used in `CollaborativeStateSync.ts`; replaces high-frequency 20Hz `JSON.stringify` camera pose broadcasts with compact 32-byte binary `Float32Array` buffers
- [x] `tests/binary-pose-governor-binding.test.ts` — test suite verifying binary pose serialization and state convergence

### Sprint 17.4 — Connect `AdaptiveFrameGovernor` to Scene Renderers

- [x] Bind `AdaptiveFrameGovernor` `_lodScaleFactor` directly to `InstancedPointCloud` instance counts (`applyLODScale()`)
- [x] **WIRED.** Governor instantiated in `Engine.ts:82`, actively adjusts LOD during render loop
- [x] `tests/binary-pose-governor-binding.test.ts` — test suite asserting active scene load shedding when governor throttles

---

## Phase 18 — Production Runtime Integration & Worker Hardening ✅

> **Focus:** Wire Phase 17 architectural abstractions into production runtime loops of `World.ts`, `Engine.ts`, `CollaborativeStateSync`, and `InstancedPointCloud`. Implement dedicated Web Workers via Blob URLs and binary pose channel transport.

### Sprint 18.1 — Wire `SceneGraphController` & `WorkspaceManager` into `World.ts`

- [x] Instantiate and delegate scene graph setup, camera positioning, torso updates, and dataset state to `SceneGraphController` and `WorkspaceManager` inside `World.ts`
- [x] `tests/production-runtime-wiring.test.ts` — test suite asserting `World.ts` delegates to sub-controllers

### Sprint 18.2 — Dedicated Web Workers (`Blob` URL Workers)

- [x] Implement true dedicated Web Workers using Blob URL constructors (`Worker`) in `CSVParserWorker.ts` and `DracoSolverWorker.ts`
- [x] `tests/production-runtime-wiring.test.ts` — test suite asserting off-thread message passing

### Sprint 18.3 — Binary WebRTC Pose Streaming Transport

- [x] Wire `BinaryPoseSerializer` into `CollaborativeStateSync.ts` to transmit 32-byte ArrayBuffer camera poses instead of JSON strings
- [x] `tests/production-runtime-wiring.test.ts` — test suite verifying ArrayBuffer transmission over WebRTC data channels

### Sprint 18.4 — Closed-Loop Adaptive Governor Animation Integration

- [x] Connect `AdaptiveFrameGovernor.recordFrame()` inside `Engine.ts` animation loop and push `lodScaleFactor` to active `InstancedPointCloud` instances
- [x] `tests/production-runtime-wiring.test.ts` — test suite asserting active frame time measurement and reactive point cloud scaling

---

## Phase 19 — Architectural Hardening & Zero-Copy Protocol ✅

> **Focus:** Address multi-user peer collision vulnerability in binary pose sync, eliminate per-frame GC allocations via static typed array views, and complete reactive governor event loops.

### Sprint 19.1 — Multi-User Binary Peer ID & Monotonic Sequence Tracking

- [x] Add numeric peer ID header and sequence validation to `BinaryPoseSerializer` and `CollaborativeStateSync.ts` to prevent remote peer state collisions in 3+ user rooms
- [x] Reuse static ArrayBuffer views to eliminate 3x object allocations per tick during 90Hz pose broadcasts
- [x] `tests/zero-copy-network-sync.test.ts` — test suite verifying peer ID demuxing and sequence drop protection

### Sprint 19.2 — Closed-Loop Governor Event Dispatch & Reactive Rendering

- [x] Dispatch `WorldTopics.PERFORMANCE_THROTTLE` events when `AdaptiveFrameGovernor` adjusts `_lodScaleFactor`
- [x] Bind `InstancedPointCloud` and layout particle instances to throttle events reactively
- [x] `tests/governor-event-loop.test.ts` — test suite asserting reactive scene load shedding under throttle events

### Sprint 19.3 — Delegate Workspace Node Lifecycle to WorkspaceManager

- [x] Delegate dataset node group mounting, layout group cleanup (`clearDataset()`), and artifact node registration to `WorkspaceManager`
- [x] `tests/workspace-node-lifecycle.test.ts` — test suite verifying workspace dataset node group delegation

---

## Phase 20 — Graphics Engine Optimization & 90 FPS WebXR Rendering ✅

> **Focus:** Optimize WebGL render pipeline for Meta Quest 3S (11.1ms / 90 FPS budget). Eliminate per-frame GC allocations, bypass static UI canvas texture re-uploads via DJB2 state hashing, enable Early-Z culling, and harden WebGL context loss recovery.

### Sprint 20.1 — Zero-Allocation Instanced GPU Buffer Pipeline

- [x] Eliminate per-frame object allocations in `InstancedPointCloud.setPoints()`; reuse static `InstancedBufferAttribute` typed arrays and update sub-ranges
- [x] Enable `depthWrite: true` and `depthTest: true` on instanced point materials to enable Meta Quest 3S TBDR Early-Z culling
- [x] Fix `DracoTopologyNode` mesh pool release/disposal lifecycle
- [x] `tests/zero-alloc-instanced-buffer.test.ts` — test suite verifying buffer re-use and sub-range update flags

### Sprint 20.2 — UI Canvas Texture Upload Bypassing

- [x] Integrate `CanvasTextureCacheManager` into `MovablePanel.render()` to compute DJB2 state hashes
- [x] Bypass `texture.needsUpdate = true` on static UI frames to eliminate 3-6ms GPU upload stalls
- [x] `tests/zero-alloc-instanced-buffer.test.ts` — test suite verifying texture upload bypass on unchanged UI state

### Sprint 20.3 — Robust WebGL Context Loss & GPU Buffer Recovery

- [x] Consolidate `webglcontextlost` and `webglcontextrestored` handling into `ContextRecoveryManager.ts`
- [x] Re-flag geometry buffer attributes dirty and force material re-compilation on context recovery
- [x] `tests/storybook-context-recovery.test.ts` — test suite verifying scene restoration after context loss

### Sprint 20.4 — Closed-Loop 90 FPS Governor Load Shedding

- [x] Measure frame deltas via `XRFrame` timestamps and push `lodScaleFactor` directly into `InstancedPointCloud.applyLODScale()` during `Engine._tick()`
- [x] `tests/production-runtime-wiring.test.ts` — test suite asserting reactive load shedding under GPU load




---

## Imported source: `Roadmap to stable alpha release.md`

\# Nemosyne — Roadmap to Stable Release  
\> **Historical planning document.** `docs/ROADMAP.md` and `docs/study/` are authoritative.
\#\#\# (MVP feature set \+ NFRs \+ UX sufficient to make the core hypothesis seamlessly testable)

\*\*Revision note:\*\* this version incorporates a definitional correction to what "Stable"  
means for a research instrument. The original cut of this roadmap treated all  
collaboration as post-MVP, on the logic that Nemosyne's usefulness should be validated  
solo before multiplayer is worth building. That logic still holds for \*\*collaborative  
analysis\*\* (multiple analysts jointly manipulating one space) — but it was too broad,  
because it also swept up \*\*observational collaboration\*\* (a researcher entering a  
participant's session to watch, record, and minimally direct a study trial), which isn't  
a product feature at all — it's part of the experimental apparatus the flagship study  
needs to run. A study with no way for a researcher to see what the participant is doing  
beyond a telemetry log loses the qualitative/behavioral evidence stream entirely, which  
the earlier scoping under-weighted. That distinction is threaded through the gates below.

\*\*Revision 2 note:\*\* this pass adds the piece the prior revision was still missing —  
Gate 2.5 (observation) tells you what happened in \*one\* session; nothing previously in  
this roadmap made \*many\* sessions add up to a defensible experiment. Added: Gate 5  
(Experimental Validity & Study Harness — trial data model, counterbalancing, outcome  
capture, an explicit canonical 2D control, an experimental confound register, and a data-  
governance layer covering consent/minimization/pseudonymization/retention, all confirmed  
via direct code search to not exist anywhere in the codebase today) and Gate 6 (Stable  
Release Candidate — a freeze/rehearsal gate, not new work). Also tightened: Gate 0's exit  
criterion (now auditable against a concrete defect list rather than an unprovable  
absolute), Gate 2's exit criteria (now an observable checklist), and a Gate 4 item that  
had gone stale against Gate 2.5's own reclamation of previously-dead-code classes.

\*\*Grounding:\*\* every item below was independently verified against the codebase across  
multiple review passes (build/typecheck/lint/test re-runs, direct source inspection with  
file:line citations, and — where noted — cross-checked against the project's own  
\`docs/ROADMAP.md\`, which I independently found to be accurate wherever spot-checked). One  
item below (the orphaned \`WebGLRenderer\`) was re-verified in this pass specifically, down  
to confirming it's constructed unconditionally in the main \`World.ts\` path and never  
disposed.

\*\*Framing.\*\* "Stable release" here is defined narrowly and deliberately: not feature-  
complete, not scaled, not collaboration-ready — the smallest, most honest version of  
Nemosyne capable of running one real study (2D vs. VR-3D on a defined task)
without the \*infrastructure itself\* being a confound. A crash, a security hole, a UI bug  
that silently excludes colorblind participants, or a wheel menu that double-fires under  
observation are not just quality issues here — they invalidate any data collected on top  
of them. That reframes prioritization: fix what would corrupt the experiment before  
building anything the experiment doesn't need.

\*\*Revision 3 note (final addition per this round of review):\*\* adds the core hypothesis  
statement, a data dictionary requirement, event sequencing for cross-stream correlation,  
a frozen experiment package for Gate 6, and a Release Evidence Matrix — the five items  
this round's review asked for, plus the smaller tightenings it flagged alongside them  
(deterministic reproduction fixtures in Gate 0, a semantic-vs-structural comprehension  
check in Gate 2's exit criteria, experience-quality measures in Gate 3, and a validated-  
instrument caveat on Gate 5's workload measure). Per that review's own recommendation,  
this is intended as the last structural revision — the next step is execution, not more  
roadmap.

\---

\#\# Core Hypothesis & Research Questions  
\*Added so the roadmap is self-contained rather than referring to "the core hypothesis"  
without ever stating it.\*

\*\*Core hypothesis:\*\* for defined analytical tasks involving relationships and  
multidimensional structure, spatial representation and embodied interaction can improve  
human discovery and understanding compared with conventional 2D representation, without  
unacceptable costs in precision, workload, navigation, or comfort.

\*\*Research questions this roadmap exists to make answerable:\*\*  
\- RQ1: Where does spatial representation help?  
\- RQ2: Where does it hurt?  
\- RQ3: What interaction costs does it introduce?  
\- RQ4: Does spatial context improve recall?  
\- RQ5: Which representation characteristics predict benefit?

Every gate below should be read against one question: does this reduce the risk that the  
eventual answer to RQ1–RQ5 is contaminated by something other than the variable being  
studied? Gates 0/1 protect against infrastructure contamination; Gate 2 protects against  
"the task was too hard to attempt" contamination; Gate 2.5 and Gate 5 protect against  
protocol/measurement contamination; Gate 3 protects against "the hardware couldn't  
actually run it" contamination; Gate 4 protects against future readers trusting claims  
that don't match what shipped; Gate 6 is the check that all of the above actually held on  
a full rehearsal, not just in isolation.

\---

\#\# Release Evidence Matrix & Status Vocabulary  
\*Moved here from its prior position after Gate 6, on the logic that this is the roadmap's  
operational definition of "done" — every gate below should be read against it rather than  
each gate inventing its own notion of complete.\*

\*\*Canonical status vocabulary\*\* (formalizing the evidence hierarchy already present in  
the project's own \`docs/ROADMAP.md\`, applied consistently rather than left to individual  
sections): 🟢 Implemented → 🔵 Automated-tested → 🟡 Human-validated → 🟠 Demonstrated  
useful → 🔴 Demonstrated superior. This roadmap uses it as follows — note the deliberate  
asymmetry in the last row:

| Capability area | Minimum required level for Stable |  
|---|---|  
| Runtime integrity (Gate 0\) | 🔵 Automated-tested |  
| Participant UX / analyst journey (Gate 2\) | 🟡 Human-validated |  
| Observer mode (Gate 2.5) | 🟡 Human-validated |  
| Hardware performance (Gate 3\) | 🟡 Human-validated, hardware-specific |  
| Canonical 2D control (Gate 5\) | 🟡 Human-validated |  
| Study harness (Gate 5/6) | 🟡 Rehearsal-validated (Gate 6's full dry run) |  
| \*\*Core research hypothesis itself\*\* | \*\*Not required for release\*\* |

That last row is the point of this table: \*\*Stable is defined as what makes the  
hypothesis testable, not as proof the hypothesis is true.\*\* Nothing in this roadmap  
requires Nemosyne to already be demonstrated superior to 2D before shipping Stable — that  
result, whichever direction it goes, is what the first study is for.

\*\*Capability-level tracking\*\* (kept current as gates close — the single place to check  
"is Nemosyne actually ready" without re-reading every gate's prose):

| Capability | Code | Automated test | Human-validated | Hardware | Gate | Study impact if missing |  
|---|---|---|---|---|---|---|  
| Wheel (dominant-hand, no double-fire) | 🟢 | 🔲 | 🔲 | 🔲 | Gate 0/2 | High — corrupts interaction-error counts |  
| Compare operation | 🔲 | 🔲 | 🔲 | 🔲 | Gate 2 | Critical — flagship task depends on it |  
| Colorblind-safe data encoding | 🔲 | 🔲 | 🔲 | 🔲 | Gate 2 | Critical — silent participant-subgroup confound |  
| Observer console (Passive/Prompt/Assisted) | 🟢 (reclaimed) | 🔲 | 🔲 | 🔲 | Gate 2.5 | Critical — no qualitative evidence stream without it |  
| Canonical 2D control | 🔲 | 🔲 | 🔲 | N/A | Gate 5 | Critical — weakens the entire comparison's claim |  
| Session/trial recording \+ event sequencing | 🔲 | 🔲 | 🔲 | 🔲 | Gate 2.5/5 | Critical — un-triangulable evidence |  
| Load-test data on real Quest hardware | 🟢 (harness only) | 🔲 | 🔲 | 🔲 | Gate 3 | High — every UI comfort/perf decision is unvalidated without it |

🟢 marks genuine existing capability, code-verified directly against the repository, not  
aspiration; 🔲 marks everything this roadmap treats as a blocking Stable-release item.

\---

\#\# Gate 0 — Runtime & Resource Integrity  
\*Theme: Architecture \+ Tech Debt. Exit criterion: no known P0/P1 lifecycle, crash,  
corruption, or resource-leak paths remain within the supported Stable Release workflows,  
and adversarial/error-path tests cover the identified failure classes. (Sharper than "the  
app doesn't leak under any input a participant could produce" — that's the right intent  
but isn't literally provable; this version is auditable against a concrete defect list.)\*

| Item | Evidence | Why it blocks the study |  
|---|---|---|  
| \*\*Orphaned second \`WebGLRenderer\`.\*\* \`SceneGraphController.ts:47\` constructs a full second \`THREE.WebGLRenderer\` unconditionally; \`World.ts:206\` instantiates the controller and never calls its \`dispose()\`. Two live GPU contexts on Quest hardware is not cosmetic — it's a resource leak in the most resource-constrained deployment target. | Verified directly this session | GPU exhaustion mid-session would look like "Nemosyne is slow/unstable," confounding any performance or comfort measurement in the study |  
| \*\*Material/texture leak on repeated Draco synthesis.\*\* Roadmap-flagged, consistent with the general pattern of no-dispose paths found elsewhere in the graphics layer. | \`docs/ROADMAP.md\` §22.9, consistent with independently-verified renderer leak above | A study session that involves swapping representations repeatedly (exactly what "Find the Fraud" requires) would accumulate leaked GPU memory over the session length |  
| \*\*Stale \`DataView\` after \`wasm.memory.grow()\`.\*\* Cross-validated by three independent reviewer passes per the roadmap; a growable-memory read that goes stale silently returns wrong data rather than erroring. | \`docs/ROADMAP.md\` §22.8 | Silent data corruption is the worst failure mode for a data-analysis research tool specifically — wrong numbers with no error is worse than a crash |  
| \*\*WASM \`leaves()\` unbounded recursion → stack-overflow trap.\*\* Reachable via the standard \`data\_operation\` ABI on a degenerate merge-history chain. | \`wasm/src/data/operations.rs:453-464\`, roadmap-verified | An unusual but plausible participant interaction pattern (many undo/redo cycles) shouldn't be able to hard-crash the WASM instance mid-study |

\*\*Build. No design decisions required — these are defects.\*\* Each of the four items above  
should ship with a minimal reproduction fixture or a deterministic regression test, not  
just a fix — "we believe this is resolved" is weaker than "here is the test that fails  
before the fix and passes after," and a research instrument specifically needs to be able  
to answer "can we reproduce the failure on demand" if something looks wrong mid-study.

\---

\#\# Gate 1 — Security & Role Integrity  
\*Theme: Security. Renamed from "Security Baseline for Any Multi-Party Testing" — that  
conditional framing is now obsolete, since Gate 2.5 makes observational research part of  
Stable and every study session is multi-party by definition. Exit criterion: identity,  
role boundaries, and the participant/observer distinction are enforced by the system, not  
assumed.\*

| Item | Evidence | Severity |  
|---|---|---|  
| \*\*Signalling \`from\` spoofing.\*\* \`SignallingServerCore.ts\`: \`message.from ?? peerId\` lets a client override the authenticated identity in relayed messages. | Verified verbatim this session | P1 — any multi-peer or remote-observer study condition needs real identity integrity |  
| \*\*No per-peer rate limiting on the signalling server.\*\* A flood peer can exhaust a room. | Roadmap §22.8 | P2, but relevant if any study session is remotely proctored |  
| \*\*CSV missing the \`\_\_proto\_\_\`/\`constructor\`/\`prototype\` filter that JSON has.\*\* \`Parsers.ts:50\` filters JSON columns; the CSV path has no equivalent filter anywhere in the file. | Verified directly this session — confirmed worse than "inconsistent," CSV has none at all | P2 — a malicious or malformed study dataset file could pollute \`Object.prototype\` |  
| \*\*Vite dev-server signalling silently broken.\*\* \`request.url \!== '/\_\_signal'\` bails before query-param parsing runs, so local dev multiplayer never connects. | Verified verbatim this session | Dev-only, but blocks the team from locally testing any collaborative study condition before it ships |

\*\*Build the P1/P2 items if any study condition is multi-party; the dev-only item should  
be fixed regardless since it currently blocks the team's own ability to test collaboration  
locally.\*\*

\*\*Revised scope, given Gate 2.5 below: this gate is no longer conditional.\*\* Once  
observational collaboration (researcher-as-observer) is promoted into the Stable release,  
every study session involves at least two parties (participant \+ observer) by definition.  
The identity-spoofing and rate-limiting items move from "build if multi-party" to  
"build, full stop" — a study protocol depends on the researcher's view of the session  
being trustworthy, and \`message.from ?? peerId\` currently means nothing stops a session  
from being spoofed by a third party mid-trial. One addition specific to observation:

\- 🔲 \*\*No role/permission model exists at the network layer.\*\* Confirmed by direct  
  inspection: \`NetworkManager.ts\`/\`Room.ts\` have no concept of role at all — every peer  
  is currently symmetric. This is the actual blocker for observer mode, not a missing  
  UI: the wire protocol needs an explicit \`role: 'participant' | 'observer'\` distinction  
  before anything else in Gate 2.5 can safely ship, because without it an "observer"  
  session is really just a second, unrestricted participant with no code-level barrier  
  stopping it from manipulating the analytical state mid-trial.  
\- ⚪ \*\*A third \`operator\` role is not being added.\*\* Considered and deliberately deferred:  
  the two-role model (participant, observer) covers the study as currently scoped, and a  
  separate infrastructure-operator role should only be built if a real need for someone  
  distinct from the researcher/observer actually shows up — not pre-built for theoretical  
  completeness.

\---

\#\# Gate 2 — The One Analyst Journey (MVP feature set)  
\*Theme: UI/UX \+ Architecture. Exit criterion: a first-time participant can complete one  
defined task (the "Find the Fraud" scenario) start to finish without needing anything  
outside this list. This is deliberately narrower than the full feature set — the MVP  
question is "what does the flagship task need," not "what has been built."\*

\*\*Navigation (reworked from the prior synthesis, re-scoped here for the study specifically):\*\*  
\- 🔲 Dominant-hand wheel-menu binding \+ pinch double-toggle fix (prerequisite for  
  everything else in this gate — an input layer that double-fires or binds to the wrong  
  hand will read as "the participant made an error" in study data when it was the tool)  
\- 🔲 Lens dock: consolidate the six existing hidden-by-default panels into one tabbed  
  surface, so a participant isn't left guessing which of eight toggles surfaces what  
\- 🔲 Wheel content scoped to the task: Explore / Inspect / Compare / Annotate only —  
  not the full six-category taxonomy, which the task doesn't need and which adds  
  interaction-cost variance the study doesn't want to measure by accident  
\- 🔲 Minimal Observatory (dataset load \+ one saved view) — collaboration entry  
  explicitly excluded from MVP scope

\*\*Missing core capability:\*\*  
\- ✅ \*\*First-class Compare operation.\*\* Implemented in `7649446` as a dedicated
  (verified: \`DatasetOperations.ts\` has diff-adjacent ops but no unified compare-selected-  
  vs-baseline capability). This is not a nice-to-have — "Find the Fraud" and most  
  plausible study tasks are fundamentally comparison tasks (selected vs. population,  
  anomaly vs. baseline). Without it, the flagship study can't be run as designed.  
\- 🔲 \*\*Draco explainability surface ("Why this view?").\*\* The recommender  
  (\`ConstraintEngine.ts\`) already computes scored, weighted rationale internally — it's  
  not exposed to the user. For a study measuring trust/comprehension of an AI  
  recommendation, this needs to be visible, not just logged to the diagnostic HUD.

\*\*Accessibility (promoted from "nice to have" to MVP because it's a validity issue, not  
just a UX issue):\*\*  
\- ✅ \*\*Colorblind data encoding.\*\* Implemented in `7649446`;
  `categoricalColor()` uses a dedicated colorblind-safe palette when the mode is active. If the study recruits a
  representative sample and doesn't screen for color vision, this isn't just an  
  accessibility gap — it's a confound that would silently degrade a subset of  
  participants' task performance for reasons unrelated to the variable being studied.  
  The implementation uses a dedicated colorblind-safe categorical palette (Okabe–Ito), not just wiring the
  existing 4-role \`remapColor()\` into a 6+-category use case (confirmed that would still  
  collapse same-hue-family categories).  
\- 🔲 Text legibility pass (frosted panel backing, minimum contrast) — same logic: illegible  
  text is a confound for a comprehension-measuring study, not just a polish item.

\*\*Explicitly NOT in this gate (deferred, not because they're bad ideas but because the  
flagship task doesn't need them):\*\* full context-sensitive wheel states beyond the task's  
four actions, the "Inquiry Wheel" semantic reframe, menu memory, TDA/persistence-diagram  
lenses (already correctly made on-demand/hidden per Sprint 22.2 — keep it that way for  
MVP), voice interaction, multi-peer collaboration.

\*\*Gate 2 exit criteria (observable, not aspirational):\*\* a first-time participant, with  
only the in-tool onboarding (guided tour / JIT gesture hints — no researcher instruction  
beyond consent and task framing), can: begin the session unassisted; identify the target  
representation/artifact for the task; inspect it; compare it against a baseline/population  
using the new Compare operation; capture the finding (annotation/export); recover from at  
least one induced error state (e.g. a bad selection, an accidental delete) without the  
session becoming unrecoverable; resume a previously saved session; and, where the task  
depends on it, correctly distinguish a semantic spatial encoding (position that represents  
a data variable) from a purely structural/layout relationship (position that's just where  
the layout algorithm put something) — this last one matters specifically because the  
project's own research notes already flag that a participant seeing a cluster doesn't  
necessarily understand what "cluster" means, and a study measuring comprehension needs to  
know whether false spatial inference is happening, not just whether the participant found  
the right node. This list is  
deliberately binary/checklist rather than a numeric threshold — the pilot run is what  
should generate the first real success-rate/time targets, not a number invented before  
any data exists.

\*\*Operational note (execution-level, not a scope change):\*\* run this gate's dry run with  
two perspectives at once, not one — a naive participant completing the task, and the  
researcher attempting to observe/score that same run via Gate 2.5's console. A workflow  
that a participant can complete but a researcher can't reliably score is not actually  
done; the two dry runs are cheap to combine once the basic flow exists and catch this  
class of gap early rather than at Gate 6\.

\---

\#\# Gate 2.5 — Research Observation (promoted from Parked → Stable)  
\*Theme: Architecture \+ Security \+ UI. Exit criterion: a researcher can join a running  
participant session as a non-participating observer, see what the participant sees and  
does, mark timestamped qualitative observations, and — only in explicitly permitted  
protocol states — issue predefined prompts. Not collaborative editing; a distinct,  
asymmetric role.\*

\*\*Why this belongs in Stable, not Parked:\*\* the original scoping treated "collaboration"  
as one thing and deferred all of it. That was wrong for this specific sub-case. Without  
observation, the flagship study is reduced to whatever automated telemetry captures — a  
dwell-time number with no way to know whether it means careful reading or confused  
circling. The roadmap's own \`UXFrustrationAnalyzer\` already makes exactly this point  
about telemetry alone being ambiguous without human judgment; observation is the missing  
half of that argument, not a separate feature request.

\*\*What already exists and can be repurposed, verified this session (zero call sites,  
i.e. dead but real code, not vaporware):\*\*  
\- 🔲 \*\*\`AsymmetricDesktopCompanion\`\*\* — confirmed built, confirmed never instantiated  
  anywhere in \`src/\`. Its existing feature set (view-follow camera sync, bookmark  
  quick-jump, peer-presence display, spectator text comments) is, structurally, most of  
  what an observer console needs already. This substantially de-risks Gate 2.5: it is a  
  wiring-and-extension task, not a from-scratch build.  
\- 🔲 \*\*\`PeerAvatarManager\` / \`CollaborativeStateSync\`\*\* — also confirmed built, zero call  
  sites. Relevant to observer mode only for the participant's avatar/pose visibility  
  piece (so the researcher can see head/hand movement, not just a camera feed);  
  full bidirectional collaborative-analysis semantics remain out of scope.

\*\*What's genuinely new (not a rewiring of existing dead code):\*\*  
\- 🔲 \*\*Explicit participant/observer role model at the network layer\*\* (see Gate 1  
  addition above) — the actual architectural prerequisite.  
\- 🔲 \*\*Protocol-state machine: Passive / Prompt / Assisted.\*\* Every trial records which  
  mode was active. Passive \= observer cannot act on the session at all beyond viewing;  
  Prompt \= observer can trigger a small set of predefined prompt strings/events, nothing  
  freeform; Assisted \= observer may intervene per protocol. This needs to be enforced in  
  code (the observer's client literally cannot send manipulation events while in Passive  
  mode), not just a researcher instruction to "please don't touch anything" — the whole  
  point is that the system, not the honor system, guarantees the participant's data isn't  
  contaminated by unrecorded intervention.  
\- 🔲 \*\*Minimal researcher console.\*\* Session/participant ID, elapsed time, current  
  dataset/representation/selection/task-state readout, a small fixed set of observation  
  tags (confusion / hesitation / discovery / navigation-difficulty / gesture-difficulty /  
  verbal-query) plus a free-text timestamped note field, and trial controls (mark, pause,  
  resume, reset). Explicitly not required to be polished — "reliable and low-distraction"  
  is the bar, not production UI quality, since this is a researcher-facing tool, not a  
  participant-facing one and isn't part of the MVP feature set participants experience.  
\- 🔲 \*\*Session recording schema\*\*: participant ID, condition, task, timestamp, event type,  
  observation tag/note, and the analytical state snapshot at that moment — structured so  
  it can be joined against the automated telemetry stream after the fact (the  
  triangulation the study design depends on: quantitative time-on-task \+ behavioral  
  telemetry \+ qualitative observation, correlated by timestamp).  
\- 🔲 \*\*Event sequencing / clock correlation.\*\* Wall-clock timestamps alone aren't reliable  
  enough once observer notes, participant telemetry, and network-relayed events are being  
  correlated across potentially-varying latency — "researcher observed X at time T" needs  
  to actually line up with "participant state was X at time T." Every event this gate  
  produces should carry \`sessionId\`, \`trialId\`, a monotonic per-session sequence number,  
  both client and server timestamps. This is a small, mechanical addition on top of the  
  recording schema above, not a new subsystem — but it's the difference between "these  
  logs happened around the same time" and "these logs can be reliably joined."  
\- 🔲 \*\*Every observer action is its own logged event, not just the protocol-state label.\*\*  
  Not merely recording that a trial ran in Prompt mode — record \`observer.entered\`,  
  \`observer.prompted\`, \`observer.paused\`, \`observer.resumed\`, \`observer.marked\`,  
  \`observer.reset\`, \`observer.assisted\` as discrete, timestamped events. This is what makes  
  the intervention history reconstructable after the fact (did the researcher prompt once  
  or five times? when, relative to the participant's own actions?) rather than a single  
  opaque mode label covering the whole trial.

\*\*Explicitly still NOT in Gate 2.5 (remains Parked, per the original collaborative-  
analysis reasoning, which still holds for this half):\*\* two analysts jointly manipulating  
one dataset, shared editable annotations, multi-user co-navigation, voice chat, avatar  
social expression, conflict resolution for simultaneous edits. The distinction that  
matters: an observer has \*read visibility plus a narrow, code-enforced action allowlist\*;  
a collaborator has \*general write access to shared state\*. Only the former is required to  
run the study.

\---

\#\# Gate 3 — Non-Functional Requirements: Hardware Validation  
\*Theme: NFRs. Exit criterion: the performance and comfort claims embedded in every other  
gate above are backed by real measurement, not mocked-GL unit tests. This is the single  
largest standing gap identified across this entire review series.\*

\*\*Operational note: this is continuous qualification feeding UX, not a validation step  
that waits for Gate 2 to be finished.\*\* Take the first real Quest measurement as soon as  
the flagship task is minimally runnable, not after the analyst journey is declared  
polished — hardware may reveal the dashboard is too close, text is too small, the wheel  
interaction is tiring, or tracking degrades during the exact task workflow, and those  
findings are far cheaper to act on before the UX is considered settled than after. The  
formal exit gate below still applies; the point is not to defer contact with hardware  
until then.

\- 🔲 \*\*Run the load-test harness on real Quest hardware.\*\* The harness itself  
  (\`LoadTestPanel\`, staircase driver, frame-time/dropped-rate/JS-heap collection) is built  
  and unit-tested, but \`logs/loadtest-results.jsonl\` does not exist — it has never  
  actually been run on a headset. This blocks a real go/no-go on the WASM command-buffer  
  question, and blocks knowing whether the flagship study's target dataset size will even  
  run acceptably.  
\- 🔲 \*\*Real-GL smoke coverage exists but is explicitly non-blocking and doesn't touch  
  \`navigator.xr\`.\*\* The Playwright smoke test (verified this session) is a legitimate step  
  up from fully-mocked WebGL, but it's headless Chromium, not a headset — it cannot answer  
  "does hand tracking work," "is text readable at arm's length in-headset," or "does the  
  comfort vignette actually reduce reported discomfort." None of these have been measured.  
\- 🔲 \*\*Formalize as a hardware-validation matrix\*\*, per the roadmap's own research section:  
  device × {startup, hand tracking, controller, target dataset size, comfort, text  
  readability, reduced motion} with firmware/browser version recorded per cell — not ad  
  hoc spot-checks.  
\- 🔲 \*\*Extend the matrix beyond raw performance to experience quality\*\*: task-interruption  
  rate, tracking-loss rate, time-to-recovery from tracking loss, self-reported discomfort,  
  observer-rated confusion (feeds from Gate 2.5's tags), and text readability at actual  
  in-headset viewing distance. FPS/dropped-frames/heap alone can look fine while the  
  actual experience doesn't — these measures are what would actually explain a bad study  
  result on the hardware axis rather than just confirming frame budget was met.

\*\*This gate has no code-fix component — it's a data-collection exit criterion that gates  
whether Gate 2's UI decisions (panel distance, text scale, comfort vignette) can be  
trusted as-shipped or need revision once real data exists.\*\*

\---

\#\# Gate 4 — Tech-Debt Cleanup That Affects Trustworthiness of Results  
\*Theme: Tech Debt. Exit criterion: the documentation and dead-code surface area  
accurately reflects what's shipping in the stable release, so nobody (including the team)  
mistakes aspirational capability for tested capability.\*

\- 🔲 \*\*Correct the stale roadmap claim.\*\* \`docs/ROADMAP.md:201\` still checks off  
  "colorblind-safe palettes" as complete under the historical Phase 10 record, directly  
  contradicted by the accurately-tracked open gap 450 lines later in the same document.  
  Fix before the stable release, not after — an internally contradictory source-of-truth  
  document is itself a tech-debt item.  
\- 🔲 \*\*Reconcile the four-tier vs. two-tier instancing spec drift.\*\* \`CLAUDE.md\` documents  
  four discrete LOD bands; the actual code implements two plus an adaptive scale factor.  
  Per the roadmap's own recommended default: correct the spec to match reality unless  
  Gate 3's load-test data shows the middle band actually matters. Cheap, and removes a  
  documentation claim that overstates the system's sophistication to anyone auditing it  
  (including future study reviewers/reproducers).  
\- 🔲 \*\*Decide the fate of remaining built-but-never-wired classes.\*\* \`BinaryPoseSerializer\`  
  and any collaborative-analysis-only pieces of \`CollaborativeStateSync\` not claimed by  
  Gate 2.5 (see below) remain zero-call-site dead code as of this review and should be  
  explicitly marked out-of-scope/deferred in code comments or removed from the build for  
  the Stable cut, not left as ambiguous "is this shipping or not" surface area.  
  \*\*Correction from the prior revision of this roadmap:\*\* \`AsymmetricDesktopCompanion\`,  
  \`PeerAvatarManager\`, and the pose-sync portion of \`CollaborativeStateSync\` are no longer  
  in this "undecided" bucket — Gate 2.5 explicitly claims them as the observer-console  
  scaffold, so they're deferred-then-reclaimed, not deferred-then-deleted. This item exists  
  specifically so that reclamation is recorded in one place rather than left implicit.

\---

\#\# Gate 5 — Experimental Validity & Study Harness  
\*Theme: NFRs \+ Data Governance. Exit criterion: the flagship study can be run,  
repeated, and defended methodologically — not just "the software works," but "the  
resulting numbers mean what they claim to mean." Confirmed by direct code search: no  
trial, condition, counterbalancing, or consent concept exists anywhere in the codebase  
today (the one hit for "consent" is an unrelated telemetry opt-in toggle used during load  
tests). This gate is genuinely greenfield, unlike Gate 2.5 — there is no dead code to  
reclaim here.\*

\*\*Why this is a separate gate from Gate 2.5, not a subset of it:\*\* Gate 2.5 gives a  
researcher eyes on one session. Gate 5 is what makes many sessions, run under different  
conditions by different participants, add up to a comparison that means anything.  
Conflating them was the gap in the prior revision — Gate 2.5 answers "can I watch a  
trial," Gate 5 answers "do fifty trials constitute an experiment."

\- 🔲 \*\*Study/trial data model.\*\* Explicit \`participantId\` (pseudonymous, e.g. \`P014\`, not  
  a real identifier — see governance below), \`trialId\`, \`condition\` (2D / VR-3D),
  VR-3D), \`taskId\`, \`protocolVersion\`. None of this exists today; it needs to be added as  
  a first-class layer above the existing per-session save format in  
  \`WorldSessionController\`, not folded into it.  
\- 🔲 \*\*Condition counterbalancing.\*\* If every participant runs 2D → VR in
  the same order, practice effects confound the result indistinguishably from a real  
  spatial-representation effect. Needs an assignment mechanism (e.g. Latin square across  
  participants), recorded per trial so order can be checked as a covariate later.  
\- 🔲 \*\*Explicit trial-state machine\*\*: started / paused / resumed / completed / failed /  
  reset, each timestamped. Without this, "the participant restarted" and "the session  
  crashed" are indistinguishable after the fact — exactly the ambiguity that makes a  
  result "scientifically squishy" rather than defensible.  
\- 🔲 \*\*Outcome capture\*\*: answer, correctness (against a scored ground truth per task),  
  completion time, confidence rating, and a workload measure. \*\*Use a validated instrument  
  (e.g. the standard NASA-TLX protocol) or an explicitly-documented custom short-form  
  instrument, clearly labeled as custom\*\* — don't casually modify a validated instrument  
  and still call it by that name, since that would make results non-comparable to  
  published literature under a false pretense. The roadmap doesn't need to prescribe which  
  option yet, but the choice needs to be made and stated, not left ambiguous. This is new  
  UI, but small — a handful of end-of-trial prompts, not a feature.  
\- 🔲 \*\*Triangulation join key.\*\* Gate 2.5's recording schema already timestamps  
  observations; Gate 5 needs the automated telemetry stream, the trial/outcome data above,  
  and the observer log to share one join key (\`trialId\` \+ timestamp) so they can be  
  correlated after the fact without manual reconciliation.  
\- 🔲 \*\*Canonical 2D control, as its own implementation milestone — not an afterthought.\*\*  
  The 2D condition needs the \*same\* dataset, task wording, scoring rubric, and analytical  
  semantics as the VR condition, built and versioned alongside it, not
  assembled ad hoc when the study is about to run. Without this, the comparison is  
  "Nemosyne vs. some other tool," not "Nemosyne vs. 2D" — a materially weaker claim.  
\- 🔲 \*\*Experimental confound register.\*\* A living document (separate from, but  
  cross-referenced by, this roadmap) tracking known non-technical confounds and how each  
  is controlled or intentionally left as a variable: representation-explanation parity  
  (does the VR participant get more onboarding than the 2D participant?), input-training  
  parity, researcher-intervention asymmetry (tracked automatically via Gate 2.5's  
  Passive/Prompt/Assisted state — this is the one confound Gate 2.5 already instruments),  
  practice/repeated-dataset effects, interface novelty (treated explicitly as a variable  
  to measure, not a defect to eliminate).

\*\*Data governance layer (new — not previously in this roadmap):\*\*  
\- 🔲 \*\*Data dictionary.\*\* For every captured field, not just the storage schema: source  
  (e.g. XR camera pose vs. derived from task events), meaning, unit, sampling rate,  
  whether it's raw or derived, retention class, and whether it's disclosed to the  
  participant. E.g. \`headYaw\` — source: XR camera pose, unit: radians, sampling: per  
  frame, derived: no, retention: ephemeral; versus \`navigationTime\` — source: derived from  
  task events, unit: ms, sampling: per trial, derived: yes, retention: study dataset. This  
  is a small addition on top of the schema work above but pays for itself the moment  
  analysis starts — without it, "what does this column actually mean" becomes a research  
  question of its own.  
\- 🔲 \*\*Consent.\*\* What is recorded (telemetry, pose/gaze data, observer notes, any session  
  recording) and why, disclosed to the participant before the trial starts — this is a  
  protocol/paperwork requirement with a system-design consequence: the software needs a  
  documented, inspectable list of exactly what it captures, not a vague "we log stuff."  
\- 🔲 \*\*Data minimization.\*\* Decide per data stream whether raw trajectories or only  
  derived measures (e.g. dwell time, not full gaze-ray history) are actually needed —  
  driven by the study design in this gate, not collected by default because the telemetry  
  system happens to be capable of it.  
\- 🔲 \*\*Pseudonymization.\*\* Participant IDs, not names, inside any exported dataset —  
  applies to the \`participantId\` field above and to Gate 2.5's session recording schema.  
\- 🔲 \*\*Retention and deletion.\*\* How long recordings/observations are kept, and a real  
  "export and delete this participant's complete session" path — not just a database  
  row deletion, since Gate 2.5's data spans telemetry, observer notes, and analytical  
  state snapshots that need to be deleted together.  
\- 🔲 \*\*Observer visibility to the participant.\*\* The participant should have a clear,  
  in-session indication that they are being observed/recorded (not just a consent form  
  signed beforehand) — a small addition to Gate 2.5's participant-side UI, not a new  
  subsystem.

\---

\#\# Gate 6 — Stable Release Candidate  
\*Theme: Process. A freeze gate, not a feature phase — the point where the roadmap ends  
and the study begins. Exit criteria are checks against everything above, not new work.\*

\*\*No new features admitted here.\*\* The gate consists of running one full rehearsal of  
the actual study machinery end to end, on each target condition, on a genuinely fresh  
environment — not merely a "clean install" in the sense of a fresh app build, since a  
browser can still carry over IndexedDB contents, cached assets, or local storage from  
prior sessions, and session persistence is itself part of the study workflow being  
rehearsed:  
\- Fresh environment (new browser profile, empty IndexedDB, empty local storage, fresh  
  build artifact, defined network conditions) → fresh participant → researcher observer  
  joins → full trial (start, task, Compare, capture finding, an induced-error recovery,  
  session save) → resume from saved session → export the trial record → delete-participant  
  path exercised → repeat on 2D, repeat on Quest hardware.

\*\*Frozen experiment package.\*\* The rehearsal above is only reproducible if the protocol  
itself is versioned and frozen alongside the software, not assembled from whatever  
documents happen to exist when the study starts. Extends the prior revision's file list  
with two additions: \`analysis-plan.md\` (primary/secondary outcomes, exclusion rules,  
missing-data treatment, planned condition comparisons and qualitative coding, decided  
\*before\* data collection so the study can't become a fishing expedition across RQ1–RQ5  
after the fact) and \`data-dictionary.md\` (Gate 5 already requires this content — it  
belongs physically inside the frozen package, not only in the code/docs tree, so the  
study is reproducible from protocol through analysis in one place):  
\`\`\`  
experiment/  
├── protocol.md  
├── analysis-plan.md  
├── data-dictionary.md  
├── tasks.json  
├── datasets/  
├── scoring.json  
├── condition-order.json  
├── consent.md  
├── observer-guide.md  
└── version.json  
\`\`\`  
Tag the exact Nemosyne commit/build against this package. Without it, "we ran the Stable  
release" doesn't actually specify what was run. A real skeleton of this package, with  
starter content for each file grounded in this roadmap's own decisions, exists as a  
companion deliverable alongside this document.

\*\*Exit only when:\*\* no open P0/P1 defects from Gates 0–1, each with its deterministic  
reproduction fixture in place; the Gate 2 checklist criteria pass unassisted; the Gate 2.5  
protocol-state enforcement holds under an adversarial attempt to act while Passive; Gate  
3's hardware matrix has at least one clean pass per target device, including the  
experience-quality measures, not just raw performance; Gate 4's documentation matches  
what's actually shipping (no stale claims like the Sprint 10A.5 discrepancy this roadmap  
already caught once); Gate 5's telemetry/observer/outcome streams join correctly on a real  
trial's data via the event-sequencing fields, not just synthetic test data, and the data  
dictionary is complete for every field the frozen package actually captures; and the  
release artifact is tagged against the frozen experiment package above. This is the  
roadmap's actual finish line — every gate before it exists to make this rehearsal boring  
rather than eventful.

\*\*Known Limitations (Stable Release does not claim):\*\* production analytics readiness;  
multi-analyst collaborative editing; clinical or domain-expert-grade validity; superiority  
over 2D (that's the open question the study exists to answer, not an assumed result);  
general-purpose visualization recommendation beyond the datasets/tasks in the frozen  
experiment package; Quest performance beyond the specific tested envelope in Gate 3's  
matrix. This list ships as part of the release artifact specifically so the first study's  
results aren't later over-read as validating capabilities that were never actually tested.

\*\*Release record binding.\*\* Every trial result must be reconstructable from a single  
composite reference, not a loose label like "VR condition":  
\`{Nemosyne build/commit} \+ {experiment package version} \+ {protocol version} \+ {dataset  
version} \+ {task version}\` — e.g. \`nemosyne@abc123 \+ experiment@0.3 \+ task@Fraud-01 \+  
dataset@F-2026-08-11\`. \`protocolVersion\` already exists in Gate 5's trial data model;  
this extends it to the full chain so a result can be traced back to exactly what ran,  
not just which condition it was.

\---

\#\# Explicitly Out of Scope for "Stable Release" (Parked)

Per the same logic used to scope Gate 2 — these are real, some are good ideas, none are  
needed to make the core hypothesis testable, and building them now would be exactly the  
"implementation running ahead of validation" pattern already identified as the project's  
central risk:

\- \*\*Collaborative analysis specifically\*\* (as distinct from observational collaboration,  
  now in Gate 2.5): embodied presence wiring for multi-analyst co-manipulation, shared  
  editable annotations, moderation/kick for peer-to-peer sessions, reconnection state for  
  a disconnected co-analyst. Correctly gated behind solo-mode validation succeeding  
  first — this is the part of the original "defer all collaboration" reasoning that still  
  holds; it was only over-broad in also deferring the observer role.  
\- Voice/NLQ expansion beyond its current implemented state  
\- TDA as a core (not on-demand/optional) capability  
\- SQL/Parquet/warehouse connectors  
\- Rust/WASM migration beyond the Gate 0 defect fixes — no architectural acceleration  
  without a measured bottleneck from Gate 3's data  
\- The "Inquiry Wheel" semantic reframe, full six-category wheel taxonomy, menu memory —  
  all genuinely interesting, all belong in the \*research\* backlog as study variables  
  (metaphor-comprehension study), not the stable-release feature set

\---

\#\# Sequencing Rationale (why this order, not another)

\`\`\`  
Gate 0 (Runtime) ──→ Gate 1 (Security) ──→ Gate 2 (Analyst UX) ──→ Gate 2.5 (Observation)  
                                                                          │  
                                                        ┌─────────────────┴─────────────────┐  
                                                        ↓                                     ↓  
                                              Gate 3 (Hardware & Perf)              Gate 5 (Study Harness)  
                                                        └─────────────────┬─────────────────┘  
                                                                          ↓  
                                                                  Gate 4 (Trust/Tech-Debt)  
                                                                          ↓  
                                                                  Gate 6 (Release Candidate)  
                                                                          ↓  
                                                                    FIRST REAL STUDY  
\`\`\`

Gate 0 and Gate 1 come first because they're validity-threatening at the infrastructure  
level — a leaked GPU context or a data-corrupting stale DataView doesn't produce a bad  
UX, it produces \*wrong study data that looks like good data\*. Gate 2 is scoped to exactly  
one task's needs rather than the full feature backlog, because the stated goal is  
testability, not completeness — every item added beyond what "Find the Fraud" requires is  
schedule risk with no corresponding validity benefit. Gate 2.5 depends on Gate 2 (there  
must be a session worth observing) and gates entry into the two tracks that follow.

\*\*Gates 3 and 5 run in parallel, not sequentially\*\* — this is a correction from the  
prior revision, which listed Gate 3 as a standalone step. Hardware/performance validation  
and study-harness construction don't depend on each other and benefit from running  
concurrently: hardware observations should feed back into UX refinement while the team  
can still change the UX, and the study harness (trial state, outcome capture, 2D control)  
needs to exist before \*any\* condition can be piloted, VR or otherwise — there's no reason  
to gate one behind the other. Gate 2.5 sits upstream of both because a researcher watching  
a hardware-validation session produces better diagnostic data than logs alone, and because  
Gate 5's observer-log triangulation depends on Gate 2.5's recording schema already  
existing. Gate 4 moves to \*after\* Gates 3 and 5 in this revision (previously positioned  
right after Gate 3\) because tech-debt/documentation cleanup should reflect the system as  
it actually ships once the harness and hardware work are done, not freeze documentation  
prematurely and then have Gates 3/5 invalidate it. Gate 6 is last by definition — it's a  
freeze and rehearsal gate, not build work, and exists specifically so the first real study  
session is the boring, well-rehearsed one rather than the first time all the pieces run  
together.



---

## Imported source: `ROADMAP_HISTORY.md`

# Roadmap History

This document archives completed, superseded, and deprecated roadmap material removed from the
live roadmap. It is historical context only. Do not use it to determine current implementation
status or planned work.

The live roadmap is [`../ROADMAP.md`](../ROADMAP.md). Product direction and governance are in
[`../Nemosyne_Definitive_Vision_and_Roadmap.md`](../Nemosyne_Definitive_Vision_and_Roadmap.md).

## Completed Phase Index

The following phases were completed or substantially implemented before the current
Stable Alpha / Atlas planning cycle:

| Phase | Historical scope | Current interpretation |
| --- | --- | --- |
| 1 | Foundation | Runtime, WebXR, input, telemetry, and tests established |
| 2 | Specification | Draco constraints and serializable visual specifications |
| 3 | Core framework | Dataset model, topology translation, panels, streams, and menus |
| 4 | Examples and documentation | Initial product and example documentation |
| 5 | Artefact library | Artefact variants, topology layouts, TDA glyphs, and transforms |
| 6 | Real-world deployment | Build/deploy pipeline, desktop fallback, serializers, collaboration scaffolding |
| 7 | Comfort and scalability | Anchoring, feedback, instancing, spatial index, LOD, and metaphors |
| 8 | Analytics and TDA | Statistical facts, clustering, anomaly operations, chart planes, and TDA summaries |
| 9 | Production polish | Inspector, tooltips, menus, dashboards, locomotion, tour, gestures, and themes |
| 10A | Validate and harden | CSV import, session persistence, export, accessibility, telemetry, gesture coaching |
| 10B | Scale and collaborate | Networking, shared state, avatars, annotations, and desktop companion scaffolding |
| 11 | Runtime intelligence and ergonomics | Torso anchor, wheel redesign, guided tour, UX analysis, pooling |
| 12 | AI tuning and validation | Gesture harness, recommender evaluation, feedback loop, benchmarks, and polish |
| 13 | Ingestion and provenance export | Import mapping, binary parser experiments, export and recovery work |
| 14 | Runtime performance | Texture caching, buffer updates, frame governor, and memory work |
| 15 | Collaborative palaces | WebRTC state, peer presence, annotations, and collaborative benchmark scaffolding |
| 16 | Voice and natural language | Speech query and audio feedback experiments |
| 17 | Architectural hardening | World decomposition, worker experiments, networking, and governor integration |
| 18 | Runtime integration | Scene/workspace wiring, workers, binary pose, and governor integration |
| 19 | Zero-copy protocol | Binary peer IDs, event dispatch, workspace lifecycle, and protocol hardening |
| 20 | Graphics optimization | Instanced buffers, canvas upload, context recovery, and frame shedding |
| 21.1-21.7 | Rust/WASM analytical substrate | Tooling, data, 3D layouts, and Draco constraint solver in WASM |
| 22.1-22.10 | Low-Strain UX V2.0 & GPU Hygiene | Onboarding, accessibility, embodied avatars, and GPU lifecycle |
| 23.1-23.5 | Gesture Intelligence & Retraining | Host adapter, personalizer, consent upload, and central retraining |
| 24.1-24.9 | Analyst Cockpit & Interaction FSM | 4-mode FSM, forgiving HandWheel, contextual surfaces, and status strip |
| 25.1-25.3 | Perception & Quest Hardware Envelopes | Quest 3S hardware envelope validation and 2D-vs-VR study analysis |
| 26.1-26.2 | Position Semantics & Empirical Draco | Position discipline HUD warnings and empirical study utility tuner |

For the full sprint-by-sprint completion logs and verification records for Phases 21–26, see:
- [`ROADMAP_PHASES_21-26_COMPLETED.md`](ROADMAP_PHASES_21-26_COMPLETED.md)
- [`ROADMAP_PHASES_1-20_COMPLETED.md`](ROADMAP_PHASES_1-20_COMPLETED.md)

These entries describe historical workstreams, not a guarantee that every capability is fully
wired, production-qualified, or suitable as study evidence. The audit documents retain the
original evidence and caveats:

- [`../AUDIT_PHASES_1_20.md`](../AUDIT_PHASES_1_20.md)
- [`../AUDIT_RECOMMENDATION.md`](../AUDIT_RECOMMENDATION.md)
- [`../PHASE_22_3_VALIDATION_REPORT.md`](../PHASE_22_3_VALIDATION_REPORT.md)

## Superseded Planning

- The former “Validate & Harden OR Scale & Collaborate” fork is closed as a planning model.
  Stable Alpha now has its own research-instrument gates; collaborative analysis remains
  deferred.
- The former stable-alpha roadmap is historical. Its unique study-harness requirements are
  represented in the live roadmap and canonical study package.
- The former broad AI, voice, TDA, connector, and multiplayer expansion lists are not active
  priorities unless promoted through a current roadmap decision.
- The former Atlas proposal remains detailed design background, but the approved release split
  and governance are in the product architecture document.

## Deprecated Claims

The following claims must not be carried forward merely because they appeared in completed
phase headings:

- A class with tests is not necessarily production-wired.
- Existing session persistence is not analytical provenance or deterministic replay.
- Existing clustering/TDA utilities are not automatically validated statistical methods.
- Existing collaboration code is not a Stable Alpha requirement.
- Runtime tests and benchmarks do not demonstrate user benefit or VR superiority.

## Archive Policy

Add future historical summaries here when a live roadmap section is retired. Keep the live
roadmap focused on active work, blockers, acceptance criteria, and decisions. Do not append
completed feature inventories to `docs/ROADMAP.md`.

