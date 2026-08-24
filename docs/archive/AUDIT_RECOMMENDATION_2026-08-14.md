# Audit Complete: Phases 1–20 "Built vs. Wired" Analysis

**Date:** 2026-08-14  
**Archived status:** historical snapshot; superseded by `../PRE_P1_SYSTEMATIC_AUDIT.md`.

**Status refresh:** 2026-08-16 — Phase 22.3 Tier B wiring is complete for
`FrustrationResponseManager`, `JITGestureHintManager`, and `GestureConfidenceHUD` via
`AdaptiveAssistController`. The counts and findings below describe the audit snapshot at
the original date unless explicitly marked otherwise.

---

## Executive Summary

Independent audit of all components claimed ✅ done in Phases 1–20 reveals:

| Category | Count | Finding |
|---|---|---|
| ✅ **Fully Wired** (instantiated in production) | 10 | These components work as documented |
| 🔴 **Built-Only** (class exists, never instantiated) | 7 | These explain Phase 22.3's wiring work |
| 🟡 **Partially Wired** (incomplete features) | 4 | Accessibility & data-encoding gaps |

---

## What This Means

### The Roadmap Honesty Issue

**Phase 12.4, 13.3, 17.2, 20.3 mark components ✅ done**, but systematic grep audit found:
- ✅ Classes are fully implemented with passing tests
- ❌ Never instantiated in production (no `new ClassName` in `src/` code)

**Example:** 
- `FrustrationResponseManager` (Phase 12.4) — entire class built, full test suite, **never called from World.ts**
- `JITGestureHintManager` (Phase 12.4) — same situation  
- `CSVParserWorker` (Phase 17.2) — class complete, **main thread parser used instead**

**This is not a defect in the code.** The classes are high-quality. It's a **roadmap-documentation issue**: we marked "component built" as equivalent to "feature shipped," when really it means "building block ready but not wired yet."

**Phase 22.3 correctly identified this** when it said "wire the praised-but-dead features" — that was accurate at audit time. Tier B wiring is now complete through `AdaptiveAssistController`.

---

## What Needs to Happen

### Option A: Proceed with Phase 22.3 as-is
- Tier A: Fix 5 P1 input correctness bugs (high priority, high risk if skipped)
- Tier B: ~~Wire the 7 built-only components into World.ts~~ **Complete for the three assist surfaces**; remaining worker/exporter components stay intentionally deferred
- Tier C: Accessibility polish (colorblind data encoding, text scaling, dwell UI)

**This is recommended.** The audit confirms Phase 22.3 has the right scope; we just lacked visibility into the "built but not wired" split.

---

### Option B: Update roadmap retroactively
- Rephrase Phases 12.4, 13.3, 17.2, 20.3 to say "component built, not wired"
- Clarify that Phase 22.3 includes wiring work as well as polish
- Update Current Status to note the distinction

**Combined with Option A:** Both are good. Update roadmap + proceed with Phase 22.3.

---

## Key Findings

### Built-Only Components (historical audit)
1. `FrustrationResponseManager` — diegetic hint cards on frustration (**wired in `AdaptiveAssistController`**)
2. `JITGestureHintManager` — gesture teaching via ghost hands (**wired in `AdaptiveAssistController`**)
3. `GestureConfidenceHUD` — real-time gesture confidence visualization (**wired in `AdaptiveAssistController`**)
4. `CSVParserWorker` — Web Worker for CSV parsing (main thread parser active instead)
5. `DracoSolverWorker` — Web Worker for constraint solving (main thread solver active instead)
6. `AnalysisStorybookExporter` — analysis story bundler (export logic in TelemetryPanel instead)
7. `ContextRecoveryManager` — WebGL recovery coordinator (logic in Engine.ts instead)

**Status:** The first three are wired and covered by `tests/adaptive-assist-controller.test.ts`. The remaining four are still built-only or intentionally superseded by existing paths.

### Partially Wired (4 total)
1. **Colorblind data encoding (P1)** — UI theme is colorblind-aware, but `categoricalColor()` ignores mode; palace crystals and charts use un-remapped palette → red-green confusion for deuteranopia users
2. **Dwell threshold control (P2)** — Dwell logic works, but threshold hardcoded at 1200 ms; no UI to adjust
3. **Text scaling (P2)** — Static scaling works; no gaze-proximity auto-scaling
4. **Export format** — Telemetry export works; "storybook" terminology is unused

---

## My Recommendation

✅ **Proceed with Phase 22.3 as-is**, structured as:

### Phase 22.3 Tier A (Critical) — 5 P1/P2 input defects
- Hand-pinch double-fire / double-toggle
- Gesture recognizer ignoring `dominantHandIndex`
- Hand-grab conflicting with both-pinch system gesture
- `scoopDown` is a dead-end outside flight mode
- Seated-height offset double-counts head height

**Timeline:** 1–2 weeks  
**Testing:** Existing test harness adequate; verify on Quest  

### Phase 22.3 Tier B (Wiring) — complete
- `AdaptiveAssistController` is instantiated by `World`.
- `FrustrationResponseManager`, `JITGestureHintManager`, and `GestureConfidenceHUD` are instantiated, mounted, fed runtime context, and disposed.
- Targeted coverage is in `tests/adaptive-assist-controller.test.ts`.
- Quest usability evidence remains part of focused validation; it is not a wiring blocker.

### Phase 22.3 Tier C (Accessibility) — Features & polish
- Colorblind data-palette remapping (thread colorblindMode to `categoricalColor()`)
- Dwell-delay UI stepper in Accessibility settings
- Gaze-distance text scaling

**Timeline:** 2–3 weeks  
**Testing:** Colorblind mode + all action types; text scaling at 0.5 m, 1 m, 3 m  

---

## Blockers to Unblock First

### Phase 21.3 (Scene Graph/Command Buffers)
Blocked on "load-test validation" — the test exists but hasn't been run.
- **Action:** Run load-test staircase (`Shift+T` in dev), check `logs/loadtest-results.jsonl`
- **If no regression:** Unblock Phase 21.3 immediately
- **If regression:** Diagnose; decision point for Phase 21.3 vs. skipping

### Study Package Placeholders
`docs/study/` has template structure but placeholder content.
- **Action:** Fill or explicitly defer each placeholder
- **Decision:** Freeze as-is for Phase 22, or complete before Phase 23

---

## Files Updated

- **New:** [`docs/AUDIT_PHASES_1_20.md`](AUDIT_PHASES_1_20.md) — full audit with evidence, findings, corrective actions
- **Updated:** [`docs/ROADMAP.md`](ROADMAP.md) — Current Status block refreshed; Phases 12.4, 13.3, 17.2, 20.3 annotated with audit findings

---

## Decision: Proceed or Pause?

**Recommend: ✅ Proceed with Phase 22.3 as-is**

The audit clarifies the roadmap, confirms Phase 22.3 scope is appropriate, and identifies the "built but not wired" split as a documentation issue, not a code issue. No blockers prevent starting immediately.

**Remaining actions to unlock Phase 23:**
1. Complete Tier A (input defect fixes) ← **highest priority, highest risk if skipped**
2. Complete Tier C (accessibility features) ← medium risk, user-facing impact
