# Spatial Accelerator Crossover

## Scope

PERF-03 measures and wires `three-mesh-bvh` into the production interaction path. The benchmark
compares native Three.js first-hit selection with the same result through the accelerator. It has
two suites:

- `objects`: registered scene objects and instances through `ObjectBVH`;
- `geometry`: triangles within one mesh through the geometry BVH.

The benchmark checks first-hit parity at every tier. CI runs a small correctness contract but does
not enforce wall-clock thresholds, because hosted timing is not a stable performance gate.

## Reproduce

```bash
npm run benchmark:spatial-accelerator -- --suite=objects --json
npm run benchmark:spatial-accelerator -- --suite=geometry --json
```

## Apple M1 Pro baseline

Collected on 24 August 2026 with arm64 Node 25.6.1, 64 rays and the median of five runs.

| Object primitives | Native median | BVH median | Speedup | Build | Parity |
| ---: | ---: | ---: | ---: | ---: | :---: |
| 16 | 0.499 ms | 0.401 ms | 1.244x | 1.321 ms | yes |
| 64 | 0.485 ms | 0.309 ms | 1.572x | 0.607 ms | yes |
| 256 | 0.874 ms | 0.302 ms | 2.897x | 1.697 ms | yes |
| 1,024 | 3.348 ms | 0.401 ms | 8.355x | 3.777 ms | yes |
| 4,096 | 14.027 ms | 0.280 ms | 50.045x | 5.088 ms | yes |
| 16,384 | 95.295 ms | 0.272 ms | 350.456x | 29.710 ms | yes |

| Geometry primitives | Native median | BVH median | Speedup | Build | Parity |
| ---: | ---: | ---: | ---: | ---: | :---: |
| 128 | 0.912 ms | 0.396 ms | 2.301x | 1.199 ms | yes |
| 512 | 1.640 ms | 0.130 ms | 12.651x | 1.086 ms | yes |
| 2,048 | 6.464 ms | 0.110 ms | 58.564x | 0.630 ms | yes |
| 8,192 | 25.497 ms | 0.174 ms | 146.395x | 1.983 ms | yes |
| 32,768 | 98.917 ms | 0.141 ms | 701.330x | 6.055 ms | yes |
| 131,072 | 411.044 ms | 0.209 ms | 1,966.320x | 34.551 ms | yes |

The earliest observed crossover was 16 objects, but that tier saved only 0.098 ms per 64-ray batch
against a 1.321 ms build. Production therefore starts object acceleration at 64 primitives, where
the win is less marginal, and geometry acceleration at the first measured 128-triangle tier.
Instance expansion is capped at the highest measured object tier, 16,384; larger instanced clouds
retain aggregate-object bounds rather than allocating an unqualified per-instance tree.

## Production contract

`InteractableRegistry` is the sole scene-selection index owner. It lazily rebuilds the object BVH
after registration or governed transform invalidation, retains shared geometry trees until their
last owner is removed, preserves externally owned trees, maps recursive child hits to their
registered root and routes desktop cursor and UX trace queries through the same index. Unsupported
groups, sprites and custom raycaster layers use the recursive Three.js path.

The former uniform-grid `SpatialIndex` and its isolated tests were deleted because no production
consumer used them.

## Qualification boundary

This is host characterization, not Meta Quest 3S qualification. The thresholds prevent known
low-count regressions and cap unmeasured instance expansion, but physical browser frame cadence,
thermal behaviour, interaction latency and the appropriate device crossover remain part of
PERF-04. Source rows are not render primitives; this benchmark does not authorize embodying a 10M
dataset as 10M selectable objects.
