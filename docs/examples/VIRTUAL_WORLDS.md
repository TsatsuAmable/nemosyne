# Virtual Worlds / Gaming Example

A process-flow memory palace for game-world telemetry, using the `flow-process` sample dataset.

## What it shows

Game levels and pipelines share the same shape as process-flow graphs: stages, edges, throughput, and latency. The `flow-process` dataset from `src/data/SyntheticData.js` acts as a stand-in for level telemetry:

| id  | stage | label   | throughput | latency |
| --- | ----- | ------- | ---------- | ------- |
| S0  | 0     | Stage 1 | 342        | 87      |
| ... | ...   | ...     | ...        | ...     |

Moneta consumes Rust-owned graph evidence and can select a channel-style flow graph with weighted beams.

## Artefacts generated

- **Process nodes** — one per stage.
- **Weighted beams/trails** — normal and skip paths.
- **Glow pulse** — latency drives emissive intensity on bottleneck stages.

## Try this in VR

1. Launch the app and open the wheel menu.
2. Choose **Views → Dataset** and pick **Process Flow Graph**.
3. Operations you can perform:
   - **Filter low-throughput stages** — focus on the busiest parts of the pipeline.
   - **Sort by latency** — find bottlenecks.
   - **Anomaly on latency** — highlights problem stages.
   - **Reset** — `pushForward` gesture.

## Roadmap extensions

Direct level-editor data (navmesh, spawn points, trigger zones) and real-time profiling overlays are not yet supported. The current flow-graph palace demonstrates the same spatial reasoning tools that would power those future workflows.

## Export

Use **Panels → Export Story** to save the analysis.
