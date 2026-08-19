# Documentation Curator Brief

**Agent Role:** Documentation Manager & Context Hygiene  
**Primary Objective:** Clean up, organize, and maintain a lean, authoritative document set aligned with product state  
**Created:** 2026-08-14

---

## Current Documentation Landscape

### ✅ Canonical (Authoritative, Actively Maintained)

| Document | Purpose | Status | Last Updated |
|---|---|---|---|
| `docs/Nemosyne_Definitive_Vision_and_Roadmap.md` | Governing product, vision, principles & Gate model | ✅ Authoritative | 2026-08-19 |
| `docs/ROADMAP.md` | Product state, Gate 0–7 deliverables, active sprints | ✅ Active | 2026-08-19 |
| `docs/DEVELOPER_EXPLAINER.md` | Codebase mental model, data lifecycle, WASM ABI, cookbooks | ✅ Active | 2026-08-19 |
| `docs/ARCHITECTURE.md` | Modular subsystems specification & boundaries | ✅ Active | 2026-08-19 |
| `docs/PROJECT_DOCS_INDEX.md` | Three-layer doc model definition & archive index | ✅ Active | 2026-08-19 |
| `docs/OSS_MIGRATION_PROPOSAL.md` | Open-source library adoption proposal | ✅ Active | 2026-08-19 |
| `docs/study/` (directory) | Study protocol, analysis plan, consent, governance | ✅ Active (draft) | 2026-08-19 |
| `README.md` | Quick start, build commands, deployment | ✅ Active | 2026-08-19 |
| `CLAUDE.md` | Development onboarding + architecture overview | ✅ Active | 2026-08-19 |

### 🟡 Technical Reference & Operational Registers

| Document | Purpose | Status | Notes |
|---|---|---|---|
| `docs/ERROR_REGISTER.md` | Typed error registry & recovery actions | ✅ Complete | Active reference |
| `docs/TECHNICAL_SPEC.md` | Technical specification & performance budgets | ✅ Complete | Active reference |
| `docs/WIKI.md` | Codebase symbol and class dictionary | ✅ Complete | Active reference |
| `docs/GETTING_STARTED.md` | User and developer onboarding guide | ✅ Complete | Active reference |
| `docs/INTERACTIONS.md` | Gesture & interaction reference | ✅ Complete | Active reference |
| `docs/ANALYTICS.md` | Analytics features & TDA summaries | ✅ Complete | Active reference |
| `docs/DESIGN_SYSTEM.md` | Color, typography, spacing tokens | ✅ Complete | Active reference |

### 🔴 Historical Archives (`docs/archive/`)

| Document | Purpose | Status | Reason for Archive |
|---|---|---|---|
| `docs/archive/ROADMAP_PHASES_21-26_COMPLETED.md` | Phases 21–26 & Waves 0–6 completed logs | 🔴 Archived (2026-08-19) | Historical record of completed phases |
| `docs/archive/ROADMAP_PHASES_1-20_COMPLETED.md` | Phases 1–20 completed logs | 🔴 Archived (2026-08-18) | Historical record of early phases |
| `docs/archive/ROADMAP_HISTORY.md` | Historical phase index | 🔴 Archived | Context only |

---

## Key Issues Identified

### 1. **Three-Layer Doc Model**
- `docs/ROADMAP.md` (product layer) is canonical ✅
- `docs/study/` (study layer) is canonical ✅
- `docs/Nemosyne_Definitive_Vision_and_Roadmap.md` is the product-direction authority.
- `docs/USER_STORIES_AND_UX_ANALYSIS.md` remains product research input, not study authority.
- Historical vision, design, issue, and study drafts are now under `docs/archive/`.

**Action:** Keep active authorities in the index; do not promote proposals or research inputs to
authority without a governance decision.

### 2. **Outdated Feature Documentation**
- `docs/INTERACTIONS.md` missing Phase 22 gestures (TDA on-demand, updated wheel menu layout)
- `docs/DESIGN_SYSTEM.md` missing WorldTheme refactor + low-strain presets
- `docs/ARTEFACTS.md` missing recent topology and layout updates
- `docs/ANALYTICS.md` missing TDA on-demand feature toggle

**Action:** Refresh after Phase 22.3 completion; create a refresh audit checklist.

### 3. **Stale Architecture Docs**
- `docs/ARCHITECTURE.md` now records the coordinator decomposition and the target World composition-root boundary

**Action:** Implement and validate the Stable Alpha World composition-root refactor; keep the
architecture document aligned with the resulting ownership boundaries.

### 4. **Study Package Not Frozen**
- `docs/study/PROTOCOL.md`, `ANALYSIS_PLAN.md`, `CONFOUNDS.md`, `CONSENT.md` have TBD fields
- No freeze deadline defined
- Blocks formal study package adoption

**Action:** Complete the 2D-versus-VR crossover decisions, task artifact, analysis plan, consent,
data dictionary, and version binding before collection. Do not claim a frozen package yet.

### 5. **Website HTML Sync Issue**
- All `.html` files in `docs/` are auto-generated via `build-html.mjs`
- If someone edits `.html` directly, next build clobbers changes
- No integration test ensuring HTML ↔ Markdown stay in sync

**Action:** Document the build process in contributing guide; add CI step to verify sync.

### 6. **Context Clutter**
The following documents should probably NOT be indexed into agent context by default:
- `docs/archive/` (historical, not an authority)
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
- `docs/archive/` (historical material, not operational)

---

## Recommended Actions (Priority Order)

### Tier 1 (Immediate – Unblock Phase 22.3)
1. **Complete study freeze inputs** — Resolve the crossover, estimands, task artifact, and capture policy.
2. **Maintain archive boundaries** — Keep historical material out of active authority paths.
3. **Document build process** — Add notes to contributing guide for HTML sync (30 min)

### Tier 2 (After Phase 22.3)
4. **Refresh feature docs** — Update INTERACTIONS, DESIGN_SYSTEM, ARTEFACTS, ANALYTICS for Phase 22 changes (2–3 days)
5. **Refresh architecture docs** — ARCHITECTURE.md should reflect World.ts decomposition (1–2 days)
6. **Refresh getting-started** — GETTING_STARTED.md should match current UI state (1–2 days)

### Tier 3 (Long-term Maintenance)
7. **Create context ignore list** — Formalize which docs should not be auto-indexed (30 min)
8. **Add HTML sync CI check** — Verify `docs/*.md` and `docs/*.html` are always in sync (1–2 days)
9. **Archive older design artifacts** — completed under `docs/archive/`; keep that path canonical.

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
