# P1-UV1 B4 — Task-first investigator shell

**Date:** 2026-08-29  
**Stream:** B — Product UX & Quest Validation Operations  
**Checkpoint:** B4 — P1-UV1 task-first investigator shell  
**Base:** `main@00bd528e0cf3b2367cd316693f0adf73b622a803`  
**Status:** IMPLEMENTATION LANDED / REVIEW ACTIVE

## Purpose

Convert the normal product entry path from a constellation of engineering/status surfaces into a bounded investigator-oriented shell, while retaining the existing semantic-intent boundary and explicit developer diagnostics.

This checkpoint intentionally does not implement B5 contextual locus-of-work behavior, P1-UV3 epistemic-object convergence, new analytical operations, Moneta mathematics, or Quest qualification.

## Pre-implementation adversarial contract

### Invariant

On a normal analyst boot, the user can identify the active dataset/workspace and a bounded set of useful investigator actions without reading telemetry, solver diagnostics, subsystem names, a dashboard wall, or an always-open raw file-loader panel. Existing actions must continue to dispatch through governed application intents rather than acquiring UI-owned analytical authority.

### Authority / production path

The production entry path is:

`bootstrapApp -> World.start -> application intent binding -> normal analyst composition policy -> AnalystJourneyControls`

`src/app/bootstrap.ts` owns composition policy. `ApplicationIntent.ts` remains the action vocabulary/dispatcher. Existing `World`/Atlas/Moneta owners remain responsible for dataset, analytical and representation behavior. `MonetaDiagnosticHUD` remains an explicit diagnostic surface but now starts hidden whenever a new representation creates it.

### Primary failure modes

1. **Decorative shell only:** new labels exist but raw loader/telemetry/diagnostics still dominate boot.
2. **Dataset-switch regression:** a newly created Moneta diagnostic becomes visible again after the first dataset switch.
3. **Second analytical authority:** the shell computes anomaly/representation results itself instead of dispatching existing intents/queries.
4. **Capability loss:** moving controls behind progressive disclosure breaks export/replay or the current production smoke journey.
5. **Developer-route destruction:** diagnostics are deleted rather than demoted, removing legitimate research/debug access.
6. **Replacement god object:** B4 introduces another shell/controller/service bag instead of composing the landed seams.
7. **Evidence laundering:** DOM existence is treated as sufficient proof of visible product convergence.

### Falsifying evidence

- fast source/policy test pins exactly three primary task actions and the normal-mode demotion policy;
- production Playwright smoke asserts the task-first shell is visible while raw loader, boot overlay and DOM telemetry are hidden;
- product smoke summons the dataset chooser on demand and proves the semantic dataset journey remains live;
- existing UI/UX smoke IDs/status contracts are preserved for load, analyse, record, export and replay;
- Moneta diagnostic construction is mechanically checked to end hidden, preventing dataset-switch resurrection.

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
- existing semantic intent IDs and journey IDs remain stable where they are already part of product-path evidence.

### Normal analyst composition

`bootstrap.ts` applies normal-mode policy after `World.start()`:

- InputTelemetry and VRConsole are hidden;
- the dashboard wall is hidden;
- peer presence is opt-in rather than boot chrome;
- the current Moneta diagnostic is hidden;
- DOM telemetry remains updated for diagnostics/tests but is hidden unless `VITE_NEMOSYNE_DIAGNOSTICS=1`;
- the static boot overlay yields after boot;
- FileLoader is hidden until explicitly summoned.

`MonetaDiagnosticHUD` itself now defaults hidden so representation replacement cannot silently reintroduce it after dataset changes.

## Post-implementation adversarial review

### Production path attacked

Re-read `bootstrapApp`, `AnalystJourneyControls`, representation replacement and the existing UI/UX smoke journey. The shell uses the existing dispatcher for dataset cycling and anomaly analysis; it does not call Atlas/Moneta analytical code directly. FileLoader retains its existing Rust/Atlas parse path and is only visibility-gated.

### Original failure modes

1. **Decorative-only risk:** addressed by explicitly hiding boot overlay, raw loader, DOM telemetry and VR diagnostic surfaces in the real bootstrap path.
2. **Dataset-switch diagnostic resurrection:** addressed at the diagnostic constructor, not only at initial bootstrap.
3. **Second authority:** no analytical calculation was added to the shell; actions still dispatch `dataset.cycle` / `analysis.apply` and assessment reads the existing authoritative state.
4. **Capability loss:** stable IDs and status wording needed by the current load/analyse/record/export/replay smoke path are retained; package selection opens the advanced section before replay.
5. **Developer route:** surfaces remain constructed and diagnostics mode remains available. The composition policy exits early in `DEVELOPER` mode.
6. **Replacement god object:** none added. The change is composition policy plus reshaping the existing desktop shell.
7. **Evidence quality:** a dedicated production-browser smoke accompanies the mechanical policy test.

### Newly inferred failure mode

Hiding the dashboard `wallGroup` is not by itself proof that independently snapped chart-plane meshes are hidden. Existing `_doLoadDataset()` already calls `_setStatisticalLensVisible(false)` after rebuilding the dashboard, so chart-plane visibility remains governed by the statistical-lens state rather than the wall container. This boundary remains a focused review target for exact-head browser evidence rather than being inferred from the container alone.

### Test falsifiability

The new tests fail if primary actions expand, raw boot surfaces become visible again, the loader ceases to be on-demand, or Moneta diagnostics revert to visible-on-construction. Existing journey smoke should fail if stable semantic actions/export/replay were accidentally severed.

### Disposition

No known BLOCKER at implementation review. Exact-head typecheck, focused tests, production smoke and normal repository gates remain required before B4 can be promoted beyond `IMPLEMENTATION LANDED / REVIEW ACTIVE`.

## Completion boundary

B4 may be considered verified only when exact-head evidence demonstrates the real product boot is materially task-first and existing journey behavior remains intact. B5 remains separate: it must move common actions to the selected object/context rather than expanding this shell into a global action catalogue.
