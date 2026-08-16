# Nemosyne — Architecture for the Concept Paper's Full Scope

**Status:** Target architecture and reconciliation proposal. It is subordinate to
`docs/PRODUCT_ARCHITECTURE_AND_GOVERNANCE.md` for direction and `docs/ROADMAP.md` for
implementation status. Atlas Core is part of the Stable Alpha target but is not current capability
until the roadmap records its implementation; richer Atlas guidance and full Memory Palace replay
remain later expansion work.

**Grounding:** this document reconciles the concept paper's five-layer vision (Rust
Analytical Kernel → Atlas → Draco → Memory Palace, wrapped by Perception/ML and a
Research Harness) against the actual repository (`TsatsuAmable/nemosyne`, `main` at
`a56ffb6`, 2026-08-16). Every claim below about what exists, what's wired, and what's
scaffolded-but-dead was checked directly against source in this session, building on
extensive prior review of this codebase (build/test verification, security findings,
UX findings, and the Stable Release roadmap work already produced for this project).
Nothing here is taken from the concept paper's own framing on trust.

**Headline finding, before the detail:** the concept paper's five layers are not five
equally-distant targets. Two of them (Rust Kernel, Draco) are refinements of something
substantial and real. One (Research Harness) is the most mature part of the whole
vision, because it's already been the subject of dedicated roadmap work. Two (Atlas,
Perception/ML) are the real gaps — and Perception/ML specifically is not an empty gap so
much as a *second, disconnected implementation* already sitting in the repository,
unwired, in exactly the pattern this project has repeatedly produced elsewhere.

---

## 1. Full System Architecture

```
                                    ┌─────────────────────────┐
                                    │   RESEARCH HARNESS       │
                                    │  (wraps the whole system) │
                                    │  trial/condition model,   │
                                    │  observer role, consent,   │
                                    │  frozen experiment package │
                                    └────────────┬────────────┘
                                                 │ instruments, does not
                                                 │ own analytical state
   ┌─────────────────────────────────────────────┴─────────────────────────────────────┐
   │                                                                                     │
   │   ┌───────────────┐      ┌───────────────┐      ┌───────────────┐      ┌────────┐  │
   │   │ RUST ANALYTICAL│ ---> │     ATLAS     │ ---> │     DRACO     │ ---> │ MEMORY │  │
   │   │    KERNEL      │      │  "what matters,│      │ "how should  │      │ PALACE │  │
   │   │ "what is true" │      │  what happened,│      │ the dataset  │      │"remember│  │
   │   │                │      │      why"      │      │ inhabit      │      │ & replay│  │
   │   │  deterministic │      │  analytical     │      │  space"      │      │  the   │  │
   │   │  computation,  │      │  state, evidence,│     │  whole-dataset│     │analysis"│  │
   │   │  method/version │      │  provenance     │      │ representation│    │        │  │
   │   │  provenance     │      │                 │      │  selection    │    │        │  │
   │   └───────────────┘      └───────────────┘      └───────┬───────┘      └────┬───┘  │
   │                                                          │                    │      │
   │                                                          ▼                    │      │
   │                                                  ┌───────────────┐            │      │
   │                                                  │   RENDERING   │            │      │
   │                                                  │   PRIMITIVES  │            │      │
   │                                                  │ Crystal/Plinth/│           │      │
   │                                                  │ Orb/Beam/Column│           │      │
   │                                                  │ (implementation│           │      │
   │                                                  │  detail, not  │            │      │
   │                                                  │  the representation itself)│      │
   │                                                  └───────────────┘            │      │
   │                                                                                │      │
   └────────────────────────────────────────────────────────────────────────────────┘      │
                                        ▲                                                    │
                                        │                                                    │
                              ┌─────────┴─────────┐                                          │
                              │   PERCEPTION/ML    │◄─────────────────────────────────────────┘
                              │  hand/gaze/gesture  │   (Memory Palace preserves what
                              │  interpretation,    │    Perception/ML observed too)
                              │  metaphor selection  │
                              └─────────┬─────────┘
                                        │
                                        ▼
                                   ┌─────────┐
                                   │  HUMAN  │
                                   │ (analyst,│
                                   │ always in│
                                   │ control) │
                                   └─────────┘
```

**Architectural constraints this diagram encodes** (stated as hard rules, per the
concept paper, and checked against whether the current code already honors them):

- **Atlas must not depend on Three.js.** Trivially true today, because Atlas doesn't
  exist yet as a distinct module — there's nothing to violate the rule. The risk is in
  the *build-out*, not the current state.
- **Draco must not own the semantics of raw data.** Partially honored. `ConstraintEngine`
  consumes a `DracoFacts` object (dataset statistics/topology) rather than raw rows —
  that separation already exists structurally.
- **Rendering primitives must not define analytical meaning.** Verified true today:
  `ConstraintEngine.ts` selects an intermediate `spec` (`geometry`, `interaction`,
  `behavior` fields) *before* any artifact class is touched — Crystal/Plinth/Orb are
  downstream consumers of that spec, not decision-makers. This is the strongest-already-
  honored constraint in the list.
- **Perception models must not directly mutate authoritative analytical state.** Cannot
  be violated today because Perception/ML isn't wired to anything — but this needs to be
  a designed-in constraint at integration time, not an accident of current disconnection.
- **Research instrumentation must wrap the product, not contaminate its analytical
  model.** Directly matches the Gate 2.5 (Research Observation) design already built for
  this project: the observer role has code-enforced, narrower permissions than a
  participant, verified via `Room.canMutateSharedState()` checks on both the sending and
  receiving side of the network layer.

---

## 2. Subsystem Architecture: Rust Analytical Kernel

```
                    ┌──────────────────────────────────────┐
                    │           RUST/WASM KERNEL             │
                    │                                        │
  raw dataset  ---> │  data/parsers.rs  ──►  data/dataset.rs │
                    │        │                     │          │
                    │        ▼                     ▼          │
                    │  data/column.rs      data/topology.rs   │
                    │  data/value.rs      data/synthetic.rs   │
                    │        │                     │          │
                    │        └──────────┬──────────┘          │
                    │                   ▼                      │
                    │           data/operations.rs             │
                    │      (filter/aggregate/sort/compare)     │
                    │                   │                      │
                    │        ┌──────────┴──────────┐           │
                    │        ▼                     ▼           │
                    │  layouts/grid.rs      layouts/force_directed.rs
                    │  layouts/radial_tree.rs                   │
                    │                   │                       │
                    │                   ▼                       │
                    │           command_buffer.rs                │
                    │        (DORMANT — capability-gated,        │
                    │         disabled pending real-headset       │
                    │         load-test data)                    │
                    └──────────────────────────────────────┘
                                   │
                                   ▼ operations_bridge.rs
                         (JS/WASM boundary, typed)
```

**What's real (verified this session):** 3,522 lines of Rust across data parsing,
typed columns/values, topology detection, synthetic dataset generation, real operations
(the `compare()` function added recently — group-A/B means, difference, counts — is
here), and three real layout algorithms. This is a genuine analytical kernel, not a
stub — the concept paper's "Rust Analytical Kernel" framing describes something that
substantially exists, just not yet under that name or with the provenance-recording
contract the concept paper specifies.

**What's missing relative to the concept paper's stated contract**
("method, parameters, version, inputs, results, provenance" per operation, "allowing
an analytical result to be reconstructed rather than merely observed"): none of the
current Rust operations record their own version or a structured provenance trail.
`data/operations.rs` computes a result; it doesn't emit *why* that result is what it is
in a form Atlas could consume. This is the real, specific engineering gap — not "build
more Rust," but "make every kernel operation self-describing."

**Confirmed still-dormant:** `command_buffer.rs` — capability-gated, explicitly disabled
pending real-headset load-test data, consistent with every prior check of this project.
The recent WASM recursion fix (replacing recursive tree traversal with an explicit
heap-allocated stack in `leaves()`) landed in this kernel and is verified working.

---

## 3. Subsystem Architecture: Atlas (proposed — does not exist today)

```
                         ┌───────────────────────────────────┐
                         │              ATLAS                 │
                         │                                     │
  Rust kernel results -->│  ┌─────────────────────────────┐   │
                         │  │   Analytical State Store      │   │
                         │  │  (what operations ran, in     │   │
                         │  │   what order, on what data)   │   │
                         │  └──────────────┬───────────────┘   │
                         │                 │                     │
                         │  ┌──────────────▼───────────────┐   │
                         │  │   Evidence & Finding Ledger    │   │
                         │  │  (what was inspected, what     │   │
                         │  │   was flagged as significant,  │   │
                         │  │   with the method that found it)│  │
                         │  └──────────────┬───────────────┘   │
                         │                 │                     │
                         │  ┌──────────────▼───────────────┐   │
                         │  │  Representation Requirements   │   │
                         │  │   Generator                    │   │
                         │  │  (translates analytical state  │   │
                         │  │   + task into what Draco needs │   │
                         │  │   to represent, not how)       │   │
                         │  └──────────────┬───────────────┘   │
                         └─────────────────┼─────────────────┘
                                           ▼
                                   to Draco (Section 4)
```

**What exists today that Atlas would absorb/supersede:**
- `AnalysisHistory` (`src/data/AnalysisHistory.ts`) — a real, working undo/redo stack:
  operation name, parameters, timestamp, dataset-before/after. This is genuinely useful
  but is *only* an undo/redo mechanism — it has no concept of "evidence," "finding,"
  or "why," and it doesn't feed representation decisions. It's the seed of Atlas's
  Analytical State Store, not Atlas itself.
- `ConstraintEngine.DracoFacts` (`src/draco/ConstraintEngine.ts`) — the dataset-
  statistics object Draco currently consumes directly. In the concept paper's model,
  this is exactly the kind of thing Atlas should own and hand *requirements* derived
  from, rather than Draco computing facts and constraints in the same module. This is
  the clearest, lowest-risk first move toward Atlas: extract fact-computation out of
  `ConstraintEngine` into a module Atlas can later absorb, without yet building the
  evidence ledger or requirements generator.
- `OperationLogPanel` (`src/vr/ui/OperationLogPanel.ts`) — a UI display of the operation
  log. Presentation layer only; not a data model.

**The concrete gap:** there is no single place today that answers "what has this
analysis established so far, and why does that matter for how the dataset should be
shown." That question currently has no owner — it's implicitly scattered across
`AnalysisHistory` (what happened), `ConstraintEngine`'s internal `facts` (dataset
statistics), and nothing at all for "what did the analyst find significant." Atlas, as
scoped in the concept paper, is a genuinely new subsystem, not a rename of something
that exists — this is the most honest single sentence to take away from this section.

---

## 4. Subsystem Architecture: Draco (redefinition, not a rebuild)

```
   Atlas requirements  (or, today: DracoFacts computed inline)
            │
            ▼
   ┌─────────────────────────────────────┐
   │         DRACO CONSTRAINT ENGINE       │
   │                                       │
   │  hard constraints (filter candidates) │
   │            │                          │
   │            ▼                          │
   │  soft constraints (score candidates,  │
   │   weighted, explainable)              │
   │            │                          │
   │            ▼                          │
   │      best DracoSpec                   │
   │   { geometry, interaction, behavior } │  <── ALREADY the seam the concept
   └────────────────┬──────────────────────┘      paper asks for — just not
                     │                             yet a named, richer type
                     ▼
   ┌─────────────────────────────────────┐
   │   PROPOSED: SpatialRepresentation      │  <── does not exist yet as a
   │   { topology, analyticalPurpose,      │      first-class type; DracoSpec
   │     semanticMappings, layout,         │      is its direct ancestor
   │     aggregation, detailLevels,        │
   │     interactionModel, navigationModel,│
   │     renderingStrategy }               │
   └────────────────┬──────────────────────┘
                     │
                     ▼
   ┌─────────────────────────────────────┐
   │      RENDERING PRIMITIVES              │
   │   Crystal / Plinth / Orb / Beam /     │
   │   Column / ChartPlane / TDA artifacts │
   │   (implementation detail — must not   │
   │    be treated as the representation)  │
   └─────────────────────────────────────┘
```

**This is the smallest-gap layer in the whole concept paper.** `ConstraintEngine.ts`
already does hard/soft constraint scoring and already produces an intermediate `spec`
object *before* any rendering primitive is touched — verified directly (`evaluateCandidate`
returns `{isValid, cost, softConstraintViolations}` against a `DracoSpec`, and rendering
classes consume the winning spec, they don't participate in selecting it). The concept
paper's core architectural correction — "Draco operates at dataset-representation level,
not datum-rendering level" — is **already true of the current code's control flow**. What's
missing is that `DracoSpec` is a narrower type (`geometry`/`interaction`/`behavior`) than
the richer `SpatialRepresentation` the concept paper specifies (`topology`,
`analyticalPurpose`, `semanticMappings`, `layout`, `aggregation`, `detailLevels`,
`interactionModel`, `navigationModel`, `renderingStrategy`). Expanding the type is real
work, but it's a type-widening exercise on an existing, working seam — not a new
architectural boundary that has to be invented and threaded through the codebase.

**A second, disconnected Draco already exists, and it's a red flag worth naming
directly.** `src/ai/DracoWorldModel.ts` and `src/ai/NeuralConstraintPredictor.ts`
describe an entirely different Draco design — a "Draco Evolutionary GA Solver" with
neural soft-constraint weight prediction and online gradient-descent learning from
analyst selections — with **zero call sites anywhere in `src/`**. This is not the same
system as the live, shipped `ConstraintEngine.ts` (a straightforward weighted-scoring
solver, not a genetic algorithm). It reads as an earlier or parallel design exploration
that was never reconciled with what actually shipped. Before any concept-paper-driven
Draco expansion work starts, this needs an explicit decision: delete it, or make clear
in code comments that it's a deferred v2 direction — not left ambiguous, which is exactly
the "is this shipping or not" problem this project has hit before with other dead-code
scaffolding.

---

## 5. Subsystem Architecture: Memory Palace

```
   ┌───────────────────────────────────────────────────┐
   │                  TODAY (verified)                    │
   │                                                      │
   │  WorldSessionController                              │
   │   - save() / auto-save (timestamped)                 │
   │   - load()                                            │
   │   - NO branch, NO replay, NO provenance link          │
   │                                                        │
   │  exportAnalysisStory()  (one-way export,               │
   │   wired into the wheel menu — a real, reachable        │
   │   feature, unlike much of the AI scaffolding above)    │
   └───────────────────────────────────────────────────┘

   ┌───────────────────────────────────────────────────┐
   │              PROPOSED (concept paper)                │
   │                                                      │
   │  MemoryPalace {                                      │
   │    datasetRef, transformChain (from Atlas),          │
   │    operationsPerformed (from AnalysisHistory),        │
   │    representationChosen (from Draco's SpatialRep),    │
   │    inspectionTrail, evidenceFound (from Atlas),        │
   │    conclusion, spatialLocation (where in the world     │
   │      the finding existed)                             │
   │  }                                                      │
   │        │           │            │            │          │
   │      resume      replay       branch        share        │
   └───────────────────────────────────────────────────┘
```

**Gap size: moderate, and mostly dependent on Atlas existing first.** `resume` already
works today (session save/load). `replay` and `branch` require the operation-by-operation
provenance trail that only exists partially (`AnalysisHistory`'s undo/redo frames) —
replay is plausible to build directly on top of that today; branch requires deciding
what "the same investigation, forked" means at the data-model level, which is genuinely
undesigned. `share` already partially exists via `exportAnalysisStory`, but that's a
one-way, terminal export — not a resumable/replayable artifact for a second person, which
is what the concept paper's "give someone else the analytical world and the reasoning
behind it" implies.

---

## 6. Subsystem Architecture: Perception/ML

```
   ┌───────────────────────────────────────────────────┐
   │           WHAT'S ACTUALLY LIVE TODAY                  │
   │                                                      │
   │  HandGestureRecognizer (rule-based, deterministic)   │
   │   - trajectory/velocity/curvature thresholds          │
   │   - dominantHandIndex tracking (real, tested,         │
   │     recently correctly wired to the wheel menu)       │
   │   - InputRouter / SelectionDispatcher                  │
   │     (recently fixed double-fire race — verified)      │
   └───────────────────────────────────────────────────┘

   ┌───────────────────────────────────────────────────┐
   │        WHAT EXISTS BUT IS ENTIRELY UNWIRED             │
   │              (src/ai/, 740 lines, 0 call sites)        │
   │                                                      │
   │  GestureClassifierModel                                │
   │   - ONNX Runtime Web bridge + heuristic fallback        │
   │   - biomechanical auto-calibration                      │
   │  GestureModelStore, GestureTrainingWorker                │
   │  NeuralConstraintPredictor  (feeds DracoWorldModel,      │
   │     not the live ConstraintEngine)                       │
   │  VoiceCommandListener                                     │
   └───────────────────────────────────────────────────┘
```

**This is the sharpest, most concrete finding in this whole review.** The concept
paper's Perception/ML layer is not a blank page — there are 740 lines of specifically-
targeted, well-commented code for exactly this layer (ONNX inference bridge, heuristic
fallback, biomechanical calibration, training pipeline, voice input) sitting in the
repository right now, and none of it is reachable from the running application. The
docstrings describe present-tense capability ("Seamlessly integrates an ONNX Runtime Web
bridge... for deep neural tensor evaluation") for a model file (`gesture_classifier.onnx`)
that doesn't exist anywhere in the repo. This is the same pattern this project has
produced repeatedly and then correctly closed once flagged (`AsymmetricDesktopCompanion`,
`PeerAvatarManager`, the network role model were all built-then-dead-then-wired in
exactly this shape across earlier reviews) — the risk isn't that this code is bad, it's
that Perception/ML is positioned in the concept paper as a headline pillar while its
actual implementation is currently indistinguishable from vaporware to anyone not reading
source directly.

---

## 7. Subsystem Architecture: Research Harness (most mature layer)

```
   ┌───────────────────────────────────────────────────┐
   │         ALREADY DESIGNED IN DEPTH (roadmap work)       │
   │                                                      │
   │  Gate 1: role model (participant/observer),           │
   │   code-enforced on both send and receive sides         │
   │   (verified: Room.canMutateSharedState(), applied to   │
   │    both broadcastDatasetOperation AND                  │
   │    broadcastStateDelta as of the most recent commits)  │
   │                                                        │
   │  Gate 2.5: observer console (Passive/Prompt/Assisted), │
   │   reclaiming AsymmetricDesktopCompanion/                │
   │   PeerAvatarManager from previously-dead code           │
   │                                                        │
   │  Gate 5: trial/condition/task data model, counter-      │
   │   balancing, canonical 2D control, confound register,  │
   │   data dictionary, consent — frozen experiment/         │
   │   package skeleton already drafted                      │
   └───────────────────────────────────────────────────┘
```

**Scope, as clarified: two conditions, not three.** The current study direction is a 2D-versus-VR
2x2 crossover, pending final freeze in `docs/study/`. The concept paper transcript's own
late-stage revision reads as if it drops comparative conditions entirely — but the actual
scope decision is narrower: this is a **2D vs. VR** project. The desktop-3D middle
condition is out, not the comparison itself. That resolves the tension this document
originally flagged as unsettled between the concept paper and the Stable Release
roadmap's three-condition design — the roadmap's Gate 5 work (counterbalancing, canonical
2D control, confound register) still applies in full, it just now runs across two arms
instead of three. This is a real simplification, not just a renaming:
- **Counterbalancing collapses from a 3×3 Latin square to a single 2×2 crossover**,
  meaningfully reducing the minimum participant count needed for balanced condition
  ordering.
- **The canonical 2D control's implementation burden is unchanged** — it still needs to
  be built to the same fidelity as before, since it's one of only two arms now rather
  than one of three, if anything raising its relative importance.
- **Desktop-3D-specific work is fully parked**, not partially retained "in case." Any
  code path whose only purpose was supporting a desktop-3D study condition (as opposed to
  desktop-3D as a general non-VR access mode, which is a separate, legitimate concern)
  should be treated the same as the rest of this document's Parked-scope items.

---

## 8. Consolidated Gap Table

| Layer | Concept-paper vision | Current code reality | Gap size |
|---|---|---|---|
| Rust Kernel | Deterministic, versioned, provenance-recording computation | 3,522 lines, real ops/layouts/parsers, but no per-operation version/provenance metadata | **Small** — extend existing ops, don't rebuild |
| Atlas | Analytical state + evidence ledger + representation requirements | Doesn't exist. Nearest analogs (`AnalysisHistory`, `ConstraintEngine.facts`, `OperationLogPanel`) are fragments, not a system | **Large** — genuinely new subsystem |
| Draco | Whole-dataset `SpatialRepresentation` selection, decoupled from rendering | Already produces an intermediate `spec` object before touching rendering primitives — the core architectural seam already exists | **Small-medium** — widen the type, don't re-architect the flow |
| Memory Palace | Resume/replay/branch/share/explain a full analytical investigation | Resume works (session save/load). Share partially works (one-way export). Replay/branch don't exist | **Medium** — depends on Atlas's provenance trail existing first |
| Perception/ML | On-device ML interpreting gesture/intent, informing interaction metaphor | 740 lines of real scaffolding (ONNX bridge, calibration, training pipeline), zero call sites, no model file present | **Large in integration risk, small in code-already-written** |
| Research Harness | Wraps the system for controlled, reproducible studies | The most developed layer of all five — role model, observer console, trial/condition data model, frozen experiment package all designed and partially built | **Small-medium**, and the least risky layer in this whole document |

---

## 9. Risks and Challenges

**Scope risk: five ambitious layers, one small team, a demonstrated pattern of
build-then-strand.** This project's own history — verified across many review cycles —
shows a consistent pattern: substantial, well-written subsystems get built ahead of
integration, then sit dead for extended periods before being wired (sometimes correctly
and quickly once flagged, as with the network role model; sometimes not yet, as with the
entire `src/ai/` directory). Atlas and Perception/ML are exactly the kind of large,
self-contained subsystems this pattern tends to produce. The specific risk isn't "will
these get built" — the team has repeatedly shown it can build real things fast — it's
"will they get *connected*" before the concept paper's five-layer story is being told
publicly as current capability rather than aspiration.

**Naming/positioning risk: "Draco" now means two different things in two different
documents.** The live, shipped code's `ConstraintEngine` is a weighted hard/soft
constraint solver. The concept paper (and `DracoWorldModel`/`NeuralConstraintPredictor`)
describe a genetic-algorithm-based, neural-tuned solver under the same name. If the
concept paper's "Draco Spatial Embodiment Engine" language ships publicly before this is
reconciled, there's a real risk of the public description matching neither the actual
shipped solver nor the dead-code GA variant — describing a third thing that exists in
neither place.

**Sequencing risk: Memory Palace's real capabilities (replay, branch) are gated behind
Atlas existing, but the concept paper doesn't say so explicitly.** Building `replay` UI
before there's a real provenance trail to replay would produce a feature that looks
complete but is hollow — exactly the "last-mile wiring gap" pattern this project has hit
before (the colorblind palette existing in `Encodings.ts` but not reaching
`ChartPlanePanel` for a full commit cycle is the closest recent precedent). Atlas needs
to land, even partially, before Memory Palace's more ambitious verbs are attempted.

**Scope risk resolved:** the active roadmap and study package now use the 2D-versus-VR direction.
The former three-condition discussion is historical context only; archived drafts must not guide
implementation or study collection.

**Evidence risk, inherited from every prior review of this project: still no real-VR-
hardware validation data exists**, though the most recent commits show genuine progress
here (a real on-device Quest session found and fixed a `UXTraceRecorder` crash, and
produced a real, quantified usability finding — a "hair-trigger" system gesture, now
fixed with a measured 400ms dwell + 1000ms cooldown). This is worth stating positively:
this specific risk, flagged as the single largest gap across many prior reviews, is
finally starting to close with real data rather than remaining a standing gap.

**Complexity risk: the full five-layer system, fully realized, is a lot of moving
parts for a research instrument whose current job is answering one question.** The
concept paper's own "What Nemosyne Is Not" section is a good discipline against this —
explicitly not a BI replacement, not a validated recommender, not an autonomous analyst.
The architecture proposed in this document should be read the same way: build Atlas and
harden the Draco type *because the Research Harness needs a real analytical-state trail
to produce defensible study data*, not because a five-layer architecture is intrinsically
worth having. If the research harness can answer its core question with a thinner Atlas
(say, extending `AnalysisHistory` rather than building the full evidence-ledger vision),
that's the right call — the concept paper's ambition should serve the research question,
not the other way around.

---

## 10. Build Sequence: Phased, Modular, Incremental

The prior version of this section was an ordered list — sequenced, but not actually
phased (no entry/exit criteria) or explicitly modular (module contracts were implied by
section boundaries, never stated). This version fixes both, and folds in the sequencing
implications from the Draco-evolutionary-search discussion, which surfaced a dependency
this document hadn't stated: **Atlas's constraint-arbiter role has to be solid before any
form of search — evolutionary or otherwise — is allowed to run inside Draco**, because an
optimizer is specifically good at finding the one untested gap in an incomplete
constraint set. That's now a phase gate below, not a footnote.

### Module contracts (what "modular" means here, concretely)

Each module in the phases below has a stated **input**, **output**, and **what it must
never depend on** — the actual test for whether a boundary is real rather than aspirational.

| Module | Consumes | Produces | Must never depend on |
|---|---|---|---|
| Rust Kernel | raw dataset | typed `Dataset`, operation results + provenance metadata | Atlas, Draco, rendering |
| Atlas (constraint layer) | Rust Kernel output | pass/fail + violation list against hard invariants | Three.js, any rendering primitive |
| Atlas (state/evidence layer) | operation history, user actions | analytical state, evidence ledger, representation *requirements* | Draco's internal solver logic |
| Draco (selection) | Atlas requirements + Atlas constraint gate | `SpatialRepresentation` (hierarchical: world-type → strategy → parameters) | raw dataset, rendering primitive classes |
| Draco (search, later phase) | Draco's own candidate space | ranked/Pareto candidate set | Atlas's evidence ledger (reads fitness signal, never writes analytical state) |
| Rendering primitives | one `SpatialRepresentation` | scene objects | Atlas, Draco's selection logic |
| Memory Palace | Atlas's evidence ledger + operation history | resumable/replayable/branchable record | live Draco solver state (records the *output*, not a live reference) |
| Research Harness | trial/condition config | outcome records, joined via `trialId` | none of the above — wraps, per the existing architectural constraint |
| Perception/ML | raw sensor input | inferred gesture/intent | authoritative analytical state (proposes, never mutates directly) |

If a future PR makes any module read something not listed in its "Consumes" column, that's
the signal the boundary has leaked — this table is the thing to check against, not a
retrospective judgment call.

### Phase 0 — Foundations (no new subsystems, de-risking only)

**Entry:** none — startable immediately.
**Work:** refactor `World.ts` into a composition root with typed logical-session, Atlas Core,
research-ledger, input-command, and renderer lifecycle boundaries; extract `ConstraintEngine`'s
fact-computation into its own module (Atlas's
future constraint-input, built from code that already exists); decide the fate of
`src/ai/` (archive `DracoWorldModel`/`NeuralConstraintPredictor` explicitly rather than
leave them ambiguous — per the GA discussion, that code's `audioProximity`-weighted
fitness function is a concrete example of the unconstrained-genome trap, worth keeping
as a documented cautionary reference rather than silently deleting); edit the Stable
Release roadmap's Gate 5 text from three conditions to the settled 2D-vs-VR scope.
**Exit criterion:** no module built in later phases depends on anything this phase
touches remaining unresolved — this phase is entirely about removing ambiguity, not
adding capability.

### Phase 1 — Draco's representation type, built hierarchical from day one

**Entry:** Phase 0 complete (specifically: `src/ai/`'s fate decided, so this doesn't
become a fourth Draco design).
**Work:** widen `DracoSpec` toward `SpatialRepresentation` — but per the GA discussion's
hierarchical-optimization design (world-type → spatial-strategy → parameters), build it
as a genuinely tiered type now, even though evolutionary search over it isn't happening
yet. Getting the shape right here is cheap; retrofitting hierarchy after Phase 3 ships
flat `DracoSpec`-shaped candidates everywhere would not be.
**Exit criterion:** `DracoDiagnosticHUD` can explain a selection in terms of the new
tiered structure (world-type chosen, then strategy, then parameters) — if it can't, the
type isn't actually hierarchical yet, just relabeled.

### Phase 2 — Minimal Atlas, split into its two module-contract halves

**Entry:** Phase 1 complete (Atlas's requirements output needs somewhere typed to land).
**Work:** build Atlas's **constraint-arbiter half first, on its own** — hard-invariant
checking, semantic/accessibility/safety rules Draco must never violate — before building
the evidence-ledger/provenance half. This ordering is the direct consequence of the GA
discussion's hard rule ("evolution must never silently optimize against the research
subject") — the arbiter is the thing that makes search safe later, so it can't be an
afterthought bolted on once search exists. The evidence-ledger half (what's been
inspected, what's been flagged significant) follows once the arbiter is solid, sized to
exactly what Gate 5's outcome schema needs — not the full concept-paper vision.
**Exit criterion:** a deliberately-constructed adversarial test — a candidate
representation engineered to violate a stated hard invariant — is provably rejected by
the arbiter before any evidence-ledger work starts. No search-related work in Phase 3+ is
permitted to begin before this passes.

### Phase 3 — Draco rule/constraint selection only (current architecture, formalized)

**Entry:** Phase 2's constraint-arbiter exit criterion met.
**Work:** this phase is largely already-shipped — `ConstraintEngine`'s hard/soft scoring
— formalized to consume Atlas's requirements output via the module contract table above,
rather than computing facts inline as it does today.
**Exit criterion:** `ConstraintEngine` no longer computes its own facts; it reads them
from Atlas. This is the last phase before any research-instrument work is unblocked.

### Phase 4 — Research Harness build-out (can start in parallel with Phase 3)

**Entry:** Phase 0's scope and claim cleanup (this phase must build against the canonical
2D-versus-VR study direction).
**Note on modularity:** per the module contract table, the Research Harness wraps
everything else and depends on none of it structurally — it can be built in parallel
with Phases 1–3, not strictly after them, as long as it's developed against the
*intended* Atlas/Draco contracts rather than today's un-refactored code. This is the
one phase in this sequence that isn't purely linear.
**Exit criterion:** unchanged from the existing Gate 5 design — a synthetic multi-
participant run produces correctly-joined telemetry/outcome/observer data.

### Phase 5 — Memory Palace's replay/branch verbs

**Entry:** Phase 2's evidence-ledger half exists (replay needs a real trail to replay).
**Exit criterion:** a replayed session reconstructs the same `SpatialRepresentation`
sequence Atlas's ledger recorded, not an approximation — this is the concrete test that
distinguishes a real replay feature from the hollow-feature pattern this project has
hit before.

### Phase 6 — Draco-E: evolutionary/Pareto search (explicitly not sooner)

**Entry, hard gate:** Phase 2's constraint-arbiter exit criterion, re-verified against
whatever the candidate-generation logic looks like by this point (the original
adversarial test needs to be re-run, not assumed still valid) — plus Phase 4's Research
Harness producing real outcome data, since the multi-objective fitness function this
phase needs (analytical relevance, semantic clarity, perceptual effectiveness,
interaction cost) is meant to be informed by that data, not invented from first
principles. Per the GA discussion's own verdict: **design the `SpatialRepresentation`
type to make this addable later (Phase 1 already does this); do not start writing
search/mutation/crossover code until this gate is met.**
**Work, when the gate is met:** candidate generation constrained to analytical
representation variables only (explicitly excluding aesthetics per the GA discussion's
"do not evolve everything" rule), evaluated as a Pareto frontier rather than a collapsed
single score, with Draco remaining the stable abstraction and evolutionary search as one
swappable implementation strategy inside it — not a rename of Draco itself.
**Exit criterion:** N/A for the Stable release scope — this phase is explicitly beyond
it, tracked here so the type design in Phase 1 doesn't foreclose it, not because it's
scheduled.
