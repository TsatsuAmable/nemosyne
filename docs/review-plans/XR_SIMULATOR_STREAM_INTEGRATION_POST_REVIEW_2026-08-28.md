# XR Simulator Stream Integration — Post-Review

**Date:** 28 August 2026  
**Baseline:** `main@22ce66b9302b60a6a5573d50ffdd0083982c2430`  
**Branch:** `docs/xr-simulator-stream-integration`

## Result

The bounded review remains valid after integration into the live planning documents and the architecture-wide extension.

- IWER is the preferred WebXR simulator for Nemosyne's browser/XR UI, interaction and deterministic architecture-conformance evidence.
- Meta XR Simulator remains an optional later OpenXR/compositor comparison adapter, not a reason to introduce Unity/Unreal/native wrapping.
- Simulator evidence is inserted only where it can drive the real invariant. Rust/WASM mathematics, cryptographic identity, scale ceilings and device-dependent Quest claims do not inherit irrelevant simulator gates.
- Physical Quest 3S remains authoritative for Quest Browser/device memory and frame pacing, optics/legibility, tracking/haptics, fatigue/comfort and promotion evidence.
- Existing `WebXR6DoFPoseRig` presets become candidate scenario fixtures rather than a competing mock WebXR runtime; `SpatialErgonomicsLinter` remains the measurement layer.
- The XR Agent Harness now evaluates IWER in Phase 2 operator embodiment instead of deferring all simulator selection until Phase 6.
- Stream C may use simulator-driven multi-client/browser scenarios only after the real authentication/identity authority is fixed; security evidence remains owned by the live signalling/network boundary.

## Architecture extension

P1-USIM now contains an explicit **USIM-A Architecture Conformance Pack** in addition to UI scenarios:

1. **XR lifecycle / async race:** churn XR session visibility and input sources while a real async analytical operation is in flight. Atlas/Worker generation and output identity remain authoritative; stale captures/listeners cannot cross session generations.
2. **Presentation-independent reproducibility:** save/replay the same investigation under different poses/modalities/panel layouts. RF-046 semantic digest, canonical dataset identity and replay outcome remain identical while presentation state may differ.
3. **Reference-space integrity:** seated/standing, `local-floor`, recenter/reset-view and locomotion changes cannot mutate durable evidence or Memory-Palace coordinates without an explicit governed semantic action.
4. **Resource lifecycle balance:** repeated enter/exit/load/representation/save/restore cycles must keep listeners, interactables, updatables, panels, renderer objects, Worker instances and JS-heap trend bounded. This is PERF-05 leak evidence, not Quest resource qualification.
5. **Clean-production immersive boot:** serve only `dist`, enter simulated immersive WebXR, initialize real module Worker + real WASM, execute an authoritative operation, render the result and export/replay it. This supports RF-053/RF-056 pre-deployment conformance without replacing deployed-service or hardware gates.
6. **Moneta presentation independence:** head pose, handedness, modality, panel visibility and desktop-vs-XR entry must not alter a representation decision unless a device/display capability is an explicit governed requirement recorded in provenance.

A gated **USIM-C Collaboration Conformance** tranche is also planned after RF-037/RF-038/RF-057 authority fixes. It will run multiple authenticated simulated XR clients through the real signalling/WebRTC path for presence, reconnect, stale-pose cleanup and forbidden-observer mutation falsifiers. IWER is only the client/input driver; the security claim is satisfied by the real authority rejecting or accepting behavior correctly.

## Adversarial checks

1. **Framework drift:** rejected migration to IWSDK/Unity/Unreal. Three.js/WebXR and existing semantic authorities remain unchanged.
2. **Evidence inflation:** simulator green cannot close physical Quest gates or human usability/comfort claims.
3. **CI tax:** simulator is not required for unrelated Rust/WASM, replay, provenance or security changes; a blocking CI lane is deferred until scenarios are stable.
4. **Mock replacement overreach:** the simulator does not replace semantic scene inspection, canonical domain tests or the ergonomics linter.
5. **Production contamination:** planned IWER integration must prove no simulator/dev-UI path ships in the production bundle.
6. **Security false proof:** simulator-driven clients may exercise the real security boundary, but simulator success itself is never authentication/replay/channel-identity evidence.
7. **Presentation authority drift:** XR pose, reference space and modality are presentation/input observations. They may not become implicit Atlas, Moneta, digest or scientific-state inputs.
8. **Performance overclaim:** lifecycle leak trends measured under desktop simulation are useful engineering evidence but cannot be translated into Quest memory, thermal or frame-budget claims.
9. **Roadmap truth:** #488 is reflected in the current resource frontier. The old RF-053 missing-WASM-copy claim was found stale on current main because the active `wasmServePlugin` now copies `wasm/pkg` into `dist/wasm/pkg`; RF-053 is narrowed to clean-artifact re-verification rather than prematurely closed.

## Remaining implementation work

No simulator dependency or product code is added by this planning PR. The first implementation slice remains **P1-USIM / USIM-0**, but its acceptance target now deliberately enables USIM-A: a dev/test-only IWER adapter, real WebXR -> InputRouter routing, deterministic evidence recording, ergonomics/scene inspection integration and production-bundle isolation. Once that substrate is stable, architecture-conformance scenarios should land before relying on the simulator as a routine merge-time XR gate.

This work can run in parallel with the current RF-015 real browser Worker/WASM measurement tranche and should land before substantial remaining P1-U6/U7/U8 work.

Status: **PLANNING LANDED ON BRANCH / IMPLEMENTATION NOT STARTED**.
