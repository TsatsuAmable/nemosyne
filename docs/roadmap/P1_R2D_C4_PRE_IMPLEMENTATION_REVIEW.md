# P1-R2D C4 Pre-Implementation Adversarial Review

**Status:** IMPLEMENTATION ACTIVE  
**Base:** `main@e305a5e39feeb977949a60c6a9a81b1414c61c70` (#592 / C3 merged)  
**Scope:** C4 product, scale and perceptual evidence for the already-governed source-partition `CLUSTER_REGIONS` path.

## Claim under test

C4 does not add clustering science. It tests whether the C1-C3 production path is visibly useful, bounded and semantically honest in a production browser build:

```text
explicit source partition authority + explicit x/y dimensions
  -> Moneta CLUSTER_REGIONS
  -> analytical Worker
  -> resident Rust/WASM source-partition summary
  -> bounded CLUSTER_REGIONS envelope
  -> centroid + descriptive AABB presentation
  -> exact-identity-bound browser/perceptual evidence
```

## High-risk falsifiers

1. **Authority substitution:** the fixture exposes a decoy categorical as `encodings.color`; only `requirements.clusterAuthority.field = cohort` may determine partition membership.
2. **Source-N leakage:** balanced fixtures run at 1k, 8k and 32k rows while retaining eight semantic regions and two candidate-local render batches.
3. **Near-bound growth:** a 240-region fixture must remain below the hard 256-region resource ceiling without truncation/coarsening.
4. **Missingness accounting:** missing partition labels must become `unassignedCount`; invalid coordinates must become `coordinateExcludedCount`, with a cluster that has no valid spatial members retained semantically but not given fabricated geometry.
5. **False separation:** deliberately overlapping coordinate envelopes must remain visible while metadata continues to state descriptive bounds only and `supportBoundaryClaim = false`.
6. **Presentation substitution:** the ready artifact must expose the cluster centroid and descriptive-bounds batches, not point-cloud, density or legacy row-derived cluster-sphere fallback.
7. **Evidence detachment:** screenshots and perceptual samples must be sidecar-bound to exact dataset fingerprint, decision ID and semantic artifact ID.
8. **Environment overclaim:** browser evidence is desktop synthetic evidence. Physical Quest qualification remains false unless measured on device.

## Evidence envelope

The C4 harness records for every scenario:

- source row count;
- assigned, unassigned, coordinate-valid and coordinate-excluded counts;
- semantic/spatial/unavailable region counts;
- semantic payload JSON byte proxy;
- candidate-local render batch/draw-call contract;
- whole-scene last-frame draw calls and triangles;
- Worker kernel timing and available WASM linear-memory observations;
- request-to-ready and ready-to-rendered-frame timings;
- exact artifact/dataset/decision identity;
- measured desktop perceptual sample;
- screenshot identity sidecars.

Canonical fixtures are balanced scale, one cluster, 240 clusters near the hard bound, overlapping envelopes, missing labels, invalid coordinates and highly imbalanced cluster sizes.

## Stop conditions

C4 must not be merged if any fixture:

- derives authority from the decoy color field;
- emits row/observation fragments in the semantic envelope;
- exceeds or silently coarsens the 256-region contract;
- fabricates geometry for a region with zero coordinate-valid members;
- claims support/confidence/separation boundaries;
- scales candidate-local render batches with source N;
- cannot bind evidence to the exact semantic artifact;
- causes ordinary CI, CodeQL, architecture, supply-chain, approval or promotion gates to fail.

## Finite exit

C4 may claim only that the source-partition Cluster Regions slice is visibly distinct, truthful, bounded and inspectable in the measured desktop-browser synthetic envelope. After merge, R2D proceeds to C5 independent STOP review. Inferred clustering, R2E and physical Quest claims remain out of scope.
