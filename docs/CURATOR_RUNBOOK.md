# Documentation Curator Runbook

**Role:** Documentation Manager & Context Hygiene  
**Purpose:** Keep docs lean, current, aligned with product state  
**Frequency:** After each phase completion + monthly maintenance audit

---

## Phase Completion Audit (What to Do After Each Phase)

### Step 1: Update Roadmap Current Status Block (15 min)
- [ ] Read `docs/ROADMAP.md` Current Status block
- [ ] Update these bullets with fresh state:
  - Last updated date
  - Repository state summary
  - Architectural/engineering status
  - Study package status
  - Blockers/next steps
  - Resume pointers
- [ ] Keep block ≤ 30 lines; move narrative to phase sections

### Step 2: Identify Changed Features (30 min)
- [ ] Run `git log --oneline -20` to see merged PRs since last audit
- [ ] List all user-facing feature changes (gestures, UI, settings, etc.)
- [ ] Cross-reference against these docs:
  - `docs/INTERACTIONS.md` (gestures, interaction model)
  - `docs/DESIGN_SYSTEM.md` (colors, typography, themes)
  - `docs/ARTEFACTS.md` (data visualization types)
  - `docs/ARCHITECTURE.md` (system structure)
  - `docs/GETTING_STARTED.md` (user onboarding)

### Step 3: Flag Stale Docs (30 min)
For each doc identified as changed:
- [ ] Is the doc still accurate?
  - If **yes:** Mark as "refreshed" and update last-edit date
  - If **no:** Mark as 🟡 outdated and add a staleness note
- [ ] Create issues or notes for refresh work (post-phase)

### Step 4: Audit Orphaned Docs (30 min)
Check these regularly:
- [x] Historical vision/design/issue notes moved to `docs/archive/`.
- [ ] Any other files in `docs/` not explicitly canonical?

Decision: **Keep, Archive, or Move to `docs/study/`?**

### Step 5: Study Package Freeze (1 hour or defer)
- [ ] Review `docs/study/PROTOCOL.md`, `ANALYSIS_PLAN.md`, `CONFOUNDS.md`
- [ ] Count TBD / placeholder fields
- [ ] Decision:
  - [ ] **Freeze as-is with placeholders** (document the freeze date and version)
  - [ ] **Fill all placeholders** (2–3 days of research work)
  - [ ] **Defer to Phase 23** (move deadline)
- [ ] Update `docs/study/version.json` if changes made

### Step 6: Sync Website & HTML (30 min)
- [ ] Run `npm run docs` or equivalent build command
- [ ] Verify all `.html` files in `docs/` are regenerated
- [ ] Spot-check 2–3 pages: `docs/ROADMAP.html`, `docs/GETTING_STARTED.html`
- [ ] If HTML doesn't match `.md` rendering, troubleshoot `build-html.mjs`

### Step 7: Create Refresh Checklist (1 hour, post-phase)
If docs need refresh:
- [ ] Create issues for each stale doc
- [ ] Assign to documentation_curator agent
- [ ] Link to this runbook
- [ ] Set target refresh date (typically 1 week post-phase)

---

## Monthly Maintenance Audit

Run once per month or on-demand to keep docs lean.

### Task 1: Context Clutter Review (30 min)
- [ ] Check file sizes: `du -sh docs/* | sort -rh`
- [ ] Any files >100 KB that aren't expected?
- [ ] Are there any new generated or build artifacts in `docs/`?
- [ ] Archive if needed (move to `docs/_archive/` or delete)

### Task 2: Three-Layer Model Alignment (30 min)
- [ ] Do all docs in `docs/` clearly belong to one of:
  - Product Governance (roadmap, features, architecture)
  - Study Protocol (research design, protocols, governance)
  - Operations (data dictionary, versioning, procedures)
- [ ] Any docs spanning multiple layers? → Decide: split or move?
- [ ] Update `docs/PROJECT_DOCS_INDEX.md` if alignment changed

### Task 3: Outdated Content Sweep (1 hour)
- [ ] Grep for Phase or date references: `grep -r "2026-06" docs/`
- [ ] For each old date, check if that phase/work is still current
- [ ] If outdated, flag with staleness note or refresh

### Task 4: Broken Links & References (30 min)
- [ ] Run `find docs/ -name "*.md" -exec grep -l "\[.*\](.*)" {} \;`
- [ ] Spot-check 5 cross-references for dead links
- [ ] If dead, update or remove reference

### Task 5: Canonical Source Verification (30 min)
- [ ] Is `docs/ROADMAP.md` the single source of truth? ✅
- [ ] Are older sprint/phase docs archived or deleted? ✅
- [ ] Are there duplicate facts in different docs? → Remove redundancy
- [ ] Is `docs/study/` clearly the canonical study package? ✅

---

## Refresh Checklist (When Updating Outdated Docs)

When a doc is flagged as outdated and assigned to refresh:

### For `docs/INTERACTIONS.md`
- [ ] Run `git log --oneline -- src/vr/interactions/ src/vr/ui/HandWheelMenu.ts | head -10`
- [ ] Review recent gesture/menu changes
- [ ] Update gesture table: new gestures, retired gestures, changes to existing
- [ ] Update menu structure (Phase 22 changed layout)
- [ ] Test section commands: verify they still exist in code
- [ ] Update last-revised date and Phase number

### For `docs/DESIGN_SYSTEM.md`
- [ ] Check `src/vr/palette.ts` (new in Phase 22.2)
- [ ] List all theme presets from `src/vr/WorldTheme.ts`
- [ ] Update color token table
- [ ] Note low-strain and muted presets (Phase 22.2)
- [ ] Verify typography section matches canvas rendering
- [ ] Update last-revised date and Phase number

### For `docs/ARTEFACTS.md`
- [ ] Review `src/vr/artifacts/` and `src/draco/` for new artifact types
- [ ] Update taxonomy
- [ ] Flag any visual placeholders (e.g., aggregate operation)
- [ ] Link to relevant user stories if gaps exist
- [ ] Update last-revised date and Phase number

### For `docs/ANALYTICS.md`
- [ ] Note TDA on-demand feature (Phase 22.2)
- [ ] List all statistical features in `src/draco/` and `src/analytics/`
- [ ] Link to TDA plane documentation
- [ ] Update last-revised date and Phase number

### For `docs/ARCHITECTURE.md`
- [ ] Review `src/vr/World.ts` and coordinators (Phase 17)
- [ ] Update component diagram or description
- [ ] Note SceneGraphController, WorkspaceManager, etc.
- [ ] Reflect input routing refactor
- [ ] Update last-revised date and Phase number

### For `docs/GETTING_STARTED.md`
- [ ] Check current Quest setup process
- [ ] Update any UI paths or settings locations
- [ ] List current gesture set and panel layout
- [ ] Note theme presets
- [ ] Update screenshot paths if needed
- [ ] Update last-revised date and Phase number

---

## Decision Tree: Keep, Archive, or Move?

When deciding what to do with an orphaned or outdated doc:

```
Does it describe current product features or guidance?
  ├─ YES → Keep, mark as active, schedule refresh if stale
  │
  └─ NO → Has it been superseded by newer docs?
         ├─ YES → Archive to `docs/archive/` or delete
         │
         └─ NO → Is it research/methodological (not product guidance)?
                ├─ YES → Move to `docs/study/` or archive
                │
                └─ NO → Is it a reference/inspiration doc (not operational)?
                        ├─ YES → Archive to `docs/archive/`
                       │
                       └─ NO → UNKNOWN → Ask team, then decide
```

---

## Common Patterns

### Pattern 1: Doc Updated in One Phase, Not Refreshed in Next
**Example:** `docs/INTERACTIONS.md` updated in Phase 12, not touched in Phase 22  
**Action:** Add to refresh checklist; prioritize in next month's audit

### Pattern 2: Feature Implemented but Doc Is Placeholder
**Example:** `docs/study/PROTOCOL.md` has TBD fields 6 months later  
**Action:** Either fill immediately or formally defer; don't leave in limbo

### Pattern 3: Orphaned Design Doc
**Example:** archived design notes — no recent design decisions reference them
**Action:** Archive to `docs/archive/`; not in main context

### Pattern 4: Auto-Generated HTML Stale
**Example:** `docs/ROADMAP.html` doesn't match current `docs/ROADMAP.md`  
**Action:** Run build; add pre-commit hook to regenerate on `.md` change

---

## Success Metrics

After completing this runbook, documentation should show:

- ✅ No canonical doc >2 weeks out of sync with shipped code
- ✅ All stale docs marked with staleness note or scheduled for refresh
- ✅ Study package either frozen or on a refresh schedule
- ✅ No orphaned docs in main `docs/` without clear role
- ✅ Website HTML builds cleanly from `.md` sources
- ✅ Three-layer model enforced (no cross-layer confusion)

---

## Tools & Commands

```bash
# Find recently modified files
git log --oneline -20 -- src/vr/

# List docs by size
du -sh docs/* | sort -rh

# Check doc staleness (grep for old dates)
grep -r "2026-06" docs/

# Find dead links (basic)
grep -r "\]\(" docs/ | grep -v "^#"

# Build HTML from Markdown
npm run docs

# Count files in directory
find docs/ -type f | wc -l

# Find files with specific pattern
find docs/ -name "*.md" -exec grep -l "TODO\|TBD\|FIXME" {} \;
```

---

## When to Escalate

Contact architect or product_manager if you encounter:

- **Roadmap contradiction** — current docs conflict with ROADMAP.md
- **Three-layer boundary** — unclear which layer a doc belongs to
- **Major refactor** — doc requires significant rewrite (>500 words)
- **Study package freeze** — decision needed on placeholders
- **Website build failure** — HTML generation broken

---

## Approval Workflow

For Phase 22.3 → Phase 23 transition:

1. Complete this runbook (audit + refreshes)
2. Create PR with all doc updates
3. Request review from:
   - [ ] architect (architecture + roadmap updates)
   - [ ] product_manager (feature + roadmap alignment)
4. Merge once approved
5. Update `docs/ROADMAP.md` Current Status block to reference audit result
