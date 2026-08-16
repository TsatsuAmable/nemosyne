---## Phase 23 — Study Validation & Polish 🔲 (new)

> **Focus:** Close the critical validity gaps that would contaminate the first 2D vs. 3D study,
> address the highest-priority tech-debt items confirmed against code, and establish the
> minimal infrastructure for a reproducible experimental harness. Each sprint is a small,
> on-device-validatable PR.

### Sprint 23.1 — Critical P0 fixes (study-data integrity)

> Evidence base: code verification this session confirming 4 P0/P1 items directly threaten
> study validity. Goal: fix all four in one coordinated PR.

- 🔲 **Orphaned second `WebGLRenderer`** (`SceneGraphController.ts:47` constructs a full
  second `THREE.WebGLRenderer` unconditionally; `World.ts:206` instantiates it with no
  `container` → renderer never appended to DOM and never disposed). **Fix:** make renderer
  lazy-constructed or inject Engine's existing renderer; verify `dispose()` called on
  session end. *Blocking: stable-release Gate 0.*
- 🔲 **Missing first-class `Compare` operation** (`DatasetOperations.ts` has filter/sort/aggregate/
  cluster/dbscan/anomaly/slice but no `compare`; BenchmarkSession references it as a task
  label but the operation does not exist). **Fix:** implement `compare` as a first-class
  `DatasetOperation` — group A vs group B, before vs after, selected vs population, 2D vs 3D.
  *Blocking: stable-release Gate 2 + "Find the Fraud" study task.*
- 🔲 **Colorblind data-encoding gap** (`Encodings.ts:13` `categoricalColor()` returns raw
  `PALETTE` `[0x00ffcc, 0xff0055, 0xffaa00, 0x00aaff, 0xff00ff, 0x88ff00]` — index 1 red
  + index 5 green is a red-green confusion pair; never applies colorblind remap). **Fix:**
  thread the active `colorblindMode` into `categoricalColor()` (or a wrapper) so palace +
  chart data encoding respects the mode; make `remapColor` per-mode for deuteranopia/
  protanopia/tritanopia; switch default palette to a colorblind-safe sequence (Okabe–Ito,
  8-colour) with shape/texture redundancy for categories beyond palette length. *Blocking:
  stable-release Gate 2 + silent participant-subgroup confound.*
- 🔲 **Draco re-solve GPU leak — materials, textures, instance buffers** (`DracoTopologyNode.ts:38-50`
  calls `MeshPool.releaseGroup` but `releaseGroup`/`clear` never dispose `material.dispose()`
  or `texture.dispose()`). **Fix:** have `releaseGroup` dispose materials + textures (respecting
  shared-pool geometries), and make `clear()` a full teardown. *Blocking: Sprint 22.9 P1 +
  Gate 4 tech-debt item.*

### Sprint 23.2 — Study enablement infrastructure

> Evidence base: Sprint 22.3/22.6 audit items + stable-release Gate 2.5/5 requirements.
> Goal: wire the observer console + canonical 2D control + trial data model so the study
> harness can operate.

- 🔲 **Wire `Observer` console** (reclaim `AsymmetricDesktopCompanion`/`PeerAvatarManager`
  from dead code — confirmed built, zero call sites). Instantiate in `World`/`WorldUIManager`,
  drive from remote peer state, surface commentator comments non-disruptively. Protocol states:
  Passive (genuine block on manipulation events), Prompt (small fixed set of predefined
  prompts), Assisted (may intervene per protocol). *Blocking: Gate 2.5.*
- 🔲 **Canonical 2D control, as its own implementation milestone** — the 2D condition needs
  the *same* dataset, task wording, scoring rubric, and analytical semantics as the VR/desktop-3D
  conditions, built and versioned alongside them, not assembled ad hoc. *Blocking: Gate 5.*
- 🔲 **Experimental confound register** — a living document tracking known non-technical confounds
  and how each is controlled: representation-explanation parity, input-training parity,
  researcher-intervention asymmetry (tracked via Gate 2.5 Passive/Prompt/Assisted state),
  practice/repeated-dataset effects, interface novelty. *Blocking: Gate 5.*
- 🔲 **Data governance layer** — data dictionary (source, meaning, unit, sampling, derived/
  raw, retention class, disclosure), consent (documented inspectable list), data minimization
  (per-stream decision), pseudonymization (participant IDs not names), retention/deletion
  path, observer visibility to participant (in-session indication). *Blocking: Gate 5.*

### Sprint 23.3 — Study harness & trial data model

> Evidence base: stable-release Gate 5 exit criteria + the "first real study" requirement
> from the revised roadmap. Goal: implement the trial/condition data model and enable a
> reproducible multi-participant run.

- 🔲 **Trial data model** — explicit `participantId` (pseudonymous, e.g. `P014`), `trialId`,
  `condition` (2D / desktop-3D / VR-3D), `taskId`, `protocolVersion`. Implement as first-class
  layer above `WorldSessionController`'s per-session save format.
- 🔲 **Condition counterbalancing** — assignment mechanism (Latin square across participants),
  recorded per trial so order can be checked as a covariate later.
- 🔲 **Explicit trial-state machine** — started / paused / resumed / completed / failed / reset,
  each timestamped. Without this, "restart" and "crash" are indistinguishable after the fact.
- 🔲 **Outcome capture** — answer, correctness (against scored ground truth), completion time,
  confidence rating, workload measure. Use a validated instrument (NASA-TLX protocol) or an
  explicitly-documented custom short-form instrument, clearly labeled as custom.
- 🔲 **Triangulation join key** — Gate 2.5's recording schema timestamps observations; Gate 5
  needs the automated telemetry stream, outcome data, and observer log to share one join key
  (`trialId` + timestamp) so they can be correlated after the fact without manual reconciliation.
- 🔲 **Session recording schema** — participant ID, condition, task, timestamp, event type,
  observation tag/note, and the analytical state snapshot at that moment, structured so it can
  be joined against the automated telemetry stream after the fact.

### Sprint 23.4 — WASM migration continuation (critical path items)

> Evidence base: Phase 21 sprint grid — Sprints 21.3–21.6 are deferred behind the B2
> load-test gate but several items affect study validity and should proceed independently.

- 🔲 **Scene graph & command buffers** — implement Rust ECS (`Entity`/`Transform`/`LocalToWorld`
  `/MeshRef`/`MaterialRef`) + `CommandEncoder`; JS `CommandApplier` consuming the packed stream;
  map simple artefacts (`DatumPlane`/`TechnoCoreNode`) via Rust commands. *Pending: B2 gate
  but infrastructure should proceed.*
- 🔲 **Input & interaction state machine** — port `HandGestureRecognizer`, `ControllerGestureMapper`,
  `InputRouter` intent dispatch, `DataOperations` interaction transforms, `AnalysisHistory`
  undo/redo to Rust (JS keeps WebXR pose polling + haptics/audio). *Depends on B2 data but
  code can be staged.*
- 🔲 **Port remaining utilities** — `SeededRandom`, `PerformanceBudget`, `Telemetry`,
  `SessionStore` to Rust; profile Quest frame time; full integration-test parity.

### Sprint 23.5 — Polish & tech-debt hygiene

> Evidence base: stable-release Gate 4 exit criteria + roadmap audit items that affect
> trustworthiness of results if left unaddressed.

- 🔲 **Correct stale roadmap claims** — `docs/ROADMAP.md:201` still checks off "colorblind-safe
  palettes" as complete under historical Phase 10 record, contradicted by the open gap 450 lines
  later. Fix before stable release.
- 🔲 **Reconcile four-tier vs. two-tier instancing spec drift** — `CLAUDE.md` documents four
  discrete LOD bands; actual code implements two plus adaptive scale factor. Per recommended
  default: correct spec to match reality unless Gate 3's load-test data shows the middle band
  matters.
- 🔲 **Decide fate of remaining built-but-never-wired classes** — `BinaryPoseSerializer`,
  collaborative-analysis-only pieces of `CollaborativeStateSync` not claimed by Gate 2.5,
  explicitly mark out-of-scope/deferred in code comments or remove from Stable build.
- 🔲 **Type-safety improvements** — align `three`/`@types/three` versions (`package.json`
  declares `three: ^0.168.0` vs `@types/three: ^0.185.4`); eliminate `allowJs: true`
  boundary obfuscation; type `updatables` as `Updatable[]` instead of `unknown[]`; resolve
  `src/ai/` README staleness + AI-story inconsistency.
- 🔲 **Dead-code cleanup** — delete `src/ai/` entirely unwired module (740 lines, zero import
  outside `src/ai/`); delete `src/data/serializers/` production-unwired barrel (zero importers);
  consolidate duplicate `SharedAnnotationManager`; delete `IceVaultNode` and
  `GestureConfidenceHUD`; update `ObjectPool.ts` imports from stale path; delete two legacy
  `.js` test stubs (`file-loader.test.js`, `tda-mapper.test.js`).