# XR Simulator Architecture Extension

**Date:** 28 August 2026  
**Baseline:** `main@c6b7e6a21663281ee83a564a5dbcd95138ca7de5` (#489 merged)  
**Branch:** `docs/xr-simulator-architecture-extension`

## Purpose

Extend the simulator plan beyond UI verification into deterministic cross-layer architecture conformance, without promoting simulator evidence beyond what desktop WebXR can actually prove.

## Planned architecture-conformance scenarios

1. **XR lifecycle / async race** — churn session visibility/input sources/exit/re-entry while a real async analytical operation is in flight. Atlas/Worker generation and output identity remain authoritative; stale captures/listeners must not cross XR session generations.
2. **Presentation-independent reproducibility** — save/replay the same investigation under different poses, modalities and panel layouts. Canonical dataset identity, semantic replay outcome and RF-046 digest remain identical while presentation state may differ.
3. **Reference-space integrity** — `local-floor`, seated/standing height, recenter/reset-view and locomotion cannot mutate durable evidence, annotations or Memory-Palace coordinates without an explicit governed semantic action.
4. **Resource lifecycle balance** — repeat XR enter/exit/load/representation/save/restore cycles and measure bounded listeners, interactables, updatables, panels, renderer objects, Worker instances and JS-heap trend. This is PERF-05 leak evidence, not Quest performance qualification.
5. **Clean-production immersive boot** — serve only `dist`, enter simulated immersive WebXR, initialize the real module Worker and real WASM kernel, execute an authoritative operation, render a spatial result and export/replay it. This supports RF-053/RF-056 pre-deployment conformance without replacing deployed-service or physical-device gates.
6. **Moneta presentation independence** — head pose, handedness, input modality, panel visibility and desktop-vs-XR entry do not alter representation decisions unless device/display capability is an explicit governed requirement recorded in provenance.

## Collaboration follow-on

**USIM-C** is gated on RF-037/RF-038/RF-057 authority fixes. After those land, two or more authenticated simulated XR browser clients may exercise the real signalling/WebRTC path for presence, pointing, disconnect/reconnect cleanup, stale-pose removal and forbidden-observer mutation attempts. The simulator is only the client/input driver; security evidence remains owned by the real admission/role/channel authority.

## Evidence boundaries

This extension does not make simulator evidence authoritative for Rust mathematical/statistical correctness, cryptographic correctness, generic scale ceilings, Quest Browser-specific behavior, target-device memory/thermal/frame pacing, optical legibility, real tracking/haptics, fatigue/comfort or human usability.

Status: **ROADMAP PLANNING ONLY / IMPLEMENTATION NOT STARTED**.
