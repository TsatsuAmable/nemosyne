# Stream M M3 — Distribution production cutover

**Date:** 29 August 2026  
**Stream:** M — Moneta Distribution Truth  
**Checkpoint:** M3 — production cutover and thin embodiment  
**Base:** `main@f6d61e4117629861274f662630045eb3a6a900be`  
**Status:** IMPLEMENTED — GOVERNED EXACT-HEAD VERIFICATION REQUIRED

## Invariant

An authoritative `DISTRIBUTION_FIELD` decision with an explicit measure reaches the resident Worker/WASM dataset capability and renders only the bounded Rust empirical-distribution payload. Pending, refused, failed, stale, mismatched or unavailable output produces no observation, point, density or chart fallback. Each rendered element retains its Rust semantic ID and the artifact remains bound to dataset fingerprint, decision and kernel/algorithm provenance.

## Authority and production path

```text
RepresentationRequirements(task=distribution-analysis, primaryDimensions[0]=measure)
  -> LoadDatasetUseCase / authoritative RepresentationDecision
  -> SemanticEmbodimentLoader generation+version+fingerprint+decision fence
  -> analytical Worker resident handle
  -> Rust empirical-distribution builder
  -> SemanticEmbodimentEnvelopeV1
  -> MonetaTopologyNode stale-promise fence
  -> VRTopologyTranslator DISTRIBUTION_FIELD branch
  -> ScalableTopologyEmbodiment thin distribution adapter
  -> stable selectable semantic meshes
```

Rust owns the analytical result. TypeScript may choose governed request bounds, transport the explicit measure/provenance, validate transport identity, map payload elements to positions/materials and expose status. It must not derive bins, ECDF, quantiles or replacement values from source rows.

## Governed request policy

M3 uses 32 equal-width histogram bins, at most 64 ECDF knots and R7 quantiles at `[0, .25, .5, .75, 1]`. The measure is exactly `requirements.primaryDimensions[0]`. Missing or invalid measure input is sent unchanged and must become a Rust `INVALID_PARAMETERS` refusal; TypeScript must not scan for a usable numeric column.

## Primary failure modes

1. `DISTRIBUTION_FIELD` falls through to grid/point or the old density-voxel renderer.
2. The loader silently chooses the first numeric/size/color encoding when no explicit measure exists.
3. Semantic execution carries rows rather than a resident dataset identity plus parameters.
4. The Worker dispatches every semantic request to the aggregate builder or accepts an unknown candidate.
5. A prior generation/version/fingerprint result mutates the current representation.
6. A payload for another decision/candidate/family is accepted because its dataset fingerprint matches.
7. Node replacement or decision change permits a late promise to rebuild the new artifact.
8. Pending/refused/failed output traverses source rows, creates points, density voxels or a chart-plane fallback.
9. The thin adapter recomputes distribution statistics from payload values or dataset rows.
10. Semantic IDs are replaced with presentation indices, breaking selection/drill-down continuity.
11. Artifact metadata omits dataset/decision/kernel identity or labels the empirical summary as continuous density.
12. Aggregate routing, rendering or lifecycle behavior regresses during the extension.
13. Extreme finite domains overflow TypeScript position mapping even though Rust output is finite.
14. Render primitive count exceeds the authoritative payload element count.

## Falsifying evidence

M3 must add or strengthen tests proving:

- loader requests contain explicit governed parameters/provenance and no rows;
- generation, dataset version, fingerprint, candidate, family and decision mismatches fail closed;
- the actual analytical Worker handler registers a canonical dataset, dispatches distribution independently, executes the real Rust/WASM builder and hands its envelope to the row-guarded adapter; unknown semantic candidates remain rejected;
- the real production use case attaches a distribution promise only for the distribution decision and uses only `primaryDimensions[0]` as measure;
- the translator renders a valid envelope with a raw-row sentinel installed;
- pending/refused/unavailable/invalid distribution states create zero meshes and never enter a row/chart branch;
- mesh count equals histogram + ECDF + quantile elements, mesh names equal Rust semantic IDs and provenance is present on mesh/group metadata;
- extreme finite domain endpoints map to finite bounded positions;
- a late result is fenced after decision/node replacement;
- the A2 inventory promotes only `DISTRIBUTION_FIELD` to `DATASET_LEVEL_VALID`, leaving density and other unresolved families explicit;
- aggregate fixtures remain green and unchanged.

## Non-goals and dependencies

M3 does not add the UI-owned `Show distribution` action, browser/perceptual/scale evidence, density/KDE, connected ECDF line geometry, smoothing, weighted or multivariate distributions, approximate quantiles, source-level invalid-reason provenance, progressive disclosure, RepresentationGraph expansion or Quest qualification. M4 owns canonical browser evidence, product status presentation and scale/perceptual handoff.

## Model routing

- **Implementation:** Frontier (`gpt-5.6-sol`) at **xhigh** reasoning because lifecycle fencing, Worker identity, row-fallback prohibition and visible semantic identity cross several ownership boundaries.
- **Independent adversarial review:** Frontier (`gpt-5.6-sol`) at **xhigh** reasoning.
- **Mechanical support only:** Fast (`gpt-5.6-luna`) at **medium/high** for inventory, formatting and log triage; never sole owner of the cutover or scientific/product claim.

## Post-implementation adversarial review

The implementation was re-read across the use-case, loader, Worker, node lifecycle, translator, adapter and selection surface before publication. Five cross-boundary findings were closed in the implementation and exact-head verification:

1. **Chart-plane row fallback — closed.** Branching only around layout geometry was insufficient because the post-geometry chart-plane path could still receive the resident `Dataset`. `DISTRIBUTION_FIELD` is now excluded from that path, and the falsifier installs throwing getters on both `dataInput.rows` and `dataset.rows` while keeping a chart factory available.
2. **Execution-result identity — closed.** Authority-state checks alone did not prove that a returned result carried the requested generation/version/fingerprint. The distribution loader now verifies both current authority and result metadata, then checks envelope schema/fingerprint/candidate/family/payload kind and decision ID before adoption.
3. **Extreme-domain presentation overflow — closed.** Ordinary `(value-min)/(max-min)` mapping can overflow for finite `[-f64::MAX, f64::MAX]` domains. The adapter scales finite endpoints before subtraction; the regression fixture requires every rendered position to remain finite.
4. **Late distribution promise — closed.** The node's existing aggregate-only subscription fence now captures either semantic candidate and rejects resolution after token, promise or representation-decision change.
5. **Legacy journey fallback expectation — closed.** Exact-head coverage found that the synchronous whole-product journey still required non-empty meshes when `DISTRIBUTION_FIELD` had no semantic payload. The test now proves the governed `PENDING`/zero-mesh state instead of requiring the retired source-row/density fallback; the separate Worker-handler/WASM test proves ready distribution meshes.

The review confirmed that the Worker rejects unknown semantic candidates, aggregate dispatch is unchanged, pending/refused/invalid/unavailable output creates no meshes, and every ready mesh name equals its Rust semantic ID while mesh/group metadata retain dataset fingerprint, method, decision and kernel/algorithm provenance.

### Local verification

- `git diff --check` — passed;
- documentation integrity and action-pinning checks — passed;
- TypeScript 6.0.3 syntax/transpile over all changed TypeScript — passed;
- full repository `tsc --noEmit` — passed;
- focused ESLint and Prettier checks — passed;
- M3 cutover + A2 sentinel + RepresentationSurface + aggregate-loader regression: 4 files, 16 tests — passed;
- the new actual Worker-handler/WASM cutover test passed locally against the exact-head CI-produced WASM package after the first coverage run exposed the legacy journey expectation; exact-head Rust/WASM/coverage gates remain authoritative after the repair commit.

### Residuals transferred to M4

- The adapter deliberately creates at most one selectable mesh per bounded payload element (maximum 544). M4 must measure draw calls, primitive count and browser timings before making a scale claim or selecting instancing/progressive disclosure.
- `artifactId` is a deterministic provenance key for this fixed M3 request policy, not a cryptographic content digest. M4 perceptual evidence must retain the full dataset/payload/provenance record and must not mislabel this key as a payload hash.
- Connected ECDF line geometry, textual axes/legends and explicit product status surfaces remain M4/product work; their absence does not authorize a point, density or chart fallback.

Exact-head CI, real-WASM coverage, governed approval and post-publication thread review are merge requirements for M3.
