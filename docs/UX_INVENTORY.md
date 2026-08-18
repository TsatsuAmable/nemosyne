# UX Phenomenon Inventory & Qualitative-Telemetry Mapping

> **Canonical specification.** Stable reference mapping qualitative analyst experience in VR to correlated telemetry traces in Nemosyne.

---

## Phenomenon Matrix

| ID | Phenomenon | Qualitative Experience | Telemetry Signals | Derivation & Thresholds |
|---|---|---|---|---|
| **UX-001** | Hand-tracking cold-start | *"My hands didn't appear for ages at the start"* | `hands` lifecycle records; first `pinch.t`; `waiting for joints` | `tFirstJointsValid - session.start`; flagged if `> 10 s` |
| **UX-002** | Pointer-ray aim drift | *"I was looking at the panel but my pinch hit nothing"* | `context.ctx.ptr.driftDeg`; `pinch.ctx.ptr.target=null` | Share of samples with `driftDeg > 28°`; pinches with null target |
| **UX-003** | Both-pinch intent stolen | *"I tried to select with both hands and the menu kept opening"* | `pinch.gating=system-suppressed`; `system.kind=both-pinch` | Suppressed pinches while gazing at panels; ratio `suppressed / total` |
| **UX-004** | Target acquisition failure | *"I couldn't hit the button or mark I wanted"* | `selection.hit=callback-only`; absence of `scene/hud` hit | Window of $\ge 3$ callback-only hits while gazing at panel |
| **UX-005** | Peripheral reach / blindspot | *"Hands lost tracking when I reached to the side"* | `ergonomics[].reachZone=PERIPHERAL`; `PERIPHERAL_CAMERA_BLINDSPOT` | Share of samples in PERIPHERAL reach zone (`> 25%` flagged) |
| **UX-006** | Sustained frustration burst | *"I kept trying and nothing worked"* | `friction` records; frustration windows ($\ge 2$ in 3 s) | Window count + max window duration + peak friction score |
| **UX-007** | Frame-budget breach / jank | *"It stuttered or felt janky"* | `perf` records; `PerformanceBudget` critical/warning | Critical count; max `frameMs > 13.33ms`; `lodScaleFactor` drops |
| **UX-008** | Dataset load failure / crash | *"It crashed when I loaded or switched data"* | `dataset_load` followed by `[ERROR]` within 2 s | Error record within 2 s of dataset load start |
| **UX-009** | Live-stream reconnect flapping | *"The live feed kept dropping"* | `live_stream` error $\to$ connected cycles | Cycle count $\ge 3$ within 60 s |
| **UX-010** | Guided tour drop-off | *"I didn't finish the tour"* | `tour` records; `step < total` and `active=false` | Final step ratio `< 1.0` |
| **UX-011** | Wheel-menu stuck open | *"The menu wouldn't close"* | `wheel` open/close records | Open count $\ne$ close count and session ends open |
| **UX-012** | Gesture misfire | *"It fired the wrong gesture"* | `gesture.isMisfire=true`; `confidence < 0.6` | Misfire count and per-gesture classification |

---

## Detailed Specifications

### UX-001: Hand-Tracking Cold-Start
- **Description**: Standalone headsets (Meta Quest) often take seconds to initialize optical joint tracking after WebXR session start. During this time, the user experiences missing hand avatars or non-functional laser rays.
- **Derivation**: Compute `ttfrMs = tFirstJointsValid - sessionStartedAt`. Mark `severity = 'warning'` if `10s < ttfrMs <= 30s`, and `severity = 'critical'` if `ttfrMs > 30s`.

### UX-002: Pointer-Ray Aim Drift
- **Description**: Angular divergence between the user's eye-gaze vector and hand pointer ray direction exceeding comfortable ergonomics ($> 28^\circ$).
- **Derivation**: Identify pinch events occurring while `driftDeg > 28` and `target == null`.

### UX-003: Both-Pinch Intent Theft
- **Description**: The user attempts simultaneous bimanual selection on data points or panels, which the system gesture detector suppresses as an accidental double-pinch or steals as a wheel menu invocation.
- **Derivation**: Count `pinch` events with `gating = 'system-suppressed'` while gaze focus is on `'panel'` or `'hud'`.

### UX-004: Target Acquisition Failure
- **Description**: Repeated pinches targeting interactive elements that fail to register collisions on valid 3D colliders.
- **Derivation**: $\ge 3$ consecutive misses within a 5-second window while gazing at an interactive HUD or data glyph.

### UX-005: Peripheral Reach & Camera Blindspot
- **Description**: User reaches beyond the front tracking frustum ($> 65^\circ$ eccentricity from forward gaze), leading to optical hand tracking dropouts.
- **Derivation**: Aggregate fraction of runtime where hand positions fall into `reachZone = 'PERIPHERAL'`.

### UX-006: Sustained Frustration Burst
- **Description**: Rapid cluster of unhandled or abandoned gestures indicating user confusion or interface resistance.
- **Derivation**: Emission of `friction` trace records with score $\ge 0.5$ or $\ge 2$ ineffective interactions within 3 seconds.

### UX-007: Frame Budget Breach (VR Jank)
- **Description**: Headset frame duration exceeding the 90 FPS budget ($11.1\text{ ms}$) or 72 FPS budget ($13.88\text{ ms}$), causing dropped frames and visual judder.
- **Derivation**: Periodic 1 Hz telemetry capturing `frameMs > 13.33` or `lodScaleFactor < 0.8`.
