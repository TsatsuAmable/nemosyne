# P1-R2D rail post-review - 31 August 2026

**Base:** `main@c9a089564284466d249d181e9408f5822f4ac196` (#584 merged)  
**Branch:** `docs/p1r-r2d-cluster-regions-rail`  
**Disposition:** PASS FOR ROADMAP/SCIENTIFIC-BOUNDARY SCOPE / C1 NOT YET IMPLEMENTED

## Review scope

This review checks whether the new R2D rail closes R6 truthfully, describes the actual current cluster defect, and defines a finite first Cluster Regions programme without accidentally authorizing inferred clustering, renderer-owned science, or unsupported completion claims.

## Findings checked against current source

- `VRTopologyTranslator` still resolves raw rows for `CLUSTER_VOLUME`; the new rail correctly treats cluster migration as not yet landed.
- `ScalableTopologyEmbodiment.buildClusterVolume()` still chooses grouping from color/first categorical/`cluster` fallback, groups in TypeScript, computes center/radius from layout positions and draws spheres; the pre-review description matches the current production path.
- Aggregate, distribution and density are already intercepted before row resolution, so using the same payload-first pattern for cluster is architecturally consistent.
- `RepresentationFamily.ts` now assigns `CLUSTER_REGIONS` to one canonical `CLUSTER` reasoning family after #584; the rail does not reopen duplicate family aliases.
- `RepresentationCandidate.ts` still contains the broader cluster ontology claims. The rail records those as C1 work rather than falsely describing them as fixed.

## Adversarial checks

### No hidden automatic clustering

PASS. The V1 authority is explicitly supplied/source-authoritative partition labels. k-means, DBSCAN/HDBSCAN and density-derived partitions are fenced into a later separately governed analytical-method programme.

### No geometry-as-evidence laundering

PASS. Planned centroids and axis-aligned bounds are described as bounded descriptive summaries only. The rail explicitly rejects support-boundary, confidence-region, density-support and separation-margin semantics.

### No categorical fallback laundering

PASS. Merely being categorical, color-encoded or named `cluster` is explicitly insufficient. The partition field must be selected as authoritative by the investigation/source contract.

### Missingness and resource truth

PASS for planning scope. Source/assigned/unassigned/coordinate-valid/coordinate-excluded accounting is required. The proposed 256-cluster ceiling is correctly labelled a C1 proposal that must become an exact reviewed constant before implementation. Refusal is required instead of silent merge/truncate/sample.

### Rank-effective ontology changes

PASS. The rail does not edit candidate capabilities or preservation claims. It requires C1 to quantify any ranking effect and mint a new fitness treatment when necessary.

### Finite stop

PASS. C1-C4 are followed by an independent C5 review and explicit STOP. Passing source-partition Cluster Regions does not authorize inferred clustering or R2E.

## Residuals

1. `docs/ROADMAP.md` still needs a canonical top-level truth sync after this rail lands; this PR avoids rewriting that very large file through a lossy partial-file operation.
2. C1 must decide the exact wire representation for a cluster with assigned members but zero coordinate-valid members.
3. C1 must decide whether the existing information ontology is precise enough for source-partition identity or whether a new information type is required.
4. The proposed 256-cluster bound is not promoted until it is checked against current interaction/device/resource envelopes.

These residuals are explicit entry work, not blockers to landing the planning rail.

## Disposition

Adopt the rail. Merge only after the repository's documentation/governance gates pass on the exact head. Then start C1 from fresh `main`; do not implement production cluster rendering on this branch.
