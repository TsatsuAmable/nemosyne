# RF-062 — World composition-root convergence

**Status:** PLANNED / REVIEW ACTIVE

**Severity:** High architecture/maintainability risk; not a current scientific-correctness blocker.

**Owning stream:** Stream B review/fix-forward, coordinated with P1-U/P1-USIM and completed before P1-W production wiring freezes live-service dependencies.

> **Identifier correction:** #515 originally published this programme as RF-061, but RF-061 was already the active version-coalesced derived-recomputation programme landed by #514. RF-062 is the canonical identifier for World composition-root convergence. Historical #515 commit/PR text remains historical evidence; all former RF-061A through RF-061I World tranches are now RF-062A through RF-062I.

## Why this RF exists

`src/vr/World.ts` remains the correct place to see and assemble the complete Nemosyne runtime, but it has accumulated too many additional roles: composition root, public compatibility facade, mutable-state hub, workflow orchestrator, presentation mediator and compatibility shim. Earlier god-object refactors already demonstrated the central risk: moving methods into classes is not architectural progress if those classes still depend on broad World-shaped hosts or recreate the same orchestration gravity.

The goal is **not** to make `World.ts` small for its own sake and not to replace one god class with several smaller god classes. The goal is to make `World.ts` architecturally boring: construct, wire, delegate, expose a compatibility facade where still required, and dispose.

## Governing rule

> **World may know everybody; nobody else may know World.**

`World` is Nemosyne's explicit composition root and compatibility facade. Production subsystems must not depend on `World`, `Partial<World>`, `{ world }`, a service locator that recreates World, or broad `*WorldHost` capability bags. Mutable state and workflow authority belong to the subsystem/use case that owns the invariant.

A healthy end state may still leave `World.ts` hundreds of lines long. Line count is telemetry, not the acceptance gate.

## Scope and non-goals

### In scope

- dependency direction and ownership around `World.ts`;
- one semantic intent seam shared by UI, controller, hands, keyboard/desktop and future automation;
- authoritative dataset/representation workflow extraction without introducing a second analytical authority;
- explicit ownership of rendered representation resources;
- event-reaction decomposition into small projection/binding functions;
- session restore/replay convergence on the same application pathways used by live interaction;
- narrow live-stream, collaboration and landmark ports;
- runtime/kernel ownership cleanup after higher-value seams are stable;
- dev/load-test instrumentation removal from the core runtime graph;
- migration of tests away from private World-state mutation;
- architecture-policy enforcement that prevents regression.

### Explicit non-goals

- no big-bang World rewrite;
- no line-count target as the primary success metric;
- no generic `WorldContext`, `WorldServices`, `ApplicationController`, `GameManager`, `SystemManager`, `ServiceContainer` or equivalent dependency bag;
- no proliferation of broad `*Coordinator` classes that simply move existing World methods and fields together;
- no full ECS migration; ECS may be evaluated locally for high-cardinality rendered entities only where measured value exists;
- no full event-sourced XR runtime; durable investigator actions may use explicit commands/provenance, but frame-loop/pointer/pose updates remain direct;
- no new TypeScript analytical fallback or weakening of Atlas/Rust/Moneta authority boundaries;
- no mass folder move before ownership has actually changed.

## Target dependency model

```text
World.ts
  composition root + compatibility facade
        |
        v
Application
  typed intents + use cases + narrow ports
        |
        v
Authorities
  AtlasCore | NemosyneSession | lifecycle | Moneta/Rust contracts
        |
      outcomes
        v
Presentation
  RepresentationSurface | overlays | panels | scene

Input/UI adapters produce semantic intents toward Application.
Presentation/telemetry/autosave react to outcomes through narrow projections/bindings.
Only bootstrap/World may depend across all layers.
```

### Dependency rules

- `World` may depend on application, presentation, input, authority and feature modules because it is the composition root.
- Application, presentation, input, session, live/collaboration and landmark modules must not import or receive `World`.
- Contracts live beside the consumer that needs them; do not replace World coupling with a giant shared coordinator-types contract hub.
- Resource creators own idempotent disposal of the resources they create.
- Analytical/data-derived scale authority remains Atlas/Rust/WASM; orchestration refactoring must not create a TypeScript analytical implementation.

## State ownership map

| State / responsibility | Owner |
| --- | --- |
| canonical dataset, history/version lineage, structures, recommendations, analytical provenance | `AtlasCore` / analytical domain |
| investigation/session semantic state | `NemosyneSession` |
| boot/kernel lifecycle generation and recovery | `WorldLifecycleOwner` plus a narrow analytical-runtime owner |
| current rendered Moneta representation and representation-specific Three.js resources | `RepresentationSurface` |
| panel visibility/layout/reference frame | UI/panel subsystem |
| input mode, capture, focus and gesture ownership | input subsystem |
| live-stream state | live subsystem |
| collaboration/presence state | collaboration subsystem |
| durable presentation snapshot for save/restore | presentation/session adapter |
| construction and dependency wiring | `World` |

## Tranche plan

Each tranche is a bounded PR with production-path evidence. Main must remain production-wired, behaviorally equivalent unless the tranche explicitly changes behavior, independently revertible, and compatible with the Rust/WASM analytical authority rule.

### RF-062A — architecture contract and fitness functions

**Intent:** prevent the refactor itself from recreating the same problem under different names.

- add an ADR/design contract declaring `World` the composition root and compatibility facade rather than application authority;
- extend the promoted P1-Q/Q0 architecture policy with RF-062 dependency rules;
- forbid new production imports of `World.ts` outside bootstrap/composition code;
- forbid constructors/functions that accept `World`, `Partial<World>`, `{ world }`, or broad World-shaped hosts;
- add narrow positive/negative architecture fixtures so the rule is falsifiable rather than a source-text popularity contest;
- retain file size/LOC only as non-blocking telemetry;
- document the allowed exception process for temporary compatibility adapters, with owner and retirement tranche.

**Exit gate:** CI rejects a newly introduced World back-reference or broad host bag while accepting a narrow capability interface; no runtime behavior change is required.

### RF-062B — typed semantic intent boundary

**Intent:** give all input modalities and UI surfaces one application-facing vocabulary before moving implementations.

Introduce a bounded application-intent vocabulary and small routing/handler boundary, for example:

```ts
{ type: 'dataset.load', entry }
{ type: 'analysis.apply', operation: 'filter' }
{ type: 'history.undo' }
{ type: 'history.redo' }
{ type: 'representation.acceptRecommendation' }
{ type: 'workspace.toggleLens', lens: 'statistical' }
{ type: 'investigation.markMoment' }
{ type: 'archive.freeze' }
```

Rules:

- UI maps controls to semantic intents, not directly to World methods;
- hands/controllers/keyboard/desktop map modality mechanics to the same semantic intents;
- initial handlers may delegate to existing World methods while callers migrate;
- command/intent means “please do this” and has one explicit handler/outcome;
- event means “this happened” and may have zero/many subscribers;
- do not turn EventBus into universal control flow or route high-frequency hover/frame/pose updates through the command layer.

**Exit gate:** at least one representative dataset, analysis, history and workspace action is invoked by UI and input through the same semantic intent path with no duplicate semantic dispatch.

### RF-062C — dataset/representation workflow boundary

**Intent:** remove the largest mixed-authority workflow from `World._doLoadDataset()` without creating a replacement god coordinator.

Create one application use case and one cohesive presentation resource owner.

#### `LoadDatasetUseCase`

Owns the logical transition:

```text
load request
 -> Atlas authoritative dataset/baseline
 -> authoritative evidence/profile
 -> Moneta arbitration or typed NIL
 -> bounded representation result/description
```

It must not own panels, Three.js meshes, dashboard rendering or a second analytical implementation.

#### `RepresentationSurface`

Owns resources born/replaced/disposed together:

- current `MonetaTopologyNode`/representation scene root;
- diagnostic/no-feasible-representation surface where applicable;
- representation-specific interactables and structure handles;
- selection continuity when semantic identity remains valid;
- atomic representation swap;
- idempotent disposal.

It receives narrow scene/input/interaction/tooltip/fact capabilities, never `World`. Dashboard, TDA, theme, status and autosave effects remain downstream projections/bindings.

**Exit gate:** production dataset load traverses `LoadDatasetUseCase` and `RepresentationSurface`; World no longer performs representation construction/swap/disposal itself; Atlas/Rust/Moneta remain the same authorities; load/reload/replacement/dispose behavior is covered through the production path.

### RF-062D — projection/binding decomposition

**Intent:** replace `_subscribeDataOperationEvents()` orchestration gravity with small reaction functions, not another manager.

Use independently installable/disposable functions with one coherent reaction, such as `bindOperationPresentation`, `bindTelemetryProjection`, `bindAutosaveProjection`, `bindNarrativeProjection`, `bindRecommendationProjection` and dev-only reporting bindings. Do not create an `OperationEventCoordinator`, `PresentationCoordinator` or generic event manager that simply collects the same dependency surface again.

**Exit gate:** cross-cutting operation reactions can be installed/disposed independently, semantically significant ordering is covered, and World no longer contains the broad event-reaction switchboard.

### RF-062E — session/presentation boundary

**Intent:** make save/restore/replay use ordinary application pathways rather than privileged World-internal mutation.

Replace broad `WorldSessionHost` access with narrow session dependencies and a presentation adapter such as:

```ts
interface PresentationSnapshotPort {
  capture(): PresentationSnapshot;
  restore(snapshot: PresentationSnapshot): Promise<void>;
}
```

Session code may depend on `NemosyneSession`, `SessionStore`, application use cases/intents and the snapshot port. Dataset restoration must go through the same `LoadDatasetUseCase` used by live interaction.

Governing invariant:

> live interaction, session restore and replay use the same authoritative application pathways for semantic state transitions.

**Exit gate:** session code no longer receives a World-shaped host; restore does not patch World/Atlas/UI private state directly; restore/replay semantic digest and identity remain invariant while presentation state may differ where governed.

### RF-062F — live, collaboration and landmark ports

**Intent:** remove remaining feature-to-World backreferences before P1-W freezes deployed service contracts.

- live streaming receives a narrow dataset/live-data sink plus status/events, not `World`;
- collaboration receives only presence/camera/interaction/UI capabilities actually needed and must not rebuild unrelated UI orchestration;
- TechnoCore, Vault, Farcasters and other landmarks emit ordinary semantic intents or use narrowly scoped binding functions;
- preserve Stream C security authority: authentication/replay/role enforcement may not migrate into presentation/application convenience code.

**Exit gate:** live/collaboration/landmark production modules contain no World back-reference or broad World-shaped host, and P1-W can wire deployed endpoints through narrow ports.

### RF-062G — analytical runtime ownership

**Intent:** move `_initWasmRuntime` orchestration only after intent and representation seams are stable.

- introduce a narrow analytical-runtime owner for Worker-port setup, runtime import/init, capability state, Atlas kernel binding/rebinding and generation-aware teardown;
- retain `WorldLifecycleOwner` as lifecycle-state-machine owner;
- preserve generation fencing, kernel-unavailable semantics and no-JS-fallback guarantees;
- do not combine runtime ownership with dataset/representation/session/UI orchestration.

**Exit gate:** World starts/stops analytical runtime through a narrow capability and repeated construct/start/dispose/recovery cycles preserve existing Worker/WASM evidence.

### RF-062H — dev/load-test feature isolation

**Intent:** stop optional diagnostics from inflating the core composition graph.

Move load-test/Quest instrumentation, diagnostic-only listeners and optional research tooling behind explicit dev/research installers. Prove production bundles cannot reach those installers and preserve dataset-safe evidence semantics from P1-Q/Q3.

**Exit gate:** core World composition does not own optional diagnostic workflows and production reachability checks prove dev-only dependencies are absent from the shipped path.

### RF-062I — compatibility/test cleanup

**Intent:** retire migration scaffolding only after production callers move.

- migrate full-system World tests from private-field mutation toward public intents/API plus observable behavior;
- inject runtime/kernel factories explicitly where deterministic failure/recovery is required rather than patching private runtime state;
- test individual use cases/resource owners with narrow fakes;
- retire World compatibility getters/proxies and legacy callback aliases only after production-call-graph evidence shows they are unused;
- collapse or relocate broad shared coordinator types once consumers own narrow local contracts.

**Exit gate:** World private-state mutation is no longer required for ordinary application behavior tests; compatibility aliases disappear only with production-path evidence; class existence alone is never treated as architectural completion.

## Sequencing and interaction with the roadmap

1. **Do not displace RF-029/RF-035/RF-051 measured resource work or RF-061 derived-settlement review.** RF-062 is architecture convergence, not a reason to pause current correctness/performance evidence.
2. **RF-062A is immediate and parallel-safe.** Extend the already promoted P1-Q/Q0 architecture machinery rather than creating another policy engine.
3. **RF-062B follows A and is also parallel-safe.** Callers can migrate to intents while handlers delegate to existing behavior.
4. **RF-062C/D/F coordinate with P1-U file ownership.** Keep each slice bounded and avoid mixing UI redesign with dependency refactoring unless inseparable.
5. **RF-062E lands before durable private-preview session/replay contracts freeze.** Reuse RF-046/RF-047 and USIM-A evidence rather than inventing another replay path.
6. **RF-062F lands before P1-W service wiring is stable**, so deployed services do not cement World backreferences.
7. **RF-062G follows C/E/F**, when the remaining runtime seam is clear.
8. **RF-062H/I are cleanup tranches** and must finish before RF-062 can be `VERIFIED COMPLETE`.

## Required architecture fitness functions

The programme must leave durable automated checks for:

- no production import of `World.ts` except approved bootstrap/composition paths;
- no constructor/function injection of `World`, `Partial<World>`, `{ world }` or broad World-shaped host contracts;
- no new JS analytical fallback or scale-sensitive analytical authority in presentation/application code;
- one declared owner for each mutable state domain;
- idempotent disposal for resource owners and repeated lifecycle coverage where applicable;
- session restore through application use cases/intents rather than private-state mutation;
- UI and input modalities invoking the same semantic intent for shared operations;
- an acyclic major-layer dependency graph;
- contracts/interfaces beside consumers instead of a generic coordinator-types hub;
- production-path tests proving the new boundary is actually used, not merely instantiated.

## Evidence ladder

A tranche is not complete because a class exists or a unit test can instantiate it. For every RF-062 tranche capture:

1. **Dependency evidence:** prohibited edges disappear and a negative fixture proves policy would catch their return.
2. **Production-path behavior evidence:** the real product action traverses the seam and produces the same governed observable outcome.
3. **Lifecycle evidence:** resources/listeners/workers/interactables created by the owner are released idempotently and repeated cycles do not accumulate stale state.
4. **Authority evidence:** Atlas/Rust/Moneta/session/security authority remains where the governing architecture says it belongs.
5. **Adversarial post-review:** inspect for a replacement god class, service locator, unused abstraction, duplicate path or tests proving existence rather than use.

USIM-A should be reused where it can falsify XR lifecycle, presentation-independent restore/replay and resource-balance regressions. Physical Quest remains authoritative for device performance/comfort and is not an RF-062 architecture-completion requirement unless a tranche changes device-dependent behavior.

## Progress metrics

Track directionally, not as arbitrary hard thresholds:

- production imports/backreferences to `World`;
- broad `*WorldHost`/World-shaped callback surfaces;
- mutable state domains directly owned/proxied by World;
- substantial feature workflows implemented in World;
- UI/input direct callbacks into World;
- resource owners without disposal ownership;
- compatibility aliases/private test hooks;
- World LOC/file size as context only.

A reduction in line count without improvement in the first seven metrics is not progress.

## Proposed source layout

Evolutionary guidance only, not a mass-move requirement:

```text
src/vr/
  World.ts
  bootstrap/
    installCoreBindings.ts
    installDevFeatures.ts
  application/
    intents/
      WorldIntent.ts
      IntentRouter.ts
    dataset/
      LoadDatasetUseCase.ts
    representation/
      ApplyRemediationUseCase.ts
    investigation/
      MarkMomentUseCase.ts
  presentation/
    representation/
      RepresentationSurface.ts
    bindings/
      bindOperationPresentation.ts
      bindAutosave.ts
      bindTelemetry.ts
  features/
    live/
    collaboration/
    devtools/
```

Let structure emerge as ownership moves; do not reorganize directories merely to resemble the diagram.

## Programme exit gate

RF-062 becomes `VERIFIED COMPLETE` only when:

- `World.ts` remains the explicit runtime composition root and public compatibility facade but no longer acts as authoritative owner of analytical, session, input, networking or representation state;
- feature subsystems do not depend on World or World-shaped dependency bags;
- UI/input modalities converge on typed semantic intents for shared operations;
- durable live/restore/replay workflows use the same authoritative application paths;
- representation/resource lifecycle ownership is explicit and idempotent;
- architecture-policy checks prevent dependency regression;
- production-path tests prove every migrated seam is used;
- independent adversarial review finds no replacement god class or off-path architecture theatre;
- P1-W can wire deployed live/collaboration services through the resulting narrow ports.

**Success criterion:** not `World.ts: 2,600 lines -> several 300-line managers`, but World becoming the blueprint that assembles Nemosyne rather than the machine that performs every workflow.
