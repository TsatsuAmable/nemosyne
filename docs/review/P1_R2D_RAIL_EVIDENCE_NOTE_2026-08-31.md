# P1-R2D rail evidence note - 31 August 2026

The planning claims in this branch are source-bound to current `main@c9a089564284466d249d181e9408f5822f4ac196`:

- #584 is merged and its exact head passed CI, CodeQL, architecture policy, supply-chain pilot, approval gate and Q9.
- `VRTopologyTranslator` still keeps `CLUSTER_VOLUME` in the row-backed branch.
- `ScalableTopologyEmbodiment.buildClusterVolume()` still performs implicit grouping and derives sphere geometry from presentation positions.
- `CLUSTER_REGIONS` remains a canonical `CLUSTER` family candidate after R6B.
- no source-partition cluster semantic payload exists yet in the Rust embodiment payload union.

Therefore the correct status is R2D railed / C1 next, not implementation landed.
