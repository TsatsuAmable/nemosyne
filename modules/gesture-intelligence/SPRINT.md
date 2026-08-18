# Sprint: Standalone Gesture Intelligence Module

Out-of-roadmap sprint. Goal: a **working, pluggable, architecturally separate** gesture
intelligence module under `modules/gesture-intelligence/`. Never imported by `src/`,
never run through the root test suite. Root gates must stay green (root
`vitest.config.js` already excludes `modules`).

## Non-negotiable design rules

1. **No host dependencies.** No three.js, no imports outside this module. Geometry is
   plain `Vec3` from `src/contracts.ts`.
2. **Honest provenance.** `ClassificationResult.provenance.source` reports the path that
   *actually produced the numbers*. A heuristic result is never labeled `onnx`. If a
   neural path exists but was not used, `degradedReason` says why.
3. **No fabricated confidence.** Every confidence value is derived from measured
   quantities (margins, magnitudes, probabilities). No hardcoded 0.92/0.95 constants.
4. **ONNX is optional and injected.** Resolved via `OrtFactoryLike` /
   `NeuralClassifierPort`. Absent runtime/model degrades to heuristic — explicitly.
5. **Shared feature extraction.** Heuristic, ONNX, and personalizer replay all consume
   the same `Float32Array` (FEATURE_DIM=56) from `src/features.ts`.
6. **No code comments** (repo convention). JSDoc file headers on public modules are fine.
7. TypeScript strict, `no-explicit-any` is an error, single quotes, trailing comma es5,
   printWidth 100, LF, 2-space.

## Feature vector spec (FROZEN — do not change without orchestrator sign-off)

Computed by `extractFeatures(left: HandFrame[], right: HandFrame[]): Float32Array | null`
in `src/features.ts`. `null` if either hand array is empty.

- Window: last `min(len, TRAJECTORY_CAPACITY=60)` frames per hand.
- Decimation: pick exactly `FEATURE_WINDOW_FRAMES=16` evenly-strided indices over the
  window (works for any n>=1).
- `HandFrame.speed` is derived on the raw stream before decimation:
  `(pos[i] - pos[i-1]) / dt`, dt in seconds; if dt <= 1ms speed is (0,0,0).

Layout (float32, FEATURE_DIM=56):

| Indices     | Content                                | Normalization                  |
|-------------|----------------------------------------|--------------------------------|
| 0..15       | left speed magnitude series (16)       | `min(|v|/2, 1)`                |
| 16..18      | left net displacement dx,dy,dz         | `clamp(d/0.5, -1, 1)` per axis |
| 19          | left pinch fraction over window        | `[0,1]`                        |
| 20..35      | right speed magnitude series (16)      | `min(|v|/2, 1)`                |
| 36..38      | right net displacement dx,dy,dz        | `clamp(d/0.5, -1, 1)` per axis |
| 39          | right pinch fraction over window       | `[0,1]`                        |
| 40..55      | inter-hand distance series (16)        | `min(dist/1.0, 1)`             |

Class order (ONNX output index): `['idle','pinchTogether','pinchApart','scoopUp','pushForward','bothPinched']`
(= `GESTURE_CLASSES` in contracts.ts).

## ONNX model contract

- File: `assets/gesture_classifier.onnx`. Card: `assets/model_card.json` (`ModelCard`).
- Graph: input `<inputName>` float32 `[1,56]` → MLP → Softmax → output `<outputName>`
  float32 `[1,6]` (probabilities, sum to 1).
- Names in the card must match the graph exactly; `sha256` is of the `.onnx` bytes.
- Quality bar: held-out accuracy >= 0.90, macro-F1 >= 0.85, confusion matrix recorded.

## Personalization contract

Closed, measurable loop only: feedback samples -> threshold optimizer (coordinate search
over move/pinch thresholds + speed multipliers) maximizing replayed F1 over the stored
corpus vs the heuristic classifier. `PersonalizationResult` must report F1 before/after;
if no improvement, calibration is NOT changed. Neural weight fine-tuning is explicitly
out of scope (corpus export only) — never claim `weightsApplied`.

## Module gates (run inside `modules/gesture-intelligence/`)

```
npm run typecheck
npm run lint
npm test
```

Root-repo gates are run by the orchestrator only. Subagents do NOT touch anything
outside `modules/gesture-intelligence/` (the one exception already made:
root `vitest.config.js` exclude list).

## Subagent report format (required)

- GATE RESULTS: exact commands + pass/fail
- FILES: one line per file created/modified
- DEVIATIONS: honest list (empty if none)
- INTEGRATOR NOTES: anything the next phase needs to know
