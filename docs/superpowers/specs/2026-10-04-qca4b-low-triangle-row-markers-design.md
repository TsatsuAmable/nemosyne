# QCA4b Low-Triangle Row Markers

**Status:** Approved for implementation

**Date:** 4 October 2026

**Stacked base:** `codex/qca4a-glyph-warning@8a765f33cbc1c91bef2d872601d4809c5a0e8d14`
**Programme:** `docs/work/quest-compute/QCA4_WEBXR_RENDERING.md`

## Purpose

QCA0 measured about 2.4 million submitted triangles and roughly 4 FPS while
rendering 100,000 row-addressable markers on Quest 3S. The representation used
one instanced cube per row. A cube has 12 triangles, and the stereo renderer
therefore submits about 24 marker triangles per row before other scene work.

QCA4b is the first bounded rendering optimization: replace the cube marker with
a four-triangle tetrahedral marker of comparable bounding radius. It tests
geometry complexity independently while retaining one spatial instance per row.

## Decision

The scalable row-addressable embodiment will create a zero-detail tetrahedron
with radius `0.052`, approximately matching the current `0.06` cube's bounding
radius. The same geometry factory is used by the registered production factory,
the no-registration fallback, and per-synthesis factory overrides.

Rejected alternatives:

- Prefix-based instance truncation changes which rows are visible and is not a
  semantically honest optimization.
- A plane is cheaper but loses stable 3D visibility and makes picking depend on
  orientation unless a billboard system is added.
- `THREE.Points` could reduce work further but changes material, sizing,
  raycasting and interaction contracts simultaneously.
- Semantic aggregation is the product direction for many investigations, but
  it is not a controlled replacement for the row-addressable QCA0 control.

## High-risk pre-implementation adversarial contract

**Invariant:** The production large-tabular representation remains one-to-one
row-addressable: instance count, positions, colors, scales, row/index payload,
selection and provenance behavior are unchanged. Only the default marker
geometry changes from 12 triangles to 4 triangles per instance.

**Authority and production path:** `ScalableTopologyEmbodiment` owns the
row-marker choice and passes it through `VRTopologyTranslator` to the registered
`InstancedPointCloud` factory. `World.loadDataset -> RepresentationSurface ->
VRTopologyTranslator -> ScalableTopologyEmbodiment -> InstancedPointCloud ->
WebGLRenderer` is the production path that must exhibit the change.

**Primary failure modes:** only the generic cloud default changes while the
production embodiment keeps supplying a cube; row count or data identity is
reduced; the new marker is materially smaller or unpickable; a custom factory
receives no geometry; tests prove a helper rather than the real World path; a
deterministic triangle reduction is misreported as a measured Quest FPS gain.

**Falsifying evidence:** first observe tests fail while the production World
still builds a 12-triangle cube. Then require the real 100k World/QCA path to
retain 100,000 instances and row-addressable coverage while exposing a
four-triangle `TetrahedronGeometry`; require a raycast through the same
`InstancedPointCloud` implementation to return the original row payload; keep
custom-factory geometry delivery covered; run focused, typecheck, build, and
full-suite verification. Quest comparison remains required for adoption.

**Non-goals and dependencies:** No LOD/cardinality reduction, aggregation,
sampling, shader rewrite, foveation, workload/threshold/custody change, QCA2
attribution, or PERF promotion. QCA4a remains the measurement-hygiene base.

## Adoption rule

Retain the change only if automated production-path evidence preserves semantic
and interaction contracts and an exact-head Quest run shows lower render work
with no material legibility or selection regression. Triangle reduction is a
mechanical result; frame-time improvement remains an empirical claim.
