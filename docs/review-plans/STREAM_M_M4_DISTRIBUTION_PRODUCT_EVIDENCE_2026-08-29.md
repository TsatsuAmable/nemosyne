# Stream M M4 — Distribution product, scale and perceptual evidence

**Date:** 29 August 2026  
**Stream:** M — Moneta Distribution Truth  
**Checkpoint:** M4 — product, scale and perceptual handoff  
**Base:** `9db597937e455c01fe7c2770ce76b62792f3e5aa` (`main`, M3 merged)  
**Status:** EXACT-HEAD BROWSER EVIDENCE CAPTURED — GOVERNED PR GATES PENDING

## Invariant

For a deterministic synthetic dataset and an explicit `distribution-analysis` intent naming one numeric measure, the production `World` → `LoadDatasetUseCase` → resident analytical Worker → Rust/WASM → `MonetaTopologyNode` → distribution adapter path must visibly produce the reviewed empirical-distribution artifact. The evidence must bind source N, canonical dataset fingerprint, decision ID, full payload/provenance record, payload byte proxy, payload element count, rendered primitive count, Worker/kernel timing, browser settlement timing and perceptual sample to the same artifact identity.

Pending, Rust-refused, invalid and unavailable distribution output must show an explicit non-analytical status surface while rendering zero analytical meshes. No state may substitute observation points, aggregate bars, density voxels or a chart.

## Authority and production path

- Rust/WASM remains the sole owner of histogram, ECDF, quantiles, counts, method and bounded payload.
- `LoadDatasetUseCase` and the existing semantic loader remain the production request/identity authority.
- The representation adapter may create only bounded visual marks and a non-analytical status surface.
- The isolated browser evidence driver may choose deterministic synthetic inputs and set the already-governed requirements before re-entering `_doLoadDataset`; it may not calculate, repair or replace analytical output.
- The exact-head Playwright workflow exercises the production bundle, module Worker and real WASM. Its JSON and screenshot are synthetic browser evidence, not physical Quest evidence or a universal performance benchmark.

## Failure modes to falsify

1. The browser fixture reaches a helper or inline bridge instead of the production `World` and module Worker.
2. The named measure is silently replaced by another numeric/encoding field.
3. Source rows reach the distribution adapter or the presentation recomputes statistics.
4. Evidence combines a payload, decision, fingerprint, artifact or provenance record from different executions.
5. Payload bytes are reported as exact transport bytes even though they are only deterministic JSON byte proxies.
6. A bounded render count is misreported as bounded computation; the exact V1 builder still sorts O(valid N) transient data.
7. Renderer counters from a different frame or scene are presented as distribution-only draw-call cost.
8. Perceptual evidence samples a toy point substitute, local rather than world-space marks, or a different candidate/fingerprint.
9. Pending/refused/unavailable presentation creates analytical meshes or silently falls back to points, density or chart geometry.
10. An unavailable promise changes metadata but leaves a stale pending status surface visible.
11. A status surface is counted as a Rust semantic element or made selectable as analytical evidence.
12. Browser evidence omits full payload/provenance while treating the deterministic `artifactId` key as a cryptographic payload digest.
13. A canonical screenshot looks distribution-like while machine evidence actually reports another candidate or payload kind.
14. A new permanent workflow becomes a broad CI tax or records evidence from a merge ref rather than the exact PR head.
15. M4 silently implements the separately owned typed `Show distribution` UI action or claims that its absence is solved.

## Falsifying evidence

- focused status-surface tests for pending/refused/invalid/unavailable/ready transitions and zero analytical meshes;
- the existing throwing-row M3 falsifiers and real Worker-handler/WASM test;
- a production-shaped diagnostic scenario entered through `World._doLoadDataset`, with a deterministic explicit measure and no analytical implementation in the driver;
- exact equality among decision, envelope provenance, dataset fingerprint, artifact metadata and perceptual-evidence binding;
- fixed-policy element equality: Rust `resource.elementCount` equals histogram + ECDF + quantile lengths and rendered analytical mesh count;
- representative configured source-N scenarios proving payload/render counts remain bounded while recording, not threshold-blessing, timings;
- a canonical screenshot plus JSON report pinned to source head, production bundle hash and WASM hash;
- source guards against density/PDF terminology, row traversal and product-action scope expansion.

## Non-goals and dependencies

M4 does not add KDE/PDF/density mathematics, axes/legends, a connected ECDF line, weighted or multivariate distributions, approximate quantiles, progressive disclosure, instancing, Quest qualification, global frame-rate claims or the UI-owned typed `Show distribution` action. The browser driver is a deterministic evidence seam, not a user-facing action. Physical optics, sustained device pacing, comfort and memory remain P1-U9/PERF-04 work.

## Model routing

- **Evidence plumbing:** Balanced / `gpt-5.6-terra` / high is the speed-quality default because the fixture, counters, report and isolated workflow are bounded by this contract.
- **Interpretation, claim promotion and fixes:** Frontier / `gpt-5.6-sol` / high.
- **Escalation:** Frontier / xhigh if evidence reveals lifecycle/identity drift, a resource-envelope change, a new ABI/public format or a production authority defect.
- **Fast support:** `gpt-5.6-luna` / medium-high only for mechanical inventory, formatting and log triage.

## Post-implementation adversarial review

The implementation was re-read from the synthetic fixture through `World.loadDataset`, the governed requirements re-entry, the module Worker/Rust request, node settlement, status presentation, bounded adapter and perceptual sampler. Four blockers found by this pass and first exact-head run were closed:

1. **Setup/measurement Worker collision — closed.** The ordinary first load can itself choose an asynchronous semantic candidate. The driver now awaits that setup promise and drains setup diagnostics before starting the explicit M4 request, so the recorded distribution execution timing cannot belong to the prior decision.
2. **Stale status metadata — closed.** Removing the pending surface on `READY` was insufficient if its explanatory message remained in group metadata. The status presenter now deletes that message when ready.
3. **Per-scenario bound without cross-scale proof — closed.** Checking `elementCount <= maxElementCount` separately did not prove source-N independence. The browser falsifier now also requires identical Rust element and analytical-mesh counts across every configured scale.
4. **Composition-root reverse dependency — closed.** The first exact-head architecture gate rejected the evidence module's direct import of `World`. The driver now depends on a narrow structural evidence port; only the already-approved resource diagnostic composition seam receives the real `World` instance.

The review also confirmed that the status plane is not included in `Artifact.nodeMeshes`, is marked non-analytical/non-selectable, and is removed for ready output. The evidence record retains the full envelope and provenance; `payloadJsonBytesProxy` is explicitly labelled as a deterministic JSON proxy, whole-scene last-frame renderer counters are not presented as distribution-only draw calls, and the perceptual sampler receives world-space positions from the actual artifact meshes.

### Exact-head browser evidence

The isolated M4 workflow passed on implementation head `18a05922a13175565e632fb167dee8e90e9cb857` ([run 33278263468](https://github.com/TsatsuAmable/nemosyne/actions/runs/33278263468)). Artifact `stream-m-m4-distribution-evidence` (`9722202420`) binds the structured report and canonical screenshot to production-bundle SHA-256 `fb6636e455afae306ad6b7c32fee28f0b6779c7ce266f022d6ffae09e0a9781f` and WASM SHA-256 `88529b408a66b3a445ac5711afe42e49d605f94ba5e837a1d0091169c8b84f5f`.

| Source rows | Rust elements | Analytical meshes | JSON byte proxy | Worker kernel (ms) | Request to ready (ms) | Whole-scene calls | Whole-scene triangles |
| ----------: | ------------: | ----------------: | --------------: | -----------------: | --------------------: | ----------------: | --------------------: |
|       1,000 |           101 |               101 |          12,629 |              8.995 |               247.365 |               158 |                34,248 |
|       8,000 |           101 |               101 |          12,742 |             28.855 |               657.485 |               158 |                34,248 |
|      32,000 |           101 |               101 |          12,880 |            104.625 |               612.735 |               158 |                34,248 |

All three scenarios transitioned `PENDING` → `READY`, removed the non-analytical status surface, retained exact candidate/fingerprint/decision/artifact/perceptual binding, and emitted 32 histogram bins + 64 ECDF knots + 5 quantile marks. The invariant result is bounded output and render complexity at the exercised source sizes: 101 Rust elements and 101 analytical meshes in every scenario. The increasing Worker time is recorded rather than hidden; V1 still performs an exact sort. Request-to-ready timings are not monotonic and are not treated as a performance threshold. The 158 calls and 34,248 triangles are last-frame counters for the complete evidence scene, not distribution-only draw calls.

The screenshot visibly contains the histogram, ECDF samples and quantile marks in the production scene. It is evidence of truthful representation, not a claim that the dense diagnostic composition is the final end-user layout.

### Focused local verification

- full `tsc --noEmit` — passed;
- focused M3/M4 status and real Worker-handler/WASM tests — passed;
- A2/RepresentationSurface regressions — passed;
- instrumented production Vite bundle — built successfully against the CI-produced M3 WASM package;
- focused ESLint and Prettier checks — passed;
- documentation integrity, action pinning and `git diff --check` — passed;
- the M4 Playwright test was discovered locally but Chromium is not installed in this container; the isolated exact-head workflow remains the authoritative browser run.

### Honest residual handoff

- The typed user-facing `Show distribution` action has not landed. It remains owned by a separately railed UI stream; M4's diagnostic requirements re-entry is not a product command and must not be exposed as one.
- The evidence records exact V1 sort timings but does not claim bounded computation, generic 100k/500k suitability, or a threshold. Any approximate quantile method or resource-envelope change requires a new governed method/contract.
- Connected ECDF line geometry, axes/legends, instancing/progressive disclosure and density/KDE remain outside Stream M's finite exit.
- Browser Chromium evidence is not physical Quest evidence. Device optics, comfort, sustained frame pacing, thermal and memory qualification remain deferred.
