# Moneta Layout Authority Gaps

This note records blockers discovered while removing JavaScript computational fallbacks from Moneta layouts.

## Resolved in the current branch

`GridLayout3D`, `RadialTreeLayout`, `GeoSurfaceLayout`, `TimeSeriesRibbonLayout`, and `StreamlineLayout` now require a valid Rust/WASM result instead of recomputing the layout in TypeScript.

`ForceDirected3D` no longer executes its independent JavaScript force simulation. The underlying Rust implementation already accepts weighted edges, but the current WASM/RuntimeBridge export does not expose those edges. Edge-aware calls therefore fail explicitly until that ABI gap is closed.

## Remaining blocker

`SpectralVolumeLayout` is still a TypeScript-only data-derived layout. No Rust/WASM spectral-volume layout export currently exists. It must be moved into the kernel before the layout-authority migration row can be marked DONE.

## Boundary

Presentation mapping remains TypeScript-owned: converting authoritative coordinate buffers into `THREE.Vector3`, attaching row/index metadata, and constructing renderer objects is allowed. Computing data-derived coordinates independently in TypeScript is not.
