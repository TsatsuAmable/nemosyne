# QCA4a Spatial Glyph Hygiene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the unsupported middle-dot glyph from spatial VR text, eliminate its governed-capture warning storm, and obtain a controlled Quest 3S before/after observation without changing product or evidence semantics.

**Architecture:** Keep UIKit, the diagnostic transport, and the governed QCA0 call graph unchanged. Replace the decorative U+00B7 separator with ASCII `|` at every spatial VR text source, protect the per-frame QCA operator/load-test outputs with behavior tests, then rerun the fixed QCA0 profile at the immutable branch head.

**Tech Stack:** TypeScript 6, Three.js/WebXR, `@pmndrs/uikit`, Vitest 5, Vite 8, ADB-connected Meta Quest 3S.

**Spec:** `docs/superpowers/specs/2026-10-04-qca4a-spatial-glyph-hygiene-design.md`

## Global Constraints

- Replace U+00B7 only under `src/vr/**`; desktop copy remains unchanged.
- Use the supported literal separator ` | ` and preserve all surrounding wording, values, line breaks, actions and state.
- Do not suppress console output, modify UIKit, add a font asset, disable remote diagnostics, change the QCA0 profile, or change evidence/custody semantics.
- The governed comparison remains `quest-qca0` / `qca0-row-addressable-knee-v1` on ADB-attributed `META_QUEST_3S` with `ROW_ADDRESSABLE` coverage.
- Do not connect `AdaptiveFrameGovernor` to prefix-based instance truncation in this tranche.

## Review Focus

- A dynamic QCA operator summary must not retain U+00B7 after sample/progress/disposition fields are populated (Task 1 test).
- A live load-test summary must not retain U+00B7 after step/frame/GPU fields are populated (Task 1 test).
- The substitution must not alter the values, labels, action availability or line structure surrounding separators (Task 1 tests and focused panel suites).
- No spatial VR source may retain the known unsupported U+00B7 literal after the mechanical substitution (Task 1 bounded audit).
- The hardware comparison must not be called an improvement if identity/profile/representation/custody differ or the run is invalid (Task 2 adjudication and comparison).

---

### Task 1: Remove the Unsupported Spatial Separator

**Files:**
- Modify: `tests/validation-operator-panel.test.ts`
- Modify: `tests/load-test-panel.test.ts`
- Modify: all `src/vr/**` files returned by `rg -l "·" src/vr`

**Interfaces:**
- Consumes: existing `ValidationOperatorPanel.getRenderedSummary()` and `LoadTestPanel` summary formatter behavior.
- Produces: spatial VR strings with identical facts and actions using ` | ` instead of U+00B7.

- [ ] **Step 1: Write failing hot-path behavior tests**

Add a populated QCA0 sample/progress case to `validation-operator-panel.test.ts` and a populated load-test sample/result case to `load-test-panel.test.ts`. Assert the real formatted summaries contain the expected values and ` | ` separators and do not contain U+00B7.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm run test:integration -- tests/validation-operator-panel.test.ts tests/load-test-panel.test.ts`

Expected: FAIL because the real formatted summaries still contain U+00B7 and not the supported separator.

- [ ] **Step 3: Apply the minimal spatial-text substitution**

Replace every U+00B7 occurrence under `src/vr/**` with `|`. Do not alter imports, panel structure, font configuration, diagnostics, state logic or non-spatial source.

- [ ] **Step 4: Run focused tests and the bounded audit**

Run: `npm run test:integration -- tests/validation-operator-panel.test.ts tests/load-test-panel.test.ts`

Expected: PASS.

Run: `if rg -n "·" src/vr; then exit 1; fi`

Expected: exit 0 with no matches.

- [ ] **Step 5: Run affected spatial/QCA verification**

Run: `npm run test:integration -- tests/validation-operator-panel.test.ts tests/load-test-panel.test.ts tests/ui-system/status-strip-uikit.test.ts tests/pt5c-xr-investigation-panel.test.ts tests/pt5d-continuity-ui.test.ts tests/quest-validation-adjudication.test.ts tests/quest-validation-closed-loop.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the production change**

Run: `git add src/vr tests/validation-operator-panel.test.ts tests/load-test-panel.test.ts && git commit -m "perf(qca4): remove unsupported spatial glyph"`

### Task 2: Verify and Capture the Controlled Device Result

**Files:**
- Modify only if evidence changes programme status: `docs/ROADMAP.md`
- Modify only if evidence changes durable QCA interpretation: `docs/work/quest-compute/QCA0_BASELINE.md`
- Evidence only, git-ignored: `logs/validation/<session>/`

**Interfaces:**
- Consumes: Task 1 exact branch head and the governed `quest-qca0` launcher/custody path.
- Produces: automated branch evidence, an exact-head Quest capture when the device session is operable, and an honest QCA4a adoption/next-step disposition.

- [ ] **Step 1: Run repository verification**

Run: `npm run docs:check && npm run typecheck && npm run build`

Expected: PASS.

Run: `npm run test:integration -- tests/validation-operator-panel.test.ts tests/load-test-panel.test.ts tests/quest-validation-adjudication.test.ts tests/quest-validation-custody.test.ts tests/quest-validation-closed-loop.test.ts tests/quest-validation-fidelity.test.ts`

Expected: PASS.

- [ ] **Step 2: Launch the governed exact-head Quest experiment**

Run: `npm run dev:quest:qca0`

Expected: the launcher binds the clean exact head and ADB Quest 3S identity, the operator confirms the fixed QCA0 profile, and one terminal report is custody-finalized. If the browser cannot enter/retain XR or the run emits no terminal report, record a no-result attempt rather than manufacturing a comparison.

- [ ] **Step 3: Adjudicate and compare without promoting unsupported claims**

Require `VALID_CAPTURE`, active XR, the exact QCA0 profile, matching row-addressable cardinalities, and verified custody before comparing with the QCA0 baseline. Report missing-middle-dot warning count and each graded step's load duration, cadence p95/FPS/dropped rate and triangles. Treat variance as observation, not causation.

- [ ] **Step 4: Update durable status only if warranted**

If the exact-head capture is valid and materially changes the authorized QCA sequence or durable baseline interpretation, update the existing roadmap/QCA0 document and run `npm run docs:check`. Otherwise keep run detail in the PR body rather than creating roadmap churn.

- [ ] **Step 5: Commit any warranted evidence interpretation**

If Step 4 changes tracked files, commit them with `git commit -m "docs(qca4): record glyph hygiene result"`. Make no source commit after the final exact-head physical capture.
