# Post-UI / Density Adversarial Review — 30 August 2026

**Review base:** `main@76abda6fc0380ed73aec656b65ecd29ecbd58e24`  
**Primary review window:** merged PRs #563–#571  
**Shared-contract spot check:** the completed Stream M distribution path where density reuses the semantic-envelope machinery  
**Disposition:** **FIX-FORWARD REQUIRED**. The World/runtime port work largely survives review, but the newest density contract and unified UI contain material defects that should be closed before Density M3 or a visible-product completion claim.

## Method

This review did not treat merge status, green CI or existing “adversarial” test names as proof. It re-read the production call paths and asked what input would falsify each claimed invariant.

The main paths attacked were:

- representation requirements → candidate capabilities → fitness scoring → semantic payload contract;
- density request/envelope validation and the new resident-handle Rust builder;
- task-first DOM shell → pointer hit testing → underlying Three.js surface;
- shared UI components → repeated open/search/close lifecycle;
- RF-062H dev-evidence installer → `WorldUIManager` role ownership → disposal;
- World feature ports → live-stream/collaboration lifecycle;
- World lifecycle → `AnalyticalRuntimeOwner` → Worker generation recovery;
- roadmap synchronization against the source that actually merged.

## Executive result

| Area | Result | Review status |
| --- | --- | --- |
| #563 visual token convergence | Core token convergence holds; one roadmap claim about `VRMenu` is false | TARGETED DOC FIX |
| #564 World feature ports | No new material blocker found in reviewed live-stream/collaboration seams | HOLDS IN BOUNDED REVIEW |
| #565 analytical runtime owner | Generation/recovery ownership survives the reviewed race path | HOLDS IN BOUNDED REVIEW |
| #566 dev evidence isolation | Original isolation design is sound, but #568 partially regressed ownership | REOPENED BY RF-067 |
| #567 World compatibility retirement | No material regression found in reviewed runtime/story ownership seams | HOLDS IN BOUNDED REVIEW |
| #568 unified UI | Pointer/input blocker plus lifecycle/policy regressions | FIX-FORWARD REQUIRED |
| #569 roadmap sync | Contains a source-false `VRMenu` removal claim | FIX-FORWARD REQUIRED |
| #570 density M1 | Contract is not yet sufficiently fail-closed/truthful | M1R REQUIRED |
| #571 density M2 | Rust/handle authority is real; builder inherits M1 contract defects | LANDED / REVIEW ACTIVE; DO NOT START M3 BEFORE M1R |

## Findings

### RF-063 — InvestigationShell intercepts the scene pointer surface

**Severity:** HIGH / visible product blocker  
**Introduced:** #568  
**Status:** OPEN — immediate fix-forward

`mountInvestigationShell()` gives the fixed root `pointer-events: none`, but creates an empty `canvasArea` grid child covering the central scene with `pointer-events: auto`. A transparent element still participates in hit testing, so it can become the target instead of the underlying renderer canvas.

Current Playwright shell/adversarial tests prove only that `body canvas` is visible; they do not dispatch a pointer through the central shell area and prove the renderer receives it.

**Required fix:** make the passive canvas grid cell non-interactive unless it owns a concrete DOM control, and add a production-bundle pointer-delivery falsifier while proving header/sidebar controls remain clickable.

### RF-064 — density grid validation does not prove coordinate completeness

**Severity:** HIGH / scientific contract blocker  
**Introduced:** #570; inherited by #571 validation  
**Status:** OPEN — blocks Density M3

`validate_binned_density_payload()` builds tuples as `(cell.x_index, cell.y_index, cell)`, sorts them, and then checks that `cell.x_index == x_idx && cell.y_index == y_idx`. The tuple indices were copied from the same cell, so that comparison is tautological.

The validator proves grid length equals `binsX * binsY`, but not that every coordinate pair occurs exactly once. A malformed payload can replace one coordinate with a duplicate, keep distinct semantic IDs and valid count totals, and still represent an incomplete lattice.

#571’s builder currently emits a complete deterministic lattice, so this finding does not invalidate the builder mathematics. It means the reusable M1 boundary is weaker than the envelope it claims to validate and must be repaired before the production cutover relies on it.

**Required fix:** enforce unique `(xIndex,yIndex)` pairs and exact lattice coverage, and add real-WASM duplicate-coordinate/missing-coordinate mutations.

### RF-065 — the binned candidate still receives continuous/population-density credit

**Severity:** HIGH / ranking and scientific-semantics defect  
**Introduced/retained:** #570; repeated by #571 information contract  
**Status:** OPEN — contract decision required before M3

The candidate is named **Binned Density Field** and #571 computes a finite equal-width bivariate count grid, but `RepresentationCandidate.ts` still declares `supports: ['continuous-density', ...]` and preserves `population-density-distribution`. #571’s Rust envelope repeats the same preservation claim.

This is rank-effective: `FitnessModel.ts` maps the `density` requirement to `continuous-density` and awards full density-handling credit when a candidate both supports that capability and preserves `population-density-distribution`.

A binned empirical count/mass field may be a useful density representation. It does not, by itself, establish a continuous population density, PDF or KDE.

**Required fix:** create/narrow the capability and information vocabulary for the binned empirical object, update requirement coverage/scoring without laundering it into continuous semantics, and independently review ranking deltas.

### RF-066 — density analytical parameters are permissive while the contract claims strictness

**Severity:** MEDIUM-HIGH / provenance and boundary integrity  
**Introduced:** #570; inherited by #571  
**Status:** OPEN — fix in M1R

Distribution uses a typed `deny_unknown_fields` parameter struct. Density reads `binning`, `interval` and `excludedPolicy` from a generic JSON object and silently accepts unknown fields within the common size bound.

That permits ungoverned parameters or hidden metadata to cross a boundary described as an exact reviewed method contract. The M1 test rejects a top-level `rows` field but not semantics-changing/nested fields under `analyticalMethod.parameters`.

**Required fix:** strict typed density parameters, unknown-field rejection, nested-smuggling mutations, and tighter representation-specific version identity checks where appropriate.

### RF-067 — #568 reintroduced dev-evidence ownership into production `WorldUIManager`

**Severity:** HIGH / cross-wave architecture/lifecycle regression  
**Introduced:** #568 after #566  
**Status:** OPEN — immediate fix-forward

#566 moved `LoadTestPanel` ownership and its `loadTest` role registration into DEV-gated `installDevEvidence()`. The installer registers on install and unregisters on dispose.

#568 added `panelRolesManager.registerPanel('loadTest', 'Load Test Panel', 'diagnostic')` back into production `WorldUIManager`, despite the adjacent comment that dev-only panels are composed by their external installer.

The RF-062H source test forbids concrete load-test classes/driver symbols in `WorldUIManager` but not the role registration, so the downstream regression passed.

**Required fix:** remove production registration, leave ownership in `installDevEvidence()`, and strengthen the RF-062H falsifier to reject dev-only role ownership as well as classes.

### RF-068 — CommandPalette reopens with stale filtered results and a blank query

**Severity:** MEDIUM / deterministic UI lifecycle defect  
**Introduced:** #568  
**Status:** OPEN — fold into UI fix-forward

`handleInput()` mutates `_filteredCommands`. `hide()` clears rendered DOM but does not reset the collection. `show()` creates a fresh blank search input and renders the surviving filtered collection.

Reproduction: open → search for one command → close → reopen. The input is blank while results remain filtered until the next input event.

**Required fix:** reset filter/selection on open or close and add a close/reopen-after-filtering regression. Separately harden the palette’s `aria-modal` focus containment if Tab can escape.

### RF-069 — canonical roadmap falsely says `VRMenu` was removed

**Severity:** MEDIUM / governance truth defect  
**Introduced:** #569  
**Status:** OPEN — docs correction

#569 records #563 as including `VRMenu`/`SpatialAssetRegistry` removal. The actual #563 source deliberately retained and retokenised `VRMenu`, stating that it remains the only concrete curated live-source selector and may only be retired after a wired replacement exists. `SpatialAssetRegistry` was removed.

Because `docs/ROADMAP.md` is the execution/status authority, this is not harmless prose drift: another agent could remove or ignore the only live-source chooser on a false completion premise.

**Required fix:** correct the canonical status sentence and preserve the replacement-before-deletion dependency.

## #571 M2-specific review

The M2 implementation advances the correct authority boundary:

- it obtains data through the resident columnar handle;
- TypeScript transports handle + request only and does not compute density;
- Rust derives domains, grid counts and bounded output;
- output is capped at 400 cells independently of source N;
- row-order invariance and invalid-pair exclusion have focused tests.

No second JS analytical implementation was found in the reviewed bridge/builder path.

Two residuals matter before scale promotion:

1. M2 inherits RF-064–RF-066 because `validate_and_normalize()` ultimately accepts the M1 contract. Therefore M2 is not a reason to skip M1R; **M1R is now a hard precondition for M3**.
2. `valid_pairs()` materializes every valid `(x,y)` pair into a transient Rust vector before domain/grid construction. That is an O(N) extra memory copy even though output is bounded. At the currently declared 500k-row density envelope this may be acceptable, but M4 must measure it. If it is a cliff, replace it with a two-pass traversal of the resident columns rather than weakening the supported scale claim.

The builder also contains a redundant preliminary X-bin linear scan immediately before the binary-search assignment that overwrites `x_idx`. This is not a correctness blocker at a maximum of 20 bins, but it should be removed opportunistically rather than preserved as intentional algorithmic work.

## Work that held up under this review

### #564 World feature ports

The reviewed live-stream path preserves the old active-live-dataset guard in the injected `World` adapter. Disconnect unsubscribes stale status callbacks before transport teardown and publishes an explicit local disconnected outcome. Collaboration event handlers are generation-fenced and teardown disposes avatar/desktop state. No material regression was found in this bounded pass.

### #565 analytical runtime ownership

`WorldLifecycleOwner.markKernelUnavailable()` advances the kernel generation and invokes `World._onKernelUnavailable()`, which calls `AnalyticalRuntimeOwner.markUnavailable()` before recovery initializes a new generation. Stale initialization attempts release their attempted Worker. The apparent active-Worker overwrite risk is therefore closed on the normal recovery path.

### #567 World compatibility retirement

The reviewed story exporter now reads analytical history/dataset state from Atlas rather than retired World mirrors, and current runtime ownership no longer exposes the compatibility setters removed by #567. No material defect was found in that bounded ownership check.

### completed empirical distribution slice

The current translator resolves rows lazily and routes `DISTRIBUTION_FIELD` through its semantic payload adapter without source-row traversal. Density findings should not be used to reopen Stream M generically; they are representation-specific contract issues introduced by the new density slice.

## Roadmap action

The parent `P1_R_SEMANTIC_EMBODIMENT_CONVERGENCE.md` still describes Stream M as merely selected and leaves some R2B checkboxes open despite #547–#552 completing the finite distribution slice. Its generic R2C section also predates #570/#571.

`docs/roadmap/P1_R2C_DENSITY_TRUTH.md` now refines R2C into the actual state:

```text
M1 landed
  + M2 landed
    -> M1R contract correction
      -> M3 production cutover
        -> M4 product/scale/memory/perceptual evidence
          -> STOP / independent review
```

Cluster and inferred topology do not start automatically. Inferred k-NN/similarity/correlation graphs are analytical models requiring governed Rust/Moneta methods, not renderer-generated edges.

A later canonical roadmap sync should reconcile stale R2B/R2C checkmarks and RF-069 after the immediate fix-forward heads are known, avoiding another docs conflict with live implementation branches.

## Ordered fix-forward

1. **UI blocker batch:** RF-063 + RF-067 + RF-068, with browser/source falsifiers.
2. **Density M1R batch:** RF-064 + RF-065 + RF-066; rerun #571 builder evidence through the corrected contract.
3. **Roadmap truth sync:** RF-069 plus stale parent distribution/density status.
4. **Density M3 → M4:** one merged exact-head checkpoint at a time.
5. **STOP / independent review:** only then select R2D cluster or a separately governed inferred-topology tranche.

## Completion semantics

- #564/#565/#567: **IMPLEMENTATION LANDED / BOUNDED REVIEW PASSED** for the inspected seams;
- #566: original implementation sound, isolation invariant **REOPENED BY DOWNSTREAM REGRESSION**;
- #568: **IMPLEMENTATION LANDED / FIX-FORWARD REQUIRED**;
- #569: **DOCS LANDED / TRUTH CORRECTION REQUIRED**;
- #570: **M1 LANDED / CONTRACT FIX-FORWARD REQUIRED**;
- #571: **M2 LANDED / REVIEW ACTIVE — M1R REQUIRED BEFORE M3**.

Green CI remains necessary evidence, not a reason to waive these falsifiers.
