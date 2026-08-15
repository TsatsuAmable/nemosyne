# Audit Complete: Phases 1–20 "Built vs. Wired" Analysis

**Date:** 2026-08-14  
**Status:** ✅ Complete — Ready for decision

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

**Phase 22.3 correctly identified this** when it said "wire the praised-but-dead features" — that was accurate.

---

## What Needs to Happen

### Option A: Proceed with Phase 22.3 as-is
- Tier A: Fix 5 P1 input correctness bugs (high priority, high risk if skipped)
- Tier B: Wire the 7 built-only components into World.ts (low risk, ~20 instantiation lines)
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

### Built-Only Components (7 total)
1. `FrustrationResponseManager` — diegetic hint cards on frustration
2. `JITGestureHintManager` — gesture teaching via ghost hands
3. `GestureConfidenceHUD` — real-time gesture confidence visualization
4. `CSVParserWorker` — Web Worker for CSV parsing (main thread parser active instead)
5. `DracoSolverWorker` — Web Worker for constraint solving (main thread solver active instead)
6. `AnalysisStorybookExporter` — analysis story bundler (export logic in TelemetryPanel instead)
7. `ContextRecoveryManager` — WebGL recovery coordinator (logic in Engine.ts instead)

**Risk:** Low. All have passing tests. Wiring is 1–5 instantiation lines per component.

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

### Phase 22.3 Tier B (Wiring) — 7 built-only components
- Instantiate FrustrationResponseManager, JITGestureHintManager, GestureConfidenceHUD
- Wire them into World/WorldUIManager, parent to `analystAnchor`
- Feed scores/context from appropriate handlers

**Timeline:** 1 week  
**Testing:** Wire → run existing test suite → on-device validation  

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

**Three actions to unlock Phase 23:**
1. Complete Tier A (input defect fixes) ← **highest priority, highest risk if skipped**
2. Complete Tier B (wire built-only components) ← low risk, high quality
3. Complete Tier C (accessibility features) ← medium risk, user-facing impact