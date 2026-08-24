# Process Flow Graph Example

A process-flow memory palace built from the `flow-process` sample dataset.

## What it shows

`src/data/SyntheticData.js` generates six pipeline stages with `throughput` and `latency`, plus weighted skip edges.

| id  | stage | label   | throughput | latency |
| --- | ----- | ------- | ---------- | ------- |
| S0  | 0     | Stage 1 | 342        | 87      |
| S1  | 1     | Stage 2 | 891        | 45      |
| ... | ...   | ...     | ...        | ...     |

Moneta consumes Rust-owned weighted-edge evidence and can select a constrained channel layout that reads like a left-to-right pipeline.

## Artefacts generated

- **Process nodes** — one per stage, sized by throughput.
- **Weighted beams/trails** — normal and skip edges.
- **Glow pulse** — latency drives emissive intensity on bottleneck stages.

## Try this in VR

1. Launch the app and open the wheel menu.
2. Choose **Views → Dataset** and pick **Process Flow Graph**.
3. Operations you can perform:
   - **Filter low-throughput stages** — `pinchTogether` gesture.
   - **Sort by latency** — `sliceUp` gesture.
   - **Anomaly on latency** — highlights bottlenecks.
   - **Reset** — `pushForward` gesture.

## Export

Use **Panels → Export Story** to record the bottleneck investigation.
