# Context Ignore Guide

**Purpose:** Identify which documentation and source files should NOT be indexed into AI agent context by default  
**Updated:** 2026-08-14

---

## Why This Matters

- **Large context = slower processing + higher cost.** Excluding stale or redundant docs saves tokens and latency.
- **Misleading docs = wrong direction.** Outdated docs that contradict current state should be explicitly out-of-context.
- **Generated files = noise.** Auto-built HTML and compiled artifacts muddy the waters.
- **Archive = clarity.** Legacy and deprecated materials should be excluded unless explicitly needed.

---

## Files to Ignore by Category

### 📁 Auto-Generated / Build Artifacts
These are generated from source; changes should be made to `.md`, not `.html`. Exclude from indexing.

```
docs/*.html
docs/site/*.html
coverage/
dist/
target/
test-results/
.vscode/
node_modules/
```

**Rationale:** Compiled outputs; indexing `.md` source is sufficient.

---

### 🗄️ Archive & Legacy
Explicitly deprecated or archived materials. Confusing to include.

```
docs/_legacy_study_drafts/
```

**Rationale:** Superseded by `docs/study/` canonical set. Reference only if needed for historical context.

---

### 📝 Orphaned / Unclear Position
Documents that don't fit the three-layer model and aren't actively maintained. Reference only.

```
docs/IDEOLOGY.md
docs/GAME_UI_INSPIRATION.md
docs/GITHUB_ISSUES.md
```

**Rationale:**
- `IDEOLOGY.md` — Vision essay; narrative is in ROADMAP.md Current Status
- `GAME_UI_INSPIRATION.md` — Design reference; not tied to active decisions
- `GITHUB_ISSUES.md` — ~150 words; GitHub UI is authoritative

---

### 🟡 Outdated (Refresh Needed Post-Phase 22)
These are active docs but lag current product state. Use with caution until refreshed.

```
docs/INTERACTIONS.md         (Phase 22 gestures missing)
docs/DESIGN_SYSTEM.md        (Low-strain themes + palette.ts missing)
docs/ARTEFACTS.md            (Recent topology updates missing)
docs/ANALYTICS.md            (TDA on-demand missing)
docs/ARCHITECTURE.md         (World.ts decomposition not reflected)
docs/GETTING_STARTED.md      (Quest setup outdated, UI changes not reflected)
```

**Action:** Refresh after Phase 22.3. Mark as ⚠️ stale until refreshed.

**Temporary exclusion until refresh:** Yes, or note staleness in prompt context.

---

### ✅ Always Include (Canonical)

These are authoritative and current. Always include in agent context.

```
docs/ROADMAP.md              (Single source of truth for product state)
docs/PROJECT_DOCS_INDEX.md   (Three-layer model definition)
docs/study/                  (Study protocol, canonical)
README.md                    (Quick start, authoritative)
CLAUDE.md                    (Developer onboarding + conventions)
.agents/team.json            (AI team configuration)
.agents/agents.md            (AI role guide)
TEST_READY.md                (Test status, current as of 2026-08-12)
docs/AUDIT_*.md              (Recent audit findings, Phase 1–20 analysis)
```

---

## Recommended .gitignore Addendum for AI Context Tools

If using tools like GitHub Copilot or Cursor that respect `.gitignore`:

```
# Auto-generated documentation
docs/*.html
docs/site/

# Build artifacts
coverage/
dist/
target/
test-results/

# Legacy / archived
docs/_legacy_study_drafts/

# Node / environment
node_modules/
.node-version
.env

# IDE
.vscode/
.idea/
*.swp
*.swo
```

Add to `.gitignore` or create `.docsignore` for clarity.

---

## How to Use This Guide

### For AI Agents
When instantiating an agent (architect, coder, reviewer, curator):
1. **Always load:** Canonical docs (ROADMAP.md, study/, README.md)
2. **Conditionally load:** Outdated docs only if the task is explicitly about refreshing them
3. **Never load:** Auto-generated files, archives, orphaned docs
4. **Reference:** CLAUDE.md for project conventions

### For Contributors
Before adding a new doc:
- Which layer does it belong to? (Product / Study / Operations)
- Is it tied to a specific Phase?
- Will it need to be refreshed after Phase completion?
- Does it duplicate existing docs?

### For Documentation Curator Agent
- **Audit frequency:** After each milestone (phase completion)
- **Refresh trigger:** Any doc >2 weeks old that references a completed phase
- **Archive trigger:** Docs no longer relevant to active roadmap
- **Context audit trigger:** >30 KB of outdated docs identified

---

## Exclusion Rationale Summary

| Category | Example | Why Exclude |
|---|---|---|
| Auto-generated | `docs/ROADMAP.html` | Index the `.md` source instead |
| Archive | `docs/_legacy_study_drafts/` | Superseded; confusing |
| Orphaned | `docs/IDEOLOGY.md` | No clear operational role |
| Outdated | `docs/INTERACTIONS.md` | Will be refreshed soon; don't embed stale info |
| Noise | `node_modules/`, `coverage/` | Build artifacts, not documentation |

---

## Next Steps

1. **Curator audit:** Review each file in `docs/` against this guide (2 hours)
2. **Create formal ignore:** Add to `.gitignore` or `.docsignore` (30 min)
3. **Document in contributing guide:** Link this guide in CONTRIBUTING.md (30 min)
4. **Refresh schedule:** After Phase 22.3, update outdated files (2–3 days)
5. **Re-audit:** After Phase 23, repeat audit and refresh (2 hours)
