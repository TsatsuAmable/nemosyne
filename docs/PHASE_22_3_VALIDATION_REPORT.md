# On-Device Validation Report — Phase 22.3 Tier A

> Fill in after running the Quest 3S session per `docs/PHASE_22_3_VALIDATION_GUIDE.md`.
> Evidence sources: `logs/vr-remote-console.log` (auto-collected VR console), Quest console
> (hold Options > Show Logs), screen recording notes.

**Date:** [DATE]
**Tester:** [NAME]
**Quest Device:** Meta Quest 3S
**App Version:** Nemosyne working tree @ commit [COMMIT / "uncommitted Tier A fixes"]
**Dev server:** `npm run dev` over HTTPS (LAN IP / ADB reverse)

---

## Defect 1: Pinch Double-Fire
- [ ] PASS: Single pinch fires exactly one selection event: Pinches resulted in no action. Only controller use
- [ ] PASS: Rapid pinches don't double-trigger: Pinches resulted in no action
- [ ] PASS: Grab interactions feel responsive (object moves once per pinch): There was no movement triggered by pinching. Only diegetic features were triggered.
- **Overall:** [FAIL]
- **Notes / evidence:** [e.g. `logs/vr-remote-console.log` lines, observed vs expected]

## Defect 2: dominantHandIndex
- [ ] PASS: Left-handed mode — gestures fire from the LEFT hand: No gestures fired
- [ ] PASS: Dominant-hand swipes (swipeLeft/swipeRight) correct in both modes: hand swipe not recognised
- [ ] PASS: pinchTogether detects both hands; okSign fires from dominant hand: none
- **Overall:** [FAIL]
- **Notes / evidence:**

## Defect 3: System Gesture Zone (reach-zone suppression)
- [ ] PASS: Grab at head height (Y > 1.5 m) works, no system-menu popup.: Not working
- [ ] PASS: System gesture (both-pinch toggle) still fires at chest height: Not working
- [ ] PASS: One-hand-high edge case: suppressed, no toggle: Not working
- **Overall:** [FAIL]
- **Notes / evidence:**

## Defect 4: scoopDown Dead-End (retry after incomplete attempt)
- [ ] PASS: Incomplete scoopDown → retry after ~500 ms works without re-grip
- [ ] PASS: Rapid retry sequence (incomplete/incomplete/complete) all recognized
- [ ] PASS: Complete scoopDown still fires correctly (no false positives)
- **Overall:** [FAIL]
- **Notes / evidence:**

## Defect 5: Seated-Height Oscillation
- [X] PASS: Height stabilizes within 1-2 s when sitting still (no ±5 cm bounce)
- [x] PASS: Head tilt / small lean tracks smoothly, no overshoot
- [x] PASS: Comfortable for 30 s+ seated (no wobble/motion sickness)
- [x] PASS: Reduced Motion mode even smoother (slower settle, dead-steady)
- **Overall:** [FAIL]
- **Notes / evidence:**

---

## Overall Result
- **All 5 Defects:** [FAIL]
- **Regressions Detected:** [NONE]
- **Session evidence attached:** [logs/vr-remote-console.log excerpt / screenshots / none]
- **General notes:** gestures only worked with controllers though telemetry showed hand tracking was ongoing. May need better telemetry and gesture recognition logging for the live instrument testss

---

## Addendum — Session 2 (2026-08-15, agent diagnosis)

**Reported:** input telemetry shows left/right hands not tracked; pinching produces no responses.
**Log evidence:** zero `pinch start` lines, zero `fallback from inputSource` recoveries in the
latest session — joints never became poseable, so `_doUpdate` early-returned before pinch
detection on every frame.

**Root cause found (code):** `_validateJoints()` accepted three.js wrapper joints
(`space.joints` contains THREE.Group objects, not native `XRJointSpace`). Once accepted,
`jointsValid = true` permanently blocked the native inputSource fallback, while
`getJointPose()` null-rejected every wrapper joint — hands appear "connected" but can never
produce a pose, ray, or pinch. This kills D1–D4 together (D5 unaffected, no hands needed).

**Fixes applied (post-session, gated PASS typecheck/lint/coverage/build):**
1. `_validateJoints()` now rejects non-native wrapper joints when `XRJointSpace` exists →
   the inputSource fallback engages with native joint spaces.
2. `getJointPose()` synthesizes a pose from wrapper `matrixWorld` when only three.js has
   live joint data (belt-and-suspenders).
3. Diagnostics added: `waiting for joints: handedness=… session=… handSources=…` every ~3 s
   while dead; `joints valid but no pose for 150 frames` streak; one-shot joint-rejection
   reasons.
4. Earlier fix stands: `_onDisconnected` no longer nulls `onPinchStart`/`onPinchEnd`.

**Action:** re-run the 5-defect procedure with this build; the log now pinpoints exactly
where the pipeline dies if hands still don't track (no session / no hand sources /
untracked hand / joint-type rejection).

---

## Addendum — Session 3 (2026-08-15 ~12:30, agent diagnosis)

**Reported:** input telemetry panel now updating (texture fix worked) but does not
distinguish controller data from hand data; the pointing ray is no longer connected to
the human hand.

**Log evidence:** pinch detection now works (161 pinch starts, both hands, correct
handedness; D3 reach-zone suppression observed live: `suppressed in reach zone
(y0=1.34, y1=1.51)`). BUT: `HandPointer 1` handedness flapped right→left, and at
12:31:17 both pointers fell back to `handedness=right` → both bound to the SAME right
input source. Explains: ray detached from hand (both rays driven by one hand's joints),
single-hand pinches misread as both-pinch (67 system toggles in ~40 s), and
indistinguishable telemetry lines.

**Root cause:** `handedness` is mutable and was overwritten from flaky connected-event
data; `_findHandSource` matched by that mutable value with no exclusivity between the
two HandPointers.

**Fixes applied (gated PASS typecheck/lint/coverage/build):**
1. `Hands.ts`: input-source binding with claims — each HandPointer locks one
   `XRInputSource` by object identity (static WeakMap registry) and keeps it while it
   exists; handedness is only a preference among unclaimed sources; claims release on
   disconnect. Two pointers can no longer track the same hand.
2. `InputTelemetry.ts`: controller lines get a `[hand live]` suffix when a tracked hand
   of the same handedness is active, so hand vs controller data is distinguishable.
3. (Same session) `MovablePanel.ts` render-generation counter fixed the frozen-panel
   texture-cache bug that had been freezing all dynamic panels.

**Remaining known issue (not fixed, candidate for tuning):** system-toggle trigger is
hair-trigger — any simultaneous two-hand pinch (including one hand held from before)
fires the toggle and suppresses selection for the duration. 67 toggles in one session.
Consider requiring the reach-zone/pose guard or a deliberate both-pinch pose.

**Status:** D1/D2/D4 checklist evidence still pending a clean re-run (sessions so far
were diagnostic, not the structured procedure). D3 suppression logic confirmed working
live. D5 pass (from session 1). Next: re-run the 5-defect procedure.

---

## For the agent (do not edit)

On receipt of this report:
1. Mark each defect checklist item in `docs/PHASE_22_3_VALIDATION_GUIDE.md` if all PASS.
2. Update `docs/ROADMAP.md` §Current Status: replace "Still pending: on-device Quest 3S
   validation" with the verdict (PASS/PARTIAL/FAIL + date + this report as pointer).
3. If any defect FAILED or PARTIAL: file the failure details under §Sprint 22.3 input-correctness
   bugs as a follow-up item with the observed-vs-expected evidence, before committing.
4. If all PASS: Tier A is complete and ready to commit (code + tests + docs together).
