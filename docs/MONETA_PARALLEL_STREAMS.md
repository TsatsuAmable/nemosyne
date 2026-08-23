# Moneta Parallel Migration Streams

The migration is currently split into two independent implementation streams:

- **Stream A — layout authority:** `feature/moneta-layout-authority`, touching Moneta layouts and Rust/WASM layout boundaries.
- **Stream B — Draco compatibility collapse:** `chore/draco-compat-collapse`, touching legacy import surfaces, compatibility inventory, and architecture guards.

A third stream, fitness/scoring convergence, may inspect and add isolated tests in parallel but should not modify shared `RuntimeBridge` or layout ABI code until Stream A settles that boundary.

This split is intended to preserve useful concurrency without creating overlapping edits to the same architectural seam.
