# XR Simulator Stream Integration Review

**Status:** bounded review and implementation plan  
**Date:** 28 August 2026  
**Baseline:** `main@22ce66b9302b60a6a5573d50ffdd0083982c2430` (#488 merged)  
**Scope:** determine where XR simulation materially improves Nemosyne engineering quality and place only those uses into the existing Stream A/B/C and P1-U evidence programme.

**Planning integration:** applied to `ROADMAP.md`, `AI_XR_AGENT_HARNESS_SPEC.md`, and `STREAM_A_IMPLEMENTATION_QUALITY_CONTRACT.md` on this branch. During verification, the old RF-053 missing-WASM-copy claim was found stale on current main and was narrowed to clean-artifact re-verification rather than repeated as fact.

## Executive decision

Adopt **IWER (Immersive Web Emulation Runtime)** as Nemosyne's primary WebXR simulation layer for UI design, interaction verification and deterministic XR regression testing. It is the closest fit to the actual Nemosyne runtime because Nemosyne is a Three.js/WebXR browser application. Use the browser extension or `@iwer/devui` for interactive development; prefer the `iwer` runtime behind a dev/test-only adapter for repeatable automated scenarios.

Treat **Meta XR Simulator** as an optional comparative OpenXR external-driver candidate, not the canonical Nemosyne UI test runtime. Its Quest device/input simulation, synthetic environments and record/replay are valuable, but Nemosyne's shipped surface is Quest Browser/WebXR rather than a Unity/Unreal/native OpenXR app.

Simulation becomes an intermediate engineering evidence tier, not a replacement for physical qualification:

`unit/component -> real desktop product path -> WebXR simulator -> physical Quest 3S promotion`

Use the existing `XREvaluationEpisode.environment.mode` vocabulary (`browser-ci`, `desktop-simulator`, `quest-browser`) rather than inventing a second project completion vocabulary. `SIMULATOR` evidence may satisfy deterministic spatial/input/layout gates; it may not satisfy device-dependent comfort, optics, tracking-quality, thermal, memory or performance promotion claims.

## Evidence basis

Current Meta web guidance explicitly describes desktop browser testing with IWER before final Quest validation. IWER is a maintained TypeScript WebXR runtime that emulates the WebXR Device API and supports controller and hand input. Meta XR Simulator is a lightweight OpenXR runtime able to simulate Quest models, headset/controllers/hands, synthetic environments, and record/replay sessions.

Nemosyne already contains complementary dev tooling:

- `dev/spatial-tools/WebXR6DoFPoseRig.ts` provides deterministic pose fixtures;
- `dev/spatial-tools/SpatialErgonomicsLinter.ts` measures depth/FOV/visual-angle/target-size constraints;
- `dev/spatial-tools/SpatialSceneInspectorPlugin.ts` exposes a dev inspection endpoint;
- `docs/AI_XR_AGENT_HARNESS_SPEC.md` already defines `desktop-simulator` evidence and an optional `ExternalXRAdapter`.

The simulator should therefore replace or reduce hand-rolled **WebXR device/runtime mocking**, not replace Nemosyne's semantic inspection, ergonomics measurement or authority boundaries.

## Bounded value matrix

| Area | Simulator value | Why it improves engineering quality | What remains physical |
| --- | --- | --- | --- |
| **P1-U0 UI substrate / spatial tokens** | **High** | Repeated head-pose and stereo-context review of panel distance, angular size, clipping, reference-frame transitions and target geometry. Makes design-token changes falsifiable instead of screenshot-led. | Through-lens text quality, real Quest compositor/render cost, device frame pacing. |
| **P1-U1 / RF-049 Direct Touch and modality arbitration** | **Very high** | Deterministic controller/hand/head input can exercise near/far transitions, capture, cancel/recover, tracking loss, handedness, duplicate dispatch and modality parity through the real InputRouter path. | Real hand-tracking jitter/dropout, controller tracking quality, haptics and tactile acquisition. |
| **P1-U2/U3 spatial panels and precision surfaces** | **High** | Repeatable grab/pin/follow, scroll, focus, resize, occlusion and seated/standing reach scenarios; screenshot and semantic-scene evidence from known poses. | Long-form reading comfort, actual optics, physical reach fatigue. |
| **P1-U4 contextual task surface** | **High** | Verify that selection-anchored actions appear in comfortable view/reach zones, do not occlude evidence, do not steal scene input and survive head/body movement. | Human discoverability and cognitive load. |
| **P1-U5 TechnoCore** | **High** | Exercise approach, inspect, alternatives, remediation, preview/commit/cancel and modality parity as a spatial instrument rather than a unit-tested state model. | Whether the object is intuitively understood, comfortable and appropriately salient to humans. |
| **P1-U6 IceVault / semantic portals** | **High** | Test approach vectors, preview-before-travel, return routes, archive/restore affordances and accidental portal activation across deterministic poses. | Presence/comfort during transitions and real locomotion sensitivity. |
| **P1-U7 Memory Palace graph** | **Medium-high** | Verify graph-object focus, branch navigation, beacon/edge occlusion, spatial-return continuity and scale/layout behavior from repeatable viewpoints. | Human spatial-memory benefit and cognitive comprehension. |
| **P1-U8 consolidation/accessibility/comfort geometry** | **High for geometry, low for physiology** | Automatically audit persistent-surface count, visual angles, reach zones, head-locked violations, reduced-motion state, seated/standing layouts and occlusion. | Fatigue, nausea, vestibular comfort, true legibility and accessibility outcomes. |
| **P1-U9 / RF-008 product journey** | **Very high** | Adds the missing repeatable immersive product-path tier between desktop Playwright and hardware: load -> inspect -> challenge -> compare -> record -> Memory Palace -> replay/export, including recovery paths. | Final controller/hand task qualification and sustained human sessions. |
| **RF-050 UIKit evidence** | **Medium-high** | Can replace synthetic-only UI interaction evidence for clipping, scroll, panel behavior, object counts and spatial acquisition with real WebXR runtime evidence. | Quest draw calls/GPU/CPU/GC, optical legibility and sustained device frame pacing. |
| **XR Agent Harness** | **Very high** | IWER provides the maintained WebXR device/input substrate needed by Phase 2 operator embodiment and Phase 3 golden journeys; the Nemosyne harness retains semantic registry/evidence authority. | Agent-driven physical Quest validation remains a later adapter/device lane. |
| **Collaboration presence UI** | **Medium, after security fixes** | Multi-browser/simulated-user scenarios can test spatial presence, peer labels, pointing, occlusion and recovery. | Network/device variability and physical co-presence quality. Security authority still requires protocol/live-boundary tests. |
| **RF-015 Worker/WASM scheduling, RF-029 resource envelope, scientific semantics, replay integrity, auth/security protocols** | **Low/no direct value** | These are not XR-input/layout problems. Adding a simulator would make the evidence slower without improving the owning invariant. | Use their existing real browser/WASM/protocol/device gates as applicable. |

## Specific engineering-quality gains

### 1. Replace mock drift with a maintained WebXR runtime

The current `WebXR6DoFPoseRig` is useful deterministic scenario data but it is not a browser WebXR runtime. Keep its ergonomic presets or migrate them into scenario fixtures, then drive IWER's actual `XRSession`/`XRInputSource` state. Tests must enter the same InputRouter/Three.js WebXR paths used by Quest Browser.

Do **not** reimplement IWER features in Nemosyne. Any Nemosyne adapter should translate scenario intent into IWER controls and evidence, not become another device emulator.

### 2. Turn spatial heuristics into repeatable adversarial scenarios

Pair simulator poses with `SpatialErgonomicsLinter` and the future semantic scene registry. Minimum scenario matrix:

- standing and seated neutral;
- short/tall eye-height bounds;
- ±30/60/90 degree yaw approaches;
- near-touch approach -> contact -> commit -> retreat -> distance ray;
- cross-target capture/cancel;
- left/right handed operation;
- controller unavailable / hand unavailable / tracking loss and recovery;
- panel pin/follow transition;
- dense-data precision escape;
- large-text/high-contrast/reduced-motion modes;
- interrupted portal/archive/representation preview and safe return.

Measurements, not model commentary, satisfy automated thresholds.

### 3. Add a simulator evidence tier to UI PRs

For changes that alter WebXR interaction, panel spatial behavior, reference frames or world-object operation, Stream A should provide evidence from the cheapest applicable tiers:

1. unit/component/authority tests;
2. desktop product path;
3. IWER scenario(s) for the affected spatial/input invariant;
4. Quest evidence only when the change is device-dependent or at a milestone promotion gate.

This deliberately reduces routine headset churn while increasing merge-time XR coverage.

### 4. Keep physical evidence narrowly authoritative

Simulation must not close:

- Quest Browser-specific runtime defects that do not reproduce in desktop Chromium;
- real JS/WASM/GPU memory limits or thermal behavior;
- sustained 72/90 Hz frame pacing on Quest silicon;
- through-lens text readability and stereo comfort;
- real hand/controller tracking noise, latency, haptics or occlusion;
- arm fatigue, nausea, workload, cognitive burden or discoverability;
- 20+ minute U8/U9 comfort sessions;
- PERF-04 10M device qualification.

## Tool selection boundaries

### Primary: IWER

Use `iwer` as a **dev/test-only** dependency or isolated test harness dependency. Prefer programmatic runtime control for deterministic tests. `@iwer/devui` or the IWE browser extension is appropriate for manual design/debugging but must not be the CI authority.

Before adoption, the implementation tranche must prove:

- no IWER/dev UI code is reachable from the production bundle;
- simulator input traverses the real WebXR/InputRouter path;
- core scenarios can be deterministic and replayable;
- controller and hand capabilities used by Nemosyne are actually supported by the selected IWER version;
- unsupported emulator capabilities surface as `UNSUPPORTED`, not fake success.

### Secondary: Meta XR Simulator

Keep as an optional `ExternalXRAdapter` experiment for OpenXR/compositor/device-model scenarios only where it can drive the actual browser/runtime path without a native wrapper. Do not introduce Unity or Unreal merely to test Nemosyne. Its record/replay and multi-session capabilities are comparative references, not a reason to fork the product runtime.

## Integration into current streams

### Stream A: forward UI implementation

Add **P1-USIM — WebXR simulator substrate and golden spatial scenarios** as a small enabling tranche that can run in parallel with analytical RF-015/RF-029 work and should land before substantial remaining P1-U6/U7/U8 implementation.

**USIM-0 selection/adaptor**

- add dev/test-only IWER runtime behind a `WebXRSimulatorAdapter`/test harness boundary;
- prove production bundles contain no simulator dependency path;
- map existing `WebXR6DoFPoseRig` presets into reusable scenario fixtures rather than maintaining a separate mock runtime;
- retain `SpatialErgonomicsLinter` as measurement authority;
- feed simulator environment metadata into `XREvaluationEpisode`.

**USIM-1 reference interaction scenarios**

- RF-049 near/far/capture/cancel/recover scenario;
- panel pin/follow/grab/scroll scenario;
- contextual-task-surface selection/occlusion scenario;
- TechnoCore inspect/alternative/remediation preview scenario.

**USIM-2 world-semantic scenarios**

- IceVault freeze/restore/compare and abort/recovery;
- portal preview/travel/return without analytical mutation;
- Memory Palace observation -> hypothesis/test/finding -> branch/return journey;
- accessibility modes and seated/standing geometry.

USIM is an enabler, not a new product epic. Each scenario should be implemented when its owning P1-U surface is active rather than building a large simulator framework up front.

### Stream B: adversarial review/fix-forward

Extend the UX production-path evidence rule:

- WebXR interaction/layout changes must be attacked in IWER when the simulator can exercise the claimed invariant;
- Stream B selects adversarial poses and input transitions independently of the implementer's happy path;
- simulator green is **not** physical verification;
- RF-049 code-level parity may advance to simulator-verified evidence while Quest qualification remains open;
- RF-050 should split synthetic/browser/simulator/physical evidence explicitly;
- RF-008/U9 should require at least one immersive simulator journey before physical promotion.

Do not require simulator evidence for analytical, provenance or security changes that do not depend on XR presentation/input.

### Stream C: security/live-boundary assurance

Simulator use is deliberately narrow:

- after RF-037/RF-038/RF-057 are fixed, use multiple simulated/browser sessions to attack **presentation consequences** of authenticated presence: correct peer identity labels, pointing target, stale-pose removal, disconnect/reconnect and observer restrictions;
- do not use simulator success as evidence that signalling tickets, authorization, replay prevention or channel-bound identity are secure;
- preserve live protocol/hostile-boundary tests as the security authority.

### XR Agent Harness

Move IWER evaluation from the late Phase 6 discovery-only position into **Phase 2 operator embodiment** as the preferred browser driver candidate. Phase 6 remains the place for cross-runtime/physical qualification and any optional Meta XR Simulator adapter. This avoids building a second synthetic WebXR runtime inside the agent harness before evaluating the maintained one.

## Roadmap integration targets

Update the live roadmap as follows:

- **RF-008:** add IWER immersive product-path journey as required evidence between Playwright and Quest.
- **RF-049 / AR-7:** add simulator RF-049 transition/capture/adversary evidence; preserve physical hand/controller exit gate.
- **RF-050 / AR-8:** use simulator for real WebXR panel/scroll/clipping/acquisition evidence; preserve Quest frame/optics/GC exit evidence.
- **P1-U0/U1:** add simulator acceptance tier for spatial tokens/reference interaction.
- **P1-U2/U3/U4/U5:** simulator scenarios become normal tranche-specific evidence where applicable.
- **P1-U6/U7/U8:** add world-semantic, return/recovery, occlusion/reach and accessibility scenarios.
- **P1-U9:** change evidence ladder to desktop Playwright -> immersive IWER journey -> physical Quest qualification.
- **RF-033:** simulator lane may become an independent CI signal once stable; do not make early experimental emulator flakiness block unrelated work.
- **XR Agent Harness Phase 2/3:** adopt the same IWER adapter/scenario vocabulary rather than a second emulator abstraction.

## Sequencing recommendation

1. Finish the already-started RF-015 real browser Worker/WASM evidence tranche independently; XR simulation does not improve that invariant.
2. Land **USIM-0** before or at the start of resumed P1-U6 work.
3. Add USIM scenarios incrementally with U6 -> U7 -> U8, while backfilling one RF-049 reference scenario early.
4. Use the accumulated scenarios to make U9 simulator evidence cheap rather than building U9 automation at the end.
5. Run physical Quest 3S at milestone gates: RF-049/U1 qualification, U8 sustained comfort/accessibility, U9 full journey/performance, and PERF-04 scale qualification.

This changes the ratio of headset use, not the authority of headset evidence.

## Non-goals

This review does not authorize:

- migration from Three.js/WebXR to IWSDK, Unity or Unreal;
- shipping IWER/IWE/Meta XR Simulator code in production;
- removing physical Quest gates;
- claiming simulator timing as Quest performance;
- replacing human usability studies with an AI or simulator;
- changing analytical, Moneta or investigation authority;
- broad implementation of the proposed XR Agent Presence Plane.

## Exit criteria for the simulator-enabling tranche

USIM-0 is ready for broader UI consumption only when:

1. a real Nemosyne WebXR session starts under IWER without changing production semantics;
2. one production UI control is activated through the real InputRouter with controller simulation and one supported hand-input path;
3. deterministic head/controller scenarios can be replayed and emit bounded `XREvaluationEpisode` evidence;
4. `SpatialErgonomicsLinter` can evaluate the simulated pose against real rendered UI targets;
5. disabling the simulator restores ordinary desktop/native-WebXR behavior with no persistent side effects;
6. the production build proves no simulator/dev-ui dependency is shipped;
7. the review records exactly which IWER capabilities are unsupported or not trustworthy enough for gating;
8. physical Quest U9/PERF-04 gates remain explicitly open.
