# XR Simulator Stream Integration — Post-Review

**Date:** 28 August 2026  
**Baseline:** `main@22ce66b9302b60a6a5573d50ffdd0083982c2430`  
**Branch:** `docs/xr-simulator-stream-integration`

## Result

The bounded review remains valid after integration into the live planning documents.

- IWER is the preferred WebXR simulator for Nemosyne's browser/XR UI and interaction evidence.
- Meta XR Simulator remains an optional later OpenXR/compositor comparison adapter, not a reason to introduce Unity/Unreal/native wrapping.
- Simulator evidence is inserted only for simulator-testable spatial/input/layout invariants; analytical, provenance and security work does not inherit an irrelevant simulator gate.
- Physical Quest 3S remains authoritative for Quest Browser/device memory and frame pacing, optics/legibility, tracking/haptics, fatigue/comfort and promotion evidence.
- Existing `WebXR6DoFPoseRig` presets become candidate scenario fixtures rather than a competing mock WebXR runtime; `SpatialErgonomicsLinter` remains the measurement layer.
- The XR Agent Harness now evaluates IWER in Phase 2 operator embodiment instead of deferring all simulator selection until Phase 6.
- Stream C simulator use remains limited to spatial/presence presentation consequences after live authentication/identity authority is fixed.

## Adversarial checks

1. **Framework drift:** rejected migration to IWSDK/Unity/Unreal. Three.js/WebXR and existing semantic authorities remain unchanged.
2. **Evidence inflation:** simulator green cannot close physical Quest gates or human usability/comfort claims.
3. **CI tax:** simulator is not required for unrelated Rust/WASM, replay, provenance or security changes; a blocking CI lane is deferred until scenarios are stable.
4. **Mock replacement overreach:** the simulator does not replace semantic scene inspection or the ergonomics linter.
5. **Production contamination:** planned IWER integration must prove no simulator/dev-UI path ships in the production bundle.
6. **Security false proof:** multi-session simulation may test presence UI, never ticket/replay/channel-identity security.
7. **Roadmap truth:** #488 is now reflected in the current resource frontier. The old RF-053 missing-WASM-copy claim was found stale on current main because the active `wasmServePlugin` now copies `wasm/pkg` into `dist/wasm/pkg`; RF-053 is narrowed to clean-artifact re-verification rather than prematurely closed.

## Remaining implementation work

No simulator dependency or product code is added by this planning PR. The first implementation slice is **P1-USIM / USIM-0**: a dev/test-only IWER adapter, one production InputRouter controller path, one supported hand path, deterministic evaluation evidence, ergonomics integration and production-bundle isolation. This can run in parallel with the current RF-015 real browser Worker/WASM measurement tranche and should land before substantial remaining P1-U6/U7/U8 work.

Status: **PLANNING LANDED ON BRANCH / IMPLEMENTATION NOT STARTED**.
