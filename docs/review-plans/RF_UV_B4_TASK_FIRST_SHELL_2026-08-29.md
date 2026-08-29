# P1-UV1 B4 — Task-first investigator shell

**Date:** 2026-08-29  
**Stream:** B — Product UX & Quest Validation Operations  
**Checkpoint:** B4 — P1-UV1 task-first investigator shell  
**Base:** `main@00bd528e0cf3b2367cd316693f0adf73b622a803`  
**Status:** IMPLEMENTATION LANDED / REVIEW ACTIVE

## Purpose

Convert the normal product entry path from a constellation of engineering/status surfaces into a bounded investigator-oriented shell, while retaining the existing semantic-intent boundary and an explicit diagnostics route.

This checkpoint intentionally does not implement B5 contextual locus-of-work behavior, P1-UV3 epistemic-object convergence, new analytical operations, Moneta mathematics, or Quest qualification.

## Pre-implementation adversarial contract

### Invariant

On a normal analyst boot, the user can identify the active dataset/workspace and a bounded set of useful investigator actions without reading telemetry, solver diagnostics, subsystem names, a dashboard wall, or an always-open raw file-loader panel. Existing actions must continue to dispatch through governed application intents rather than acquiring UI-owned analytical authority.

### Authority / production path

The production entry path is:

`bootstrapApp -> World.start -> application intent binding -> normal analyst composition policy -> AnalystJourneyControls`

`src/app/bootstrap.ts` owns composition policy. `ApplicationIntent.ts` remains the action vocabulary/dispatcher. Existing `World`/Atlas/Moneta owners remain responsible for dataset, analytical and representation behavior. `MonetaDiagnosticHUD` owns its safe visibility default and recognizes the existing explicit `VITE_NEMOSYNE_DIAGNOSTICS=1` build route.

### Primary failure modes

1. **Decorative shell only:** new labels exist but raw loader/telemetry/diagnostics still dominate boot.
2. **Dataset-switch regression:** a newly created Moneta diagnostic becomes visible again after the first dataset switch.
3. **Second analytical authority:** the shell computes anomaly/representation results itself instead of dispatching existing intents/queries.
4. **Capability loss:** moving controls behind progressive disclosure breaks export/replay or the B3 canonical evidence journey.
5. **Developer-route destruction:** diagnostics are merely hidden with no real way to restore them after representation replacement.
6. **Replacement god object:** B4 introduces another shell/controller/service bag instead of composing the landed seams.
7. **Evidence laundering:** DOM existence is treated as sufficient proof of visible product convergence.

### Falsifying evidence

- source/policy test pins exactly three primary task actions and the normal-mode demotion policy;
- runtime diagnostic test proves ordinary construction is hidden while `VITE_NEMOSYNE_DIAGNOSTICS=1` construction remains visible;
- production Playwright smoke asserts the task-first shell is visible while raw loader, boot overlay and DOM telemetry are hidden;
- product smoke summons the dataset chooser on demand and proves the semantic dataset journey remains live;
- B3 UV0 evidence explicitly opens advanced tools before the NIL/budget step rather than forcing those controls back into normal startup;
- stable B3 NIL/status markers remain present inside the revised copy.

### Non-goals / dependencies

- no `World.ts` refactor or replacement coordinator;
- no changes to Rust/WASM, Atlas, Moneta decision mathematics, semantic payloads or renderer authority;
- no B5 object-attached contextual action redesign;
- no TechnoCore/Vault/portal/Memory-Palace product convergence;
- no physical Quest/comfort/performance claim;
- no canonical `docs/ROADMAP.md` edit inside the checkpoint PR.

## Implementation

### Desktop shell

`AnalystJourneyControls` is retained as the desktop counterpart but its hierarchy is inverted:

- active dataset/workspace context appears first;
- the primary visible choice set is bounded to **Explore another dataset**, **Find anomalies**, and **Record observation**;
- dataset import is summoned with **Choose data…** rather than remaining permanently open;
- export remains directly reachable because it is a core investigation lifecycle action;
- explanation/budget, undo, statistical lens and package replay/import live under collapsed **Investigation tools**;
- existing semantic intent IDs and B3 evidence markers remain stable where they are part of product-path evidence.

### Normal analyst composition

`bootstrap.ts` applies normal-mode policy after `World.start()`:

- InputTelemetry and VRConsole are hidden;
- the dashboard wall is hidden;
- peer presence is opt-in rather than boot chrome;
- the current Moneta diagnostic is hidden;
- DOM telemetry remains updated for diagnostics/tests but is hidden unless `VITE_NEMOSYNE_DIAGNOSTICS=1`;
- the static boot overlay yields after boot;
- FileLoader is hidden until explicitly summoned.

`MonetaDiagnosticHUD` also fails safe on every construction: it hides itself unless the deliberately instrumented diagnostics build sets `VITE_NEMOSYNE_DIAGNOSTICS=1`. This prevents dataset-switch resurrection while preserving a real replacement-safe developer/debug route.

## Post-implementation adversarial review

### Production path attacked

Re-read `bootstrapApp`, `AnalystJourneyControls`, representation replacement, `MonetaDiagnosticHUD`, and the B3/B4 browser journeys. The shell uses the existing dispatcher for dataset cycling and anomaly analysis; it does not call Atlas/Moneta analytical code directly. FileLoader retains its existing Rust/Atlas parse path and is only visibility-gated.

### Findings and fix-forward

1. **Progressive-disclosure compatibility — FIXED.** The first B4 shape collapsed the representation-budget field, while B3 UV0 automation still attempted to fill it directly. The evidence journey now explicitly opens `Investigation tools` before the NIL step. The product hierarchy remains task-first; evidence automation adapts to the product rather than forcing advanced controls visible.
2. **Stable evidence wording — FIXED.** Friendlier NIL copy initially removed the hardened B3 text markers. `NIL: no feasible representation` and `NIL outcome recorded` are now retained within the revised user-facing copy.
3. **Developer-route destruction — FIXED.** A simple constructor-level `hide()` prevented normal-mode resurrection but would also hide freshly replaced diagnostics after an explicit developer selection. The constructor now hides only when `VITE_NEMOSYNE_DIAGNOSTICS !== '1'`; focused runtime tests prove both ordinary-hidden and explicit-diagnostics-visible construction. No `World.ts` hot-file change was required.
4. **Second authority — NOT FOUND.** No analytical calculation was added to the shell; actions still dispatch `dataset.cycle` / `analysis.apply` and assessment reads existing authoritative state.
5. **Replacement god object — NOT FOUND.** The change is composition policy plus reshaping the existing desktop shell.

### Remaining review target

Hiding the dashboard `wallGroup` is not by itself proof that independently snapped chart-plane meshes are hidden. Existing `_doLoadDataset()` reapplies statistical-lens visibility after dashboard rebuild, with the lens initially disabled. Exact-head browser evidence must still falsify a visible chart-plane leak rather than promoting that source inference to runtime truth.

### Verification boundary

The local execution container could not resolve `github.com`, so no local test run is claimed. Exact-head GitHub CI is the executable verification authority. Any green result from an earlier branch head is treated as stale after a fix-forward commit.

### Test falsifiability

The new tests fail if primary actions expand, raw boot surfaces become visible again, the loader ceases to be on-demand, diagnostic replacement becomes visible in ordinary builds, or the explicit diagnostics build becomes hidden. B3/B4 browser journeys fail if progressive disclosure or stable evidence markers regress.

### Disposition

The two material review findings discovered during implementation review were fixed forward. No known BLOCKER remains in the reviewed source path. Exact-head typecheck, focused tests, production smoke, CodeQL, approval and promotion gates remain required before B4 can be promoted beyond `IMPLEMENTATION LANDED / REVIEW ACTIVE`.

## Completion boundary

B4 may be considered verified only when exact-head evidence demonstrates the real product boot is materially task-first and existing journey behavior remains intact. B5 remains separate: it must move common actions to the selected object/context rather than expanding this shell into a global action catalogue.
