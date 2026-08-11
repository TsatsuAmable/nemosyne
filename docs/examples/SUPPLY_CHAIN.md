# Supply Chain Hierarchy Example

A hierarchical memory palace built from the `supply-chain` sample dataset.

## What it shows

`src/data/SampleDatasets.ts` defines a three-level supply chain:

| name | level | region | inventory | riskScore |
|---|---|---|---|---|
| North America Hub | 0 | Americas | 12000 | 0.20 |
| EU Hub | 0 | Europe | 9800 | 0.35 |
| Asia Hub | 0 | Asia | 15400 | 0.15 |
| NYC Warehouse | 1 | Americas | 3400 | 0.40 |
| ... | ... | ... | ... | ... |
| Seoul DC | 2 | Asia | 1500 | 0.60 |

The Draco constraint engine detects the `level` and `region` columns, infers **HIERARCHY**, and emits a radial-tree palace with conical nodes on plinth rings and beam parent-child edges.

## Artefacts generated

- **Conical nodes** — one per supply-chain node.
- **Plinth rings** — one per level (Hub → Warehouse → DC).
- **Beam edges** — parent-child relationships inferred from `level` ordering.
- **Halo / pulse** — `riskScore` drives emissive pulse; `inventory` drives size.

## Try this in VR

1. Launch the app at `https://nemosyne-analysis-suite.netlify.app/`.
2. Open the hand wheel menu.
3. Choose **Views → Dataset** and pick **Supply Chain Hierarchy**.
4. Operations you can perform:
   - **Filter by region** — wheel menu or `pinchTogether` gesture.
   - **Aggregate by region** — wheel menu or `pinchApart` gesture.
   - **Sort by inventory** — wheel menu or `sliceUp` gesture.
   - **Anomaly scan on `riskScore`** — wheel menu **Ops → Highlight Outliers**.
   - **Undo / redo** — `rotateCCW` / `rotateCW` gestures or `Ctrl+Z` / `Ctrl+Y`.

## Export

Use **Panels → Export Story** to download a JSON analysis story with the dataset, operations, camera pose, and theme.
