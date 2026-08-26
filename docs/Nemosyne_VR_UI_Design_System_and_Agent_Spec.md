# Nemosyne VR UI Design System & Technical Specification

**Status:** Normative design and implementation guide  
**Audience:** AI coding/design agents, VR/UI engineers, reviewers, researchers  
**Date:** 26 August 2026  
**Repository baseline:** `TsatsuAmable/nemosyne` `main` at `7caf490a190dfefbb18aa009bf481202f7fe1c8a`  
**Primary runtime target:** Meta Quest 3S-class standalone WebXR, with desktop semantic parity  
**Technology baseline:** Three.js + WebXR + Rust/WASM analytical authority  
**Normative vocabulary:** **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are requirements levels for implementation and review.

---

## Executive directive

Nemosyne is not a dashboard transplanted into a headset. It is a sparse spatial research instrument in which the dataset, its structure, the evidence supporting interpretations, and the path of investigation remain visually and semantically dominant.

The interface MUST therefore follow one governing rule:

> **Use spatial embodiment when space carries analytical meaning; use stable planar UI when the task requires precision, text, parameters, forms, or dense comparison.**

The resulting UI system combines three interaction primitives:

1. **Direct Touch** for nearby controls and short, concrete actions.
2. **Direct Grab / constrained manipulation** for physically meaningful spatial objects and movable surfaces.
3. **Distance Ray + commit** for content outside comfortable reach and for precise acquisition at distance.

All three resolve into the same Nemosyne semantic action model. Interaction modality MUST NOT determine analytical meaning.

The recommended presentation architecture is:

- native Three.js for spatial data representations, TechnoCore, Memory Palace topology, portals, beacons, direct manipulators, and other objects whose geometry carries meaning;
- `@pmndrs/uikit` as the default substrate for planar in-world UI, with `@pmndrs/uikit-horizon` used as a behavioral/component reference rather than a visual skin;
- a Nemosyne-owned near-field input layer connected to the existing `InputRouter`, not a wholesale migration to Meta IWSDK or another XR framework;
- Meta IWSDK, Meta Horizon OS UI, Apple visionOS, Microsoft MRTK, and empirical VR HCI research used as reference evidence for interaction behavior, ergonomics, targeting, panel placement, and comfort.

The existing Nemosyne 10-phase investigator journey remains the product-flow backbone:

`LOAD -> ORIENT -> EXPLORE/ASK -> MANIPULATE REPRESENTATION -> INSPECT STRUCTURE -> TEST/FALSIFY -> COMPARE -> CAPTURE FINDING -> NAVIGATE MEMORY PALACE -> SHARE/REPLAY`

---

# Part I - VR UI Best-Practice Study

## 1. Study scope and method

This study combines four evidence classes:

| Evidence class | Sources used | How it informs Nemosyne |
|---|---|---|
| Current platform design systems | Meta Horizon OS (2026), Apple visionOS HIG, Microsoft MRTK | Interaction conventions, target sizing, ergonomics, panel/window behavior, accessibility |
| Current WebXR/Three.js implementations | Three.js WebXR examples, `@pmndrs/uikit`, Meta Immersive Web SDK | Feasible implementation architecture for Nemosyne's web stack |
| Empirical XR/HCI research | IEEE TVCG VR menu comparison; arm-fatigue and cybersickness studies | Performance/usability trade-offs not captured by platform style guides |
| Nemosyne live code/docs | `InputRouter`, `WorldUIManager`, `HandWheelMenu`, `HolographicInspector`, panel layout decision, UX audit, load thresholds | Keeps recommendations compatible with the actual product and research constraints |

The study deliberately rejects two common shortcuts. First, it does not assume that “natural” hand input is always superior. Current Meta guidance explicitly notes that hand tracking does not replace controllers for all precision-heavy tasks [R8], and research shows sustained mid-air work creates measurable arm fatigue [R17-R19]. Second, it does not assume that immersive UI should maximize 3D. Apple’s visionOS guidance explicitly recommends the minimum level of immersion appropriate to the task and familiar windows for UI-centric work [R9].

## 2. Findings that should govern Nemosyne

### 2.1 Near/far continuity is now a mature platform convention

Meta’s 2026 input mapping model separates **targeting** from **selection**, then composes hold, one-point manipulation, two-point manipulation, and scrolling on top. Hands can target with a ray at distance or fingertip at close range; selection can be pinch, poke, or grab [R1]. Microsoft’s point-and-commit guidance similarly transitions automatically between near manipulation and rays at roughly arm’s length, turning rays off for close objects and restoring them at distance [R14].

**Nemosyne consequence:** modality switching MUST be automatic and proximity-based. The researcher should not enter a “touch mode” or “ray mode.”

### 2.2 Direct input is fast, but ray input remains a robust universal fallback

A 2024/2025 IEEE TVCG study surveyed 108 menus in 84 commercial VR applications and experimentally compared raycasting, direct input, and marking menus. Direct input was fastest for single-level menus; marking menus were fastest for hierarchical cases; raycasting was slower but received consistently high usability ratings [R16].

**Nemosyne consequence:** use direct interaction for small, nearby command sets; preserve ray interaction for every important action and for distance/precision. The constellation menu MAY use expert marking behavior later, but novice operation MUST remain explicit and visible.

### 2.3 Mid-air interaction has an ergonomic budget

MRTK recommends hand-attached menus only for quick actions because sustained raised-arm interaction causes fatigue [R12]. Recent research continues to confirm the “gorilla arm” effect and finds lowered, close-to-body interaction zones more comfortable [R18-R19]. Apple similarly advises supporting indirect gestures that can be used while hands rest in the lap or at the sides, and warns against extended direct gestures [R9].

**Nemosyne consequence:** direct touch is an accelerator for brief work, not the default posture for long analytical sessions. Long forms, reading, multistep parameter tuning, and dense comparison MUST be supported by stable body/world-locked panels and ray/controller operation.

### 2.4 Hit targets must be designed for the least precise supported modality

Meta recommends a 60 x 60 dp minimum for primary controls intended for hand tracking [R2] and at least 48 x 48 dp for button hit targets [R3]. Apple’s visionOS default control size is 60 x 60 pt and emphasizes spacing between controls [R10]. Microsoft recommends at least 3.2 x 3.2 cm for direct-interaction buttons at about 45 cm and at least a 1-degree visual angle for hand-ray/gaze targets at 2 m [R13].

**Nemosyne consequence:** primary near-touch controls MUST have a minimum visual footprint equivalent to approximately 32 mm square at the intended interaction distance, with a larger invisible hit volume. Far controls MUST preserve at least a 1-degree target angle, with 1.5-2 degrees preferred for primary actions.

### 2.5 Stable panels are the right tool for precision work

Apple recommends windows for familiar, UI-centric tasks and ornaments for controls associated with a window without crowding its content [R9, R11]. Microsoft Near Menu guidance uses a 30-60 cm range and supports pinning/grabbing to convert a follow surface into a stable world-locked work surface [R15]. Meta’s window model uses explicit grab, edge, resize, and control affordances [R7].

**Nemosyne consequence:** precision UI surfaces SHOULD behave like spatial instruments with stable placement, explicit movement affordances, predictable resizing, and a clean distinction between panel content and panel chrome.

### 2.6 “Hand attached” and “head locked” are specialized, not default, reference frames

MRTK recommends only a few quick-action buttons on hand menus and warns that complex hand-attached UI increases fatigue [R12]. Apple advises avoiding head-anchored content because it can feel confining and interfere with accessibility mechanisms [R10]. Meta warns against head-locked content in central/lower field of view when it can obscure hazards [R6].

**Nemosyne consequence:** persistent analytical UI MUST NOT be head locked. Hand attached is for summons, micro-controls, or very short interactions. Persistent panels remain body locked or user-pinned world locked.

### 2.7 Peripheral motion and camera motion deserve stricter controls than desktop UI

Apple warns that motion in peripheral vision can be especially uncomfortable and recommends lowering contrast/translucency for large moving content [R20]. Meta locomotion guidance favors teleport/snap techniques, reduced acceleration, and reduced optic flow [R5]. Research reviews identify peripheral flow and reference frames as major cybersickness variables [R21], while a 2025 TVCG study found a stable peripheral rest-frame technique reduced discomfort [R22].

**Nemosyne consequence:** UI animation MUST communicate state, not decorate the periphery. Camera-relative movement SHOULD be damped, not rigid. Large representation transitions MUST preserve a stable spatial reference and offer reduced-motion behavior.

### 2.8 Accessibility is multimodal equivalence, not merely larger text

Meta recommends designing hit targets for multiple modalities and supporting increased contrast/size [R2]. Apple emphasizes mobility, VoiceOver-like alternatives, sufficiently sized controls, and minimizing large repetitive gestures [R10].

**Nemosyne consequence:** no essential action may exist only as a custom gesture. Every essential action MUST have at least one low-fatigue alternative, and all semantic states MUST be distinguishable without color alone.

### 2.9 The WebXR ecosystem now supports a clean UI substrate without abandoning Three.js

`@pmndrs/uikit` now provides a vanilla Three.js core with Yoga/Flexbox layout, text, clipping, scrolling, world-space bounds, responsive sizing, theming, and W3C-compatible event hooks; the project recommends pairing it with a pointer-event system [R23]. Its Horizon kit provides pre-styled spatial components based on Reality Labs design conventions [R24]. Meta’s Immersive Web SDK demonstrates the same broad architectural pattern: Three.js world content, spatial UI, and unified browser/XR pointer semantics, with ray, poke, and grab interactions [R25-R27].

**Nemosyne consequence:** commodity planar UI SHOULD converge on UIKit rather than continuing to grow custom canvas/mesh panels. Nemosyne’s existing `InputRouter` remains the semantic and orchestration boundary.

---

# Part II - Nemosyne Interface Thesis

## 3. Product identity

### 3.1 The world is an instrument, not scenery

Every persistent spatial object MUST perform at least one of these jobs:

- orient the researcher;
- operate on the investigation;
- explain reasoning, uncertainty, provenance, or state;
- remember a finding, branch, or frozen state;
- navigate between meaningful contexts;
- coordinate collaborators;
- protect comfort or safety.

Decorative objects that perform none of these jobs MUST be removed.

### 3.2 Data owns the visual contrast budget

The dataset and active evidence are the visual protagonist. UI defaults to low-contrast, thin, peripheral, and quiet. It becomes brighter, deeper, or more opaque only when focused or semantically urgent.

Review heuristic:

| Attention budget | Intended content |
|---|---|
| ~70% | Dataset, active representation, selected evidence, comparison geometry |
| ~20% | Current task controls, active inspector, explanation or challenge surface |
| ~10% | Orientation, presence, system status, environmental depth cues |

These are not pixel quotas. They are a design-review question: **is the interface stealing attention from the evidence?**

### 3.3 Spatiality must earn its keep

Use 3D embodiment for structure, topology, relationships, focus/context, comparison, spatial history, hypothesis branching, collaborative reference, and direct manipulation whose motion has semantic meaning.

Use planar UI for exact text, numerical entry, tables, dense statistics, configuration, export, forms, long explanations, logs, provenance listings, and accessibility settings.

### 3.4 Epistemic clarity outranks spectacle

The interface MUST distinguish the following states, and MUST NOT collapse them into one “confidence” color, glow, or score:

- model recommendation;
- researcher preference;
- attention/salience;
- statistical evidence;
- robustness/stability;
- cross-investigation recurrence; and, separately, validation status.

---

# Part III - Canonical Investigator Flow

## 4. The 10-phase journey

The existing accepted Nemosyne journey remains normative. The new UI system specifies the visible state, interaction surface, and exit condition for each phase.

### Phase 1 - LOAD

**Goal:** enter a dataset without confronting the researcher with an instrument panel.

**Initial view:** sparse datum plane, subdued TechnoCore landmark, one compact import surface in the primary comfortable zone.

**UI:**

- source picker / drag-drop / recent investigation as a stable planar surface;
- dataset identity, row/column count, topology inference state, and resource-envelope warnings;
- one primary action: **Open investigation**;
- secondary actions: inspect schema, choose sample, cancel.

**Interaction:** ray/mouse is universal; direct touch is available at near distance. File entry and dense schema mapping remain planar.

**Transition:** once analytical preflight succeeds, the load surface fades and the representation materializes around a preserved world origin. If preflight fails, do not create a deceptive partial world. Explain the resource or validity boundary.

### Phase 2 - ORIENT

**Goal:** establish “where am I, what am I looking at, and what does space mean?”

The dataset becomes the dominant object. Datum Plane provides horizon, origin, scale, and home. A short context card appears near the dataset, not in front of the face:

- representation name;
- dimensions/encodings;
- Moneta state: selected / ambiguous / infeasible / fallback;
- one-line explanation;
- optional **Explain** action.

A first-session user receives no gesture lecture. The system teaches only focus, select, grab, command, undo/return, and move.

### Phase 3 - EXPLORE / ASK

**Goal:** form intent without navigating subsystem names.

Focusing a structure exposes a **Contextual Task Surface** with only actions meaningful for that scope. Example for a cluster:

`Inspect | Isolate | Compare | Challenge stability | Annotate | Explain`

The command constellation provides task verbs, not architecture nouns. Top-level novice categories are:

`Inspect | Compare | Challenge | Record | Navigate | More`

Natural-language query, advanced search, or expression input opens a planar input surface. Voice MAY accelerate text entry but is not required.

### Phase 4 - MANIPULATE REPRESENTATION

**Goal:** alter representation without losing orientation or confusing representation changes with analytical changes.

The researcher may:

- ask Moneta for an alternative;
- touch/select a candidate representation card;
- preview ghost geometry before commit;
- directly manipulate scale/rotation when the change is merely spatial presentation;
- use explicit handles for parameters whose geometry has an obvious physical mapping.

Representation changes MUST preview before commit and MUST preserve selected semantic identities where possible. The UI must label whether the action changes **analysis**, **representation**, **view**, or **navigation**.

### Phase 5 - INSPECT STRUCTURE

**Goal:** move from whole-dataset structure to local evidence.

Selecting a node/cluster/region opens a redesigned **Holographic Inspector** near the active interaction zone. It is a UIKit precision surface, not a static canvas texture.

Inspector anatomy:

- compact identity header;
- exact values and units;
- structural membership;
- provenance/evidence summary;
- tabs or segmented switch: `Values | Evidence | Provenance`;
- actions: `Compare`, `Challenge`, `Annotate`.

The inspector follows briefly, then stabilizes. It MUST be grabbable and pinnable for extended reading. Dismiss through explicit close, return, or deliberate throw-away gesture only if that gesture is discoverable; accidental look-away MUST NOT destroy analytical context.

### Phase 6 - TEST / FALSIFY

**Goal:** make skepticism easy.

Every interesting pattern should expose a **Challenge** path. Challenge opens an epistemic instrument surface with appropriate actions such as:

- perturb/resample;
- alternative distance/measurement treatment;
- counterexample search;
- holdout or sensitivity check;
- anomaly re-evaluation;
- compare null/alternative explanation;
- show assumptions and invalidity warnings.

Compute-intensive actions show a compact, anchored progress affordance with cancellation where safe. Progress animation MUST NOT pulse through the whole world.

The resulting state MUST distinguish support, refutation, inconclusive, infeasible, and invalid test conditions.

### Phase 7 - COMPARE

**Goal:** compare alternatives without destroying spatial memory.

Default compare layout: paired or layered representations share the same semantic anchors. Use spatial separation only when it clarifies the comparison. The researcher can switch between:

- side-by-side spatial frames;
- ghost overlay;
- synchronized focus + local difference surface;
- branch-to-branch evidence table.

A small comparison ornament stays associated with the compared representations and contains `A/B`, `Overlay`, `Differences`, and `Return` controls. Avoid a new global dashboard.

### Phase 8 - CAPTURE FINDING

**Goal:** convert an observation into a reproducible investigation object.

Selecting **Record** creates a beacon at the evidence locus and opens a short structured form:

- observation / question / hypothesis / finding / contradiction;
- concise researcher note;
- selected evidence references;
- status: provisional / supported / refuted / inconclusive;
- branch and representation fingerprints automatically attached.

The system must not imply scientific validation merely because a beacon was recorded.

### Phase 9 - NAVIGATE MEMORY PALACE

**Goal:** make investigation history and reasoning spatially inspectable.

The Memory Palace is the graph projection of the investigation, not a decorative alternate realm. Its nodes include observations, questions, hypotheses, tests, findings, branch points, frozen states, and collaborators. Edges encode reasoning/provenance relationships.

Focus one node to reveal local neighboring reasoning paths. Threads remain muted until relevant to avoid spaghetti. Spatial position is a projection and MUST NOT replace canonical semantic identity.

TechnoCore is the analytical instrument for asking: “How is Nemosyne seeing this?” It exposes representation rationale, stability, alternatives, and provenance. It MUST NOT become a generic settings sphere.

### Phase 10 - SHARE / REPLAY

**Goal:** leave with reproducible work rather than a screenshot of a compelling pattern.

The Evidence/Ice Vault is the spatial metaphor for frozen, reproducible states. Opening it summons a stable export/replay panel:

- investigation fingerprint;
- branch and model versions;
- freeze status;
- `.nemosyne` package export/import;
- deterministic replay verification;
- comparison with frozen prior state.

The Vault represents immutability and return, not “security theater.”

---

# Part IV - Spatial UI System

## 5. Reference-frame taxonomy

Every UI component MUST declare one reference frame.

| Frame | Meaning | Use |
|---|---|---|
| `WORLD_LOCKED` | Stable in the investigation/world | Dataset, TechnoCore landmark, pinned panels, portals |
| `INVESTIGATION_FRAME` | Stable relative to investigation topology | Memory Palace graph, findings, reasoning threads |
| `BODY_LOCKED` | Follows torso orientation with damping | Persistent personal work panels, command surface anchor |
| `HAND_ATTACHED` | Attached to a hand | brief summons, micro-controls, tooltips, expert accelerators |
| `OBJECT_ATTACHED` | Attached to semantic object | contextual handles, beacons, local task surface |
| `HEAD_LOCKED_TRANSIENT` | Guaranteed visibility only | critical comfort/system alert, never routine analytical UI |

Persistent analytical panels MUST use `BODY_LOCKED` by default and MAY become `WORLD_LOCKED` when grabbed/pinned. This agrees with the current Nemosyne panel-layout decision that consolidated persistent panels into the damped torso anchor.

Reference-frame transitions MUST animate with continuity. A panel may tear away from the body anchor into world space only if the user can visually follow its motion.

## 6. Comfortable spatial zones

Nemosyne uses zones based on reach, visual angle, fatigue research, and the project’s existing body-locked layout.

| Zone | Approx. distance | Purpose | Rules |
|---|---:|---|---|
| Micro / hand | 0.25-0.45 m | brief hand summons, tooltips | seconds, not minutes |
| Near touch | 0.45-0.70 m | direct-touch controls, compact inspector | primary poke/touch zone |
| Primary work | 0.70-1.20 m | reading, settings, evidence panels | body locked or pinned; ray + touch near edge |
| Reference | 1.20-1.80 m | secondary status, occasional comparison | ray-first; subordinate contrast |
| Data field | ~2-8 m, representation dependent | dataset structures and analytical spatial context | no generic panels embedded here |

Distance values are defaults, not immutable constants. The runtime SHOULD scale UI to preserve angular legibility and accommodate seated/standing users.

## 7. The modality resolver

### 7.1 Priority

When modalities compete for the same target, resolve in this order:

`captured manipulation > direct touch > direct grab > controller-tip direct > distance ray > mouse > dwell fallback`

A target already captured by a drag/manipulation retains capture until commit/cancel.

### 7.2 Near/far switching

- Enter near-interaction eligibility when fingertip/controller tip is within **0.55 m** of an interactable surface or the target’s configured near envelope.
- Fade/suppress the corresponding far ray as near interaction becomes unambiguous.
- Restore the ray smoothly after leaving the near envelope.
- Use hysteresis so the ray does not flicker around the threshold.
- Never make the user choose the interaction mode explicitly.

### 7.3 Touch state machine

`FAR -> NEAR_HOVER -> CONTACT -> PRESS -> COMMIT -> RELEASE -> RECOVER`

Alternative paths:

- `CONTACT -> DRAG -> RELEASE/COMMIT`
- any pre-commit state -> `CANCEL`

Commit SHOULD occur on threshold/release, not first collision, to preserve a cancellation window.

Recommended direct-touch behavior:

- reserve the index fingertip as the precision poke point when possible;
- use an invisible interaction volume larger than the rendered button;
- show proximity before contact;
- show contact depth or compression during press;
- provide visual plus optional audio/haptic confirmation;
- do not require simulated force.

### 7.4 Ray behavior

Ray is for beyond-reach selection and precision acquisition. The ray SHOULD:

- shorten to the first eligible UI/data hit;
- use mild smoothing at low speed and reduced smoothing at high angular velocity;
- expose hover before commit;
- use conecast/semantic coercion for dense data when appropriate;
- preserve an explicit precision escape hatch to select a raw observation.

Nemosyne’s current `PointerRayFilter`, semantic target resolver, and `InputRouter` architecture should be retained and extended rather than replaced.

### 7.5 Grab behavior

Use grab only when the object is conceptually manipulable. Grabbable panels use a dedicated grab rail/edge, not the entire content surface. Data manipulation handles MUST constrain movement to the meaningful degree of freedom whenever possible.

Examples:

- time slice plane: 1D constrained travel;
- threshold handle: 1D slider;
- panel: 6DoF move with orientation constraints;
- dataset scale: two-hand uniform scale, not arbitrary shearing;
- TechnoCore ring: constrained rotational parameter.

## 8. Gesture policy

Custom gestures are accelerators, never prerequisites.

The existing broad gesture vocabulary SHOULD be reduced over time. Replace memorized gestures with visible manipulators where a direct physical mapping exists:

| Existing accelerator | Preferred novice interaction |
|---|---|
| `sliceUp` / `sliceDown` | grab and move time-slice plane |
| `pinchTogether` / `pinchApart` | manipulate visible filter/aggregation handles |
| rotate gesture for undo/redo | explicit Undo/Redo + optional gesture accelerator |
| settings gesture | command surface -> Settings |
| `scoopUp` statistical lens | TechnoCore / Challenge / Explain surface |

A gesture MAY remain if it is reliable, comfortable, intuitive, has a visible teachable analogue, and its accidental activation cost is low.

---

# Part V - Visual Design Language

## 9. Aesthetic thesis: sparse analytical cyberspace

Nemosyne should feel precise, quiet, spatial, and computational without adopting generic cyberpunk clutter.

The world background is near-black rather than pure black, with subtle depth cues. UI surfaces are dark neutral instruments with limited translucency. Data receives saturated semantic color; UI uses a restrained interaction palette.

No decorative pipes, floating glyph rain, ornamental machinery, or gratuitous bloom. Every persistent glow MUST indicate focus, state, activity, identity, or depth.

## 10. Core color tokens

These are starting tokens. They MUST be validated in-headset and adjusted for actual display behavior.

| Token | Value | Use |
|---|---|---|
| `space.void` | `#05070B` | world background |
| `surface.base` | `#0B1119` | primary panel |
| `surface.raised` | `#111A24` | active/raised surface |
| `surface.border` | `#263544` | quiet separation |
| `text.primary` | `#F2F6FA` | primary text |
| `text.secondary` | `#A9B8C6` | secondary labels |
| `text.muted` | `#718394` | inactive/meta text |
| `interaction.focus` | `#59D6FF` | focus/hover/active interaction |
| `interaction.commit` | `#8CE6C1` | successful committed interaction, not scientific truth |
| `epistemic.uncertain` | `#FFC46B` | ambiguity/inconclusive state |
| `epistemic.contradiction` | `#FF7AAE` | contradiction/counterevidence |
| `danger.destructive` | `#FF6464` | destructive system action only |
| `status.verified` | `#71D99B` | verified replay/integrity state, with icon/text |

Rules:

- Data encodings MUST NOT be forced into this UI palette.
- Red is reserved for destructive actions/errors, not “low confidence.”
- Green MAY indicate integrity/verification but MUST include a non-color cue.
- Uncertainty MUST use text/icon/shape in addition to color.
- UI glow radius/intensity MUST remain lower than active data highlight except for critical system state.

## 11. Surface and depth tokens

| Token | Default | Rule |
|---|---:|---|
| Panel opacity | 0.90-0.96 | avoid transparent glass that harms legibility |
| Inactive panel opacity | 0.72-0.84 | subordinate without disappearing |
| Border width | 1-2 UI px equivalent | subtle edge definition |
| Corner radius | 12-20 UI px equivalent | calm, not bubbly |
| Raised control depth | 4-10 mm virtual | enough to communicate pressability |
| Press travel | 3-8 mm virtual | tactile-looking, not toy-like |
| Ornament z offset | 8-20 mm | visibly associated with parent panel |
| Data/UI minimum separation | >= 30 mm near surfaces | avoid z ambiguity and accidental selection |

Do not use fully transparent backplates behind dense text. Microsoft’s holographic UI research found shared opaque backplates improve grouping and interaction legibility [R13].

## 12. Typography

Typography must remain readable at varying distance and angle. Research shows large rotations sharply increase required text size [R28]. Therefore:

- primary reading surfaces SHOULD face within 30 degrees of the user when opened;
- do not require reading text beyond 45 degrees off-normal;
- dynamically simplify distant surfaces rather than merely shrinking them;
- use a modern sans-serif with strong x-height and distinct glyphs;
- use numeric tabular figures for statistical readouts;
- avoid ultralight weights.

Recommended UI scale at the standard primary-work distance:

| Role | Size token | Intended use |
|---|---:|---|
| `display` | 34-40 | major panel/phase title, rare |
| `title` | 26-30 | panel title |
| `heading` | 21-24 | section heading |
| `body` | 17-20 | main reading text |
| `label` | 15-17 | buttons, fields |
| `meta` | 13-15 | provenance metadata; never critical-only |

The renderer SHOULD preserve angular legibility by distance. Text SHOULD NOT be displayed at `meta` scale when the surface is in the reference/far zone.

## 13. Spacing and layout

Use an 8-unit base spacing grid inside UIKit surfaces:

`4, 8, 12, 16, 24, 32, 48, 64`

Primary buttons SHOULD have centers at least one full target pitch apart. For direct-touch dense controls, visual spacing MAY be smaller than hit-volume spacing, but hit volumes MUST NOT overlap ambiguously.

Panel internal layout:

- 24-32 units outer padding;
- 16-24 units between major regions;
- 12-16 units between label/control pairs;
- one dominant primary action per modal/task surface;
- no more than 2 hierarchy levels visible without scrolling or progressive disclosure.

## 14. Motion

Motion exists for continuity, feedback, causality, and orientation.

Default duration bands:

| Motion | Duration |
|---|---:|
| hover/focus | 80-140 ms |
| press/release | 60-120 ms |
| panel summon/dismiss | 140-220 ms |
| body-lock catch-up | critically damped, ~250-500 ms perceptual settling |
| representation morph | 300-800 ms depending on spatial extent |
| navigation transition | comfort-specific; teleport/snap preferred |

Motion rules:

- avoid decorative perpetual animation in peripheral UI;
- do not scale large world objects through the user;
- do not animate head-locked UI during locomotion;
- offer reduced-motion behavior that replaces morphs with fades/cuts while preserving semantic continuity;
- preserve a stable datum/reference during major representation changes.

---

# Part VI - Component System

## 15. Component architecture

### 15.1 `SpatialPanel`

Default implementation substrate: `@pmndrs/uikit`.

Required properties:

- declared reference frame;
- semantic panel role: `TASK`, `INSPECTOR`, `REFERENCE`, `SYSTEM`, `DIAGNOSTIC`, `DIALOG`;
- preferred size and min/max angular/physical size;
- grab rail;
- optional pin/unpin;
- optional resize bounds;
- explicit close/back behavior;
- input mode independent event handlers;
- focus/active/inactive visual states;
- accessibility metadata.

A panel MUST NOT be movable by dragging arbitrary content. Movement begins from grab affordances or edges.

### 15.2 Buttons

Variants:

- Primary: one per view/task surface maximum.
- Secondary: supporting action.
- Borderless: low-emphasis action, especially ornaments.
- Destructive: destructive operation only.
- Toggle/selector: persistent state, never styled like a one-shot action.

Primary direct-touch button target:

- visual face: >= 32 mm equivalent at intended touch distance;
- hit volume: larger than face and non-overlapping;
- far-ray angular target: >= 1 degree, preferably 1.5-2 degrees;
- clear default, proximity/hover, contact/pressed, committed, disabled states.

### 15.3 Sliders and continuous parameters

Sliders MUST show:

- current value;
- units;
- min/max or semantic domain;
- coarse direct manipulation;
- precision adjustment option;
- snap points when scientifically meaningful;
- reset to authoritative/default value.

Do not map a scientifically discontinuous parameter onto an apparently continuous slider.

### 15.4 Tooltip / context label

Tooltips identify or briefly explain. They MUST NOT contain workflow-critical content.

- appear after brief stable focus, not immediately on every sweep;
- offset away from finger occlusion;
- dismiss automatically;
- do not require interaction.

### 15.5 Contextual Task Surface

This is the primary replacement for subsystem-driven menus.

It is object-attached or adjacent to current focus and contains at most 4-6 immediately relevant actions. It SHOULD reuse the same action ordering across object types when semantics match.

### 15.6 Command Constellation

The existing `HandWheelMenu` evolves into a compact task constellation.

Novice top level:

`Inspect | Compare | Challenge | Record | Navigate | More`

Rules:

- hidden when not invoked;
- body locked, not rigidly wrist locked;
- reachable in a lowered comfortable posture;
- 6 primary nodes maximum;
- direct touch supported when near;
- ray supported universally;
- expert marking trajectories MAY become accelerators after learned use;
- architecture names such as Atlas, Moneta, TDA, Ops MUST NOT be novice top-level categories.

### 15.7 Holographic Inspector

Replace canvas-drawn presentation with a UIKit surface. Preserve the existing world-space, hand-near summon behavior but change persistence semantics:

- summon near active hand or selected object;
- stabilize after 300-500 ms rather than endlessly following;
- explicit pin/grab;
- explicit close;
- content scroll for dense details;
- compact default; expand on request;
- no additive-blended low-contrast text background.

### 15.8 TechnoCore

TechnoCore is a spatial epistemic instrument with four principal lenses:

1. **Representation** - current Moneta decision and plausible alternatives.
2. **Stability** - perturbation/sensitivity evidence.
3. **Provenance** - model version, artifact hash, analytical path.
4. **Challenge** - falsification/counterexample tools.

The object itself provides coarse selection/manipulation. Precision details unfold as nearby UIKit surfaces. TechnoCore MUST NOT expose generic settings, telemetry, network status, or unrelated developer controls.

### 15.9 Memory Palace node

Node shapes communicate lifecycle/type, not subjective importance. On focus, show only immediate graph neighbors and reasoning relationship labels. Selecting a node may navigate the researcher to the corresponding evidence context while preserving a return path.

### 15.10 Beacon

Beacon types:

- observation;
- question;
- hypothesis;
- finding;
- contradiction;
- frozen state.

Beacon state MUST be encoded by geometry/icon + label, not color alone.

### 15.11 Reasoning thread

Threads are normally thin and low contrast. They brighten on focus/path tracing. Avoid always-on graph spaghetti. Directionality SHOULD be visible when semantically meaningful.

### 15.12 Evidence / Ice Vault

A functional archive/replay instrument. Opens a precision panel for frozen states and package operations. Must display immutability/replay semantics, not faux security visuals.

### 15.13 Farcaster portal

Portals represent **travel/context change**, not ordinary commands. A portal must preview destination/context before entry. Analytical operations such as “run anomaly detection” MUST NOT be portals unless the operation genuinely creates/navigates to a distinct investigation context.

### 15.14 System status strip

Quiet body-locked status with only essential global facts:

- dataset/investigation identity;
- branch;
- unsaved/freeze state;
- compute activity/error;
- collaboration presence summary.

Do not turn this into a telemetry HUD.

### 15.15 Dialogs

Use only for transactional blocking decisions: destructive reset, unsafe discard, import conflicts, permission/connection errors. Dialogs must state consequence and reversibility. One primary action only.

---

# Part VII - Information Architecture and Panel Policy

## 16. Panel roles

The current repository has many bespoke panels. The target design reduces surface count by role consolidation.

| Current concept | Target treatment |
|---|---|
| `SettingsPanel` | UIKit Settings work panel |
| `VRMenu` | retire as primary navigation; actions migrate to contextual surface + constellation |
| `VRConsole` | developer-only diagnostic panel |
| `InputTelemetry` | developer-only diagnostic panel |
| `TelemetryPanel` | developer/research diagnostic panel |
| `PerformancePanel` | developer/research diagnostic panel |
| `NetworkPanel` | collaboration settings/reference panel, hidden by default |
| `OperationLogPanel` | provenance/history view under Evidence/History |
| `RecommendationPanel` | Moneta Representation lens surface |
| `DracoExplainerPanel` | rename/migrate into TechnoCore Representation/Provenance lens |
| `GestureConfidenceHUD` | diagnostic only; no persistent analyst HUD |
| `NarrativeStrip` | context card/status projection, not permanent strip |
| `InteractionCoach` | just-in-time teaching, transient |
| `SchemaMappingPanel` | load/setup precision panel |
| `LoadTestPanel` | developer/research mode only |
| `MiniOverview` | optional orientation instrument, subdued |
| `PeerPresenceHUD` | optional collaboration ornament/status |
| `DashboardManager` | remove as default “panel wall”; retain only if a specific evidence-comparison task requires a structured multi-panel workspace |

### 16.1 Persistent panel limit

Normal analyst mode SHOULD show no more than:

- one primary work panel;
- one inspector/context panel;
- one secondary reference surface.

Opening a fourth surface SHOULD either replace/consolidate a lower-priority surface or require explicit pinning.

### 16.2 Panel placement

Default persistent panels are body locked to the damped analyst/torso anchor. When grabbed and released, they become world locked until the user chooses Follow/Return.

Panels SHOULD open near the user’s current central working region, not at a fixed world origin. Placement must avoid overlapping the focused dataset feature.

### 16.3 Panel chrome

Chrome is minimal and appears on hover/proximity:

- grab rail centered below or on a side edge;
- pin/follow;
- close/back;
- resize only where content genuinely benefits from resizing.

This borrows the ergonomic principle of Meta’s window controls and Apple ornaments without visually cloning either platform.

---

# Part VIII - Direct Touch Specification

## 17. Near-field interactor

Add a Nemosyne-owned `NearFieldInteractor` rather than importing an entire XR framework.

Suggested modules:

```text
src/vr/interactions/near/
  NearFieldInteractor.ts
  FingerTipTracker.ts
  TouchTarget.ts
  TouchHitTester.ts
  TouchStateMachine.ts
  TouchFeedback.ts
  TouchCapture.ts
```

Inputs:

- index fingertip joint pose;
- optional thumb/palm/wrist joints;
- controller tip pose for controller-direct equivalence;
- target collider/plane;
- target interaction policy.

Outputs are modality-neutral interaction events:

```ts
type SpatialPointerEvent = {
  modality: 'touch' | 'ray' | 'grab' | 'mouse' | 'controller-tip';
  phase: 'proximity' | 'hover' | 'press' | 'move' | 'commit' | 'release' | 'cancel';
  targetId: string;
  worldPoint: [number, number, number];
  worldNormal?: [number, number, number];
  hand?: 'left' | 'right';
  pointerId: string;
};
```

These events feed the existing input/state machinery and then Nemosyne semantic actions. A direct-touch button MUST NOT call a Rust analytical operation itself.

## 18. Collision and occlusion rules

- Touch target collision is slightly larger than visible geometry.
- When touching a panel, scene selection behind the panel is suppressed.
- Near-field selection wins over distance ray for the same hand.
- The far ray fades before fingertip contact to avoid double affordances.
- Touching one target must not activate neighbors due to overlapping hit slop.
- Precision handles may temporarily magnify or offset feedback away from fingertip occlusion.

## 19. Touch feedback

Required feedback sequence:

1. **Proximity:** subtle edge/face response.
2. **Contact:** shallow physical depression or luminance change.
3. **Threshold:** committed state cue.
4. **Release:** recovery plus optional click/haptic/audio.

No global particle burst. No excessive bloom. Feedback belongs to the touched object.

---

# Part IX - Desktop and Multimodal Parity

## 20. Semantic parity contract

Every essential XR action MUST have a desktop equivalent. “Equivalent” means same semantic action and resulting investigation state, not identical motor behavior.

| Semantic action | Hand | Controller | Desktop |
|---|---|---|---|
| Focus | point / proximity | ray hover | mouse hover |
| Select | poke / pinch | trigger | click |
| Grab panel | pinch grab rail | grip/trigger drag | drag title/grab rail |
| Manipulate parameter | direct handle | ray/trigger drag | mouse drag / keyboard fine adjust |
| Command | summon constellation | controller shortcut | context menu / shortcut |
| Undo | menu / optional gesture | button/menu | Ctrl/Cmd+Z |
| Move | physical/teleport | teleport/thumbstick | keyboard/orbit/first person per mode |
| Annotate text | keyboard/voice | system keyboard/voice | physical keyboard |

NIL / investigation command semantics remain authoritative across modalities.

---

# Part X - Accessibility, Comfort, and Safety

## 21. Accessibility requirements

The UI MUST provide:

- global UI scale presets at minimum 1.0x, 1.25x, 1.5x;
- high-contrast mode;
- color-vision-safe semantic redundancy;
- reduced motion;
- controller-first and hand-first operation;
- one-handed completion of core workflows where feasible;
- dwell/head-gaze fallback for essential selection where platform support permits;
- captions/text alternatives for meaningful audio cues;
- no essential gesture-only actions;
- remappable expert shortcuts where possible.

The UI SHOULD expose a “comfort and accessibility” setup during first-run calibration without forcing a tutorial.

## 22. Physical comfort

- Avoid requiring arms above shoulder level.
- Prefer interaction between upper waist and lower chest for sustained work.
- Hand-attached menus are brief.
- Long reading is on stabilized panels.
- Bring UI to the user; do not require leaning/reaching for routine actions.
- Support seated and standing operation.
- Provide recenter/home at all times.
- Do not require frequent 180-degree head turns for core workflow.

## 23. Locomotion and visual comfort

Default locomotion:

- teleport for translation;
- snap turn for rotation;
- smooth motion opt-in;
- optional comfort vignette for smooth movement;
- stable Datum Plane/reference cues during motion.

Large data transitions SHOULD morph only where correspondence is meaningful; otherwise fade/cross-dissolve while preserving anchors. Reduced-motion mode uses cuts/fades.

---

# Part XI - Epistemic UI Rules

## 24. Recommendation display

Moneta recommendations MUST expose at least:

- proposed representation;
- reason/rationale summary;
- alternatives considered;
- model/artifact version identity;
- ambiguity/infeasible state;
- stability evidence when available.

Never present a recommendation as a truth claim. Use language such as **Recommended representation**, not **Correct representation**.

## 25. Uncertainty and ambiguity

States are explicit:

- `SUPPORTED`
- `REFUTED`
- `INCONCLUSIVE`
- `AMBIGUOUS`
- `UNDERDETERMINED`
- `INFEASIBLE`
- `INVALID_ASSUMPTIONS`
- `UNVERIFIED`

The UI MUST NOT map all non-success states to generic warning yellow.

## 26. Provenance

Every meaningful representation/test/finding surface SHOULD make provenance reachable in one action. Provenance detail is progressive:

- Level 1: “why this / where from?” concise explanation;
- Level 2: model, data, operation, branch, and version identifiers;
- Level 3: full reproducibility and replay details.

## 27. Reversibility

Preview before consequential action. Undo/return is part of the primary interaction grammar.

The UI MUST distinguish:

- reversible view change;
- reversible representation change;
- branch-producing analytical action;
- destructive reset/discard;
- immutable freeze/export.

---

# Part XII - Performance and Rendering Specification

## 28. Quest frame budget

The current Nemosyne load harness treats Quest 3/3S 72 Hz as the default baseline and grades p95 frame time <= 13.33 ms as green, 16.67 ms as the yellow floor, with p99 > 33 ms considered visible stutter territory. The UI system MUST fit inside this existing budget rather than creating a separate “UI performance” excuse.

UI performance rules:

- avoid per-panel canvas redraw each frame;
- reuse geometry/materials and glyph atlases;
- prefer instanced/batched UI substrate;
- lazy-create diagnostic surfaces;
- update text/layout only on state change where possible;
- cull hidden and clipped surfaces;
- avoid dozens of independent transparent planes;
- avoid high-frequency allocations in input hit testing;
- measure on Quest 3S hardware, not desktop only.

`@pmndrs/uikit` is preferred partly because it centralizes layout/text behavior and exposes culling/clipping/scrolling primitives rather than encouraging a bespoke mesh for every cell.

## 29. Rendering order and depth

Current bespoke panels frequently use `depthTest:false`, which can create perceptual read-through and ambiguous figure/ground when surfaces overlap. The target system SHOULD use correct spatial depth wherever possible.

Exceptions:

- transient system alert may render over world content;
- near-touch panel content may use controlled ordering inside its own surface;
- labels may use tiny depth bias to prevent z-fighting.

Do not solve panel collisions by disabling depth globally.

---

# Part XIII - Implementation Architecture

## 30. Target software architecture

```text
WebXR / Desktop Devices
        |
        v
PointerRegistry / XRHand tracking
        |
        +-----------------------+
        |                       |
        v                       v
NearFieldInteractor        FarField/Ray path
        |                       |
        +----------+------------+
                   v
          PointerEventMachine
                   |
                   v
             InputRouter
                   |
       +-----------+-----------+
       |                       |
       v                       v
UIKit event adapter       Spatial object adapter
       |                       |
       v                       v
Planar UI components      Three.js instruments
       |                       |
       +-----------+-----------+
                   v
          Semantic action / NIL
                   |
                   v
       Atlas / Moneta / Rust-WASM
```

### 30.1 Authority boundaries

- Rust/WASM remains analytical authority.
- Atlas/investigation layer remains investigation state/provenance authority.
- `InputRouter` remains input orchestration authority.
- UIKit owns planar layout/render presentation only.
- Three.js owns spatial scene representation.
- No UI component keeps a parallel analytical model.

### 30.2 Dependency recommendation

Evaluate adding:

```text
@pmndrs/uikit
@pmndrs/uikit-horizon     # component behavior/reference, selectively wrapped/skinned
@pmndrs/pointer-events    # evaluate; adapter may be preferable to preserve InputRouter authority
```

Do **not** migrate Nemosyne wholesale to React Three Fiber or IWSDK solely to obtain UI. Do **not** allow UIKit or pointer-events to become a second semantic input authority.

### 30.3 UIKit wrapper layer

Create a Nemosyne-owned wrapper package/folder:

```text
src/vr/ui-system/
  tokens.ts
  theme.ts
  SpatialUIRoot.ts
  SpatialPanel.ts
  controls/
    Button.ts
    Toggle.ts
    Slider.ts
    SegmentedControl.ts
    ScrollView.ts
    TextField.ts
  surfaces/
    InspectorSurface.ts
    ContextTaskSurface.ts
    EvidenceSurface.ts
    MonetaSurface.ts
    SettingsSurface.ts
  interaction/
    UIKitPointerAdapter.ts
    FocusStateAdapter.ts
  accessibility/
    UIScaleController.ts
    ContrastController.ts
```

All Nemosyne-specific semantics stay outside generic controls.

## 31. Migration order

### Stage A - prove interaction substrate

Implement one UIKit button panel supporting mouse, controller ray, hand ray, and direct fingertip touch through the existing `InputRouter`. Prove hover/press/release/cancel and interaction priority.

### Stage B - Holographic Inspector

Migrate inspector first because it is high-value and exposes text/layout/scroll/touch requirements without threatening global navigation.

### Stage C - Settings and import/schema surfaces

Move commodity precision UI into UIKit.

### Stage D - Contextual Task Surface + command constellation

Replace broad subsystem menus with task verbs. Keep constellation spatial geometry custom.

### Stage E - TechnoCore lenses

Attach UIKit precision surfaces to custom Three.js instrument geometry.

### Stage F - retire redundant panel wall

Consolidate diagnostic/reference panels and remove analyst-mode dashboard clutter after functional parity and device evidence.

---

# Part XIV - AI Agent Implementation Contract

## 32. Rules for an AI coding/design agent

An implementation agent MUST follow these gates in order.

### Gate 1 - Inspect before changing

Read current `main`, especially:

- `src/vr/InputRouter.ts`
- `src/vr/input/*`
- `src/vr/ui/HandWheelMenu.ts`
- `src/vr/artifacts/HolographicInspector.ts`
- `src/vr/coordinators/WorldUIManager.ts`
- `src/vr/ui/panelLayout.ts`
- `docs/decisions/P1U_WHOLE_PRODUCT_UX_AUDIT.md`
- `docs/decisions/VR_PANEL_SPATIAL_LAYOUT.md`
- `docs/Nemosyne_UX_Flow_and_Spatial_Interface_Design_Spec.md`
- relevant tests and research validity gates.

Do not implement from this document against stale assumptions.

### Gate 2 - Preserve authority

The UI may request an action but MUST NOT implement analytics, duplicate analytical state, or bypass provenance/history.

### Gate 3 - Smallest responsible layer

Prefer adapting existing `InputRouter`, panel ownership, and semantic action paths over adding a parallel global interaction framework.

### Gate 4 - Interaction equivalence

Each new control must be tested through every required modality: desktop, controller ray, hand ray, and direct touch where applicable.

### Gate 5 - Comfort

Any frequently used control requiring sustained shoulder-height hand posture fails review.

### Gate 6 - Scientific semantics

Any visual state that conflates recommendation, uncertainty, preference, validation, or evidence fails review.

### Gate 7 - Performance

Any UI implementation that misses the current Quest frame budget or creates systematic allocation/draw-call regressions fails review.

### Gate 8 - Research validity

Changes to investigator-facing layout, interaction timing, representation transition, or guidance may constitute a controlled-treatment modification. Update the relevant research decision records and do not silently alter study conditions.

## 33. Component acceptance checklist

A component is not complete until reviewers can answer yes to all applicable questions:

- Is its semantic purpose explicit?
- Does it have one declared reference frame?
- Is its interaction target large enough for the least precise supported input?
- Does direct touch have proximity/contact/commit/release feedback?
- Does ray interaction produce equivalent semantics?
- Is the action accessible without a memorized custom gesture?
- Does it avoid blocking or competing with data?
- Is its primary state understandable without color alone?
- Does it support cancellation/undo where the action is consequential?
- Does it preserve semantic identity across representation/view transitions?
- Is it lazy/cullable and within Quest performance budget?
- Is it tested on actual Quest hardware before “verified complete” status?

## 34. Required automated tests

At minimum add or extend tests for:

- near/far hysteresis and ray suppression;
- direct-touch state machine transitions;
- pointer capture and cancellation;
- panel precedence over scene selection;
- target hit-volume non-overlap;
- one semantic action emitted per commit;
- desktop/controller/hand semantic parity;
- panel reference-frame invariants;
- accessibility scale/contrast token application;
- reduced-motion state behavior;
- no essential action dependent solely on expert gesture;
- proper uncertainty/recommendation labels;
- UIKit root disposal and no leaked textures/materials/listeners.

## 35. Required device validation scenarios

Run on Quest 3S-class hardware:

1. First-session user opens a dataset, inspects a point, challenges a pattern, records a finding, returns home, and exports without using an expert gesture.
2. Same workflow using controllers only.
3. Same workflow using hands only where supported.
4. Touch a panel, retreat through the near/far threshold, then ray-select without flicker or double activation.
5. Operate for 20+ minutes with frequent inspect/compare actions and record perceived arm fatigue.
6. Use large-text and high-contrast modes.
7. Use reduced motion during representation switch and locomotion.
8. Stress test with representative large dataset while opening/scrolling major UI surfaces.

Capture frame-time telemetry and interaction failure rates. Device evidence outranks desktop screenshots.

---

# Part XV - Review Rubric

## 36. Senior VR/UI review scorecard

Score each dimension 0-3. A release candidate should score at least 2 in every category and 3 in core interaction/epistemic categories.

| Dimension | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| Spatial purpose | decoration/clutter | mixed purpose | mostly functional | every persistent object earns space |
| Discoverability | gesture memory required | inconsistent clues | visible novice path | progressive, self-revealing competence |
| Ergonomics | sustained high reach | frequent fatigue | comfortable defaults | low-fatigue alternatives everywhere |
| Near/far continuity | modes conflict | abrupt switching | mostly seamless | automatic, hysteretic, semantically identical |
| Targeting | frequent misses | small/dense | acceptable | least-precise modality designed first |
| Visual hierarchy | UI dominates | competition | data leads | data/evidence unmistakably dominant |
| Epistemic clarity | confidence theater | some conflation | states separated | evidence/recommendation/uncertainty fully legible |
| Orientation | spatial loss common | recovery difficult | stable anchors | transitions preserve identity and return paths |
| Accessibility | optional afterthought | some scaling | multimodal | full semantic alternatives + comfort modes |
| Performance | desktop-only | marginal Quest | budget mostly met | measured green on target hardware |
| Reproducibility | UI-only state | partial provenance | reachable provenance | every consequential action replayable/inspectable |

---

# Part XVI - Research Findings Applied to Nemosyne

## 37. Design decisions and rationale matrix

| Nemosyne decision | Evidence basis | Implementation implication |
|---|---|---|
| Direct Touch + Ray + Grab as primitives | Meta input hierarchy; MRTK near/far; VR menu research | unified pointer events feeding `InputRouter` |
| Direct touch for short nearby menus | IEEE menu study; Meta touch conventions | constellation and compact inspector support poke |
| Ray always available | ray usability; precision and fatigue considerations | never remove far-ray path from core action |
| No gesture-only essential commands | accessibility + fatigue evidence | gestures demoted to accelerators |
| Body-locked persistent work panels | MRTK near menu; Apple comfort; current Nemosyne decision | damped torso anchor retained |
| UIKit for precision surfaces | pmndrs vanilla Three.js + IWSDK spatial UI precedent | migrate bespoke canvas/mesh panels incrementally |
| Custom Three.js for TechnoCore/Memory Palace | Nemosyne semantics require spatial meaning | UIKit only for attached precision surfaces |
| Small visible surface count | Apple ornaments/windows; MRTK fatigue; Nemosyne clutter audit | 1 primary + 1 inspector + 1 reference default |
| Explicit preview and reversibility | XR targeting uncertainty + scientific provenance | commit on release/threshold; undo/branch path |
| Reduced motion and stable datum | Apple/Meta comfort + cybersickness research | no peripheral decorative motion; stable reference frame |

---

# Part XVII - Source Notes

## 38. Primary references

**[R1] Meta Horizon OS Developers.** “Input mappings.” Updated 13 March 2026.  
https://developers.meta.com/horizon/design/interactions-input-mappings/

**[R2] Meta Horizon OS Developers.** “Inputs and hit targets.” Updated 19 April 2026.  
https://developers.meta.com/horizon/design/styles_inputs_hit_targets/

**[R3] Meta Horizon OS Developers.** “Buttons” and “Buttons: Best practices.” Updated February 2026.  
https://developers.meta.com/horizon/design/buttons/  
https://developers.meta.com/horizon/design/buttons_bp/

**[R4] Meta Horizon OS Developers.** “Panels.” Updated 2 March 2026.  
https://developers.meta.com/horizon/design/panels/

**[R5] Meta Horizon OS Developers.** “Locomotion Best Practices.” Updated 17 December 2025.  
https://developers.meta.com/horizon/design/locomotion-best-practices/

**[R6] Meta Horizon OS Developers.** “Boundaryless and contextual-boundaryless safety best practices.” Updated 8 October 2025.  
https://developers.meta.com/horizon/design/boundaryless-best-practices/

**[R7] Meta Horizon OS Developers.** “Windows.” Updated 27 February 2026.  
https://developers.meta.com/horizon/design/windows/

**[R8] Meta Horizon OS Developers.** “Input modalities.”  
https://developers.meta.com/horizon/design/interactions-input-modalities/

**[R9] Apple Developer.** “Designing for visionOS.”  
https://developer.apple.com/design/human-interface-guidelines/designing-for-visionos

**[R10] Apple Developer.** “Accessibility” and “Spatial layout.”  
https://developer.apple.com/design/human-interface-guidelines/accessibility  
https://developer.apple.com/design/human-interface-guidelines/spatial-layout/

**[R11] Apple Developer.** “Ornaments” and “Windows.”  
https://developer.apple.com/design/human-interface-guidelines/ornaments  
https://developer.apple.com/design/human-interface-guidelines/windows

**[R12] Microsoft Learn.** “Hand menu - Mixed Reality.”  
https://learn.microsoft.com/en-us/windows/mixed-reality/design/hand-menu

**[R13] Microsoft Learn.** “Interactable object” and “Button - Mixed Reality.”  
https://learn.microsoft.com/en-us/windows/mixed-reality/design/interactable-object  
https://learn.microsoft.com/en-gb/windows/mixed-reality/design/button

**[R14] Microsoft Learn.** “Point and commit with hands.”  
https://learn.microsoft.com/en-us/windows/mixed-reality/design/point-and-commit

**[R15] Microsoft Learn.** “Near Menu - MRTK3.”  
https://learn.microsoft.com/en-us/windows/mixed-reality/mrtk-unity/mrtk3-uxcomponents/packages/uxcomponents/near-menu

**[R16] Wentzel, J. et al.** “A Comparison of Virtual Reality Menu Archetypes: Raycasting, Direct Input, and Marking Menus.” IEEE Transactions on Visualization and Computer Graphics 31(9), 2025; DOI 10.1109/TVCG.2024.3420236.  
https://pubmed.ncbi.nlm.nih.gov/38941205/

**[R17] Hincapié-Ramos, J.D. et al.** “Consumed Endurance: A Metric to Quantify Arm Fatigue of Mid-Air Interactions.” CHI 2014.  
https://hci.cs.umanitoba.ca/publications/details/consumed-endurance-a-metric-to-quantify-arm-fatigue-of-mid-air-interactions

**[R18]** “Comfort Is in the Air: Investigating the Perceived Comfort of Rotational and Translational Mid-Air Interactions.” Augmented Humans 2026.  
https://doi.org/10.1145/3795011.3795044

**[R19] Reynaert, V. et al.** “The effect of hands synchronicity on users perceived arms Fatigue in Virtual reality environment.” International Journal of Human-Computer Studies 178 (2023).  
https://www.sciencedirect.com/science/article/abs/pii/S1071581923001015

**[R20] Apple Developer.** “Motion.”  
https://developer.apple.com/design/human-interface-guidelines/motion

**[R21]** “Design guidelines for limiting and eliminating virtual reality-induced symptoms and effects at work: a comprehensive, factor-oriented review.” Frontiers in Psychology, 2023.  
https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2023.1161932/full

**[R22] Nie, T. et al.** “Peripheral Teleportation: A Rest Frame Design to Mitigate Cybersickness During Virtual Locomotion.” IEEE TVCG 31(5), 2025.  
https://pubmed.ncbi.nlm.nih.gov/40063443/

**[R23] pmndrs.** “uikit - Vanilla Three.js.”  
https://pmndrs.github.io/uikit/docs/getting-started/vanilla

**[R24] pmndrs.** “uikit - Introduction / Horizon kit.”  
https://pmndrs.github.io/uikit/docs/getting-started/introduction

**[R25] Meta.** “Immersive Web SDK - Built-in Interactions.”  
https://iwsdk.dev/guides/06-built-in-interactions

**[R26] Meta.** “Immersive Web SDK - Browser-First Systems.”  
https://iwsdk.dev/guides/16-browser-first-systems.html

**[R27] Meta.** “Immersive Web SDK - Object Grabbing & Manipulation.”  
https://iwsdk.dev/concepts/grabbing/

**[R28] Büttner, A., Grünvogel, S.M., Fuhrmann, A.** “The influence of text rotation, font and distance on legibility in VR.” IEEE VR Workshop, 2020.  
https://buettnerandre.com/files/2020/IEEEVR2020_The_influence_of_text_rotation_font_and_distance_on_legibility_in_VR__Preprint.pdf

## 39. Nemosyne repository evidence consulted

Repository: https://github.com/TsatsuAmable/nemosyne  
Baseline commit: `7caf490a190dfefbb18aa009bf481202f7fe1c8a`

Key files:

- `docs/decisions/P1U_WHOLE_PRODUCT_UX_AUDIT.md`
- `docs/decisions/VR_PANEL_SPATIAL_LAYOUT.md`
- `docs/Nemosyne_UX_Flow_and_Spatial_Interface_Design_Spec.md`
- `docs/INTERACTIONS.md`
- `src/vr/InputRouter.ts`
- `src/vr/input/PointerRegistry.ts`
- `src/vr/input/PointerEventMachine.ts`
- `src/vr/ui/HandWheelMenu.ts`
- `src/vr/artifacts/HolographicInspector.ts`
- `src/vr/coordinators/WorldUIManager.ts`
- `src/vr/scalability/LoadTestThresholds.ts`

---

# Part XVIII - Final design law

An AI agent implementing Nemosyne’s interface should repeatedly ask four questions:

1. **Does this object or surface earn its place in 3D?**
2. **Can the researcher operate it comfortably by touch when near and by ray when far without changing meaning?**
3. **Does the interface clarify, rather than cosmetically simplify, uncertainty, provenance, alternatives, and reversibility?**
4. **Does the result keep the data and evidence visually dominant while remaining verifiably performant on Quest hardware?**

If the answer to any is no, the interface is not finished.
