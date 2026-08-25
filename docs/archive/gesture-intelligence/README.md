# @nemosyne/gesture-intelligence

Standalone, pluggable gesture intelligence: a frozen 56-dim feature vector, a
heuristic + optional ONNX neural classifier with **honest provenance**,
biomechanical calibration, and an on-device personalization loop. Zero host
dependencies (no three.js, no imports outside this module).

## Architecture

```
                 HandSample stream (left/right, Vec3 + pinched + t)
                                  │
                                  ▼
   ┌─────────────────────────────────────────────────────────────┐
   │ TrajectoryBuffer (per-hand ring, cap 60, derives per-frame v)│
   └─────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
   ┌─────────────────────────────────────────────────────────────┐
   │ extractFeatures -> Float32Array(56)   FROZEN spec (SPRINT.md)│
   │  [0..15] L speed mag · [16..18] L disp · [19] L pinch frac   │
   │  [20..35] R speed · [36..38] R disp · [39] R pinch          │
   │  [40..55] inter-hand distance series (window decimated to 16)│
   └─────────────────────────────────────────────────────────────┘
              │                   │                    │
              ▼                   ▼                    ▼
   ┌──────────────────┐ ┌──────────────────┐ ┌────────────────────┐
   │ classifyHeuristic│ │ NeuralClassifier │ │ Personalizer       │
   │  (margin-derived │ │  Port (ONNX,      │ │  (threshold coord- │
   │   confidences)   │ │  injected via    │ │  search over replay│
   │                  │ │  OrtFactoryLike)  │ │  F1 on confirmed) │
   └──────────────────┘ └──────────────────┘ └────────────────────┘
              │                   │                    │
              └─────────┬─────────┘                    │
                        ▼                              │
              ┌──────────────────┐                    │
              │   GestureEngine  │──── reportFeedback ─┘
              │  (honest source: │         (every 8 → optimize →
              │   onnx|heuristic)│          adopt only if F1 improves)
              └──────────────────┘
                        │
                        ▼
              ┌──────────────────┐
              │  persistence     │  IndexedDB (v2) with visible memory fallback
              │  (StoredProfile) │
              └──────────────────┘
```

Capture→train→deploy loop (the sprint's headline feature):

```
   demo capture  ──▶ captured_N.jsonl ──▶ training/_output/captured/
                                                    │
   synthetic generate ──▶ raw_train/raw_test ───────┤
                                                    ▼
                                          merge_corpus.ts
                                                    │
                                        raw_train + raw_test
                                                    │
                                              extract_features.ts
                                                    │
                                          feat_train + feat_test
                                                    │
                                    venv python train.py (bar: acc≥0.90, F1≥0.85)
                                                    │
                                    venv python export_onnx.py
                                                    │
                          assets/gesture_classifier.onnx + model_card.json
                                                    │
                          engine/onnx verify sha256 + version on next init
                          (deploy = replacing the two asset files; no code changes)
```

## Quickstart

```bash
cd modules/gesture-intelligence
npm install

# Python venv for training (numpy + onnx)
python3 -m venv training/.venv
training/.venv/bin/python -m pip install numpy onnx      # macOS/Linux
# training/.venv/Scripts/python.exe -m pip install numpy onnx   # Windows

# Regenerate assets from scratch (synthetic only)
npm run retrain

# Demo (canvas dual-hand simulator + live engine + capture UI)
npm run demo          # https://localhost:5173
npm run build         # -> demo/dist
```

## Module gates (run inside `modules/gesture-intelligence/`)

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # eslint src tests demo training --ext .ts
npm test              # vitest run (node env, 78 tests)
npm run build         # vite build -> demo/dist
```

The root Nemosyne repo gates must also stay green (`vitest.config.js` already
excludes `modules`). This module is never imported by `src/`.

## Feasibility note: why a small MLP, not a CNN/LSTM

The frozen feature spec already collapses the temporal window into 56 numbers
(speed series, net displacement, pinch fraction, inter-hand distance — all
decimated to 16 frames). Feeding raw time-series into a CNN/LSTM would require
**changing the frozen contract** (the ONNX graph is locked to `[1,56] → [1,6]`)
and would demand more data + a heavier runtime (torch/tf) for a 6-class problem
that the MLP solves at 91% accuracy / 0.91 macro-F1 in ~24 KB of ONNX. The MLP
runs in <1 ms via onnxruntime-web `wasm`, has no runtime deps beyond the
optional `onnxruntime-web` peer, and is small enough to sha256-verify on every
load. A CNN/LSTM remains a future option only if the feature spec is re-opened
by orchestrator sign-off — never silently.

## Capture → train → deploy walkthrough

1. **Capture.** In the demo (`npm run demo`), pick a label, click *Arm*,
   perform the gesture with the two hand markers, click *Stop & Save*. Click
   *Download captured_N.jsonl*. Repeat for each gesture you want to reinforce.
2. **Place.** Move the downloaded files into
   `training/_output/captured/` (create the directory). Optionally inspect:
   `npm run capture` (lists files + per-label counts + schema check).
3. **Retrain.** `npm run retrain` regenerates synthetic data, merges the
   captured corpora (80/20 train/test split, seeded), extracts features, runs
   `train.py` (exits non-zero if accuracy < 0.90 or macro-F1 < 0.85), exports
   ONNX, and writes `assets/gesture_classifier.onnx` + `assets/model_card.json`.
4. **Deploy.** The new assets are loaded on the next engine init — the ONNX
   bridge verifies the card's `sha256` against the fetched model bytes **before**
   creating the inference session, and surfaces `modelVersion` in provenance.
   No code changes; a hash mismatch fails init with an explicit reason and the
   engine degrades to the heuristic.

## Integration contract (for future host wiring)

```ts
import {
  createGestureEngine,
  createNeuralClassifier,
  createOrtFactory,
  createPersonalizer,
  createPersistence,
} from '@nemosyne/gesture-intelligence';

const engine = createGestureEngine({
  neural: createNeuralClassifier({
    modelUrl,                       // URL of assets/gesture_classifier.onnx
    modelCard,                      // parsed assets/model_card.json
    ortFactory: createOrtFactory(ort),  // import * as ort from 'onnxruntime-web'
  }),
  personalizer: createPersonalizer(),
  persistence: createPersistence(),
});

await engine.init();
engine.recordSample({ hand: 'left',  position: {x,y,z}, pinched, timestamp });
engine.recordSample({ hand: 'right', position: {x,y,z}, pinched, timestamp });

const sync = engine.classify();              // heuristic, honest source
const neural = await engine.classifyWithNeural(); // onnx when ready, else heuristic
// neural.provenance.source === 'onnx' | 'heuristic'
// neural.provenance.degradedReason === null | 'no-model' | 'init-failed' | ...

engine.reportFeedback(neural.gesture, true);   // confirm
engine.dispose();
```

Guarantees the host can rely on:

- **No host-framework types.** `Vec3` is `{x,y,z}`; nothing from three.js leaks.
- **Honest provenance.** `source` reports the path that *produced the numbers*.
  A heuristic result is never labeled `onnx`; a skipped neural path carries an
  explicit `degradedReason` (`no-runtime`, `no-model`, `init-failed`,
  `session-error`, `insufficient-data`, `stale-neural`).
- **No fabricated confidence.** Every confidence is derived from measured
  margins (heuristic) or softmax probabilities (neural) — no hardcoded 0.92.
- **ONNX is optional and injected.** Absent the factory/model, the engine runs
  heuristic-only with `runtime: 'heuristic'` in `status()`.
- **Personalization is closed-loop and measurable.** `PersonalizationResult`
  reports `replayF1Before`/`After`; the engine adopts a new calibration **only**
  when `After > Before`. Neural weight fine-tuning is out of scope —
  `exportCorpus()` emits the JSONL a future retraining step needs; this module
  never claims `weightsApplied`.

## Model card (`assets/model_card.json`)

The card is the contract between training and inference. `init()` validates:

- `featureDim === 56` (frozen contract),
- `classes` matches `GESTURE_CLASSES` in identity **and order** (the ONNX output
  index maps onto this exact order),
- `inputName` / `outputName` match the graph's tensor names,
- `sha256` of the fetched `.onnx` bytes — verified **before** session creation,
  so a tampered or stale model never reaches the runtime.

The card also carries `metrics` (`heldOutAccuracy`, `macroF1`, `samples`,
`confusion`) for display and `featureSpec` (the human-readable layout). The
current shipped model: accuracy **0.9111**, macro-F1 **0.9087**, 5100 samples,
all 6 classes predicted (see `assets/training_report.json` for the full
confusion matrix).

## Files

```
src/
  contracts.ts      frozen interfaces (do not edit without sign-off)
  trajectory.ts     per-hand ring buffer + velocity derivation
  features.ts       FROZEN 56-dim extraction (shared by all paths)
  heuristic.ts      margin-derived heuristic classifier
  calibration.ts    speed-EMA + sticky-band hysteresis (pure update)
  engine.ts         GestureEngine facade (honest provenance, feedback→adopt)
  onnx.ts           NeuralClassifierPort over injected OrtFactoryLike
  personalizer.ts   threshold coord-search over replayed F1 + corpus export
  capture.ts        CaptureRecorder (raw JSONL, schema-identical to synthetic)
  store.ts          IndexedDB v2 persistence + visible memory fallback
  index.ts          public barrel
training/
  generate_dataset.ts   seeded synthetic dual-hand trajectories
  extract_features.ts   raw → 56-dim (reuses src/features.ts)
  train.py              numpy MLP (56→64→32→6), Adam + cosine LR + L2
  export_onnx.py        onnx graph builder + model card writer
  merge_corpus.ts       pure mergeCorpus() + CLI (captured + synthetic)
  retrain.ts            one-shot orchestrator (gen→merge→extract→train→export→verify)
  inspect_captures.ts   captured-corpus validator/listing (`npm run capture`)
demo/
  vite.config.ts        copies onnxruntime-web wasm into demo/public/ort-wasm
  index.html · main.ts  canvas simulator + HUD + calibration + feedback + capture
assets/
  gesture_classifier.onnx   shipped model (committed)
  model_card.json           shipped card (committed)
  training_report.json      confusion + metrics (committed)
tests/                  78 vitest tests (node env), incl. real-ORT integration
```