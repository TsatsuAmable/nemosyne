---
name: vr-accessibility
description: Use when building or reviewing WebXR spatial UI in Nemosyne — panel anchoring and comfort sphere, gaze/laser dwell targeting, audio-haptic feedback, wheel menus and legibility, or any accessibility checklist verification.
---

# 🥽 VR UX & Spatial Accessibility Guidelines

This skill provides standard operating procedures, architectural guidelines, and code snippets for building accessible, ergonomic, and high-performance WebXR spatial interfaces in Nemosyne.

---

## 1. 🧍 Torso-Anchored Personal Comfort Sphere

To prevent fixed world-anchor frustration where UI panels fall behind the user or drop below floor level, UI panels must anchor to the user's **torso**:

- **Headset & Torso Offsets**:
  - `Torso Position`: `X = camera.x`, `Z = camera.z`, `Y = camera.y - 0.25m`.
  - `Default Eye Height`: Eye/chest level at `1.35m` to `1.45m` above floor plane.
- **Orientation**:
  - UI panels must continuously yaw-rotate towards the headset so they remain facing the user for optimal viewing angles.

```typescript
// Example: Torso anchor update loop in WorldSceneComposer.ts
update(): void {
  if (!this.engine.camera) return;
  const cam = this.engine.camera.position;
  // Position anchor 0.25m below headset X/Z
  this.analystAnchor.position.set(cam.x, Math.max(0.6, cam.y - 0.25), cam.z);
  
  // Orient toward camera yaw
  this.engine.camera.getWorldDirection(this._tempVec);
  const yaw = Math.atan2(this._tempVec.x, this._tempVec.z);
  this.analystAnchor.rotation.set(0, yaw + Math.PI, 0);
}
```

---

## 2. 👁️ Gaze & Laser Dwell Targeting (Motor Accessibility)

For users unable to trigger physical pinch or button presses, Nemosyne provides **Dwell Selection**:

- **Dwell Timer Threshold**: Default `1200ms` hover dwell time before triggering auto-selection.
- **Target Visual Feedback**: Animated radial progress indicator or pulse scale around hovered targets.
- **Telemetry Integration**: Track dwell duration and hesitation to identify confusing UI targets using `telemetry.recordDwell(targetId, durationMs, wasClicked)`.

```typescript
// Example: Dwell selection setup in SelectionDispatcher.ts
dispatcher.setDwellSelection(true, 1200);
```

---

## 3. 🔊 Multi-Modal Audio & Haptic Feedback

Every interaction must provide synchronized multi-modal feedback to ensure clarity in 3D space:

- **Audio Feedback**: Play short spatialized audio tones on hover, select, menu toggle, and gesture recognition via `SelectionFeedback.ts`.
- **Haptic Vibration**: Pulse controller actuators on laser hover (`0.2 intensity, 20ms duration`) and button selection (`0.6 intensity, 50ms duration`).

```typescript
// Multi-modal feedback example
this.engine.input.feedback?.playSelect?.();
this.engine.input.feedback?.playHaptic?.(0.6, 50);
```

---

## 4. 🎨 Dual Vertical Wheel Menus & Legibility

- **Dual Wheel Layout**: Position left wheel at `X = -0.36m` and right wheel at `X = +0.36m` relative to analyst torso anchor.
- **High-Contrast Typography**: Use wide rectangular button pills (`0.24m x 0.075m`) with 30px+ monospace font sizes and vibrant distinct accent colors (`#00ffcc`, `#ff00cc`, `#ccff00`).
- **Matrix World Synchronization**: Always call `group.updateMatrixWorld(true)` prior to raycast hit testing to guarantee pointer click accuracy.

---

## 🧪 Verification & Testing Checklist

- [ ] Verify panel anchor position remains centered at user chest height (`~1.35m`).
- [ ] Verify Dwell Selection triggers selection on target hover after `1200ms`.
- [ ] Verify audio tones and haptic pulses fire on pointer down events.
- [ ] Run test suite: `npx vitest run tests/button-click-dispatch.test.ts`.
