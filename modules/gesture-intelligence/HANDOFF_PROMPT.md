# HANDOFF PROMPT — @nemosyne/gesture-intelligence standalone module

Copy this file plus the entire `modules/gesture-intelligence/` folder (or the whole repo) to the target machine, then hand this prompt to your coding agent. Everything below is self-contained; SPRINT.md and src/contracts.ts (which travel inside the module) are the frozen specs.

---

## PROMPT START

You are resuming an out-of-roadmap sprint inside the repo `nemosyne.world`: building a **standalone, pluggable gesture-intelligence module** at `modules/gesture-intelligence/`. It is architecturally separate from the host project — never imported by `src/`, never run through the root test suite. Your job: finish the remaining work items at the end of this prompt.

### 0. Read first (in order)

1. `modules/gesture-intelligence/SPRINT.md` — design rules + frozen feature-vector spec + ONNX contract + quality bar + module gates.
2. `modules/gesture-intelligence/src/contracts.ts` — frozen interfaces. Do not edit either file without explicit sign-off.
3. `modules/gesture-intelligence/src/features.ts` — the shared 56-dim extraction all paths consume.

Hard rules (from SPRINT.md): no host dependencies (no three.js; plain `Vec3`), honest provenance (`source` = path that actually produced numbers; skipped neural path → explicit `degradedReason`), no fabricated confidence constants, ONNX optional and injected, no code comments (JSDoc file headers only), TS strict with `no-explicit-any` error, single quotes / trailing comma es5 / printWidth 100 / 2-space / LF, no focused tests.

### 1. Environment setup (target machine)

- Node ≥ 20 (developed on 24), Python ≥ 3.10 (developed on 3.13). Need ~3 GB free disk.
- Module deps: `cd modules/gesture-intelligence && npm install` (onnxruntime-web is a devDep; optional peerDep at runtime).
- Python venv (recreate; gitignored): `python -m venv training/.venv` then
  - Windows: `training/.venv/Scripts/python -m pip install numpy onnx`
  - macOS/Linux: `training/.venv/bin/python -m pip install numpy onnx`
- Module gates (run inside `modules/gesture-intelligence/`): `npm run typecheck` (tsc), `npm run lint`, `npm test` (vitest, node env). Root repo gates must stay green too: root `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`. Root `vitest.config.js` already excludes `modules` — verify, never remove.

### 2. Verified state at handoff (all green unless noted)

- **Scaffold**: package.json / tsconfig.json / vitest.config.ts / eslint.config.js / .gitignore. `npm install` done.
- **src/contracts.ts**: full contract surface (GestureEngine, NeuralClassifierPort, OrtFactoryLike, ModelCard, GesturePersistence, PersonalizerPort, 6 gesture classes, FEATURE_DIM=56).
- **src/store.ts + tests/store.test.ts**: IndexedDB persistence v2 — shared lazy connection, ops resolve on tx completion, schema versioning, visible memory fallback (`backend: 'memory'`), idempotent close. 15/15.
- **Core**: src/trajectory.ts (per-hand ring buffer, capacity 60, per-frame velocity), src/features.ts (56-dim extraction + `decimate`), src/heuristic.ts (`classifyHeuristic` consumes only the 56-dim vector; margin-derived confidences; pinch-pair precedence), src/calibration.ts (speed EMA + **sticky-band hysteresis** multiplier: band stickiness derived from current threshold/base ratio; `updateCalibration` is pure), src/engine.ts (`createGestureEngine`: sync heuristic classify, async `classifyWithNeural` with session-error fallback, feedback every 8 ingests → optimize → adopt only if replay F1 improves → persist profile), src/index.ts barrel.
- **Tests**: 53/53 green; module tsc + eslint clean.
- **Training pipeline** (authored, one known bug — see §3): training/generate_dataset.ts (seeded mulberry32 RNG, 2520 train / 540 test instances, 6 classes, randomized scale/jitter/pose/duration/ease), training/extract_features.ts (reuses src/features.ts verbatim), training/train.py (numpy MLP 56→32 ReLU→16 ReLU→6 softmax, Adam, early stop on held-out macro-F1, exit code 2 below quality bar, writes training/_output/weights.npz + metrics.json), training/export_onnx.py (builds ONNX via `onnx` package — Gemm/Relu/Softmax, opset 17, ir_version 8, onnx.checker full validation; writes assets/gesture_classifier.onnx + assets/model_card.json with sha256 + assets/training_report.json).
- **Uncommitted**: all work is in the working tree, nothing committed. Transfer = copy folder or commit+push first.

### 3. KNOWN BUG — fix first

`training/generate_dataset.ts`: `buildInstance()` hardcodes `label: 'idle'` in its return object and `makeGesture`'s gesture cases never override it → every generated row is labeled idle. Verified symptom: first training run collapsed to all-idle predictions (macro-F1 0.167). Fix: thread the label through `buildInstance(rng, frames, leftStart, rightStart, move, label)` (or stamp `label` on the result in `makeGesture` before each return — note the idle-variant slicing code already sets `label: 'idle'` explicitly and is correct). Then rerun the full pipeline (§4 step 1).

### 4. Remaining work, in order

1. **Fix the label bug, run the pipeline end-to-end**:
   - `npx tsx training/generate_dataset.ts` → `npx tsx training/extract_features.ts`
   - venv python `training/train.py` (bar: held-out accuracy ≥ 0.90 AND macro-F1 ≥ 0.85; confusion must show all 6 classes predicted) → venv python `training/export_onnx.py`.
   - Verify assets/gesture_classifier.onnx + model_card.json exist, card sha256 matches file, metrics meet bar.
2. **ONNX bridge** — `src/onnx.ts`: implement `NeuralClassifierPort` (contracts.ts) over `OrtFactoryLike`. Provide `createOrtFactory(ortNamespace): OrtFactoryLike` wrapping `ort.InferenceSession.create` (executionProviders `['wasm']` only — `webgl` EP is deprecated; fetch model bytes as Uint8Array so sha256 can be verified against ModelCard before session creation). `init()` loads model + card (fetch JSON), verifies hash + inputName/outputName/featureDim, creates session; `score(features)` builds float32 [1,56] tensor under card.inputName, reads card.outputName, maps the 6 probs onto GESTURE_CLASSES, measures real latencyMs; `dispose()` releases. `createNeuralClassifier(options)` wires it all. Tests: fake `OrtFactoryLike` covering happy path / hash mismatch / wrong dims / run-rejection; plus one integration test running the REAL exported .onnx through onnxruntime-web in node if it works headlessly (if not, mark it skipped-with-reason and note in report).
3. **Personalizer** — `src/personalizer.ts`: implement `PersonalizerPort`. Ring buffer of `FeedbackSample` (cap 200). `optimize()`: coordinate search over (moveThreshold, pinchThreshold) grid — each ±40% of current calibration in 10% steps — replaying the stored corpus through `classifyHeuristic` and maximizing replayed macro-F1; return `PersonalizationResult` with replayF1Before/After (engine already gates adoption on improvement). Also `exportCorpus(): string` (JSONL, one line per sample: features array + label + confirmed) writing the exact schema needed for future real retraining — this is the "collect" half of the loop. Tests: optimizer improves a miscalibrated fixture; no-improvement case returns result with after ≤ before; corpus export round-trips.
4. **Capture → train → deploy loop** (the sprint's headline feature):
   - `src/capture.ts`: `CaptureRecorder` — attach to engine input stream; when armed with a label, mirror every `HandSample` pair (left/right) into a raw instance `{left:[{x,y,z,pinched,t}],right:[...],label}` and finalize on stop; write JSONL identical to `training/_output/raw_*.jsonl` schema.
   - `training/merge_corpus.ts` (tsx): merge captured JSONL files with synthetic raw_train/raw_test (flag-controlled ratio), emit combined raw_*.jsonl.
   - `training/retrain.ts` (tsx): one-shot orchestrator — optional synthetic generation, merge captured corpora, extract features, spawn venv python train.py + export_onnx.py (use node:child_process; resolve venv python per-OS: `training/.venv/Scripts/python.exe` vs `training/.venv/bin/python`), verify bar + card, copy into assets/. Deploy = replacing `assets/gesture_classifier.onnx` + `model_card.json`; the engine/bridge verify sha256 + modelVersion on next init — no code changes.
   - Tests for capture + merge (deterministic fixtures); retrain.ts verified by running it once end-to-end.
5. **Demo app** — `demo/`: `vite.config.ts` (plain vite, `root: 'demo'` or relative), `index.html`, `demo/main.ts`: canvas dual-hand simulator (drag two hand markers with mouse/touch; pinch toggle buttons or hold-to-pinch), live engine wiring (recordSample on tick, classify each frame, classifyWithNeural debounced), HUD showing gesture + confidence + provenance (source, modelVersion, latencyMs, degradedReason), calibration panel (live thresholds, personalizer stats), feedback buttons (confirm ✓ / correct ✗ per detected gesture), capture-mode UI (arm label → record → save JSONL download + "send to training/_output/captured_*.jsonl" via file input for loop). Bundle onnxruntime-web from node_modules in the demo build (no CDN — avoids CORP/COEP issues). `npm run build` must produce `demo/dist`. Keep demo TS lint-clean.
6. **README.md** (module root): architecture diagram (ascii), quickstart, gates, the capture→train→deploy loop walkthrough, integration contract summary for future host wiring, model card explanation. Also add `capture`, `merge-corpus`, `retrain` npm scripts.
7. **Final gates**: module typecheck/lint/test/build all green; then ROOT repo gates green (`npm run typecheck`, `npm run lint`, `npm test`, `npm run build` from repo root — confirms isolation). Report in structured form: exact gate results, file-by-file summary, honest deviations.

### 5. Gotchas from the source machine

- Windows shell was used; scripts are cross-platform but venv python path differs per OS (see §4 item 4).
- Hit ENOSPC once — npm cache was cleaned; keep ≥3 GB free.
- onnxruntime-web in node: if wasm backend complains headless, prefer the fake-factory tests + real-model integration only in the browser demo; do not silently skip hash verification.
- `training/_output/` and `assets/` — `_output` is gitignored; `assets/` (model + card) SHOULD be committed once produced.
- Repo root AGENTS.md conventions still apply where not overridden here (notably: no comments, gate order, structured reports).

## PROMPT END
