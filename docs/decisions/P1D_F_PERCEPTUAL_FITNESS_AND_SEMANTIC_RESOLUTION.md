# P1-D / P1-F First Pass — 3D-Native Perceptual Fitness & Semantic Target Resolution (Design & Test Plan)

**Status:** Design-first pass. Implementation delegated; this document is the binding specification.
**Governing docs:** `docs/P1_ANALYTICAL_RESPONSIVENESS_AND_SPATIAL_FITNESS.md` §P1-D, §P1-F; `src/.agent/skills/vr_engineer_skill.md` (evidence hierarchy, physical-device calibration gates); `docs/study/UI_TREATMENT.md` (frozen C1′ treatment — runtime changes here may be CONTROLLED-TREATMENT MODIFICATIONS subject to research review; see §5).
**Sequencing:** P1-D/F do not depend on P1-A/B/C but their physical calibration evidence depends on the Quest 3S qualification lane (PERF-04/UX-03). Land code behind the existing provenance/pinning machinery; physical calibration remains an evidence lane.

---

## 1. What the map established (verified against `main` @ `b17f340`)

### P1-D
- **Dormant fields, zero consumers.** `InteractionCharacteristics.occlusionResistance` / `cognitiveLoad` (`src/moneta/representation/RepresentationCandidate.ts:56-60`) are populated on all 12 `MONETA_REPRESENTATION_CANDIDATES` and read by nothing except `supportedInteractions` (`RepresentationGraphAdapter.ts:61`). Likewise `RepresentationRequirements.maxOcclusionTolerance` (`RepresentationRequirements.ts:67,111`) is validated but never consumed by ranking.
- **Two ranking paths exist** — legacy `ConstraintEngine.solve` (`ConstraintEngine.ts:491-536`, hard gate → soft weighted cost → argmin) and canonical `MonetaHypothesisEngine.arbitrate` (`MonetaHypothesisEngine.ts:140-340`: generate → hard feasibility `checkHardConstraints` 400-556 → `scoreCandidateWithModel` via `BootstrapFitnessModel.evaluate`, `FitnessModel.ts:99-143`, six weighted components summing to 1 → sort → `DecisionPolicy` DECISIVE/AMBIGUOUS/INFEASIBLE/UNDERDETERMINED → `analyzeWinnerSensitivity`). Perceptual fitness belongs to the canonical path; the legacy engine does not gain new evidence.
- **Injection points, in order of naturalness:** (1) new dimension in `BootstrapFitnessWeights` + component in `evaluate` (the candidate object is already in scope); (2) `DecisionEvidenceItem[]` explanation array (`MonetaHypothesisEngine.ts:251-285`) — where measured-vs-prior distinction is surfaced; (3) learned overlay `applyPinnedLearnedFitnessRuntime` (`LearnedMonetaRuntime.ts:149`) — unchanged; (4) learned feature schema `MONETA_PAIRWISE_FEATURE_DIMENSIONS` (`MonetaFeatureSnapshot.ts:8-15`) — adding a perceptual dimension requires `PAIRWISE_FEATURE_SCHEMA_VERSION` bump (freeze-manifest discipline); (5) empirical `EvidenceStore.computeUtilityForSpec`/`MonetaEmpiricalTuner` — out of scope here.
- **Persistence chain needs one additive field.** `DecisionProvenance` (`RepresentationDecision.ts:57-66`) flows unchanged through `RepresentationState.activeDecision` → session JSON (`AtlasCoreState.representationDecision`, `types.ts:277`) → `.nemosyne` `investigation/representation.json` (`NemosynePackage.ts:115-116`). Add `perceptualModelVersion` (+ device assumptions) there; all three layers carry it untouched.
- **No projection/occlusion measurement exists in embodiment** (`src/moneta/embodiment/` never touches camera/frustum). Existing measurement primitives live in the VR layer: `LODManager` (`headPos`/`gazeDir`/`THREE.Frustum`/`isInFrustum`/`isInGaze` 12°/`computeScreenSpaceError` `(worldRadius/dist)*1000` — `LODManager.ts:20-97`), `TooltipManager._findGazedTarget` gaze cone (`TooltipManager.ts:361-382`), `Engine.camera`/`headWorldPos` (`Engine.ts:82,122-129,309`), plus evidence streams `UXFrustrationAnalyzer` (air-click miss, dwell hesitation — direct fitness signals) and `Telemetry.recordDwell` (`Telemetry.ts:192`).

### P1-F
- **Picking today is nearest-first geometric, no ranking/salience/hysteresis**: `InputRouter.update` (`InputRouter.ts:283-339`) → panels first, then `InteractableRegistry.raycastScene` (`InteractableRegistry.ts:255-281`, BVH `firstHitOnly`) → `_entryForHit` walks parent chain (220-228). `InteractableEntry` (`InteractableRegistry.ts:18-24`) has **no semantic identity field**.
- **The only hysteresis-like mechanism** is UX-002 pinch-recoil `SelectionDispatcher.lockTargetForPinch` (`SelectionDispatcher.ts:53-58`); ray smoothing is the 1€ filter (`PointerRayFilter.ts:58-112`).
- **Analytical structures carry durable identity**: `DiscoveredStructure.id = structureId(datasetFingerprint, method, parameters, rowIndices, rank)` (`src/atlas/structures.ts:29-37`) with `rowIndices`/`datumIds`; today scene binding is *positional* — `InPlaceOperationHandles.buildFromStructures` (`InPlaceOperationHandles.ts:139-170`) anchors to `meshes[structure.rowIndices[0]]`, only the handle carries `structureId`. Observation meshes carry `userData.row` (`TopologyLayoutEmbodiment.ts:112,193,235`); instanced items carry `data: { row, index }` (`ScalableTopologyEmbodiment.ts:96-97`); cluster volumes `userData.cluster` (148).
- **Command vocabulary for ranking exists**: `WheelCategory` taxonomy + `DEFAULT_CATEGORY_ACTIONS` (`HandWheelCategorization.ts:10-16,37-69`), production vocabulary `buildIntentWheelMenuCategories` (`WheelMenuBuilder.ts:483+`), depth tiers `PANEL_LAYOUT` (`panelLayout.ts:38-69`), profile gating `ProgressiveDisclosure.ts:14` — but focus+context *resolution switching by distance/gaze* is not wired to `LODManager` tiers anywhere today.
- **Desktop parity is free at the right layer**: `DesktopControls` is a synthetic `PointerLike` feeding the same `InteractableRegistry`/`SelectionDispatcher` path (`DesktopControls.ts:104-130, 211-258`) — a resolver inserted *below* the registry inherits desktop support.
- **Dormant perception assets**: `MultimodalPerceptionEnvelope.ts` `GazeCandidate`/`MultimodalPerceptionEngine` (no consumers) — activate, don't duplicate.

---

## 2. P1-D design — PerceptualFitnessEvidence

### 2.1 Ownership split (matches the repo boundary: Moneta = bounded control plane over compact evidence)

- **Contract + store** (pure TS, no three.js): `src/moneta/evidence/PerceptualFitnessEvidence.ts` alongside `EvidenceStore`.
- **Measurement sampler** (camera-side): `src/vr/perception/PerceptualFitnessSampler.ts` in the existing perception module; consumes `LODManager` head/frustum/gaze state, embodiment meshes + `userData.row`, frustration/dwell streams; emits compact records.
- **Ranking**: new component in `BootstrapFitnessModel` (`src/moneta/representation/FitnessModel.ts`).
- **Provenance**: `DecisionProvenance.perceptualModelVersion` (+ `perceptualDeviceClass?`).

### 2.2 Versioned contract

```ts
export const PERCEPTUAL_FITNESS_EVIDENCE_VERSION = 'perceptual-fitness-v1';

export interface PerceptualFitnessEvidence {
  version: typeof PERCEPTUAL_FITNESS_EVIDENCE_VERSION;
  candidateId: string;                       // RepresentationCandidate id
  datasetFingerprint: string;
  source: 'measured' | 'prior';              // NEVER mixed silently — see §2.4
  /** measured fields; null when source === 'prior' */
  measured: {
    projectedOverlapFraction: number;        // screen-area overlap of marks, sampled envelope
    hiddenMarkFraction: number;              // marks outside frustum / behind nearer geometry
    medianProjectedGlyphSizePx: number;      // via computeScreenSpaceError-style projection
    labelCrowdingIndex: number;              // labels-per-screen-region density
    depthOrderAmbiguityFraction: number;     // near-tie depth-order swaps across envelope poses
    spatialExtentMeters: number;
    requiredViewpointTravelMeters: number;   // travel to bring median mark into legible range
    viewpointEnvelope: ViewpointSample[];    // bounded nearby-view poses (pose = pos+gaze hash)
    deviceClass: 'desktop' | 'quest-3s' | 'other-headset';
  } | null;
  /** engineering priors: candidate.interactionCharacteristics verbatim */
  priors: { occlusionResistance: number; cognitiveLoad: number };
  interactionSignals?: { airClickMissRate: number; dwellHesitationRate: number }; // UXFrustrationAnalyzer
}
```

### 2.3 Ranking integration (hard constraints still precede preference)

1. `checkHardConstraints` first — `maxOcclusionTolerance` becomes a real hard gate when measured `hiddenMarkFraction`/`projectedOverlapFraction` exceed it (information-loss CRITICAL goals already live there; this activates the dormant requirement field, doesn't add policy).
2. `BootstrapFitnessModel`: add seventh component `perceptualFitness` with weight in `BootstrapFitnessWeights` (rebalance existing weights so the sum stays 1 — weight values are a governed change, bump fit via the existing weights-validation at `FitnessModel.ts:71-86`; propose 0.10 carved from `configuredPrior` + `densityHandling`, recorded in PR).
3. `DecisionEvidenceItem[]` entries state `measured` vs `prior` explicitly per candidate (utility is never relabelled confidence — doc line 105).
4. When no measured evidence exists (current default), the component consumes `priors` with `source: 'prior'` — this *activates* the dormant `occlusionResistance`/`cognitiveLoad` fields as the programme item requires, without pretending measurement.
5. Provenance: `perceptualModelVersion: 'perceptual-fitness-v1'` in `DecisionProvenance`; learned-feature dimension (and `PAIRWISE_FEATURE_SCHEMA_VERSION` bump) is **deferred** until measured evidence demonstrates benefit — do not widen the learned schema on priors alone.

### 2.4 Sampler behaviour (bounded, cheap, non-blocking)

- Triggered on representation commit and on embodiment re-solve; samples the bounded viewpoint envelope: current pose + 8 deterministic offsets (±0.3 m lateral, ±0.15 m vertical, ±15° yaw around the analyst anchor — fixed set, recorded in `viewpointEnvelope`).
- Uses `LODManager.isInFrustum`/`computeScreenSpaceError` primitives; depth-order ambiguity via sorted-depth near-tie counting (threshold recorded). All measurement is **read-only over the scene graph** and runs in the render loop's existing per-tick slot budget — never spawns analysis.
- Stability requirement (doc line 103): a candidate's evidence is the aggregate over the envelope, not one privileged pose; single-pose measurements must not appear in `measured`.

---

## 3. P1-F design — SemanticTargetResolver + focus/context

### 3.1 Ownership

- **Resolver** (geometry/ranking/hysteresis, VR-layer): `src/vr/input/SemanticTargetResolver.ts`, staged between `PointerRegistry` rays and `InteractableRegistry.raycastScene`/`SelectionDispatcher.triggerSelect`.
- **Structure identity stays with Atlas**: resolution maps ray→candidate geometry→`DiscoveredStructure` via `structureId` handles (pattern: `VRCommandExecutor._resolveTargets`, `VRCommandExecutor.ts:134`), never by duplicating row logic in the input layer.
- **Focus/context policy**: new `src/vr/interactions/FocusContextController.ts` owns the investigation → dataset → structure → region/cluster → observation hierarchy transitions, consuming `LODManager.levelFor`, gaze cone, and the resolver's current semantic target.

### 3.2 Candidate model

```ts
export type SemanticTargetKind =
  | 'observation' | 'cluster-region' | 'mapper-node'
  | 'persistence-structure' | 'investigation-artifact' | 'command';

export interface RankedSemanticTarget {
  kind: SemanticTargetKind;
  entry: InteractableEntry;              // existing registry entry, unchanged shape
  structureId?: string;                  // Atlas DiscoveredStructure.id when kind is analytical
  score: number;                         // w_d·distance + w_s·salience + w_t·taskPrior + w_g·gaze
  confidence: number;                    // separate from score; drives hysteresis only
}
```

- Population sources: BVH-intersected near-hit set (geometric candidates), Atlas structures (`World.atlas` structure sets — mapper nodes, persistent components, clusters), investigation artefacts (data cards, TDA planes), and (phase 2) wheel command ids from `DEFAULT_CATEGORY_ACTIONS` ranked by `HandWheelCategorizer` state + `ProgressiveDisclosure` profile.
- Scoring weights `w_d` (ray-hit distance), `w_s` (salience: `LODManager.isInGaze` + size-in-view + dwell history), `w_t` (task/context prior from active wheel category/profile), `w_g` (gaze cone half-angle offset). Weights named consts, tuning is governed (study treatment!).
- **Semantic coercion rule**: within an assistance radius (default ~2 cm angular-equivalent at arm's length — calibrate on device), a *structure-level* target whose score exceeds the best *raw-observation* target by margin ε wins — imprecise intent resolves to the meaningful structure, not the lucky nearest triangle.

### 3.3 Hysteresis (stability, not cursor-snapping)

- Extend the existing pinch-lock slot, don't invent a second mechanism: `SelectionDispatcher.lockTargetForPinch` becomes one instance of a general `TargetHold` with: hold-until-dwell (current 1200 ms dwell contract reused), hysteresis margin (a new target must beat the held target's score by >1.5× for 3 consecutive frames), and a **manual-escape hatch**: precision input (desktop fine cursor, XR laser mode) bypasses assistance entirely (`assistanceEnabled` per-pointer flag; desktop sets it off by default → semantic-parity checkbox: assistance behaves identically where enabled).

### 3.4 Focus + context hierarchy

- Levels (doc line 145): investigation → dataset → structure → region/cluster → observation.
- Transitions: driven by distance-to-target band (reuse `LODManager` tier constants 1.2 m / 3.5 m as initial bands), gaze dwell on a semantic target, and explicit drill-down commands (existing wheel VIEW items `teleport-detail`/`overview` become hierarchy-level changes, not just locomotion).
- **Stable spatial identity**: structure-level landmarks keep their anchor transforms across resolution changes; observation reveal at the deepest level fades via the existing `LODManager.fadeFor` (102-107) machinery. Aggregate landmarks at distance = cluster volumes / Mapper node glyphs already embodied (`ScalableTopologyEmbodiment.ts:148`).
- **Reproducibility**: persist only semantically meaningful navigation state (current focus level + focused `structureId`) into session state **where required for investigation meaning** (doc line 149; default persists in `AtlasCoreState` only when a structure is focused — raw camera pose is not investigation semantics).

### 3.5 Wiring (minimal-touch)

- `InteractableEntry` gains optional `semantic?: { kind: SemanticTargetKind; structureId?: string }` (additive; populated by `TopologyLayoutEmbodiment`/`ScalableTopologyEmbodiment`/`InPlaceOperationHandles` at build time).
- `InputRouter.update`: after `raycastScene`, if `assistanceEnabled`, pass the raw hit + near-hit set through `SemanticTargetResolver.rank(...)`; `updateHover`/`triggerSelect` receive the resolved target. No change to the panel-first ordering — panels are not semantic targets.
- `DesktopControls`: identical flow via the same registry (parity is structural, not a duplicate implementation).

---

## 4. Test plan

### 4.1 P1-D (fast lane; measurement mocked at the sampler seam)

| # | Test | Assertion |
|---|---|---|
| D1 | contract versioning | `PERCEPTUAL_FITNESS_EVIDENCE_VERSION` present; schema validates; envelope round-trips through session JSON and `.nemosyne` export/import. |
| D2 | dormancy activation | With `source: 'prior'`, two candidates identical on all analytical dimensions but different `occlusionResistance`/`cognitiveLoad` rank differently; evidence items state `prior`. |
| D3 | measured beats prior, labelled | With sampled measured evidence, ranking uses measured values; `DecisionEvidenceItem[]` records `source: 'measured'`; priors remain visible. |
| D4 | hard-before-preference | `hiddenMarkFraction > maxOcclusionTolerance` → candidate infeasible regardless of perceptual score (hard gate runs first; trace recorded in `rulesEvaluated`). |
| D5 | envelope stability | Evidence generated at a single privileged pose is rejected by the sampler contract (requires full `viewpointEnvelope`); ranking is stable across the envelope. |
| D6 | weight integrity | `BootstrapFitnessWeights` still sums to 1 (existing validator); perceptual weight change is recorded with reason in the PR and in `MonetaExplainerPanel` copy sources if applicable. |
| D7 | provenance persistence | `perceptualModelVersion` survives `AtlasCoreState` serialize/restore and portable package round trip (`NemosynePackage` manifest validation untouched). |
| D8 | no-confidence-labelling | Source scan: perceptual code paths never write to confidence-labelled fields; evidence items carry `utility` vocabulary only. |
| D9 | device calibration lane | Sampler emits `deviceClass`; Quest 3S threshold calibration is recorded via `src/vr/scalability/Quest*` harness (evidence lane, not CI). |

### 4.2 P1-F (fast lane, jsdom + three.js scene fixtures)

| # | Test | Assertion |
|---|---|---|
| F1 | semantic preference | Ray graze near a Mapper-node glyph vs a closer observation point → resolver ranks structure first when within assistance radius; outside the radius, raw nearest hit wins unchanged. |
| F2 | hysteresis stability | Oscillating candidate scores (synthetic jitter) → held target does not flip until margin rule met; after 3-frame override, switches exactly once. |
| F3 | escape hatch | `assistanceEnabled=false` pointer (desktop default) → byte-identical behaviour to today's nearest-first picking (characterization test on `raycastScene` outputs). |
| F4 | structure identity | Resolved analytical target carries `structureId` matching `structureId(...)` recomputed from Atlas structures; handle-based resolution never reads rows in the input layer (source contract). |
| F5 | focus hierarchy | Distance-band + dwell transitions walk investigation→dataset→structure→observation exactly in order; reverse navigation stable; anchors unchanged across level transitions (transform equality). |
| F6 | desktop parity | Same synthetic scene: desktop pointer and XR pointer resolve equal semantic targets when assistance enabled. |
| F7 | persistence discipline | Session export contains focused `structureId`/level only when a structure was focused; camera pose never persisted. |
| F8 | regression guard | All existing `InputRouter`/`SelectionDispatcher`/`TooltipManager`/pinch-recoil (UX-002) tests pass unmodified with the resolver enabled and disabled. |

### 4.3 Study-treatment guard

| # | Check | Assertion |
|---|---|---|
| S1 | freeze manifest | If resolver assistance or perceptual ranking changes default runtime behaviour for study participants, the study freeze manifest (`feat/study` pattern, #394) must declare the delta **before merge**; default-config flag lets the study keep pre-change behaviour (`semanticAssistance.enabled: false`, perceptual ranking `source: 'prior'`-only mode). |

---

## 5. Implementation sequence (for the delegated agent)

1. Branch `feat/p1d-perceptual-fitness` off `main`: §2.2 contract + D1; then sampler (D5, D9); then ranking (D2-D4, D6, D8); then provenance (D7).
2. Branch `feat/p1f-semantic-resolution` off `main` (independent): semantic entry metadata + resolver + hysteresis (F1-F4, F8); then FocusContextController (F5-F7); S1 review with the study owner before enabling by default.
3. Both PRs carry research-review flags if defaults change (governing skill §24; the repo already treats panel-layout changes as controlled treatments).
4. Physical calibration (thresholds, assistance radius, occlusion tolerance values) lands only in the Quest 3S qualification lane — code must ship with explicit `UNCALIBRATED` markers where defaults are engineering estimates pending PERF-04/UX-03 evidence.
5. Gate per PR: `tsc --noEmit` → `eslint` 0 errors → `npm run test:all`; ROADMAP checkboxes update in the same PR.
