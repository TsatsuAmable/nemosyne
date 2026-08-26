# Nemosyne Roadmap & Implementation Status

> **Current implementation-status authority.** Product and research direction are governed by `docs/Nemosyne_Definitive_Vision_and_Roadmap.md` V3. This document records current implementation state, programme order, review findings and promotion gates. Completed migration detail is preserved in `docs/archive/`.

## Status snapshot — 26 August 2026

**Current remote main at roadmap branch cut:** `4e8dde8` (`feat(ui): implement P1-U1 near/far interaction and direct touch substrate` — #444 merged). Since the prior status snapshot at #439, #440 refreshed refusal-provenance status, #441 added documentation-integrity enforcement, #442 formalised engineering governance, #443 hardened CI supply-chain pinning and removed duplicate coverage work, and #444 landed the first Direct Touch/near-field UI substrate. Static resource limits remain kernel safety guards, not Quest qualification and not evidence of generic 10M-row support.

**Latest adversarial review:** the 26 August review of `main@4e8dde8` found two new blocker-class truth/correctness defects and seven additional high/medium remediation items. In particular, `Dataset.clone()` drops graph edges before ordinary Atlas/Rust processing; `SignatureBuilder` still fabricates analytical-looking defaults that can bias Moneta; portable investigation identity/digest/replay semantics are weaker than their cryptographic framing suggests; JS still contains large-N argument/copy cliffs; and the newly merged P1-U0/P1-U1 claims outrun the implementation/evidence. These are recorded as RF-044 through RF-052 below. P1-U0 and P1-U1 are therefore reclassified to **IMPLEMENTATION PARTIAL / REVIEW ACTIVE** pending their explicit exit evidence.

**Reprioritised Stream-B critical path:** (1) **CURRENT: RF-044 graph lineage integrity** because source topology can be silently erased before Rust authority; (2) **RF-045 analytical-signature truth** integrated with RF-001/RF-002/RF-036 so unknown evidence is never replaced by plausible constants; (3) **RF-046/RF-047/RF-048 provenance identity and replay integrity** so `.nemosyne` packages cryptographically commit the semantic investigation actually replayed; (4) RF-029/RF-030/RF-031/RF-035 plus **RF-051** for the complete analytical resource/memory envelope, including JS-side N-dependent cliffs; (5) RF-001/RF-002 representation truth after upstream evidence is trustworthy; (6) **RF-049/RF-050** to correct P1-U0/U1 before later UI tranches depend on them, then RF-005/RF-006/RF-008/RF-027; (7) RF-015/RF-033 production evidence and **RF-052** governance truthfulness; (8) physical Quest 3S qualification; (9) private-preview hardening. Stream C continues in parallel on RF-037 through RF-043. The dependency rule is: **preserved source data → truthful analytical evidence → reproducible identity/replay → bounded computation → faithful representation → coherent investigator UX → physical XR proof → private preview.**

**Current interpretation:** P1-A, P1-B, P1-C, P1-D, P1-E and P1-F contain material implementation advances but remain **IMPLEMENTATION LANDED / REVIEW ACTIVE**, not `VERIFIED COMPLETE`. P1-U remains **IMPLEMENTATION PARTIAL / REVIEW ACTIVE**; P1-U0/P1-U1 specifically are reopened by RF-050/RF-049. The dominant risks are source-data corruption at clone/transport boundaries, scientifically invalid or fabricated evidence, incomplete durable identity/replay commitments, memory/transport cliffs, security-authority/live-path assurance gaps and product/device evidence gaps. Stream A may continue only where these defects are not dependencies; Stream B fixes correctness/evidence foundations; Stream C independently hardens security/privacy-sensitive live boundaries.

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
| RF-001 | P1-R / authority | High | `VRTopologyTranslator` still feeds `dataset.rows` into non-point embodiment, and aggregate/density/cluster reductions traverse O(N) rows/positions in TypeScript. Bounded mesh count is not the same as Rust-owned bounded analytical reduction. | Define Rust-owned bounded semantic embodiment payloads; make Three.js consume those payloads rather than derive analytical structure from raw rows. Integrate RF-045 so those payloads consume only measured/source-labelled evidence. |
| RF-002 | P1-R / scientific semantics | High | `DENSITY_FIELD` is currently a fixed 6×6×6 histogram over rendered positions while the ontology claims continuous density estimation; `DISTRIBUTION_FIELD` shares that geometry despite claiming quantiles/PDF/contours; cluster/manifold claims also exceed demonstrated semantics. | Reclassify candidate fidelity honestly and either implement the declared mathematics or narrow the ontology/preservation claims. RF-045 must remove fabricated signature values before this audit can close. |
| RF-003 | P1-R / correctness | High | Aggregate grid calculation treated legitimate numeric zero as falsy and substituted `1`, corrupting aggregate means. | **Fixed in #409**; preserve zero and retain regression coverage. |
| RF-004 | P1-R / tests | Medium | The C4 source guard sliced from `buildAggregateBars` to an earlier `buildDensityField`, producing an empty string and allowing a false pass. | **Fixed in #409**; source guard now proves non-empty method slices and inspects the intended branches. |
| RF-005 | P1-U / UX | High | The runtime still constructs a broad dashboard/panel constellation; `ContextualTaskSurface` is an action filter, not a colocated spatial task surface. | Execute P1-U4/P1-U8: implement selection-anchored contextual task controls, demote subsystem/panel-wall navigation and enforce the normal analyst persistent-surface budget. |
| RF-006 | P1-U / world semantics | High | TechnoCore lens methods are not yet demonstrated as wired investigator input/analysis controls; IceVault remains a persistent largely decorative glyph. | Execute P1-U5/P1-U6: wire TechnoCore through input/NIL/analysis with visible epistemic state/provenance; make IceVault a real archive/recovery instrument or remove it from the default world. |
| RF-007 | P1-A/P1-C / analytical correctness & scale | **Blocker** | The shared columnar substrate stored invalid primitive slots as `0.0`, while TDA/PointCloud consumed value buffers without validity. Missing observations therefore became real Euclidean coordinates, capable of manufacturing distances, clusters and topology. | **Correctness landed in #426:** `PrimitivePointColumn` carries values + validity; metric/TDA eligibility is complete-case over selected features; row and columnar paths agree; real zero remains valid; TDA source-row identity survives compaction; K-means/hierarchical/DBSCAN use the same contract and excluded rows receive null cluster assignment. Remaining before verification: emit exact missing-data policy + excluded counts in TDA analytical provenance; RF-029 owns residual PointCloud compaction/copy cost; independent review/CI evidence must continue to agree. |
| RF-008 | P1-U / evidence | High | `investigator-journey-e2e.test.ts` manually advances phases and uses a kernel mock. It is useful integration coverage but not evidence of a real browser/XR investigator journey or usability outcomes. | Execute P1-U9: reclassify the current test as integration evidence, add real Playwright product-path journeys, and run governed Quest 3S controller/hand task qualification with performance and interaction-failure evidence. |
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
| RF-027 | P1-E / provenance & constraint semantics | High | Actionable NIL remediation originally depended on human-message parsing and was not durable. | **Fixed in #420** for typed codes + durable remediation provenance. Remaining: execute P1-U5 so the investigator World/UX applies typed remediation through the real semantic action path and proves replay. RF-047 additionally requires portable clean-room replay to reconstruct the non-mutating remediation event itself. |
| RF-028 | Scientific validity / temporal & spectral | **Blocker** | Spectral analysis ignored the supplied time axis and temporal trend regressed on observation rank. Irregular/gapped series could therefore receive false frequency, period, trend and seasonality evidence. | **Fixed in #428:** pairwise-complete time/value observations; sort by authoritative numeric/epoch time; trend regression over normalized actual timestamps; FFT only for positive regularly sampled time; duplicate/irregular/gapped series withhold spectral evidence; physical frequencies/periods/resolution/Nyquist in source time-coordinate units; unparsed temporal strings fail closed; canonical TypeScript evidence labels legacy periodicity scores as heuristics. Rust and transport tests cover row shuffle, time-unit rescale, gaps, duplicates, missing samples and row/columnar parity. **Review-active residual:** irregular-series spectral analysis remains deliberately unsupported until an explicit provenance-bearing resampling or Lomb-Scargle design is governed. |
| RF-029 | Scale / memory & resource envelope | **Blocker for 10M claim** | WASM is capped at 512 MiB while primitive resident storage uses f64 values plus validity and operations allocate additional point/transposition/output buffers. A generic “10M rows” claim is therefore false without dimensional/workload constraints; six numeric dimensions alone exceed the cap before runtime overhead. | **IMPLEMENTATION PARTIAL:** #429 landed the shared Rust budget vocabulary, saturating work estimates, row/PointCloud transient estimates, dense CSR accounting and canonical clustering preflight; #431 landed the canonical production TDA preflight and typed unsupported-at-scale bridge; #435 landed kernel-inline enforcement so direct/raw callers cannot bypass the envelope; the durable-refusal-provenance tranche landed kernel-authoritative `outcome: "refused"` provenance + a durable `RefusalProvenance` ledger event. RF-051 now explicitly adds JS-side full-row clones, spread/argument limits and DatasetSpace O(N) work to the same end-to-end resource envelope. Remaining: explicit 10M workload/device profile, complete resident+transient peak accounting across Rust + Worker + JS, streaming/chunking/validity compaction where justified, governed approximation provenance and measured peak-memory evidence. |
| RF-030 | P1-C / high-D complexity | High | RF-018's soundness fix makes `GridSparseIndex` fall back to exact all-pairs search for d>6. Large high-dimensional Mapper/neighbourhood workloads can therefore cross a silent O(N²d) performance cliff while nominally requesting sparse mode. | **IMPLEMENTATION LANDED / REVIEW ACTIVE:** #431 put the Rust-owned preflight on the canonical production path (complete-case validity, conservative source-row fallback, Mapper `bins`, Betti `steps`, dense CSR and duplicate output buffers; typed `UnsupportedAtScaleError`; real-WASM high-D boundary coverage); #435 made enforcement kernel-inline — the `data_compute_*` exports run the preflight themselves and refuse in-band via `{ unsupportedAtScale, preflight }`, so direct/raw callers cannot bypass the budget; the durable-refusal-provenance tranche made the refusal kernel-authoritative and durable (side-channel `outcome: "refused"` provenance, `RefusalProvenance` ledger event, sync+async durable recording, session round-trip; a refusal is not a kernel failure). Remaining: governed bounded approximation where useful, RF-047 portable replay evidence for refusal records, and measured workload/device evidence. |
| RF-031 | Operations / computational budget | High | User-callable hierarchical clustering repeatedly compares cluster/member pairs with cubic worst-case work; current naïve k-means++ seeding is O(N·D·K²) before the fixed Lloyd iterations and is cubic in the user-controlled K≈N worst case; DBSCAN can allocate a dense radius CSR. Worker execution protects frame responsiveness, not process memory/time. | **IMPLEMENTATION LANDED / REVIEW ACTIVE via #429:** the canonical serialisable operation bridge preflights K-means, hierarchical clustering and DBSCAN in Rust before expensive work and emits deterministic `UNSUPPORTED_AT_SCALE` metadata on refusal. Tests cover naïve k-means++ work, pathological hierarchical work, dense DBSCAN CSR risk and preserved small workloads. The durable-refusal-provenance tranche established the durable refusal-provenance pattern (kernel side-channel + ledger event) that generic-operation refusals can reuse. Remaining before verification: typed/durable cross-ABI refusal and provenance for generic operations, governed bounded alternatives where useful, direct/internal helper bypass review, and measured resource evidence. |
| RF-032 | Evidence classification / topology inference | High | Fuzzy substring hints, including single-letter GEO hints `x`/`y`, could classify ordinary schemas as geospatial and feed wrong downstream representations. | **Fixed in #428:** topology inference uses exact normalized aliases rather than substring matches; GRAPH requires source/target roles; GEO accepts numeric lat/lon only with observed range checks, explicit easting/northing projected coordinates, or exact numeric x/y only when corroborated by CRS/geometry metadata; vector aliases are exact; explicit investigator override remains authoritative. Adversarial tests cover `index` + `salary`, `total`-like graph false positives, bare x/y, invalid coordinate ranges and non-numeric lat/lon. Cross-layer authority convergence remains under RF-036. |
| RF-033 | CI evidence architecture | Medium | `playwright-smoke` depended on the monolithic correctness job, suppressing independent browser signal. | **IMPLEMENTATION ADVANCED:** #437/#438/#443 split proof tracks, shard Vitest coverage with merged global thresholds and remove duplicate coverage while retaining strict `Node 24` fan-in. Remaining: measure feedback/runner impact, keep product-path evidence independent, and integrate RF-050/RF-052 so green CI cannot be interpreted as stronger evidence than the tests/gates actually provide. |
| RF-034 | Roadmap governance | Medium | After RF-009 was declared fixed, the active ledger marked RF-018..RF-021 fixed in #418 while the P1-C review-exit checklist still showed all four unchecked. The roadmap could still tell two different completion stories. | Current refresh reconciles the newly reopened UI statuses and current-main marker. Extend documentation integrity checks to compare current remote-main markers/status summaries against checklist/RF state where mechanically possible; RF-052 separately governs branch-rule naming/approval truth. |
| RF-035 | P1-B/P1-A / large mutation transport | High | #417 fixes Worker input registration and output identity, but async mutation results still return a full `DatasetJSON`, reconstruct a JS `Dataset`, commit with `handle: 0`, then become material for the next Worker registration. Large transformed datasets can therefore pay an O(N) Worker→JS→Worker rematerialisation cycle. | **OPEN:** design a durable Worker-side/Rust-side mutation capability or bounded typed-column transfer that keeps large analytical state resident. Preserve presentation/replay needs via compact summaries or explicit export, and measure transfer/heap costs under RF-029. RF-051 extends this review to ordinary JS Dataset/DatasetSpace preprocessing so scale qualification covers both sides of the WASM boundary. |
| RF-036 | Evidence classification / authority split | High | Adversarial review found topology classification has multiple authorities: direct Rust topology inference, `DatasetStructureProfile` spatial classification and TypeScript `DatasetEvidenceSignature` precedence can disagree, including GEO/vector/time precedence and projected-coordinate evidence. Tightening only one classifier would leave contradictory Moneta evidence. | Converge topology/spatial evidence onto one canonical Rust-owned classification/evidence contract; make structure profile and Moneta consume that result rather than independently re-infer semantics. RF-045 is now a prerequisite: remove fabricated/default signature facts and carry explicit unknown/source semantics. Add cross-layer parity tests for graph/hierarchy/GEO/projected/vector/time/tabular and adversarial ambiguous schemas. |
| RF-037 | Stream C / collaboration auth | **Critical** | Live signalling uses replay-permissive `SignedTicket.ts` while replay-safe `SignedTicketVerifier.ts` is off-path; the two implementations also expose incompatible ticket schemas and role ontologies. | Canonicalize one versioned ticket authority and prove second-use rejection through the real `createRoomRegistry().handleConnection()` admission path. Do not merely swap verifier imports; resolve schema, role, nonce-lifetime and deployment semantics and remove/migrate the duplicate authority. |
| RF-038 | Stream C / collaboration auth | High | Scoped token parsing promotes every suffix except exact `observer` to privileged `participant`, so malformed/typo roles fail open. | Exact-allowlist `observer` and `participant`; reject every other suffix and prove rejection through live room-registry admission tests. |
| RF-039 | Stream C / upload ingress | High | `UploadSanitizer` is isolated/tested but not the live FileLoader policy. Production has other defenses, so the primary defect is duplicated/orphaned hardening plus tests that prove the helper instead of the real upload call graph. | Consolidate policy without adding a shadow JS parser; adversarial JSON/CSV tests must traverse `FileLoader -> Atlas -> Rust -> Dataset`, including pre-read size, dangerous-key, shape and filename/control-character cases. |
| RF-040 | Stream C / privacy & compliance | High | `TelemetryConsentManager` is off-path and its current design cannot substantiate GDPR-erasure claims: it retains raw subject IDs, uses a small fixed-salt pseudonym, and erases only an in-memory consent record rather than linked telemetry/traces/exports. | Inventory all retained/exported telemetry, design one authoritative consent/lifecycle model, and prove default-off/grant/revoke/export/erasure behavior end to end before making right-to-erasure claims. Do not simply wire the current helper in as-is. |
| RF-041 | Stream C / supply chain | Medium | Shipped `index.html`/CSP retain an unpkg Three.js trust path even though Vite bundles `three` from `node_modules`. | Prove dev/production/smoke paths without the remote import map, then remove it and tighten `script-src` if no shipped path requires unpkg. |
| RF-042 | Stream C / dev tooling | Low | UX trace terminal output interpolates client-controlled fields into ANSI-coloured logs without stripping terminal control sequences. | Strip/escape C0/C1/ESC control sequences before terminal presentation while preserving JSONL encoding; add ANSI/OSC regression coverage. |
| RF-043 | Stream C / Rust-WASM assurance | High | Raw `unsafe`/`unwrap` counts are not demonstrated vulnerabilities, but hostile-input evidence remains incomplete across attacker-reachable parser, typed-buffer and exported ABI boundaries. | Add targeted fuzz/property campaigns for malformed/truncated CSV/JSON, Unicode/numeric extremes, typed metadata/validity/shape mismatches, stale/foreign/overflowing pointer-length pairs and allocation/reinitialisation stress. Every discovered defect becomes a deterministic PR regression. |
| RF-044 | P1-A / data lineage & graph correctness | **Blocker** | `Dataset.clone()` reconstructs name/columns/rows/rowIds but omits `edges` (and does not deliberately preserve `_meta`). `AnalyticalState.loadDataset()` clones on ingest and again for current state, so a normal graph dataset can lose topology before the authoritative Rust path sees it. | Make clone/derived-copy semantics explicit and topology-preserving for lossless copies; preserve weighted/attributed edges and required metadata; audit every clone/restore/worker-registration path. Add a production-path regression that loads a graph through Atlas, crosses the Rust/WASM boundary, and proves edge count, source/target, weight, attributes, fingerprint and Moneta topology semantics survive. No graph correctness/representation claim may be verified before this closes. |
| RF-045 | P1-R/P1-D / analytical evidence truth | **Blocker** | `SignatureBuilder` fills missing analytical evidence with plausible constants/defaults (for example fixed separation/density values and entropy fallbacks), hard-codes/guesses provenance-like values, treats edge presence/topology as cycle evidence, and can translate categorical cardinality into cluster-looking structure. These values can influence Moneta while appearing measured. | Redesign `DatasetSignature` fields as explicit measured/prior/heuristic/unknown evidence with source and version; remove fabricated scalar defaults; compute cycle/cluster/density/separation facts in Rust where required or leave them unknown; make hard constraints/ranking fail closed or use explicitly governed priors when evidence is absent. Add adversarial no-evidence, acyclic-graph, one-edge, high-cardinality-category and cross-layer parity tests. Integrate with RF-001/RF-002/RF-036 rather than creating a second evidence authority. |
| RF-046 | Investigation provenance / digest completeness | High | The SHA-256 investigation digest is cryptographically strong but its preimage is a lossy projection: command parameters/result identities, much analytical provenance, finding/observation/annotation semantics and parts of representation evidence are omitted or reduced to counts. Semantically different investigations can therefore commit to the same digest contract. | Define a versioned canonical semantic-digest schema. Prefer per-entity/per-result canonical hashes composed into an investigation root so large payloads need not be duplicated. Commit complete meaning-bearing command parameters, result/output/provenance identities, evidence entities, representation decision evidence, discoveries/NIL/remediations/refusals and research context while excluding presentation-only state deliberately. Add mutation/tamper tests proving every governed semantic field changes the digest and presentation-only fields do not. Provide explicit compatibility behavior for schemaVersion 1 packages. |
| RF-047 | Investigation replay / non-mutating provenance | High | `InvestigationReplayRunner` currently counts `remediation`/`refusal` events as matched without reconstructing them in the replay Atlas ledger, then computes an investigation digest over the reconstructed state. Session round-trip tests do not prove portable clean-room replay of these events. | Reconstruct or canonically account for every durable non-mutating provenance event during replay without re-executing the original action. Add `.nemosyne` end-to-end tests for refusal-only, remediation-only and combined timelines that export, unpack, replay, compare event order/payload/digest and fail on tampering. Fold this into RF-027/RF-030 completion evidence. |
| RF-048 | Dataset identity / provenance semantics | High | Nemosyne has two materially different concepts named dataset fingerprint: canonical SHA-256 content identity in DatasetSpace/Rust and a weak `Dataset.fingerprint` derived from name/shape that is still used in portable package/digest fields. Distinct same-shape datasets can therefore share a purported durable identity. | Establish one canonical cryptographic scientific dataset identity across Rust, DatasetSpace, Atlas, Worker registration, package manifest and investigation digest. Rename any cheap deterministic hash to `seedHash`/`cacheKey` and prohibit it from provenance/integrity APIs. Include edges and scientific schema/content in canonical identity while excluding lineage-only row IDs by explicit contract. Add same-name/same-shape-different-content collision regressions and rowId-invariance tests. |
| RF-049 | P1-U1 / Direct Touch correctness & modality parity | High | #444 marks the full Direct Touch state/priority/capture contract landed, but `NearFieldInteractor` implements only `FAR/PROXIMITY/CONTACT/PRESS`; commit is effectively tied to pointer-down entry, explicit COMMIT/RELEASE/RECOVER and pre-commit cancellation are absent, and pressed movement can follow the currently hit panel rather than the captured target. `SpatialPanel` returns `direct-touch`, while `PointerEventMachine` only retains `capturedPanel` for `drag`, so far-ray pointer-up/click equivalence is not proven and can be lost. | Reopen P1-U1. Implement one explicit state machine with captured target identity, commit policy, release/recover/cancel, occlusion/loss recovery and one-semantic-action-per-commit. Make near touch, controller ray, hand ray, mouse and dwell resolve through equivalent semantic output without duplicate activation. Add InputRouter/PointerEventMachine production-path tests for cross-panel drag, retreat across hysteresis, tracking loss, cancel before commit, captured release, double-activation prevention and all required modalities; then obtain physical Quest evidence under U9. |
| RF-050 | P1-U0 / UI substrate evidence | Medium | The UIKit benchmark used to justify P1-U0 adoption is a synthetic desktop/jsdom/WebGL-style loop. It measures init time, JS heap delta, scene objects, update timing and disposal counters but does not measure the roadmap-claimed Quest-relevant text legibility, draw calls, clipping, real scroll interaction, headset frame pacing or sustained GC behavior. | Reclassify current benchmark as synthetic engineering evidence, not Quest/device evidence. Keep UIKit adoption provisional if otherwise architecturally sound, but measure the missing UX-05 properties in the real production bundle and representative panels, then on Quest 3S under U9. Freeze dependency choice only when measured draw calls/frame pacing/legibility/scroll/clipping/disposal evidence is recorded. |
| RF-051 | P1-A/P1-B / JavaScript scale cliffs | High | Even with Rust owning analytical work, ordinary JS preprocessing still contains N-dependent cliffs: `Dataset.rangeOf()` materializes values and spreads them into `Math.min/Math.max`, append uses spread into `push`, and DatasetSpace clones/hashes rows and may compute ranges in JS. These can hit browser argument/memory limits before Rust's resource envelope helps. | Integrate with RF-029/RF-035: replace spread-based bulk operations with bounded loops/chunks; move authoritative range/fingerprint/identity work to Rust or bounded typed-column views; avoid full DatasetSpace clones/materialisation on large/handle-only datasets; audit all `...array`, `Array.from`, row-map and JSON round-trip paths on large-N flows. Add browser/WASM capacity regressions just below/above supported workload profiles and measure JS heap/GC/transfer as part of end-to-end qualification. |
| RF-052 | Engineering governance / merge evidence | Medium | The active main ruleset is named as an approval gate but currently requires zero approving reviews; the separate Continuous Copilot Review ruleset is disabled. CI is meaningful and green, but branch-rule wording/behavior can imply independent review that is not actually enforced. | Decide the intended governance explicitly. Either require at least one independent approval for governed feature/semantic changes, or rename/document the rule so zero approvals is not presented as an approval gate and enforce independent Stream-B review at promotion instead. Keep automated review non-blocking if needed for cadence, but require resolved material review threads. Add a periodic ruleset/config check to RF-009/RF-034 so repository policy cannot silently drift from documented governance. |

## Adversarial remediation programme — 26 August 2026

This programme is the executable plan for RF-044 through RF-052. It deliberately reuses existing P1/RF ownership rather than creating a parallel architecture. Each tranche should normally be one focused PR, with the regression that would have caught the defect included in the same PR. A tranche is not complete merely because the immediate line of code is fixed: the production boundary and downstream semantic claim must also be proved.

### AR-1 — graph lineage integrity — RF-044 — **FIRST / BLOCKING**

**Owning efforts:** P1-A Handle-native boundary, Gate 1 Dataset Evidence, P1-R representation truth.

- [ ] fix `Dataset.clone()` so lossless clones preserve `edges`, edge weights/attributes, row IDs and scientifically relevant dataset metadata; explicitly document which metadata is presentation-only and may be omitted;
- [ ] audit `Dataset.fromJSON`, `toJSON`, `AnalyticalState.loadDataset`, `advanceDataset`, `setCurrentDataset`, `restore`, async worker registration and kernel-result commit for the same topology-loss class;
- [ ] ensure operations that intentionally transform/remove topology declare that semantic change rather than inheriting clone behavior accidentally;
- [ ] verify canonical content identity changes when scientific edge content changes and remains stable under lineage-only row ID hydration;
- [ ] add a graph fixture with weighted + attributed edges and duplicate-looking rows, then prove `Dataset -> Atlas -> Rust -> profile/topology -> Moneta` preserves edge semantics;
- [ ] add a regression proving a one-edge acyclic graph remains a graph but is not reported as cyclic.

**Exit gate:** every lossless dataset copy/registration path preserves graph topology byte/semantically equivalently; Rust receives the same scientific graph Atlas loaded; the regression traverses the production boundary rather than only calling `Dataset.clone()`.

### AR-2 — truthful Moneta signature/evidence contract — RF-045 with RF-001/RF-002/RF-036 — **BLOCKING**

**Owning efforts:** Scientific validity, P1-R, P1-D, Gate 1/2/3.

- [ ] inventory every `DatasetSignature` field and classify it as `measured`, `derived`, `prior`, `heuristic`, `investigator-declared` or `unknown`;
- [ ] remove neutral-looking fabricated constants and make absent evidence structurally absent/unknown rather than numeric zero/0.5/etc.;
- [ ] move N-dependent cycle, cluster-separation, density-variation, entropy/rank and related facts to Rust-owned evidence where they are actually required;
- [ ] stop inferring `hasCycles` from edge presence/topology type; use an authoritative cycle result or unknown;
- [ ] stop translating categorical cardinality into discovered cluster count/quality without an analytical clustering result;
- [ ] source kernel/model versions from the actual runtime/provenance boundary rather than literals;
- [ ] update Bootstrap/Learned Moneta feature handling so missing measured evidence cannot silently become a favourable score; any engineering prior is explicit, versioned and distinguishable from measurement;
- [ ] add metamorphic/adversarial tests for acyclic graphs, sparse graphs, high-cardinality categorical columns, absent cluster/density evidence, schema renames and cross-layer Rust/TS parity.

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

### AR-4 — semantic investigation digest completeness — RF-046 — **HIGH**

**Owning efforts:** Reproducibility/investigation provenance and Gate 5 discovery.

- [ ] define `CanonicalInvestigationInput` v2 as a documented semantic projection, not an ad hoc subset;
- [ ] hash complete canonical command specifications/parameters and authoritative result/output/provenance identities;
- [ ] hash observations, findings, annotations and their evidence/target links, not only counts or selected labels;
- [ ] hash representation decision evidence/alternatives/provenance, DiscoveryEpisodes, NIL outcomes, remediation/refusal provenance and research context;
- [ ] exclude camera/panel/theme/presentation state deliberately and test that those changes do not change the scientific digest;
- [ ] prefer per-entity hashes and a deterministic ordered root where it reduces duplication while preserving tamper sensitivity;
- [ ] add one-field-at-a-time tamper/property tests and old-schema compatibility tests.

**Exit gate:** changing any governed semantic fact changes the digest; changing presentation-only state does not; the contract is versioned and documented strongly enough for third-party verification.

### AR-5 — portable non-mutating event replay — RF-047 with RF-027/RF-030 — **HIGH**

**Owning efforts:** Reproducibility/provenance, P1-E NIL, P1-C refusals.

- [ ] make clean-room replay reconstruct refusal/remediation ledger events in original order without re-executing the refused computation/remediation side effect;
- [ ] compare complete event payload/provenance identities, not merely increment `eventsMatched`;
- [ ] export + unpack + replay packages containing refusal-only, remediation-only, both event kinds interleaved with analysis, and tampered variants;
- [ ] assert final ledger, event count/order, evidence counts, representation/NIL state and investigation digest all agree;
- [ ] ensure legacy packages without these event kinds remain compatible and fail clearly on unsupported future schemas.

**Exit gate:** a `.nemosyne` archive containing refusal/remediation provenance clean-room replays to the same semantic digest and tampering is detected.

### AR-6 — complete end-to-end resource envelope — RF-051 with RF-029/RF-035 — **HIGH**

**Owning efforts:** P1-A/P1-B/P1-C, PERF-04/PERF-05.

- [ ] remove `Math.min(...values)`, `Math.max(...values)`, `push(...largeArray)` and equivalent spread/argument-count hazards from large-N paths;
- [ ] audit Dataset/DatasetSpace/worker registration/session/package paths for full-row cloning, `map`/`Array.from`, JSON serialization and hash work that scales with N on the main thread;
- [ ] expose Rust-owned ranges/identity/summary evidence to avoid recomputing authoritative facts in JS;
- [ ] make handle-only/typed datasets usable without reconstructing a row-major DatasetSpace merely for identity/normalization metadata;
- [ ] bound or explicitly export large transformed data rather than Worker→JS→Worker rematerialising it by default;
- [ ] measure browser JS heap, WASM resident/transient memory, transfer bytes, GC pauses and wall time for each supported workload profile;
- [ ] refuse unsupported workloads before expensive JS preprocessing where possible, with the same durable actionable refusal semantics.

**Exit gate:** supported-scale claims account for the entire browser/WASM pipeline, including pre-Rust and post-Rust work, and representative boundary tests do not rely on argument-count-sensitive spread operations or hidden O(N) rematerialisation.

### AR-7 — repair P1-U1 Direct Touch semantics — RF-049 — **HIGH**

**Owning efforts:** P1-U1, then P1-U2/U3/U4 consumers.

- [ ] replace the current four-phase near-field state with the governed `FAR -> NEAR_HOVER -> CONTACT -> PRESS -> COMMIT -> RELEASE -> RECOVER` semantics or update the normative spec only if device evidence justifies a different explicit model;
- [ ] define commit timing independently from first collision/press entry; support pre-commit cancel and tracking-loss/occlusion recovery;
- [ ] capture the exact target/component at press/commit and route move/up/cancel to it until release; never migrate a captured manipulation because another panel becomes the nearest hit;
- [ ] make `PointerEventMachine` understand non-drag UI capture (`direct-touch`/generic control capture) so ray/controller/hand paths receive matching pointer-up/click semantics;
- [ ] enforce modality priority centrally so near touch suppresses far selection without duplicate `PointerEventMachine`/NearField commits;
- [ ] add one-semantic-action-per-commit guards and tests for rapid near/far oscillation, cross-panel movement, release off target, cancel, reconnect/tracking loss and simultaneous controller/hand sources;
- [ ] run one reference control through mouse, controller ray, hand ray and fingertip in production `InputRouter` tests before continuing U2 migrations.

**Exit gate:** automated production-path tests prove modality-equivalent semantic output and no double activation; U1 remains review-active until physical Quest controller/hand evidence under U9 agrees.

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

1. **AR-1 RF-044** lands first because preserving the input graph is prerequisite to trustworthy graph evidence, fingerprints and Moneta behavior.
2. **AR-2 RF-045** follows immediately and may share a branch only with tightly coupled RF-036 work; do not mix it with presentation changes.
3. **AR-3 RF-048** precedes **AR-4 RF-046** so the digest schema is built on one durable dataset identity. AR-5 RF-047 may develop in parallel but should merge after the chosen digest/event contract is stable.
4. **AR-6 RF-051** rejoins the already active RF-029/RF-035 resource programme; continue RF-030/RF-031 bounded/refusal work in parallel where it does not depend on identity migration.
5. **AR-7 RF-049** should land before P1-U2/U3 rely on the new interaction substrate. U2 implementation may continue only where it does not encode the broken capture/commit semantics.
6. **AR-8 RF-050** can run in parallel with AR-7, but physical evidence is consolidated under U9 rather than creating a second Quest qualification programme.
7. **AR-9 RF-052** is independent governance work and can run in parallel with all technical tranches.
8. After each tranche: sync current `main`, rebase/fix forward, run the cheapest authoritative regressions plus required CI, adversarially inspect the merged result, and update the RF row/status. Do not close several RFs merely because one broad PR is green.

## Core architecture state

Nemosyne has exited the Draco-to-Moneta authority migration and is in private-preview preparation, subject to the review findings above. The governing architecture remains:

1. Rust/WASM owns canonical analytical data, N-dependent computation, analytical facts and data-derived layout/reduction.
2. Moneta owns bounded representation reasoning over compact evidence and investigator semantics.
3. TypeScript/JavaScript owns orchestration, persistence, presentation and interaction, not an independent analytical implementation.
4. Atlas owns investigation orchestration and durable analytical handles.
5. Draco is compatibility surface only. Production code imports Moneta directly.
6. `.nemosyne` preserves investigation, representation/model identity, analytical provenance, discoveries and NIL outcomes, subject to RF-046/RF-047/RF-048 completion before strong cryptographic/replay claims are verified.
7. Learned Moneta remains explicit, pinned, reversible and opt-in until held-out investigator/discovery outcomes demonstrate benefit.

## What has landed

### Scientific and learning foundations

The #249-#264 sequence established immutable FitnessModel artefacts, explicit promotion/activation separation, frozen candidate feature evidence, pairwise judgement infrastructure, exact learned-model pinning, grouped held-out evaluation, durable row identity and stronger measurement/geometry contracts.

Remaining scientific work is outcome-facing plus RF-045 truth repair: measurement-type enforcement, discovery-quality validation, calibrated statistical claims where appropriate, falsification workflows and investigator-facing skepticism support.

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

The migration authority remains complete. RF-045 does not reopen Draco/Moneta ownership, but it does reopen the truthfulness of the compact TypeScript signature assembled around authoritative evidence. Product embodiment, temporal validity, topology-authority convergence, perceptual-evidence and remediation correctness remain separately governed by active review findings.

### Reproducibility and investigation provenance

The #324-#332 sequence substantially advanced the portable provenance chain:

- analytical replay verifies operation provenance and output identity;
- representation/model identity survives embodiment and `.nemosyne` export/import;
- DiscoveryEpisode records persist portably;
- NIL/no-feasible-representation is a typed reproducible outcome;
- discovery/NIL/model/evidence drift fails closed during replay.

#420 adds typed durable remediation provenance at the aggregate/ledger layer and #439 adds durable refusal provenance. **RF-046/RF-047/RF-048 now reopen the strong portable-integrity claim:** the digest must commit complete semantic state, non-mutating provenance events must be reconstructed by clean-room replay, and the package must use one canonical cryptographic dataset identity. Product-path apply-remediation wiring remains open under RF-027.

### Runtime ownership, ABI resilience and recovery

PRs #365-#366 established explicit World lifecycle ownership, generation-fenced recovery, RuntimeBridge ABI-family separation and focused coordinator/application boundaries.

The #375-#384 hardening wave then materially closed the available RES-01/SEC-02 code-executable gaps: tracked host-buffer ownership, exact two-call output contracts, stale-handle rejection, generation revocation, repeated recovery, unsafe-surface inventory and malformed-input campaigns.

Long-running fuzz/Miri/device endurance remain explicit evidence lanes rather than ordinary PR blockers.

### Collaboration resilience and authority

The #385-#389 sequence materially closed the available RES-02 browser/runtime gaps: bounded reconnect, multi-context WebRTC recovery, role-authority preservation, stale transport protection, deterministic offer ownership and server-owned peer lifecycle.

Cross-device/hostile-network qualification remains preview hardening. Stream C now separately owns RF-037/RF-038 live authentication authority and replay/role-admission assurance.

### P1-A typed/columnar TDA implementation

#395 closed production JS TDA rematerialisation; #405 enabled typed/columnar-only handles to execute persistence, Mapper and Betti-0 directly in Rust with `ingestMode` provenance and real-WASM boundary tests. #423 introduced the shared point-access substrate; #426 corrected missing-value semantics via complete-case eligibility and source-row mapping; #431 added the Rust-owned canonical production TDA preflight and typed unsupported-at-scale bridge outcome; #435 made the resource envelope kernel-inline so direct/raw callers cannot bypass it.

This remains **IMPLEMENTATION LANDED / REVIEW ACTIVE** until RF-044 graph lineage is repaired, policy/exclusion/resource-refusal metadata is durable in analytical provenance, the residual scale work is bounded by RF-029/RF-031/RF-051, canonical identity converges under RF-048, CI evidence is clean and independent review agrees.

### P1-B async execution implementation

#408 established first-pass execution-port types and #417 completed the known production registration/generation/output-identity/adoption fixes. P1-B is now **IMPLEMENTATION LANDED / REVIEW ACTIVE** primarily for RF-015 real Worker/WASM evidence, RF-035 large mutation transport and RF-051 browser-side large-N materialisation, not because the known #408 plumbing defects remain.

### P1-C through P1-F first-pass implementation

#410-#413 established sparse-neighbourhood, perceptual-fitness, semantic-target/focus-context and actionable-NIL components. Stream B fixes through #416/#418/#419/#420/#421/#426 materially improved them. #429 added operation resource guards and #431 added canonical production TDA/high-dimensional enforcement. They remain **IMPLEMENTATION LANDED / REVIEW ACTIVE** until their residual scientific, scale, provenance and physical-product evidence exits are met. RF-045 is now a prerequisite for treating Moneta compact signatures as truthful evidence rather than merely bounded data structures.

### Test architecture and feedback latency

The test pyramid is split by ownership:

```text
Playwright / WebXR smoke         small, expensive, user-path focused
TypeScript UI/integration        orchestration and presentation only
WASM boundary tests              small ABI/provenance seam
Rust unit/property/metamorphic   exhaustive analytical authority
```

The execution strategy is governed by [`CI_TEST_ACCELERATION_STRATEGY.md`](CI_TEST_ACCELERATION_STRATEGY.md): **accelerate scheduling before reducing proof**. #437/#438/#443 parallelized independent CI tracks, added sharded Vitest coverage with merged global thresholds and removed duplicate coverage work without deleting authoritative tests. RF-052 now governs the distinction between a green engineering gate and independently reviewed/verified completion.

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
| 1 — Dataset Evidence | **MIGRATION AUTHORITY COMPLETE / SCIENCE ACTIVE** | Close RF-044 graph lineage and RF-045 signature truth; finish RF-007 provenance semantics; RF-028/RF-032 landed in #428 with irregular-series/RF-036 residuals; continue measurement semantics and resource-envelope work. |
| 2 — Representation Language | **PARTIAL / REVIEW ACTIVE** | Close RF-001/RF-002/RF-045 and make current single-family candidates mathematically/spatially faithful before composition. |
| 3 — Moneta correctness | **MIGRATION EXIT COMPLETE / PRODUCT REVIEW ACTIVE** | Close RF-045 plus RF-001/RF-002/RF-036 and upstream identity/resource blockers before representation ranking can be considered scientifically trustworthy. |
| 4 — NIL | **PROVENANCE BASELINE COMPLETE / PRODUCT WIRING ACTIVE** | Wire RF-027 remediation through the actual investigator flow and close RF-047 portable replay semantics. |
| 5 — Discovery | **INFRASTRUCTURE ADVANCED / SCIENCE PARTIAL** | Close RF-046/RF-047/RF-048 portable semantic integrity; add falsification workflows, outcome evidence and controlled discovery-quality studies. |
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
- [x] **UX-02 / high:** real-browser desktop investigation/replay/tamper journey is covered, with RF-046/RF-047/RF-048 now requiring stronger portable semantic integrity before the broader reproducibility claim is verified.
- [ ] **UX-03 / high:** execute controller, hand and desktop semantic-parity tasks on physical hardware; RF-049 must first repair the P1-U1 interaction contract.
- [x] **RES-01 / high, code-executable scope:** checked output, host allocation ownership, malformed handles and sustained generation recovery are covered. Device/endurance residuals remain evidence lanes.
- [x] **RES-02 / high, browser scope:** partition/reconnect/state convergence/role violation and server-owned lifecycle authority are covered through #389. Cross-device/hostile-network residuals remain preview hardening.
- [x] **SEC-02 / high, deterministic CI scope:** unsafe inventory plus bounded malformed parser/buffer/handle/exhaustion campaigns are covered. Long-running fuzz/Miri remain separate hardening lanes; RF-043 adds targeted hostile-boundary fuzz evidence without treating raw unsafe counts as vulnerabilities.
- [ ] **MAINT-01 / high:** continue removing `@ts-nocheck` from package, bridge, World and Moneta boundary tests.
- [ ] **PERF-05 / medium:** profile allocations/GC and sustained analytical scheduling across representative interactions, including RF-051 JS preprocessing/transfer.
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
- [x] source row identity is preserved through TDA point compaction.

Review exit work:

- [ ] **RF-044 blocker:** preserve graph edges/attributes and scientific metadata across Dataset/AnalyticalState clone, registration and restore paths; prove Atlas→Rust graph parity;
- [ ] **RF-048 identity:** converge durable dataset fingerprints on canonical cryptographic content identity;
- [ ] **RF-007 provenance:** record exact missing-data policy, source count, eligible count and excluded count in TDA operation provenance;
- [ ] **RF-029/RF-030/RF-051 scale:** preserve kernel-inline resource enforcement while removing JS-side argument/copy cliffs and measuring the complete browser/WASM envelope;
- [ ] re-run authoritative CI + adversarial review before `VERIFIED COMPLETE`.

## P1 — Product convergence gates

### P1-R Representation embodiment convergence — IMPLEMENTATION LANDED / REVIEW ACTIVE

Landed first-pass work includes distinct aggregate/density/cluster geometry, bounded visible primitive counts, executable single-winner graph metadata, and RF-003/RF-004 fixes.

Review exit work:

- [ ] **RF-045 blocker:** eliminate fabricated/default analytical-looking signature facts and make evidence source/unknown semantics explicit before ranking/representation claims are trusted;
- [ ] **RF-001:** move N-dependent aggregate, density, cluster and compatible reduction/layout into Rust-owned bounded semantic payloads;
- [ ] make Three.js a thin embodiment adapter over those payloads rather than an analytical reducer over rows;
- [ ] **RF-002:** re-audit candidate `supports`/`preserves`/`loses` and descriptions against actual mathematics;
- [ ] implement or honestly downgrade overclaimed density/distribution/cluster/manifold/multiscale candidates;
- [ ] record exact reduction/estimation/layout method and parameters in provenance;
- [ ] demonstrate mathematically faithful, visibly/interactively distinct alternatives before P1-D ranking is product-valid.

### P1-U Whole-product investigation UX convergence — IMPLEMENTATION PARTIAL / REVIEW ACTIVE

Landed first-pass work includes the 10-phase journey model, coordinator, task-surface policy, TechnoCore state model, semantic targeting/focus-context foundations, body-locked panel treatment, task-oriented HandWheel treatment, and integration coverage. #444 adds the first UIKit/SpatialPanel and near-field substrate, but RF-049/RF-050 show that U0/U1 do not yet satisfy their stated completion evidence.

**Normative implementation guide:** [`Nemosyne_VR_UI_Design_System_and_Agent_Spec.md`](Nemosyne_VR_UI_Design_System_and_Agent_Spec.md). The guide defines the target interaction grammar, visual system, spatial reference frames, component contracts, Direct Touch behavior, accessibility/comfort constraints, performance rules and agent acceptance gates. The roadmap below turns that specification into bounded implementation tranches.

**Programme rule:** one tranche or a tightly coupled sub-tranche should be the normal PR unit. Preserve `InputRouter` as input-orchestration authority, Atlas/investigation as semantic/provenance authority, Rust/WASM as analytical authority and Three.js as spatial embodiment. UIKit or any pointer library may provide rendering/event mechanics but must not become a second semantic command authority. P1-U becomes `VERIFIED COMPLETE` only after P1-U0 through P1-U9 are complete, RF-005/RF-006/RF-008/RF-027/RF-049/RF-050 are closed, and physical Quest evidence agrees.

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

Landed implementation evidence from #444:

- [x] introduce `NearFieldInteractor` with WebXR/controller ray-based proximity, contact/press thresholds and near/far hysteresis;
- [x] suppress/fade far rays in the near envelope and restore them on retreat;
- [x] add initial SpatialPanel/UIKit pointer dispatch and a focused near/far hysteresis test.

Review exit work:

- [ ] **RF-049:** implement or explicitly govern the full `FAR -> NEAR_HOVER -> CONTACT -> PRESS -> COMMIT -> RELEASE -> RECOVER` lifecycle, including pre-commit cancel, tracking-loss/occlusion recovery and commit-on-policy rather than first collision;
- [ ] implement the modality priority `captured manipulation > direct touch > direct grab > controller-tip direct > distance ray > mouse > dwell fallback` as one central arbitration contract and prove no duplicate dispatch;
- [ ] capture the exact target/component for non-drag UI interactions and route move/up/cancel to it; `direct-touch`/generic control capture must not be dropped because `PointerEventMachine` currently retains only `drag` panels;
- [ ] add panel-before-scene precedence, cancellation and one-semantic-action-per-commit guarantees through the production InputRouter path;
- [ ] add visual proximity/contact/commit feedback and optional audio/haptics without treating simulated pressure as a scientific signal;
- [ ] preserve current ray smoothing, semantic coercion and raw-observation precision escape hatch for dense data;
- [ ] test one reference control through mouse, controller ray, hand ray and fingertip touch with identical semantic output; include cross-panel movement, release-off-target, near/far oscillation, tracking loss and double-activation adversaries;
- [ ] obtain physical Quest controller/hand evidence under U9 before verification.

**Exit gate:** one reference control is modality-equivalent through the real InputRouter/PointerEventMachine path; transition across near/far does not flicker, lose pointer-up, double-activate or select scene data through UI; automated tests cover capture/cancel/priority and device evidence agrees.

#### P1-U2 — spatial panel substrate and Holographic Inspector pilot — IMPLEMENTATION PARTIAL

Purpose: prove the new panel/layout/interaction system on a high-value bounded surface before global migration.

- [ ] do not depend on unverified U1 capture/commit semantics; RF-049 is a prerequisite for declaring modality parity;
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
- [ ] wire typed NIL remediation actions through the actual investigator semantic action path and call `recordRemediation` when applied; prove durable replay through the product path and RF-047 portable replay;
- [ ] make consequential representation changes previewable/reversible and preserve selection/reference context through accepted transitions;
- [ ] gate recommendation/explanation surfaces on reviewed P1-R/P1-E semantics, including RF-045: no visual polish may promote fabricated/overclaimed representation evidence.

**Exit gate:** TechnoCore is demonstrably operable with touch/ray/controllers/desktop, produces no analytical authority of its own, applies typed remediation with replayable provenance and communicates epistemic state without misleading confidence cues.

#### P1-U6 — Evidence/Ice Vault, archival recovery and semantic portals — IMPLEMENTATION PARTIAL / REVIEW ACTIVE

Purpose: ensure persistent world objects earn their place and close the decorative-object half of RF-006.

- [ ] give IceVault/Evidence Vault an explicit immutable-return role: saved/frozen investigation states, DiscoveryEpisodes, study-freeze snapshots, `.nemosyne` import/export and current-vs-frozen comparison where supported;
- [ ] make archive/freeze/restore state visible, attributable and provenance-preserving; destructive replacement requires preview/confirmation and a recovery path;
- [ ] gate strong archive-integrity claims on RF-046/RF-047/RF-048;
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
- [ ] support shareable `.nemosyne` investigations as reproducible Memory Palace graphs once RF-046/RF-047/RF-048 and the discovery science contract are complete.

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
- [ ] run the same core tasks on Quest 3S-class hardware with controllers and hands where supported; capture semantic parity, task failure/accidental activation, discoverability and recovery evidence;
- [ ] explicitly test RF-049 near-touch -> retreat -> ray transitions, cross-target capture/cancel, dense data precision escape, panel pin/follow, representation changes, large text/high contrast and reduced motion;
- [ ] collect frame time, draw calls, GPU/CPU/UI allocation/GC, memory, interaction latency and analytical scheduling under representative investigations; integrate RF-050 and PERF-04/PERF-05 rather than using UI-only toy scenes;
- [ ] run at least one sustained 20+ minute session and record arm-fatigue/comfort outcomes; device evidence outranks screenshots and desktop emulation;
- [ ] conduct task-based investigator studies for comprehension, falsification behavior, finding capture and share/replay, preserving treatment versions and evidence reproducibly.

**Exit gate:** RF-008, RF-050, UX-03 and the UI-relevant portion of PERF-04/PERF-05 have real product/device evidence; RF-049 is closed at code level and agrees with device behavior; no required modality changes semantic meaning; all core tasks are possible without expert gestures; the converged treatment passes independent adversarial VR/UI review before `VERIFIED COMPLETE`.

#### P1-U dependency order

1. **U0 + U1 are reopened foundations.** RF-050 may run in parallel with RF-049, but U2/U3/U4 cannot claim modality parity until RF-049 closes.
2. **U2** proves the corrected interaction/substrate on the Inspector; implementation may scaffold earlier but its exit gate depends on U1.
3. **U3** may proceed after stable U0/U1 contracts and should migrate commodity surfaces before bespoke instrument work expands.
4. **U4** follows U1 and closes contextual interaction/RF-005; it may proceed in parallel with U3 once input semantics are stable.
5. **U5** may scaffold after U1/U2 but its scientific-facing completion is gated by P1-R/P1-E/RF-045 truth and RF-027/RF-047 replay semantics.
6. **U6** follows durable investigation/archive contracts, now including RF-046/RF-047/RF-048; decorative Vault/portal behavior must not block removing the object from default view.
7. **U7** builds on P1-F plus investigation/discovery-science contracts and may progress incrementally without waiting for every panel migration.
8. **U8** happens after functional parity is available so redundant surfaces can be deleted rather than merely hidden beside replacements.
9. **U9** is the convergence/evidence tranche and cannot certify incomplete U0-U8 work.

Review exit work:

- [ ] close **RF-049** in P1-U1 before treating later surface migrations as modality-equivalent;
- [ ] close **RF-050** through P1-U0/P1-U9 production/device evidence;
- [ ] close **RF-005** through P1-U4/P1-U8;
- [ ] close **RF-006** through P1-U5/P1-U6;
- [ ] wire **RF-027** through P1-U5 and portable replay through RF-047;
- [ ] derive journey state from real product events with meaningful prerequisites under P1-U9;
- [ ] close **RF-008** with real Playwright + Quest product-path evidence under P1-U9;
- [ ] collect task-level comprehension/discoverability/recovery/falsification/finding/share evidence before verification.

### P1-B Asynchronous analytical runtime — IMPLEMENTATION LANDED / REVIEW ACTIVE

Landed implementation evidence now includes #417's production Worker installation, real generation fencing, fingerprint-keyed dataset registration, authoritative output fingerprints, async presentation adoption and replay-parity repairs.

Review exit work:

- [x] RF-010/RF-011/RF-013/RF-014/RF-016 code-level exits (#417);
- [ ] **RF-015:** real module-Worker + real-WASM integration/browser test across TDA, mutation supersession and recovery for at least two runtime generations;
- [ ] record dispatch/transfer/compute measurements;
- [ ] **RF-035/RF-051:** remove or explicitly bound full mutation Worker→JS→Worker rematerialisation and other JS-side large-N materialisation for supported transformed datasets;
- [ ] **RF-048:** use the canonical cryptographic dataset identity for worker registration/provenance rather than any weak compatibility hash;
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
- [ ] **RF-047:** prove those refusal events survive clean-room portable replay and digest verification;
- [ ] **RF-030 residuals:** add any explicitly governed approximation with exact-vs-approximation quality evidence;
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

- [ ] **RF-045 prerequisite:** all non-perceptual signature inputs consumed alongside perceptual evidence must distinguish measured/prior/heuristic/unknown and contain no fabricated measured-looking defaults;
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

- [ ] expose the actionable NIL flow through actual investigator UI/modalities and call `recordRemediation` when applied;
- [ ] **RF-047:** prove remediation provenance in clean-room `.nemosyne` replay, not only session serialize/deserialize;
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
- [ ] ensure RF-049 interaction capture/near-far arbitration does not regress semantic targeting/precision escape;
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
- [ ] validate `.nemosyne` compatibility across preview releases, including RF-046/RF-047/RF-048 digest/replay/identity migrations;
- [ ] implement onboarding, sample investigations and unsupported-feature states;
- [ ] run a small investigator cohort and feed structured evidence into the roadmap.

**Promotion rule:** private preview may not be promoted while any blocker/high review finding that undermines source-data integrity, scientific correctness, analytical authority, portable identity/replay, security/privacy authority, core task completion or target-device safety remains open.

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

The frozen panel/intent-wheel treatment work is merged through #394. Gate F review for that controlled local treatment is complete; Quest 3S validation remains required. **P1-U0 through P1-U9 above own the implementation breakdown**, governed by `Nemosyne_VR_UI_Design_System_and_Agent_Spec.md`; RF-049/RF-050 reopen the newly landed U0/U1 substrate evidence. This section remains the cross-cutting promotion/evidence gate.

- [x] spatial-audit + hypothesis + Blender prototype comparison for panel arrangement completed as a recorded decision (`docs/decisions/VR_PANEL_SPATIAL_LAYOUT.md`, evidence tier 4);
- [x] role-aware depth-tier zoning implemented as panel default positions with invariant tests;
- [x] persistent panels consolidated onto the torso/body reference frame; head/camera lock reserved for transient alerts;
- [x] production HandWheel converged onto the task/intent taxonomy with a separate superuser annex;
- [x] novice command vocabulary includes Move, Undo/Redo and Return-to-Overview;
- [x] HolographicInspector and FrustrationResponseManager moved off the retired rig frame;
- [x] frozen panel-layout + intent-wheel treatment recorded in `docs/study/UI_TREATMENT.md`;
- [ ] close RF-049/RF-050 and execute remaining P1-U0 through P1-U8 work before treating the converged interface as implemented;
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
- [ ] support shareable `.nemosyne` investigations as reproducible Memory Palace graphs after RF-046/RF-047/RF-048 close.

## Scientific validity programme

### Measurement semantics and statistics

- [x] **RF-028 (landed in #428):** trend uses actual timestamps; regular-time FFT uses physical units and fails closed on irregular/gapped sampling.
- [x] **RF-032 (landed in #428):** exact/corroborated topology semantics with adversarial false-positive tests.
- [ ] **RF-045:** remove fabricated/default analytical-looking signature evidence; preserve explicit unknown/source/fidelity semantics throughout Moneta;
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
browser/WebXR product-path smoke
real Worker/WASM integration for async analytical paths
real sparse-mode exact-vs-approximation parity/stability tests
scale benchmarks measuring complete JS + Worker + WASM algorithm and peak memory
security admission/ingress tests through the live production path
hostile parser/WASM ABI fuzz/property campaigns with deterministic regressions
physical Quest qualification for promotion-critical device claims
independent review pass over the resulting merged implementation
```

## Near-term execution order by stream

### Stream A — forward implementation

1. Continue minimal-private-preview, security/reliability, investigation/discovery-science and measurement-semantics work only where RF-044/RF-045/RF-046/RF-047/RF-048 and the active Stream-C blockers are not dependencies.
2. Do not build graph/representation semantics on Dataset clone behavior until RF-044 lands; do not consume unmeasured SignatureBuilder defaults as evidence while RF-045 is open.
3. Do not consume irregular-series FFT periodicity as scientific evidence; RF-028 (#428) deliberately withholds spectral evidence unless sampling is regular. RF-036 topology-authority convergence remains open.
4. Do not introduce scale claims or exact high-D work that bypasses the RF-029/RF-051 complete resource envelope.
5. Continue bounded maintenance/dependency work that does not distract from promotion blockers.
6. P1-U2/U3/U4 may scaffold where useful, but no modality-parity/completion claim should depend on P1-U1 until RF-049 closes; U0 device evidence remains under RF-050/U9. Do not begin P2 RepresentationGraph composition or P3 adaptation until reviewed prerequisites are satisfied.

### Stream B — review and fix-forward

1. **RF-044 — graph lineage integrity. CURRENT / BLOCKING.** Preserve edges/attributes through Dataset/Atlas/Worker/Rust boundaries and prove production graph parity.
2. **RF-045 + RF-036 + RF-001/RF-002 — analytical-signature and representation truth.** Remove fabricated measured-looking facts; converge canonical Rust evidence; then re-audit representation semantics.
3. **RF-048 -> RF-046 -> RF-047 — portable identity, digest and replay integrity.** Establish one canonical dataset identity, version the semantic digest, then reconstruct non-mutating provenance in clean-room replay with tamper evidence.
4. **RF-029 + RF-030 + RF-031 + RF-035 + RF-051 — analytical resource envelope.** Preserve existing kernel-inline refusal work, remove browser-side N-dependent cliffs/large rematerialisation, govern approximation and finish with measured workload/device qualification.
5. **RF-049 + RF-050 / P1-U0..P1-U9 — whole-product convergence.** Repair Direct Touch capture/commit/modality parity and make UIKit evidence honest before later surface migration claims; then continue Inspector -> precision surfaces -> contextual tasks -> TechnoCore/NIL -> archive/Memory Palace -> consolidation/accessibility -> device evidence.
6. **RF-015 + RF-033 — production evidence architecture.** Real Worker/WASM timings and independent browser-smoke signal; measure the now-parallel/sharded CI graph without reducing proof.
7. **RF-052 + RF-009/RF-034 — governance truth.** Align branch-rule names/review policy/current-main status with actual enforcement; keep automated review from becoming a false or unnecessary blocker.
8. **Physical XR qualification — RF-026 residual + RF-049/RF-050 + PERF-04 + UX-03.** Quest 3S controllers/hands/desktop semantic parity, comfort, frame/memory budgets and target-device task evidence; P1-U9 owns UI-specific execution/evidence.
9. **Private-preview hardening.** Auth/access control, retention/privacy, consent/telemetry, release/rollback/recovery and compatibility only after applicable blocker/high scientific, provenance, product and Stream-C findings close or are explicitly risk-accepted.
10. Review each new Stream A merge immediately and append/fix RF findings in the same cadence.

### Stream C — security authority and live-path assurance

1. **RF-037 + RF-038 — signalling authentication authority.** Canonicalize one ticket protocol/role ontology, enforce nonce replay prevention in live admission, and make scoped-role parsing fail closed.
2. **RF-040 — telemetry/privacy lifecycle.** Inventory all retained/exported telemetry and redesign consent/revocation/erasure authority before wiring or claiming GDPR erasure support.
3. **RF-039 — upload ingress assurance.** Consolidate hardening policy around the real FileLoader/Atlas/Rust/Dataset path and replace helper-only evidence with adversarial live-path tests.
4. **RF-041 — supply-chain trust.** Remove the unpkg import/CSP allowance if production/dev proof confirms it is unnecessary.
5. **RF-042 — dev terminal safety.** Escape/strip control sequences from UX-trace terminal presentation.
6. **RF-043 — hostile-boundary fuzzing.** Expand parser/typed-buffer/WASM ABI fuzz/property evidence; every discovered defect becomes a deterministic PR regression.
7. Re-review security-sensitive Stream A/Stream B changes continuously; a hardened helper that is not wired to the live path is not a completed security property.

### Convergence / promotion

- Run PERF-04 and UX-03 physical Quest qualification on the converged P1-U treatment only after RF-049 has repaired interaction semantics and RF-050 defines the missing device evidence.
- Re-run blocker/high security, architecture, scientific, provenance and UX review before private-preview promotion.
- Require applicable Stream C blocker/high findings to be closed or explicitly risk-accepted with evidence before private-preview promotion.
- Require RF-044/RF-045 and RF-046/RF-047/RF-048 to close before making strong graph-science or reproducible-investigation integrity claims.
- Continue discovery/outcome studies and learned-Moneta empirical validation.
- Begin RepresentationGraph/compositional Moneta only after P1 prerequisites are both implemented and review-verified.
- Begin Adaptive Nemosyne only after evidence and governance prerequisites are satisfied.
