# Nemosyne Roadmap & Implementation Status

> **Current implementation-status authority.** Product and research direction are governed by `docs/Nemosyne_Definitive_Vision_and_Roadmap.md` V3. This document records current implementation state, programme order, review findings and promotion gates. Completed migration detail is preserved in `docs/archive/`.

## Status snapshot — 28 August 2026

**Current remote main at roadmap branch cut:** `22ce66b` (#488 merged). #485/#486 landed RF-035B1 reference-backed history/version state and branch-point materialisation; #487 landed RF-035B2A compact authoritative row-view transfer for verified edge-free `filter`/`sort`/`slice`; #488 landed RF-035B2B reference-backed live durable result/event storage with isolated per-lineage row values and lazy schema-v2 materialisation. RF-035 remains **IMPLEMENTATION PARTIAL / REVIEW ACTIVE** because graph/derived Worker results, session/package materialisation, handle-only/typed state and measured whole-pipeline browser/WASM/device evidence remain. The next Stream-B scale tranche is real browser module-Worker + real-WASM transfer/heap/GC measurement, not another unmeasured memory rewrite. The bounded XR-simulator review is recorded in [`review-plans/XR_SIMULATOR_STREAM_INTEGRATION_REVIEW_2026-08-28.md`](review-plans/XR_SIMULATOR_STREAM_INTEGRATION_REVIEW_2026-08-28.md): IWER is the preferred WebXR simulator tier for simulator-testable UI/input/layout invariants, while physical Quest remains authoritative for device-dependent promotion claims. #478's title did **not** implement P1-U6; P1-U6 remains partial. Static resource limits remain kernel safety guards, not Quest qualification and not evidence of generic 10M-row support.

**Latest adversarial/security validation review:** the 27 August re-review was validated against `main@a33ceb7`, then the planning branch was synchronized to `main@9b3c990`; #465 does not alter the reviewed security paths. The previously reported replay-safe-ticket, upload-ingress, telemetry-consent and unpkg trust-path findings remain real and are already owned by RF-037, RF-039, RF-040 and RF-041 respectively; GitHub Actions immutable-SHA pinning remains fixed by #443 and its mechanical checker. The review also found a new collaboration integrity defect: binary pose replay/staleness state is keyed by an attacker-controlled numeric peer ID inside the frame rather than the signalling-authenticated/channel-bound peer identity. This is recorded as **RF-057**. The same re-review confirms a recurring validation problem where scanner-reported lines or hardened helpers can be fixed without proving the threatened production boundary or the rest of the defect class; **RF-058** owns that class-wide validation discipline. Detailed evidence is in [`review-plans/SECURITY_VALIDATION_REREVIEW_2026-08-27.md`](review-plans/SECURITY_VALIDATION_REREVIEW_2026-08-27.md).

**Production-wiring audit:** the 26 August audit at `main@3aa5b6e` identified real source-vs-deployment risks, but one specific claim is now stale on `main@22ce66b`: the active `wasmServePlugin` copies generated `wasm/pkg` files into `dist/wasm/pkg`, and `npm run build` builds WASM before Vite. RF-053 therefore requires a **clean-artifact re-verification**, not continued assertion that the copy path is absent: prove the exact runtime URLs, MIME/hash/manifest expectations, real kernel initialization and one authoritative operation from the clean production artifact, then close or narrow RF-053 from evidence. Collaboration and the default demo live stream still target same-origin `/__signal` and `/__demo-stream` dev/preview middleware and remain active RF-054/live-service work. RF-053 through RF-056 and the post-UI P1-W tranche still own production qualification; P1-W starts after P1-U convergence and must close before private-preview promotion.

**Reprioritised Stream-B critical path:** (1) **CURRENT: RF-015/RF-029/RF-030/RF-031/RF-035/RF-051 measured whole-pipeline resource envelope**, now that #488 has landed the bounded B2B durable-state reduction; measure real browser module-Worker + real WASM transfer, heap, GC and scheduling before selecting the next optimization; (2) RF-001/RF-002/RF-036 representation/evidence authority review on top of RF-045; (3) **P1-USIM + RF-050 + remaining P1-U convergence** in the parallel UI stream, using IWER for simulator-testable spatial/input invariants while preserving physical Quest exits; (4) RF-033 production evidence architecture and RF-052 governance truthfulness; (5) physical Quest 3S U1/U8/U9 and PERF-04 qualification; (6) post-UI P1-W production wiring under RF-053 through RF-056; (7) private-preview hardening. RF-046/RF-047 remain implementation-landed/review-active foundations. Stream C continues in parallel on RF-037 through RF-043 plus RF-057/RF-058; after the live security authority is fixed, simulator-driven multi-client/browser scenarios may exercise that real boundary end-to-end, but security evidence remains owned by the signalling/network authority rather than the simulator. The dependency rule remains: **preserved source data → truthful analytical evidence → reproducible identity/replay → bounded computation → faithful representation → coherent investigator UX → simulator-testable XR proof → physical XR proof → production wiring → private preview.**

**Current interpretation:** P1-A, P1-B, P1-C, P1-D, P1-E and P1-F contain material implementation advances but remain **IMPLEMENTATION LANDED / REVIEW ACTIVE**, not `VERIFIED COMPLETE`. RF-044, RF-045, RF-046, RF-047 and RF-048 have implementation landed but remain review-monitored; RF-051 has landed several bounded fix-forward tranches and still depends on RF-029/RF-035 plus measured whole-pipeline evidence. RF-035A, RF-035B0, RF-035B1, RF-035B2A and #488 RF-035B2B are landed bounded reductions of avoidable main-thread/transfer/history/durable-result work, not closure of RF-035: graph/derived Worker results, session/package materialisation, handle-only/typed state and measured browser/WASM/device evidence remain. P1-U remains **IMPLEMENTATION PARTIAL / REVIEW ACTIVE**; P1-USIM is a planned evidence enabler, not a product feature or physical qualification substitute. Dominant risks are measured memory/transfer/materialisation cliffs, representation/evidence authority gaps, collaboration/security authority gaps including RF-057, off-path security/privacy controls, production qualification and product/device evidence gaps. Stream A may continue only where these defects are not dependencies; Stream B fixes correctness/evidence foundations; Stream C independently hardens security/privacy-sensitive live boundaries.

**XR evidence ladder:** desktop/browser CI remains necessary but does not qualify XR behavior. For simulator-testable UI/input/layout invariants, use a governed IWER `desktop-simulator` tier before device promotion. Physical Meta Quest 3S remains authoritative for Quest Browser/device memory and frame pacing, optics/legibility, real tracking/haptics, fatigue/comfort and PERF-04/U9 promotion evidence.

## Three-stream operating model

Nemosyne development runs as three deliberately distinct but converging streams.

### Stream A — forward implementation

Stream A advances the planned architecture and product frontier: private-preview plumbing, investigation/discovery science, measurement semantics, pattern-fragility evidence, maintenance, and later P2/P3 work only when their prerequisites are met.

Stream A should not stop merely because the review stream finds defects in earlier work unless a defect invalidates a dependency or makes continued implementation unsafe. It should preserve the governing design boundaries and consume review fixes as they land. All Stream A work is governed by [`STREAM_A_IMPLEMENTATION_QUALITY_CONTRACT.md`](STREAM_A_IMPLEMENTATION_QUALITY_CONTRACT.md).

### Stream B — review and fix-forward

Stream B repeatedly audits the **actual merged implementation** against the governing vision, decision records, architecture boundaries, scientific semantics, runtime behavior and user journey. Its loop is:

```text
merged implementation
        ↓
adversarial design/code/product review
        ↓
record concrete findings in this roadmap
        ↓
add the cheapest authoritative test that would have caught each defect
        ↓
fix forward on current architecture
        ↓
re-run authoritative gates
        ↓
review the result again
        ↺
```

Rules for Stream B:

- A merged PR may be reclassified from `COMPLETED` to `IMPLEMENTATION LANDED / REVIEW ACTIVE` when evidence does not support its acceptance claim.
- New findings become roadmap work immediately; they do not wait for the next planning cycle.
- Prefer fix-forward changes over reverting sound architectural progress.
- Every correctness bug gets a regression test at the owning layer.
- Every architecture mismatch gets an authority/boundary test where practical.
- **General production-path evidence rule:** a claimed product property is not `IMPLEMENTATION LANDED` merely because a helper, isolated module, mock, or unit test demonstrates it. When a property governs a production path, evidence must exercise the real production entry point and the authoritative call graph or boundary that is supposed to enforce it.
- The production-path evidence rule applies to security, correctness, scientific semantics, privacy/compliance, performance, recovery, concurrency, provenance, persistence and UX state. Unit tests remain necessary, but are not sufficient evidence for a shipped-capability claim.
- Every UX completion claim requires real product-path evidence, not only isolated class/integration tests.
- Every scientific representation claim must match the mathematics actually computed and the information actually preserved.
- Every concurrency/runtime completion claim must prove the production path, not merely the existence of an unused abstraction.
- Every scale claim must account for the full algorithm, including preprocessing, copies, index construction and repeated sweeps rather than only the newly optimized inner loop.
- Test acceleration must schedule and shard proof before reducing it: do not lower global coverage, delete authoritative tests, replace live-path evidence with mocks, or make changed-files-only selection the sole merge gate merely to improve latency.
- A gate becomes **VERIFIED COMPLETE** only after implementation and independent review evidence agree.
- Private-preview promotion requires convergence of all applicable streams, even though Stream A may continue ahead while Stream B and Stream C repair earlier tranches.
- After each Stream-B tranche: live-sync/check remote main, update this roadmap, adversarially review the resulting branch, then raise the PR. Do not rely on the PR review itself as the first adversarial pass.
- A failed Stream-B PR is closed, diagnosed and fixed forward from current remote state rather than kept alive as a long-lived broken branch.
- **Unknown is not neutral.** Missing analytical evidence must remain absent/unknown or explicitly prior/heuristic; it may not be replaced by convenient constants that look measured.
- **Durable names must match durable meaning.** Any field named fingerprint/digest used for provenance, package integrity or replay must be content-addressed and collision-resistant for the semantic object it claims to identify.

### Stream C — security authority and live-path assurance

Stream C is the dedicated security, privacy/compliance, supply-chain and hostile-boundary assurance lane. It exists to eliminate the recurring pattern where well-designed hardening code and green unit tests sit beside a different or weaker live production authority.

Its detailed work package is [`STREAM_C_SECURITY_ASSURANCE.md`](STREAM_C_SECURITY_ASSURANCE.md). Stream C uses the same RF ledger and completion vocabulary as Stream B, and inherits the general production-path evidence rule above.

Stream C operating principles:

- one authoritative security protocol/implementation per boundary;
- malformed, ambiguous, stale, replayed or unsupported claims fail closed;
- replay prevention is enforced at successful admission, not merely implemented in an unused verifier;
- attacker-controlled and privacy-sensitive properties are tested through the real ingress/call path;
- authenticated transport identity outranks duplicate identity claims embedded inside untrusted payloads; payload fields may be validated against the channel identity but must not become a second authority;
- upload hardening must preserve Rust/Atlas analytical and parsing authority rather than introduce a shadow JavaScript parser;
- compliance claims require actual retention/export/revocation/erasure lifecycle evidence;
- unnecessary third-party runtime trust is removed when the production bundle already owns the dependency;
- parser/unsafe/ABI assurance is driven by attacker-reachable behavior and fuzz/property evidence, not raw `unsafe`/`unwrap` counts alone;
- security/static-analysis remediation is **class-wide and threat-driven**: identify the asset/input/sink, trace the live authority, search for bypass/duplicate instances, distinguish vulnerabilities from robustness/maintainability findings, and close only after production-path falsification evidence. Do not chase scanner lines as if every use of the same primitive has the same risk.

### Status vocabulary

- **IMPLEMENTATION PARTIAL:** scaffolding or a bounded portion exists, but the planned production path is not yet landed.
- **IMPLEMENTATION LANDED:** planned code exists and passed its implementation gates.
- **REVIEW ACTIVE:** later review found unresolved defects, semantic gaps or insufficient acceptance evidence.
- **VERIFIED COMPLETE:** implementation plus independent review evidence satisfy the governing acceptance criteria.
- **DEFERRED:** intentionally not active because prerequisites are unmet.

## Active review/fix-forward ledger

| ID | Area | Severity | Finding | Required disposition |
| --- | --- | --- | --- | --- |
| RF-001 | P1-R / authority | High | `VRTopologyTranslator` still feeds `dataset.rows` into non-point embodiment, and aggregate/density/cluster reductions traverse O(N) rows/positions in TypeScript. Bounded mesh count is not the same as Rust-owned bounded analytical reduction. | Define Rust-owned bounded semantic embodiment payloads; make Three.js consume those payloads rather than derive analytical structure from raw rows. Integrate RF-045 so those payloads consume only measured/source-labelled evidence. |
| RF-002 | P1-R / scientific semantics | High | `DENSITY_FIELD` is currently a fixed 6×6×6 histogram over rendered positions while the ontology claims continuous density estimation; `DISTRIBUTION_FIELD` shares that geometry despite claiming quantiles/PDF/contours; cluster/manifold claims also exceed demonstrated semantics. | Reclassify candidate fidelity honestly and either implement the declared mathematics or narrow the ontology/preservation claims. RF-045 must remove fabricated signature values before this audit can close. |
| RF-003 | P1-R / correctness | High | Aggregate grid calculation treated legitimate numeric zero as falsy and substituted `1`, corrupting aggregate means. | **Fixed in #409**; preserve zero and retain regression coverage. |
| RF-004 | P1-R / tests | Medium | The C4 source guard sliced from `buildAggregateBars` to an earlier `buildDensityField`, producing an empty string and allowing a false pass. | **Fixed in #409**; source guard now proves non-empty method slices and inspects the intended branches. |
| RF-005 | P1-U / UX | High | The runtime still constructs a broad dashboard/panel constellation; `ContextualTaskSurface` is an action filter, not a colocated spatial task surface. | Execute P1-U4/P1-U8: implement selection-anchored contextual task controls, demote subsystem/panel-wall navigation and enforce the normal analyst persistent-surface budget. |
| RF-006 | P1-U / world semantics | High | TechnoCore's epistemic-instrument/product seam is implemented, but IceVault/Evidence Vault archival/recovery and semantic-portal behavior remain incomplete. | **IMPLEMENTATION PARTIAL / REVIEW ACTIVE:** P1-U5 wired TechnoCore guidance/alternatives/constraints/remediation and typed NIL remediation/replay. P1-U6 still must provide a real immutable archive/recovery function or remove/demote the persistent Vault, and portals must remain semantic travel rather than hidden analytical mutation. |
| RF-007 | P1-A/P1-C / analytical correctness & scale | **Blocker** | The shared columnar substrate stored invalid primitive slots as `0.0`, while TDA/PointCloud consumed value buffers without validity. Missing observations therefore became real Euclidean coordinates, capable of manufacturing distances, clusters and topology. | **Correctness landed in #426:** `PrimitivePointColumn` carries values + validity; metric/TDA eligibility is complete-case over selected features; row and columnar paths agree; real zero remains valid; TDA source-row identity survives compaction; K-means/hierarchical/DBSCAN use the same contract and excluded rows receive null cluster assignment. Remaining before verification: emit exact missing-data policy + excluded counts in TDA analytical provenance; RF-029 owns residual PointCloud compaction/copy cost; independent review/CI evidence must continue to agree. |
| RF-008 | P1-U / evidence | High | `investigator-journey-e2e.test.ts` manually advances phases and uses a kernel mock. It is useful integration coverage but not evidence of a real browser/XR investigator journey or usability outcomes. | Execute P1-U9 with an evidence ladder: real Playwright desktop product journey -> IWER immersive product-path journey for simulator-testable spatial/input invariants -> governed Quest 3S controller/hand qualification. Simulator evidence improves merge-time XR coverage but does not substitute for human usability, comfort or target-device performance evidence. |
| RF-009 | Roadmap governance | Medium | Roadmap status became stale and internally contradictory, with older main SHAs and completion claims coexisting with open checklist items. | Three-stream refresh process is in place, but RF-034 and RF-052 record residual status/gate truthfulness gaps. Treat governance as **REVIEW ACTIVE** until current-main markers, checklist state and branch-rule naming/behavior remain mechanically consistent across multiple tranches. |
| RF-010 | P1-B / production integration | High | #408 added `WorkerAnalyticalPort`, but production `World` did not install it. | **Fixed in #417**; installed `WorkerAnalyticalPort` on browser/XR startup and retained it across kernel replacement. |
| RF-011 | P1-B / generation authority | High | Async requests and supersession hard-coded generation 1. | **Fixed in #417**; real runtime generation is threaded through requests and supersession. |
| RF-012 | P1-B / failure semantics | High | Worker transport/runtime errors were converted into resolved null results. | **Fixed in #409**; failures reject through `KernelUnavailableError`; supersession remains non-error null. |
| RF-013 | P1-B / worker dataset authority | High | Worker handles are WASM-instance-local but requests attempted to rely on main-thread handle identity. | **Fixed in #417**; fingerprint-keyed generational registration is authoritative and foreign handles are not transferred. |
| RF-014 | P1-B / output identity | High | Async mutations previously assigned input identity to output. | **Fixed in #417**; worker returns a verified authoritative output fingerprint used by result and provenance. |
| RF-015 | P1-B / evidence | Medium | Existing parity evidence is inline/mock and does not prove real module-Worker + real-WASM scheduling/transfer behavior. | **Partially fixed in #417** by honest relabelling. Add a real browser module-Worker + real-WASM test and record dispatch/transfer/compute measurements. |
| RF-016 | P1-B / presentation adoption | High | Async Atlas methods were not used by production presentation consumers. | **Fixed in #417**; TDAPlanes/DataOperationController production paths use async execution with stale-result fences. |
| RF-017 | P1-C / substrate authority | High | #418 called PointCloud validity fixed by normalising missing values to numeric zero, preserving RF-007's scientific defect and losing source/local identity distinction if rows were excluded. | **Correctness fixed in #426:** PointCloud uses complete-case feature eligibility, retains `source_row_indices`, and downstream DBSCAN maps local results back to source observations. Owned compact PointCloud storage remains a scale concern under RF-029. |
| RF-018 | P1-C / sparse correctness | Blocker | Earlier high-dimensional grid enumeration could omit valid diagonal edges. | **Correctness fixed in #418** by full 3^d enumeration for d≤6 and exact fallback for d>6. RF-030 separately tracks the scale cliff introduced by that sound fallback. |
| RF-019 | P1-C / integration | High | Mapper did not consume the shared neighbourhood substrate. | **Fixed in #418**; Mapper bucket clustering uses PointCloud + Exact/GridSparse neighbourhoods. |
| RF-020 | P1-C / complexity | High | Betti-0 repeatedly replayed union work and performed an unbounded all-pairs maximum-distance prepass. | **Fixed in #418** for the claimed path: bounding-box diagonal for n>100 plus monotonic edge sweep. Resource-envelope review continues under RF-029/RF-030. |
| RF-021 | P1-C / evidence & modes | High | Landmark mode was advertised without an implementation and scale evidence used mocks. | **Fixed in #418** at implementation level with deterministic farthest-point landmarks and Rust tests. Approximation/end-to-end benchmark evidence remains part of RF-029/RF-030. |
| RF-022 | P1-D / measurement correctness | High | Perceptual sampling used wrong projection/depth/order semantics and treated zero-mark embodiments optimistically. | **Fixed in #416** with camera-relative projection, true median, deterministic bounded sampling, zero-mark rejection and stronger validation. |
| RF-023 | P1-D / evidence identity | High | Stale/cross-dataset perceptual evidence could affect hard constraints/ranking. | **Fixed in #419** by dataset/candidate/version/structural binding and fail-closed normalization. |
| RF-024 | P1-D / semantics & study governance | High | Frustum/crowding surrogates were overnamed and default ranking changed without frozen treatment governance. | **Fixed in #419** by surrogate-honest names/fidelity metadata and pinned `fitness-treatment-v1`. |
| RF-025 | P1-F / production integration | High | Semantic targeting/focus-context existed only in isolation. | **Fixed in #421** on the production picking/focus/Memory-Palace path. Physical XR evidence remains. |
| RF-026 | P1-F / resolver & state correctness | Medium | Resolver substring matching/coercion/restoration could produce incorrect focus behavior. | **Fixed in #416/#421** at code level; physical XR evidence remains before verification. |
| RF-027 | P1-E / provenance & constraint semantics | High | Actionable NIL remediation originally depended on human-message parsing and was not durable. | **Fixed in #420** for typed codes + durable remediation provenance. **Fixed in P1-U5**: investigator World/UX applies typed remediation through `_applyRemediation` → `recordRemediation` with `RemediationProvenance` including `requirementPatch` for replay; `reconstructRequirementsAndReArbitrate` rebuilds requirements from ledger. RF-047 additionally requires portable clean-room replay to reconstruct the non-mutating remediation event itself. |
| RF-028 | Scientific validity / temporal & spectral | **Blocker** | Spectral analysis ignored the supplied time axis and temporal trend regressed on observation rank. Irregular/gapped series could therefore receive false frequency, period, trend and seasonality evidence. | **Fixed in #428:** pairwise-complete time/value observations; sort by authoritative numeric/epoch time; trend regression over normalized actual timestamps; FFT only for positive regularly sampled time; duplicate/irregular/gapped series withhold spectral evidence; physical frequencies/periods/resolution/Nyquist in source time-coordinate units; unparsed temporal strings fail closed; canonical TypeScript evidence labels legacy periodicity scores as heuristics. Rust and transport tests cover row shuffle, time-unit rescale, gaps, duplicates, missing samples and row/columnar parity. **Review-active residual:** irregular-series spectral analysis remains deliberately unsupported until an explicit provenance-bearing resampling or Lomb-Scargle design is governed. |
| RF-029 | Scale / memory & resource envelope | **Blocker for 10M claim** | WASM is capped at 512 MiB while primitive resident storage uses f64 values plus validity and operations allocate additional point/transposition/output buffers. A generic “10M rows” claim is therefore false without dimensional/workload constraints; six numeric dimensions alone exceed the cap before runtime overhead. | **IMPLEMENTATION PARTIAL:** #429 landed the shared Rust budget vocabulary, saturating work estimates, row/PointCloud transient estimates, dense CSR accounting and canonical clustering preflight; #431 landed the canonical production TDA preflight and typed unsupported-at-scale bridge; #435 landed kernel-inline enforcement so direct/raw callers cannot bypass the envelope; the durable-refusal-provenance tranche landed kernel-authoritative `outcome: "refused"` provenance + a durable `RefusalProvenance` ledger event. RF-051 now explicitly adds JS-side full-row clones, spread/argument limits and DatasetSpace O(N) work to the same end-to-end resource envelope. Remaining: explicit 10M workload/device profile, complete resident+transient peak accounting across Rust + Worker + JS, streaming/chunking/validity compaction where justified, governed approximation provenance and measured peak-memory evidence. |
| RF-030 | P1-C / high-D complexity | High | RF-018's soundness fix makes `GridSparseIndex` fall back to exact all-pairs search for d>6. Large high-dimensional Mapper/neighbourhood workloads can therefore cross a silent O(N²d) performance cliff while nominally requesting sparse mode. | **IMPLEMENTATION LANDED / REVIEW ACTIVE:** #431 put the Rust-owned preflight on the canonical production path (complete-case validity, conservative source-row fallback, Mapper `bins`, Betti `steps`, dense CSR and duplicate output buffers; typed `UnsupportedAtScaleError`; real-WASM high-D boundary coverage); #435 made enforcement kernel-inline — the `data_compute_*` exports run the preflight themselves and refuse in-band via `{ unsupportedAtScale, preflight }`, so direct/raw callers cannot bypass the budget; the durable-refusal-provenance tranche made the refusal kernel-authoritative and durable (side-channel `outcome: "refused"` provenance, `RefusalProvenance` ledger event, sync+async durable recording, session round-trip; a refusal is not a kernel failure). Remaining: governed bounded approximation where useful, RF-047 portable replay evidence for refusal records, and measured workload/device evidence. |
| RF-031 | Operations / computational budget | High | User-callable hierarchical clustering repeatedly compares cluster/member pairs with cubic worst-case work; current naïve k-means++ seeding is O(N·D·K²) before the fixed Lloyd iterations and is cubic in the user-controlled K≈N worst case; DBSCAN can allocate a dense radius CSR. Worker execution protects frame responsiveness, not process memory/time. | **IMPLEMENTATION LANDED / REVIEW ACTIVE via #429:** the canonical serialisable operation bridge preflights K-means, hierarchical clustering and DBSCAN in Rust before expensive work and emits deterministic `UNSUPPORTED_AT_SCALE` metadata on refusal. Tests cover naïve k-means++ work, pathological hierarchical work, dense DBSCAN CSR risk and preserved small workloads. The durable-refusal-provenance tranche established the durable refusal-provenance pattern (kernel side-channel + ledger event) that generic-operation refusals can reuse. Remaining before verification: typed/durable cross-ABI refusal and provenance for generic operations, governed bounded alternatives where useful, direct/internal helper bypass review, and measured resource evidence. |
| RF-032 | Evidence classification / topology inference | High | Fuzzy substring hints, including single-letter GEO hints `x`/`y`, could classify ordinary schemas as geospatial and feed wrong downstream representations. | **Fixed in #428:** topology inference uses exact normalized aliases rather than substring matches; GRAPH requires source/target roles; GEO accepts numeric lat/lon only with observed range checks, explicit easting/northing projected coordinates, or exact numeric x/y only when corroborated by CRS/geometry metadata; vector aliases are exact; explicit investigator override remains authoritative. Adversarial tests cover `index` + `salary`, `total`-like graph false positives, bare x/y, invalid coordinate ranges and non-numeric lat/lon. Cross-layer authority convergence remains under RF-036. |
| RF-033 | CI evidence architecture | Medium | `playwright-smoke` depended on the monolithic correctness job, suppressing independent browser signal. | **IMPLEMENTATION ADVANCED:** #437/#438/#443 split proof tracks, shard Vitest coverage with merged global thresholds and remove duplicate coverage while retaining strict `Node 24` fan-in. Remaining: measure feedback/runner impact, keep product-path evidence independent, integrate RF-050/RF-052, and add an independent IWER simulator lane only after USIM scenarios are stable enough that emulator/tooling churn does not block unrelated work. Green CI must never imply physical Quest verification. |
| RF-034 | Roadmap governance | Medium | After RF-009 was declared fixed, the active ledger marked RF-018..RF-021 fixed in #418 while the P1-C review-exit checklist still showed all four unchecked. The roadmap could still tell two different completion stories. | Current refresh reconciles current-main/status summary and #465 RF-049 checklist progress. Extend documentation integrity checks to compare current remote-main markers/status summaries against checklist/RF state where mechanically possible; RF-052 separately governs branch-rule naming/approval truth. |
| RF-035 | P1-B/P1-A / large mutation transport | High | #417 fixed Worker input registration and output identity, but repeated mutation transport/materialisation and durable row snapshots remained browser-scale cliffs. | **IMPLEMENTATION PARTIAL / REVIEW ACTIVE:** #480/#481 RF-035A keeps same-generation mutation outputs Worker-resident; #483 RF-035B0 removes the controller's second result parse; #485/#486 RF-035B1 makes derived history/version navigation reference-backed and fixes branch-point materialisation; #487 RF-035B2A replaces full Worker → JS row-value transfer with authoritative row-ID views for verified edge-free `filter`/`sort`/`slice`; #488 RF-035B2B makes those verified results reference-backed in live durable result/event storage while preserving lazy schema-v2 materialisation. Remaining: graph/derived output transfer, session/package materialisation, handle-only/typed state and real browser/WASM transfer/heap/GC/device measurements under RF-015/RF-029/RF-051. |
| RF-036 | Evidence classification / authority split | High | Adversarial review found topology classification has multiple authorities: direct Rust topology inference, `DatasetStructureProfile` spatial classification and TypeScript `DatasetEvidenceSignature` precedence can disagree, including GEO/vector/time precedence and projected-coordinate evidence. Tightening only one classifier would leave contradictory Moneta evidence. | Converge topology/spatial evidence onto one canonical Rust-owned classification/evidence contract; make structure profile and Moneta consume that result rather than independently re-infer semantics. RF-045's truthful source/unknown contract is now landed and should be preserved. Add cross-layer parity tests for graph/hierarchy/GEO/projected/vector/time/tabular and adversarial ambiguous schemas. |
| RF-037 | Stream C / collaboration auth | **Critical** | Live signalling uses replay-permissive `SignedTicket.ts` while replay-safe `SignedTicketVerifier.ts` is off-path; the two implementations also expose incompatible ticket schemas and role ontologies. | Canonicalize one versioned ticket authority and prove second-use rejection through the real `createRoomRegistry().handleConnection()` admission path. Do not merely swap verifier imports; resolve schema, role, nonce-lifetime and deployment semantics and remove/migrate the duplicate authority. **Re-confirmed unchanged on 27 Aug at `main@a33ceb7`; #465 does not touch this path.** |
| RF-038 | Stream C / collaboration auth | High | Scoped token parsing promotes every suffix except exact `observer` to privileged `participant`, so malformed/typo roles fail open. | Exact-allowlist `observer` and `participant`; reject every other suffix and prove rejection through live room-registry admission tests. |
| RF-039 | Stream C / upload ingress | High | `UploadSanitizer` is isolated/tested but not the live FileLoader policy. Production has other defenses, so the primary defect is duplicated/orphaned hardening plus tests that prove the helper instead of the real upload call graph. | Consolidate policy without adding a shadow JS parser; adversarial JSON/CSV tests must traverse `FileLoader -> Atlas -> Rust -> Dataset`, including pre-read size, dangerous-key, shape and filename/control-character cases. **Re-confirmed unchanged on 27 Aug.** |
| RF-040 | Stream C / privacy & compliance | High | `TelemetryConsentManager` is off-path and its current design cannot substantiate GDPR-erasure claims: it retains raw subject IDs, uses a small fixed-salt pseudonym, and erases only an in-memory consent record rather than linked telemetry/traces/exports. | Inventory all retained/exported telemetry, design one authoritative consent/lifecycle model, and prove default-off/grant/revoke/export/erasure behavior end to end before making right-to-erasure claims. Do not simply wire the current helper in as-is. **Re-confirmed unchanged on 27 Aug.** |
| RF-041 | Stream C / supply chain | Medium | Shipped `index.html`/CSP retain an unpkg Three.js trust path even though Vite bundles `three` from `node_modules`. | Prove dev/production/smoke paths without the remote import map, then remove it and tighten `script-src` if no shipped path requires unpkg. **Re-confirmed unchanged on 27 Aug; GitHub Actions SHA pinning is a separate item already fixed by #443.** |
| RF-042 | Stream C / dev tooling | Low | UX trace terminal output interpolates client-controlled fields into ANSI-coloured logs without stripping terminal control sequences. | Strip/escape C0/C1/ESC control sequences before terminal presentation while preserving JSONL encoding; add ANSI/OSC regression coverage. |
| RF-043 | Stream C / Rust-WASM assurance | High | Raw `unsafe`/`unwrap` counts are not demonstrated vulnerabilities, but hostile-input evidence remains incomplete across attacker-reachable parser, typed-buffer and exported ABI boundaries. | Add targeted fuzz/property campaigns for malformed/truncated CSV/JSON, Unicode/numeric extremes, typed metadata/validity/shape mismatches, stale/foreign/overflowing pointer-length pairs and allocation/reinitialisation stress. Every discovered defect becomes a deterministic PR regression. |
| RF-044 | P1-A / data lineage & graph correctness | **Blocker** | Graph topology was silently lost across ordinary Dataset clone/Atlas transitions, and explicit edge semantics were incompletely preserved/recognized at the Rust boundary. | **IMPLEMENTATION LANDED / REVIEW ACTIVE via #453/#455:** lossless Dataset/Atlas/WASM graph transport, edge JSON typing, transform remapping, explicit-edge graph inference and real-WASM evidence were repaired. Preserve the regressions and complete independent merged-state review before `VERIFIED COMPLETE`. |
| RF-045 | P1-R/P1-D / analytical evidence truth | **Blocker** | `SignatureBuilder` filled missing analytical evidence with plausible constants/defaults and could translate weak structural hints into measured-looking facts. | **IMPLEMENTATION LANDED / REVIEW ACTIVE via AR-2:** `SignatureBuilder` legacy path no longer fabricates `clusterCount`, `hasHighVariance`, `numericSkew`, `hasCycles`; `DatasetEvidenceSignature` only sets `hasCycles` from explicit Rust graph cycle result; `BootstrapFitnessModel` checks epistemic source before treating cluster/highVariance/depth as favourable evidence; `investigator-declared` evidence source added. Adversarial falsification tests cover all AR-2 failure modes. Preserve canonical Rust evidence and re-review merged behavior before broader scientific/representation verification. |
| RF-046 | Investigation provenance / digest completeness | High | The SHA-256 investigation digest was cryptographically strong but its v1 preimage was a lossy semantic projection. | **IMPLEMENTATION LANDED / REVIEW ACTIVE:** v2 semantic digest (`sha256-canonical-investigation-v2`) commits per-entity canonical hashes for governed events/results/structures/observations/findings/annotations/representation state/discoveries/NIL/research context, excludes presentation-only/replay-volatile identity deliberately, and has mutation/tamper plus legacy-v1 compatibility coverage. Preserve this contract and add USIM-A presentation-independence evidence: identical semantic investigations replayed/restored under different XR poses/modalities/panel layouts must retain the same semantic digest. This is continuing conformance evidence, not a cryptographic redesign. |
| RF-047 | Investigation replay / non-mutating provenance | High | `InvestigationReplayRunner` currently counts `remediation`/`refusal` events as matched without reconstructing them in the replay Atlas ledger, then computes an investigation digest over the reconstructed state. Session round-trip tests do not prove portable clean-room replay of these events. | **IMPLEMENTATION LANDED / REVIEW ACTIVE:** Replay runner now reconstructs every durable non-mutating provenance event (remediation, refusal) in the replay Atlas ledger without re-executing the original action. After authoritative mutating operations are re-executed, the persisted semantic ledger is restored exactly (`evidenceLedger.restore`) preserving event order, payload, and provenance. Added `compareRemediationEvent`/`compareRefusalEvent` verification comparing event order, full payload (requirementPatch, constraintCode, preflight, etc.), and resulting `remediationEventsVerified`/`refusalEventsVerified` counts in `ReplayVerificationResult`. End-to-end tests for combined timelines pass; refusal-only/remediation-only test coverage added via clean-room replay contract tests. Add USIM-A cross-pose/cross-modality clean-room replay as product-path evidence that XR presentation state cannot alter semantic reconstruction. |
| RF-048 | Dataset identity / provenance semantics | High | Nemosyne had two materially different concepts named dataset fingerprint: canonical SHA-256 content identity in DatasetSpace/Rust and a weak `Dataset.fingerprint` derived from name/shape used in portable package/digest fields. | **IMPLEMENTATION LANDED / REVIEW ACTIVE via #463:** `datasetFingerprint`/`Dataset.fingerprint` now use the versioned canonical SHA-256 scientific identity; the old procedural hash is `seedHash`; TypeScript/Rust projection parity, graph identity, package v2 and explicit legacy-v1 replay compatibility are covered. Definitive #463 CI/CodeQL/coverage/browser gates passed before merge. Preserve the contract and complete independent merged-state review before `VERIFIED COMPLETE`. |
| RF-049 | P1-U1 / Direct Touch correctness & modality parity | High | The first #444 Direct Touch substrate lacked the governed explicit commit/release/recovery lifecycle and complete capture/modality semantics. | **IMPLEMENTATION LANDED / REVIEW ACTIVE via #465:** the explicit `FAR -> NEAR_HOVER -> CONTACT -> PRESS -> COMMIT -> RELEASE -> RECOVER` state model, non-drag panel capture and reference modality/capture adversaries landed. Preserve #465's code-level evidence; add IWER near/far/capture/cancel/tracking-loss adversaries through the real WebXR/InputRouter path as an intermediate simulator gate. Remaining broader U1/U9 work still includes centralized priority/panel-scene guarantees, feedback and physical Quest controller/hand qualification before product verification. |
| RF-050 | P1-U0 / UI substrate evidence | Medium | The UIKit benchmark used to justify P1-U0 adoption is a synthetic desktop/jsdom/WebGL-style loop. It measures init time, JS heap delta, scene objects, update timing and disposal counters but does not measure the roadmap-claimed Quest-relevant text legibility, draw calls, clipping, real scroll interaction, headset frame pacing or sustained GC behavior. | Reclassify the current benchmark as synthetic engineering evidence. Add real WebXR simulator evidence for clipping, scroll, panel reference-frame behavior, target acquisition and interaction recovery using representative production panels. Preserve Quest 3S as the authority for device draw calls/frame pacing/GC, through-lens legibility and sustained behavior under U9. Freeze the substrate only when synthetic + browser + simulator + physical evidence are explicitly distinguished and sufficient for the claim. |
| RF-051 | P1-A/P1-B / JavaScript scale cliffs | High | Even with Rust owning analytical work, browser preprocessing/registration/export paths can still create N-dependent copies, serialisation and transfer peaks before or after Rust's resource envelope. | **IMPLEMENTATION LANDED / REVIEW ACTIVE, NOT COMPLETE:** #472 removed spread/argument-count cliffs; #473 bound live DatasetSpace identity/ranges/lineage to authoritative metadata; #476 removed the duplicate live DatasetSpace row snapshot and eager post-mutation range scan; #479 corrected #478 by removing automatic row-backed → typed substitution from the shared Worker registration path, keeping row-backed operation-complete JSON while preserving explicit governed NTC1 inputs; #480 avoids redundant same-generation JS → Worker registration snapshots for resident mutation outputs; #483 removes the controller's second deserialisation of Atlas's committed result. Remaining: RF-035B canonical dataset-version/materialise-on-demand state, Worker → JS full-result reduction, handle-only/typed DatasetSpace projection, mixed/graph transfer without row-major JSON where justified, full resident+transient Rust+Worker+JS accounting, refusal-before-expensive-JS where possible, and measured browser/WASM/transfer/GC/device evidence. |
| RF-052 | Engineering governance / merge evidence | Medium | The active main ruleset is named as an approval gate but currently requires zero approving reviews; the separate Continuous Copilot Review ruleset is disabled. CI is meaningful and green, but branch-rule wording/behavior can imply independent review that is not actually enforced. | Decide the intended governance explicitly. Either require at least one independent approval for governed feature/semantic changes, or rename/document the rule so zero approvals is not presented as an approval gate and enforce independent Stream-B review at promotion instead. Keep automated review non-blocking if needed for cadence, but require resolved material review threads. Add a periodic ruleset/config check to RF-009/RF-034 so repository policy cannot silently drift from documented governance. |
| RF-053 | P1-W / production WASM deployment | **Blocker for preview / RE-VERIFY** | The 26 August audit found the generated WASM package absent from the published topology, but current `main@22ce66b` now runs `npm run wasm` before Vite and the active `wasmServePlugin` copies `wasm/pkg` into `dist/wasm/pkg`. The old missing-copy finding is therefore stale; deployment correctness is still unverified until the clean production artifact is exercised at the exact runtime URLs. | Re-run the production-wiring falsifier against a clean build/preview/Netlify-equivalent artifact. Verify JS glue + `.wasm` presence, exact `/wasm/pkg/...` URLs, MIME/hash/manifest expectations, kernel initialization and one authoritative analytical operation with no JS substitute. USIM-A then adds a clean-`dist` immersive WebXR smoke through real Worker + real WASM + visible spatial result/export; this is pre-deployment conformance, not proof of deployed services or Quest performance. If those pass, close or narrow RF-053 rather than preserving the superseded defect claim. |
| RF-054 | P1-W / production service wiring | High | Collaboration and the default demo live stream are constructed from the production `World`, but default to same-origin `/__signal` and `/__demo-stream`; those endpoints are implemented only by Vite dev/preview middleware. Netlify has no function, redirect or deployed service contract for either path. UI affordances can therefore advertise capabilities that have no production backend. | Decide the supported preview topology for each service. Deploy and route an authenticated signalling service and a governed live-stream source, or capability-gate/remove the corresponding production affordance. Close RF-037/RF-038/RF-057 on the actual deployed collaboration path; define health, timeout/retry, origin, rate-limit, observability and failure-state contracts; prove connection and explicit-unavailable behavior from a clean production bundle. |
| RF-055 | P1-W / capability and implementation hygiene | High | Several apparently finished systems are off the production call graph or only barrel-exported: replay-safe ticket verification, study/statistics and consent flows, `UploadSanitizer`, connector auth, command-buffer application, `CollaborativeStateSync`, shareable URLs, colour-palette logic, GitHub corpus ingest, fake Arrow parsing and custom serializer prototypes. This creates false assurance, duplicate authority and maintenance/security exposure. | Build a capability-to-entry-point inventory. For each item, either wire the governed implementation through a real product path with end-to-end evidence, replace hand-rolled protocol/statistics/security code with a maintained fit-for-purpose dependency where semantics permit, or delete/quarantine it from production exports and documentation. RF-037/RF-039/RF-040 remain authoritative for ticket, upload and consent security rather than simply wiring unsafe helpers. RF-058 governs class-wide validation of these decisions. |
| RF-056 | P1-W / release evidence | High | Current tests can prove helpers and dev middleware while missing the shape of the published artifact and its external service dependencies. There is no single promotion test that verifies the built frontend, WASM kernel, Worker path, advertised capabilities and required service boundaries together. | Add a production-wiring release gate: build from a clean checkout; validate artifact contents and hashes; serve only `dist`; initialize real WASM and a real module Worker; exercise a representative load/analysis/export/replay journey; test deployed or contract-faithful signalling/live-stream services; assert capability-hidden/explicit failure behavior when optional services are absent; record release provenance and rollback evidence. |
| RF-057 | Stream C / collaboration pose identity & framing | **Medium** | `NetworkManager._wireChannel(peerId, ...)` has a signalling-authoritative string peer identity, but binary pose replay/staleness validation is keyed by the untrusted numeric `pose.peerId` carried inside the frame. Because that numeric ID is a public deterministic compression of a peer ID, an admitted room peer can send another peer's numeric ID with a huge sequence and poison the receiver's global counter, causing later legitimate victim poses to be dropped. `BinaryPoseSerializer.deserialize()` also accepts buffers longer than the declared 40-byte frame and does not reject non-finite pose components. This is session-scoped cross-peer presence integrity/availability, not identity impersonation. | Move sequence ownership to the connection/peer lifecycle in `NetworkManager`, keyed by trusted string peer identity (and generation if needed); treat/remove the payload numeric ID as non-authoritative metadata and reject mismatches. Require exact frame length and finite bounded pose/quaternion values. Add production `_wireChannel` adversarial tests: A forges numeric(B)+`0xffffffff` yet B's next pose is accepted; duplicate/out-of-order same-peer frames fail; reconnect resets safely; 39/41-byte and NaN/Infinity frames fail closed; numeric-ID collisions cannot merge sequence state. Fold deployed-path proof into P1-W1/RF-054. After these authority fixes land, USIM-C may drive multiple authenticated simulated XR clients through the real path to falsify stale presence, reconnect and role-presentation behavior; simulator success cannot substitute for the security-boundary proof above. |
| RF-058 | Security validation / finding-class closure | **Medium** | Recent work confirms an instance-local remediation pattern: RF-030 found a resource guard that existed only in a wrapper until enforcement moved kernel-inline, while scanner-driven randomness changes improved synthetic demo generators but left a separate `Math.random()` shared-ID generator. The latter is not an auth vulnerability, but the mismatch demonstrates that fixing the cited line is not equivalent to evaluating the threat class, live sink, duplicate authority or bypass paths. | Require every security/static-analysis finding to identify asset, attacker-controlled input, production sink/authority and severity; search repository-wide for the relevant class and alternate/bypass implementations; distinguish vulnerability vs robustness/integrity vs maintainability vs false-positive; write a production-path falsifier for material risks; fix at the authoritative boundary; record deliberately accepted harmless instances. Start with RF-037/RF-039/RF-040/RF-057 and shared annotation/bookmark IDs. Apply this as review discipline, not a blanket blocker for harmless lint findings. |

## Adversarial remediation programme — 26 August 2026

This programme is the executable plan for RF-044 through RF-052. It deliberately reuses existing P1/RF ownership rather than creating a parallel architecture. Each tranche should normally be one focused PR, with the regression that would have caught the defect included in the same PR. A tranche is not complete merely because the immediate line of code is fixed: the production boundary and downstream semantic claim must also be proved.

### AR-1 — graph lineage integrity — RF-044 — **IMPLEMENTATION LANDED / REVIEW ACTIVE**

**Owning efforts:** P1-A Handle-native boundary, Gate 1 Dataset Evidence, P1-R representation truth.

- [x] fix `Dataset.clone()` so lossless clones preserve `edges`, edge weights/attributes, row IDs and scientifically relevant dataset metadata; explicitly document which metadata is presentation-only and may be omitted;
- [x] audit `Dataset.fromJSON`, `toJSON`, `AnalyticalState.loadDataset`, `advanceDataset`, `setCurrentDataset`, `restore`, async worker registration and kernel-result commit for the same topology-loss class;
- [x] ensure operations that intentionally transform/remove topology declare that semantic change rather than inheriting clone behavior accidentally;
- [x] verify canonical content identity changes when scientific edge content changes and remains stable under lineage-only row ID hydration;
- [x] add a graph fixture with weighted + attributed edges and duplicate-looking rows, then prove `Dataset -> Atlas -> Rust -> profile/topology -> Moneta` preserves edge semantics;
- [x] add a regression proving a one-edge acyclic graph remains a graph but is not reported as cyclic.

**Evidence:**
- `tests/dataset-graph-lineage.test.ts`: 6 tests covering clone, AnalyticalState transitions, kernel loader handoff, JSON round-trip, streaming replace/append edge remapping
- `tests/rf048-canonical-dataset-identity.test.ts`: 8 tests including "includes graph topology, edge attributes, and endpoint JSON type in scientific identity" and "excludes durable row lineage metadata from scientific identity"
- `tests/atlas-graph-lineage-wasm.test.ts`: 2 real-WASM integration tests verifying Rust receives identical edges, `inferTopology='GRAPH'`, `hasCycles=false`, canonical content identity preserved through kernel
- All tests pass in CI (297 total)

**Exit gate:** every lossless dataset copy/registration path preserves graph topology byte/semantically equivalently; Rust receives the same scientific graph Atlas loaded; the regression traverses the production boundary rather than only calling `Dataset.clone()`.

### AR-2 — truthful Moneta signature/evidence contract — RF-045 with RF-001/RF-002/RF-036 — **IMPLEMENTATION LANDED / REVIEW ACTIVE**

**Owning efforts:** Scientific validity, P1-R, P1-D, Gate 1/2/3.

- [x] inventory every `DatasetSignature` field and classify it as `measured`, `derived`, `prior`, `heuristic`, `investigator-declared` or `unknown`;
- [x] remove neutral-looking fabricated constants and make absent evidence structurally absent/unknown rather than numeric zero/0.5/etc.;
- [x] move N-dependent cycle, cluster-separation, density-variation, entropy/rank and related facts to Rust-owned evidence where they are actually required;
- [x] stop inferring `hasCycles` from edge presence/topology type; use an authoritative cycle result or unknown;
- [x] stop translating categorical cardinality into discovered cluster count/quality without an analytical clustering result;
- [x] source kernel/model versions from the actual runtime/provenance boundary rather than literals;
- [x] update Bootstrap/Learned Moneta feature handling so missing measured evidence cannot silently become a favourable score; any engineering prior is explicit, versioned and distinguishable from measurement;
- [x] add metamorphic/adversarial tests for acyclic graphs, sparse graphs, high-cardinality categorical columns, absent cluster/density evidence, schema renames and cross-layer Rust/TS parity.

**Evidence:**
- `SignatureBuilder.ts`: Legacy MonetaFacts path no longer fabricates `clusterCount`, `hasHighVariance`, `numericSkew`, `hasCycles`; analytical facts remain absent/unknown unless kernel Fats provided
- `DatasetEvidenceSignature.ts`: `hasCycles` only set when Rust `graph.hasCycles` explicitly provided; `graph` absence → `unknown`
- `BootstrapFitnessModel.ts`: `scoreStructure` checks epistemic source; `clusterStructure.hasClusters`, `distribution.highVariance`, `cardinality.depth` only count as favourable when epistemic source is `measured`/`derived`
- `DatasetSignature.ts`: Added `investigator-declared` to evidence sources
- `rf045-signature-evidence-truth.test.ts`: 12 tests including falsification tests for all AR-2 failure modes (legacy fabrication, cycle inference, categorical→cluster, FitnessModel baseline, sentinel depth, version sourcing)
- All tests pass in CI (297 total)

**Exit gate:** no Moneta ranking/hard constraint can consume a value that looks measured unless its source can be traced to authoritative evidence; unknown evidence remains unknown; candidate ordering changes caused by the former constants are reviewed rather than snapshot-updated blindly.

### AR-3 — one canonical scientific dataset identity — RF-048 — **HIGH**

**Owning efforts:** P1-A, reproducibility/provenance, Worker registration, `.nemosyne` format.

- [ ] designate canonical SHA-256 scientific content identity as the only `datasetFingerprint` allowed in durable/provenance interfaces;
- [ ] include name/schema/rows/edges and other governed scientific content under one canonical serialization contract; explicitly exclude lineage-only `rowIds` if that remains the intended invariant;
- [ ] rename/deprecate the current weak `Dataset.fingerprint` to an honest seed/cache concept and remove it from package manifests, replay verification and immutable dataset identity;
- [ ] reconcile Rust and TypeScript canonicalization with cross-language golden vectors, including object-key order, null/missing, numeric edge cases and graph edges;
- [ ] version package/digest compatibility if old packages carry weak identifiers; never silently reinterpret an old weak ID as a new cryptographic one;
- [ ] add tests where two datasets share name/rowCount/columnCount but differ by one value/edge and must receive different durable identities.

**Exit gate:** the word `datasetFingerprint` has one durable cryptographic meaning across Rust, Atlas, Worker, Moneta provenance, package export/import and replay.

### AR-4 — semantic investigation digest completeness — RF-046 — **IMPLEMENTATION LANDED / REVIEW ACTIVE**

**Owning efforts:** Reproducibility/investigation provenance and Gate 5 discovery.

- [x] define `CanonicalInvestigationInput` v2 as a documented semantic projection, not an ad hoc subset;
- [x] hash complete canonical command specifications/parameters and authoritative result/output/provenance identities;
- [x] hash observations, findings, annotations and their evidence/target links, not only counts or selected labels;
- [x] hash representation decision evidence/alternatives/provenance, DiscoveryEpisodes, NIL outcomes, remediation/refusal provenance and research context;
- [x] exclude camera/panel/theme/presentation state deliberately and test that those changes do not change the scientific digest;
- [x] prefer per-entity hashes and a deterministic ordered root where it reduces duplication while preserving tamper sensitivity;
- [x] add one-field-at-a-time tamper/property tests and old-schema compatibility tests.

**Exit gate:** changing any governed semantic fact changes the digest; changing presentation-only state does not; the contract is versioned and documented strongly enough for third-party verification.

### AR-5 — portable non-mutating event replay — RF-047 with RF-027/RF-030 — **IMPLEMENTATION LANDED / REVIEW ACTIVE**

**Owning efforts:** Reproducibility/provenance, P1-E NIL, P1-C refusals.

- [x] make clean-room replay reconstruct refusal/remediation ledger events in original order without re-executing the refused computation/remediation side effect;
- [x] compare complete event payload/provenance identities, not merely increment `eventsMatched`;
- [x] export + unpack + replay packages containing refusal-only, remediation-only, both event kinds interleaved with analysis, and tampered variants;
- [x] assert final ledger, event count/order, evidence counts, representation/NIL state and investigation digest all agree;
- [x] ensure legacy packages without these event kinds remain compatible and fail clearly on unsupported future schemas.

**Exit gate:** a `.nemosyne` archive containing refusal/remediation provenance clean-room replays to the same semantic digest and tampering is detected.

### AR-6 — complete end-to-end resource envelope — RF-051 with RF-029/RF-035 — **HIGH**

**Owning efforts:** P1-A/P1-B/P1-C, PERF-04/PERF-05.

- [x] remove `Math.min(...values)`, `Math.max(...values)`, `push(...largeArray)` and equivalent spread/argument-count hazards from the identified large-N Dataset paths (#472);
- [/] audit Dataset/DatasetSpace/worker registration/session/package paths for full-row cloning, `map`/`Array.from`, JSON serialization and hash work that scales with N on the main thread; #473/#476 removed live DatasetSpace re-derivation/duplication, #479 restored operation-complete Worker registration semantics, #480 removed the redundant same-generation JS → Worker registration snapshot, #483 removed the controller result reparse, #485/#486 made derived history/version navigation reference-backed, and #487 compacted verified row-preserving Worker results; durable result/session/package duplication plus graph/derived transfer remain open;
- [x] expose and consume Rust-owned live ranges/identity/row-lineage evidence for DatasetSpace instead of recomputing those facts in JS (#473/#476);
- [ ] make handle-only/typed datasets usable without reconstructing a row-major DatasetSpace merely for identity/normalization metadata;
- [x] prevent same-generation resident mutation outputs from boomeranging through an O(N) JS → Worker registration snapshot (#480/#481);
- [x] make production operation coordinators reuse Atlas's committed mutation Dataset instead of independently deserialising the same result (#483);
- [x] establish canonical dataset-version state so derived history/navigation can reference authoritative identity without eager historical row reconstruction (#485/#486);
- [/] bound or explicitly export large transformed data rather than returning/materialising full Worker → JS `DatasetJSON` by default; #487 lands the verified edge-free row-preserving transfer slice, while RF-035B2B/durable state plus graph/derived operations remain;
- [ ] measure browser JS heap, WASM resident/transient memory, transfer bytes, GC pauses and wall time for each supported workload profile;
- [ ] refuse unsupported workloads before expensive JS preprocessing where possible, with the same durable actionable refusal semantics.

**Exit gate:** supported-scale claims account for the entire browser/WASM pipeline, including pre-Rust and post-Rust work, and representative boundary tests do not rely on argument-count-sensitive spread operations or hidden O(N) rematerialisation.

### AR-7 — repair P1-U1 Direct Touch semantics — RF-049 — **HIGH**

**Owning efforts:** P1-U1, then P1-U2/U3/U4 consumers.

- [x] land the explicit governed `FAR -> NEAR_HOVER -> CONTACT -> PRESS -> COMMIT -> RELEASE -> RECOVER` lifecycle (#465);
- [ ] finish/verify central modality priority `captured manipulation > direct touch > direct grab > controller-tip direct > distance ray > mouse > dwell fallback` as one arbitration contract and prove no duplicate dispatch;
- [x] capture the exact target/component for non-drag UI interactions and route move/up/cancel to it (#465);
- [ ] finish visual proximity/contact/commit feedback and optional audio/haptics without treating simulated pressure as a scientific signal;
- [x] add reference modality/capture tests including near/far, capture, commit/recover and double-activation adversaries (#465);
- [ ] obtain IWER simulator evidence for the RF-049 near/far/capture/cancel/recover adversary matrix through the real WebXR/InputRouter path;
- [ ] obtain physical Quest controller/hand evidence under U9 before product verification.

**Exit gate:** automated production-path tests prove modality-equivalent semantic output and no double activation; #465 provides the code-level RF-049 repair, while U1 remains review-active until remaining centralized arbitration/product-path checks and physical Quest controller/hand evidence agree.

### AR-8 — honest P1-U0 substrate evidence — RF-050 — **MEDIUM**

**Owning efforts:** P1-U0, UX-05, P1-U9.

- [ ] retain the current UIKit benchmark as a synthetic microbenchmark and label its evidence tier/limitations explicitly;
- [ ] extend the benchmark to record actual renderer draw calls/triangles/textures, clipping/scroll behavior, allocation/GC and representative panel update cost in the production build;
- [ ] define angular text-legibility and target-size checks from the design-system tokens and validate them at governed viewing distances;
- [ ] compare representative old/new surfaces, not ten identical toy panels only;
- [ ] collect Quest 3S frame pacing, draw calls, memory, scroll/direct-touch behavior and legibility evidence under U9 before declaring the substrate choice frozen;
- [ ] if UIKit misses the device budget, optimize behind Nemosyne wrappers or revisit the dependency without changing semantic/UI authority.

**Exit gate:** UIKit remains an implementation choice only because measured production/device evidence supports it, not because the synthetic benchmark merely ran successfully.

### AR-9 — governance claims match enforcement — RF-052 with RF-009/RF-034 — **MEDIUM / PARALLEL**

**Owning efforts:** engineering governance and CI evidence architecture.

- [ ] decide whether main truly requires an approving review; if yes, set `required_approving_review_count >= 1` for the governed branch rule, preserving an explicit emergency/risk-acceptance process rather than hidden bypass;
- [ ] if zero approvals is intentionally retained for velocity, rename/document the ruleset so it does not claim an approval gate and require independent Stream-B review before `VERIFIED COMPLETE`/promotion rather than before every merge;
- [ ] keep review-thread resolution enforced and restore/replace Continuous Copilot Review only if it adds signal without making automated comments a cadence bottleneck;
- [ ] add a lightweight repository-governance check/report that compares intended required checks/review policy with the live ruleset;
- [ ] keep `Node 24` aggregate CI and CodeQL as necessary engineering gates while explicitly distinguishing them from scientific/UX/device verification.

**Exit gate:** repository policy, ruleset names, roadmap claims and actual enforcement tell the same story; green CI cannot be mistaken for independent review or device/scientific verification.

### Cross-tranche sequencing and parallelism

1. **AR-1 RF-044** landed at implementation level; preserve its graph-lineage regressions and merged-state review discipline.
2. **AR-2 RF-045** landed at implementation level; RF-036/RF-001/RF-002 remain the downstream evidence/representation convergence work.
3. **AR-3 RF-048, AR-4 RF-046 and AR-5 RF-047** have implementation landed and remain review-active; preserve their identity/digest/replay regressions rather than treating them as the current implementation frontier.
4. **CURRENT: AR-6 RF-051 with RF-029/RF-035**, plus residual RF-030/RF-031 resource/refusal work. #485/#486/#487 land version-reference history and the first compact Worker-result slice; RF-035B2B now removes retained row-value duplication from verified row-view results before the real browser/Worker/WASM envelope is measured.
5. **P1-USIM + AR-7 RF-049 + AR-8 RF-050** belong to the parallel XR convergence/evidence stream: IWER supplies both interaction evidence and the USIM-A architecture-conformance tier for lifecycle, persistence, reference-space and clean-artifact invariants; physical Quest remains the promotion authority for device-dependent evidence.
6. **AR-9 RF-052** is independent governance work and can run in parallel with all technical tranches.
7. **RF-057** joins Stream C immediately after RF-037/RF-038 because collaboration admission and channel-bound presence identity should be reviewed as one trust boundary; **RF-058** runs in parallel as the finding-class validation discipline applied to all security tranches.
8. After each tranche: sync current `main`, rebase/fix forward, run the cheapest authoritative regressions plus required CI, adversarially inspect the merged result, and update the RF row/status. Do not close several RFs merely because one broad PR is green.

## Core architecture state

Nemosyne has exited the Draco-to-Moneta authority migration and is in private-preview preparation, subject to the review findings above. The governing architecture remains:

1. Rust/WASM owns canonical analytical data, N-dependent computation, analytical facts and data-derived layout/reduction.
2. Moneta owns bounded representation reasoning over compact evidence and investigator semantics.
3. TypeScript/JavaScript owns orchestration, persistence, presentation and interaction, not an independent analytical implementation.
4. Atlas owns investigation orchestration and durable analytical handles.
5. Draco is compatibility surface only. Production code imports Moneta directly.
6. `.nemosyne` preserves investigation, representation/model identity, analytical provenance, discoveries and NIL outcomes, subject to RF-046/RF-047 completion before strong cryptographic/replay claims are verified. RF-048 canonical dataset identity has landed.
7. Learned Moneta remains explicit, pinned, reversible and opt-in until held-out investigator/discovery outcomes demonstrate benefit.

## What has landed

### Scientific and learning foundations

The #249-#264 sequence established immutable FitnessModel artefacts, explicit promotion/activation separation, frozen candidate feature evidence, pairwise judgement infrastructure, exact learned-model pinning, grouped held-out evaluation, durable row identity and stronger measurement/geometry contracts.

Remaining scientific work is outcome-facing plus RF-036/RF-001/RF-002 convergence on top of the landed RF-045 truth contract: measurement-type enforcement, discovery-quality validation, calibrated statistical claims where appropriate, falsification workflows and investigator-facing skepticism support.

### Rust-owned data plane and scale architecture

The #305-#312 migration wave established Rust-resident columnar authority and removed the previous mirrored JS/Rust row-major model from the critical data path. Current scale invariants are:

- source row count is decoupled from rendered primitive count;
- Moneta candidate and sensitivity work is bounded;
- canonical Moneta reasoning does not traverse raw rows;
- no large-data failure may trigger an expensive JavaScript analytical fallback;
- analytical provenance must state any approximation or reduction mode;
- RF-051 now requires those invariants to include JS-side preprocessing/transport, not only Rust kernels.

Typed-column ingest, exact canonical identity, primitive-column storage and row-free DatasetStructureProfile evidence have been demonstrated. #426 corrected missing-value metric geometry; #429 landed the first shared resource-envelope enforcement on canonical clustering operations; #431 landed the canonical production TDA preflight; #435 made that enforcement kernel-inline so direct/raw callers cannot bypass the budget. RF-029/RF-030/RF-031/RF-035/RF-051 govern the remaining resident-memory, resource-provenance, high-dimensional, large-mutation and browser-side scale gaps.

### Moneta authority convergence

The #315-#342 sequence completed the Draco-to-Moneta production authority migration:

- Rust owns analytical facts and canonical data-derived evidence;
- production Draco imports collapsed to Moneta;
- hard constraints precede learned ranking;
- row-order/rename/duplication/scale metamorphic and provenance contracts are live;
- production Atlas/Moneta facts consume validated Rust evidence;
- utility is not labelled confidence;
- clean-room replay verifies authoritative decision/evidence composition;
- learned ranking remains explicit and pinned.

The migration authority remains complete. RF-045's evidence-truth implementation landed in #461; product embodiment, temporal validity, topology-authority convergence, perceptual-evidence and remediation correctness remain separately governed by active review findings.

### Reproducibility and investigation provenance

The #324-#332 sequence substantially advanced the portable provenance chain:

- analytical replay verifies operation provenance and output identity;
- representation/model identity survives embodiment and `.nemosyne` export/import;
- DiscoveryEpisode records persist portably;
- NIL/no-feasible-representation is a typed reproducible outcome;
- discovery/NIL/model/evidence drift fails closed during replay.

#420 adds typed durable remediation provenance at the aggregate/ledger layer and #439 adds durable refusal provenance. #463 landed canonical cryptographic dataset identity (RF-048); #478 landed the RF-046 v2 semantic digest and RF-047 clean-room reconstruction/verification of durable refusal/remediation events. These are **IMPLEMENTATION LANDED / REVIEW ACTIVE** foundations, not yet permission to call portable investigation integrity `VERIFIED COMPLETE`.

### Runtime ownership, ABI resilience and recovery

PRs #365-#366 established explicit World lifecycle ownership, generation-fenced recovery, RuntimeBridge ABI-family separation and focused coordinator/application boundaries.

The #375-#384 hardening wave then materially closed the available RES-01/SEC-02 code-executable gaps: tracked host-buffer ownership, exact two-call output contracts, stale-handle rejection, generation revocation, repeated recovery, unsafe-surface inventory and malformed-input campaigns.

Long-running fuzz/Miri/device endurance remain explicit evidence lanes rather than ordinary PR blockers.

### Collaboration resilience and authority

The #385-#389 sequence materially closed the available RES-02 browser/runtime gaps: bounded reconnect, multi-context WebRTC recovery, role-authority preservation, stale transport protection, deterministic offer ownership and server-owned peer lifecycle.

Cross-device/hostile-network qualification remains preview hardening. Stream C owns RF-037/RF-038 live authentication authority and now **RF-057 channel-bound pose identity/framing**. The trusted data-channel peer identity must own replay/staleness state; embedded numeric IDs are never a second authority.

### P1-A typed/columnar TDA implementation

#395 closed production JS TDA rematerialisation; #405 enabled typed/columnar-only handles to execute persistence, Mapper and Betti-0 directly in Rust with `ingestMode` provenance and real-WASM boundary tests. #423 introduced the shared point-access substrate; #426 corrected missing-value semantics via complete-case eligibility and source-row mapping; #431 added the Rust-owned canonical production TDA preflight and typed unsupported-at-scale bridge outcome; #435 made the resource envelope kernel-inline so direct/raw callers cannot bypass it. #453/#455 repaired graph lineage/explicit-edge semantics; #463 converged canonical identity.

This remains **IMPLEMENTATION LANDED / REVIEW ACTIVE** until policy/exclusion/resource-refusal metadata is durable in analytical provenance, residual scale work is bounded by RF-029/RF-031/RF-051, CI evidence is clean and independent review agrees.

### P1-B async execution implementation

#408 established first-pass execution-port types and #417 completed the known production registration/generation/output-identity/adoption fixes. P1-B is now **IMPLEMENTATION LANDED / REVIEW ACTIVE** primarily for RF-015 real Worker/WASM evidence, RF-035 large mutation transport and RF-051 browser-side large-N materialisation, not because the known #408 plumbing defects remain.

### P1-C through P1-F first-pass implementation

#410-#413 established sparse-neighbourhood, perceptual-fitness, semantic-target/focus-context and actionable-NIL components. Stream B fixes through #416/#418/#419/#420/#421/#426 materially improved them. #429 added operation resource guards and #431 added canonical production TDA/high-dimensional enforcement. They remain **IMPLEMENTATION LANDED / REVIEW ACTIVE** until their residual scientific, scale, provenance and physical-product evidence exits are met. RF-045's implementation has landed; downstream representation/evidence authority review remains.

### Test architecture and feedback latency

The test pyramid is split by ownership:

```text
Playwright / WebXR smoke         small, expensive, user-path focused
TypeScript UI/integration        orchestration and presentation only
WASM boundary tests              small ABI/provenance seam
Rust unit/property/metamorphic   exhaustive analytical authority
```

The execution strategy is governed by [`CI_TEST_ACCELERATION_STRATEGY.md`](CI_TEST_ACCELERATION_STRATEGY.md): **accelerate scheduling before reducing proof**. #437/#438/#443 parallelized independent CI tracks, added sharded Vitest coverage with merged global thresholds and removed duplicate coverage work without deleting authoritative tests. #443 also pins GitHub Actions to immutable commit SHAs and mechanically rejects mutable action refs. RF-052 governs the distinction between a green engineering gate and independently reviewed/verified completion.

Remaining efficiency work:

- [ ] collect representative before/after timings for the RF-033 parallel CI graph: time-to-first-failure, required-gate wall time and total runner minutes;
- [ ] profile Vitest by measured duration and capability requirements;
- [x] shard the full deterministic suite with merged global coverage and existing thresholds (#438);
- [ ] reclassify mixed suites so only actual kernel boundaries pay WASM startup;
- [ ] port/delete remaining duplicate JS assertions for Rust-owned mathematics once equivalent Rust coverage is proven;
- [ ] add Rust-side performance benchmarks separately from deterministic correctness gates;
- [ ] document steady-state test/authority ownership in contributor and agent guidance;
- [ ] systematically audit source/architecture tests for vacuous or false-positive guards, following RF-004;
- [ ] distinguish mock/inline tests from real Worker/WASM/browser/device evidence in names and roadmap claims;
- [ ] require scale tests to exercise the real algorithm/mode being claimed, not a mock bridge that returns a shape-compatible result;
- [ ] keep security, scientific-semantics, provenance, parser-boundary, worker-lifecycle and production-path regressions PR-blocking even when extended fuzz/soak/performance campaigns move to scheduled evidence lanes.

## Governing V3 gate status

| Gate | Status | Remaining exit work |
| --- | --- | --- |
| 0 — Authority reconciliation | **MIGRATION EXIT COMPLETE / REVIEW MONITORED** | Maintain architecture guards; remove Draco facade only through a governed compatibility decision. |
| 1 — Dataset Evidence | **MIGRATION AUTHORITY COMPLETE / SCIENCE ACTIVE** | RF-044/RF-045 implementations have landed; finish RF-007 provenance semantics, RF-036 cross-layer authority convergence and residual measurement/resource review before verification. |
| 2 — Representation Language | **PARTIAL / REVIEW ACTIVE** | Close RF-001/RF-002 and downstream RF-036 review on the truthful RF-045 evidence contract before composition. |
| 3 — Moneta correctness | **MIGRATION EXIT COMPLETE / PRODUCT REVIEW ACTIVE** | Re-review the landed RF-045 evidence contract with RF-001/RF-002/RF-036 and upstream resource constraints before representation ranking is considered scientifically trustworthy. |
| 4 — NIL | **IMPLEMENTATION LANDED / REVIEW ACTIVE** | Typed remediation is wired through the investigator path and RF-047 clean-room replay has landed; retain adversarial merged-state/product evidence before verification. |
| 5 — Discovery | **INFRASTRUCTURE ADVANCED / REVIEW ACTIVE** | RF-048 identity plus RF-046/RF-047 semantic digest/replay implementations have landed; finish merged-state review, falsification workflows, outcome evidence and controlled discovery-quality studies. |
| 6 — Human refinement | **IN PROGRESS** | Expand outcome events, curation policy and study coverage. |
| 7 — Learning infrastructure | **ADVANCED** | Add outcome-linked evaluation and operational monitoring evidence. |
| 8 — Learned Moneta | **EARLY OPT-IN / NOT EMPIRICALLY VALIDATED** | Demonstrate held-out investigator/discovery benefit before considering default use. |
| 9 — Compositional Moneta | **DEFERRED** | Wait for RepresentationGraph/grammar maturity, bounded search and Gate 0-8 evidence. |
| 10 — Adaptive Nemosyne | **DEFERRED** | Requires validated learning, freeze controls, monitoring, rollback and longitudinal evidence. |

## Pre-P1 promotion ledger

The detailed audit evidence remains in `PRE_P1_SYSTEMATIC_AUDIT.md`. The roadmap interpretation is:

- [ ] **PERF-04 / blocker:** run and govern physical Quest 3S 10M browser qualification, using the explicit RF-029/RF-051 qualification profile rather than an unbounded “10M arbitrary dimensions” claim.
- [x] **ARCH-01 / high:** Atlas/runtime/spatial ownership boundaries are explicit and guarded; Stream B audits implementation conformance continuously.
- [x] **ARCH-02 / high:** World/UI/kernel lifecycle ownership and recovery are explicit and idempotent.
- [x] **PERF-03 / high:** production scene selection uses measured BVH crossover behavior; physical crossover validation remains under PERF-04.
- [x] **UX-02 / high:** real-browser desktop investigation/replay/tamper journey is covered, with RF-046/RF-047 now requiring stronger portable semantic integrity before the broader reproducibility claim is verified.
- [ ] **UX-03 / high:** execute controller, hand and desktop semantic-parity tasks on physical hardware; #465 provides the RF-049 code-level repair but physical evidence remains required.
- [x] **RES-01 / high, code-executable scope:** checked output, host allocation ownership, malformed handles and sustained generation recovery are covered. Device/endurance residuals remain evidence lanes.
- [x] **RES-02 / high, browser scope:** partition/reconnect/state convergence/role violation and server-owned lifecycle authority are covered through #389. Cross-device/hostile-network residuals remain preview hardening; RF-057 adds a concrete channel-bound pose integrity defect.
- [x] **SEC-02 / high, deterministic CI scope:** unsafe inventory plus bounded malformed parser/buffer/handle/exhaustion campaigns are covered. Long-running fuzz/Miri remain separate hardening lanes; RF-043 adds targeted hostile-boundary fuzz evidence without treating raw unsafe counts as vulnerabilities.
- [ ] **MAINT-01 / high:** continue removing `@ts-nocheck` from package, bridge, World and Moneta boundary tests.
- [ ] **PERF-05 / medium:** profile allocations/GC and sustained analytical scheduling across representative interactions, including RF-051 JS preprocessing/transfer; add USIM-A repeated XR enter/exit/load/save/restore lifecycle so listener/object/Worker/heap growth is measured as leak evidence, while absolute device budgets remain PERF-04/Quest evidence.
- [ ] **UX-04 / medium:** expose command availability and disabled reasons in every input modality.
- [ ] **UX-05 / medium:** RF-050 reclassifies the current UIKit-vs-canvas benchmark as synthetic evidence; complete production-renderer and Quest legibility/draw-call/scroll/clipping/frame-pacing qualification before freezing the substrate decision.
- [ ] **UX-06 / medium:** fix the 390 px header collision and add reduced-motion, focus, contrast and local-font resilience without changing public visual identity.
- [ ] **MAINT-02 / medium:** replace weak generic assertions in blocker/high-path tests with exact contracts.
- [ ] **MAINT-05 / medium:** classify/reduce lint-warning debt and enforce a non-increasing budget.
- [ ] **MAINT-06 / medium:** eliminate Rust warning debt, governing fingerprint-affecting changes as provenance migrations.
- [ ] **DOC-03 / medium:** remove remaining investigator-facing Draco terminology while retaining the compatibility facade.
- [ ] **GOV-01 / medium:** close RF-052 so branch-rule names/documented review requirements match actual GitHub enforcement.

## P1 — Analytical responsiveness and spatial fitness

**ACTIVE.** Detailed analytical acceptance criteria and dependency order are in [`P1_ANALYTICAL_RESPONSIVENESS_AND_SPATIAL_FITNESS.md`](P1_ANALYTICAL_RESPONSIVENESS_AND_SPATIAL_FITNESS.md). PR #402's design records remain implementation specifications where review evidence has not invalidated them.

### P1-A Handle-native analytical boundary — IMPLEMENTATION LANDED / REVIEW ACTIVE

Landed implementation evidence:

- [x] tested handle-native TDA entry points and Atlas routing;
- [x] no production JS `Dataset.toJSON()` TDA round trip;
- [x] typed/columnar-only handles execute persistence, Mapper and Betti-0 through real WASM;
- [x] typed-vs-row ingest mode is recorded in provenance;
- [x] #426 carries primitive validity and uses complete-case selected-feature eligibility rather than missing→0 geometry;
- [x] source row identity is preserved through TDA point compaction;
- [x] RF-044 graph lineage/explicit-edge transport implementation landed through #453/#455;
- [x] RF-048 canonical dataset identity implementation landed in #463.

Review exit work:

- [ ] complete independent merged-state review of RF-044/RF-048 before `VERIFIED COMPLETE`;
- [ ] **RF-007 provenance:** record exact missing-data policy, source count, eligible count and excluded count in TDA operation provenance;
- [ ] **RF-029/RF-030/RF-051 scale:** preserve kernel-inline resource enforcement while removing JS-side argument/copy cliffs and measuring the complete browser/WASM envelope;
- [ ] re-run authoritative CI + adversarial review before `VERIFIED COMPLETE`.

## P1 — Product convergence gates

### P1-R Representation embodiment convergence — IMPLEMENTATION LANDED / REVIEW ACTIVE

Landed first-pass work includes distinct aggregate/density/cluster geometry, bounded visible primitive counts, executable single-winner graph metadata, and RF-003/RF-004 fixes. RF-045's truthful evidence contract landed in #461.

Review exit work:

- [ ] **RF-001:** move N-dependent aggregate, density, cluster and compatible reduction/layout into Rust-owned bounded semantic payloads;
- [ ] make Three.js a thin embodiment adapter over those payloads rather than an analytical reducer over rows;
- [ ] **RF-002:** re-audit candidate `supports`/`preserves`/`loses` and descriptions against actual mathematics;
- [ ] **RF-036:** converge topology/spatial classification onto one canonical Rust evidence contract so truthful source labels cannot still disagree across layers;
- [ ] implement or honestly downgrade overclaimed density/distribution/cluster/manifold/multiscale candidates;
- [ ] record exact reduction/estimation/layout method and parameters in provenance;
- [ ] demonstrate mathematically faithful, visibly/interactively distinct alternatives before P1-D ranking is product-valid.

### P1-U Whole-product investigation UX convergence — IMPLEMENTATION PARTIAL / REVIEW ACTIVE

Landed first-pass work includes the 10-phase journey model, coordinator, task-surface policy, TechnoCore state model, semantic targeting/focus-context foundations, body-locked panel treatment, task-oriented HandWheel treatment, and integration coverage. #444 added the first UIKit/SpatialPanel and near-field substrate, #462/#464 advanced P1-U3 commodity precision surfaces and panel lifecycle, and #465 lands the code-level RF-049 state/capture repair. RF-050 and remaining device/product-path evidence still govern U0/U1 verification.

**Normative implementation guide:** [`Nemosyne_VR_UI_Design_System_and_Agent_Spec.md`](Nemosyne_VR_UI_Design_System_and_Agent_Spec.md). The guide defines the target interaction grammar, visual system, spatial reference frames, component contracts, Direct Touch behavior, accessibility/comfort constraints, performance rules and agent acceptance gates. The roadmap below turns that specification into bounded implementation tranches.

**Programme rule:** one tranche or a tightly coupled sub-tranche should be the normal PR unit. Preserve `InputRouter` as input-orchestration authority, Atlas/investigation as semantic/provenance authority, Rust/WASM as analytical authority and Three.js as spatial embodiment. UIKit or any pointer library may provide rendering/event mechanics but must not become a second semantic command authority. P1-U becomes `VERIFIED COMPLETE` only after P1-U0 through P1-U9 are complete, RF-005/RF-006/RF-008/RF-027/RF-050 are closed, RF-049's merged code remains review-valid, and physical Quest evidence agrees.


#### P1-USIM — WebXR simulator substrate and golden spatial scenarios — PLANNED ENABLER

Purpose: make simulator-testable XR behavior repeatable during ordinary UI development without turning physical Quest testing into a per-PR bottleneck or introducing a second semantic/input authority. Governing review: [`review-plans/XR_SIMULATOR_STREAM_INTEGRATION_REVIEW_2026-08-28.md`](review-plans/XR_SIMULATOR_STREAM_INTEGRATION_REVIEW_2026-08-28.md).

Tool decision: **IWER is the preferred WebXR simulator** because it drives the browser WebXR surface Nemosyne actually ships. Meta XR Simulator remains an optional OpenXR/compositor comparison adapter; do not introduce Unity/Unreal/native wrapping merely for verification.

**USIM-0 — simulator adapter and evidence boundary**

- [ ] add a dev/test-only IWER adapter; prove no simulator/dev-UI dependency is reachable from the production bundle;
- [ ] route simulated controller/hand/head input through the real WebXR -> InputRouter path, never directly to NIL/Atlas or component callbacks;
- [ ] map the useful `WebXR6DoFPoseRig` presets into scenario fixtures rather than maintaining a separate mock WebXR runtime;
- [ ] retain `SpatialErgonomicsLinter` as the measurement layer and connect simulator runs to bounded `XREvaluationEpisode` evidence (`environment.mode = desktop-simulator`);
- [ ] fail unsupported simulator capabilities explicitly rather than fabricating success.

**USIM-A — architecture conformance pack**

Purpose: use deterministic XR fault injection to attack cross-layer invariants that ordinary unit mocks can miss, without allowing XR presentation state to become a second analytical or persistence authority.

- [ ] **XR lifecycle / async race:** enter XR -> begin real async analysis -> input source disappears or session visibility changes -> exit XR -> analysis completes -> re-enter XR; assert Atlas/Worker generation and output identity remain authoritative, stale captures/listeners do not survive the old session, and presentation recovery cannot duplicate or discard a committed analysis;
- [ ] **presentation-independent reproducibility:** replay/save/restore the same investigation under standing/controller, seated/hand and varied head/panel poses; assert semantic replay outcome, canonical dataset identity and RF-046 investigation digest are unchanged while presentation state is allowed to differ;
- [ ] **reference-space integrity:** exercise `local-floor`, seated/standing height, recenter/reset-view and locomotion changes; assert viewer/reference-space transforms cannot mutate durable evidence/annotation/Memory-Palace coordinates unless an explicit governed semantic spatial action occurs;
- [ ] **resource lifecycle balance:** run repeated enter/exit/load/representation-change/save/restore cycles and assert bounded listeners, interactables, updatables, panels, renderer objects, Worker instances and JS-heap trend; treat this as PERF-05 leak/lifecycle evidence, never as Quest frame-rate or memory qualification;
- [ ] **clean-production immersive boot:** serve only a clean `dist` artifact, enter simulated immersive WebXR, initialize the real module Worker and real WASM kernel, execute one authoritative operation, produce a visible spatial result and export/replay it; use this as RF-053/RF-056 pre-deployment conformance evidence while preserving deployed-service and physical-device gates;
- [ ] **Moneta presentation independence:** for identical dataset/evidence/governed requirements, vary head pose, handedness, input modality, panel visibility and desktop-vs-XR entry; representation decisions must remain invariant unless a device/display capability is an explicit governed requirement recorded in provenance.

**USIM-1 — reference interaction scenarios**

- [ ] RF-049 near-touch -> commit -> retreat -> ray plus cross-target capture/cancel/tracking-loss recovery;
- [ ] panel grab/pin/follow/scroll/reference-frame transition;
- [ ] contextual-task-surface anchoring/occlusion/scene-input exclusion;
- [ ] TechnoCore inspect/alternative/remediation preview/commit/cancel.

**USIM-2 — world-semantic scenarios, implemented with owning U-tranches**

- [ ] U6 IceVault freeze/restore/compare and portal preview/travel/return without hidden analytical mutation;
- [ ] U7 Memory Palace observation -> hypothesis/test/finding -> branch/return with spatial-context continuity;
- [ ] U8 seated/standing, handedness, large-text/high-contrast/reduced-motion, reach/FOV/occlusion adversaries.

**USIM-C — collaboration conformance, gated by Stream C authority fixes**

- [ ] only after RF-037/RF-038/RF-057 authoritative fixes land, run two or more simulated XR browser clients through the real signalling/WebRTC path to verify spatial presence, pointing, disconnect/reconnect cleanup, stale-pose removal and convergent shared presentation state;
- [ ] drive an authenticated observer through a forbidden embodied mutation attempt and prove rejection at the real role/security authority; IWER is only the input/client driver and does not itself satisfy the security claim;
- [ ] pin simulator/runtime versions and record per-client pose/input scripts so collaboration failures are reproducible across builds.

**Exit gate:** one production control is activated via simulated controller and one supported hand path through the real input router; USIM-A proves lifecycle/persistence/reference-space/clean-artifact invariants through the real browser path; deterministic scenarios emit reproducible measured evidence; disabling simulation restores ordinary browser/native-WebXR behavior; production builds contain no simulator dependency path; simulator limitations are recorded; USIM-C remains gated on real security authority; physical U1/U8/U9/PERF-04 gates remain open.

#### P1-U0 — UI design-system contract and substrate decision — IMPLEMENTATION PARTIAL / REVIEW ACTIVE

Purpose: establish one enforceable visual/component system before migrating surfaces.

Landed implementation evidence:

- [x] create a Nemosyne-owned `src/vr/ui-system/` wrapper around `@pmndrs/uikit` with tokens/theme/root/panel foundations;
- [x] encode initial surface/typography/spacing/motion/target/reference-frame tokens while keeping data encoding separate from UI palette;
- [x] add architecture guards so generic UI does not become analytical/Moneta authority;
- [x] add synthetic lifecycle/disposal and UIKit-vs-canvas microbenchmark coverage.

Review exit work:

- [ ] **RF-050:** reclassify the current benchmark explicitly as synthetic engineering evidence and record its limitations;
- [ ] measure production renderer draw calls/triangles/textures, representative scrolling/clipping, allocation/GC and sustained update cost rather than only positive timing values;
- [ ] measure angular text legibility/target size at governed viewing distances and representative old/new surfaces;
- [ ] obtain Quest 3S frame-pacing, legibility, scroll/direct-touch and disposal evidence under P1-U9 before freezing the dependency choice;
- [ ] retain the wrapper boundary so UIKit can be optimized/replaced without changing semantic command authority if device evidence rejects it.

**Exit gate:** a minimal panel/control fixture renders with Nemosyne visual tokens and survives teardown/recovery, while the UIKit choice is supported by production/device evidence for the properties the roadmap claims. Until that evidence exists, adoption is provisional rather than `IMPLEMENTATION LANDED`.

#### P1-U1 — unified near/far interaction and Direct Touch substrate — IMPLEMENTATION PARTIAL / REVIEW ACTIVE

Purpose: make Direct Touch, Direct Grab, controller/hand ray and desktop input resolve through one semantic interaction path.

Landed implementation evidence from #444/#465:

- [x] introduce `NearFieldInteractor` with WebXR/controller ray-based proximity, contact/press thresholds and near/far hysteresis;
- [x] suppress/fade far rays in the near envelope and restore them on retreat;
- [x] add initial SpatialPanel/UIKit pointer dispatch and focused near/far hysteresis coverage;
- [x] **RF-049:** implement the explicit `FAR -> NEAR_HOVER -> CONTACT -> PRESS -> COMMIT -> RELEASE -> RECOVER` lifecycle with commit/release/recover semantics (#465);
- [x] capture the exact target/component for non-drag UI interactions and route move/up/cancel through panel capture (#465);
- [x] test reference interaction/capture semantics across the repaired production input path, including adversarial capture/recover/double-activation cases (#465).

Review exit work:

- [ ] finish/verify the modality priority `captured manipulation > direct touch > direct grab > controller-tip direct > distance ray > mouse > dwell fallback` as one central arbitration contract and prove no duplicate dispatch across all modalities;
- [ ] finish panel-before-scene precedence/cancellation and one-semantic-action-per-commit guarantees through the complete production InputRouter path;
- [ ] add visual proximity/contact/commit feedback and optional audio/haptics without treating simulated pressure as a scientific signal;
- [ ] preserve current ray smoothing, semantic coercion and raw-observation precision escape hatch for dense data;
- [ ] add an IWER simulator run for near/far transition, capture/cancel/recovery and modality parity through the production WebXR/InputRouter path;
- [ ] obtain physical Quest controller/hand evidence under U9 before verification.

**Exit gate:** one reference control is modality-equivalent through the real InputRouter/PointerEventMachine path; transition across near/far does not flicker, lose pointer-up, double-activate or select scene data through UI; automated tests cover capture/cancel/priority and device evidence agrees. #465 supplies the code-level RF-049 repair, not the physical qualification.

#### P1-U2 — spatial panel substrate and Holographic Inspector pilot — IMPLEMENTATION PARTIAL

Purpose: prove the new panel/layout/interaction system on a high-value bounded surface before global migration.

- [ ] preserve #465's repaired U1 capture/commit semantics and do not claim broader modality parity ahead of remaining U1/U9 evidence;
- [ ] implement `SpatialPanel` reference-frame behavior: `BODY_LOCKED` default for personal work, optional grab/pin to `WORLD_LOCKED`, animated continuity on frame transitions and explicit close/back/follow controls;
- [ ] migrate `HolographicInspector` to the new panel/control substrate while preserving its semantic target identity and current `InputRouter` precedence;
- [ ] expose compact observation/structure facts plus `Evidence`, `Provenance`, `Compare` and `Challenge` actions; dense detail scrolls rather than spawning adjacent panels;
- [ ] support direct touch in the near zone and ray selection at distance without changing command meaning;
- [ ] make the inspector object/selection-aware, avoid covering the focused feature and preserve focus through representation transitions where identity remains valid;
- [ ] validate typography/angular legibility and target hit volumes in-headset before freezing tokens.

**Exit gate:** Inspector parity is achieved without a bespoke duplicate interaction stack; the inspector is readable, scrollable, movable/pinnable and modality-equivalent, and target/device evidence shows no regression in focus, accidental selection or frame time.

#### P1-U3 — commodity precision surfaces and panel lifecycle — IMPLEMENTATION PARTIAL

Purpose: move conventional precision work out of hand-built spatial furniture.

- [x] migrate Settings to the shared control system, including statistical-lens options, feedback, gestures/input preferences, UI scale, contrast and reduced-motion controls;
- [x] migrate dataset load/schema-mapping/import setup and consequential confirmation dialogs where they exist; keep forms, dense tables, exact text and numeric entry planar;
- [x] consolidate operation history/provenance/evidence into role-specific precision surfaces rather than separate permanent panels;
- [x] provide common button/toggle/slider/segmented/scroll/text-field behavior and disabled-reason presentation across desktop/ray/touch;
- [ ] standardise panel placement, grab rails, pin/follow, dismissal, focus order and replacement behavior;
- [x] preserve a maximum normal analyst workspace of one primary work panel, one inspector/context panel and one secondary reference surface; a fourth requires replacement/consolidation or explicit pinning.

> P1-U3 residuals (deferred to P1-U8): item 2 provenance is **session-level** only — `HolographicInspector` Provenance/Evidence tabs render `atlas.evidenceLedger`-derived content; node-scoped provenance is pending the structure-id↔row join (the ledger references `DiscoveredStructure` IDs while the inspector receives a raw row); `OperationLogPanel` is retained as a superuser diagnostic. Item 4 `PanelChrome` is adopted by the migrated SpatialPanels (`SchemaMappingPanel`, `HolographicInspector`); `SettingsPanel` chrome retrofit and legacy `MovablePanel` chrome standardisation are deferred to P1-U8. VR text entry remains a controlled display+callback surface (an external input driver is required for caret/selection in WebXR).

**Exit gate:** commodity UI uses shared components and reference-frame rules; no migrated function loses desktop/controller/hand semantics; opening ordinary workflows no longer grows an uncontrolled panel constellation.

#### P1-U4 — contextual task surface and command constellation — IMPLEMENTATION LANDED / REVIEW ACTIVE

Purpose: close RF-005 by replacing subsystem-first navigation with visible task actions at the locus of work.

- [x] turn `ContextualTaskSurface` from an action filter into a real `OBJECT_ATTACHED` or selection-anchored spatial surface;
- [x] expose novice task verbs `Inspect`, `Compare`, `Challenge`, `Record`, `Navigate`, `More`, filtered by the current semantic target and journey context;
- [x] keep the constellation/HandWheel as custom Three.js spatial geometry where spatial arrangement adds value, but route its targets through the same interaction events and semantic commands as panels;
- [x] ensure target-scoped actions explain disabled/unavailable reasons under UX-04 rather than silently disappearing where that would confuse investigators;
- [x] demote custom gestures to optional accelerators; every essential operation has a visible touch/ray/controller/desktop path;
- [x] suppress global gestures/locomotion appropriately while hands are manipulating a local object or active menu, without creating an invisible persistent mode.

**Exit gate:** a researcher can inspect, compare, challenge, record and navigate from context without knowing subsystem names or memorised gestures; RF-005 is closed by product-path evidence, not merely a policy class test.

#### P1-U5 — TechnoCore epistemic instrument and actionable NIL/Moneta surfaces — IMPLEMENTATION LANDED / REVIEW ACTIVE

Purpose: make TechnoCore the coherent physical instrument for interrogating Nemosyne's representation reasoning and close the RF-006/RF-027 product seams.

- [x] retain TechnoCore as custom Three.js instrument geometry; use constrained direct manipulation for spatially meaningful controls and summon shared precision surfaces only for exact text/numeric/detail work;
- [x] expose `Why this representation?`, viable alternatives/near misses, stability/perturbation evidence, information loss, provenance and feasibility in distinct labeled views (Guidance, Alternatives, Constraints, Remediation tabs);
- [x] preserve explicit `DECISIVE`, `INFEASIBLE`, `UNDERDETERMINED` and `AMBIGUOUS` states; never turn ambiguity into a cosmetic winner or conflate utility/preference/attention/stability with statistical confidence/truth;
- [x] wire typed NIL remediation actions through the actual investigator semantic action path and call `recordRemediation` when applied; prove durable replay through the product path and RF-047 portable replay;
- [x] make consequential representation changes previewable/reversible and preserve selection/reference context through accepted transitions;
- [x] gate recommendation/explanation surfaces on reviewed P1-R/P1-E semantics: no visual polish may promote fabricated/overclaimed representation evidence.

**Exit gate:** TechnoCore is demonstrably operable with touch/ray/controllers/desktop, produces no analytical authority of its own, applies typed remediation with replayable provenance and communicates epistemic state without misleading confidence cues.

#### P1-U6 — Evidence/Ice Vault, archival recovery and semantic portals — IMPLEMENTATION PARTIAL / REVIEW ACTIVE

Purpose: ensure persistent world objects earn their place and close the decorative-object half of RF-006.

- [ ] give IceVault/Evidence Vault an explicit immutable-return role: saved/frozen investigation states, DiscoveryEpisodes, study-freeze snapshots, `.nemosyne` import/export and current-vs-frozen comparison where supported;
- [ ] make archive/freeze/restore state visible, attributable and provenance-preserving; destructive replacement requires preview/confirmation and a recovery path;
- [ ] gate strong archive-integrity claims on RF-046/RF-047 (RF-048 identity implementation is landed);
- [ ] if the Vault cannot provide a meaningful archive/recovery function in the private-preview path, remove/demote it from the default world rather than retain decorative symbolism;
- [ ] restrict Farcaster portals to semantic travel/context changes such as branch, saved investigation, overview/detail or collaborator frame; ordinary analytical operations remain controls, not portals;
- [ ] preview destination and any state consequence before travel; preserve a clear return route.

**Exit gate:** every persistent Vault/portal object has a user-testable investigator function, no portal hides an analytical mutation, and archival/recovery round-trips preserve investigation identity/provenance under the corrected portable contract.

#### P1-U7 — Memory Palace epistemic object system and discovery workflow — IMPLEMENTATION PARTIAL / REVIEW ACTIVE

Purpose: turn the Memory Palace into the spatial reasoning graph rather than a second decorative world.

- [ ] formalise visible lifecycle/state for observations, questions, hypotheses, tests, findings, contradictions and branch points using non-color cues as well as restrained semantic color;
- [ ] implement beacons as attributable reasoning/evidence entities and reasoning threads as focus-revealed relationships, avoiding permanent spaghetti;
- [ ] preserve semantic identity, selection and focus/context across graph navigation, representation switches and replay where valid;
- [ ] connect hypothesis -> test -> support/refute/inconclusive and explicit falsification/alternative-representation actions to exact evidence/provenance;
- [ ] integrate existing P1-F semantic targeting/focus-context and branch/replay behavior rather than adding a second graph interaction model;
- [ ] support shareable `.nemosyne` investigations as reproducible Memory Palace graphs once RF-046/RF-047 and the discovery science contract are complete.

**Exit gate:** an investigator can move from observation to hypothesis/test/finding, inspect supporting and counterevidence, branch/replay and return without losing provenance or spatial context; graph objects communicate lifecycle rather than subjective importance.

#### P1-U8 — world/panel consolidation, accessibility and comfort hardening — IMPLEMENTATION PARTIAL / REVIEW ACTIVE

Purpose: remove the remaining panel-wall/runtime clutter and make the converged interface sustainable for real work.

- [ ] retire `VRMenu` as primary navigation after P1-U4 parity; keep developer/research diagnostics (`VRConsole`, input/performance/load telemetry, gesture confidence) hidden from normal analyst mode;
- [ ] fold recommendation/explainer surfaces into TechnoCore and operation log into Evidence/History; keep Network/peer overview optional and subdued;
- [ ] enforce declared reference frames and comfortable zones: hand-attached UI is brief, persistent analytical panels are body-locked/pinnable, and head-locked UI is transient critical status only;
- [ ] add UI-scale, high-contrast and reduced-motion modes; no essential state is color-only and no critical action exists only at tiny/meta typography;
- [ ] constrain frequent interactions to comfortable reach/posture and replace memorised broad-arm gestures with direct manipulators where a physical mapping exists;
- [ ] validate 20+ minute inspect/compare sessions for arm fatigue, seated/standing reach, occlusion, legibility and recovery; adjust spatial tokens from device evidence rather than desktop screenshots.

**Exit gate:** normal analyst mode respects the three-surface budget, diagnostics are non-intrusive, accessibility modes preserve full task semantics, and sustained target-device use does not require repeated shoulder-height/extended-arm interaction.

#### P1-U9 — product-path evidence, performance and physical Quest qualification — DEFERRED UNTIL CONVERGED IMPLEMENTATION

Purpose: close RF-008/RF-050 and convert implementation claims into promotion evidence.

- [ ] derive the 10 journey phases from real product events/prerequisites rather than manual test advancement;
- [ ] add Playwright journeys through the real desktop UI for load -> orient -> inspect -> challenge/falsify -> compare -> record -> Memory Palace -> replay/export, including recovery/cancel paths;
- [ ] run the simulator-testable spatial/input portions of the same journey under IWER using the P1-USIM adapter, deterministic poses and bounded `XREvaluationEpisode` evidence;
- [ ] run the same core tasks on Quest 3S-class hardware with controllers and hands where supported; capture semantic parity, task failure/accidental activation, discoverability and recovery evidence;
- [ ] explicitly test #465/RF-049 near-touch -> retreat -> ray transitions, cross-target capture/cancel, dense data precision escape, panel pin/follow, representation changes, large text/high contrast and reduced motion;
- [ ] collect frame time, draw calls, GPU/CPU/UI allocation/GC, memory, interaction latency and analytical scheduling under representative investigations; integrate RF-050 and PERF-04/PERF-05 rather than using UI-only toy scenes;
- [ ] run at least one sustained 20+ minute session and record arm-fatigue/comfort outcomes; device evidence outranks screenshots and desktop emulation;
- [ ] conduct task-based investigator studies for comprehension, falsification behavior, finding capture and share/replay, preserving treatment versions and evidence reproducibly.

**Exit gate:** RF-008, RF-050, UX-03 and the UI-relevant portion of PERF-04/PERF-05 have real product/device evidence; #465's RF-049 code-level repair agrees with device behavior; no required modality changes semantic meaning; all core tasks are possible without expert gestures; the converged treatment passes independent adversarial VR/UI review before `VERIFIED COMPLETE`.

#### P1-U dependency order

1. **U0 + U1 are reopened foundations.** #465 lands the RF-049 code-level state/capture repair; RF-050 and remaining U1/U9 product/device evidence remain active.
2. **U2** proves the corrected interaction/substrate on the Inspector; implementation may scaffold earlier but its exit gate depends on U1 evidence.
3. **U3** may proceed after stable U0/U1 contracts and should migrate commodity surfaces before bespoke instrument work expands.
4. **U4** follows U1 and closes contextual interaction/RF-005; it may proceed in parallel with U3 once input semantics are stable.
5. **U5** may scaffold after U1/U2 but its scientific-facing completion is gated by P1-R/P1-E truth and RF-027/RF-047 replay semantics.
6. **U6** follows durable investigation/archive contracts, now including RF-046/RF-047 and the landed RF-048 identity contract; decorative Vault/portal behavior must not block removing the object from default view.
7. **U7** builds on P1-F plus investigation/discovery-science contracts and may progress incrementally without waiting for every panel migration.
8. **U8** happens after functional parity is available so redundant surfaces can be deleted rather than merely hidden beside replacements.
9. **U9** is the convergence/evidence tranche and cannot certify incomplete U0-U8 work.

Review exit work:

- [x] close **RF-049** at code level in P1-U1 (#465); preserve merged-state review and device evidence before product verification;
- [ ] close **RF-050** through P1-U0/P1-U9 production/device evidence;
- [/] close **RF-005** through P1-U4/P1-U8;
- [/] close **RF-006**: TechnoCore/P1-U5 is implementation-landed; IceVault archival/recovery and semantic portals under P1-U6 remain open.
- [x] wire **RF-027** through P1-U5 and portable replay through RF-047;
- [ ] derive journey state from real product events with meaningful prerequisites under P1-U9;
- [ ] close **RF-008** with real Playwright + Quest product-path evidence under P1-U9;
- [ ] collect task-level comprehension/discoverability/recovery/falsification/finding/share evidence before verification.

### P1-W Production wiring convergence — DEFERRED UNTIL P1-U0..P1-U9 COMPLETE

Purpose: turn the converged investigator interface into an honestly deployable system. This tranche begins after the UI tranche is complete so service contracts and capability gates are fitted to the stable product surface rather than repeatedly rewritten during panel/input migration. Inventory and design may be prepared earlier, but production wiring, promotion claims and endpoint exposure belong here.

#### P1-W0 — immutable frontend/WASM artifact — RF-053

- [ ] choose and document one canonical deployed URL layout for wasm-pack JS glue and the `.wasm` binary;
- [ ] make `npm run build` copy both artifacts into that exact location under `dist`, removing or repairing the unused conflicting plugin;
- [ ] fail the build when either artifact is absent, stale or mismatched; record content hashes and release identity;
- [ ] verify correct JavaScript/WASM MIME types, cache policy and cross-origin isolation headers from a server exposing only the production artifact;
- [ ] prove browser startup, real kernel readiness, Worker registration and at least one Rust-authoritative analysis from a clean checkout with no pre-existing `wasm/pkg` state or JS analytical fallback.

#### P1-W1 — deployed service boundaries — RF-054 with RF-037/RF-038/RF-057

- [ ] classify collaboration and each live-data source as preview-required, optional or unsupported; the UI must derive availability from the deployed capability contract;
- [ ] deploy or proxy the supported signalling endpoint and replace dev-only assumptions with explicit environment/configuration contracts;
- [ ] converge onto the replay-resistant versioned ticket authority, exact role allowlist and nonce lifetime; prove replay rejection through the deployed admission path;
- [ ] bind binary collaboration presence/pose sequence state to signalling-authenticated channel identity, reject malformed/mismatched frames and prove RF-057 through deployed/contract-faithful peer channels;
- [ ] deploy a governed live-stream source where required, or hide/disable demo-stream affordances with an explicit unavailable state;
- [ ] define origin/authentication, TLS, rate limiting, payload/resource limits, backpressure, reconnect, health, observability and failure semantics for every network boundary;
- [ ] verify successful and failed connections from the clean production bundle rather than Vite dev/preview middleware.

#### P1-W2 — capability/call-graph reconciliation — RF-055 with RF-058

- [ ] create a machine-checkable inventory mapping every advertised capability and public export to its browser/server entry point, authority, deployment dependency and product-path test;
- [ ] classify each off-path implementation as `wire`, `replace`, `quarantine` or `delete`, with an owner and evidence requirement;
- [ ] do not wire unsafe helpers merely to satisfy reachability: RF-039 owns real upload-ingress policy and RF-040 owns consent/telemetry lifecycle redesign;
- [ ] replace fake Arrow/FlatBuffers/MessagePack and security/statistics primitives with maintained libraries where interoperability or correctness is claimed, otherwise remove the claim/export;
- [ ] remove duplicate WebSocket lifecycle and ticket authorities after the canonical implementations own all consumers;
- [ ] apply RF-058 threat-class validation before closing scanner/static-analysis findings: identify the live sink, search all instances/bypasses, distinguish security from harmless/non-security uses, and retain production-path falsifiers;
- [ ] treat shared annotation/bookmark ID generation as uniqueness/integrity engineering unless object ownership makes IDs security-sensitive; prefer `crypto.randomUUID()` or a governed participant+counter identity rather than implying `Math.random()` replacement alone provides authorization;
- [ ] add import/reachability guards preventing security-critical or standards-labelled shadow implementations from returning unnoticed.

#### P1-W3 — production release qualification — RF-056

- [ ] add a CI job that builds from a clean checkout, inspects `dist`, serves only `dist` and fails on missing mandatory artifacts or unexpected remote runtime dependencies;
- [ ] run a real browser journey through load -> kernel analysis -> representation -> save/export -> clean-room replay, including Worker execution and explicit kernel-unavailable behavior;
- [ ] exercise required network services against deployed or contract-faithful production instances and verify capability-gated behavior when optional services are absent;
- [ ] add health/readiness checks that distinguish frontend availability, kernel readiness and external-service readiness;
- [ ] record release manifest, source SHA, WASM hash, configuration schema, compatibility result and rollback target;
- [ ] conduct an independent adversarial production-path review before promotion.

**Entry gate:** P1-U0 through P1-U9 are implementation-complete and their converged UI/product-path evidence agrees; no production service is wired to a UI surface that is still being structurally replaced.

**Exit gate:** RF-053 through RF-056 are closed; applicable RF-037 through RF-040 and RF-057 security/privacy authorities are closed or explicitly risk-accepted; RF-058 validation discipline has been applied to preview-critical security findings; every visible production capability has a real deployed path or an honest unavailable state; the clean published artifact initializes the Rust/WASM authority and passes the release journey; rollback and release provenance are demonstrated. Only then may the minimal private preview be promoted.

### P1-B Asynchronous analytical runtime — IMPLEMENTATION LANDED / REVIEW ACTIVE

Landed implementation evidence now includes #417's production Worker installation, real generation fencing, fingerprint-keyed dataset registration, authoritative output fingerprints, async presentation adoption and replay-parity repairs.

Review exit work:

- [x] RF-010/RF-011/RF-013/RF-014/RF-016 code-level exits (#417);
- [ ] **RF-015:** real module-Worker + real-WASM integration/browser test across TDA, mutation supersession and recovery for at least two runtime generations;
- [ ] record dispatch/transfer/compute measurements;
- [/] **RF-035/RF-051:** #480/#481 land RF-035A same-generation Worker-resident reuse and revocation evidence; #483 lands RF-035B0 controller reuse of the Atlas-committed Dataset. RF-035B1 canonical dataset-version state and later Worker → JS identity-first/materialise-on-demand transfer remain required before review exit;
- [x] **RF-048 implementation:** canonical cryptographic dataset identity now governs worker/provenance identity (#463); retain parity regressions;
- [ ] adversarial concurrency/recovery/large-transfer review before `VERIFIED COMPLETE`.

### P1-C Sparse topology scalability — IMPLEMENTATION LANDED / REVIEW ACTIVE

Landed implementation evidence:

- [x] `RaggedNeighbourhood`, exact and grid-sparse implementations;
- [x] Mapper reuses neighbourhood substrate (#418 / RF-019);
- [x] Betti-0 incremental sweep + bounded max-distance path (#418 / RF-020);
- [x] deterministic Landmark implementation (#418 / RF-021);
- [x] high-dimensional soundness restored by exact fallback (#418 / RF-018);
- [x] #426 uses complete-case validity and preserves source-row identity.

Review exit work:

- [ ] **RF-029/RF-051:** define supported scale profiles and measured resident/transient/browser budgets; #431 guards canonical production TDA but the complete pipeline remains open;
- [x] **RF-030 direct-caller bypass:** the kernel boundary itself enforces the budget — #435 makes the `data_compute_*` exports refuse over-budget work in-band, so no direct/raw caller can bypass the envelope;
- [x] **RF-030 durable refusal provenance:** the refusal is now kernel-authoritative and durable — Rust refusal branches write `outcome: "refused"` provenance to `LAST_PROVENANCE`, the bridge attaches it to `UnsupportedAtScaleError`, Atlas appends a non-mutating refusal event, and sync/async paths record-then-rethrow;
- [x] **RF-047 implementation:** refusal/remediation events survive clean-room portable replay with event-order/payload verification; retain merged-state review before broader verification.
- [ ] **RF-030 residuals:** add any explicitly governed approximation with exact-vs-approximation quality evidence;
- [ ] re-run adversarial topology/scale review before verification.

### P1-D 3D-native Moneta perceptual fitness — IMPLEMENTATION LANDED / REVIEW ACTIVE

Landed first-pass work:

- [x] versioned perceptual evidence types and bootstrap perceptual component;
- [x] bounded multi-pose viewpoint sampling;
- [x] measured/prior perceptual evidence feeds hard constraints and bootstrap utility;
- [x] RF-022 measurement correctness fix-forward;
- [x] RF-023 evidence identity binding;
- [x] RF-024 surrogate honesty + frozen treatment governance;
- [x] RF-045 truthful optional/source-labelled signature implementation (#461).

Review exit work:

- [ ] validate measured evidence on actual reviewed-faithful P1-R embodiments and target hardware;
- [ ] preserve the distinction between selection heuristics, engineering priors, measured evidence and calibrated statistical confidence;
- [ ] re-run adversarial perceptual/scientific review before verification.

### P1-E Actionable NIL/ambiguity — IMPLEMENTATION LANDED / REVIEW ACTIVE

Landed first-pass work:

- [x] `DECISIVE`, `INFEASIBLE`, `UNDERDETERMINED`, `AMBIGUOUS` outcomes;
- [x] readable explanations, near misses and blocking descriptions;
- [x] typed hard-constraint remediation routing (#420 / RF-027);
- [x] durable remediation provenance and session replay round-trip at aggregate/ledger layer;
- [x] separate scientific permissibility from device/runtime feasibility.

Review exit work:

- [x] P1-U5 exposes typed actionable NIL remediation through the investigator product path and records durable remediation provenance.
- [x] **RF-047 implementation:** remediation provenance is reconstructed and verified in clean-room `.nemosyne` replay; retain merged-state review.
- [ ] replace residual “select either safely” wording with explicit feasibility/tradeoff language;
- [ ] re-run adversarial NIL/replay/product-path review before verification.

### P1-F Semantic targeting and Memory Palace focus+context — IMPLEMENTATION LANDED / REVIEW ACTIVE

Landed first-pass work:

- [x] semantic target metadata, resolver and five-level focus/context controller;
- [x] RF-026 resolver/state fixes;
- [x] RF-025 production World/input/Memory-Palace wiring (#421);
- [x] live semantic metadata + precision escape hatch + persisted focus state.

Review exit work:

- [ ] add desktop Playwright and physical XR semantic-target/focus-context task evidence;
- [ ] ensure the #465 RF-049 interaction repair does not regress semantic targeting/precision escape and remaining U1 arbitration remains coherent;
- [ ] re-run adversarial UX/input review before verification.

## P1 — Minimal private preview

Deliver a controlled, observable deployment suitable for investigator research/usability testing rather than broad public launch.

- [ ] define supported browsers/headsets and a small tested hardware matrix;
- [ ] complete post-UI P1-W and close RF-053 through RF-056;
- [ ] deploy reproducible versioned frontend/WASM artifacts through the RF-053 artifact contract;
- [ ] add authentication/access control for a private cohort;
- [ ] define dataset retention/upload/deletion/privacy policy;
- [ ] add explicit consent/telemetry controls;
- [ ] establish dataset-safe crash/error/performance telemetry;
- [ ] add health checks, rollback and release provenance;
- [ ] expose only capabilities backed by deployed services; capability-gate optional collaboration/live-stream features under RF-054;
- [ ] close or explicitly accept RF-037/RF-038/RF-057 before enabling collaboration in preview;
- [ ] apply RF-058 class-wide validation to preview-critical security/static-analysis findings;
- [ ] validate `.nemosyne` compatibility across preview releases, including RF-046/RF-047 digest/replay and the landed RF-048 identity migration;
- [ ] implement onboarding, sample investigations and unsupported-feature states;
- [ ] run a small investigator cohort and feed structured evidence into the roadmap.

**Promotion rule:** private preview may not be promoted while any blocker/high review finding that undermines source-data integrity, scientific correctness, analytical authority, portable identity/replay, security/privacy authority, core task completion or target-device safety remains open. Medium collaboration-integrity findings such as RF-057 must also be closed or explicitly risk-accepted before that capability is enabled for the preview cohort.

## P1 — Security and reliability hardening

Stream C owns the active live-path security-assurance findings in detail; this section remains the preview-level promotion checklist.

- [ ] close or explicitly accept RF-037 through RF-043 plus RF-057 before private-preview promotion where applicable;
- [ ] apply RF-058 class-wide validation discipline to preview-critical security/static-analysis findings;
- [ ] re-run threat review against the deployed preview boundary;
- [ ] validate untrusted dataset/archive limits, traversal defences and resource budgets through the actual ingress paths;
- [ ] harden CSP, supply-chain controls and release integrity;
- [ ] ensure kernel failure cannot silently produce plausible-looking substitute results;
- [ ] add backup/export/recovery procedures for user-created investigations;
- [ ] establish preview vulnerability/update policy;
- [ ] run deeper fuzz/Miri/device-endurance campaigns outside the ordinary PR critical path while retaining deterministic regressions in the merge gate.

## P1 — VR/UI/UX fitness

The frozen panel/intent-wheel treatment work is merged through #394. Gate F review for that controlled local treatment is complete; Quest 3S validation remains required. **P1-U0 through P1-U9 above own the implementation breakdown**, governed by `Nemosyne_VR_UI_Design_System_and_Agent_Spec.md`; #465 provides the RF-049 code-level repair while RF-050 and remaining device/product evidence stay active. This section remains the cross-cutting promotion/evidence gate.

- [x] spatial-audit + hypothesis + Blender prototype comparison for panel arrangement completed as a recorded decision (`docs/decisions/VR_PANEL_SPATIAL_LAYOUT.md`, evidence tier 4);
- [x] role-aware depth-tier zoning implemented as panel default positions with invariant tests;
- [x] persistent panels consolidated onto the torso/body reference frame; head/camera lock reserved for transient alerts;
- [x] production HandWheel converged onto the task/intent taxonomy with a separate superuser annex;
- [x] novice command vocabulary includes Move, Undo/Redo and Return-to-Overview;
- [x] HolographicInspector and FrustrationResponseManager moved off the retired rig frame;
- [x] frozen panel-layout + intent-wheel treatment recorded in `docs/study/UI_TREATMENT.md`;
- [ ] close RF-050 and execute remaining P1-U0 through P1-U8 work before treating the converged interface as implemented; preserve #465's RF-049 code-level semantics;
- [ ] execute P1-U9 to close RF-008/UX-03 and the UI/device portion of PERF-04/PERF-05;
- [ ] validate comfortable locomotion, scale legibility, reach, occlusion, focus and spatial hierarchy on target headsets;
- [ ] keep desktop/2D interaction semantically equivalent where possible;
- [ ] improve progressive disclosure, gesture discoverability and error recovery;
- [ ] validate frame-time, draw-call, memory, analytical scheduling and interaction budgets with representative investigations;
- [ ] use Blender-assisted asset/UI work only where it materially improves spatial comprehension;
- [ ] conduct task-based investigator studies and preserve decisions/evidence reproducibly.

## P1 — Investigation and discovery science

- [ ] complete hypothesis -> test -> support/refute/inconclusive workflows;
- [ ] add explicit falsification operations and alternative-representation checks;
- [ ] connect findings to exact analytical evidence and representation context;
- [ ] capture discovery outcomes suitable for held-out evaluation;
- [ ] evaluate whether Moneta improves discovery quality, time-to-insight, error rate and reproducibility versus baselines;
- [ ] support shareable `.nemosyne` investigations as reproducible Memory Palace graphs after RF-046/RF-047 close; RF-048 canonical identity is landed.

## Scientific validity programme

### Measurement semantics and statistics

- [x] **RF-028 (landed in #428):** trend uses actual timestamps; regular-time FFT uses physical units and fails closed on irregular/gapped sampling.
- [x] **RF-032 (landed in #428):** exact/corroborated topology semantics with adversarial false-positive tests.
- [x] **RF-045 implementation (landed in #461):** fabricated/default analytical-looking signature evidence removed; explicit unknown/source/fidelity semantics added. Downstream RF-036/RF-001/RF-002 review remains.
- [ ] define/govern irregular-series spectral analysis or explicit provenance-bearing resampling before claiming spectral evidence for irregular time series;
- [ ] **RF-036:** converge topology/spatial classification onto one canonical Rust-owned evidence authority so cross-layer disagreement cannot manufacture semantic structure;
- [ ] complete scale/measurement-type coverage beyond storage types;
- [ ] enforce appropriate geometry for compositional, circular, grouped/repeated and other non-Euclidean structures;
- [ ] distinguish descriptive statistics, inferential uncertainty and model utility;
- [ ] introduce calibration/coverage claims only when backed by an explicit statistical procedure;
- [ ] add multiple-comparison/selection-pressure controls where required;
- [ ] expand Rust property/metamorphic tests for statistical and measurement invariants.

### Pattern fragility / apophenia pressure

Treat this as evidence about a claim/analysis, never a psychological score for an investigator.

- [ ] define a versioned pattern-fragility evidence contract;
- [ ] include representation dependence, degrees of freedom, selection opportunity, perturbation instability, subgroup sparsity, null-model plausibility and independent corroboration;
- [ ] attach concrete falsification actions to elevated dimensions;
- [ ] persist evidence and performed checks in Investigation/Discovery provenance;
- [ ] keep it advisory until controlled studies show improved investigator calibration/discovery quality;
- [ ] never convert heuristic pattern pressure into probability/confidence without empirical calibration.

## P2 — RepresentationGraph and compositional Moneta

**DEFERRED until P1 foundations and stated prerequisites are met.** P1-R may make the current single-winner graph primitive executable as an embodiment contract, but must not introduce open-ended composition/search ahead of this gate.

- [ ] represent existing single-family outputs as canonical simple graphs first;
- [ ] finalise primitive registry, graph schema, grammar and canonical serialisation;
- [ ] define bounded composition search and pruning budgets;
- [ ] preserve information-loss and hard-constraint reasoning through composition;
- [ ] make the spatial runtime a pure graph embodiment adapter;
- [ ] add deterministic replay/provenance for composed representations;
- [ ] only then evaluate learned composition ranking.

## P3 — Adaptive Nemosyne

**DEFERRED until learning has outcome evidence and operational governance.**

- [ ] freeze exact model/ontology/NIL/perception versions in study state;
- [ ] add monitoring, rollback and user-visible adaptation controls;
- [ ] separate investigator preference adaptation from scientific evidence authority;
- [ ] run controlled longitudinal studies before autonomous adaptation.

## Dependency and platform modernisation

The consolidated dependency update landed in #358. Future updates are evidence-led maintenance rather than a standing migration wave.

- [ ] modernise Rust scientific/data libraries with numerical, provenance, determinism and WASM parity evidence;
- [ ] replace hand-rolled infrastructure only where a maintained library improves fitness without weakening Nemosyne semantics;
- [ ] migrate ESLint/TypeScript majors deliberately;
- [ ] treat Three.js/WebXR upgrades as dedicated runtime migrations with headset/performance validation.

## Fixed design boundaries

- **Rust owns N-dependent work.** Parsing, storage, filtering, statistics, clustering, topology, spectral analysis, evidence construction, data-derived layout and large-data reduction remain Rust/WASM responsibilities.
- **Lossless copies preserve scientific content.** Dataset clone/restore/registration may not silently drop graph edges, weights, attributes or other governed source semantics. Transformations that intentionally change them must declare the change.
- **Missing is not zero.** Stored normalization sentinels must never silently become analytical coordinates. Metric/TDA operations use a declared eligibility/imputation policy; implicit imputation is forbidden.
- **Unknown is not neutral.** Missing scientific evidence remains unknown. Numeric defaults/priors/heuristics must be explicitly labelled and may not masquerade as measured facts.
- **Time is data, not row order.** Temporal trend and spectral evidence must use authoritative time coordinates. FFT evidence requires demonstrated regular sampling; irregular/gapped series must use an explicitly governed method or return unsupported/no spectral evidence.
- **Semantic hints require corroboration.** Ordinary column-name substrings may not manufacture graph/geospatial/vector semantics. Generic `x`/`y` axes alone are not proof of geography.
- **One durable dataset identity.** Provenance/package/replay `datasetFingerprint` means the canonical collision-resistant scientific content hash. Cheap deterministic hashes are seeds/cache keys and must be named accordingly.
- **Investigation digests commit semantic state.** A strong hash over a lossy projection is not a strong investigation commitment. Governed semantic entities/events must affect the digest; presentation-only state must not.
- **Atlas owns durable analytical capabilities.** Reuse canonical handles instead of serialising the same dataset back into Rust.
- **Moneta is a bounded control plane.** It reasons over compact evidence and semantics, never raw full-dataset traversal.
- **Semantic representation must survive embodiment.** A non-point Moneta candidate may not silently degrade into point-per-row geometry or a mathematically different visual approximation without explicit semantics/provenance.
- **Observations are detail, not universal geometry.** Aggregate, density, cluster, field, topology and other structure-level representations are first-class; observations appear when analytically/interactively appropriate.
- **JS presents, orchestrates and schedules.** It must not reconstruct a shadow analytical authority, and supported-scale paths may not hide unbounded row materialisation before/after Rust.
- **Tests live with authority.** Exhaustive mathematics belongs beside Rust-owned behavior; higher layers verify seams, presentation and interaction.
- **Production-path evidence governs shipped claims.** An isolated helper, mock or unit test cannot by itself prove a production property; the real authoritative entry point/call graph must demonstrate the behavior where the claim applies.
- **Security identity follows the authenticated channel.** A peer/session identity established by the admitted transport or server authority cannot be overridden by a duplicate identity field inside an untrusted payload. Sequence/replay state is keyed to the trusted lifecycle identity.
- **Security findings close by class, not by scanner line.** Trace the threatened asset and production sink, search alternate/bypass instances, classify real risk honestly and prove the authoritative path. Harmless uses of a flagged primitive are not vulnerabilities merely because they resemble a risky use elsewhere.
- **A visible capability requires a deployed dependency.** A constructed client, exported helper or dev-only endpoint is not a production capability. Every visible feature must have a healthy deployed path or an explicit unavailable/capability-gated state.
- **The published artifact is the product boundary.** Mandatory WASM, Worker and runtime assets must be present, integrity-bound and exercised from the clean deployable output; success from the source tree or Vite middleware is insufficient.
- **Interaction completion means semantic parity.** Mouse, controller ray, hand ray and direct touch may differ mechanically, but required operations must produce one governed semantic action with explicit capture/cancel/commit behavior.
- **Boundary tests remain mandatory.** Rust-first testing does not replace WASM ABI, browser, WebXR or end-to-end verification.
- **Source rows are not render primitives or analytical reduction inputs.** LOD/reduction is first-class architecture, and render-object growth must be governed independently of source N.
- **Worker handles are local capabilities.** Cross-thread identity travels by fingerprint plus explicit registration, never foreign handles.
- **Sparse means sound before fast.** An approximate or sparse neighbourhood may only omit edges/points when the approximation contract explicitly permits it and provenance records the mode; optimization must never silently change mathematical meaning.
- **Unbounded work fails explicitly.** A Worker is scheduling isolation, not a resource budget. Exact analytical work above the governed envelope must use an explicit bounded/approximate mode or return an actionable unsupported/NIL result.
- **Resource estimates are evidence, not device qualification.** Static Rust safety estimates prevent known pathological work but do not prove target-browser/headset latency or peak-memory fitness; those claims require measured workload/device profiles across JS + Worker + WASM.
- **Perceptual evidence is identity-bound.** Measured evidence must correspond to the current dataset, candidate/embodiment, model version and governed viewpoint/device context before it can affect ranking or hard constraints.
- **The world is an interface, not scenery.** Persistent spatial objects must have a clear investigator function or be removed/demoted.
- **Approximation is evidence.** Sparse/landmark/approximate modes must be explicit in provenance.
- **Bootstrap is the safe Moneta default.** Learned ranking remains exact, pinned and explicit.
- **Hard constraints precede learning.** Learning cannot resurrect an infeasible candidate.
- **Learning never owns research facts.** Learned features consume Rust-derived evidence.
- **Skepticism targets claims, not people.** Pattern-fragility signals must be explainable and actionable.
- **Review can reopen completion.** A green suite or merged PR is implementation evidence, not immunity from adversarial review.
- **Governance labels must be true.** A rule called an approval gate must actually require approval, or be renamed/documented to describe its real enforcement.
- **No Gate 9/10 leapfrogging.** Composition/adaptation cannot substitute for correctness, reproducibility, spatial fitness or outcome evidence.

## Verification cadence

For each PR, use the cheapest authoritative layer that proves the claim. Stream B additionally asks what evidence would falsify the completion claim and adds that evidence where practical. Stream C attacks security/privacy-sensitive live boundaries and verifies that the production authority, not an orphan helper, enforces the claimed property. Before private-preview promotion, run the broad checkpoint:

```text
cargo test / Rust property tests
focused JS/WASM boundary tests
TypeScript typecheck + lint
fast Node + focused UI + integration + explicit WASM suites
architecture/import/row-materialisation authority gates
graph lineage Atlas -> Rust parity tests
canonical dataset identity cross-language golden vectors
portable investigation replay/tamper tests including refusal/remediation
digest semantic-field mutation/tamper tests
coverage assurance
production build
clean-dist artifact manifest/hash/MIME verification and real WASM initialization
browser/WebXR product-path smoke
real Worker/WASM integration for async analytical paths
deployed or contract-faithful signalling/live-stream boundary tests with capability-unavailable cases
live collaboration admission + channel-bound pose replay/framing adversaries (RF-037/RF-038/RF-057)
real sparse-mode exact-vs-approximation parity/stability tests
scale benchmarks measuring complete JS + Worker + WASM algorithm and peak memory
security admission/ingress tests through the live production path
hostile parser/WASM ABI fuzz/property campaigns with deterministic regressions
physical Quest qualification for promotion-critical device claims
independent review pass over the resulting merged implementation
```

## Near-term execution order by stream

### Stream A — forward implementation

1. Continue minimal-private-preview, security/reliability, investigation/discovery-science and measurement-semantics work only where RF-046/RF-047 and the active Stream-C blockers are not dependencies. RF-044/RF-045/RF-048 implementations have landed but remain review-monitored.
2. Do not consume irregular-series FFT periodicity as scientific evidence; RF-028 (#428) deliberately withholds spectral evidence unless sampling is regular. RF-036 topology-authority convergence remains open.
3. Do not introduce scale claims or exact high-D work that bypasses the RF-029/RF-051 complete resource envelope.
4. Continue bounded maintenance/dependency work that does not distract from promotion blockers.
5. P1-U work continues on its parallel stream; preserve #465's RF-049 code-level semantics while remaining U1/U9 product/device evidence and RF-050 stay active. Do not begin P2 RepresentationGraph composition or P3 adaptation until reviewed prerequisites are satisfied.
6. After P1-U0 through P1-U9 converge, execute P1-W in order: immutable WASM artifact -> deployed service boundaries -> off-path capability reconciliation -> clean production release qualification. Do not promote the private preview before P1-W exits.

### Stream B — review and fix-forward

1. **CURRENT: RF-029 + RF-030 + RF-031 + RF-035 + RF-051 — analytical resource/residency envelope.** Preserve kernel-inline refusal and #479 operation-complete worker-registration correctness; #480/#481 land same-generation Worker residency reuse and revocation evidence, and #483 removes the duplicate controller result parse. Next implement RF-035B1 canonical dataset-version/materialise-on-demand state, then reduce the remaining Worker → JS full-result transfer and finish measured whole-pipeline qualification.
2. **RF-036 + RF-001/RF-002 — representation/evidence authority review.** Re-audit canonical topology/spatial evidence and representation semantics on top of the landed RF-045 truth contract.
3. **RF-050 / remaining P1-U0..P1-U9 evidence — whole-product convergence.** Continue UI implementation independently while preserving scientific/interaction authority boundaries.
4. **RF-015 + RF-033 — production evidence architecture.** Add real Worker/WASM timings and keep browser-smoke signal independent; RF-046/RF-047 remain landed/review-active foundations rather than implementation queue items.
5. **RF-052 + RF-009/RF-034 — governance truth.** Align branch-rule names/review policy/current-main status with actual enforcement; keep automated review from becoming a false or unnecessary blocker.
6. **Physical XR qualification — RF-026 residual + RF-049/RF-050 + PERF-04 + UX-03.** Quest 3S controllers/hands/desktop semantic parity, comfort, frame/memory budgets and target-device task evidence.
7. **P1-W / RF-053 through RF-056 — post-UI production wiring.** Start only after P1-U convergence; include deployed collaboration/security boundaries and capability reconciliation.
8. **Private-preview hardening.** Auth/access control, retention/privacy, consent/telemetry, release/rollback/recovery and compatibility only after applicable blocker/high findings close or are explicitly risk-accepted.
9. Review each new Stream A merge immediately and append/fix RF findings in the same cadence.

### Stream C — security authority and live-path assurance

1. **RF-037 + RF-038 — signalling authentication authority.** Canonicalize one ticket protocol/role ontology, enforce nonce replay prevention in live admission, and make scoped-role parsing fail closed.
2. **RF-057 — collaboration pose identity/framing.** Bind sequence/replay authority to the signalling-authenticated channel peer, not payload numeric identity; make the codec exact-length/finite-value fail-closed and test a real forged-victim-sequence packet through `_wireChannel`.
3. **RF-040 — telemetry/privacy lifecycle.** Inventory all retained/exported telemetry and redesign consent/revocation/erasure authority before wiring or claiming GDPR erasure support.
4. **RF-039 — upload ingress assurance.** Consolidate hardening policy around the real FileLoader/Atlas/Rust/Dataset path and replace helper-only evidence with adversarial live-path tests.
5. **RF-041 — supply-chain trust.** Remove the unpkg import/CSP allowance if production/dev proof confirms it is unnecessary. Preserve the already-landed immutable GitHub Actions SHA pinning/checker.
6. **RF-042 — dev terminal safety.** Escape/strip control sequences from UX-trace terminal presentation.
7. **RF-043 — hostile-boundary fuzzing.** Expand parser/typed-buffer/WASM ABI fuzz/property evidence; every discovered defect becomes a deterministic PR regression.
8. **RF-058 — finding-class validation discipline (parallel).** For every security/static-analysis finding, trace the threatened production sink, inventory the class and bypasses, classify real severity, retain a production-path falsifier and explicitly document harmless/non-security instances rather than mechanically replacing primitives.
9. Re-review security-sensitive Stream A/Stream B changes continuously; a hardened helper that is not wired to the live path is not a completed security property.

### Convergence / promotion

- Run PERF-04 and UX-03 physical Quest qualification on the converged P1-U treatment; #465 provides RF-049's code-level repair while RF-050/U9 define remaining device evidence.
- Execute P1-W only after P1-U0 through P1-U9 converge; require RF-053 through RF-056 closure before private-preview promotion.
- Re-run blocker/high security, architecture, scientific, provenance and UX review before private-preview promotion.
- Require applicable Stream C blocker/high findings to be closed or explicitly risk-accepted with evidence before private-preview promotion; RF-057 must be closed/risk-accepted before collaboration is enabled.
- RF-046/RF-047 implementation has landed, but strong reproducible-investigation integrity claims still require merged-state adversarial review and compatibility/tamper evidence to agree; RF-048 canonical dataset identity remains review-monitored.
- Continue discovery/outcome studies and learned-Moneta empirical validation.
- Begin RepresentationGraph/compositional Moneta only after P1 prerequisites are both implemented and review-verified.
- Begin Adaptive Nemosyne only after evidence and governance prerequisites are satisfied.
