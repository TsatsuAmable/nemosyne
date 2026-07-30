# Merge Evaluation: `nemosyne-analysis-suite` → `nemosyne.world/nemosyne`

> **Status:** Evaluation only. No files have been moved, deleted, or modified.
> **Date:** 2026-07-28
> **Scope:** Determine what in `C:\Users\stromae\Documents\Code\nemosyne.world\nemosyne` should be kept, updated, or deleted when the three.js/WebXR analysis suite becomes the canonical runtime of the merged project.

---

## 1. Executive Summary

`nemosyne-analysis-suite` and `nemosyne.world/nemosyne` are two generations of the same product idea:

| Project | Runtime | Maturity | Test evidence |
|---|---|---|---|
| `nemosyne.world/nemosyne` | A-Frame + D3 | v0.2.0, early framework | Minimal / none visible |
| `nemosyne-analysis-suite` | three.js + WebXR | v0.1.0, 675 passing tests | Extensive (Vitest) |

**Recommendation:** Make the analysis suite the canonical runtime and treat the world project as the **parent shell / website / archive**. Reuse concepts, specs, and design docs from `nemosyne.world`; delete or archive the A-Frame framework source, the duplicate package manifest, and the stale roadmap. Update the website and wiki to describe the new three.js/WebXR engine, not the A-Frame component API.

The merge must also remove the mirrored `docs/nemosyne-world/` subtree inside the analysis suite to prevent duplication.

---

## 2. Guiding Principles

1. **One runtime only.** The three.js/WebXR engine is tested, feature-complete, and actively developed. The A-Frame component framework cannot coexist as a peer renderer without massive duplication.
2. **Harvest concepts, not code.** Keep declarative spec ideas, design tokens, and metaphor documents; drop the A-Frame component implementations.
3. **The world repo owns the public face.** Its `docs/index.html`, wiki, and README become the marketing home, but their A-Frame demo and API docs must be rewritten for the new engine.
4. **No duplicate `nemosyne` copies.** The mirrored `docs/nemosyne-world/` directory inside the analysis suite is removed; any unique content is rescued first.
5. **Use the world repo's git identity.** Commits, branches, and CI in the merged repo use the `nemosyne.world` account and permissions.

---

## 3. `nemosyne.world/nemosyne` — Keep / Update / Delete

### 3.1 Delete (no legacy archive)

**User decision: delete all old A-Frame work; do not keep a `legacy/aframe/` archive.**

| Path | Reason |
|---|---|
| `framework/src/index.js` | Legacy v0.1 A-Frame entry. Superseded by analysis-suite runtime. |
| `framework/src/index-v2.js` | v0.2 A-Frame entry. Vocabulary is useful, but A-Frame registration is not reusable. |
| `framework/src/components/nemosyne-artefact-v2.js` and other components | Tightly bound to A-Frame entity/component lifecycle. |
| `framework/package.json` | Duplicates root manifest and the framework it describes is being retired. |
| `framework/src/api/`, `layouts/`, `transforms/`, `behaviours/`, `utils/`, `scripts/` | A-Frame-specific helpers that have three.js equivalents in the suite. |
| `framework/tests/` | Tests for the A-Frame framework. Rely on the suite's 675+ tests instead. |
| `roadmap/PHASES.md` | Phase 0 roadmap; analysis suite is already at Phase 10. Move to `docs/archive/PHASES-legacy.md` for historical context only. |

### 3.2 Keep and Update

| Path | Current Value | Update Required |
|---|---|---|
| `docs/index.html` | Marketing landing page, branding, examples gallery. | **Decision: preserve current GitHub Pages appearance.** Remove A-Frame scripts/CDN. Replace embedded A-Frame scene with an iframe or prominent link to the Netlify-hosted analysis suite. Update feature copy and code samples to reference the new JavaScript API. |
| `docs/DESIGN_SYSTEM.md` | Color tokens, typography, themes, accessibility guidelines. | Reconcile tokens with `WorldTheme.js`; ensure colorblind/high-contrast tokens are adopted. |
| `docs/CONTRIBUTING.md` | Contribution guide. | Point to the analysis-suite source layout and test commands. |
| `docs/TDA_ARTEFACTS.md` | Topological data analysis artefacts concept. | Align with the suite's `TDAMapper`, persistence barcode, and Betti curve implementation. |
| `docs/THE_CRYSTAL.md` | Crystal metaphor for VR data artefacts. | Update to reference `IceVaultNode`, `TechnoCoreNode`, and other suite artefacts instead of A-Frame components. |
| `docs/wiki/Home.md` | Wiki landing page. | Rewrite for the new runtime and roadmap. |
| `docs/wiki/tutorials/Getting-Started.md` | Tutorial content. | Replace A-Frame markup tutorial with suite loading/API tutorial. |
| `docs/examples/*.md` | Use-case write-ups (IoT, finance, medical, etc.). | Keep narrative; update any code snippets and links to point at the suite. |
| `artefacts/SPECIFICATION.md` | Declarative artefact JSON schema. | Harmonize with the Draco engine's `{ layout, geometry, behavior, interaction }` output and make `VRTopologyTranslator` able to ingest it. |
| `research/CRYSTAL_ARCHITECTURE.md` | Crystal/D3/A-Frame bridge manifest. | Remove A-Frame code examples; describe the three.js bridge instead. |
| `research/DATA_TOPOLOGIES.md` | Topology research notes. | Cross-check with `src/draco/topologyFacts.js`; keep unique research content. |
| `README.md` | Framework README. | Rewrite as the parent-project README describing the three.js runtime, installation, and links. |
| Favicon/manifest assets | Brand identity. | Keep; ensure paths still resolve after reorganisation. |

### 3.3 Root `package.json`

- **Decision:** The merged project keeps the `nemosyne` package name. The analysis-suite `package.json` becomes the root manifest, renamed from `nemosyne-analysis-suite` to `nemosyne` with an appropriate version bump (recommended `1.0.0-alpha.1`). The world's duplicate `package.json` is deleted.

---

## 4. `nemosyne-analysis-suite` — Bring / Remove / Reconcile

### 4.1 Bring as canonical

| Asset | Role in merged project |
|---|---|
| `package.json` (rename `nemosyne-analysis-suite` → `nemosyne`, version `1.0.0-alpha.1`) | Root manifest. Vite 8 + Vitest 4 toolchain. |
| `src/` entire tree | Canonical runtime: engine, world, VR UI, Draco, data, network, telemetry, utils. |
| `tests/` | Test suite becomes the merged project's test suite. |
| `index.html` + `dist/` | Runnable demo and production bundle. |
| `docs/ROADMAP.md`, `docs/ARCHITECTURE_BRIDGE.md`, `docs/GETTING_STARTED.md`, etc. | Project-specific docs. |
| `vite.config.js`, `vitest.config.js`, `.github/` | Build/CI configuration. |

### 4.2 Remove (duplicate of world project)

| Asset | Reason |
|---|---|
| `docs/nemosyne-world/` entire subtree | Mirror of the upstream A-Frame framework and site. Creates a second `nemosyne` package and competing docs. |
| `docs/nemosyne-world/framework/` | Duplicates A-Frame framework source. |
| `docs/nemosyne-world/docs/index.html` | Duplicates the world site's landing page. |
| `docs/nemosyne-world/docs/api/v0.2.md` | API docs for the A-Frame framework. |

Before deleting `docs/nemosyne-world/`, rescue any unique content that the world repo lacks:
- `artefacts/TDA_ARTEFACTS.json`
- any example text not present in the world repo

### 4.3 Reconcile

- **README.md:** The analysis-suite README should become the merged README, but it must acknowledge the `nemosyne.world` origin and link to the updated website/wiki.

---

## 5. Website & Wiki Update Plan

### 5.1 Landing page (`docs/index.html`)

**Decision: keep the current `nemosyne.world` GitHub Pages appearance and structure.** The analysis suite itself is hosted on Netlify and linked/embedded from the world site.

- Keep: hero, navigation, feature list, use cases, footer, brand styling, CSS, and page layout.
- Replace: embedded A-Frame scene with an `<iframe>` to the Netlify deployment of the analysis suite, or with a prominent "Launch Nemosyne" call-to-action that opens the Netlify URL.
- Remove: `aframe` and `aframe-extras` CDN scripts and any inline A-Frame markup.
- Update: code sample and feature copy from `<nemosyne-artefact-v2>` A-Frame markup to the JavaScript API (`world.loadDataset(...)`, `ConstraintEngine.solve(...)`, `Dataset.fromJSON(...)`).
- Add: a clearly visible link/section pointing to the live Netlify app and a "GitHub" link to the merged repository.

### 5.2 Wiki

- `Home.md`: rewrite to introduce the three.js/WebXR runtime, current phase, and quick links.
- `Getting-Started.md`: replace A-Frame HTML tutorial with suite installation and first dataset loading.
- Add new pages for:
  - Supported input modes (hand tracking, Quest controllers, desktop fallback)
  - Session persistence and export/provenance
  - Networking / collaboration (current capabilities)
  - Design system tokens (linked to `WorldTheme.js`)

### 5.3 Design system

- Merge `docs/DESIGN_SYSTEM.md` tokens into a shared `src/vr/theme/designTokens.js` or directly into `WorldTheme.js`.
- Ensure colorblind palettes and high-contrast mode match the documented tokens.

---

## 6. Git & Repository Identity

- **Target repository:** `C:\Users\stromae\Documents\Code\nemosyne.world\nemosyne` becomes the merged repo.
- **Git account:** Use the `nemosyne.world` repo credentials and permissions.
- **Branches:** Create a long-running `threejs-runtime` or `merge/analysis-suite` branch; do not force-push to `main` until the plan is approved.
- **History:** The analysis-suite has an independent git history. Options:
  1. Subtree merge to preserve both histories.
  2. Copy files into a fresh branch and add a migration note.
  Recommendation: **subtree merge** if preserving authorship/history matters; otherwise a clean migration note is acceptable.

---

## 7. Suggested Implementation Sequence (when approved)

1. **Prepare the analysis suite in its own repo:**
   - Delete `docs/nemosyne-world/`.
   - Rescue unique docs to `docs/world-import/` temporarily.
   - Run tests; ensure 675 still pass.
2. **Prepare the world repo:**
   - Create merge branch.
   - Delete the A-Frame framework code outright (no `legacy/aframe/` archive per user decision).
   - Archive `roadmap/PHASES.md` to `docs/archive/`.
3. **Move canonical runtime into world repo:**
   - Copy `src/`, `tests/`, root configs, and `package.json`.
   - Resolve package name and version.
4. **Rebuild website/wiki:**
   - Rewrite `README.md`, `docs/wiki/Home.md`.
   - Keep `docs/index.html` visual shell; replace A-Frame scene with Netlify iframe/link and update copy/API samples.
   - Port example use-case narratives.
5. **Reconcile docs/specs:**
   - Merge `artefacts/SPECIFICATION.md` with Draco spec.
   - Merge `DESIGN_SYSTEM.md` tokens into code.
   - Update `research/CRYSTAL_ARCHITECTURE.md` for three.js.
6. **Validate:**
   - Run full test suite.
   - Build and preview site.
   - Verify no duplicated `nemosyne` copies remain.
7. **Commit and open review:**
   - Large single merge commit with co-authored attribution from both repos.
   - Publish migration note explaining the A-Frame → three.js transition.

---

## 8. Risks & Open Questions

| Risk | Mitigation |
|---|---|
| A-Frame demo/traffic loss | Keep the marketing page shell and replace only the embedded scene; maintain URLs. |
| Package-name collision | Use `nemosyne` from the analysis-suite manifest; delete the world's duplicate. |
| Vite 8 vs Vite 5 / dependency conflicts | Use the suite's Vite 8 config as canonical; audit world dev deps. |
| Two parallel layout/artefact systems | Keep only Draco/VRTopologyTranslator; explicitly deprecate world layout engine. |
| Loss of unique research docs | Rescue list from `docs/nemosyne-world/` before deletion. |
| Wiki/tutorial rewrite effort | Tackle in a dedicated docs sprint after code merge. |
| Netlify deployment drift vs GitHub Pages | Maintain the world site as the static GitHub Pages home; treat Netlify as the live-app host. Document the split clearly in README and wiki. |

**User decisions applied:**
1. ✅ Final npm package name: `nemosyne`.
2. ✅ Delete all old A-Frame work; no `legacy/aframe/` archive.
3. ✅ Keep the current `nemosyne.world` GitHub Pages website appearance. The analysis suite is hosted via Netlify and linked/embedded from the world site.

---

## 9. Bottom Line

**Delete:** A-Frame framework source, duplicate `framework/package.json`, stale `roadmap/PHASES.md`, and the mirrored `docs/nemosyne-world/` subtree in the analysis suite.

**Update:** `README.md`, website landing page (preserve visual shell, replace A-Frame scene with Netlify iframe/link), wiki, `DESIGN_SYSTEM.md`, `CRYSTAL_ARCHITECTURE.md`, and API/tutorial docs to describe the three.js/WebXR runtime.

**Keep:** Marketing site shell, design tokens, use-case examples, artefact specification concepts, and research notes — after updating them to align with the analysis-suite implementation.

**Canonical runtime:** `nemosyne-analysis-suite/src/` and its test suite become the merged project's core. Root package becomes `nemosyne@1.0.0-alpha.1`.
