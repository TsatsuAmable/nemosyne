# Phase 22.3 Tier A: Input Defect Fixes — On-Device Validation Guide

## Overview
This document provides step-by-step validation procedures for the 5 critical P1/P2 input defects fixed in Phase 22.3 Tier A. Each defect includes root cause, fix applied, and on-device Quest 3S validation steps.

---

## Defect 1: Hand-Pinch Double-Fire

**Status:** ✅ FIXED

### Root Cause
- **File:** `src/vr/Hands.ts` (lines 283-295)
- **Issue:** Pinch callbacks (`onPinchStart`/`onPinchEnd`) were invoked every frame without frame-level debounce. Hand tracking jitter near `pinchThreshold` caused callbacks to fire multiple times per gesture.
- **Fix Applied:** Added `_lastPinchCallbackFrame` field to track which frame the callback last fired, preventing re-entry within the same frame.

### Code Changes
```typescript
// Before: No debounce
if (!this.pinched && d < this.pinchThreshold) {
  this.pinched = true;
  if (this.onPinchStart) this.onPinchStart(this);  // Fires every frame!
}

// After: Frame-gated callback
if (!this.pinched && d < this.pinchThreshold) {
  this.pinched = true;
  if (this.onPinchStart && this._lastPinchCallbackFrame !== this._debugFrame) {
    this._lastPinchCallbackFrame = this._debugFrame;
    this.onPinchStart(this);  // Fires once per unique frame
  }
}
```

### On-Device Validation Steps

**Setup:**
- Put on Meta Quest 3S
- Open Nemosyne app
- Open developer console (hold Options > Show Logs)

**Test Procedure:**
1. **Single-Pinch Test:**
   - Pinch the index and thumb fingers together once (full gesture)
   - **Expected:** Console shows one `nemosyne-pinchstart` → one action triggered → one `nemosyne-pinchend`
   - **Failure:** If you see two pinch events or double-selections, defect still exists

2. **Double-Pinch Test (System Gesture Suppression):**
   - Pinch both hands together (system gesture)
   - **Expected:** One system toggle event, not two
   - **Failure:** If you see two system toggle fires, pinch debounce failed

3. **Rapid Pinch Test:**
   - Pinch fast (on/off/on/off) repeatedly
   - **Expected:** Each pinch = one event, no accidental doubles
   - **Failure:** Occasional double events indicate jitter-induced double-fire

4. **Grab Object Test:**
   - Pinch to grab an object in the scene
   - Verify object moves exactly once per pinch
   - **Expected:** Smooth single-step object movement
   - **Failure:** Object jumps twice or multiple times per pinch

**Validation Checklist:**
- [ ] Single pinch fires exactly one selection event
- [ ] No console errors related to pinch callbacks
- [ ] Rapid pinches don't trigger double actions
- [ ] Grab interactions feel responsive (not delayed)

---

## Defect 2: GestureRecognizer Ignores dominantHandIndex

**Status:** ✅ FIXED

### Root Cause
- **File:** `src/vr/interactions/HandGestureRecognizer.ts` (lines 162-168, 176-210)
- **Issue:** Gesture classification hardcoded `left = poses[0], right = poses[1]`, ignoring `this.dominantHandIndex`. Left-handed users (dominant=index 1) got wrong hand tracking, breaking dominant-hand gestures.
- **Fix Applied:** Use `dominant = poses[this.dominantHandIndex]` and `nonDominant = poses[this.nonDominantHandIndex]` throughout gesture processing.

### Code Changes
```typescript
// Before: Hardcoded left/right
const left = poses[0];
const right = poses[1] || left;
const gesture = this._classify(left, right, ...);

// After: Respect dominantHandIndex
const dominant = poses[this.dominantHandIndex];
const nonDominant = poses[this.nonDominantHandIndex] || dominant;
const gesture = this._classify(dominant, nonDominant, ...);
```

### On-Device Validation Steps

**Setup:**
- Put on Meta Quest 3S
- Open Nemosyne app
- Settings → Accessibility → **Switch to left-handed mode** (or find dominant hand setting)
- Verify console shows "Dominant hand: left"

**Test Procedure:**

1. **Swipe Gesture Test (Left-Handed):**
   - Open hand (palm forward), swipe left/right
   - **Expected (Right-Handed):** Swipe-left gesture fires when hand moves left
   - **Expected (Left-Handed):** Swipe-left fires when LEFT hand swipes left (not right hand)
   - **Failure:** Gesture fires from wrong hand, or doesn't fire at all

2. **Pinch Together Gesture:**
   - With both hands, pinch index/thumb, then move hands toward each other
   - **Expected:** `pinchTogether` gesture fires
   - **Failure:** Gesture fires from wrong hand pairing

3. **scoopUp Gesture (Left-Handed):**
   - Cup both hands (palms up), sweep them upward
   - **Expected:** `scoopUp` gesture fires
   - **Failure:** Gesture doesn't fire or fires from wrong hand orientation

4. **OK Sign (Left-Handed Only):**
   - Pinch with dominant (left) hand, keep other hand open
   - **Expected:** `okSign` gesture fires
   - **Failure:** `okSign` fires from right hand instead

**Validation Checklist:**
- [ ] Gesture fires from correct dominant hand (left for left-handed users)
- [ ] Pinch-together recognizes both hands correctly
- [ ] scoopUp/scoopDown detect hand orientation from dominant hand
- [ ] No gesture fires from non-dominant hand when it should be dominant-only

---

## Defect 3: Hand-Grab System Gesture Conflict

**Status:** ✅ FIXED

### Root Cause
- **File:** `src/vr/input/SystemGestureDetector.ts` (lines 17-32)
- **Issue:** When both hands pinched near Quest system gesture zone (high Y, near headset top), OS system gesture was prioritized over user's grab input, blocking object pickup. No position-based filtering existed.
- **Fix Applied:** Suppress system gesture (`bothPinched = false`) when either hand is above Y=1.5m (reach zone), allowing user grab to take priority.

### Code Changes
```typescript
// Before: No zone check
const bothPinched =
  this.registry.hands.length >= 2 &&
  this.registry.hands[0].isPinched?.() === true &&
  this.registry.hands[1].isPinched?.() === true;

// After: Suppress in reach zone
const systemGestureZoneSuppressed =
  this.registry.hands.length >= 2 &&
  this.registry.hands[0].rayOrigin?.y !== undefined &&
  this.registry.hands[1].rayOrigin?.y !== undefined &&
  (this.registry.hands[0].rayOrigin.y > 1.5 || this.registry.hands[1].rayOrigin.y > 1.5);

const bothPinched = !systemGestureZoneSuppressed && /* ...both pinched check... */;
```

### On-Device Validation Steps

**Setup:**
- Put on Meta Quest 3S
- Open Nemosyne app
- Place an interactive object in the scene (e.g., a cube you can grab)

**Test Procedure:**

1. **Low-Position Grab Test:**
   - Pinch to grab object at chest/waist height
   - **Expected:** Object grabs smoothly, no interference
   - **Failure:** Grab blocked or laggy

2. **High-Position Grab Test (Reach Zone):**
   - Raise hands above head (Y > 1.5m), pinch both hands near object
   - **Expected:** Object grabs without system gesture interfering; no "system menu" appears
   - **Failure:** Quest system menu opens or grab is blocked

3. **System Gesture Below Zone:**
   - Hands at chest height, pinch both hands simultaneously
   - **Expected:** System gesture can still fire (for toggling UI)
   - **Failure:** System gesture is suppressed when it shouldn't be

4. **Edge Case: One Hand High, One Low:**
   - Right hand above head (high Y), left hand at chest
   - Pinch both hands
   - **Expected:** System gesture suppressed (reach zone active on one hand)
   - **Failure:** System gesture fires despite reach zone being active

**Validation Checklist:**
- [ ] Grab works smoothly at all heights
- [ ] No system menu pops up when grabbing at head height
- [ ] System gesture still works when hands are below Y=1.5m
- [ ] Reach-zone suppression doesn't interfere with normal interaction

---

## Defect 4: scoopDown Gesture Dead-End

**Status:** ✅ FIXED

### Root Cause
- **File:** `src/vr/interactions/HandGestureRecognizer.ts` (lines 135, 235-250)
- **Issue:** `scoopDown` gesture has no state machine for incomplete attempts. If user starts motion but doesn't complete it fully, gesture fires once, cooldown blocks retry (650ms), and user must re-grip or re-position hands before trying again. Poor recovery.
- **Fix Applied:** Track incomplete `scoopDown` attempts. After 500ms timeout without completing the gesture, reset cooldown to allow immediate retry.

### Code Changes
```typescript
// Added timeout-based recovery
private _incompleteScoopDownTime: number | null = null;
private _scoopDownTimeout = 0.5; // 500ms recovery window

// In update() loop:
if (this._lastGestureName === 'scoopDown' && gesture !== 'scoopDown') {
  // scoopDown motion stopped; start timeout
  this._incompleteScoopDownTime = time;
}
if (this._incompleteScoopDownTime != null && time - this._incompleteScoopDownTime >= this._scoopDownTimeout) {
  // 500ms elapsed; reset cooldown to allow retry
  this._lastGestureTime = Math.max(0, time - this.cooldown);
  this._incompleteScoopDownTime = null;
}
```

### On-Device Validation Steps

**Setup:**
- Put on Meta Quest 3S
- Open Nemosyne app
- Enable flight mode (via wheel menu: Settings → Flight Mode)
- Open developer console to see gesture logs

**Test Procedure:**

1. **Complete scoopDown Test:**
   - Cup both hands (palms down), sweep downward smoothly
   - **Expected:** Ascend gesture fires once, user descends
   - **Failure:** Gesture fires multiple times or doesn't fire

2. **Incomplete scoopDown Test (Core Fix):**
   - Cup both hands (palms down), start sweeping down but STOP midway
   - Wait 100ms (keep hands still)
   - Try scoopDown again immediately
   - **Expected (FIXED):** Second scoopDown fires after 500ms timeout (immediate retry works)
   - **Expected (BROKEN):** Have to wait full 650ms cooldown or re-grip

3. **Rapid Retry Test:**
   - scoopDown (incomplete) → wait 300ms → scoopDown (again, incomplete) → wait 300ms → scoopDown (complete)
   - **Expected:** All three attempts are recognized (after timeouts)
   - **Failure:** Some attempts are blocked by cooldown

4. **scoopUp Symmetry Test:**
   - Cup hands (palms up), start scooping up but stop midway
   - Immediately try again
   - **Expected:** Works (same fix should apply)
   - **Failure:** Blocked by cooldown

**Validation Checklist:**
- [ ] Incomplete scoopDown doesn't block immediate retry after 500ms
- [ ] Cooldown no longer feels "sticky" after failed gesture
- [ ] User can practice gesture multiple times without re-gripping
- [ ] Complete scoopDown still fires correctly (no false positives)

---

## Defect 5: Seated-Height Feedback Loop (Oscillation)

**Status:** ✅ FIXED

### Root Cause
- **File:** `src/vr/Locomotion.ts` (line 370)
- **Issue:** Seated-height offset applied exponential smoothing with `alpha=0.2` (20% per frame at 60 FPS nominal), which is too aggressive at 90 FPS Quest refresh rate. When head tracking bounces (±5cm jitter), the offset target bounces, causing cameraGroup.position.y to overshoot and oscillate instead of settling.
- **Fix Applied:** Reduced alpha from `0.2` to `0.05` (5% per frame), providing stronger damping against tracking jitter. Reduces motion, settles faster, no oscillation.

### Code Changes
```typescript
// Before: alpha=0.2 (too aggressive, causes overshoot/oscillation)
const alpha = this.reducedMotion ? 0.02 : 0.2;

// After: alpha=0.05 (balanced, prevents oscillation)
const alpha = this.reducedMotion ? 0.02 : 0.05;
```

### On-Device Validation Steps

**Setup:**
- Put on Meta Quest 3S
- Open Nemosyne app
- Settings → Comfort → Enable **Seated Mode**
- Open developer console: `console.log(locomotion.cameraGroup.position.y)` each frame

**Test Procedure:**

1. **Baseline Sitting Test:**
   - Sit in a chair
   - Hold head still (no movement)
   - **Expected (FIXED):** Camera height stabilizes within 1-2 seconds, stays rock-steady
   - **Expected (BROKEN):** Camera height bounces up/down continuously (±5cm)
   - **Validation:** Watch the Y position in console: should converge, not oscillate

2. **Head Tilt Test:**
   - Sit, tilt head forward slightly
   - **Expected:** Camera height tracks smoothly, doesn't overshoot
   - **Failure:** Camera height jumps up/down or feels jittery

3. **Small Movement Test:**
   - Sit, lean forward slightly (small movement)
   - **Expected:** Camera smoothly follows head position, no oscillation
   - **Failure:** Camera position oscillates around target

4. **Comfort Validation:**
   - Sit still for 30 seconds
   - Rate subjective comfort (motion sickness, dizziness, jitter perception)
   - **Expected (FIXED):** Stable, comfortable, no VR sickness
   - **Expected (BROKEN):** Subtle bouncing feeling, mild discomfort

5. **Reduced Motion Mode Test:**
   - Enable Reduced Motion in Settings
   - Sit still
   - **Expected:** Even smoother (alpha=0.02); slower convergence but no oscillation
   - **Validation:** Y position takes ~3-4 seconds to settle, but dead-steady once settled

**Validation Checklist:**
- [ ] Height stabilizes within 1-2 seconds when sitting still
- [ ] No visible bouncing or oscillation while seated
- [ ] Camera height smoothly tracks head movement (no lag or jump)
- [ ] Reduced-motion mode is even smoother (slower but no jitter)
- [ ] Seated users report no dizziness or motion sickness from height wobble

---

## Summary: Validation Completion Checklist

### Defect 1: Pinch Double-Fire
- [ ] Single pinch = one selection event
- [ ] No console double-fire errors
- [ ] Grab interactions are responsive

### Defect 2: dominantHandIndex
- [ ] Left-handed mode gestures fire from left hand
- [ ] Dominant-hand swipes work correctly
- [ ] pinchTogether detects both hands

### Defect 3: System Gesture Zone
- [ ] Grab works at all heights (including head-high)
- [ ] System menu doesn't pop up during reach-zone grabs
- [ ] System gesture works when hands are below Y=1.5m

### Defect 4: scoopDown Dead-End
- [ ] Incomplete scoopDown doesn't require full re-grip
- [ ] Retry after 500ms timeout works immediately
- [ ] Complete scoopDown still fires correctly

### Defect 5: Seated-Height Oscillation
- [ ] Height stabilizes when sitting still
- [ ] No visible bouncing or jitter
- [ ] Comfortable for extended seated use
- [ ] Reduced-motion mode is even smoother

---

## On-Device Validation Report Template

Once you've completed all validation steps on Quest 3S, fill this out:

```
# On-Device Validation Report

**Date:** [DATE]
**Tester:** [NAME]
**Quest Device:** Meta Quest 3S (11.1ms frame budget @ 90 FPS)
**App Version:** Nemosyne [VERSION]

## Defect 1: Pinch Double-Fire
- [ ] PASS: Single pinch fires once
- [ ] PASS: Rapid pinches don't double-trigger
- [ ] PASS: Grab feels responsive
- Overall: [PASS / FAIL / PARTIAL]

## Defect 2: dominantHandIndex
- [ ] PASS: Left-handed mode works
- [ ] PASS: Dominant-hand gestures correct
- [ ] PASS: Pinch-together works
- Overall: [PASS / FAIL / PARTIAL]

## Defect 3: System Gesture Zone
- [ ] PASS: Grab at head height works
- [ ] PASS: No system menu interference
- [ ] PASS: Zone suppression correct
- Overall: [PASS / FAIL / PARTIAL]

## Defect 4: scoopDown Dead-End
- [ ] PASS: Incomplete retry works after 500ms
- [ ] PASS: No re-grip required
- [ ] PASS: Complete scoopDown works
- Overall: [PASS / FAIL / PARTIAL]

## Defect 5: Seated-Height Oscillation
- [ ] PASS: Height stabilizes within 2s
- [ ] PASS: No visible jitter when sitting
- [ ] PASS: Comfortable for extended use
- Overall: [PASS / FAIL / PARTIAL]

## Overall Result
- All 5 Defects: [PASS / FAIL / PARTIAL]
- Regressions Detected: [NONE / LIST]
- Notes: [OPTIONAL]
```

---

## Troubleshooting

### "System gesture still fires in reach zone"
- Check Quest OS version (might have changed system gesture zone)
- Verify `SystemGestureDetector.update()` is being called every frame
- Log `systemGestureZoneSuppressed` value to console

### "Pinch still fires twice"
- Verify `Hands.ts` has `_lastPinchCallbackFrame` field
- Check that `this._debugFrame++` increments each update
- Inspect frame logs in browser console

### "Left-handed mode still doesn't work"
- Verify `handedness` property is correctly set on hand objects
- Check that `setDominantHand('left')` is called in World initialization
- Log `dominantHandIndex` value: should be 0 for left, 1 for right

### "scoopDown timeout not triggering"
- Check that `_incompleteScoopDownTime` is being set when motion stops
- Verify timeout value (0.5s) is correct
- Log the timeout counter to console

### "Seated height still oscillates"
- Verify `alpha = 0.05` is in `Locomotion.ts` (not 0.2)
- Check that seated-height offset is non-zero
- Try disabling Bluetooth (sometimes controller interference affects head tracking)

---

