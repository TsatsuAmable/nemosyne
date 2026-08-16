# Nemosyne — User Stories, Use Cases & Evidence-Based Gap/UX Analysis

> **Method.** User stories and use cases are derived from the project's *stated* goals and
> features (`README.md` "What it does", `FEATURES.md`, `docs/GETTING_STARTED.md`,
> `docs/ARCHITECTURE.md`). The **gap / completeness / UX** verdict for each is grounded in
> real source evidence (file:line), gathered by five parallel verification passes across
> data/Draco/scalability, input/locomotion, UI/onboarding, collaboration/TDA/export, and
> accessibility/telemetry. Nothing here is asserted from comments or docs alone; where code
> and docs disagree, code wins, and the disagreement is recorded as a gap.
>
> Status legend: ✅ COMPLETE · 🟡 PARTIAL · 🔴 STUB/MISSING/dead · ⚪ UNCONFIRMED
>
> _Drafted 2026-08-11. Not yet committed._

---

## Personas

- **P1 — Solo Analyst** (primary). The user the project is built for: brings a dataset,
  explores it as a 3D memory palace, runs operations, saves/exports.
- **P2 — Accessibility-Needs Analyst**. Motor difficulty (needs dwell selection), color vision
  deficiency (needs colorblind-safe *data* encoding), low vision (needs text scale / high contrast).
- **P3 — Comfort-First / Motion-Sensitive Analyst**. Needs snap-turn, teleport-with-preview,
  reduced-motion vignette, seated height, panel-distance control.
- **P4 — New Analyst**. First time in the tool; needs onboarding (guided tour, templates,
  just-in-time gesture hints, interaction coach, adaptive help).
- **P5 — Live-Streaming / Monitoring Analyst**. Watches a live feed (IoT, market replay) and
  expects the palace to update in real time.
- **P6 — Collaborative Team**. Multiple analysts in a shared room; needs presence and,
  eventually, shared state.
- **P7 — Performance-Conscious / Standalone-Headset Analyst**. On a Quest; needs to stay in
  frame budget, run load tests, rely on LOD/instancing for 100k+ datasets.

---

## A. Data ingestion & exploration

### US1 — Load my CSV/JSON and see it as a 3D memory palace (P1)
- **Use case.** Analyst drops a CSV/JSON file in the 2D loader (or uses the wheel menu),
  picks/auto-accepts a topology, and a Draco-recommended palace renders in front of them.
- **Completeness: ✅ COMPLETE.** Real CSV parser with quoted-field/embedded-newline handling
  and multi-delimiter auto-detect (`Parsers.ts:24-229`); JSON array-of-objects + type inference
  (`Parsers.ts:42-71`); typed `Dataset` with live `updateRows` append/replace sliding window
  (`Dataset.ts:61-247`); 2D DOM loader with schema preview, validation, and WASM fast-path
  (`src/ui/FileLoader.ts:38-360`). `parseDataset` also has a minimal fixed x/y/z ArrayBuffer
  branch (`Parsers.ts:202-222`) — not a general Arrow reader (Arrow lives separately,
  unaudited).
- **UX.** The loader is a neon-cyan 320px debug-styled overlay with an inline controls
  cheat-sheet — functional but reads as a developer tool, not a polished analyst entry point.

### US2 — Auto-detect topology and recommend an appropriate layout (P1)
- **Use case.** Column names/types → inferred topology (graph/hierarchy/geo/vector/time/tabular);
  the Draco constraint engine picks layout + geometry + behavior + interaction.
- **Completeness: ✅ COMPLETE.** A genuine symbolic recommender, not a stub:
  `ConstraintEngine.extractFacts` computes real stats — mean/median/std/skew/kurtosis,
  categorical entropy, Pearson correlation, trend + seasonality, outlier counts
  (`ConstraintEngine.ts:172-341`); `solve` enumerates the full 3,168-candidate spec space,
  filters via 6 hard constraints, scores against ~28 weighted soft constraints, returns the
  min-cost spec (`:636-669`); live weight tuning via `setWeight`/`adjustWeight`. Six real
  layout generators (`GridLayout3D`, `ForceDirected3D`, `RadialTree`, `TimeSeriesRibbon`,
  `Streamline`, `GeoSurface` — `src/draco/layouts/*`). Topology inference by column-name
  heuristics (`TopologyInference`).
- **UX / gaps.** Hard constraints are coarse (topology forces a single layout). Two layout
  gaps: `StreamlineLayout` uses a *synthetic* procedural vector field rather than reading
  real `u/v/w` columns; `GeoSurfaceLayout` uses a fixed `heightScale` rather than
  dataset-normalized scaling. Both are honesty issues vs. the stated "vector-field" and
  "geospatial" support.

### US3 — Inspect individual data points (P1)
- **Use case.** Select a node → a DataCard appears; deeper inspection via a holographic
  hand-following inspector.
- **Completeness: ✅ COMPLETE.** `DataCard` billboarded key/value list (`DataCard.ts:53-109`);
  `HolographicInspector` is a full gravity-glove-style tooltip — hand-follow with smooth lerp,
  look-at-user, flick-down / sustained-look-away dismiss, open/close audio + hit-marker
  (`HolographicInspector.ts:24-377`).
- **UX.** The dismiss gestures (flick wrist down, look away) and hover-breathe are thoughtful
  VR ergonomics, with a rendered footer hint ("look away or flick wrist to dismiss").

---

## B. Analysis operations

### US4 — Filter / sort / cluster / time-slice / anomaly in VR (P1)
- **Use case.** Via gestures (pinch-together = filter, slice-up = sort, slice-down = time
  slice), wheel-menu ops, or in-place handles; live preview before commit.
- **Completeness: ✅ COMPLETE (operations) · 🟡 PARTIAL (one member).** Pure operations are
  real: `filter`, `sort`, k-means++ (deterministic seeded), agglomerative hierarchical
  (single/complete/average linkage + dendrogram), DBSCAN, `anomaly` (IQR + z-score +
  isolation-forest *approximation*), `slice` (`DatasetOperations.ts:64-562`). Wired in VR
  through `DataOperationController` + `World` callbacks; WASM path attempted first when
  `CAP_OPERATIONS_RUST` is set. Metaphor/preview via `onHover`/`onLeave`.
- **UX.** `applySort` lays nodes on a horizontal arc; cluster/anomaly transforms live in
  dedicated modules (real). Isolation-forest is a lightweight single-feature recursive
  approximation, not a full ensemble — fine for VR triage, not statistical authority.

### US5 — Aggregate my data by group (P1)
- **Use case.** Pinch-apart gesture → aggregate; expect grouped markers / bars summarizing
  each group.
- **Completeness: 🟡 PARTIAL — visual placeholder.** `applyAggregate` hides all original
  nodes and scales the first node by group count; the code comment states "In a full
  implementation this would spawn new aggregate meshes" (`DataOperations.ts:97-120`). The
  translator *does* have a real `AGGREGATE_BARS` geometry builder
  (`VRTopologyTranslator.ts:714`), but the VR operation path routes to the placeholder, not
  the bar builder. **Genuine gap:** aggregate is advertised (gesture + menu) but produces a
  degenerate visual.
- **UX.** A user who pinch-aparts sees the palace *shrink to one node* — reads as a bug.

### US6 — Undo/redo my analysis steps (P1)
- **Use case.** Rotate-counter-clockwise / clockwise gestures, or Ctrl+Z/Y, or wheel-menu
  Undo/Redo; a narrative strip shows history frames.
- **Completeness: ✅ COMPLETE.** `AnalysisHistory` stack with frames (operation + parameters +
  row counts); `WorldSessionController` serializes/restores it; `NarrativeStrip` renders frames
  as clickable chips with seek (`NarrativeStrip.ts:28-176`).
- **UX / gap.** Wheel-menu Undo/Redo items have **no disabled affordance** when the stack is
  empty (`WheelMenuBuilder.ts:279-281` acknowledges this) — clicking does nothing silently.

---

## C. Interaction & navigation

### US7 — Use natural hand gestures with a controller fallback (P1/P4)
- **Use case.** Pinch/slice/scoop/push/rotate/ok/both-pinched gestures; controller buttons +
  thumbsticks emit the same intents.
- **Completeness: ✅ COMPLETE (hand path) · ⚪ UNCONFIRMED (controller parity).** Real
  dual-hand `HandGestureRecognizer` with cooldown (0.65s) and move threshold (0.12m); pinch
  detection with hysteresis (0.04m/0.065m); last-valid-pose retention so lasers don't snap to
  origin on tracking loss (`Hands.ts:58-59, 231-289`). Gestures route to real actions. The
  controller→gesture mapper is injected/external (`ControllerGestureBridge` is a pass-through),
  so full controller-vocabulary parity is **UNCONFIRMED**.
- **UX.** Pause/resume requires a deliberate 0.8s two-hand hold — good against accidental
  triggers.

### US8 — Walk / teleport / fly comfortably (P1/P3)
- **Use case.** Teleport with arc preview, ground walk, flight mode, snap-turn, drop-to-floor,
  portals.
- **Completeness: ✅ COMPLETE.** Real parabolic-arc teleport preview (physics-based
  apex/descent + floor sampling + valid/invalid color marker, `Locomotion.ts:555-631`);
  ground movement (left stick / WASD); flight (right stick vertical + scoop gestures);
  snap-turn **ON by default** (30°, 0.35s cooldown); transient reduced-motion vignette;
  `FarcasterPortal` walk-through travel with 3s cooldown (`FarcasterPortal.ts:42-289`).
- **UX.** Vignette fades in faster than out (rate 8 vs 3) for prompt discomfort shielding.
  Simplistic hand-grab movement uses a fixed 1.5x/0.5x gain — no two-handed world-scale.

### US9 — Reach all features from the wheel menu (P1)
- **Use case.** Pinch the menu hand → constellation wheel; 7 categories, ~48 fixed items +
  templates; hover-preview for ops.
- **Completeness: ✅ COMPLETE.** `WheelMenuBuilder` 7 categories (panels/templates/views/live/
  collab/ops/loadtest); `HandWheelMenu` two-level radial with hover/click, connector lines,
  per-item onHover/onLeave for op preview. Full button-surface dispatch tests exist
  (`tests/wheel-menu-builder.test.ts`).
- **UX / gaps.** (1) **Bound to `engine.input.hands[0]` hardcoded**
  (`WorldUIManager.ts:153`), not `dominantHandIndex` (which `WorldInputCoordinator.ts:215`
  *does* use) — left-handed users get the wheel on the non-dominant hand. (2) Undo/Redo have
  no disabled state (see US6). (3) `openAngleThreshold`/`closeAngleThreshold` are stored but
  **never read** by visibility logic (`HandWheelMenu.ts:125-126`) — angle-gated open/close
  may not fire (UNCONFIRMED).

### US10 — Operate the dashboard of chart panels (P1)
- **Use case.** Curved semicircle dashboard wall of chart panels; scroll by slots, drag-to-snap.
- **Completeness: ✅ COMPLETE (class) · ⚪ UNCONFIRMED (wiring).** `DashboardManager` is full
  (semicircle/wall layouts, snap zones, scrollBy/scrollTo with lerp, reset, off-screen roll-in
  — `DashboardManager.ts:55-596`). **But `WorldUIManager` constructs it without calling
  `registerPanel`**; whether `World.ts` wires chart panels in elsewhere is UNCONFIRMED. Risk:
  the dashboard may render empty.
- **UX.** Launcher icons truncate titles to 10 chars (`PanelManager.ts:445`).

---

## D. Onboarding & help

### US11 — Learn the gesture vocabulary; get just-in-time help (P4)
- **Use case.** Context-sensitive 3D hand-gesture hints appear near interactables when needed,
  debounced with a per-gesture cooldown; a guided tour walks new users through the palace.
- **Completeness: 🟡 PARTIAL — tour COMPLETE, JIT hints DEAD.** Guided tour is real: **19
  steps** with resolver/condition cases, PREV/NEXT pills, auto-advance guard, highlight ring,
  arrow-to-target (`DefaultTour.ts:31-131`, `GuidedTour.ts`, `GuidedTourController.ts`).
  Interaction Coach logs each interaction with gesture + controller equivalent + result
  (`InteractionCoach.ts:40-190`). **But `JITGestureHintManager` is never instantiated in
  production** — `new JITGestureHintManager` appears only in tests, never in `src/`
  (grep-confirmed). The class is real (ghost-hand wireframe, diegetic label, per-gesture
  cooldown, bob animation) but **not attached to any scene at runtime.**
- **UX.** The headline "diegetic, debounced onboarding instead of a tutorial dump" — a feature
  the earlier external review singled out as a *strength* — **does not run in the shipped
  product.** New users get the tour + coach, but no ambient just-in-time 3D hints.

### US12 — Get adaptive help when I'm struggling (P4)
- **Use case.** When frustration crosses a threshold, a contextual hint card appears, tuned to
  skill level, with a cooldown so it doesn't nag.
- **Completeness: 🟡 PARTIAL — analyzer COMPLETE, response DEAD.** `UXFrustrationAnalyzer`
  is real and wired: 6 rule-based detectors (repeated action, rapid abandonment, air-click
  miss, error correlation, gesture misfire, long dwell hesitation), a real 0–1
  dissatisfaction score, compact digest + remedy suggestions (`UXFrustrationAnalyzer.ts:58-238`);
  fed from `Telemetry` recorders; surfaces in the manual review-bundle export.
  **But `FrustrationResponseManager` is never instantiated in production** — `new
  FrustrationResponseManager` appears only in tests, never in `src/` (grep-confirmed). The
  class is real (novice 0.35 / intermediate 0.55 / expert 0.85 thresholds, 10s cooldown, 7s
  visibility, pattern-specific tip card) but **the dissatisfied-user hint card never appears
  at runtime.** ROADMAP line 309 marks it `[x]` done — a docs/reality mismatch.
- **UX.** The "adaptive-friction system" — the other feature the external review singled out
  as a *strength* — computes its score but only ever shows it to a developer via a manual
  export. The user-facing payoff (the in-VR hint) is not wired. The score's only runtime
  destination is the review-bundle JSON.

### US13 — Start from a curated analysis template (P4)
- **Use case.** Wheel menu → Templates → e.g. Factory Floor Monitoring / Fraud / Sales / Org
  Cost / Market Replay / Geospatial; loads sample dataset + theme + tour.
- **Completeness: ✅ COMPLETE.** `ANALYSIS_TEMPLATES` wired 1:1 in the templates category;
  `loadTemplate(id)` confirmed by dispatch tests.

---

## E. Live data

### US14 — Connect a live stream and watch the palace update (P5)
- **Use case.** Demo stream or a curated public source (Coinbase/Kraken/Binance/USGS/OpenSky);
  palace updates incrementally as rows arrive.
- **Completeness: ✅ COMPLETE.** `WebSocketAdapter` (reconnect, subscription, JSON + binary
  frame hook, normalize), `PollingAdapter` (fetch + AbortController), 5+ curated sources with
  real wire parsers (`OpenDataSources.ts:19-188`). Incremental update: `Dataset.updateRows`
  append/replace with sliding-window limit; `VRTopologyTranslator.appendRowsToArtifact` does
  real incremental tube-geometry extension **for the TIME_RIBBON layout**
  (`VRTopologyTranslator.ts:793-848`); other layouts fall back to full re-solve.
- **UX.** Live updates feel responsive for time-series ribbons; non-ribbon topologies incur a
  full palace rebuild on each batch (potential frame spike, mitigated by `ObjectPool`
  time-slicing).

---

## F. Persistence & export

### US15 — Save my session and restore it next time (P1)
- **Use case.** Autosave to IndexedDB; manual save/load; restores dataset, history, camera,
  settings, theme, tour, panel positions.
- **Completeness: ✅ COMPLETE.** Real IndexedDB roundtrip, `schemaVersion:1`, debounced 2s
  autosave, `_validateSnapshot` rejects bad schema / missing dataset, optional injected IDB
  factory (`SessionStore.ts:1-212`, `WorldSessionController.ts:14-189`). Verified by
  `tests/session-roundtrip.test.ts`.
- **UX / gaps.** Camera saves **position + rotationY only** (no full quaternion / teleport
  anchor) — restored view orientation may be lossy. DB v2 upgrade handler is a no-op (relies
  on load-time validation to reject legacy snapshots rather than migrating). Failed saves
  warn rather than throw (good — session stays usable).

### US16 — Export a screenshot and an analysis story (P1)
- **Use case.** PNG screenshot + JSON analysis story (dataset meta, topology, operations,
  camera, theme, telemetry) for lab notebooks / reproducibility.
- **Completeness: ✅ COMPLETE.** Real `renderer.domElement.toDataURL` → download (PNG/JPEG),
  and JSON story builder with dataset meta + camera + theme + operation history frames +
  telemetry (`AnalysisStoryExporter.ts:6-68`).
- **UX / gaps.** Story is JSON-only (no CSV/HTML narrative replay); screenshot is a single
  frame (no stereo/side-by-side for VR). Both surface success/failure to the in-VR console.

---

## G. Collaboration

### US17 — Join a shared room and see my peers (P6)
- **Use case.** Settings → Collaboration ON → join room; see peers in a HUD; broadcast my
  pose.
- **Completeness: 🟡 PARTIAL — mesh real, 3D presence NOT wired.** Real WebRTC mesh:
  one `RTCPeerConnection` + `RTCDataChannel` per peer, full SDP offer/answer/ICE, multi-peer
  join fan-out, token gate (close codes 4001/4002), 50-peer cap, prototype-pollution filtering,
  standalone Node signalling server (`NetworkManager.ts`, `SignallingServerCore.ts:43-171`,
  `SignallingServer.mjs`). `PeerPresenceHUD` is a live 2D canvas HUD: colored dots, names,
  direction arrows from broadcasted position, peer-count pill (`PeerPresenceHUD.ts:33-223`).
  **But the binary-pose / 3D-avatar stack is fully implemented and unit-tested yet not
  wired**: `PeerAvatarManager` (wireframe head + box hands + laser), `CollaborativeStateSync`
  (djb2 peerId + sequence-drop), `BinaryPoseSerializer` (40-byte ArrayBuffer) have **no
  production call sites**. The live hot path is JSON `setLocalState({position, rotationY})`
  — no quaternion, no binary, no 3D avatars, no laser-pointer sync. `broadcastCameraPose` is
  dead code.
- **UX.** Remote collaborators feel "flat" — 2D dots only, no embodied presence in the
  palace. The scaffolding for embodied presence exists and is tested; the last-mile wiring
  does not.

### US18 — Share dataset state and synchronized operations with peers (P6)
- **Use case.** Eventually, peers see the same dataset and ops (GETTING_STARTED notes
  "Sprint 10B.2 will add shared dataset state").
- **Completeness: 🔴 MISSING (by design — not yet built).** Data stays local in this release;
  only pose + dataset name are broadcast. Documented as future work, not a regression.

---

## H. Advanced analysis

### US19 — Run TDA to see topological structure (P1)
- **Use case.** Toggle the statistical lens → TDA summary planes (persistence barcode,
  mapper graph, Betti-0 curve).
- **Completeness: ✅ COMPLETE (lightweight).** Genuine JS `TDAMapper` (filter-function
  binning + overlap + connected-component clustering + shared-row edges), 1D-filtration
  persistence intervals (union-find), Betti-0 curve over radius samples
  (`TDAMapper.ts:50-252`); three canvas planes in the named `tda-summary-group` with
  `recompute()` (`TDAPlanes.ts:109-367`). Hidden by default after Sprint 22.2 (progressive
  disclosure).
- **UX / gaps.** This is an *approximation* toolkit, not full Vietoris-Rips persistence — no
  higher-dimensional simplices, no persistence diagrams (only a 1D barcode), death assignment
  is heuristic, and the Mapper `_linkage` argument is unused. Adequate for live VR summaries;
  not research-grade TDA. ChartPlane panel has no interactivity on marks; box plot has no
  outlier dots.

### US20 — Trigger metaphor actions to reveal relationships (P1)
- **Use case.** Select a node → a transient spatial effect (Resonance Pulse, Fork Plane,
  Chrono Dial, Constellation, Beacon, Aleph) reveals structure.
- **Completeness: ✅ COMPLETE.** All six are real, animated, self-disposing implementations
  (not named stubs), wired to `onSelect` via `VRTopologyTranslator._buildInteractionCallbacks`
  using actions registered in `registerFactories.ts` (`MetaphorActions.ts:74-300`). Effects
  use `depthTest:false` + additive blending so they read over dense artefacts; geometries/
  materials dispose on completion.
- **UX / gap.** `ResonancePulseOptions.speed` is accepted but `void speed`-discarded —
  animation duration is the only timing control.

---

## I. Scalability

### US21 — Work with large datasets (100k+) at a usable frame rate (P7)
- **Use case.** Load 100k–250k rows; rely on instancing / point cloud / LOD / object pooling
  to stay near frame budget on a Quest.
- **Completeness: ✅ COMPLETE (machinery) · 🟡 PARTIAL (documented tiers).** Real
  `InstancedPointCloud` (single InstancedMesh, DynamicDrawUsage, per-instance matrices/
  colors, sub-range GPU updates, `applyLODScale` from the AdaptiveFrameGovernor), uniform-grid
  `SpatialIndex` (radius query + 3D-DDA raycast), `LODManager` (frustum cull + 3-tier
  distance + gaze cone + opacity fade), `ObjectPool`/`MeshPool` (shared sphere/box geometry,
  time-sliced batch execution). `LODManager` classifies tiers but does **not** swap geometry —
  consumers must act on the LOD level.
- **UX / gap — documented vs. actual architecture.** `CLAUDE.md` migration standards document
  discrete instancing bands (≤256 Mesh / 257–8,192 InstancedMesh / 8,193–65,536 GPU point
  cloud / larger binned-LOD). The **actual code is two-tier**: individual Meshes for small
  datasets; `InstancedPointCloud` / cluster volume / aggregate bars for "large" (>500 rows,
  `ConstraintEngine.ts:80`) + adaptive LOD scale. **No `GL_POINTS` GPU point-cloud renderer
  distinct from `InstancedMesh` exists; the 8,192 / 65,536 bands are not separated.** The
  four-tier architecture is partly aspirational. (ObjectPool only pools spheres/boxes; cones/
  cylinders/tubes fall through to dispose.)

---

## J. Accessibility & comfort

### US22 — Use colorblind-safe data encoding (P2)
- **Use case.** Settings → Colorblind (deuteranopia/protanopia/tritanopia) → data colors
  remap so categories are distinguishable.
- **Completeness: 🔴 PARTIAL/MISSING — the critical path is missing.** `applyColorblindMode`
  remaps **only the environment** (fog, ambient, point light, grid, particles —
  `WorldTheme.ts:204-212`). `categoricalColor()` returns the raw `PALETTE`
  `[0x00ffcc, 0xff0055, 0xffaa00, 0x00aaff, 0xff00ff, 0x88ff00]` — index 1 red + index 5 green
  is a red-green confusion pair — with **no remap** (`Encodings.ts:11-15`). `ChartPlane.ts`
  has zero colorblind references; `VRTopologyTranslator.ts` uses `categoricalColor` at 5 sites
  (lines 242, 436, 624, 695, 759), so palace crystal colors bypass the remap too. Even the
  `remapColor` helper only maps 4 hue families — many data hues pass through unchanged
  regardless of mode. And the per-mode choice (deuteranopia vs protanopia vs tritanopia) may
  be **cosmetic**: `MovablePanel.remapColor` only branches on the `highContrast` boolean, not
  per-mode. **In a data-viz tool, the data encoding is the one place colorblind accommodation
  matters most, and it's the one place it doesn't reach.** Recorded as a Sprint 22.3 fix.

### US23 — Use dwell selection when I can't pinch reliably (P2)
- **Use case.** Enable Dwell Select; hover a button/object for ~1.2s to activate it.
- **Completeness: ✅ COMPLETE.** Full chain wired and ticking every frame:
  `SettingsPanel.dwellSelection` → `World.ts:1247` → `InputRouter.setDwellSelection`
  (`InputRouter.ts:203`) → `SelectionDispatcher.setDwellSelection`
  (`SelectionDispatcher.ts:40`), `updateDwell` called per frame from `InputRouter.update`
  (`:271`), fires `handlePointerDown`/`onSelect` after the 1200 ms threshold. Confirmed
  independently four times. (The earlier external review wrongly flagged this as a dead
  toggle — it searched for the wrong symbol `dwellEnabled` vs the real `dwellSelection`.)
- **UX / gap.** The **threshold is fixed at 1200 ms and not user-adjustable** — the
  `_dwellThreshold` plumbing exists but no UI exposes it. Dead aliases `dwellEnabled`/
  `dwellDelayMs` in `coordinators/types.ts:145-146` should be removed.

### US24 — Scale text / high-contrast UI (P2)
- **Use case.** Text Scale 0.75–2×; High Contrast toggle.
- **Completeness: ✅ COMPLETE.** `textScale` flows from `SettingsPanel` default →
  `applyAccessibility` → `this.textScale` → actual canvas font pixel size
  (`Math.round(18 * this.textScale)`, `MovablePanel.ts:360-361`), line width, and minimize-
  button sizing. Not a placebo. `applyAccessibility` overridden consistently across
  `TelemetryPanel`, `PerformancePanel`, `NetworkPanel`, `ChartPlanePanel`, `HandWheelMenu`
  (pure pass-through redraws).
- **UX.** Stepper label shows `×value` generically — odd for snapTurnAngle (degrees) and
  seatedHeightOffset (meters).

### US25 — Stay comfortable: snap-turn, vignette, seated, panel distance (P3)
- **Use case.** Snap-turn on by default; reduced-motion vignette; seated height offset;
  panel-distance control.
- **Completeness: ✅ COMPLETE.** `ComfortSettingsController.apply` routes snapTurn/snapAngle/
  reducedMotion/seatedHeight/vignette to locomotion + engine (`ComfortSettingsController.ts:11-49`);
  defaults `snapTurn:true`, `snapTurnAngle:30`, `vignette:false`, `vignetteIntensity:0.4`,
  `seatedHeightOffset:0`, `defaultPanelDistance:1.2`, `reducedMotion:false`
  (`SettingsPanel.ts:84-90`). Transient reduced-motion vignette is **real**: only active when
  `reducedMotion` is on, fades on movement/turn (>1cm, >1.1°), fades out when still
  (`Locomotion.ts:353-371`, `Engine.ts:312-315`).
- **UX.** Comfort vignette shielding only activates for reduced-motion users; default users
  keep unrestricted peripheral vision (a defensible choice).

---

## K. Performance & observability

### US26 — Monitor performance and stay in frame budget (P7)
- **Use case.** Performance panel: frame time, dropped frames, FPS, draw calls, triangles,
  points, interactables, updatables, panels; strict budget toggle.
- **Completeness: ✅ COMPLETE.** `PerformanceBudget.check` is a real per-frame evaluation
  against frameMs (16.67; 13.33 strict), dropped-frames-in-10s, draw calls, triangles, points,
  interactables, updatables, panels; severity escalates to critical at 2× for frameMs/draw
  calls; 10s sliding window; 5s throttle on duplicate warnings; `getViolations()` returns
  history (`PerformanceBudget.ts:11-168`). `strictBudget` tightens thresholds
  (`World.ts:1199`).
- **UX / gap.** `handTrackingMs` budget is declared but never checked. Budget checks run
  once per second (not per frame) per GETTING_STARTED — adequate for VR profiling.

### US27 — Run a load-test staircase (P7)
- **Use case.** Load Test panel: size presets (1k/8k/65k/100k/250k/full), start/stop/flush,
  live p50/p95/p99 + fps/dropped/gpu, per-step verdict, overall recommendation, download.
- **Completeness: ✅ COMPLETE.** `LoadTestPanel` with 6 presets, START FULL →
  DEFAULT_LOAD_TEST_PROFILE, STOP/FLUSH/DOWNLOAD wired, live counters, per-step green/yellow/
  red verdict, word-wrapped recommendation (`LoadTestPanel.ts:69-394`). Dispatch-tested.
- **UX / gap.** Verdict step list truncates at `contentH - 180` — long staircases clip
  without scroll.

### US28 — Opt-in local telemetry / UX digest (P1/P7)
- **Use case.** Opt in to local metrics; export a review bundle; nothing leaves the device.
- **Completeness: ✅ COMPLETE.** `Telemetry` records frames/datasets/operations/panels/
  menus/gestures/dwell/misses/errors in-memory; consent via `localStorage
  nemosyne-telemetry-consent`, **defaults disabled**; global error/unhandledrejection
  listeners attach only when enabled (`Telemetry.ts:56-313`). **Confirmed local-only: no
  `fetch`/`XHR`/`sendBeacon` in `Telemetry.ts`.** `getCompactUXDigest`/`formatCompactUXReport`
  powered by the frustration analyzer; review-bundle export with privacy level (metadata vs
  full-session).
- **UX.** Privacy toggle hit-target is a narrow 140px label box (`TelemetryPanel.ts:222`).

---

## L. Atmosphere

### US29 — Choose a low-strain atmosphere theme (P3)
- **Use case.** Cycle theme presets; pick a desaturated low-strain / muted backdrop with neon
  reserved for selection.
- **Completeness: ✅ COMPLETE.** 7 presets (`neonMidnight`, `daylightGlobe`, `coolDepth`,
  `warmAnomaly`, `deepNet`, `lowStrain`, `mutedProfessional`); `cyclePreset` real round-robin
  (`WorldTheme.ts:8-84, 196-202`); shared `palette.ts` tokens sourced by both `WorldTheme` and
  `MovablePanel` to prevent drift (`palette.ts:16-43`). Neon stays reserved for selection via
  the existing `emissiveIntensity` gating in `VRTopologyTranslator.ts`.

---

## Cross-cutting gap summary (ranked by user impact)

1. **Colorblind mode does not reach data encoding** (US22). Environment remaps; charts and
   palace crystals keep a red-green pair. The single most accessibility-critical color path is
   the one that's missing. → Sprint 22.3.
2. **JIT gesture hints are not wired into production** (US11). A praised onboarding "strength"
   is a real, tested class that never runs at runtime. New users lose ambient just-in-time help.
3. **Frustration-response hint card is not wired into production** (US12). The analyzer works
   and scores friction, but the in-VR hint never appears; the score only reaches a manual
   developer export. ROADMAP marks it `[x]` — needs correcting.
4. **Collaboration 3D presence / binary pose is built but not wired** (US17). PeerAvatarManager,
   CollaborativeStateSync, BinaryPoseSerializer are implemented + unit-tested with no call
   sites. Live collab is 2D HUD + JSON position/rotationY only.
5. **Aggregate is a visual placeholder** (US5). Pinch-apart collapses the palace to one
   scaled node instead of grouped bars, though a real `AGGREGATE_BARS` builder exists unused.
6. **Documented four-tier instancing is actually two-tier** (US21). No `GL_POINTS` GPU point
   cloud; the 8,192/65,536 bands aren't separated. Spec/impl gap in `CLAUDE.md`.
7. **Wheel menu bound to a fixed hand** (US9). `hands[0]` hardcoded vs `dominantHandIndex`
   used elsewhere — left-handed ergonomics miss.
8. **Dwell threshold not user-adjustable** (US23). Fixed 1200 ms despite plumbing.
9. **Dead code / declarations.** `dwellEnabled`/`dwellDelayMs` aliases; `broadcastCameraPose`;
   `HandWheelMenu` open/close angle thresholds stored but unread; `handTrackingMs` budget
   declared but unchecked.
10. **Streamline/Geo layout honesty** (US2). Vector-field layout uses a synthetic field, not
    real `u/v/w` columns; geo uses a fixed height scale.

## What an earlier external review got right vs. wrong

- **Right:** colorblind data-encoding gap (confirmed precisely); hand-wheel fixed-hand
  binding (confirmed).
- **Wrong:** "Dwell Select is a dead toggle" — it is fully wired and ticking per frame (the
  review searched for the wrong symbol).
- **Missed by the review:** the two features it praised as *strengths* — JIT gesture hints
  and the frustration-response system — are themselves not wired into the runtime. The
  review's recurring thesis ("plumbing exists at the settings/type level without the last
  mile of wiring it into the surface where a user encounters it") is correct *in general* —
  but its specific examples were one false (dwell) and one it under-investigated (colorblind),
  while the strongest instances of that thesis (JIT hints, frustration response, collab
  avatars, aggregate bars) are the ones it praised or didn't reach.