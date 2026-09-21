# Nemosyne Roadmap & Implementation Status

> **Canonical implementation-status and execution authority.** Product and research direction remain governed by `docs/Nemosyne_Definitive_Vision_and_Roadmap.md` V3.1. This file is the current operational map: what is active, which programme owns it, which integration seams are exclusive, what evidence closes a checkpoint, and what must wait. Detailed programme documents remain the scientific, UX, security, or evidence specification for their own scope; their older status headers do not override this live roadmap.

## Status snapshot - 21 September 2026

**Current integration base:** `main@a9fcb5cdece5267a8d1a1823cc21fc5276c4ee14` (#807). UXR2 bounded presentation-resource lifecycle is landed. UXR3 has reached its finite bounded-software STOP: #763/#764/#769 establish semantic materialisation, replacement and identity-preserving collapse/evict/reconstruct; #779/#781/#783 close Worker admission, safe stale recycling and lifecycle outcomes; #790 closes the single-computation Rust/WASM prepared-result transfer finding; and #791 removes redundant fresh-load dataset copies without changing analytical authority. #806 binds governed UXR4 Quest 5/30/60-minute qualification profiles to the existing evidence chain, leaving physical evidence acquisition open rather than inferred from software/simulator results. #807 then fixes the persistent XR workspace-panel authority exposed during physical preparation, including lazy panel creation/reachability regressions. The immediate P1-UXR frontier is therefore governed UXR4/UXR5 physical Quest evidence acquisition and adjudication, beginning with the 5-minute functional profile; further UXR implementation should be driven by failures observed there. After UXR5, P1-WP productionizes and deploys the ordinary web application for broad investigator access; P1-WQ then qualifies the deployed browser investigation experience. P1-TEC then closes the already-established trustworthy-evidence substrate before PT9 Learned Moneta and PT10 private-preview learning. P1-MCR names the downstream compositional-representation expansion explicitly; evolutionary synthesis remains a separate laboratory/search workstream and may not bypass P1-TEC evidence closure.

**R1 transfer closure:** Mapper, persistence intervals, Betti-0, statistics, dataset JSON, the five semantic embodiment builders, semantic detail and direct spectral facts use Rust-owned prepare/read/destroy result transfer through the production bridge. #790 closes the duplicate-authoritative-computation finding with production-path evidence for one substantive computation/materialisation and explicit result lifetime handling. #791 separately removes redundant fresh-load copies at the Atlas handoff. These changes do not by themselves establish measured latency, physical-memory improvement or total semantic-memory bounds; those remain evidence claims for the relevant UXR4/UXR5 envelopes.

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

The next implementation wave stays inside UXR3 until the public semantic working-set contract is closed. Keep one forward implementation PR at a time and use fresh-main exact-head promotion.

1. **UXR3-F1 — family payload/cost authority and inventory. PARTIALLY LANDED.** #772 lands the first independent presentation-cost admission contract and its deterministic accounting/failure falsifiers. Complete the remaining inventory across every production semantic family and materialisation/transfer path, identify which already has hard cardinality/byte/work bounds, and preserve the rule that presentation cost cannot become analytical authority. **Adversarial pre-work:** architecture/authority committee attacks accidental second authority and false genericity; performance committee attacks metrics that do not correspond to retained/transfer/render cost; prior-art committee checks bounded caches, admission control and streaming/backpressure techniques before custom machinery is added.
2. **UXR3-F2 — first generic production enforcement.** Apply F1 to the highest-leverage currently unbounded family/path, preserving old-authority-on-failure and semantic identity. Add deterministic overflow, stale-generation, cancellation and reconstruction falsifiers. **Adversarial post-work:** independent implementation committee attempts bypasses, double-counting, payload retention and identity corruption before promotion.
3. **UXR3-S1 — bounded streaming and transfer lifecycle. LANDED / STOP via #784.** The bounded queue/backpressure, cancellation, generation/revision invalidation and lifecycle-outcome path is closed for its stated software scope. This does not establish physical memory-release timing or latency.
4. **UXR3-R1 — single-computation Rust/WASM result transfer. LANDED / STOP via #790.** Repair the production ABI defect established by the 20 September runtime review: generic size-probe/read calls must not execute expensive authoritative analysis twice. Preserve Rust/WASM analytical authority and provenance. Prefer a bounded Rust-owned prepared-result handle/cache or equivalent explicit prepare/read/free contract over guessed large buffers; make ownership and destruction explicit so the fix cannot trade duplicate computation for unbounded retained results. Cover expensive TDA exports first (Mapper, persistence intervals, Betti-0), then other production exports proven to recompute on the sizing call, including statistics and dataset JSON materialisation where applicable. **Required falsifiers/evidence:** instrument the real production bridge and prove exactly one substantive analytical computation per successful public operation; prove prepared results are released on success, error, cancellation, supersession and runtime teardown; prove output identity/provenance is unchanged; retain existing missing-value and resource-refusal semantics; record static call-graph evidence separately from measured latency/memory evidence. **Automation:** treat `.agents/skills/nemosyne-runtime-review/SKILL.md` as the reusable review contract for this tranche. Convert its five failure classes into focused production-path regression checks where mechanically testable, especially duplicate-computation call counts, runtime/result lifetime cleanup, resident-handle disagreement and copy-amplification counters. Wire the deterministic subset into the normal repository test/promotion path rather than relying on a one-off review; keep profiling-only questions explicitly non-gating until a governed measurement contract exists. **Adversarial pre-work:** architecture/authority review attacks second-authority/caching hazards; lifecycle review attacks leaked prepared results and stale handles; performance review attacks false speedup claims and requires measurement before promotion. **Finite exit:** exact-head production-path tests reject duplicate computation and retained-result growth, post-implementation review finds no unresolved material defect, and repository promotion gates pass.
5. **UXR3-E1 — cross-family qualification and finite STOP decision.** Run known-structure and perturbation cases across Aggregate, Distribution, Density, Cluster, Relationship Graph and any other production family actually covered by the generic contract. Demonstrate that source N does not obligatorily drive visible/retained presentation cardinality, that refine/collapse/evict/reconstruct preserves semantic identity/provenance, and that unsupported cases refuse or remain explicitly unqualified. **Adversarial committee:** evidence/statistical committee attacks the inference from bounded software evidence to scale claims; UX/spatial committee attacks whether progressive materialisation remains legible; definitive-vision committee checks dataset-first alignment. A PASS closes only bounded UXR3 software, not physical Quest fitness.
6. **UXR4 — governed verification profiles bound; physical execution ACTIVE.** #806 binds the governed Quest 5/30/60-minute qualification profiles to the existing evidence chain. Execute the 5-minute functional profile first, adjudicate attributable evidence, and convert material failures into bounded fix-forward work before longer profiles. Browser/IWER/simulator evidence remains non-physical evidence.
7. **UXR5 — physical qualification follows successful UXR4 execution.** Complete attributable physical Quest qualification and the finite P1-UXR STOP review only from governed device evidence. #807 removes a persistent workspace-panel authority/reachability defect found during physical preparation but does not itself qualify the device experience. Quest is a specialist modality and reference stress environment; its completion does not make VR hardware a prerequisite for later investigator participation.
8. **Then P1-WP — Web Productionization & Deployment.** Productionize and deploy the ordinary browser application for internet-accessible investigator use. Close production hosting/build, desktop/browser interaction, security/privacy, dataset isolation/ingestion, persistence/recovery, provenance-preserving replay/export, operational observability, deployment/rollback, and consent/evidence-use boundaries. WP expands access beyond specialist VR hardware but does not by itself establish investigator usability or admissible learning evidence.
9. **Then P1-WQ — Web Investigator Qualification.** Qualify the deployed non-VR browser experience with real investigators: prove the core investigation lifecycle is usable and comprehensible on supported ordinary hardware, validate judgment/evidence capture and provenance, characterize browser/hardware diversity, and keep telemetry distinct from consented evidence and training data. WQ is the population/evidence-access gate before PT9.
10. **Then P1-TEC.** Close end-to-end trustworthy-evidence propagation, transport/identity gaps, heuristic terminology debt, adversarial falsification coverage and the Full-Moneta handoff before any learned representation policy consumes the evidence substrate.
11. **Then PT9.** Begin the Moneta learning-evidence pipeline only after WP deployment, WQ qualification and P1-TEC closure establish both a viable investigator-judgment route and a trustworthy evidence handoff.

### Adversarial committee queue

Committee work is evidence-producing work, not ceremony. Run the F1 architecture/performance/prior-art challenge **before implementation** because its outcome defines the cost contract. Run the S1 concurrency/security challenge before touching streaming. For UXR3-R1, run the architecture/authority, lifecycle and performance challenge before changing the ABI, then convert any material disagreement into executable falsifiers. For each implementation PR, bind a separate post-implementation review to the exact head and convert material findings into executable falsifiers. Before UXR3 STOP, run the evidence/statistical, UX/spatial and definitive-vision reviews against one compact cross-family evidence packet. Physical-device and human-comprehension questions remain ABSTAIN/open until attributable physical evidence exists.

## Sequential execution model

The roadmap retains the A/B/C/D programme names because they encode bounded ownership and finite exits, but **they are no longer parallel execution streams**. From 31 August 2026 onward, implementation proceeds as one forward stream. From 11 September 2026 onward, adversarial review is explicitly **recursive rather than merely post-implementation**: consequential choices are attacked before implementation, substantive disagreement becomes falsifying evidence, and results are attacked again before promotion. `roadmap/P1_PRODUCT_TRANSITION_PLATFORM_AND_LEARNING_PLAN.md` remains the strategic tranche specification. Issue #620 is a historical execution checklist whose unchecked items and ordering are stale after PT0-PT8 and the P1-UXR activation; it is not current status authority. This file alone governs live status and next-work sequencing.

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
                  -> P1-TEC trustworthy-evidence closure
                    -> PT9 Moneta learning-evidence pipeline
                      -> PT10 private-preview product/discovery learning loop
                        -> P1-MCR compositional RepresentationGraph / SemanticEmbodiment / SpatialEmbodiment expansion
                           (evolutionary synthesis/search remains a separate laboratory workstream)

Physical Quest/human evidence gates run when their claims require them; they do not block unrelated software work.
```

Only one forward implementation PR should be active at a time unless the user explicitly changes this execution policy. Before each tranche, fetch fresh `main`; after implementation, perform the bounded adversarial review, run the relevant exact-head evidence, fix forward, merge, then fetch fresh `main` again.

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

**Status:** PLANNED GATE / TEC0 AUDIT LANDED (#803); TEC1 RECEIPT-TRANSPORT SLICE LANDED / ADVERSARIAL REVIEW PASS (#805); TEC1 OPEN PENDING AUTHORITY-OWNED REQUIREMENT PROFILES, TYPED POLICY REFUSALS, GOVERNED REPLAY RESOLUTION, DATASET-EVIDENCE IDENTITY BINDING AND MCR2+ EVIDENCE-REFERENCE ENFORCEMENT  \
**Methodological authority:** `docs/STATISTICAL_FOUNDATIONS.md`  \
**Scientific admissibility authority:** `docs/research/MONETA_EVIDENCE_PROTOCOL.md`

P1-TEC does **not** create a second evidence architecture. It closes the one already established by Rust/WASM measurement semantics, analytical admission, `EvidenceClaim<T>`, DatasetEvidence, semantic embodiment and the Moneta evidence protocol. Its purpose is to prove that trustworthy evidence survives the full production path without being flattened into stronger-looking booleans, heuristic confidence labels or representation-side inference before learned/compositional Moneta consumes it.

The closure sequence is deliberately finite:

| Checkpoint | Required work | Exit |
| --- | --- | --- |
| **TEC0 — end-to-end evidence propagation audit** | Trace `MeasurementModelRecord -> AnalyticalGeometry -> EvidenceClaim<T> -> Rust/Worker transport -> DatasetEvidence -> DatasetEvidenceSignature -> SemanticEmbodimentGraph -> RepresentationGraph`. Inventory every evidence axis retained, transformed, summarized or lost, including assumptions, support, uncertainty, stability, sensitivity, limitations and provenance. | One exact-main propagation matrix exists; every lossy edge is classified as intentional compatibility, required migration or blocker. No missing field is silently interpreted as a favourable value. |
| **TEC1 — transport and identity closure** | Close blocker-grade losses across the Rust/WASM/TypeScript boundary. Preserve evidence identity and the independently governed epistemic axes required by downstream admissibility. Use references/receipts where copying the full claim would be inappropriate. Any material ABI/public-format change follows RFC/ADR governance. | Moneta and semantic embodiment can distinguish “not measured”, “unsupported”, “unstable”, “assumption unresolved” and “admissible evidence” without manufacturing analytical facts in TypeScript. Replay pins the same evidence identity or fails closed. |
| **TEC2 — heuristic/terminology migration debt** | Inventory the bootstrap fields already called out in `STATISTICAL_FOUNDATIONS.md` such as magnitude thresholds labelled significance, silhouette-derived “stability confidence”, heuristic periodicity/density scores and sample-count “confidence”. Rename, wrap or replace them without breaking serialized consumers silently. **Slice landed:** the six fields enumerated in the inventory (`docs/audits/TEC2_HEURISTIC_TERMINOLOGY_INVENTORY_2026-09-21.md`) are renamed in place at the Rust transport with no compatibility alias, and the boundary validator now rejects a retired name; that slice also deleted a live TypeScript recomputation of a pair count that held shadow analytical authority at a different threshold. `ClusterProfile.density_variation` (behaviour-bearing) and the `dependence.maxCorrelation` epistemic label are deferred with their own contracts. | Investigator- or Moneta-visible terminology is mathematically honest; compatibility aliases cannot promote heuristic scores into statistical claims. **Not yet met for TEC2 as a whole** — this slice covers the enumerated six only. |
| **TEC3 — adversarial evidence fixtures and method coverage** | Turn the existing statistical-foundations test strategy into production-path falsifiers: numeric identifiers, ordinal/metric misuse, compositional closure, circular wraparound, grouped/repeated observations, nonlinear dependence, Simpson-style reversals, null structure, missing/non-finite support, and high-dimensional refusal/stability cases. Add new analytical method families only where a concrete representation/discovery requirement justifies them. | Each admitted evidence family has at least one positive, null/negative and invalid-domain/refusal fixture. “No structure detected” remains distinguishable from “insufficient information”. |
| **TEC4 — Full-Moneta evidence handoff qualification** | Exercise a compact cross-family packet through the real production path into Moneta, semantic embodiment, persistence/replay and the representation boundary. Verify hard evidence/admissibility gates execute before utility/ranking and cannot be learned around. | PT9 learning, MCR2+ production promotion and any evolutionary production handoff may consume the evidence substrate only when the packet proves provenance continuity, honest abstention and no shadow analytical authority. Otherwise the dependent promotion remains blocked on the failed evidence property. |

P1-TEC non-goals are equally important: it does not require an algorithm zoo; it does not mandate persistent homology, HDBSCAN, knockoffs, PoSI or contextual bandits absent a justified estimand; it does not introduce a universal `evidenceStrength` scalar; it does not merge trustworthy evidence with representation search; and it does not require every conceivable statistical family before PT9. The closure criterion is that every analytical family Nemosyne *does* expose is semantically admissible, honestly named, provenance-bearing and losslessly represented to the degree required by its downstream claim.

Planning/audit work for TEC0 may be performed earlier when it does not collide with the active forward implementation tranche. MCR0/MCR1 contract and validation work may also proceed as bounded pre-work because it does not yet create the production semantic-to-spatial compiler; it may not claim that the P1-TEC handoff is closed. Production changes that close TEC1-TEC4 remain subject to the one-forward-PR rule and the live sequential order above. Because TEC1-TEC4 touch scientific semantics and Rust/WASM/TypeScript authority boundaries, implementation is **high-risk** under `AGENTS.md`; pre-implementation invariants/falsifiers and a distinct post-implementation adversarial review are mandatory.


| Programme | Mission | Current checkpoint | Sequential position | Finite exit |
| --- | --- | --- | --- | --- |
| **A - Progressive Disclosure & Semantic Drill-down** | Make dataset-level structure the normal starting point while preserving exact observations as bounded drill-down. | A5 STOP / #606 | **VERIFIED COMPLETE / STOP** | Structure -> region/group -> bounded observations -> datum/provenance works through the production path without rematerialising the whole dataset. |
| **B - Source-Authoritative Structural Representations** | Add truthful graph/hierarchy/temporal/geospatial/spectral dataset structures without presentation-side inference. | Relationship Graph B4 STOP / #612 | **VERIFIED COMPLETE / STOP FOR FIRST SELECTED FAMILY** | Source-authoritative Relationship Graph V1 is verified complete; selecting another B family requires an explicit fresh-main choice. |
| **C - Visible Investigator Product Convergence** | Turn the landed substrate and semantic representations into the sparse, task-first Nemosyne experience. | C4 visible journeys / #616 | **IMPLEMENTATION LANDED / REVIEW ACTIVE** | Canonical journeys visibly converge on desktop and simulator-testable XR; physical-input/comfort fitness remains later device evidence. |
| **P1-TEC - Trustworthy Evidence Closure** | Close propagation, terminology, falsification and production handoff gaps in the existing evidence architecture before learned/compositional Moneta consumes it. | TEC0 landed / TEC1 receipt transport + live resolver pre-work implemented under RFC/ADR 0007; requirement-profile/replay/MCR closure remains open | **PLANNED / AFTER P1-WQ, BEFORE PT9** | Evidence axes needed for admissibility survive Rust/WASM -> Moneta/semantic representation with honest terminology, fail-closed loss handling, adversarial fixtures and replayable provenance. |
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
| UXR4 | **PARTIAL / GOVERNED 5M/30M/60M EXECUTION SEAM READY / EVIDENCE ACQUISITION OPEN** | QV4 adjudication/custody (#668/#669), the five-class envelope (#794), QV4 lane integration (#797), cohort finalization (#799), headset-loop plumbing and UXR0 telemetry are reusable. The governed Quest performance lane now binds the existing 5-minute, 30-minute and 60-minute profiles end-to-end without inventing resource PASS thresholds. Fresh interaction/responsiveness/render/resource/semantic-scale evidence and independent UXR4 adjudication remain open. |
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
- the dormant Memory Palace authoring controller remains offline until its placeholder provenance/random identity/incomplete lifecycle is separately made production-safe.

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

It also added governed investigator-authored question/hypothesis/conclusion/branch lineage over existing investigation/evidence authorities. Supported/refuted/inconclusive terminal reasoning requires existing analytical evidence rather than being inferred from geometry or visual appearance. The dormant `MemoryPalaceController` remains offline.

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
8. **PT9 Learned Moneta** follows WQ; broad access does not relax evidence admissibility, provenance, holdout or explicit-promotion requirements.

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

## One forward implementation PR

Default maximum:

```text
1 open forward implementation PR
```

Do not parallelize product-transition implementation. Documentation-only closure/fix-forward commits should normally remain on the owning active PR rather than creating overlapping work. A different execution model requires an explicit user decision.

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
