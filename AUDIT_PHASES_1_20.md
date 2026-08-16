# Audit: Phases 1–20 "Built but Not Wired" Components

**Date:** 2026-08-14  
**Method:** Systematic grep search for instantiation (`new ClassName`) and usage in `src/` directory  
**Scope:** All major components claimed ✅ done in Phases 1–20

**Status refresh:** 2026-08-16 — The three Phase 12.4 assist surfaces identified below as
built-only are now wired through `AdaptiveAssistController` in `World.ts`. The audit findings
remain useful as the historical baseline; worker/exporter/recovery findings remain unchanged.

---

## Summary

| Category | Count | Impact |
|---|---|---|
| ✅ Fully wired (instantiated & active in production) | 10 | Roadmap accurate |
| 🔴 Built-only (class exists, never instantiated in src/) | 7 | **Must update roadmap or wire immediately** |
| 🟡 Partially wired (component exists but incomplete) | 4 | **UX gaps confirmed by Phase 22.3 audit** |

---

## Detailed Findings

### ✅ Fully Wired (10 components)

These components are correctly marked as done and are actively used in production:

| Component | Phase | Evidence |
|---|---|---|
| `CanvasTextureCacheManager` | 14.1 | Instantiated in `MovablePanel.ts:446`, caches canvas texture uploads |
| `AdaptiveFrameGovernor` | 14.3 | Instantiated in `Engine.ts:82`, actively measures frame time and adjusts LOD each tick |
| `SceneGraphController` | 17.1 | Instantiated in `World.ts:206`, handles scene initialization |
| `WorkspaceManager` | 17.1 | Instantiated in `World.ts:207`, manages dataset node lifecycle |
| `BinaryPoseSerializer` | 17.3 | Static methods used in `CollaborativeStateSync.ts:53+`, encodes/decodes binary pose buffers |
| `TelemetryCollector` | 10A.6 | Instantiated in `World.ts:233`, records events throughout session |
| `InteractionCoach` | 10A.7 | Instantiated in `WorldUIManager.ts:212`, renders interaction hints |
| `SessionStore` | 10A.3 | Instantiated in `World.ts:453`, persists session to IndexedDB |
| Colorblind UI theme | 10A.5 | Wired in `World.ts:1250`, calls `WorldTheme.applyColorblindMode()` |
| `Accessibility.remapColor()` | 10A.5 | Used in `MovablePanel` and `ChartPlane` for UI color remapping |

---

### 🔴 Built-Only (7 components at audit time) — **Roadmap honesty issues**

These components existed as complete classes in `src/` but were **never instantiated in production at audit time**. The first three are now wired; the remaining entries retain their audit status.

| Component | Phase | Current Status | Roadmap Claim |
|---|---|---|---|
| `FrustrationResponseManager` | 12.4 | ✅ Wired by `AdaptiveAssistController` | ✅ "Implemented Sprint 12.4" |
| `JITGestureHintManager` | 12.4 | ✅ Wired by `AdaptiveAssistController` | ✅ "Implemented Sprint 12.4" |
| `GestureConfidenceHUD` | 12.4 | ✅ Wired by `AdaptiveAssistController` | ✅ "Implemented Sprint 12.4" |
| `CSVParserWorker` | 17.2 | Class defined, never used | ✅ "Implemented Sprint 17.2" |
| `DracoSolverWorker` | 17.2 | Class defined, never used | ✅ "Implemented Sprint 17.2" |
| `AnalysisStorybookExporter` | 13.3 | Class defined, export logic elsewhere | ✅ "Implemented Sprint 13.3" |
| `ContextRecoveryManager` | 20.3 | Class defined, context recovery scattered in `Engine.ts` | ✅ "Implemented Sprint 20.3" |

**Consequence:** The roadmap records these as "done" (Phase 12.4, 17.2, 13.3, 20.3), but Phase 22.3 correctly identifies that:
- `FrustrationResponseManager` and `JITGestureHintManager` need to be **wired into World.ts** 
- The feedback loop they enable is "praised-but-dead"

**Recommendation:** Update Phase 12.4–13.3 to mark as "Built (class + tests complete)" and move wiring work to Phase 22.3 or 23.

---

### 🟡 Partially Wired (4 components) — **Feature completeness issues**

These components are partially integrated, but the feature they claim is incomplete or blocked.

#### 1. Colorblind Data Encoding (Phase 10A.5) — **P1 Gap**

**Status:** 🟡 Half-wired  
**Claim:** "Colorblind palette remapping" for data visualization  
**Reality:**

- ✅ **UI theme remapping:** `WorldTheme.applyColorblindMode()` remaps environment (fog/lighting) and panel UI colors
- ❌ **Data palette:** `categoricalColor()` in `Encodings.ts:13` returns raw neon palette **regardless of colorblind mode**
  ```typescript
  export function categoricalColor(_value: unknown, index: number): number {
    return PALETTE[index % PALETTE.length];  // No colorblind context
  }
  ```
- ❌ **Palace encoding:** `VRTopologyTranslator.ts` calls `categoricalColor()` at lines 242, 436, 624, 695, 759 — all 3D palace crystals use un-remapped palette
- ❌ **Chart encoding:** `ChartPlane.ts` sources colors from the same un-remapped palette
- ❌ **Per-mode palette:** Current `Accessibility.remapColor()` is semantic (ok/alert/primary/secondary), not a categorical palette generator

**Impact:** A colorblind user with deuteranopia will see red-green palace crystals and chart points as the **same color** (red-green confusion), defeating data encoding. **Verified as US22 in Phase 22.3.**

**Fix Required:**
- Thread active `colorblindMode` to `categoricalColor()` 
- Select a colorblind-safe categorical palette (e.g., Okabe–Ito 8-colour) when mode is active
- Apply shape/texture redundancy for categories beyond palette length
- Ensure `VRTopologyTranslator` and `ChartPlane` both respect the mode

---

#### 2. Dwell Selection Accessibility (Phase 10A.5) — **P2 Gap**

**Status:** 🟡 Half-wired  
**Claim:** "Dwell selection" motor accessibility  
**Reality:**

- ✅ **Core dwell logic:** `SelectionDispatcher.ts` fully implements dwell trigger detection (1200 ms hold)
- ✅ **Routing:** `SettingsPanel.dwellSelection` wired to `InputRouter.setDwellSelection()`
- ❌ **User control:** Threshold hardcoded at `_dwellThreshold = 1200` ms; no `SettingsPanel` UI slider

**Impact:** A motor-impaired user cannot adjust dwell delay for their comfort (too fast = false triggers; too slow = exhausting). **Verified as US23 in Phase 22.3.**

**Fix Required:**
- Expose dwell-delay stepper in `SettingsPanel.ts` Accessibility section
- Wire threshold to `SelectionDispatcher._dwellThreshold`
- Test dwell across all action types (select, filter, aggregate, sort, time-slice, undo, inspect)

---

#### 3. Text Scaling Accessibility (Phase 10A.5) — **P2 Gap**

**Status:** 🟡 Half-wired  
**Claim:** "Text scaling" for low-vision users  
**Reality:**

- ✅ **Static scaling:** `textScale` setting reaches canvas render path (`MovablePanel.ts:360`)
- ❌ **Dynamic scaling:** No gaze-proximity-driven auto-scaling; user-configured only
- ❌ **Subtended-angle stability:** At 0.5 m vs. 3 m distance, same font size = different visual angle; no correction

**Impact:** Low-vision users must manually adjust `textScale` for each distance or operation; no adaptive affordance. **Listed in Phase 22.3 but incomplete.**

**Fix Required:**
- Add gaze-distance measurement in `MovablePanel.render()`
- Apply subtended-angle normalization to `fontSize`
- Option: auto-scale based on distance or give user a toggle ("stabilize readability")

---

#### 4. Export / Provenance (Phase 13.3) — **Partial**

**Status:** 🟡 Half-wired  
**Claim:** "Spatial Analysis Storybook & Provenance Export"  
**Reality:**

- ✅ **Telemetry export:** `TelemetryPanel.ts` exports raw telemetry as JSON
- ✅ **Session recovery:** `SessionStore` persists dataset + history to IndexedDB
- ❌ **Storybook export:** `AnalysisStorybookExporter` class exists but is **never instantiated**; export logic is hand-coded in `TelemetryPanel`
- ❌ **Provenance format:** No `.html` bundled story; no interactive replay; just telemetry

**Impact:** "Storybook export" is claimed in Phase 13.3 but doesn't exist in a distinct form; export is only raw telemetry. **Not a functional defect, but misleading roadmap terminology.**

**Fix Required:**
- Either: (a) wire `AnalysisStorybookExporter` into `TelemetryPanel`, or
- (b) Remove Phase 13.3 as misleading and mark Phase 10A.4 as the export implementation

---

### 🔲 Not Yet Attempted (Reserved for Later Phases)

- **Broader data ingestion** (SQL/warehouse connectors) — deferred, Phase 21+
- **User studies** (evidence of value) — not done; Phase 22+ planned
- **Full Rust migration** (Phase 21.3+) — command-buffer infrastructure ready but dormant

---

## Roadmap Correction Summary

| Phase | Component | Current Claim | Audit Finding | Action |
|---|---|---|---|---|
| 10A.5 | Colorblind data encoding | ✅ Done (palettes, UI color remap) | 🟡 UI done, data encoding missing | Move data-palette fix to Phase 22.3 (US22) |
| 10A.5 | Dwell threshold control | ✅ Done (dwell selection wired) | 🟡 Core done, UI control missing | Move UI stepper to Phase 22.3 (US23) |
| 10A.5 | Text scaling | ✅ Done (static scaling) | 🟡 Done, dynamic scaling missing | Move gaze-distance auto-scale to Phase 22.3 |
| 12.4 | Frustration response | ✅ Done (class + tests) | ✅ Wired by `AdaptiveAssistController` | Production wiring completed in Phase 22.3 |
| 12.4 | JIT gesture hints | ✅ Done (class + tests) | ✅ Wired by `AdaptiveAssistController` | Production wiring completed in Phase 22.3 |
| 12.4 | Gesture confidence HUD | ✅ Done (class + tests) | ✅ Wired by `AdaptiveAssistController` | Production wiring completed in Phase 22.3 |
| 13.3 | Storybook export | ✅ Done (`AnalysisStorybookExporter`) | 🔴 Built-only; export is in `TelemetryPanel` | Clarify: either wire exporter or remove class |
| 17.2 | CSV Parser Worker | ✅ Done (class + tests) | 🔴 Built-only; main thread parser used | Mark as "Built" in Phase 17.2; note main-thread still active |
| 17.2 | Draco Solver Worker | ✅ Done (class + tests) | 🔴 Built-only; main thread solver used | Mark as "Built" in Phase 17.2; note main-thread still active |
| 20.3 | Context recovery | ✅ Done (`ContextRecoveryManager`) | 🔴 Built-only; logic scattered in `Engine.ts` | Consolidate `Engine.ts` recovery into manager, or remove class |

---

## Immediate Next Steps

### 1. **Update roadmap Phase 12.4, 13.3, 17.2, 20.3 sections**
   - Distinguish "Built (class & tests complete)" from "Wired (instantiated in production)"
   - Explicitly mark the "built-only" components
   - Reference Phase 22.3 as the destination for wiring work

### 2. **Formalize Phase 22.3 scope as three tiers:** *(Tier B now complete)*
   - **Tier A (P1 Bugs):** 5 input correctness defects + 3 accessibility data-encoding gaps
    - **Tier B (Wiring):** ✅ Complete via `AdaptiveAssistController` in `World.ts`; Quest usability validation remains pending
   - **Tier C (Polish):** Gaze-distance text scaling, frosted panel backings, design-system convergence

### 3. **Unblock Phase 21.3 (command buffers)**
   - Run load-test staircase (`Shift+T` in dev mode)
   - Document acceptance criteria in ROADMAP.md
   - If regression-free, unblock; if regression, diagnose before proceeding

### 4. **Complete study package freeze**
   - Review each placeholder in `docs/study/*.md`
   - Fill real content or mark as "placeholder, complete by X date"
   - Lock version once content is stable

---

## Code Quality Notes

- **Test coverage:** All "built-only" components have solid unit/integration test suites (not brittle)
- **Code cleanliness:** No dead code; all defined classes have legitimate behavior (not accidental)
- **Architecture:** Separation is clean; wiring is primarily a World/coordinator instantiation task, not refactoring
- **Risk:** Low — adding instantiation lines is low-risk; the hard part (design & implementation) is done
