# Nemosyne UX Flow & Spatial Interface Design Specification

**Status:** Design-operational specification for AI-assisted UI/UX implementation  
**Scope:** VR/WebXR first, desktop-equivalent semantics required  
**Theme:** Sparse cyberspace research environment in which the data remains the dominant visual and cognitive object  
**Primary target:** Meta Quest 3S-class standalone VR, with desktop parity through shared NIL semantics  
**Related governing document:** `docs/Nemosyne_Definitive_Vision_and_Roadmap.md`

---

## 0. Purpose

This document translates the Nemosyne product vision into a coherent, end-to-end user experience that an AI design or engineering agent can implement, prototype, review, and test.

It is deliberately not a catalogue of disconnected controls. Nemosyne must feel like one instrument with one interaction language.

The experience should let a researcher:

1. enter an investigation without learning a game-like control scheme;
2. orient to the dataset and the current representation;
3. inspect and manipulate data with predictable actions;
4. understand why Moneta proposed a representation;
5. compare plausible alternatives without losing context;
6. challenge patterns rather than merely admire them;
7. form, test, support, refute, and record hypotheses;
8. preserve the route by which a conclusion was reached;
9. branch and replay an investigation without destructive history;
10. collaborate without surrendering provenance or semantic authority;
11. move between VR and desktop without changing the meaning of actions;
12. leave with a reproducible `.nemosyne` investigation package.

The UX must express the governing epistemic principle:

> **Nemosyne is not a machine for making patterns compelling. It is a spatial research instrument for making competing interpretations inspectable, testable, falsifiable, and reproducible.**

---

# 1. Experience Thesis

## 1.1 The world is an instrument, not a stage set

Nemosyne is a sparse cyberspace environment. The world exists to make data, analytical evidence, investigation history, and researcher intent easier to perceive and manipulate.

Every persistent world object MUST satisfy at least one of these functions:

- **Orient**: tell the researcher where they are or how the current space is organized.
- **Operate**: provide a meaningful action on the investigation.
- **Explain**: expose reasoning, provenance, uncertainty, alternatives, or state.
- **Remember**: preserve a location, branch, finding, or frozen state.
- **Navigate**: move between meaningful investigation contexts.
- **Coordinate**: support collaboration or shared reference.
- **Protect comfort**: provide safe spatial bounds, recentering, or scale reference.

If an object has no such function, remove it.

Ambient grid, fog, particles, lighting, and sound are permitted only when they provide depth cues, scale, direction, state, or legibility. Decorative cyberpunk clutter is explicitly out of scope.

## 1.2 Data receives the contrast budget

The data representation should dominate the scene by:

- brightness;
- motion;
- spatial extent;
- semantic color;
- interaction affordance;
- local detail.

UI is normally dim, thin, peripheral, and transient. It brightens only when the researcher directs attention toward it.

A useful heuristic:

- **70% visual attention budget:** data and active evidence;
- **20%:** immediate task controls and explanatory state;
- **10%:** orientation, presence, system state, and atmosphere.

Do not literally measure pixels against these percentages. Use them as a design review question: *is the interface competing with the data?*

## 1.3 Minimal immersion for the task

Use 3D space only where spatiality creates value.

Use spatial embodiment for:

- structure;
- relationships;
- topology;
- comparison;
- focus + context;
- investigation history;
- multiple hypotheses;
- spatial memory;
- collaboration.

Use planar UI for:

- exact text;
- numeric parameters;
- dense tables;
- long explanations;
- settings;
- forms;
- export;
- precise statistical readouts.

This follows the broader XR principle used by mature spatial systems: immersive space for inherently spatial content, familiar panels for UI-centric tasks.

## 1.4 One semantic interaction language

Nemosyne must not feel like separate subsystems stitched together.

All input modalities resolve into the same semantic action:

```text
LOOK / POINT
    ↓
FOCUS
    ↓
ACT
    ↓
CONFIRM
    ↓
PERCEIVE CONSEQUENCE
    ↓
UNDERSTAND / CHALLENGE / RECORD
```

Hand tracking, controller rays, mouse, keyboard, gaze, voice, and future agents are input mechanisms. NIL is the semantic language.

---

# 2. Design Principles

## P1. Progressive competence, not gesture memorization

A first-session researcher should need only:

- point/focus;
- select/commit;
- grab/move where appropriate;
- open the command surface;
- undo/return;
- move or teleport.

Advanced gestures are accelerators, not prerequisites.

The current gesture vocabulary can remain available experimentally, but the product path should demote most global gestures to expert shortcuts. A researcher should never fail because they forgot whether `sliceUp`, `scoopUp`, or `rotateCCW` means the desired action.

## P2. Context before command

The system should infer the current scope from what the researcher is focusing on:

- dataset;
- representation;
- cluster;
- node;
- time region;
- anomaly;
- observation;
- hypothesis;
- branch;
- collaborator.

The command surface then exposes only actions meaningful for that scope.

Do not show every possible action.

## P3. Near/far continuity

Use the same mental model for near and far interaction:

- far: point/ray + commit;
- near: direct grab/touch/pinch;
- transition automatically by distance.

Do not require users to learn one command vocabulary for near objects and another for distant objects.

## P4. Preview before consequential change

Operations that materially alter the current representation or investigation must support preview.

Preview should show:

- what will change;
- what remains;
- whether the action is reversible;
- whether it is analytical, representational, navigational, or merely visual;
- cost if the operation is computationally expensive.

Commit on release/confirmation rather than initial press where practical, preserving a cancellation window.

## P5. No invisible modes

If a persistent mode exists, it must have:

- an obvious entry;
- a continuous visual state indicator;
- an obvious exit;
- an undo/recovery path.

Flight mode, research freeze, compare mode, and branch replay are legitimate persistent modes. A hidden "anomaly mode because the user touched a portal ten minutes ago" is not.

## P6. Negative capability

Ambiguity is a valid state.

When Moneta is `AMBIGUOUS`, `UNDERDETERMINED`, or `INFEASIBLE`, the UI must not cosmetically convert that state into a winner.

The researcher should be able to inhabit unresolved alternatives, compare them, challenge them, or defer the decision.

## P7. Skepticism is an interaction primitive

Every interesting pattern should have a route to:

- inspect evidence;
- compare an alternative representation;
- perturb or resample;
- seek counterexamples;
- test a hypothesis;
- record support, refutation, or inconclusive status.

The experience should make "try to break this pattern" almost as easy as "show me this pattern."

## P8. Preference, attention, and convergence are not truth

The UI must distinguish:

- what the model recommends;
- what the researcher prefers;
- what attracts attention;
- what multiple researchers independently found;
- what analytical evidence supports;
- what has survived validation.

Never collapse these into a single confidence glow or score.

## P9. Recovery is part of the main path

Undo, return, recenter, restore representation, restore branch, and recover runtime state are not secondary utilities.

They are core trust-building interactions.

## P10. Every spatial change preserves orientation

When the representation changes, preserve as much as possible:

- selected object;
- camera/analyst reference;
- semantic identity;
- branch context;
- highlighted evidence;
- spatial anchors.

When preservation is impossible, explain the transition and provide a way back.

---

# 3. Spatial World Architecture

The world uses five layers. Only one or two should be visually prominent at a time.

## Layer 0 — Data World

The current `RepresentationGraph` embodiment.

Examples:

- point cloud;
- hierarchy;
- graph;
- time ribbon;
- geo surface;
- density field;
- compositional representation.

This is always the visual priority.

## Layer 1 — Contextual Affordances

Transient UI attached to data or focus:

- gaze tooltip;
- selection halo;
- manipulation handles;
- Holographic Inspector;
- local operation preview;
- annotation beacon;
- hypothesis marker.

These appear because the user looked, pointed, selected, or approached.

## Layer 2 — Personal Command Surface

Body/hand-attached controls for quick actions:

- compact constellation/radial menu;
- undo/redo;
- home/recenter;
- focus;
- compare;
- annotate;
- request alternative;
- challenge;
- settings entry.

This layer should be small and brief.

## Layer 3 — Epistemic Instruments

World-anchored or summoned instruments that expose analytical reasoning:

- TechnoCore;
- evidence/stability views;
- counterfactual representations;
- explanation surfaces.

This layer exists when the researcher asks *why*, *what else*, or *how robust*.

## Layer 4 — Investigation / Memory Palace

The reasoning graph:

- observations;
- questions;
- hypotheses;
- tests;
- findings;
- branch points;
- alternative routes;
- collaborators;
- frozen states.

The Memory Palace is not a decorative second world. It is the spatial embodiment of investigation history and reasoning.

---

# 4. Persistent World Object Taxonomy

## 4.1 Datum Plane — orientation substrate

**Role:** spatial zero, horizon, scale, and grounding reference.

The Datum Plane must help answer:

- where is "home";
- what is up/down;
- where is the dataset anchored;
- whether the current world has been scaled;
- whether a point lies above/below the main evidence field.

Design:

- low-contrast grid;
- sparse major-axis cues;
- stronger origin marker only when lost/recentering;
- no animated spectacle.

## 4.2 TechnoCore — epistemic instrument hub

**Role:** central interface to analytical lenses, Moneta explanation, alternatives, stability/challenge tools, and provenance.

The TechnoCore is a landmark and a manipulable instrument. It should become the single coherent answer to:

> "I want to interrogate how Nemosyne is seeing this."

It must never become a generic settings menu.

Detailed specification is in Section 8.

## 4.3 Evidence Vault / Ice Vault — frozen evidence and reproducibility

The current Ice Vault visual should acquire a clear semantic role.

**Role:**

- store frozen investigation states;
- surface saved DiscoveryEpisodes;
- manage study-freeze snapshots;
- open/import/export `.nemosyne` packages;
- compare a current investigation with a frozen prior state.

The Vault represents **immutability and return**, not "security theatre."

A researcher should understand:

> "Things placed here are preserved and reproducible."

## 4.4 Farcaster Portals — semantic context gateways

Portals should represent meaningful changes of place/context:

- enter a branch;
- enter a saved investigation;
- move from overview to detail;
- join a collaborator's frame;
- enter a related investigation;
- return to origin.

Avoid using portals for ordinary operations such as "run anomaly detection." A portal implies *travel*. If stepping through also changes data state, the destination and operation must be previewed explicitly.

## 4.5 Beacons — observations and findings

A beacon is not a decorative marker.

It represents one of:

- observation;
- question;
- hypothesis;
- validated finding;
- unresolved contradiction.

Its shape/state should communicate lifecycle, not subjective "importance."

## 4.6 Threads — relationships and reasoning paths

Use thin luminous threads to connect:

- observation → hypothesis;
- hypothesis → analytical test;
- test → evidence;
- branch point → branch;
- finding → supporting evidence;
- related investigations.

Threads are normally muted and become visible on focus to avoid spaghetti.

## 4.7 Panels — instruments, not furniture

Panels are temporary precision surfaces.

Rules:

- no more than three high-density panels should compete for attention in VR;
- open near the user, not permanently at world origin;
- panels can be grabbed and world-locked for extended work;
- quick panels return to body/hand anchor when dismissed;
- exact tables and long text stay planar.

---

# 5. Reference Frames

Every component must declare its reference frame.

| Component | Default frame | Why |
|---|---|---|
| Dataset representation | WORLD_LOCKED / INVESTIGATION_FRAME | Stable spatial memory |
| Datum Plane | WORLD_LOCKED | Orientation |
| TechnoCore landmark | WORLD_LOCKED | Persistent landmark |
| TechnoCore summoned interface | BODY_LOCKED transitioning to WORLD_LOCKED | Comfortable near interaction |
| Holographic Inspector | HAND_ATTACHED or BODY_LOCKED | Brief local detail |
| Quick command surface | HAND_ATTACHED / BODY_LOCKED | Fast access |
| Precision panels | BODY_LOCKED, optionally WORLD_LOCKED | Longer reading/manipulation |
| Observation beacon | OBJECT_ATTACHED / INVESTIGATION_FRAME | Meaning tied to evidence |
| Memory Palace graph | INVESTIGATION_FRAME | Stable reasoning topology |
| Collaborator presence | WORLD_LOCKED to their frame | Shared spatial reference |
| Comfort/system alert | BODY_LOCKED | Guaranteed visibility |
| Error requiring immediate action | BODY_LOCKED, non-head-locked where possible | Visible without trapping gaze |

Never transition reference frames without visual continuity. If a panel tears from the hand into world space, animate the movement and preserve orientation.

---

# 6. Primary Interaction Grammar

## 6.1 Required novice vocabulary

A novice must be able to complete the core investigation with this vocabulary:

### Focus
Look or point at something.

### Select / Commit
Controller trigger or pinch.

### Grab
Grip or pinch-hold a directly manipulable object.

### Command
Open the off-hand / body command surface.

### Undo / Return
Dedicated command, controller shortcut, or desktop shortcut.

### Move
Teleport or comfort locomotion.

Nothing else is required.

## 6.2 Expert accelerators

Optional accelerators may include:

- pinch-apart / pinch-together for direct expansion/aggregation;
- controller/wrist quick menu;
- rotate gesture for undo/redo;
- voice commands for `COMPARE`, `EXPLAIN`, `ANNOTATE`, `RETURN`;
- direct bimanual world scaling;
- keyboard shortcuts on desktop.

The system must teach these opportunistically, not front-load them.

## 6.3 Context suppression

When the hand is inside or near a data object:

- suppress global gestures;
- prioritize direct manipulation;
- hide locomotion rays unless deliberately invoked.

When a menu is active:

- suppress scene selection behind the menu;
- freeze the menu anchor during near interaction;
- show explicit hover/commit feedback.

When the researcher pauses input:

- freeze interaction state;
- do not move, select, or apply operations.

---

# 7. Command Surface

The existing constellation wheel can remain, but it should become task-oriented rather than subsystem-oriented.

## Recommended top-level actions

At novice level, show only:

1. **Inspect**
2. **Compare**
3. **Challenge**
4. **Record**
5. **Navigate**
6. **More**

`More` reveals less common controls, settings, collaboration, research mode, and expert operations.

Do not make researchers choose categories such as "Atlas," "Moneta," "TDA," "Representation," or "Ops."

## Contextual examples

Focused on a cluster:

- Inspect
- Isolate
- Compare
- Challenge stability
- Annotate
- Explain why highlighted

Focused on a representation:

- Explain representation
- Show alternative
- Compare candidates
- Change scale
- Record preference

Focused on a finding:

- Open evidence
- Re-run test
- Challenge
- Branch here
- Share/freeze

---

# 8. TechnoCore UX Specification

## 8.1 Concept

The TechnoCore is the **epistemic instrument hub**.

It answers five questions:

1. **What is Nemosyne currently using to interpret this data?**
2. **Why did Moneta choose this representation?**
3. **What viable alternative did it reject?**
4. **How stable is the apparent pattern under reasonable perturbation?**
5. **Where did this conclusion come from?**

It should be recognizable from anywhere, but it should not force the researcher to walk ten metres every time they need it.

## 8.2 Three interaction depths

### Depth A — Ambient landmark

At distance, the core communicates only:

- analytical activity;
- current lens family;
- degraded/error state;
- whether an investigation is frozen.

No text.

Pulse amplitude may indicate **compute activity only**. It MUST NOT indicate confidence, truth, or finding quality.

### Depth B — Far quick interaction

Point at the TechnoCore:

- rings slow and align toward the researcher;
- a small label appears: `TechnoCore — Analysis instruments`;
- the ray target expands subtly;
- a single select opens a compact quick lens chooser.

Quick lens actions:

- Structure
- Statistical
- Anomaly
- Clear lens

These are reversible overlays.

### Depth C — Summoned Core Halo

Pinch-hold / trigger-hold the core for ~300–500 ms and pull toward the body, or invoke **Challenge / Explain** from the command surface.

A near-field projection of the core arrives at comfortable arm's reach. The world landmark remains visible as a dim tethered origin.

The summoned halo contains five orbiting instrument tokens:

1. **Explain**
   - Why this representation?
   - Which evidence mattered?
   - What constraints were active?
   - Model version / artifact identity.

2. **Alternatives**
   - Runner-up representation.
   - Utility margin.
   - Rejected alternatives.
   - `AMBIGUOUS` / `UNDERDETERMINED` state.

3. **Challenge**
   - Perturbation / resampling stability.
   - Counterexample search.
   - Safe alternate analytical test.
   - "What would falsify this?"

4. **Provenance**
   - Investigation path.
   - Relevant evidence ledger.
   - model/kernel/ontology versions.
   - branch entry into Memory Palace.

5. **Lens**
   - Statistical / anomaly / structure / density overlays.
   - Visual-only lens state clearly separated from analytical operations.

## 8.3 Manipulation metaphor

The halo tokens behave like instruments, not menu buttons.

The researcher can:

- select a token to apply it to the current focus;
- grab a token and drag it onto a cluster, node, branch, or finding to scope the instrument;
- release outside a valid target to cancel;
- return a token to the Core to clear it.

The target glows before commit, so scope is obvious.

## 8.4 TechnoCore output rules

The Core does not become a dashboard.

Its outputs appear where they matter:

- explanation appears as a compact precision slate near the selected representation;
- alternative representation appears beside or around the current representation;
- stability appears on the relevant geometry;
- provenance opens the investigation graph;
- lens overlays affect the data.

## 8.5 Visual semantics

Recommended state language:

- **cyan/teal:** neutral system/instrument state;
- **magenta:** anomaly lens, not generic warning;
- **amber:** unresolved/ambiguous/investigation needed;
- **red:** error, violated hard constraint, or unavailable authority;
- **white:** direct focus/selection.

Do not make every subsystem a different neon color.

## 8.6 Current implementation implication

The current world-anchored Core is positioned as a distant landmark. Preserve that landmark role, but add a summoned near-field interface rather than forcing repeated locomotion.

---

# 9. Evidence Vault / Ice Vault UX Specification

## 9.1 Purpose

The Evidence Vault is the physical metaphor for:

- freeze;
- preserve;
- replay;
- package;
- compare with a known state.

It is not a place where raw data "gets locked away."

## 9.2 Ambient state

At distance, it shows:

- count of frozen checkpoints;
- presence of unsaved investigation changes;
- study-freeze state;
- package validation problem.

Use small orbiting facets or slots, not text walls.

## 9.3 Open Vault

Select the Vault to expose a compact set of preserved items:

- Current investigation checkpoint
- Saved DiscoveryEpisodes
- Branch snapshots
- Imported `.nemosyne` packages
- Study freeze manifests

Selecting an item offers:

- Replay
- Compare with current
- Branch from here
- Export
- Inspect provenance

## 9.4 Saving

Recording a finding should not require physically carrying it to the Vault.

When a discovery is frozen:

- a brief light-thread travels from the finding beacon to the Vault;
- the Vault emits one subtle confirmation;
- the new preserved facet appears.

The metaphor reinforces memory without adding motor labor.

---

# 10. Farcaster Portal UX Specification

## 10.1 Portals are for context travel

Use Farcaster portals for:

- branch transitions;
- overview/detail transitions;
- saved investigation entry;
- collaborator frame entry;
- related investigation entry;
- return-to-origin.

Do not use them as ordinary buttons for filter, anomaly, or sort.

## 10.2 Portal preview

When the user approaches or points:

- destination name appears;
- destination thumbnail/miniature appears inside the aperture;
- semantic effects appear in one short sentence;
- any non-navigation side effect is explicit;
- cancel route remains obvious.

Example:

**Branch: Vendor-network hypothesis**  
`Enter the branch at Observation 17. Current branch remains unchanged.`

## 10.3 Crossing

Before threshold:

- portal brightens;
- destination audio cue becomes audible;
- floor/Datum Plane shows destination boundary.

After crossing:

- brief spatial continuity transition;
- destination origin is visible;
- "Return to previous branch" remains available.

Avoid violent camera animation.

---

# 11. Memory Palace as Investigation Graph

## 11.1 Definition

The Memory Palace is the spatial graph of reasoning, not merely the saved location of rendered data.

Canonical conceptual hierarchy:

```text
Investigation
  ├─ Dataset / representation states
  ├─ Observations
  │    └─ Questions
  │         └─ Hypotheses
  │              ├─ Tests
  │              │    ├─ Evidence
  │              │    └─ Outcomes
  │              └─ Alternative hypotheses
  ├─ Branches
  ├─ Findings
  └─ Frozen checkpoints / related investigations
```

## 11.2 Entering the Memory Palace view

Invoke:

- TechnoCore → Provenance;
- focused finding → "Show path";
- command surface → Navigate → Investigation map.

The live data world does not disappear.

Instead:

- current data representation dims to context;
- investigation nodes become visible around/above it;
- the current point in history is strongly highlighted;
- the route to the selected finding brightens.

## 11.3 Node semantics

Suggested glyph categories:

- Observation: small beacon
- Question: open ring
- Hypothesis: paired/branching diamond
- Test: instrument glyph
- Supported result: stable filled anchor
- Refuted result: crossed but preserved anchor
- Inconclusive: amber split-state anchor
- External validation: outlined secondary halo
- Branch point: fork gate
- Frozen checkpoint: Vault facet

Do not delete refuted paths. They are part of the investigation's meaning.

## 11.4 Branching

At any history node:

- select `Branch from here`;
- proposed branch appears as a ghost path;
- name/hypothesis can be added in a small slate;
- commit creates a new branch while preserving the current branch.

Switching branches should preserve:

- selected semantic objects where still valid;
- camera orientation where practical;
- the last shared ancestor as a visible return point.

## 11.5 Compare branches

Select two branch paths.

The system shows:

- common ancestor;
- operations unique to A;
- operations unique to B;
- findings unique/shared;
- representation differences;
- analytical evidence differences.

In VR, differences should be spatially aligned rather than shown as two unrelated rooms whenever feasible.

---

# 12. Counterfactual Representation UX

## 12.1 Goal

The researcher can ask:

> "What did Moneta almost choose instead?"

This should be a first-class action.

## 12.2 Invocation

- TechnoCore → Alternatives;
- command surface → Compare → Representation alternative;
- Moneta explanation slate → "Show runner-up."

## 12.3 Spatial presentation

Preferred order:

### Overlay
For comparable geometries, briefly overlay alternative mappings with clear separation and a toggle.

### Side-by-side
For structurally different representations, place the runner-up in a parallel bounded region beside the current representation.

### Sequential morph
Only when correspondence is strong and motion will not mislead. Provide scrub and before/after anchors.

Do not encode utility margin as arbitrary literal distance unless that spatial mapping is explicitly defined.

## 12.4 Ambiguous decisions

If Moneta is `AMBIGUOUS`:

- do not crown one candidate with stronger glow;
- show two or more candidate cards/miniatures with equal visual authority;
- state why the decision is unresolved;
- allow the researcher to investigate both;
- record any preference as judgement evidence, not truth.

---

# 13. Skeptical Investigation / Challenge Flow

## 13.1 Entry

Focused pattern → **Challenge**.

The system asks, with minimal wording:

- Test stability
- Seek counterexample
- Compare representation
- Run analytical test
- State falsifier

## 13.2 Stability

When stability analysis is available:

- run in Rust/WASM;
- record method, perturbation, seed, sample, parameters, and limitations;
- render effect on relevant geometry.

Visual encodings:

- ghost envelope showing positional variation;
- intermittent "alternate sample" flicker on deliberate request;
- bounded trails;
- confidence/stability bands on time or scalar structures;
- summary readout in a panel.

Avoid permanent jitter/trembling in peripheral vision. It can imply false statistical semantics and harm comfort.

Label the result **stability** or **robustness**, not confidence.

## 13.3 Counterexample search

The researcher can select:

- current cluster;
- relationship;
- anomaly;
- hypothesis.

Nemosyne returns candidate contradictory evidence or regions requiring inspection.

The result is a **challenge suggestion**, not a refutation until tested.

## 13.4 Falsification statement

When forming a hypothesis, optionally capture:

> "What observation would make you change your mind?"

This creates a target for later testing.

## 13.5 Outcome

A challenge updates the `DiscoveryEpisode`:

- supported;
- refuted;
- inconclusive;
- under investigation.

The world should not erase a disproven hypothesis. It should become a visible, quieter part of the reasoning graph.

---

# 14. Discovery Recording Flow

## 14.1 Observation

User sees something potentially meaningful.

Action:

- focus;
- command surface → Record → Observation;
- or quick "Mark Moment."

System captures:

- semantic target;
- current representation;
- analyst pose/reference frame;
- active filters;
- relevant evidence IDs;
- timestamp;
- model/ontology/kernel versions.

A small beacon appears.

## 14.2 Question

From the beacon:

- `Question`;
- short voice/text input;
- optional structured prompt.

The question attaches to the observation.

## 14.3 Hypothesis

Select `Hypothesise`.

Capture:

- proposition;
- expected supporting evidence;
- optional falsifier;
- intended test.

## 14.4 Test

Select a test from context.

Analytical operations execute through the canonical analytical path.

Results attach automatically to the hypothesis.

## 14.5 Conclude

The system prompts:

- Supported
- Refuted
- Inconclusive
- Continue investigation

It then asks for a short researcher interpretation.

## 14.6 Freeze discovery

`Record discovery` creates a frozen DiscoveryEpisode and sends a preserved reference to the Evidence Vault.

The researcher can continue working without closing the investigation.

---

# 15. End-to-End UX Flow A — First Session

## Goal

Teach enough to investigate without a front-loaded tutorial.

### Step 1 — Arrival

User appears at the investigation origin.

Visible:

- Datum Plane;
- dataset representation ahead;
- TechnoCore in the peripheral field as a landmark;
- one subtle `Start here` focus cue.

Hidden:

- full dashboard;
- portals;
- advanced panels;
- most labels.

### Step 2 — Orientation cue

A compact card says:

**Look at a data point and pinch/trigger to inspect.**

A ghost-hand coach appears only after inactivity or repeated failed input.

### Step 3 — First inspection

User selects a datum.

Response:

- target highlights;
- Holographic Inspector appears near the active hand;
- exact values visible;
- a soft confirmation tone/haptic.

The system has now taught focus + commit.

### Step 4 — First command

Inspector includes one unobtrusive hint:

**Open tools with your off-hand menu button / palm.**

Command surface opens with only:

- Inspect
- Compare
- Challenge
- Record
- Navigate
- More

### Step 5 — Undo / return teaching

After first reversible operation, the UI briefly exposes `Undo`.

No other gesture training occurs unless needed.

### Step 6 — Tour becomes contextual

Guidance continues only when:

- user stalls;
- enters a new capability;
- asks for help.

The target is "learn by investigating," not "complete tutorial before working."

---

# 16. End-to-End UX Flow B — Load Dataset and Understand Representation

## Goal

Move from dataset load to a comprehensible Moneta hypothesis.

### Step 1 — Dataset entry

Desktop:

- file picker/import;
- dataset summary and validation.

VR:

- entering an existing investigation/package;
- dataset is already mounted;
- loading status appears on a small body panel.

### Step 2 — Rust evidence generation

TechnoCore pulse indicates compute activity.

Do not display a fake progress percentage unless progress is measurable.

If computation is long:

- show stage names;
- allow cancel;
- allow background continuation only if the runtime truly supports it.

### Step 3 — Moneta proposal

Representation materializes from stable anchor points.

A small annotation near the TechnoCore says:

**Representation ready**

Not:

**Best representation: 87% confidence**

### Step 4 — Explain on demand

User can ignore explanation and explore.

If they ask `Explain`:

- a compact slate shows:
  - representation name/graph summary;
  - strongest supporting evidence;
  - hard constraints;
  - major tradeoffs;
  - runner-up;
  - decision status.

### Step 5 — Ambiguity

If `AMBIGUOUS`:

- show two candidate miniatures;
- let user enter either;
- preserve equal status;
- offer `Compare`.

---

# 17. End-to-End UX Flow C — Inspect, Filter, Compare

### Step 1 — Select structure

User selects a cluster or region.

Local handles appear only for meaningful frequent actions.

### Step 2 — Filter preview

Select `Isolate` or `Filter`.

Non-matching objects ghost/fade during preview.

The confirmation surface states:

**Isolate 423 of 8,120 observations**  
`Reversible`

### Step 3 — Commit

On release/confirm:

- operation executes;
- new state stabilizes;
- history records it;
- undo becomes available.

### Step 4 — Compare

Select a second cluster or time region.

Nemosyne creates a comparison relation and opens:

- spatial juxtaposition if spatial form matters;
- a compact exact-value panel if numerical comparison matters.

### Step 5 — Return

`Return` restores previous focus without undoing analysis.

`Undo` reverses the operation.

These are distinct.

---

# 18. End-to-End UX Flow D — "Road Not Taken"

### Step 1

User asks `Alternatives`.

### Step 2

TechnoCore summons runner-up.

### Step 3

Current and alternative representations coexist with clear labels.

Shared semantic targets remain linked.

### Step 4

User selects an observation in one representation.

The corresponding semantic object highlights in the other.

### Step 5

User can:

- keep current;
- prefer alternative;
- continue ambiguous;
- branch the investigation from the alternative.

Preference is logged as `RepresentationJudgement`.

It does not automatically retrain or promote a model.

---

# 19. End-to-End UX Flow E — Challenge an Attractive Pattern

### Scenario

A graph representation reveals a visually striking dense hub.

### Step 1 — Observation

User records the hub as an observation.

### Step 2 — Question

"Is this a real concentration of interactions or an artifact of high-degree accounts?"

### Step 3 — Challenge

Select beacon → Challenge.

Options:

- stability;
- degree-normalized comparison;
- alternative representation;
- counterexample;
- analytical test.

### Step 4 — Stability

Rust computes bounded perturbation/resampling evidence.

The hub receives a transparent spatial envelope showing how much structure changes.

### Step 5 — Alternative representation

Moneta runner-up appears.

The same entities highlight.

### Step 6 — Analytical test

Relevant dependency/degree evidence appears.

### Step 7 — Outcome

Researcher records:

- supported;
- refuted;
- inconclusive.

The path is preserved in the Memory Palace.

This flow is central to Nemosyne's identity.

---

# 20. End-to-End UX Flow F — Branch and Revisit

### Step 1

User opens a prior finding.

### Step 2

Select `Show path`.

Memory Palace view reveals the route.

### Step 3

At the hypothesis node, select `Branch from here`.

Ghost branch appears.

### Step 4

Name branch:

**Control for geography**

### Step 5

Branch opens in the same data world with shared ancestor context preserved.

### Step 6

Later, `Compare branches` overlays differences and unique conclusions.

The researcher can then freeze either or both in the Evidence Vault.

---

# 21. End-to-End UX Flow G — Collaboration and Peer Challenge

## Principle

Collaboration transports semantic events and presence. It does not create a second state authority.

### Step 1 — Join

Peer appears as:

- minimal avatar/head-hand proxy;
- name label only on focus;
- direction cue when off-screen.

### Step 2 — Shared focus

When peer points at a semantic object:

- subtle local highlight;
- no giant laser unless explicitly presenting.

### Step 3 — Follow peer frame

Select peer → `Join frame`.

A Farcaster-like transition can bring the researcher to the peer's spatial frame without modifying analytical state.

### Step 4 — Peer challenge

Peer selects a finding and adds:

- question;
- counter-hypothesis;
- test suggestion.

Attribution is explicit.

### Step 5 — Divergence

Either researcher can branch.

Shared ancestor remains visible in Memory Palace.

### Step 6 — Independent conclusions

Convergence across researchers can be surfaced as:

**Independent agreement detected**

Never as:

**Verified by consensus**

---

# 22. End-to-End UX Flow H — Research Mode / Model Comparison

## Goal

Use human judgement experimentally without turning preference into truth.

### Step 1 — Research mode entry

Explicit banner/token:

**RESEARCH MODE — Model A/B treatment frozen**

No silent adaptation.

### Step 2 — Side-by-side model outputs

Old model and candidate model each produce a representation.

Order/position is randomized or counterbalanced by protocol.

### Step 3 — Analyst works normally

Do not continually remind them which model is which if blinding is part of the protocol.

### Step 4 — Structured judgement

After task completion:

- preference;
- perceived usefulness;
- reason;
- discovery outcome.

### Step 5 — Storage

Judgement enters curated research data.

Promotion remains governed by holdout evaluation and promotion policy.

---

# 23. End-to-End UX Flow I — Large Dataset / Degraded Capability

## Goal

Protect frame rate, honesty, and task continuity.

### Step 1 — Load

System detects size/complexity.

### Step 2 — Representation adaptation

Use:

- aggregation;
- instancing;
- LOD;
- sparse topology;
- landmark/sample modes where governed.

### Step 3 — State explanation

If exact analysis is unavailable at interactive latency:

**Approximate sparse-neighborhood mode**  
`Reason: dataset scale`  
`Method + limitations available`

Do not silently substitute.

### Step 4 — Focus refinement

When user focuses on a region:

- increase local detail;
- preserve global context;
- never explode the whole dataset into one mesh per row.

### Step 5 — Expensive operation

Preview estimated work class:

- Immediate
- Brief
- Heavy

Allow cancel.

---

# 24. End-to-End UX Flow J — Runtime Failure and Recovery

### Failure

If analytical authority becomes unavailable:

- freeze current rendered state;
- prevent new analytical claims;
- show one clear body-anchored state:
  **Analysis temporarily unavailable**
- preserve investigation history;
- allow navigation, reading, export where safe.

Do not replace Rust analytical results with a hidden TypeScript fallback.

### Recovery

When authority returns:

- announce recovery once;
- revoke stale operation handles;
- restore safe current dataset state;
- make any lost/uncommitted operation explicit.

Recovery should feel like an instrument reconnecting, not a world reset.

---

# 25. Detailed Coherent Use Case 1 — Fraud Investigation

## Research context

An investigator knows a transaction dataset and suspects coordinated vendor/account activity.

## Journey

1. Dataset loads as a graph representation.
2. TechnoCore quietly indicates analytical compute.
3. User inspects a high-degree account.
4. Gaze tooltips label only nearby/focused entities.
5. User isolates a suspicious vendor cluster.
6. Non-matching network fades during preview.
7. User records an observation beacon.
8. User opens `Explain` to see why graph representation was favored.
9. User requests `Alternative`; a tabular/density view appears beside it.
10. The same suspicious accounts remain semantically linked across both views.
11. User asks `Challenge stability`.
12. Perturbation evidence shows the cluster persists but one hub relationship does not.
13. User forms hypothesis:
    **"These vendors are coordinated through shared intermediary accounts."**
14. Falsifier:
    **"If intermediary overlap disappears after controlling for transaction volume, reject."**
15. User runs a relevant analytical test.
16. Result is inconclusive.
17. User branches:
    **Control for transaction volume**
18. Second branch weakens the relationship.
19. Researcher records the original hypothesis as refuted.
20. Refuted path remains in the Memory Palace.
21. A new supported narrower finding is recorded.
22. DiscoveryEpisode is frozen into the Evidence Vault.
23. `.nemosyne` package can later replay the route.

## UX success condition

The product prevented a visually compelling graph hub from becoming an unchallenged "finding."

---

# 26. Detailed Coherent Use Case 2 — Sensor Time-Series Investigation

## Research context

A domain expert investigates intermittent equipment instability.

## Journey

1. Time ribbon appears.
2. User scrubs time directly or via contextual control.
3. A local burst attracts attention.
4. User selects region; inspector shows exact timestamps and values.
5. User records observation.
6. TechnoCore anomaly lens reveals related outliers elsewhere.
7. User requests spectral evidence.
8. Exact results appear in a precision panel while the time geometry remains primary.
9. User asks for stability under window/segment variation.
10. Stable periodic features remain spatially anchored; unstable features appear only in the stability envelope.
11. User forms a hypothesis.
12. Runs analytical test.
13. Compares against another equipment unit.
14. Records supported conclusion.
15. Memory Palace shows:
    time burst → question → spectral test → comparison → conclusion.
16. Result is frozen.

## UX success condition

The user never needs to choose "FFT module," "Rust function," or "Moneta requirement." They operate in domain terms.

---

# 27. Detailed Coherent Use Case 3 — Collaborative Review

## Research context

Two researchers independently analyze the same investigation package.

## Journey

1. Researcher A opens the package.
2. Researcher B joins later.
3. B sees A's presence but not a cluttered avatar.
4. A points to a finding and starts a shared focus.
5. B opens provenance and notices an untested assumption.
6. B adds a question and branches.
7. A stays on the original branch.
8. Both branches remain visible as separate reasoning paths.
9. B's alternative test refutes part of A's conclusion.
10. Branch comparison highlights:
    - shared ancestor;
    - different test;
    - changed evidence;
    - changed conclusion.
11. They record an amended finding.
12. Original finding remains preserved.
13. Final package contains both routes and authorship.

## UX success condition

Collaboration produces intelligible disagreement, not shared-screen chaos.

---

# 28. Desktop Parity

Desktop is not a degraded copy of VR. It is another embodiment of the same investigation semantics.

## Shared

- DatasetEvidence
- RepresentationGraph
- Moneta decisions
- NIL actions
- Investigation graph
- DiscoveryEpisodes
- model/provenance identity
- branch semantics
- package/replay

## Desktop interaction mapping

| VR semantic action | Desktop equivalent |
|---|---|
| Point/focus | Hover |
| Pinch/trigger | Click |
| Grab/move | Drag |
| Hand command menu | Context/radial command menu |
| Teleport/fly | Orbit/pan/zoom |
| Inspector slate | Inspector side/floating panel |
| TechnoCore | Persistent compact instrument button + optional 3D landmark |
| Memory Palace | 3D/2D investigation graph view |
| Portal | Navigate/open branch/link |
| Haptic confirm | Visual/audio confirm |
| Body-locked alert | Toast/status bar |

Do not require desktop users to simulate VR gestures.

---

# 29. Comfort, Accessibility, and Ergonomics

## 29.1 Neutral viewing region

Frequently used controls should remain near comfortable forward gaze and slightly below the horizon.

Do not place frequent controls overhead, behind the user, or at the floor.

## 29.2 Head locking

Avoid head-locked panels.

Body/torso anchoring with damping is preferable for personal workspaces.

Critical alerts may follow the user, but should not feel glued to the face.

## 29.3 Arm fatigue

Hand-attached menus are for short actions.

If a task requires more than a few seconds:

- tear the panel into world/body space;
- allow hand to drop;
- keep interaction stable.

## 29.4 One-handed operation

Core workflows must work with:

- one controller;
- either dominant hand;
- controller-only mode;
- desktop.

Bimanual gestures are optional accelerators.

## 29.5 Motion

Avoid:

- forced camera movement;
- high-speed peripheral animation;
- continuous shake;
- large moving backgrounds;
- surprise scale changes.

Prefer moving the content or showing a transition target rather than moving the user's camera.

## 29.6 Visual accessibility

Never use color alone to encode:

- selection;
- validation;
- ambiguity;
- error;
- branch;
- collaborator identity.

Pair color with shape, motion, icon, label, or spatial relation.

## 29.7 Text

Use text only when precision matters.

Labels should:

- appear on focus;
- face the user;
- remain short;
- avoid dense world-space paragraphs;
- move long explanations into precision panels.

---

# 30. Feedback System

## 30.1 Visual

Use restrained state changes:

- highlight;
- scale;
- outline;
- opacity;
- local motion;
- relation thread.

Avoid whole-world flashes.

## 30.2 Audio

Use spatial audio for:

- off-screen collaborator/finding cues;
- operation completion;
- portal destination;
- error location;
- data sonification when analytically justified.

UI sounds should be short and tactile.

## 30.3 Haptics

Use haptics for:

- selection commit;
- grab acquisition;
- operation confirmation;
- threshold crossing;
- invalid action;
- meaningful data encoding experiments.

Do not vibrate continuously for "importance."

## 30.4 Sonification as data encoding

Sonification is a representation primitive, not atmosphere.

Possible encodings:

- temporal rate → rhythm;
- scalar magnitude → pitch/range;
- periodicity → repeating motif;
- density → texture;
- anomaly → contrast event.

Every mapping must be inspectable and versioned.

---

# 31. Sparse Cyberspace Visual Language

## 31.1 Environment

Preferred:

- deep neutral void;
- minimal horizon/grid;
- limited fog for depth;
- sparse landmark lights;
- low particle density only for motion/depth cues;
- dark matte or transparent UI surfaces;
- thin luminous edges.

Avoid:

- sci-fi city skylines;
- decorative machinery;
- random holograms;
- animated walls;
- persistent floating labels;
- ambient "AI faces";
- fake terminals.

## 31.2 Material hierarchy

### Data
Highest contrast, strongest semantic color.

### Active instrument
Bright enough to manipulate, localized.

### Inactive instrument
Dim.

### Environment
Lowest contrast.

## 31.3 Motion hierarchy

Motion must mean something.

Valid meanings:

- data change;
- focus;
- computation activity;
- collaboration presence;
- transition;
- uncertainty/stability visualization;
- live stream.

Idle decorative spinning should be rare. The TechnoCore may rotate slowly because it is a landmark/instrument, but intensity should remain below active data.

---

# 32. Game and XR Application Patterns to Borrow

Borrow principles, not skins.

## Half-Life: Alyx

Useful pattern:

- world-consistent interaction;
- strong object feedback;
- information close to the hand/object;
- physical actions with clear consequences.

Nemosyne adaptation:

- inspector follows active hand;
- manipulation is direct and predictable;
- analytical operations produce visible spatial consequences.

Do not borrow:

- game inventory metaphors that add unnecessary physical labor.

## Elite Dangerous

Useful pattern:

- stable spatial information zones;
- cockpit-like muscle memory;
- important panels where the user expects them.

Nemosyne adaptation:

- personal dashboard/panels maintain stable relative locations;
- navigation and investigation state occupy consistent zones.

Do not borrow:

- dense always-on cockpit instrumentation.

## No Man's Sky

Useful pattern:

- quick-access spatial/radial controls;
- diegetic/embodied UI;
- contextual action surfaces.

Nemosyne adaptation:

- small command surface with progressive disclosure.

## Gravity Sketch

Useful patterns:

- dominant/non-dominant role separation;
- quick menus on non-dominant hand;
- tear-off panels;
- immersive mode that hides UI;
- tutorials inside the working environment.

Nemosyne adaptation:

- off-hand command surface;
- precision panels can detach/world-lock;
- data-focus mode hides nonessential UI.

## Arkio

Useful patterns:

- menu can be hand-attached, summoned in front, or world-locked;
- fast tool selection;
- near/far interaction;
- scale-aware spatial review.

Nemosyne adaptation:

- command surface changes reference frame based on task duration;
- spatial scaling is explicit and reversible.

## ShapesXR

Useful patterns:

- lightweight collaborative presence;
- shared spatial frames;
- quick navigation to another participant's frame.

Nemosyne adaptation:

- collaborator frame is a navigable semantic context, not just an avatar position.

## Microsoft Mixed Reality interaction guidance

Useful patterns:

- small hand menus;
- avoid prolonged raised-arm interaction;
- prevent false activation;
- smooth near/far transition;
- explicit point/commit feedback;
- comfort-oriented placement.

## Apple spatial interface guidance

Useful patterns:

- use minimum necessary immersion;
- keep frequent interaction in comfortable field of view;
- avoid excessive head-locked UI;
- use familiar planar UI for UI-centric tasks;
- prioritize motion comfort.

---

# 33. Digital-Twin / Analytical Application Patterns

Nemosyne should borrow the strongest pattern from digital-twin systems:

> **The world is the index; detail is summoned contextually.**

Do not render every attribute, label, sensor, alert, chart, and control simultaneously.

Preferred flow:

```text
World structure
  → focus asset/region
  → contextual state
  → isolate
  → compare
  → inspect exact history
  → act / test
```

Use:

- LOD;
- semantic zoom;
- context-sensitive layers;
- stable spatial identifiers;
- world + precision-panel split;
- time replay;
- annotations;
- role-aware collaboration.

Avoid "control room wall" syndrome in VR.

---

# 34. AI Agent Design Instructions

An AI agent implementing or redesigning this UX MUST follow this sequence.

## Phase 1 — Map existing capabilities

Before changing UI, inspect:

- `docs/Nemosyne_Definitive_Vision_and_Roadmap.md`
- `docs/INTERACTIONS.md`
- `docs/ARTEFACTS.md`
- `src/vr/World.ts`
- `src/vr/coordinators/WorldSceneComposer.ts`
- `src/vr/artifacts/TechnoCoreNode.ts`
- `src/vr/artifacts/IceVaultNode.ts`
- `src/vr/artifacts/FarcasterPortal.ts`
- `src/vr/artifacts/HolographicInspector.ts`
- `src/vr/ui/*`
- NIL vocabulary
- RepresentationGraph runtime contracts
- DiscoveryEpisode / InvestigationBranchManager
- Moneta decision/explanation contracts.

Do not invent a second interaction or state architecture.

## Phase 2 — Build interaction inventory

For each visible object/control record:

- user purpose;
- semantic action;
- NIL verb;
- canonical state owner;
- reference frame;
- trigger/input;
- preview;
- commit;
- feedback;
- undo/recovery;
- research provenance effect;
- accessibility alternative.

Delete or redesign objects with no user purpose.

## Phase 3 — Prototype only the golden path

Prototype:

1. enter;
2. inspect;
3. isolate/filter;
4. record observation;
5. explain representation;
6. compare alternative;
7. challenge stability;
8. form/test hypothesis;
9. record discovery;
10. open investigation path;
11. freeze/export.

Do not begin with full settings, collaboration, generative layouts, or decorative assets.

## Phase 4 — Validate spatial ergonomics

On Quest-class hardware measure:

- selection error rate;
- hand travel;
- head rotation;
- panel reading comfort;
- time to open/close tools;
- false gesture activations;
- recovery time;
- frame time.

## Phase 5 — Add expert accelerators

Only after novice flow is coherent:

- advanced gestures;
- voice;
- quick portals;
- bimanual shortcuts;
- model comparison study controls.

---

# 35. Required UI Component States

Every interactive component should implement:

- Rest
- Focused
- Preview
- Armed
- Committed
- Busy
- Success
- Error
- Disabled
- Unavailable authority
- Research frozen, where relevant

Do not encode these states solely through color.

---

# 36. Validation Metrics

## Usability

- time to first successful inspection;
- time to first reversible analysis operation;
- menu invocation errors;
- false gesture activations;
- selection errors;
- undo/recovery success;
- task completion time;
- head/hand travel;
- number of open panels;
- accidental mode persistence.

## Spatial cognition

Can user answer:

- Where am I?
- What am I looking at?
- What changed?
- Why did it change?
- Where did this finding come from?
- How do I get back?
- Where is the alternative branch?
- Which evidence belongs to this conclusion?

## Epistemic UX

Can user distinguish:

- observation from finding;
- utility from statistical confidence;
- stability from confidence;
- model recommendation from researcher preference;
- agreement from validation;
- visual lens from analytical operation;
- current branch from frozen history?

## Research validity

- all semantic actions replay;
- model/kernel/ontology versions are preserved;
- treatment conditions are freezeable;
- adaptive changes are explicit;
- preference data is separable from discovery outcome;
- analyst and agent actions are attributable.

---

# 37. Anti-Patterns

Reject designs that:

- fill cyberspace with decorative objects;
- put every subsystem behind a different glowing monument;
- require walking to a landmark for routine controls;
- make TechnoCore a generic "settings orb";
- hide data operations inside portals;
- show confidence through generic red/yellow/green;
- make uncertainty continuously shake the world;
- use ten+ required gestures;
- place dashboards permanently in front of data;
- force camera motion;
- treat "more attention" as "more important";
- treat "more researchers agreed" as "more true";
- turn an LLM/agent into a floating character that speaks over the investigation;
- hide analytical fallbacks;
- erase refuted hypotheses;
- replace exact readouts with decorative 3D text;
- present model scores without provenance;
- let panels drift into unreachable space without recall;
- make the researcher remember invisible modes.

---

# 38. Feature-to-Experience Mapping

| Feature | UX role | Primary surface |
|---|---|---|
| DatasetEvidence | Trusted analytical facts | Inspector / TechnoCore explanation |
| RepresentationGraph | Spatial hypothesis | Data World |
| Moneta decision | Representation proposal | Data World + Explain |
| Rejected alternatives | Counterfactual reasoning | TechnoCore → Alternatives |
| FitnessModel | Explainable prior | Explain panel / research mode |
| NIL | Semantic action language | All input paths |
| DiscoveryEpisode | Research meaning | Beacon + Memory Palace |
| Investigation branching | Non-destructive reasoning | Memory Palace / portals |
| Replay | Reproducibility | Evidence Vault |
| `.nemosyne` package | Portable investigation | Evidence Vault / desktop export |
| Collaboration | Shared investigation | Peer presence + branch graph |
| Perception / gesture | Physical intent | Input layer only |
| Stability evidence | Skeptical challenge | TechnoCore → Challenge |
| Model Registry | Reproducibility/learning governance | Research/Explain panel |
| Study freeze | Experimental validity | Evidence Vault + research token |

---

# 39. Recommended Implementation Order

## UX-1 — Golden path simplification

- task-oriented command surface;
- novice interaction vocabulary;
- contextual inspector;
- reliable undo/return;
- panel reference-frame cleanup.

## UX-2 — TechnoCore as epistemic instrument

- summoned near-field Core Halo;
- Explain;
- Alternatives;
- Challenge;
- Provenance;
- Lens.

## UX-3 — Discovery workflow

- observation/question/hypothesis/test/conclusion flow;
- beacon lifecycle;
- Evidence Vault freeze.

## UX-4 — Memory Palace investigation graph

- path view;
- branch creation;
- branch compare;
- replay entry.

## UX-5 — Counterfactual and skeptical UX

- runner-up representations;
- stability envelopes;
- falsification prompts;
- inconclusive state.

## UX-6 — Collaboration

- peer frame;
- shared focus;
- attributable questions;
- branch disagreement.

## UX-7 — Research harness surfaces

- treatment freeze;
- blinded comparison;
- structured judgement;
- model provenance.

## UX-8 — Multimodal refinement

- haptic data encoding;
- sonification;
- voice shortcuts;
- accessibility variants.

---

# 40. Definition of UX Maturity

The Nemosyne UX is mature when a researcher can enter an unfamiliar session and, without understanding the software architecture:

1. identify the dataset and representation;
2. inspect a datum or structure;
3. perform and undo a meaningful operation;
4. ask why the representation was chosen;
5. compare a plausible alternative;
6. challenge an attractive pattern;
7. record an observation and hypothesis;
8. run an analytical test;
9. distinguish supported, refuted, and inconclusive outcomes;
10. recover the exact path to a finding;
11. branch from an earlier point;
12. collaborate without losing attribution;
13. freeze and replay the investigation;
14. move to desktop with the same semantic meaning.

The final experience should feel less like operating software and more like handling a scientific instrument whose workings remain inspectable.

The sparse cyber-world is successful when the researcher stops noticing the interface and starts remembering:

> **where the evidence was, where the argument forked, what failed, what survived, and why they believe the conclusion.**

---

# Appendix A — Suggested Interaction State Machine

```text
ENTER
  ↓
ORIENT
  ↓
EXPLORE ⇄ FOCUS ⇄ INSPECT
  │         │
  │         ├──────────────→ RECORD OBSERVATION
  │         │                         ↓
  │         │                      QUESTION
  │         │                         ↓
  │         │                     HYPOTHESIS
  │         │                         ↓
  │         ├→ EXPLAIN                TEST
  │         ├→ ALTERNATIVE             ↓
  │         ├→ CHALLENGE          EVALUATE RESULT
  │         │                    ↙      ↓       ↘
  │         │              SUPPORTED  REFUTED  INCONCLUSIVE
  │         │                    \       |       /
  │         │                     DISCOVERY / CONTINUE
  │         │                             ↓
  │         └──────────────→ MEMORY PALACE / BRANCH
  │                                       ↓
  └────────────────────────────────── FREEZE / EXPORT
```

# Appendix B — TechnoCore Interaction State

```text
AMBIENT LANDMARK
   │ focus
   ▼
FAR TARGET
   │ select
   ├── Quick Lens
   │
   │ hold + pull / Explain / Challenge
   ▼
SUMMONED CORE HALO
   ├── Explain
   ├── Alternatives
   ├── Challenge
   ├── Provenance
   └── Lens
        │
        ├── apply to current focus
        ├── drag to semantic target
        └── return/cancel
```

# Appendix C — Design Precedents Consulted

The UX principles in this document intentionally adapt established patterns rather than copying visual skins:

- Microsoft Mixed Reality design guidance: hand menus, point-and-commit, near/far interaction, comfort, spatial audio, hand coaching.
- Apple Human Interface Guidelines for immersive experiences, spatial windows/volumes, comfort, accessibility, and minimum necessary immersion.
- Gravity Sketch: dominant/non-dominant hand roles, quick access menus, tear-off interface windows, immersive workspace, in-VR tutorials.
- Arkio: hand-attached/floating/world-locked menu transitions, quick tool selection, direct scene manipulation, scale-aware VR workflows.
- ShapesXR: collaborative spatial frames and lightweight co-presence.
- Half-Life: Alyx: strong object affordances, local/diegetic information, direct physical cause/effect.
- Elite Dangerous: stable spatial information zones and muscle-memory-oriented cockpit organization.
- No Man's Sky: quick-access spatial menus and context-aware embodied UI.

These precedents are constraints and inspiration, not aesthetic targets. Nemosyne's visual identity remains its own: **sparse cyberspace, restrained instruments, data first.**
