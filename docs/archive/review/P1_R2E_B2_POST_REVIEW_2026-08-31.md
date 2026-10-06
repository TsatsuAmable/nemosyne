# P1-R2E B2 Post-Implementation Adversarial Review — 31 August 2026

**Reviewed head:** `stream-b/b2-graph-payload@07d95d9` (base `main@84a4b77`, #607 merged)  
**Reviewer:** independent adversarial agent, distinct from the implementing agent  
**Scope:** B2 resident Rust/WASM `RELATIONSHIP_GRAPH` payload, bridge, Worker transport and loader  
**Programme doc:** `docs/roadmap/P1_R2E_RELATIONSHIP_GRAPH.md`  
**Scientific authority:** `docs/rfcs/0002-source-relationship-graph-authority.md`

## Verdict

**PROMOTE, subject to exact-head gates.** No BLOCKER and no MAJOR findings. The governing invariant held on every constructed path: a READY graph edge exists only because the source-authoritative payload declares it; refusals fail closed with whole-payload semantics; no raw row payloads cross the WASM boundary inside the graph payload; semantic node/edge identity is stable under row-preserving reorders, and the emitted payload is invariant even under permutation of duplicate parallel edges. Four MINOR findings and four NOTEs were raised; all are addressed by fix-forward commits on the same branch.

Reviewer verification on the reviewed head: `cargo test --manifest-path wasm/Cargo.toml graph_embodiment` 10/10; `npx vitest run --config vitest.config.ts tests/p1r-r2e-b2-graph-payload-wasm.test.ts` 9/9 (real WASM binary + real Worker message handler).

## Falsification attempts that failed

- **Admission bypass / widened vocabulary:** the Rust mirror carries `deny_unknown_fields` and single-variant policy enums; `inferMissingEdges`, `"DROP"` and `"INFER"` fail at serde parse before any logic runs, and the end-to-end Worker test proves the builder returns no envelope and the Worker fails closed with `builder returned no envelope`.
- **Weaker parallel parser:** the loader is the only producer of production `semanticEmbodiment` graph requests and validates through the shared `validateSourceRelationshipGraphAuthority`; the Worker forwards raw params without a TS-side re-parse; the Rust mirror is the strictest parser on the path.
- **Endpoint coercion:** numeric endpoints resolve only as zero-based source-row positions; string endpoints only against exact durable row IDs via hash lookup; no trimming, prefix or row-value matching. Out-of-range numeric endpoints fail at the resident dataset-construction boundary (registration returns no handle), pinned by a TS test.
- **Identity instability:** node order is durable row IDs ascending; `EdgeSortKey` is a total order over (canonical endpoints, weight-present, exact weight bits, source position); weight participates via `to_bits()`, never float comparison; UNDIRECTED canonicalization preserves multiplicity and is permutation-stable; the permutation tests prove byte-identical payloads across reordered registrations.
- **Envelope escape:** node/edge bounds refuse before output growth; the 2 MiB byte bound is checked on the full serialized envelope before it can escape, and an over-bound payload is replaced wholesale by a `RESOURCE_LIMIT` refusal.
- **Counts dishonesty:** a REFUSED envelope structurally cannot carry nonzero retained counts; READY requires source==retained counts, `refusedEdgeCount==0` and `elementCount==edges.len()`.
- **Transport races:** the loader fences generation/version/fingerprint before and after execution, re-checks result metadata, and binds `provenance.decisionId` to the decision; the bridge retains the authoritative request on READY only, with provenance reconciliation.
- **Panics/leaks:** the single `expect` is guarded by the pre-growth edge bound; all size arithmetic is checked; every ABI path deallocs; output drift between sizing and write calls fails closed.
- **Invented edges:** the named falsifier uses five perfectly-correlated near-duplicate rows — prime k-NN/proximity/correlation bait — and proves both halves: no declared edges ⇒ `MISSING_EVIDENCE` refusal, and one declared edge ⇒ exactly one retained edge over the same coordinates.

## Findings and disposition

### B2-RF-01 — endpoint-refusal `estimatedElements` reported the failing edge's position — RESOLVED IN BRANCH

`estimated_elements` at the three per-edge refusal sites reported `position + 1`, which a consumer reading the field as an output-size estimate (its meaning in the envelope/byte refusals) would misread. **Fix-forward:** all three sites now report the source edge count; the failing edge is named in the refusal message. Rust and TS fixtures use three edges with the failure at position 2 so the assertion distinguishes count (3) from position (2).

### B2-RF-02 — `nonFiniteWeightPolicy` was unenforceable on the production path — RESOLVED IN BRANCH

`JSON.stringify` demotes a source-declared `NaN`/`Infinity` edge weight to `null` (absent) before Rust can see it, so the kernel-level refuse-payload check could not fire on the production path and a READY graph would silently demote the weight. **Fix-forward:** `loadGraphSemanticEmbodiment` now refuses datasets whose edges carry non-finite weights before registration, and a loader test proves the refusal never reaches the transport. The kernel-level check remains as defense in depth for direct callers, with the transport demotion documented in the Rust parameter comment.

### B2-RF-03 — row-ID guarantee comment overstated registration behavior — RESOLVED IN BRANCH

JSON registration mints synthetic `fingerprint:index` row IDs when source-declared IDs are absent/invalid (duplicates, empties); the comment claimed registration guarantees source-declared IDs. The uniqueness re-check remains real defense for direct kernel callers, but the comment now states the minting behavior truthfully. A source dataset declaring duplicate row IDs therefore yields a READY graph whose `sourceRowId` values are the canonical resident IDs, not the defective declared ones; if stricter refusal is wanted for defective-declared-ID-with-edges sources, that is a vocabulary decision for B3/B4, not a B2 defect.

### B2-RF-04 — arbitration-binding checklist overclaimed — RESOLVED IN BRANCH (DOC)

The B2 evidence binds a real `Dataset` through the real analytical Worker into the resident Rust authority, but never touches `buildDatasetSignature`/`arbitrate`/`AtlasCore`. **Fix-forward:** the programme-doc checklist item is re-scoped to the completed Worker/resident-Rust half; the `Dataset -> buildDatasetSignature -> arbitrate -> AtlasCore` extension is explicitly deferred to B3, where the production cutover makes that path live.

### NOTE dispositions

- Source-structure test renamed to state honestly that it pins structure/wiring (`pins the resident-authority source structure and strict TS transport wiring`); the other eight tests execute real WASM and the real Worker.
- The columnar-only refusal branch (previously the only untested production branch in the module) now has a dedicated cargo test refusing `columnar-only resident datasets` without fabricating an empty graph.
- `validate_ready_envelope` is documented as a self-consistency validator (internal invariant check, not a trust boundary); it cannot detect consistently recomputed tampering because it never sees the source dataset.
- Zero-edge refusal asymmetry (no READY all-isolated-node graph) is documented as designed in the module: B1 disqualifies explicit authority at zero source edges, and V1 topology exists only when the source declares it.

## Final bounded claim

B2 may be `VERIFIED COMPLETE` only for the resident payload authority and its transport: strict authority mirroring, exact endpoint resolution against durable identity, whole-payload fail-closed refusals, deterministic semantic identity stable under row-preserving reorders, all three envelope bounds enforced at the authority (with the measured byte-bound/edge-bound interaction), honest counts, real-WASM/real-Worker evidence and the named no-invented-edges falsifier. It does **not** claim production representation availability (B3 cutover), presentation layout treatment (B3), silent edge-drop path closure (B1-RF-03, B3/B4), graph drill-down membership (fails closed today; Stream A contract consumption is B3), or product/browser evidence (B4).

**Disposition:** promote B2 after the branch's unchanged exact head passes the required repository gates. B3 owns the production cutover, the silent edge-drop paths and the deferred arbitration-binding extension; B4 owns the product/scale/perceptual evidence matrix and the independent STOP review.