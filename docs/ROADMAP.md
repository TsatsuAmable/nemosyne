# Nemosyne Roadmap & Implementation Status

> **Current implementation-status authority.** Product and research direction are governed by `docs/Nemosyne_Definitive_Vision_and_Roadmap.md` V3. This document records current implementation state, programme order, review findings and promotion gates. Completed migration detail is preserved in `docs/archive/`.

## Status snapshot — 26 August 2026

**Current remote main:** `3150f55` (`docs(roadmap): refresh Current Status for RF-030 kernel-inline enforcement` — #436 merged). The preceding Stream-B tranches landed: #426 (RF-007/RF-017 missing-data correction), #428 (RF-028/RF-032 temporal/evidence integrity), #429 (first RF-029/RF-030/RF-031/RF-035 analytical-resource-envelope cut: shared `AnalysisBudget`/`ResourceEstimate` vocabulary, canonical-operation-ABI preflight for K-means/hierarchical/DBSCAN, stable `UNSUPPORTED_AT_SCALE` refusals), #431 (RF-030 production TDA preflight: Rust-owned `data_tda_resource_preflight` gating Mapper/persistence/Betti with typed refusal), #432 (VR UI design-system docs), #433 (roadmap status refresh), #434 (CodeQL randomness remediation — clean zero-finding baseline for the current JavaScript/TypeScript query set), and #435 (RF-030 kernel-inline enforcement: the Rust `data_compute_*` exports refuse over-budget work in-band, closing the direct/raw-caller bypass). Static resource limits remain kernel safety guards, not Quest qualification and not evidence of generic 10M-row support.

**Just-landed Stream-B tranche:** #435 (`fix/rf030-kernel-inline-tda-preflight`) closed the RF-030 direct-caller bypass and merged green. The Rust `data_compute_mapper_graph` / `data_compute_persistence_intervals` / `data_compute_betti0_curve` exports now run the resource preflight themselves and, on refusal, write `{ unsupportedAtScale: true, preflight }` to the output buffer instead of a result, via the same `(out_ptr, out_len) -> u32` ABI. No caller — production bridge or direct/raw export — can bypass the analytical resource envelope. The TS `tdaCall` translates the in-band refusal to `UnsupportedAtScaleError`; the separate host-side preflight was removed from the production compute path, and the standalone `data_tda_resource_preflight` remains as a dry-run query exposed via a new `tdaResourcePreflight` TS wrapper. A real-WASM regression test proves a raw `bridge.call('data_compute_mapper_graph', ...)` cannot bypass the envelope. **Review-active residuals:** durable analytical refusal provenance/NIL, governed bounded approximation with exact-vs-approximation quality evidence, and measured workload/device evidence remain open under RF-029/RF-031.

**Reprioritised Stream-B critical path:** (1) RF-007/RF-017 validity correctness landed in #426, with provenance/scale residuals; (2) RF-028/RF-032 temporal/evidence integrity landed in #428, with RF-036 authority-convergence and irregular-series-spectral residuals open; (3) **CURRENT:** RF-029/RF-030/RF-031/RF-035 analytical resource envelope (#429/#431/#435 merged; kernel-inline/direct-caller enforcement landed; residual durable refusal/approximation provenance, RF-035 large-mutation rematerialisation, and measured workload/device-evidence work open); (4) RF-001/RF-002 representation truth; (5) RF-005/RF-006/RF-008 plus the RF-027 World/UX carry-over; (6) RF-015/RF-033 production evidence; (7) physical Quest 3S qualification; (8) private-preview hardening. Stream C runs in parallel on RF-037 through RF-043. The dependency rule is: **valid data geometry → valid analytical evidence → bounded computation → faithful representation → coherent investigator UX → physical XR proof → private preview.**

**Current interpretation:** P1-A, P1-B, P1-C, P1-D, P1-E and P1-F contain material implementation advances but remain **IMPLEMENTATION LANDED / REVIEW ACTIVE**, not `VERIFIED COMPLETE`. The dominant risks are scientifically invalid evidence, residual resource-control bypasses, unbounded authoritative Rust work, memory/transport cliffs, security-authority/live-path assurance gaps and product/device evidence gaps. Stream A remains free to advance work whose dependencies are stable; Stream B fixes correctness and evidence foundations; Stream C independently hardens security/privacy-sensitive live boundaries.

**Physical promotion blocker:** the governed Meta Quest 3S browser/performance and interaction qualification remains outstanding. Desktop/browser CI is necessary evidence but cannot qualify headset behaviour.

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

### Stream C — security authority and live-path assurance

Stream C is the dedicated security, privacy/compliance, supply-chain and hostile-boundary assurance lane. It exists to eliminate the recurring pattern where well-designed hardening code and green unit tests sit beside a different or weaker live production authority.

Its detailed work package is [`STREAM_C_SECURITY_ASSURANCE.md`](STREAM_C_SECURITY_ASSURANCE.md). Stream C uses the same RF ledger and completion vocabulary as Stream B, and inherits the general production-path evidence rule above.

Stream C operating principles:

- one authoritative security protocol/implementation per boundary;
- malformed, ambiguous, stale, replayed or unsupported claims fail closed;
- replay prevention is enforced at successful admission, not merely implemented in an unused verifier;
- attacker-controlled and privacy-sensitive properties are tested through the real ingress/call path;
- upload hardening must preserve Rust/Atlas analytical and parsing authority rather than introduce a shadow JavaScript parser;
- compliance claims require actual retention/export/revocation/erasure lifecycle evidence;
- unnecessary third-party runtime trust is removed when the production bundle already owns the dependency;
- parser/unsafe/ABI assurance is driven by attacker-reachable behavior and fuzz/property evidence, not raw `unsafe`/`unwrap` counts alone.

### Status vocabulary

- **IMPLEMENTATION PARTIAL:** scaffolding or a bounded portion exists, but the planned production path is not yet landed.
- **IMPLEMENTATION LANDED:** planned code exists and passed its implementation gates.
- **REVIEW ACTIVE:** later review found unresolved defects, semantic gaps or insufficient acceptance evidence.
- **VERIFIED COMPLETE:** implementation plus independent review evidence satisfy the governing acceptance criteria.
- **DEFERRED:** intentionally not active because prerequisites are unmet.

## Active review/fix-forward ledger

| ID | Area | Severity | Finding | Required disposition |
| --- | --- | --- | --- | --- |
| RF-001 | P1-R / authority | High | `VRTopologyTranslator` still feeds `dataset.rows` into non-point embodiment, and aggregate/density/cluster reductions traverse O(N) rows/positions in TypeScript. Bounded mesh count is not the same as Rust-owned bounded analytical reduction. | Define Rust-owned bounded semantic embodiment payloads; make Three.js consume those payloads rather than derive analytical structure from raw rows. |
| RF-002 | P1-R / scientific semantics | High | `DENSITY_FIELD` is currently a fixed 6×6×6 histogram over rendered positions while the ontology claims continuous density estimation; `DISTRIBUTION_FIELD` shares that geometry despite claiming quantiles/PDF/contours; cluster/manifold claims also exceed demonstrated semantics. | Reclassify candidate fidelity honestly and either implement the declared mathematics or narrow the ontology/preservation claims. |
| RF-003 | P1-R / correctness | High | Aggregate grid calculation treated legitimate numeric zero as falsy and substituted `1`, corrupting aggregate means. | **Fixed in #409**; preserve zero and retain regression coverage. |
| RF-004 | P1-R / tests | Medium | The C4 source guard sliced from `buildAggregateBars` to an earlier `buildDensityField`, producing an empty string and allowing a false pass. | **Fixed in #409**; source guard now proves non-empty method slices and inspects the intended branches. |
| RF-005 | P1-U / UX | High | The runtime still constructs a broad dashboard/panel constellation; `ContextualTaskSurface` is an action filter, not a colocated spatial task surface. | Execute P1-U4/P1-U8: implement selection-anchored contextual task controls, demote subsystem/panel-wall navigation and enforce the normal analyst persistent-surface budget. |
| RF-006 | P1-U / world semantics | High | TechnoCore lens methods are not yet demonstrated as wired investigator input/analysis controls; IceVault remains a persistent largely decorative glyph. | Execute P1-U5/P1-U6: wire TechnoCore through input/NIL/analysis with visible epistemic state/provenance; make IceVault a real archive/recovery instrument or remove it from the default world. |
| RF-007 | P1-A/P1-C / analytical correctness & scale | **Blocker** | The shared columnar substrate stored invalid primitive slots as `0.0`, while TDA/PointCloud consumed value buffers without validity. Missing observations therefore became real Euclidean coordinates, capable of manufacturing distances, clusters and topology. | **Correctness landed in #426:** `PrimitivePointColumn` carries values + validity; metric/TDA eligibility is complete-case over selected features; row and columnar paths agree; real zero remains valid; TDA source-row identity survives compaction; K-means/hierarchical/DBSCAN use the same contract and excluded rows receive null cluster assignment. Remaining before verification: emit exact missing-data policy + excluded counts in TDA analytical provenance; RF-029 owns residual PointCloud compaction/copy cost; independent review/CI evidence must continue to agree. |
| RF-008 | P1-U / evidence | High | `investigator-journey-e2e.test.ts` manually advances phases and uses a kernel mock. It is useful integration coverage but not evidence of a real browser/XR investigator journey or usability outcomes. | Execute P1-U9: reclassify the current test as integration evidence, add real Playwright product-path journeys, and run governed Quest 3S controller/hand task qualification with performance and interaction-failure evidence. |
| RF-009 | Roadmap governance | Medium | Roadmap status became stale and internally contradictory, with older main SHAs and completion claims coexisting with open checklist items. | Three-stream refresh process is in place, but RF-034 records a residual contradiction found after #418. Treat governance as **REVIEW ACTIVE** until current status/exit checklists remain mechanically consistent across multiple tranches. |
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
| RF-027 | P1-E / provenance & constraint semantics | High | Actionable NIL remediation originally depended on human-message parsing and was not durable. | **Fixed in #420** for typed codes + durable remediation provenance. Remaining: execute P1-U5 so the investigator World/UX applies typed remediation through the real semantic action path and proves replay. |
| RF-028 | Scientific validity / temporal & spectral | **Blocker** | Spectral analysis ignored the supplied time axis and temporal trend regressed on observation rank. Irregular/gapped series could therefore receive false frequency, period, trend and seasonality evidence. | **Fixed in #428:** pairwise-complete time/value observations; sort by authoritative numeric/epoch time; trend regression over normalized actual timestamps; FFT only for positive regularly sampled time; duplicate/irregular/gapped series withhold spectral evidence; physical frequencies/periods/resolution/Nyquist in source time-coordinate units; unparsed temporal strings fail closed; canonical TypeScript evidence labels legacy periodicity scores as heuristics. Rust and transport tests cover row shuffle, time-unit rescale, gaps, duplicates, missing samples and row/columnar parity. **Review-active residual:** irregular-series spectral analysis remains deliberately unsupported until an explicit provenance-bearing resampling or Lomb-Scargle design is governed. |
| RF-029 | Scale / memory & resource envelope | **Blocker for 10M claim** | WASM is capped at 512 MiB while primitive resident storage uses f64 values plus validity and operations allocate additional point/transposition/output buffers. A generic “10M rows” claim is therefore false without dimensional/workload constraints; six numeric dimensions alone exceed the cap before runtime overhead. | **IMPLEMENTATION PARTIAL:** #429 landed the shared Rust budget vocabulary, saturating work estimates, row/PointCloud transient estimates, dense CSR accounting and canonical clustering preflight; #431 landed the canonical production TDA preflight and typed unsupported-at-scale bridge; #435 landed kernel-inline enforcement so direct/raw callers cannot bypass the envelope. Remaining: explicit 10M workload/device profile, complete resident+transient peak accounting, streaming/chunking/validity compaction where justified, durable refusal/approximation provenance and measured peak-memory evidence. |
| RF-030 | P1-C / high-D complexity | High | RF-018's soundness fix makes `GridSparseIndex` fall back to exact all-pairs search for d>6. Large high-dimensional Mapper/neighbourhood workloads can therefore cross a silent O(N²d) performance cliff while nominally requesting sparse mode. | **IMPLEMENTATION LANDED / REVIEW ACTIVE:** #431 put the Rust-owned preflight on the canonical production path (complete-case validity, conservative source-row fallback, Mapper `bins`, Betti `steps`, dense CSR and duplicate output buffers; typed `UnsupportedAtScaleError`; real-WASM high-D boundary coverage); #435 made enforcement kernel-inline — the `data_compute_*` exports run the preflight themselves and refuse in-band via `{ unsupportedAtScale, preflight }`, so direct/raw callers cannot bypass the budget. Remaining: durable analytical refusal provenance/NIL, governed bounded approximation where useful, and measured workload/device evidence. |
| RF-031 | Operations / computational budget | High | User-callable hierarchical clustering repeatedly compares cluster/member pairs with cubic worst-case work; current naïve k-means++ seeding is O(N·D·K²) before the fixed Lloyd iterations and is cubic in the user-controlled K≈N worst case; DBSCAN can allocate a dense radius CSR. Worker execution protects frame responsiveness, not process memory/time. | **IMPLEMENTATION LANDED / REVIEW ACTIVE via #429:** the canonical serialisable operation bridge preflights K-means, hierarchical clustering and DBSCAN in Rust before expensive work and emits deterministic `UNSUPPORTED_AT_SCALE` metadata on refusal. Tests cover naïve k-means++ work, pathological hierarchical work, dense DBSCAN CSR risk and preserved small workloads. Remaining before verification: typed/durable cross-ABI refusal and provenance for generic operations, governed bounded alternatives where useful, direct/internal helper bypass review, and measured resource evidence. |
| RF-032 | Evidence classification / topology inference | High | Fuzzy substring hints, including single-letter GEO hints `x`/`y`, could classify ordinary schemas as geospatial and feed wrong downstream representations. | **Fixed in #428:** topology inference uses exact normalized aliases rather than substring matches; GRAPH requires source/target roles; GEO accepts numeric lat/lon only with observed range checks, explicit easting/northing projected coordinates, or exact numeric x/y only when corroborated by CRS/geometry metadata; vector aliases are exact; explicit investigator override remains authoritative. Adversarial tests cover `index` + `salary`, `total`-like graph false positives, bare x/y, invalid coordinate ranges and non-numeric lat/lon. Cross-layer authority convergence remains under RF-036. |
| RF-033 | CI evidence architecture | Medium | `playwright-smoke` depends on the monolithic `correctness` job, so an unrelated unit/coverage failure suppresses browser smoke evidence exactly when independent product-path signal can be useful. | **IMPLEMENTATION PARTIAL in this tranche:** split static analysis, full Vitest coverage, production build/artifact, Rust and browser smoke into independent proof tracks with strict final fan-in; retain all current tests and coverage thresholds. Then profile Vitest durations and shard the full suite only with merged global coverage. See `CI_TEST_ACCELERATION_STRATEGY.md`. |
| RF-034 | Roadmap governance | Medium | After RF-009 was declared fixed, the active ledger marked RF-018..RF-021 fixed in #418 while the P1-C review-exit checklist still showed all four unchecked. The roadmap could still tell two different completion stories. | Current roadmap refresh reconciles these rows/checklists. Add a lightweight consistency check or review rule so fixed ledger items cannot remain contradictory in gate checklists. |
| RF-035 | P1-B/P1-A / large mutation transport | High | #417 fixes Worker input registration and output identity, but async mutation results still return a full `DatasetJSON`, reconstruct a JS `Dataset`, commit with `handle: 0`, then become material for the next Worker registration. Large transformed datasets can therefore pay an O(N) Worker→JS→Worker rematerialisation cycle. | **OPEN:** design a durable Worker-side/Rust-side mutation capability or bounded typed-column transfer that keeps large analytical state resident. Preserve presentation/replay needs via compact summaries or explicit export, and measure transfer/heap costs under RF-029 before choosing SharedArrayBuffer/threads. |
| RF-036 | Evidence classification / authority split | High | Adversarial review found topology classification has multiple authorities: direct Rust topology inference, `DatasetStructureProfile` spatial classification and TypeScript `DatasetEvidenceSignature` precedence can disagree, including GEO/vector/time precedence and projected-coordinate evidence. Tightening only one classifier would leave contradictory Moneta evidence. | Converge topology/spatial evidence onto one canonical Rust-owned classification/evidence contract; make structure profile and Moneta consume that result rather than independently re-infer semantics. Add cross-layer parity tests for graph/hierarchy/GEO/projected/vector/time/tabular and adversarial ambiguous schemas. |
| RF-037 | Stream C / collaboration auth | **Critical** | Live signalling uses replay-permissive `SignedTicket.ts` while replay-safe `SignedTicketVerifier.ts` is off-path; the two implementations also expose incompatible ticket schemas and role ontologies. | Canonicalize one versioned ticket authority and prove second-use rejection through the real `createRoomRegistry().handleConnection()` admission path. Do not merely swap verifier imports; resolve schema, role, nonce-lifetime and deployment semantics and remove/migrate the duplicate authority. |
| RF-038 | Stream C / collaboration auth | High | Scoped token parsing promotes every suffix except exact `observer` to privileged `participant`, so malformed/typo roles fail open. | Exact-allowlist `observer` and `participant`; reject every other suffix and prove rejection through live room-registry admission tests. |
| RF-039 | Stream C / upload ingress | High | `UploadSanitizer` is isolated/tested but not the live FileLoader policy. Production has other defenses, so the primary defect is duplicated/orphaned hardening plus tests that prove the helper instead of the real upload call graph. | Consolidate policy without adding a shadow JS parser; adversarial JSON/CSV tests must traverse `FileLoader -> Atlas -> Rust -> Dataset`, including pre-read size, dangerous-key, shape and filename/control-character cases. |
| RF-040 | Stream C / privacy & compliance | High | `TelemetryConsentManager` is off-path and its current design cannot substantiate GDPR-erasure claims: it retains raw subject IDs, uses a small fixed-salt pseudonym, and erases only an in-memory consent record rather than linked telemetry/traces/exports. | Inventory all retained/exported telemetry, design one authoritative consent/lifecycle model, and prove default-off/grant/revoke/export/erasure behavior end to end before making right-to-erasure claims. Do not simply wire the current helper in as-is. |
| RF-041 | Stream C / supply chain | Medium | Shipped `index.html`/CSP retain an unpkg Three.js trust path even though Vite bundles `three` from `node_modules`. | Prove dev/production/smoke paths without the remote import map, then remove it and tighten `script-src` if no shipped path requires unpkg. |
| RF-042 | Stream C / dev tooling | Low | UX trace terminal output interpolates client-controlled fields into ANSI-coloured logs without stripping terminal control sequences. | Strip/escape C0/C1/ESC control sequences before terminal presentation while preserving JSONL encoding; add ANSI/OSC regression coverage. |
| RF-043 | Stream C / Rust-WASM assurance | High | Raw `unsafe`/`unwrap` counts are not demonstrated vulnerabilities, but hostile-input evidence remains incomplete across attacker-reachable parser, typed-buffer and exported ABI boundaries. | Add targeted fuzz/property campaigns for malformed/truncated CSV/JSON, Unicode/numeric extremes, typed metadata/validity/shape mismatches, stale/foreign/overflowing pointer-length pairs and allocation/reinitialisation stress. Every discovered defect becomes a deterministic PR regression. |

## Core architecture state

Nemosyne has exited the Draco-to-Moneta authority migration and is in private-preview preparation, subject to the review findings above. The governing architecture remains:

1. Rust/WASM owns canonical analytical data, N-dependent computation, analytical facts and data-derived layout/reduction.
2. Moneta owns bounded representation reasoning over compact evidence and investigator semantics.
3. TypeScript/JavaScript owns orchestration, persistence, presentation and interaction, not an independent analytical implementation.
4. Atlas owns investigation orchestration and durable analytical handles.
5. Draco is compatibility surface only. Production code imports Moneta directly.
6. `.nemosyne` preserves investigation, representation/model identity, analytical provenance, discoveries and NIL outcomes.
7. Learned Moneta remains explicit, pinned, reversible and opt-in until held-out investigator/discovery outcomes demonstrate benefit.

## What has landed

### Scientific and learning foundations

The #249-#264 sequence established immutable FitnessModel artefacts, explicit promotion/activation separation, frozen candidate feature evidence, pairwise judgement infrastructure, exact learned-model pinning, grouped held-out evaluation, durable row identity and stronger measurement/geometry contracts.

Remaining scientific work is outcome-facing: measurement-type enforcement, discovery-quality validation, calibrated statistical claims where appropriate, falsification workflows and investigator-facing skepticism support.

### Rust-owned data plane and scale architecture

The #305-#312 migration wave established Rust-resident columnar authority and removed the previous mirrored JS/Rust row-major model from the critical data path. Current scale invariants are:

- source row count is decoupled from rendered primitive count;
- Moneta candidate and sensitivity work is bounded;
- canonical Moneta reasoning does not traverse raw rows;
- no large-data failure may trigger an expensive JavaScript analytical fallback;
- analytical provenance must state any approximation or reduction mode.

Typed-column ingest, exact canonical identity, primitive-column storage and row-free DatasetStructureProfile evidence have been demonstrated. #426 corrected missing-value metric geometry; #429 landed the first shared resource-envelope enforcement on canonical clustering operations; #431 landed the canonical production TDA preflight; #435 made that enforcement kernel-inline so direct/raw callers cannot bypass the budget. RF-029/RF-030/RF-031/RF-035 now govern the remaining resident-memory, resource-provenance, high-dimensional and large-mutation transport gaps.

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

The migration authority remains complete. Product embodiment, temporal validity, topology-authority convergence, perceptual-evidence and remediation correctness are separately governed by active review findings.

### Reproducibility and investigation provenance

The #324-#332 sequence substantially closed the portable provenance chain:

- analytical replay verifies operation provenance and output identity;
- representation/model identity survives embodiment and `.nemosyne` export/import;
- DiscoveryEpisode records persist portably;
- NIL/no-feasible-representation is a typed reproducible outcome;
- discovery/NIL/model/evidence drift fails closed during replay.

#420 adds typed durable remediation provenance at the aggregate/ledger layer. Product-path apply-remediation wiring remains open under RF-027.

### Runtime ownership, ABI resilience and recovery

PRs #365-#366 established explicit World lifecycle ownership, generation-fenced recovery, RuntimeBridge ABI-family separation and focused coordinator/application boundaries.

The #375-#384 hardening wave then materially closed the available RES-01/SEC-02 code-executable gaps: tracked host-buffer ownership, exact two-call output contracts, stale-handle rejection, generation revocation, repeated recovery, unsafe-surface inventory and malformed-input campaigns.

Long-running fuzz/Miri/device endurance remain explicit evidence lanes rather than ordinary PR blockers.

### Collaboration resilience and authority

The #385-#389 sequence materially closed the available RES-02 browser/runtime gaps: bounded reconnect, multi-context WebRTC recovery, role-authority preservation, stale transport protection, deterministic offer ownership and server-owned peer lifecycle.

Cross-device/hostile-network qualification remains preview hardening. Stream C now separately owns RF-037/RF-038 live authentication authority and replay/role-admission assurance.

### P1-A typed/columnar TDA implementation

#395 closed production JS TDA rematerialisation; #405 enabled typed/columnar-only handles to execute persistence, Mapper and Betti-0 directly in Rust with `ingestMode` provenance and real-WASM boundary tests. #423 introduced the shared point-access substrate; #426 corrected missing-value semantics via complete-case eligibility and source-row mapping; #431 added the Rust-owned canonical production TDA preflight and typed unsupported-at-scale bridge outcome; #435 made the resource envelope kernel-inline so direct/raw callers cannot bypass it.

This remains **IMPLEMENTATION LANDED / REVIEW ACTIVE** until policy/exclusion/resource-refusal metadata is durable in analytical provenance, the residual scale work is bounded by RF-029/RF-031, CI evidence is clean and independent review agrees.

### P1-B async execution implementation

#408 established first-pass execution-port types and #417 completed the known production registration/generation/output-identity/adoption fixes. P1-B is now **IMPLEMENTATION LANDED / REVIEW ACTIVE** primarily for RF-015 real Worker/WASM evidence and RF-035 large mutation transport, not because the known #408 plumbing defects remain.

### P1-C through P1-F first-pass implementation

#410-#413 established sparse-neighbourhood, perceptual-fitness, semantic-target/focus-context and actionable-NIL components. Stream B fixes through #416/#418/#419/#420/#421/#426 materially improved them. #429 added operation resource guards and #431 added canonical production TDA/high-dimensional enforcement. They remain **IMPLEMENTATION LANDED / REVIEW ACTIVE** until their residual scientific, scale and physical-product evidence exits are met.

### Test architecture and feedback latency

The test pyramid is split by ownership:

```text
Playwright / WebXR smoke         small, expensive, user-path focused
TypeScript UI/integration        orchestration and presentation only
WASM boundary tests              small ABI/provenance seam
Rust unit/property/metamorphic   exhaustive analytical authority
```

The execution strategy is governed by [`CI_TEST_ACCELERATION_STRATEGY.md`](CI_TEST_ACCELERATION_STRATEGY.md): **accelerate scheduling before reducing proof**. The current RF-033 tranche parallelizes independent CI tracks without deleting tests or lowering coverage; the next step is duration-profiled Vitest sharding with merged global coverage, not changed-files-only gating.

Remaining efficiency work:

- [ ] collect representative before/after timings for the RF-033 parallel CI graph: time-to-first-failure, required-gate wall time and total runner minutes;
- [ ] profile Vitest by measured duration and capability requirements;
- [ ] shard the full deterministic suite only when raw coverage can be merged and the existing global thresholds remain authoritative;
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
| 1 — Dataset Evidence | **MIGRATION AUTHORITY COMPLETE / SCIENCE ACTIVE** | Finish RF-007 provenance semantics; RF-028/RF-032 landed in #428 (review-active residual: irregular-series spectral + RF-036 authority convergence); continue measurement semantics and resource-envelope work. |
| 2 — Representation Language | **PARTIAL / REVIEW ACTIVE** | Close RF-001/RF-002 and make current single-family candidates mathematically/spatially faithful before composition. |
| 3 — Moneta correctness | **MIGRATION EXIT COMPLETE / PRODUCT REVIEW ACTIVE** | Close RF-001/RF-002 plus upstream evidence/resource blockers before representation ranking can be considered scientifically trustworthy. |
| 4 — NIL | **PROVENANCE BASELINE COMPLETE / PRODUCT WIRING ACTIVE** | Wire RF-027 remediation application through the actual investigator flow and preserve modality parity. |
| 5 — Discovery | **INFRASTRUCTURE ADVANCED / SCIENCE PARTIAL** | Add falsification workflows, outcome evidence and controlled discovery-quality studies. |
| 6 — Human refinement | **IN PROGRESS** | Expand outcome events, curation policy and study coverage. |
| 7 — Learning infrastructure | **ADVANCED** | Add outcome-linked evaluation and operational monitoring evidence. |
| 8 — Learned Moneta | **EARLY OPT-IN / NOT EMPIRICALLY VALIDATED** | Demonstrate held-out investigator/discovery benefit before considering default use. |
| 9 — Compositional Moneta | **DEFERRED** | Wait for RepresentationGraph/grammar maturity, bounded search and Gate 0-8 evidence. |
| 10 — Adaptive Nemosyne | **DEFERRED** | Requires validated learning, freeze controls, monitoring, rollback and longitudinal evidence. |

## Pre-P1 promotion ledger

The detailed audit evidence remains in `PRE_P1_SYSTEMATIC_AUDIT.md`. The roadmap interpretation is:

- [ ] **PERF-04 / blocker:** run and govern physical Quest 3S 10M browser qualification, using the explicit RF-029 qualification profile rather than an unbounded “10M arbitrary dimensions” claim.
- [x] **ARCH-01 / high:** Atlas/runtime/spatial ownership boundaries are explicit and guarded; Stream B audits implementation conformance continuously.
- [x] **ARCH-02 / high:** World/UI/kernel lifecycle ownership and recovery are explicit and idempotent.
- [x] **PERF-03 / high:** production scene selection uses measured BVH crossover behavior; physical crossover validation remains under PERF-04.
- [x] **UX-02 / high:** real-browser desktop investigation/replay/tamper journey is covered.
- [ ] **UX-03 / high:** execute controller, hand and desktop semantic-parity tasks on physical hardware.
- [x] **RES-01 / high, code-executable scope:** checked output, host allocation ownership, malformed handles and sustained generation recovery are covered. Device/endurance residuals remain evidence lanes.
- [x] **RES-02 / high, browser scope:** partition/reconnect/state convergence/role violation and server-owned lifecycle authority are covered through #389. Cross-device/hostile-network residuals remain preview hardening.
- [x] **SEC-02 / high, deterministic CI scope:** unsafe inventory plus bounded malformed parser/buffer/handle/exhaustion campaigns are covered. Long-running fuzz/Miri remain separate hardening lanes; RF-043 adds targeted hostile-boundary fuzz evidence without treating raw unsafe counts as vulnerabilities.
- [ ] **MAINT-01 / high:** continue removing `@ts-nocheck` from package, bridge, World and Moneta boundary tests.
- [ ] **PERF-05 / medium:** profile allocations/GC and sustained analytical scheduling across representative interactions.
- [ ] **UX-04 / medium:** expose command availability and disabled reasons in every input modality.
- [ ] **UX-05 / medium:** benchmark canvas-panel legibility/performance/accessibility against a maintained XR UI library.
- [ ] **UX-06 / medium:** fix the 390 px header collision and add reduced-motion, focus, contrast and local-font resilience without changing public visual identity.
- [ ] **MAINT-02 / medium:** replace weak generic assertions in blocker/high-path tests with exact contracts.
- [ ] **MAINT-05 / medium:** classify/reduce lint-warning debt and enforce a non-increasing budget.
- [ ] **MAINT-06 / medium:** eliminate Rust warning debt, governing fingerprint-affecting changes as provenance migrations.
- [ ] **DOC-03 / medium:** remove remaining investigator-facing Draco terminology while retaining the compatibility facade.

## P1 — Analytical responsiveness and spatial fitness

**ACTIVE.** Detailed analytical acceptance criteria and dependency order are in [`P1_ANALYTICAL_RESPONSIVENESS_AND_SPATIAL_FITNESS.md`](P1_ANALYTICAL_RESPONSIVENESS_AND_SPATIAL_FITNESS.md). PR #402's design records remain implementation specifications where review evidence has not invalidated them.

### P1-A Handle-native analytical boundary — IMPLEMENTATION LANDED / REVIEW ACTIVE

Landed implementation evidence:

- [x] tested handle-native TDA entry points and Atlas routing;
- [x] no production JS `Dataset.toJSON()` TDA round trip;
- [x] typed/columnar-only handles execute persistence, Mapper and Betti-0 through real WASM;
- [x] typed-vs-row ingest mode is recorded in provenance;
- [x] #426 carries primitive validity and uses complete-case selected-feature eligibility rather than missing→0 geometry;
- [x] source row identity is preserved through TDA point compaction.

Review exit work:

- [ ] **RF-007 provenance:** record exact missing-data policy, source count, eligible count and excluded count in TDA operation provenance;
- [ ] **RF-029/RF-030 scale:** #431 guards the canonical production TDA bridge with Rust-owned preflight and #435 makes that enforcement kernel-inline (direct/raw callers cannot bypass the budget); durable refusal provenance and measured scale qualification remain open;
- [ ] re-run authoritative CI + adversarial review before `VERIFIED COMPLETE`.

## P1 — Product convergence gates

### P1-R Representation embodiment convergence — IMPLEMENTATION LANDED / REVIEW ACTIVE

Landed first-pass work includes distinct aggregate/density/cluster geometry, bounded visible primitive counts, executable single-winner graph metadata, and RF-003/RF-004 fixes.

Review exit work:

- [ ] **RF-001:** move N-dependent aggregate, density, cluster and compatible reduction/layout into Rust-owned bounded semantic payloads;
- [ ] make Three.js a thin embodiment adapter over those payloads rather than an analytical reducer over rows;
- [ ] **RF-002:** re-audit candidate `supports`/`preserves`/`loses` and descriptions against actual mathematics;
- [ ] implement or honestly downgrade overclaimed density/distribution/cluster/manifold/multiscale candidates;
- [ ] record exact reduction/estimation/layout method and parameters in provenance;
- [ ] demonstrate mathematically faithful, visibly/interactively distinct alternatives before P1-D ranking is product-valid.

### P1-U Whole-product investigation UX convergence — IMPLEMENTATION PARTIAL / REVIEW ACTIVE

Landed first-pass work includes the 10-phase journey model, coordinator, task-surface policy, TechnoCore state model, semantic targeting/focus-context foundations, body-locked panel treatment, task-oriented HandWheel treatment, and integration coverage. The converged design-system programme below is new planned work and is not yet implemented as a whole.

**Normative implementation guide:** [`Nemosyne_VR_UI_Design_System_and_Agent_Spec.md`](Nemosyne_VR_UI_Design_System_and_Agent_Spec.md). The guide defines the target interaction grammar, visual system, spatial reference frames, component contracts, Direct Touch behavior, accessibility/comfort constraints, performance rules and agent acceptance gates. The roadmap below turns that specification into bounded implementation tranches.

**Programme rule:** one tranche or a tightly coupled sub-tranche should be the normal PR unit. Preserve `InputRouter` as input-orchestration authority, Atlas/investigation as semantic/provenance authority, Rust/WASM as analytical authority and Three.js as spatial embodiment. UIKit or any pointer library may provide rendering/event mechanics but must not become a second semantic command authority. P1-U becomes `VERIFIED COMPLETE` only after P1-U0 through P1-U9 are complete, RF-005/RF-006/RF-008/RF-027 are closed, and physical Quest evidence agrees.

#### P1-U0 — UI design-system contract and substrate decision — IMPLEMENTATION PARTIAL

Purpose: establish one enforceable visual/component system before migrating surfaces.

- [ ] benchmark the current canvas/bespoke panel path against vanilla `@pmndrs/uikit` on Quest-relevant workloads under UX-05; measure text legibility, draw calls, allocations/GC, scrolling, clipping and disposal rather than adopting a library by taste;
- [ ] if the benchmark supports adoption, create a Nemosyne-owned `src/vr/ui-system/` wrapper with `tokens`, `theme`, `SpatialUIRoot`, `SpatialPanel`, generic controls, interaction adapters and accessibility controllers; otherwise implement equivalent Nemosyne-owned contracts without a second framework;
- [ ] encode the design guide's surface, typography, spacing, motion, target-size and reference-frame tokens; keep data encodings independent of the UI palette;
- [ ] require every component to declare semantic purpose, reference frame, supported modalities and consequence/undo behavior;
- [ ] add architecture guards proving generic UI controls cannot import analytical kernels/Moneta internals or maintain parallel analytical state;
- [ ] add lifecycle tests for UI-root disposal, texture/material/listener cleanup and World recovery/reinitialisation.

**Exit gate:** a minimal panel/control fixture renders with the Nemosyne visual tokens, survives teardown/recovery without leaks, and preserves existing authority boundaries. Dependency choice is justified by measured evidence and recorded as a decision, not implicit package drift.

#### P1-U1 — unified near/far interaction and Direct Touch substrate — IMPLEMENTATION PARTIAL

Purpose: make Direct Touch, Direct Grab, controller/hand ray and desktop input resolve through one semantic interaction path.

- [ ] implement `NearFieldInteractor` from WebXR hand/controller-tip poses with configurable near envelopes; reserve index fingertip as the precision poke point where available;
- [ ] implement the modality priority `captured manipulation > direct touch > direct grab > controller-tip direct > distance ray > mouse > dwell fallback`;
- [ ] implement hysteretic near/far switching around the default ~0.55 m near envelope; fade/suppress the corresponding far ray when near intent is unambiguous and restore it smoothly on retreat;
- [ ] implement `FAR -> NEAR_HOVER -> CONTACT -> PRESS -> COMMIT -> RELEASE -> RECOVER`, including drag and pre-commit cancel paths; commit on threshold/release rather than first collision;
- [ ] add pointer capture, cancellation, occlusion, panel-before-scene precedence and one-semantic-action-per-commit guarantees;
- [ ] add visual proximity/contact/commit feedback and optional audio/haptics without treating simulated pressure as a scientific signal;
- [ ] preserve current ray smoothing, semantic coercion and raw-observation precision escape hatch for dense data.

**Exit gate:** one reference control can be operated by mouse, controller ray, hand ray and fingertip touch with equivalent semantic output; transition across the near/far boundary does not flicker, double-activate or select scene data through UI; automated tests cover hysteresis, capture, cancel and priority.

#### P1-U2 — spatial panel substrate and Holographic Inspector pilot — IMPLEMENTATION PARTIAL

Purpose: prove the new panel/layout/interaction system on a high-value bounded surface before global migration.

- [ ] implement `SpatialPanel` reference-frame behavior: `BODY_LOCKED` default for personal work, optional grab/pin to `WORLD_LOCKED`, animated continuity on frame transitions and explicit close/back/follow controls;
- [ ] migrate `HolographicInspector` to the new panel/control substrate while preserving its semantic target identity and current `InputRouter` precedence;
- [ ] expose compact observation/structure facts plus `Evidence`, `Provenance`, `Compare` and `Challenge` actions; dense detail scrolls rather than spawning adjacent panels;
- [ ] support direct touch in the near zone and ray selection at distance without changing command meaning;
- [ ] make the inspector object/selection-aware, avoid covering the focused feature and preserve focus through representation transitions where identity remains valid;
- [ ] validate typography/angular legibility and target hit volumes in-headset before freezing tokens.

**Exit gate:** Inspector parity is achieved without a bespoke duplicate interaction stack; the inspector is readable, scrollable, movable/pinnable and modality-equivalent, and target/device evidence shows no regression in focus, accidental selection or frame time.

#### P1-U3 — commodity precision surfaces and panel lifecycle — IMPLEMENTATION PARTIAL

Purpose: move conventional precision work out of hand-built spatial furniture.

- [ ] migrate Settings to the shared control system, including statistical-lens options, feedback, gestures/input preferences, UI scale, contrast and reduced-motion controls;
- [ ] migrate dataset load/schema-mapping/import setup and consequential confirmation dialogs where they exist; keep forms, dense tables, exact text and numeric entry planar;
- [ ] consolidate operation history/provenance/evidence into role-specific precision surfaces rather than separate permanent panels;
- [ ] provide common button/toggle/slider/segmented/scroll/text-field behavior and disabled-reason presentation across desktop/ray/touch;
- [ ] standardise panel placement, grab rails, pin/follow, dismissal, focus order and replacement behavior;
- [ ] preserve a maximum normal analyst workspace of one primary work panel, one inspector/context panel and one secondary reference surface; a fourth requires replacement/consolidation or explicit pinning.

**Exit gate:** commodity UI uses shared components and reference-frame rules; no migrated function loses desktop/controller/hand semantics; opening ordinary workflows no longer grows an uncontrolled panel constellation.

#### P1-U4 — contextual task surface and command constellation — IMPLEMENTATION PARTIAL / REVIEW ACTIVE

Purpose: close RF-005 by replacing subsystem-first navigation with visible task actions at the locus of work.

- [ ] turn `ContextualTaskSurface` from an action filter into a real `OBJECT_ATTACHED` or selection-anchored spatial surface;
- [ ] expose novice task verbs `Inspect`, `Compare`, `Challenge`, `Record`, `Navigate`, `More`, filtered by the current semantic target and journey context;
- [ ] keep the constellation/HandWheel as custom Three.js spatial geometry where spatial arrangement adds value, but route its targets through the same interaction events and semantic commands as panels;
- [ ] ensure target-scoped actions explain disabled/unavailable reasons under UX-04 rather than silently disappearing where that would confuse investigators;
- [ ] demote custom gestures to optional accelerators; every essential operation has a visible touch/ray/controller/desktop path;
- [ ] suppress global gestures/locomotion appropriately while hands are manipulating a local object or active menu, without creating an invisible persistent mode.

**Exit gate:** a researcher can inspect, compare, challenge, record and navigate from context without knowing subsystem names or memorised gestures; RF-005 is closed by product-path evidence, not merely a policy class test.

#### P1-U5 — TechnoCore epistemic instrument and actionable NIL/Moneta surfaces — IMPLEMENTATION PARTIAL / REVIEW ACTIVE

Purpose: make TechnoCore the coherent physical instrument for interrogating Nemosyne's representation reasoning and close the RF-006/RF-027 product seams.

- [ ] retain TechnoCore as custom Three.js instrument geometry; use constrained direct manipulation for spatially meaningful controls and summon shared precision surfaces only for exact text/numeric/detail work;
- [ ] expose `Why this representation?`, viable alternatives/near misses, stability/perturbation evidence, information loss, provenance and feasibility in distinct labeled views;
- [ ] preserve explicit `DECISIVE`, `INFEASIBLE`, `UNDERDETERMINED` and `AMBIGUOUS` states; never turn ambiguity into a cosmetic winner or conflate utility/preference/attention/stability with statistical confidence/truth;
- [ ] wire typed NIL remediation actions through the actual investigator semantic action path and call `recordRemediation` when applied; prove durable replay through the product path;
- [ ] make consequential representation changes previewable/reversible and preserve selection/reference context through accepted transitions;
- [ ] gate recommendation/explanation surfaces on reviewed P1-R/P1-E semantics: the UI may be built earlier, but no visual polish may promote scientifically overclaimed representation evidence.

**Exit gate:** TechnoCore is demonstrably operable with touch/ray/controllers/desktop, produces no analytical authority of its own, applies typed remediation with replayable provenance and communicates epistemic state without misleading confidence cues.

#### P1-U6 — Evidence/Ice Vault, archival recovery and semantic portals — IMPLEMENTATION PARTIAL / REVIEW ACTIVE

Purpose: ensure persistent world objects earn their place and close the decorative-object half of RF-006.

- [ ] give IceVault/Evidence Vault an explicit immutable-return role: saved/frozen investigation states, DiscoveryEpisodes, study-freeze snapshots, `.nemosyne` import/export and current-vs-frozen comparison where supported;
- [ ] make archive/freeze/restore state visible, attributable and provenance-preserving; destructive replacement requires preview/confirmation and a recovery path;
- [ ] if the Vault cannot provide a meaningful archive/recovery function in the private-preview path, remove/demote it from the default world rather than retain decorative symbolism;
- [ ] restrict Farcaster portals to semantic travel/context changes such as branch, saved investigation, overview/detail or collaborator frame; ordinary analytical operations remain controls, not portals;
- [ ] preview destination and any state consequence before travel; preserve a clear return route.

**Exit gate:** every persistent Vault/portal object has a user-testable investigator function, no portal hides an analytical mutation, and archival/recovery round-trips preserve investigation identity/provenance.

#### P1-U7 — Memory Palace epistemic object system and discovery workflow — IMPLEMENTATION PARTIAL / REVIEW ACTIVE

Purpose: turn the Memory Palace into the spatial reasoning graph rather than a second decorative world.

- [ ] formalise visible lifecycle/state for observations, questions, hypotheses, tests, findings, contradictions and branch points using non-color cues as well as restrained semantic color;
- [ ] implement beacons as attributable reasoning/evidence entities and reasoning threads as focus-revealed relationships, avoiding permanent spaghetti;
- [ ] preserve semantic identity, selection and focus/context across graph navigation, representation switches and replay where valid;
- [ ] connect hypothesis -> test -> support/refute/inconclusive and explicit falsification/alternative-representation actions to exact evidence/provenance;
- [ ] integrate existing P1-F semantic targeting/focus-context and branch/replay behavior rather than adding a second graph interaction model;
- [ ] support shareable `.nemosyne` investigations as reproducible Memory Palace graphs once the discovery science contract is complete.

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

Purpose: close RF-008 and convert implementation claims into promotion evidence.

- [ ] derive the 10 journey phases from real product events/prerequisites rather than manual test advancement;
- [ ] add Playwright journeys through the real desktop UI for load -> orient -> inspect -> challenge/falsify -> compare -> record -> Memory Palace -> replay/export, including recovery/cancel paths;
- [ ] run the same core tasks on Quest 3S-class hardware with controllers and hands where supported; capture semantic parity, task failure/accidental activation, discoverability and recovery evidence;
- [ ] explicitly test near-touch -> retreat -> ray transitions, dense data precision escape, panel pin/follow, representation changes, large text/high contrast and reduced motion;
- [ ] collect frame time, draw calls, GPU/CPU/UI allocation/GC, memory, interaction latency and analytical scheduling under representative investigations; integrate PERF-04/PERF-05 rather than using UI-only toy scenes;
- [ ] run at least one sustained 20+ minute session and record arm-fatigue/comfort outcomes; device evidence outranks screenshots and desktop emulation;
- [ ] conduct task-based investigator studies for comprehension, falsification behavior, finding capture and share/replay, preserving treatment versions and evidence reproducibly.

**Exit gate:** RF-008, UX-03 and the UI-relevant portion of PERF-04/PERF-05 have real product/device evidence; no required modality changes semantic meaning; all core tasks are possible without expert gestures; the converged treatment passes independent adversarial VR/UI review before `VERIFIED COMPLETE`.

#### P1-U dependency order

1. **U0 -> U1 -> U2** is the foundation path: decide/establish the substrate, prove unified interaction, then prove it on the Inspector.
2. **U3** may proceed after U0/U1 and should migrate commodity surfaces before bespoke instrument work expands.
3. **U4** follows U1 and closes contextual interaction/RF-005; it may proceed in parallel with U3 once input semantics are stable.
4. **U5** may scaffold after U1/U2 but its scientific-facing completion is gated by P1-R/P1-E truth and RF-027 replay semantics.
5. **U6** follows durable investigation/archive contracts; decorative Vault/portal behavior must not block removing the object from default view.
6. **U7** builds on P1-F plus investigation/discovery-science contracts and may progress incrementally without waiting for every panel migration.
7. **U8** happens after functional parity is available so redundant surfaces can be deleted rather than merely hidden beside replacements.
8. **U9** is the convergence/evidence tranche and cannot certify incomplete U0-U8 work.

Review exit work:

- [ ] close **RF-005** through P1-U4/P1-U8;
- [ ] close **RF-006** through P1-U5/P1-U6;
- [ ] wire **RF-027** through P1-U5;
- [ ] derive journey state from real product events with meaningful prerequisites under P1-U9;
- [ ] close **RF-008** with real Playwright + Quest product-path evidence under P1-U9;
- [ ] collect task-level comprehension/discoverability/recovery/falsification/finding/share evidence before verification.

### P1-B Asynchronous analytical runtime — IMPLEMENTATION LANDED / REVIEW ACTIVE

Landed implementation evidence now includes #417's production Worker installation, real generation fencing, fingerprint-keyed dataset registration, authoritative output fingerprints, async presentation adoption and replay-parity repairs.

Review exit work:

- [x] RF-010/RF-011/RF-013/RF-014/RF-016 code-level exits (#417);
- [ ] **RF-015:** real module-Worker + real-WASM integration/browser test across TDA, mutation supersession and recovery for at least two runtime generations;
- [ ] record dispatch/transfer/compute measurements;
- [ ] **RF-035:** remove or explicitly bound full mutation Worker→JS→Worker rematerialisation for large transformed datasets;
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

- [ ] **RF-029:** define supported scale profiles and measured resident/transient budgets; #431 guards the canonical production TDA path but broader resident/transient qualification remains open;
- [x] **RF-030 direct-caller bypass:** the kernel boundary itself enforces the budget — #435 makes the `data_compute_*` exports refuse over-budget work in-band, so no direct/raw caller can bypass the envelope;
- [ ] **RF-030 residuals:** add durable refusal provenance/NIL and any explicitly governed approximation with exact-vs-approximation quality evidence;
- [ ] re-run adversarial topology/scale review before verification.

### P1-D 3D-native Moneta perceptual fitness — IMPLEMENTATION LANDED / REVIEW ACTIVE

Landed first-pass work:

- [x] versioned perceptual evidence types and bootstrap perceptual component;
- [x] bounded multi-pose viewpoint sampling;
- [x] measured/prior perceptual evidence feeds hard constraints and bootstrap utility;
- [x] RF-022 measurement correctness fix-forward;
- [x] RF-023 evidence identity binding;
- [x] RF-024 surrogate honesty + frozen treatment governance.

Review exit work:

- [ ] validate measured evidence on actual reviewed-faithful P1-R embodiments and target hardware;
- [ ] preserve the distinction between selection heuristics, engineering priors, measured evidence and calibrated statistical confidence;
- [ ] re-run adversarial perceptual/scientific review before verification.

### P1-E Actionable NIL/ambiguity — IMPLEMENTATION LANDED / REVIEW ACTIVE

Landed first-pass work:

- [x] `DECISIVE`, `INFEASIBLE`, `UNDERDETERMINED`, `AMBIGUOUS` outcomes;
- [x] readable explanations, near misses and blocking descriptions;
- [x] typed hard-constraint remediation routing (#420 / RF-027);
- [x] durable remediation provenance and replay round-trip at aggregate/ledger layer;
- [x] separate scientific permissibility from device/runtime feasibility.

Review exit work:

- [ ] expose the actionable NIL flow through actual investigator UI/modalities and call `recordRemediation` when applied;
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
- [ ] re-run adversarial UX/input review before verification.

## P1 — Minimal private preview

Deliver a controlled, observable deployment suitable for investigator research/usability testing rather than broad public launch.

- [ ] define supported browsers/headsets and a small tested hardware matrix;
- [ ] deploy reproducible versioned frontend/WASM artifacts;
- [ ] add authentication/access control for a private cohort;
- [ ] define dataset retention/upload/deletion/privacy policy;
- [ ] add explicit consent/telemetry controls;
- [ ] establish dataset-safe crash/error/performance telemetry;
- [ ] add health checks, rollback and release provenance;
- [ ] validate `.nemosyne` compatibility across preview releases;
- [ ] implement onboarding, sample investigations and unsupported-feature states;
- [ ] run a small investigator cohort and feed structured evidence into the roadmap.

**Promotion rule:** private preview may not be promoted while any blocker/high review finding that undermines scientific correctness, analytical authority, security/privacy authority, core task completion or target-device safety remains open.

## P1 — Security and reliability hardening

Stream C owns the active live-path security-assurance findings in detail; this section remains the preview-level promotion checklist.

- [ ] close or explicitly accept RF-037 through RF-043 before private-preview promotion where applicable;
- [ ] re-run threat review against the deployed preview boundary;
- [ ] validate untrusted dataset/archive limits, traversal defences and resource budgets through the actual ingress paths;
- [ ] harden CSP, supply-chain controls and release integrity;
- [ ] ensure kernel failure cannot silently produce plausible-looking substitute results;
- [ ] add backup/export/recovery procedures for user-created investigations;
- [ ] establish preview vulnerability/update policy;
- [ ] run deeper fuzz/Miri/device-endurance campaigns outside the ordinary PR critical path while retaining deterministic regressions in the merge gate.

## P1 — VR/UI/UX fitness

The frozen panel/intent-wheel treatment work is merged through #394. Gate F review for that controlled local treatment is complete; Quest 3S validation remains required. **P1-U0 through P1-U9 above now own the implementation breakdown**, governed by `Nemosyne_VR_UI_Design_System_and_Agent_Spec.md`; this section remains the cross-cutting promotion/evidence gate.

- [x] spatial-audit + hypothesis + Blender prototype comparison for panel arrangement completed as a recorded decision (`docs/decisions/VR_PANEL_SPATIAL_LAYOUT.md`, evidence tier 4);
- [x] role-aware depth-tier zoning implemented as panel default positions with invariant tests;
- [x] persistent panels consolidated onto the torso/body reference frame; head/camera lock reserved for transient alerts;
- [x] production HandWheel converged onto the task/intent taxonomy with a separate superuser annex;
- [x] novice command vocabulary includes Move, Undo/Redo and Return-to-Overview;
- [x] HolographicInspector and FrustrationResponseManager moved off the retired rig frame;
- [x] frozen panel-layout + intent-wheel treatment recorded in `docs/study/UI_TREATMENT.md`;
- [ ] execute P1-U0 through P1-U8 and close RF-005/RF-006/RF-027 before treating the converged interface as implemented;
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
- [ ] support shareable `.nemosyne` investigations as reproducible Memory Palace graphs.

## Scientific validity programme

### Measurement semantics and statistics

- [x] **RF-028 (landed in #428):** trend uses actual timestamps; regular-time FFT uses physical units and fails closed on irregular/gapped sampling.
- [x] **RF-032 (landed in #428):** exact/corroborated topology semantics with adversarial false-positive tests.
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
- **Missing is not zero.** Stored normalization sentinels must never silently become analytical coordinates. Metric/TDA operations use a declared eligibility/imputation policy; implicit imputation is forbidden.
- **Time is data, not row order.** Temporal trend and spectral evidence must use authoritative time coordinates. FFT evidence requires demonstrated regular sampling; irregular/gapped series must use an explicitly governed method or return unsupported/no spectral evidence.
- **Semantic hints require corroboration.** Ordinary column-name substrings may not manufacture graph/geospatial/vector semantics. Generic `x`/`y` axes alone are not proof of geography.
- **Atlas owns durable analytical capabilities.** Reuse canonical handles instead of serialising the same dataset back into Rust.
- **Moneta is a bounded control plane.** It reasons over compact evidence and semantics, never raw full-dataset traversal.
- **Semantic representation must survive embodiment.** A non-point Moneta candidate may not silently degrade into point-per-row geometry or a mathematically different visual approximation without explicit semantics/provenance.
- **Observations are detail, not universal geometry.** Aggregate, density, cluster, field, topology and other structure-level representations are first-class; observations appear when analytically/interactively appropriate.
- **JS presents, orchestrates and schedules.** It must not reconstruct a shadow analytical authority.
- **Tests live with authority.** Exhaustive mathematics belongs beside Rust-owned behavior; higher layers verify seams, presentation and interaction.
- **Production-path evidence governs shipped claims.** An isolated helper, mock or unit test cannot by itself prove a production property; the real authoritative entry point/call graph must demonstrate the behavior where the claim applies.
- **Boundary tests remain mandatory.** Rust-first testing does not replace WASM ABI, browser, WebXR or end-to-end verification.
- **Source rows are not render primitives or analytical reduction inputs.** LOD/reduction is first-class architecture, and render-object growth must be governed independently of source N.
- **Worker handles are local capabilities.** Cross-thread identity travels by fingerprint plus explicit registration, never foreign handles.
- **Sparse means sound before fast.** An approximate or sparse neighbourhood may only omit edges/points when the approximation contract explicitly permits it and provenance records the mode; optimization must never silently change mathematical meaning.
- **Unbounded work fails explicitly.** A Worker is scheduling isolation, not a resource budget. Exact analytical work above the governed envelope must use an explicit bounded/approximate mode or return an actionable unsupported/NIL result.
- **Resource estimates are evidence, not device qualification.** Static Rust safety estimates prevent known pathological work but do not prove target-browser/headset latency or peak-memory fitness; those claims require measured workload/device profiles.
- **Perceptual evidence is identity-bound.** Measured evidence must correspond to the current dataset, candidate/embodiment, model version and governed viewpoint/device context before it can affect ranking or hard constraints.
- **The world is an interface, not scenery.** Persistent spatial objects must have a clear investigator function or be removed/demoted.
- **Approximation is evidence.** Sparse/landmark/approximate modes must be explicit in provenance.
- **Bootstrap is the safe Moneta default.** Learned ranking remains exact, pinned and explicit.
- **Hard constraints precede learning.** Learning cannot resurrect an infeasible candidate.
- **Learning never owns research facts.** Learned features consume Rust-derived evidence.
- **Skepticism targets claims, not people.** Pattern-fragility signals must be explainable and actionable.
- **Review can reopen completion.** A green suite or merged PR is implementation evidence, not immunity from adversarial review.
- **No Gate 9/10 leapfrogging.** Composition/adaptation cannot substitute for correctness, reproducibility, spatial fitness or outcome evidence.

## Verification cadence

For each PR, use the cheapest authoritative layer that proves the claim. Stream B additionally asks what evidence would falsify the completion claim and adds that evidence where practical. Stream C attacks security/privacy-sensitive live boundaries and verifies that the production authority, not an orphan helper, enforces the claimed property. Before private-preview promotion, run the broad checkpoint:

```text
cargo test / Rust property tests
focused JS/WASM boundary tests
TypeScript typecheck + lint
fast Node + focused UI + integration + explicit WASM suites
architecture/import/row-materialisation authority gates
portable investigation replay/tamper tests
coverage assurance
production build
browser/WebXR product-path smoke
real Worker/WASM integration for async analytical paths
real sparse-mode exact-vs-approximation parity/stability tests
scale benchmarks measuring the complete algorithm and peak memory
security admission/ingress tests through the live production path
hostile parser/WASM ABI fuzz/property campaigns with deterministic regressions
physical Quest qualification for promotion-critical device claims
independent review pass over the resulting merged implementation
```

## Near-term execution order by stream

### Stream A — forward implementation

1. Continue minimal-private-preview, security/reliability, investigation/discovery-science and measurement-semantics work only where the active Stream-B/Stream-C blockers are not dependencies.
2. Do not consume irregular-series FFT periodicity as scientific evidence; RF-028 (#428) deliberately withholds spectral evidence unless sampling is regular. RF-036 topology-authority convergence remains open.
3. Do not introduce scale claims or exact high-D work that bypasses the RF-029 resource envelope.
4. Continue bounded maintenance/dependency work that does not distract from promotion blockers.
5. Progress P1-U0 through P1-U4 where their dependencies are stable; scaffold later P1-U tranches only where doing so does not encode unresolved P1-R/P1-E scientific claims. Do not begin P2 RepresentationGraph composition or P3 adaptation until the stated reviewed prerequisites are satisfied.

### Stream B — review and fix-forward

1. ~~**RF-007 + RF-017 — validity-aware analytical substrate.** Complete-case selected-feature eligibility; preserve source identity; never conflate missing with zero; unify TDA/neighbourhood/metric clustering semantics.~~ ✅ **Scientific-correctness implementation merged in #426.** TDA provenance residual stays open; memory/copy residual moves with RF-029.
2. ~~**RF-028 + RF-032 — temporal/evidence integrity.** Honor real elapsed time/sampling geometry; expose physical spectral units; fail closed for unsupported irregular FFT; tighten topology inference with exact/corroborated semantics.~~ ✅ **Landed in #428.** Review-active residual: govern irregular-series spectral analysis; converge topology classification authority under RF-036.
3. **RF-029 + RF-030 + RF-031 + RF-035 — analytical resource envelope. CURRENT TRANCHE.** #429 landed the shared clustering guard, #431 landed canonical production TDA preflight/typed refusal, and #435 closed the kernel/direct-caller bypass by making the `data_compute_*` exports enforce the budget in-band. Next land durable refusal provenance, remove RF-035 large mutation rematerialisation, govern any approximation explicitly, and finish with measured workload/device qualification.
4. **RF-001 + RF-002 — representation truth.** Rust-owned bounded embodiment payloads and mathematically honest candidate semantics.
5. **P1-U0..P1-U9 / RF-005 + RF-006 + RF-008 + RF-027 — whole-product convergence.** Execute the UI design-system programme in dependency order: substrate/direct touch -> Inspector -> precision surfaces -> contextual tasks -> TechnoCore/NIL -> archive/Memory Palace -> consolidation/accessibility -> product/device evidence. Scientific-facing TechnoCore completion remains gated by representation/NIL truth.
6. **RF-015 + RF-033 — production evidence architecture.** Real Worker/WASM timings and independent browser-smoke signal. Complete RF-033 Phase 1 parallelization, measure it, then shard Vitest only with merged global coverage and strict required fan-in.
7. **Physical XR qualification — RF-026 residual + PERF-04 + UX-03.** Quest 3S controllers/hands/desktop semantic parity, comfort, frame/memory budgets and target-device task evidence; P1-U9 owns the UI-specific execution/evidence.
8. **Private-preview hardening.** Auth/access control, retention/privacy, consent/telemetry, release/rollback/recovery and compatibility after the scientific/product substrate is credible and applicable Stream C high findings are closed.
9. Review each new Stream A merge immediately and append/fix RF findings in the same cadence.

### Stream C — security authority and live-path assurance

1. **RF-037 + RF-038 — signalling authentication authority.** Canonicalize one ticket protocol/role ontology, enforce nonce replay prevention in live admission, and make scoped-role parsing fail closed.
2. **RF-040 — telemetry/privacy lifecycle.** Inventory all retained/exported telemetry and redesign consent/revocation/erasure authority before wiring or claiming GDPR erasure support.
3. **RF-039 — upload ingress assurance.** Consolidate hardening policy around the real FileLoader/Atlas/Rust/Dataset path and replace helper-only evidence with adversarial live-path tests.
4. **RF-041 — supply-chain trust.** Remove the unpkg import/CSP allowance if production/dev proof confirms it is unnecessary.
5. **RF-042 — dev terminal safety.** Escape/strip control sequences from UX-trace terminal presentation.
6. **RF-043 — hostile-boundary fuzzing.** Expand parser/typed-buffer/WASM ABI fuzz/property evidence; every discovered defect becomes a deterministic PR regression.
7. Re-review security-sensitive Stream A/Stream B changes continuously; a hardened helper that is not wired to the live path is not a completed security property.

### Convergence / promotion

- Run PERF-04 and UX-03 physical Quest qualification on the converged P1-U treatment as soon as the P1-U9 prerequisites are met and hardware is available.
- Re-run blocker/high security, architecture, scientific and UX review before private-preview promotion.
- Require applicable Stream C blocker/high findings to be closed or explicitly risk-accepted with evidence before private-preview promotion.
- Continue discovery/outcome studies and learned-Moneta empirical validation.
- Begin RepresentationGraph/compositional Moneta only after P1 prerequisites are both implemented and review-verified.
- Begin Adaptive Nemosyne only after evidence and governance prerequisites are satisfied.
