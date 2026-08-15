# Documentation Curator Brief

**Agent Role:** Documentation Manager & Context Hygiene  
**Primary Objective:** Clean up, organize, and maintain a lean, authoritative document set aligned with product state  
**Created:** 2026-08-14

---

## Current Documentation Landscape

### ✅ Canonical (Authoritative, Actively Maintained)

| Document | Purpose | Status | Last Updated |
|---|---|---|---|
| `docs/ROADMAP.md` | Product state & phase planning | ✅ Active, refreshed 2026-08-14 | Daily (gate updates) |
| `docs/PROJECT_DOCS_INDEX.md` | Three-layer doc model definition | ✅ Active | 2026-08-14 |
| `docs/study/` (directory) | Study protocol, analysis plan, consent, governance | ✅ Active (draft) | 2026-08-14 |
| `README.md` | Quick start, build commands, deployment | ✅ Active | 2026-08-14 |
| `CLAUDE.md` | Development onboarding + architecture overview | ✅ Active | 2026-08-14 |
| `.agents/team.json` | AI team configuration | ✅ Active | 2026-08-14 |
| `.agents/agents.md` | AI team role guide | ✅ Active | 2026-08-14 |
| `TEST_READY.md` | Test readiness report + E2E tier breakdown | ✅ Active | 2026-08-12 |

### 🟡 Active but Incomplete (Drafts / Placeholders)

| Document | Purpose | Status | Issues |
|---|---|---|---|
| `docs/AUDIT_PHASES_1_20.md` | Phases 1–20 audit (built vs. wired) | 🟡 New, comprehensive | None yet |
| `docs/AUDIT_RECOMMENDATION.md` | Audit findings + next steps | 🟡 New, executive summary | None yet |
| `docs/study/PROTOCOL.md` | Study protocol | 🟡 Draft, placeholders | Multiple TBD fields |
| `docs/study/ANALYSIS_PLAN.md` | Analysis plan | 🟡 Draft, placeholders | Multiple TBD fields |
| `docs/study/CONFOUNDS.md` | Confound register | 🟡 Draft, placeholders | Multiple TBD fields |
| `docs/GETTING_STARTED.md` | User onboarding guide | 🟡 Active but outdated | References old UI, needs refresh |
| `docs/INTERACTIONS.md` | Gesture & interaction reference | 🟡 Active but incomplete | Missing recent Phase 22 gestures |
| `docs/ARCHITECTURE.md` | System architecture | 🟡 Active but outdated | World.ts decomposition not reflected |

### 🔴 Deprecated / Legacy (Should Be Archived or Removed)

| Document | Purpose | Status | Reason for Removal |
|---|---|---|---|
| `docs/_legacy_study_drafts/` (6 files) | Legacy study protocol drafts | 🔴 Archived (2026-08-14) | Superseded by `docs/study/` canonical set |
| `docs/IDEOLOGY.md` | Project vision essay | 🔴 Stale (last edit ~2026-07-15) | Narrative hasn't been updated; thesis is in ROADMAP.md |
| `docs/GAME_UI_INSPIRATION.md` | UI design references | 🔴 Draft artifact (~2026-06) | No active design decisions trace to this; useful for reference but not on critical path |
| `docs/GITHUB_ISSUES.md` | Issue tracking guide | 🔴 Minimal (~150 words) | Redundant with GitHub UI; not used |
| `docs/ARTEFACTS.md` | Artefact taxonomy | 🟡 Outdated | Last major edit ~2026-07-15; Phase 22 additions not reflected |
| `docs/ANALYTICS.md` | Analytics features | 🟡 Outdated | Last edit ~2026-07-15; TDA on-demand feature not documented |
| `docs/DESIGN_SYSTEM.md` | Color, typography, spacing tokens | 🟡 Outdated | `WorldTheme` refactor + low-strain presets not reflected; `src/vr/palette.ts` introduced in Phase 22.2 but not documented |
| `docs/USER_STORIES_AND_UX_ANALYSIS.md` | UX audit findings (29 user stories) | 🟡 Active but position unclear | Excellent research doc, but should it live in `docs/study/` or repo root? Currently confuses product and research layers |

### 📄 Build Artifacts & Auto-Generated (Should Be Ignored)

| File | Status |
|---|---|
| `docs/index.html` | Auto-built from `template.html` via `build-html.mjs` |
| `docs/ROADMAP.html` | Auto-built from `ROADMAP.md` |
| `docs/GETTING_STARTED.html` | Auto-built from `GETTING_STARTED.md` |
| (All other `.html` in `docs/`) | Auto-built; changes to `.md` source should be made, not `.html` |

---

## Key Issues Identified

### 1. **Three-Layer Doc Model Not Fully Adopted**
- `docs/ROADMAP.md` (product layer) is canonical ✅
- `docs/study/` (study layer) is canonical ✅
- But `docs/USER_STORIES_AND_UX_ANALYSIS.md` spans both product and research — should it move to `docs/study/`?
- `docs/IDEOLOGY.md` is orphaned (research/vision, not product governance, not study protocol)

**Action:** Clarify destination for research-oriented docs: move to `docs/study/`, keep in `docs/`, or archive?

### 2. **Outdated Feature Documentation**
- `docs/INTERACTIONS.md` missing Phase 22 gestures (TDA on-demand, updated wheel menu layout)
- `docs/DESIGN_SYSTEM.md` missing WorldTheme refactor + low-strain presets
- `docs/ARTEFACTS.md` missing recent topology and layout updates
- `docs/ANALYTICS.md` missing TDA on-demand feature toggle

**Action:** Refresh after Phase 22.3 completion; create a refresh audit checklist.

### 3. **Stale Architecture Docs**
- `docs/ARCHITECTURE.md` doesn't reflect World.ts decomposition into 16 coordinators (Phase 17)
- Doesn't reflect SceneGraphController / WorkspaceManager delegation
- Still reads as if World is a monolith

**Action:** Refresh post-Phase 17 work (already done in code, docs lag).

### 4. **Study Package Placeholders Not Frozen**
- `docs/study/PROTOCOL.md`, `ANALYSIS_PLAN.md`, `CONFOUNDS.md`, `CONSENT.md` have TBD fields
- No freeze deadline defined
- Blocks formal study package adoption

**Action:** Decide: freeze as-is with placeholders, fill all fields, or defer to Phase 23?

### 5. **Website HTML Sync Issue**
- All `.html` files in `docs/` are auto-generated via `build-html.mjs`
- If someone edits `.html` directly, next build clobbers changes
- No integration test ensuring HTML ↔ Markdown stay in sync

**Action:** Document the build process in contributing guide; add CI step to verify sync.

### 6. **Context Clutter**
The following documents should probably NOT be indexed into agent context by default:
- `docs/_legacy_study_drafts/` (archived, confusing)
- `docs/IDEOLOGY.md` (orphaned vision essay)
- `docs/GAME_UI_INSPIRATION.md` (reference only, not operational)
- `docs/GITHUB_ISSUES.md` (minimal, redundant)
- All `.html` files (auto-generated, hard to read in plaintext)

**Action:** Create a `.docs-ignore` or update `.gitignore` guidance for AI context tools.

---

## Three-Layer Doc Model Alignment Checklist

Current model from `docs/PROJECT_DOCS_INDEX.md`:

1. **Product Governance** — Roadmap, feature docs, architecture
   - ✅ `docs/ROADMAP.md` (canonical)
   - ✅ `CLAUDE.md` (onboarding + conventions)
   - ✅ `README.md` (quick start)
   - ❓ `docs/INTERACTIONS.md` (needs refresh)
   - ❓ `docs/DESIGN_SYSTEM.md` (needs refresh)
   - ❓ `docs/ARTEFACTS.md` (needs refresh)
   - ❓ `docs/GETTING_STARTED.md` (needs refresh)
   - ❓ `docs/ARCHITECTURE.md` (needs refresh)

2. **Study Protocol & Governance** — Research design, protocol, analysis plan, confounds, consent
   - ✅ `docs/study/PROTOCOL.md` (draft, placeholders)
   - ✅ `docs/study/ANALYSIS_PLAN.md` (draft, placeholders)
   - ✅ `docs/study/CONFOUNDS.md` (draft, placeholders)
   - ✅ `docs/study/CONSENT.md` (template present)
   - ✅ `docs/study/REPRESENTATION_EQUIVALENCE.md` (template present)
   - ❓ `docs/USER_STORIES_AND_UX_ANALYSIS.md` (should this move here?)

3. **Operations & Reproducibility** — Data dictionary, versioning, session store
   - ✅ `docs/study/DATA_DICTIONARY.md` (template present)
   - ✅ `docs/study/version.json` (schema present)
   - ✅ `src/data/SessionStore.ts` (session persistence code)

**Orphaned docs** (not in any layer):
- `docs/IDEOLOGY.md` (vision/narrative, not operational)
- `docs/GAME_UI_INSPIRATION.md` (reference only)
- `docs/GITHUB_ISSUES.md` (process doc, minimal)

---

## Recommended Actions (Priority Order)

### Tier 1 (Immediate – Unblock Phase 22.3)
1. **Freeze study package** — Decide: accept placeholders or fill all fields? (1–2 days)
2. **Move or archive orphaned docs** — Clarify home for IDEOLOGY, USER_STORIES_AND_UX_ANALYSIS (1 day)
3. **Document build process** — Add notes to contributing guide for HTML sync (30 min)

### Tier 2 (After Phase 22.3)
4. **Refresh feature docs** — Update INTERACTIONS, DESIGN_SYSTEM, ARTEFACTS, ANALYTICS for Phase 22 changes (2–3 days)
5. **Refresh architecture docs** — ARCHITECTURE.md should reflect World.ts decomposition (1–2 days)
6. **Refresh getting-started** — GETTING_STARTED.md should match current UI state (1–2 days)

### Tier 3 (Long-term Maintenance)
7. **Create context ignore list** — Formalize which docs should not be auto-indexed (30 min)
8. **Add HTML sync CI check** — Verify `docs/*.md` and `docs/*.html` are always in sync (1–2 days)
9. **Archive older design artifacts** — GAME_UI_INSPIRATION, etc. to `docs/_design-reference/` (30 min)

---

## Success Criteria

By end of Phase 22.3, documentation should satisfy:

- ✅ All canonical docs align with current product state (no >2-week staleness)
- ✅ Study package either frozen (as-is with placeholders) or complete
- ✅ No misleading or contradictory docs in main `docs/` search path
- ✅ Three-layer model clearly enforced (no documents living in two layers)
- ✅ Context ignore list defined for AI agents
- ✅ Website HTML is auto-generated and sync is verified

---

## Quick Reference: Docs to Update After Phase 22.3

| Document | Changes Needed | Owner |
|---|---|---|
| `docs/INTERACTIONS.md` | Add TDA lens toggle, updated wheel menu layout, phase 22 gestures | documentation_curator |
| `docs/DESIGN_SYSTEM.md` | Add low-strain + muted themes, palette.ts tokens, updated typography | documentation_curator |
| `docs/ARTEFACTS.md` | Note aggregate visual placeholder status, link to US5 gap | documentation_curator |
| `docs/ANALYTICS.md` | Note TDA on-demand feature, clarify TDA components | documentation_curator |
| `docs/ARCHITECTURE.md` | Reflect World.ts decomposition, coordinator delegation, input refactor | documentation_curator |
| `docs/GETTING_STARTED.md` | Refresh for current Quest setup, panel positions, theme presets, low-strain UX | documentation_curator |
| `docs/ROADMAP.md` | Refresh Current Status block post-22.3 (standard end-of-phase update) | architect |
