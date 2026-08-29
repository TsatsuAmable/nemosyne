# P1-UV Visible Product Convergence

**Status:** PLANNED / REQUIRED BEFORE P1-U9 PROMOTION EVIDENCE  
**Programme:** P1-U whole-product investigation UX convergence  
**Placement:** after the current P1-U2..P1-U8 substrate/interaction work and before P1-U9 product/device qualification  
**Depends on:** stable P1-U0/U1 input semantics; landed SpatialPanel/shared-control substrate; P1-U4 contextual task semantics; P1-U5 TechnoCore semantics; P1-U6/P1-U7 functional object contracts as they converge  
**Blocks:** P1-U9 completion claims, P1-W production-wiring entry, minimal private-preview promotion

## Why this tranche exists

Recent P1-U work has materially improved the UI architecture without producing an equally obvious change in what an investigator sees and experiences. Direct touch, pointer capture, SpatialPanel migration, panel budgeting, semantic intents, TechnoCore responsibilities, the Evidence Vault, Memory Palace graph machinery, accessibility controls and IWER testability are necessary foundations. They are not, by themselves, product convergence.

The failure mode to prevent is **substrate-complete / experience-unchanged**: a PR can replace classes, move responsibilities, improve tests and still leave the normal investigator journey looking and behaving substantially like the old dashboard/panel constellation.

P1-UV therefore treats visible presentation and task-flow convergence as a first-class engineering deliverable. The normal production path must become recognisably the Nemosyne interface described by the governing UX/VR design work: sparse, data-first, spatially purposeful, contextual, epistemically legible and free of decorative world furniture.

## Governing invariant

> **A UI tranche is not complete merely because the new substrate exists. The normal investigator journey must be visibly and behaviorally transformed through the real production path, while preserving semantic parity and scientific authority.**

This means completion requires evidence of what the investigator actually sees, can discover and can do. Unit tests proving that a class exists, that a controller was wired or that a hidden surface can be summoned are necessary but insufficient.

## Product principles

1. **Data is the visual protagonist.** UI surrounds, annotates and acts on the data; it must not become the scene.
2. **Tasks outrank subsystems.** Primary actions are expressed as investigator verbs and appear at the locus of work. Subsystem names belong in diagnostics or advanced detail, not the novice path.
3. **Persistent objects earn their volume.** TechnoCore, Vault, portals, beacons and other world objects must expose a useful, testable function or be removed/demoted.
4. **Panels are precision instruments, not architecture made visible.** Forms, dense evidence, exact values and settings may be planar; ordinary investigation must not reconstruct a floating desktop.
5. **Spatial state carries meaning.** Selection, hypotheses, evidence, contradictions, branches, alternatives and archived states should become perceptible in the world where that improves reasoning.
6. **No visual layer may invent analytical truth.** Presentation consumes Atlas/Rust/Moneta evidence and semantic state; it does not infer shadow scientific facts from appearance.
7. **One semantic action across modalities.** Desktop, ray, controller and direct touch may look different mechanically but dispatch the same governed intent.
8. **Calm by default.** Motion, glow, audio, particles and chrome communicate state or affordance. They are not ambient garnish competing with data.
9. **Evidence over screenshots-as-opinion.** Screenshot baselines are useful visual contracts, but simulator, product-path and physical-device evidence remain necessary for spatial fitness.

## Non-goals

P1-UV does **not**:

- restart the input, panel or World architecture after the current convergence work;
- create another UI framework or parallel control stack;
- add a new panel for every capability;
- move analytical computation or scientific inference into TypeScript/UI code;
- introduce broad new product features merely to make the interface look richer;
- use Blender or bespoke 3D assets where simpler geometry communicates the function better;
- replace P1-U9 Quest/device qualification with desktop screenshots or IWER evidence;
- pursue ornamental polish before task hierarchy and object purpose are correct.

## Required tranche sequence

### P1-UV0 — capture the current production visual baseline

**Purpose:** make the present experience inspectable so later work cannot claim transformation without comparison.

- [ ] choose 3-5 stable representative investigation states covering: fresh start/orientation, focused observation/structure, Moneta decision/NIL, evidence/hypothesis state and saved/replay state;
- [ ] capture deterministic desktop production-build screenshots for those states at governed viewport/settings;
- [ ] capture equivalent IWER poses where the state is simulator-testable;
- [ ] inventory every visible persistent surface/object in normal analyst mode and record its user purpose, reference frame, summon/dismiss path and owning semantic state;
- [ ] classify each visible element as `KEEP`, `CONVERGE`, `DEMOTE`, `REPLACE` or `REMOVE`;
- [ ] identify any capability that exists only in legacy DOM/diagnostic UI or only in an undiscoverable gesture;
- [ ] record the current first-use path from launch to first meaningful inspection action.

**Exit gate:** a reproducible before-state exists and can be compared to subsequent production builds. The inventory explains why every persistent object is present or marks it for removal.

### P1-UV1 — visual hierarchy and normal-mode shell convergence

**Purpose:** make the application read as one coherent instrument rather than a collection of migrated surfaces.

- [ ] define the normal analyst shell for desktop and immersive modes around the canonical investigator journey;
- [ ] demote diagnostic/superuser surfaces from the default visual hierarchy and ensure they cannot accidentally dominate first use;
- [ ] remove redundant legacy navigation once semantic-intent parity exists;
- [ ] make status, kernel readiness, dataset identity and current investigation context legible without a telemetry/dashboard wall;
- [ ] ensure the first visible choices are task-oriented and bounded; avoid exposing internal module names as the primary information architecture;
- [ ] preserve an explicit advanced/diagnostic route for development and research operations without mixing it into analyst mode.

**Exit gate:** a fresh user can identify the dataset/workspace, primary locus of work and next useful action without reading subsystem labels or opening a general-purpose menu wall.

### P1-UV2 — contextual locus-of-work convergence

**Purpose:** make the interaction architecture from P1-U4 visible in the actual experience.

- [ ] bind `Inspect`, `Compare`, `Challenge`, `Record`, `Navigate` and `More` to selection/object-attached presentation rather than a detached action list;
- [ ] surface disabled/unavailable reasons in-place when they matter for comprehension;
- [ ] ensure contextual controls preserve the focused data object/structure and do not obscure the evidence being inspected;
- [ ] use short-lived contextual surfaces for common actions and summon precision panels only for dense/exact work;
- [ ] enforce the normal three-surface budget in real journeys, including replacement and pinned-surface behavior;
- [ ] ensure no essential task requires discovery of a legacy global panel or memorised gesture.

**Exit gate:** common investigation actions originate visibly from the object/selection/context that motivated them. A normal inspect/compare/challenge flow does not grow a panel constellation.

### P1-UV3 — make epistemic world objects visibly functional

**Purpose:** convert architectural concepts into useful spatial instruments.

#### TechnoCore

- [ ] make TechnoCore visibly respond to the current representation decision state rather than functioning as a decorative hub;
- [ ] expose why/alternatives/constraints/remediation through a coherent physical interaction hierarchy;
- [ ] distinguish `DECISIVE`, `INFEASIBLE`, `UNDERDETERMINED` and `AMBIGUOUS` states without implying statistical confidence;
- [ ] make preview/revert of representation changes spatially and visually legible.

#### Evidence/Ice Vault

- [ ] give the Vault an immediately legible archive/freeze/recovery role;
- [ ] visually distinguish current, frozen, restoring, incompatible and integrity-failed states;
- [ ] remove/demote the object from the normal world if the private-preview archive/recovery workflow is not production-usable.

#### Portals

- [ ] make destination and return semantics visible before traversal;
- [ ] reserve portals for semantic travel/context changes, never ordinary analytical mutation;
- [ ] visually distinguish overview, branch, saved-investigation/detail and collaboration destinations where those capabilities are available.

#### Memory Palace

- [ ] embody observations, questions, hypotheses, tests, findings, contradictions and branch points as restrained epistemic objects with non-colour state cues;
- [ ] reveal reasoning threads on focus/context rather than permanently rendering graph spaghetti;
- [ ] make evidence and counterevidence inspectable from the relevant epistemic object;
- [ ] preserve object identity and selection through representation changes/replay where valid.

**Exit gate:** every persistent world object present in normal analyst mode has a user-testable function, communicates its state and can be explained without reference to its implementation class.

### P1-UV4 — Nemosyne visual system convergence

**Purpose:** make shared UI implementation produce a deliberate, sparse visual language.

- [ ] define/freeze a versioned presentation token set for typography hierarchy, angular text sizing, spacing, target volumes, panel depth, corner/chrome treatment, semantic state cues, focus, selection and disabled states;
- [ ] define restrained material/emissive rules so state and affordance are visible without turning the scene into neon instrumentation;
- [ ] standardise shared control appearance across Settings, Inspector, Schema Mapping, Evidence/History and other precision surfaces;
- [ ] standardise grab/pin/follow/dismiss affordances and make movable surfaces visibly movable without permanent heavy chrome;
- [ ] ensure high-contrast, large-text, colour-vision and reduced-motion modes preserve hierarchy rather than merely changing CSS/settings values;
- [ ] maintain clear visual distinction between data marks, analytical structures, evidence/provenance objects, task controls, navigation and diagnostics;
- [ ] use Blender-assisted geometry only when it improves functional comprehension and remains within Quest budgets.

**Exit gate:** migrated surfaces no longer merely share code; they visibly belong to one system, and the data remains more visually salient than the surrounding interface.

### P1-UV5 — investigation-state legibility and transitions

**Purpose:** let the world communicate what changed and why without requiring log reading.

- [ ] define visible state transitions for dataset load, analytical work pending/complete/refused, representation decision/NIL, selection/focus, recorded observation, hypothesis/test result, branch, archive/freeze and replay verification;
- [ ] preserve spatial continuity across representation transitions when semantic identity survives;
- [ ] make consequential changes previewable/reversible and clearly separate preview from commit;
- [ ] provide persistent actionable error/recovery presentation for kernel unavailable, unsupported-at-scale, replay/tamper failure and unavailable optional services;
- [ ] avoid hidden state changes behind portal travel, animation or gesture-only feedback;
- [ ] respect reduced-motion preferences while retaining semantic state change cues.

**Exit gate:** an investigator can answer “what changed?”, “what is selected?”, “what evidence supports this?”, “can I undo/recover?” and “where did I come from?” from the product surface itself.

### P1-UV6 — desktop and immersive presentation parity

**Purpose:** prevent the desktop fallback and VR interface from becoming two unrelated products.

- [ ] redesign `AnalystJourneyControls`/desktop shell as a purposeful counterpart to the spatial journey rather than leaving raw engineering controls as the primary experience;
- [ ] preserve the same task vocabulary and semantic intents across desktop and immersive modes;
- [ ] keep platform-appropriate mechanics: desktop may use compact planar controls while VR uses spatial/contextual presentation;
- [ ] ensure all essential operations have discoverable desktop and XR paths, with diagnostics clearly separated;
- [ ] prove keyboard/focus order, pointer use, controller/ray/direct-touch paths and cancellation semantics against the same intent outcomes.

**Exit gate:** desktop is a deliberate non-XR Nemosyne interface, not a debug console, and completing the core investigation journey produces equivalent semantic outcomes across modalities.

### P1-UV7 — visible-product evidence gate

**Purpose:** prevent future “UI complete” claims that are invisible in the product.

For each materially user-visible P1-UV PR:

- [ ] capture before/after screenshots of the affected canonical state from the real production build;
- [ ] run product-path Playwright evidence for the task changed by the PR;
- [ ] run IWER evidence when spatial/input behavior is simulator-testable;
- [ ] assert the normal persistent-surface budget and absence/demotion of explicitly retired legacy surfaces;
- [ ] assert the semantic-intent outcome, not only DOM/component existence;
- [ ] conduct an independent adversarial UI/UX review asking whether the change is perceptible, discoverable and useful to an investigator;
- [ ] record any deliberately deferred physical-device question for P1-U9 rather than falsely closing it with simulator evidence.

**Tranche exit gate:** the canonical before/after set demonstrates a material visual/task-flow change; core journeys pass on the production desktop path and simulator-testable XR path; no critical function remains trapped in legacy/diagnostic presentation; an independent review agrees that the product, not merely the substrate, converged.

## Canonical acceptance journeys

P1-UV must be judged through complete journeys rather than isolated component demos.

### Journey A — first insight

`launch -> orient -> load/select dataset -> understand current representation -> inspect a meaningful structure/observation -> record an observation`

Acceptance:

- next actions are visible without subsystem knowledge;
- data remains central throughout;
- no more than the normal surface budget is required;
- the recorded observation is visibly connected to its target/evidence context.

### Journey B — skeptical investigation

`inspect -> challenge -> view counterevidence/constraints -> compare alternative representation -> accept/reject/revert -> record conclusion`

Acceptance:

- TechnoCore/Moneta state is epistemically honest;
- alternatives and constraints are understandable without reading a raw event log;
- preview and committed state are visibly distinct;
- representation changes preserve relevant focus/context.

### Journey C — Memory Palace reasoning

`observation -> question/hypothesis -> test -> support/refute/inconclusive -> inspect evidence/counterevidence -> branch`

Acceptance:

- epistemic object lifecycle is visible;
- reasoning relationships are available without permanent clutter;
- branch provenance and return navigation remain clear.

### Journey D — archive, replay and recovery

`freeze/save -> continue investigation -> return to frozen state / compare -> export .nemosyne -> replay -> handle verified or tampered result`

Acceptance:

- Vault state is functional and legible;
- archival/recovery is not a decorative metaphor;
- integrity/replay outcomes are persistent and actionable;
- source investigation is not silently mutated on failed replay.

## Quantitative/structural guardrails

These are design guardrails, not substitutes for user evidence:

- normal analyst mode: **<= 1 primary + 1 inspector/context + 1 secondary reference surface** unless explicitly pinned by the investigator;
- essential novice task vocabulary uses investigator verbs, not implementation/subsystem names;
- no persistent head-locked analytical panel; head lock remains transient critical status only;
- no essential action is gesture-only;
- every normal-mode persistent world object has at least one production-path investigator function and a visible state contract;
- no user-visible analytical claim is sourced only from presentation heuristics;
- no P1-UV completion claim may cite only class/unit tests;
- screenshot evidence must come from the built production path, not a hand-assembled storybook/demo component;
- physical comfort, optics, hand/controller tracking, real haptics and target-device performance remain P1-U9/Quest evidence.

## Interaction with existing P1-U work

P1-UV does not invalidate the landed substrate. It is the convergence layer that consumes it:

- **P1-U0/U1:** provide stable reference frames, interaction events, capture/cancel/commit and direct-touch/ray semantics;
- **P1-U2/U3:** provide SpatialPanel and shared precision-control substrate;
- **P1-U4:** provides the contextual task/action model that P1-UV must make visually primary;
- **P1-U5:** provides TechnoCore/Moneta semantics that P1-UV must embody honestly;
- **P1-U6:** provides Vault/portal functional semantics; P1-UV decides whether they earn persistent visual presence;
- **P1-U7:** provides Memory Palace epistemic graph semantics that P1-UV must make comprehensible in space;
- **P1-U8:** provides consolidation/accessibility/comfort rules that P1-UV turns into a coherent visual system;
- **P1-U9:** remains the authoritative product/device evidence tranche after P1-UV converges the treatment.

## Dependency order change

The effective P1-U order becomes:

`U0/U1 -> U2/U3/U4 -> U5/U6/U7 -> U8 -> P1-UV -> U9 -> P1-W -> private preview`

Parallel work remains allowed where dependencies do not conflict, but **P1-U9 may not certify the old visual treatment while P1-UV remains incomplete**, and P1-W must not wire production services into UI surfaces still scheduled for structural replacement.

## Completion vocabulary

- **PLANNED:** this document exists; no production presentation convergence implied.
- **IMPLEMENTATION PARTIAL:** one or more UV tranches have landed, but canonical journeys or visible treatment remain mixed legacy/new.
- **IMPLEMENTATION LANDED / REVIEW ACTIVE:** UV0-UV7 are implemented with production-build before/after and journey evidence, but independent/device review may still reopen findings.
- **VERIFIED COMPLETE:** independent review plus P1-U9 physical/product evidence agree that the converged visual treatment is discoverable, semantically correct, comfortable and fit for promotion.

## Promotion rule

P1-UV is a **private-preview convergence gate**. It cannot be waived merely because the underlying UI classes, semantic intents or tests are complete.

Before P1-U9 can claim the converged UI treatment is ready for physical promotion, the evidence must answer all of the following affirmatively:

1. Does a fresh production build look materially different from the pre-P1-UV baseline in the intended direction?
2. Is the canonical investigator journey task-first rather than subsystem/panel-first?
3. Are TechnoCore, Vault/portals and Memory Palace objects visibly useful where they remain present?
4. Is the data more visually prominent than the UI?
5. Can essential tasks be discovered without expert gestures or hidden diagnostic controls?
6. Do desktop and XR presentation paths dispatch the same governed intents?
7. Are scientific/epistemic states communicated without inventing certainty or analytical authority?
8. Do Playwright and IWER evidence exercise the real product path, with unresolved Quest-only questions explicitly carried into P1-U9?

If any answer is no, P1-UV remains **IMPLEMENTATION PARTIAL / REVIEW ACTIVE** and P1-W/private-preview promotion stays blocked.
