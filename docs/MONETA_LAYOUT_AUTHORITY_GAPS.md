# Moneta Layout Authority Status

This note records the layout-authority work completed during the Moneta Migration Completion Sprint.

## Implemented in this branch

`GridLayout3D`, `RadialTreeLayout`, `GeoSurfaceLayout`, `TimeSeriesRibbonLayout`, `StreamlineLayout`, `ForceDirected3D`, and `SpectralVolumeLayout` now require authoritative Rust/WASM coordinate generation instead of recomputing data-derived geometry independently in TypeScript.

Weighted force edges are routed through a dedicated Rust ABI that resolves the existing Rust force-directed implementation rather than falling back to the former JavaScript solver.

Spectral-volume coordinate generation now has a Rust-owned ABI and deterministic Rust-side implementation.

## Boundary

Presentation mapping remains TypeScript-owned: converting authoritative coordinate buffers into `THREE.Vector3`, attaching row/index metadata, and constructing renderer objects is allowed. Computing data-derived coordinates independently in TypeScript is not.

## Remaining verification

Before the layout-authority migration row is marked DONE, required CI must prove the new ABI compiles and the focused layout tests must be updated where they previously depended on the JavaScript fallback being available without an initialized kernel.
