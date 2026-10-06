# P1-R2E B3 Post-Implementation Adversarial Review — 1 September 2026

**Reviewed head:** `stream-b/b3-production-cutover` implementation commit (base `main@008165e`, #610 merged)  
**Reviewer:** independent adversarial agent, distinct from the implementing agent  
**Scope:** B3 production cutover — thin graph adapter (`GraphSemanticEmbodiment.ts`), translator intercept, `LoadDatasetUseCase` graph arm, `MonetaTopologyNode` candidate/invalidation wiring, B1-RF-03 eviction evidence, Stream-A drill-down membership (`evaluate_graph_membership`)  
**Programme doc:** `docs/roadmap/P1_R2E_RELATIONSHIP_GRAPH.md`  
**Scientific authority:** `docs/rfcs/0002-source-relationship-graph-authority.md`

## Verdict

**PROMOTE, subject to exact-head gates.** No BLOCKER. Two MAJOR and seven MINOR findings were raised; all are addressed on the same branch (fix-forward or explicit adjudication below). The governing invariant held on every constructed path: a governed `RELATIONSHIP_GRAPH` presentation renders node/edge topology exactly as the resident B2 payload says; the translator intercept is marker-gated ahead of the raw `rows`/`edges` read; the chart plane is unreachable for governed graphs; the adapter reads no rows and no `dataset.edges`; PENDING/REFUSED/INVALID and stale-fingerprint envelopes render a status plane and no topology; drill-down membership re-runs the exact resident builder so it cannot diverge from embodied topology.

Reviewer verification on the reviewed head: B3 falsifiers 12/12; full TS integration lane 389 files / 2261 tests; `cargo test` 327 passed (wasm).

## Falsification attempts that failed

- **Raw topology leak:** the intercept keys on the governed marker before `rows = dataset?.rows ?? dataInput.rows ?? []`; the graph branch forces `edges = []`; the chart-plane build is gated by `!usesGraphSemanticEmbodiment`; the adapter contains no `dataset.rows`/`dataInput.rows`/`dataset.edges` read, pinned mechanically in the falsifier suite.
- **Stale topology:** `Dataset.fingerprint` covers columns, edges, name and projected rows, so any mutation invalidates the envelope (adapter fingerprint fence → INVALID); `appendRows` deletes the retained envelope so re-synthesis renders PENDING.
- **Weakened authority:** the TS-side reconstructed embodiment request is inert on the production path — the worker bridge *replaces* the caller's request with the retained authoritative one; the Rust request mirror uses `deny_unknown_fields`, so widened vocabulary fails at parse.
- **Membership divergence:** `evaluate_graph_membership` re-runs the exact `graph_from_dataset` builder rather than maintaining a parallel parser; node/edge/self-loop/refusal semantics match the builder's sort and identity rules.
- **Vacuous source test:** the ordering-fence test's `indexOf('buildGraphSemanticTopology(')` does not match the import line (no call parenthesis), so it pins the real call site.

## Findings and disposition

### B3-RF-01 (MAJOR) — no live `graphAuthority` producer; the cutover is workflow/test-triggered — ADJUDICATED: B4 BY DESIGN

No shipped UI surface sets `requirements.graphAuthority`, so live arbitration can never choose `RELATIONSHIP_GRAPH` in this tranche. **Adjudication:** this matches the R2D precedent exactly — `clusterEvidenceDiagnostics.ts` (driven from `bootstrap.ts` diagnostics mode) is likewise the only live `clusterAuthority` producer. The B4 browser evidence workflow owns the graph analogue. **Fix-forward (doc):** the programme doc now states the B3/B4 live-trigger boundary explicitly; the PR body and roadmap say `RELATIONSHIP_GRAPH` is live-reachable only through the B4 workflow (and tests) until B4 lands. The wiring itself (LoadDatasetUseCase arm → marker → MonetaTopologyNode → translator gate) is on the production path and is exercised through the real classes, not mocks of them.

### B3-RF-02 (MAJOR) — dead "raw row fallback" comment + misleading PENDING copy — RESOLVED IN BRANCH

`LoadDatasetUseCase`'s ungoverned-graph comment claimed "the raw row path remains the only fallback", but `MonetaTopologyNode` sets the marker for every `RELATIONSHIP_GRAPH` decision, so the ungoverned case actually fails closed to a PENDING plane (the fallback is dead, and reviving it would be the wrong fix). The status copy additionally claimed "Building ... in the analytical kernel" even when no request would ever be issued. **Fix-forward:** the comment now describes the fail-closed behavior truthfully, and the PENDING copy is authority-neutral ("Awaiting the source-authoritative relationship graph; no heuristic topology may substitute."). Fail-closed behavior itself was correct and is unchanged.

### B3-RF-03 (MINOR) — incremental append could keep rendering pre-mutation topology — RESOLVED IN BRANCH

`appendRows` invalidated the envelope but still consulted `appendRowsToArtifact`, whose TIME_RIBBON fast path returns success even after zero mesh matches — a governed graph artifact with a TIME_RIBBON spec would keep the stale rendering. **Fix-forward:** `appendRows` skips the incremental fast path entirely for governed graphs, re-synthesizes immediately and returns false; the only live caller (`LiveStreamCoordinator`) already treats false as "full reload", which is the correct fail-closed response.

### B3-RF-04 (MINOR) — marker/envelope desync one call away — RESOLVED IN BRANCH (DEFENSE IN DEPTH)

The gate keyed only on the candidate marker; a `dataInput` still holding a governed envelope whose marker was cleared would take the raw heuristic path. **Fix-forward:** the translator now also routes to the adapter when the retained envelope itself carries `candidateId: 'RELATIONSHIP_GRAPH'` — governance evidence, not just the marker, keeps the payload off the heuristic path.

### B3-RF-05 (MINOR) — adapter validation weaker than claimed — RESOLVED IN BRANCH

The adapter did not check `schemaVersion`, did not reconcile `sourceEdgeCount`/`refusedEdgeCount`, and crashed (TypeError) on malformed-but-truthy envelopes (a Promise in `semanticEmbodiment`, READY without `payload.data`) instead of rendering INVALID. **Fix-forward:** runtime-shape fence (non-object/missing `result`/non-string status/schemaVersion ≠ 1 → INVALID; REFUSED without a string refusal message → INVALID), `Array.isArray` guards on nodes/edges/counts, and the exact Rust READY reconciliation mirrored (`sourceEdgeCount === edges.length && refusedEdgeCount === 0`). The falsifier suite pins the promise-leak and schema-tamper cases.

### B3-RF-06 (MINOR) — mechanical fence test overclaimed — RESOLVED IN BRANCH (TEST DOC)

"Raw edge reads stay behind the marker gate" was imprecise: `let edges = dataInput.edges ?? []` initializes before the intercept (harmless — the governed branch overwrites it and never consumes it). The test comment now states the exact boundary honestly, including why the adapter-level `dataset.edges` ban is the real fence.

### B3-RF-07 (MINOR) — naming overclaims — RESOLVED IN BRANCH (TEST/DOC)

Test 12 claimed to "reuse the strict self-consistency gate" while actually exercising status-plane handling; the arbitration-binding checklist claimed one chained fixture while coverage is piecewise (signature→arbitrate in one falsifier, the LoadDatasetUseCase arm in another with mocked arbitration). **Fix-forward:** the test is renamed to what it does ("renders envelope-shaped refusals and identity mismatches as status planes only"), the programme-doc item states the piecewise coverage explicitly, and the B4 exit inherits an explicit obligation to chain the full path in product evidence.

### B3-RF-08 (MINOR) — eviction evidence does not survive a JSON round trip — DOCUMENTED LATENT, OWNED BY B4

`evictedEdgeCount` is excluded from `toJSON`/`fromJSON`, so a serialize→reload of an evicted dataset silently loses the evidence. **Why not coded:** `Dataset.fingerprint` hashes `toJSON()` while the Rust authority drops unknown JSON fields — adding the field would desynchronize the TS/Rust fingerprint contract, the most sensitive invariant in the repository. No live dataset-persistence path exists today. **Disposition:** recorded as a known latent gap in the programme doc; any future persistence path must carry eviction evidence out-of-band before a serialized evicted dataset may load as governed.

### B3-RF-09 (MINOR) — repo hygiene — RESOLVED IN BRANCH

The roadmap-doc status changes were uncommitted, the programme doc carried a duplicated B1-RF-03 paragraph, a stray zero-byte `src/moneta/drill_down.rs` sat in the TS source tree, and the falsifier file contained literal NUL bytes (the ID-preimage separator written as raw bytes rather than the `\x00` escape, making the file read as binary). All fixed: docs committed once final, duplicate paragraph removed, stray file deleted, NULs replaced with escape sequences.

## What the falsifier suite now pins

Loader authority transport (strict B1 authority only, no rows); ungoverned + eviction fail-closed; payload-only topology with row-free proxies; PENDING/REFUSED/INVALID/stale status planes; the intact ungoverned raw path; appendRows invalidation; seed invariance (positions move, topology and identity do not); the rowId-heuristic falsifier (colliding id/name bait); drill-down membership; arbitration binding; the mechanical ordering fence plus adapter source bans; and the runtime-shape fence (promise leak, schema tamper, wrong family, no dataset).

## Final bounded claim

B3 may be `VERIFIED COMPLETE` only for the production cutover mechanics: the marker-gated intercept, the thin adapter over the resident payload, presentation-only layout, staleness/invalidation fencing, B1-RF-03 eviction fail-closure, and Stream-A drill-down membership. It does **not** claim a shipped live trigger for governed graphs (B4 evidence workflow, per B3-RF-01), dataset-persistence survival of eviction evidence (B3-RF-08), product/scale/perceptual evidence, or the independent Stream-B STOP (all B4). The ungoverned raw force-directed path still silently remaps evicted edges for non-governed data; that is unchanged presentation behavior outside the governed contract and provably unreachable for governed graphs.

**Disposition:** promote B3 after the branch's unchanged exact head passes the required repository gates. B4 owns the product/scale/perceptual evidence matrix, the live evidence workflow trigger, and the independent STOP review that closes Stream B.