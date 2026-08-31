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
