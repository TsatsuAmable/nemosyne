# Merge Playbook: Manual Runtime Drop into `nemosyne.world/nemosyne`

> **Status:** Ready for manual execution.
> **Date:** 2026-07-28
> **Context:** The analysis suite source has been cleaned (`docs/nemosyne-world/` removed, 675 tests passing). The user will manually copy the analysis-suite project as one folder into `nemosyne.world/nemosyne`. This playbook documents what to do before and after that copy.

---

## 1. Pre-copy checklist (analysis suite)

- [x] Remove `docs/nemosyne-world/` subtree.
- [x] Run tests: `npm test` → 68 files, 675 tests passing.
: Rename package: `package.json` now has `"name": "nemosyne"`, `"version": "1.0.0-alpha.1"`.
- [x] Add a short migration note in `README.md` acknowledging the `nemosyne.world` origin and the Netlify/GitHub Pages split.
- [x] Run tests again after the package rename: `npm test` → 68 files, 675 tests passing.
- [x] Build production bundle: `npm run build` → `dist/` generated successfully (865 kB main JS asset).

**Recommended source folder to copy:** the entire `nemosyne-analysis-suite` directory as a subfolder, e.g. `nemosyne.world/nemosyne/nemosyne-analysis-suite/` or `nemosyne.world/nemosyne/runtime/`. This avoids naming conflicts and lets you move pieces into the root gradually. Alternatively, copy contents directly into the world repo root if you are confident in the overwrite plan.

---

## 2. Copy the runtime into the world repo

### Option A: copy as a subfolder (recommended)

1. In `nemosyne.world/nemosyne`, create a new branch: `git checkout -b merge/analysis-suite`.
2. Copy the cleaned analysis-suite folder into `nemosyne.world/nemosyne/runtime/` (or `packages/runtime/`).
3. Delete the world's `framework/` and duplicate root `package.json` first (see section 3).
4. Later, promote files from `runtime/` to the repo root when ready.

### Option B: copy contents directly into world repo root

1. `git checkout -b merge/analysis-suite`.
2. Delete old A-Frame files listed in section 3.
3. Copy `src/`, `tests/`, `index.html`, `package.json`, `vite.config.js`, `vitest.config.js`, `README.md`, and any other root files from the analysis suite into the world repo root.
4. Resolve any overwrite prompts against the world's own `README.md`, `package.json`, etc.

---

## 3. Delete old A-Frame work from `nemosyne.world/nemosyne`

**Decision:** delete outright; no `legacy/aframe/` archive.

Delete these paths:

- `framework/src/index.js`
- `framework/src/index-v2.js`
- `framework/src/components/nemosyne-artefact-v2.js`
- `framework/src/components/nemosyne-artefact.js`
- `framework/src/components/nemosyne-scene.js`
- `framework/src/components/nemosyne-connector.js`
- `framework/src/components/nemosyne-crystal.js`
- `framework/src/components/tda-components.js`
- `framework/src/components/artefact-builder.js`
- `framework/src/api/`
- `framework/src/layouts/`
- `framework/src/transforms/`
- `framework/src/behaviours/`
- `framework/src/utils/`
- `framework/src/scripts/` (if it exists)
- `framework/tests/`
- `framework/package.json`
- `framework/README.md`
- `framework/BUILD.md`
- `framework/vite.config.js`
- `framework/vitest.config.js`
- `framework/tsconfig.json`
- Root `package.json` (replace with analysis-suite manifest)
- `roadmap/PHASES.md` → move to `docs/archive/PHASES-legacy.md`

If `framework/` becomes empty after deletion, delete the entire `framework/` directory.

---

## 4. Update website (`docs/index.html`) — keep visual shell

**Decision:** preserve the current GitHub Pages appearance. The analysis suite runs on Netlify and is linked/embedded from the world site.

### 4.1 Remove A-Frame references

- Delete any `<script src="...aframe...">` tags.
- Delete any `<script src="...aframe-extras...">` tags.
- Remove inline `<a-scene>`, `<a-entity>`, or `<nemosyne-artefact-v2>` markup.

### 4.2 Replace the embedded demo

Choose one of these:

**Option 1 — iframe embed:**
```html
<section class="demo">
  <iframe
    src="https://nemosyne-analysis-suite.netlify.app/"
    title="Nemosyne VR Analysis Suite"
    width="100%"
    height="600"
    frameborder="0"
    allow="xr-spatial-tracking">
  </iframe>
  <p>
    <a href="https://nemosyne-analysis-suite.netlify.app/" target="_blank" rel="noopener">
      Open Nemosyne in full screen →
    </a>
  </p>
</section>
```

**Option 2 — prominent CTA:**
```html
<section class="demo">
  <a class="button-primary" href="https://nemosyne-analysis-suite.netlify.app/" target="_blank" rel="noopener">
    Launch Nemosyne VR
  </a>
  <p>Requires a WebXR-capable browser such as Meta Quest Browser.</p>
</section>
```

Use the actual Netlify URL once known.

### 4.3 Update copy and code samples

- Replace any `<nemosyne-artefact-v2>` code sample with the JavaScript API:
  ```javascript
  import { World, Dataset, ConstraintEngine } from 'nemosyne';

  const world = new World();
  await world.start();

  const dataset = Dataset.fromJSON({
    columns: [
      { name: 'item', type: 'string' },
      { name: 'value', type: 'number' }
    ],
    rows: [['A', 12], ['B', 34], ['C', 56]]
  });

  world.loadDataset(dataset);
  ```
- Update feature bullets to reference three.js/WebXR, hand tracking, Quest controllers, desktop fallback, session persistence, and networking.
- Add a visible GitHub link to the merged repository.

### 4.4 Verify locally

- Run the world's site locally if it has a local preview (GitHub Pages sites are usually plain static HTML).
- Check that the page still renders with its original CSS and layout.

---

## 5. Update README and wiki

### README.md

Rewrite the world repo's `README.md` to describe the merged project. Suggested structure:

1. Project tagline and one-sentence description.
2. Links:
   - Website: `https://nemosyne.world` (GitHub Pages)
   - Live app: `https://nemosyne-analysis-suite.netlify.app/` (replace with real URL)
   - GitHub repo: `https://github.com/TsatsuAmable/nemosyne`
3. What Nemosyne is (three.js/WebXR spatial data analysis).
4. Current capabilities (hand tracking, controllers, desktop fallback, CSV import, session persistence, export/provenance, networking, telemetry, accessibility, gesture coach).
5. Installation / development:
   ```bash
   git clone https://github.com/TsatsuAmable/nemosyne.git
   cd nemosyne
   npm install
   npm run dev
   npm test
   ```
6. Deployment:
   - GitHub Pages for the static site.
   - Netlify for the live analysis suite.
7. Migration note: A-Frame component framework deprecated in favor of the three.js runtime.

### Wiki (`docs/wiki/`)

- `Home.md`: rewrite with links to the runtime docs, live app, and current roadmap.
- `Getting-Started.md`: replace A-Frame HTML tutorial with:
  - Installing the project.
  - Running `npm run dev`.
  - Loading the first sample dataset in VR.
  - Desktop fallback controls.
- Add new pages as needed:
  - Input modes (hand, controller, desktop).
  - Session persistence and export/provenance.
  - Networking/collaboration status.
  - Design system tokens.

---

## 6. Reconcile concept docs with the runtime

For each document, remove A-Frame-specific examples and align with the three.js implementation.

| File | Action |
|---|---|
| `docs/DESIGN_SYSTEM.md` | Reconcile color tokens with `src/vr/WorldTheme.js`. Consider extracting tokens into `src/vr/theme/designTokens.js`. |
| `docs/TDA_ARTEFACTS.md` | Reference `src/draco/TDAMapper.js`, persistence barcode, Betti curve implementation. |
| `docs/THE_CRYSTAL.md` | Reference `IceVaultNode`, `TechnoCoreNode`, and other suite artefacts. |
| `artefacts/SPECIFICATION.md` | Map its declarative JSON schema to the Draco engine's `{ layout, geometry, behavior, interaction }` output. Consider making `VRTopologyTranslator` ingest this spec. |
| `research/CRYSTAL_ARCHITECTURE.md` | Remove A-Frame code; describe the three.js bridge. |
| `research/DATA_TOPOLOGIES.md` | Cross-check with `src/draco/topologyFacts.js`; keep unique research content. |
| `docs/examples/*.md` | Keep use-case narratives; update any code snippets and links. |

---

## 7. Validate and commit

1. **Install and test in the world repo:**
   ```bash
   npm install
   npm test
   ```
   Expected: 68 test files, 675 tests passing.
2. **Build the app:**
   ```bash
   npm run build
   ```
   Verify `dist/` is created.
3. **Preview the site:**
   - Open `docs/index.html` in a browser.
   - Confirm CSS/layout are intact and the Netlify link/iframe works.
4. **Check for duplicates:**
   - There should be no `nemosyne` package name conflicts.
   - There should be no remaining A-Frame framework code.
   - There should be no `docs/nemosyne-world/` mirror.
5. **Commit:**
   - Add a migration note explaining the A-Frame → three.js transition.
   - Use the `nemosyne.world` git identity.
   - Push to the `merge/analysis-suite` branch and open a PR for review.

---

## 8. Post-merge deployment

1. **Netlify:** connect the merged repo (or continue using the existing analysis-suite repo) to Netlify and ensure the deploy URL is stable.
2. **GitHub Pages:** ensure the world repo's `docs/` folder still publishes to `nemosyne.world`.
3. **DNS/redirects:** if the old A-Frame demo had direct traffic, consider a redirect page or a prominent link to the Netlify app.

---

## 9. Quick-reference file map

| In analysis suite | In merged world repo | Note |
|---|---|---|
| `src/` | root `src/` | Canonical runtime. |
| `tests/` | root `tests/` | Test suite. |
| `index.html` | root `index.html` | App entry; also usable for Netlify. |
| `package.json` | root `package.json` | Rename to `nemosyne@1.0.0-alpha.1`. |
| `README.md` | root `README.md` | Rewrite for merged project. |
| `docs/ROADMAP.md` | root `docs/ROADMAP.md` | Single canonical roadmap. |
| `vite.config.js` | root `vite.config.js` | Build config. |
| `vitest.config.js` | root `vitest.config.js` | Test config. |
| `.github/` | root `.github/` | CI workflows. |

---

## 10. If something breaks

- **Tests fail after copy:** check that `vite.config.js` and `vitest.config.js` paths still match the new root layout.
- **GitHub Pages site looks wrong:** confirm `docs/index.html` still references `docs/css/styles.css` and favicon paths correctly.
- **Netlify build fails:** ensure the build command is `npm run build` and the publish directory is `dist/`.
- **Package-name collision:** search for `"name": "nemosyne"` in both repos; there should be only one root manifest.
