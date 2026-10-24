# RFC 0013 — FM8 composition evidence binding

**Status:** ACCEPTED and IMPLEMENTED (#1056, merge `f5bd84d7`, 24 October 2026); independent SHADOW-0017 revalidation and Full Moneta integration qualification remain open.

**Governing authority:** [Definitive Vision](../Nemosyne_Definitive_Vision_and_Roadmap.md).
**Execution:** [ROADMAP](../ROADMAP.md) (FM8 composition row).
**Related:** SHADOW-0017 (candidate finding), [RFC 0011](0011-dual-epistemic-embodiment-and-preservation.md) (snapshot/context boundaries), PR #962 (FMA-10 repair, whose fallback this RFC replaces).

## 1. Context

`FullMonetaEngine.synthesizeOrAdapt` step 8 composes one rendered element per representation primitive (`src/moneta/adaptation/FullMonetaEngine.ts`). PR #962 repaired phantom graph edges (SHADOW-0016) but left the evidence-selection ladder intact: per primitive, the backing snapshot is the first family match, else the same array position, else the primary snapshot — and when re-brokering a non-primary snapshot is not admitted, the primary slice is silently kept. `FormaMultiElementRuntime.registerElement` performs no compatibility check, so a primitive can render evidence selected only by array position, or the primary slice by default, with no refusal and no record of the substitution (SHADOW-0017).

The family comparison (`source.family === prim.kind`) is not a governed mapping. Primitive kinds are a closed 15-member vocabulary (`POINT_IDENTITY`, `DENSITY`, `FIELD`, `CLUSTER`, … `COMPARISON` in `RepresentationGraph.ts`); snapshot source families are open strings populated from `envelope.representationFamily` (`AGGREGATE`, `CLUSTER`, `DENSITY`, `DISTRIBUTION`, `GRAPH`, `POINT`, `POINT_CLOUD`, `RELATIONSHIP_GRAPH`, …). The overlap is coincidental string equality (`DISTRIBUTION` matches; `POINT_IDENTITY` matches neither `POINT` nor `POINT_CLOUD`), never an asserted compatibility relation.

The sole production caller (`InvestigationAggregate.adaptRepresentation`) passes no snapshot list, so the engine always composes from the single primary snapshot today. Any rule must therefore distinguish the single-snapshot case (the caller asserts that snapshot covers the graph) from an explicit snapshot list (the caller attempts per-primitive binding and can fail at it).

## 2. Decision requested

Adopt the following binding rule and failure semantics for multi-element composition:

1. **Single snapshot (default, no explicit list):** behavior unchanged — the caller asserts universal coverage, every primitive renders the admitted primary slice.
2. **Explicit snapshot list:** each primitive must resolve by family match; otherwise composition refuses with a named reason identifying the primitive and the unmatched kind. No positional fallback, no primary substitution, no silent primary-slice registration.
3. **Recorded basis:** the composed state records, per element, whether its evidence was family-matched or primary-asserted, so later audit (and the V4 lineage in RFC scope) can distinguish the two.
4. **Mapping table v1 (recommended, owner to amend):** exact matches attested in-tree today (`DENSITY`, `DISTRIBUTION`, `CLUSTER`, `GRAPH`) pass; every other kind requires an explicit mapping entry before it can family-match. If the owner prefers, the table may be deferred and rule 2 alone adopted, with unmapped kinds refusing until mapped.

## 3. Options considered

- **A. Status quo (positional/primary fallback):** loses. It silently substitutes unrelated evidence, which is the reported defect; keeping it concedes SHADOW-0017.
- **B. Strict family-match everywhere:** loses. It breaks the single-snapshot production flow and, worse, elevates coincidental string equality into a trust decision without a governed mapping.
- **C. Recommended (rules 1–4 above):** fails closed exactly where the caller attempted binding, preserves the production single-snapshot flow byte-for-byte, and makes the remaining vocabulary question (the mapping table) explicit and auditable instead of implicit.
- **D. Caller-supplied per-primitive bindings (map keyed by primitive id):** strongest binding, but an API change plus a production-caller rewrite for a failure mode option C already closes. Defer until C proves insufficient.

## 4. Consequences

- **Migration:** explicit-list callers that relied on fallback will now throw. Today that set is tests only (verified: the sole production caller passes no list); intended breakage, and the refusal names the primitive.
- **Compatibility:** no format break. Composed state gains optional per-element basis annotations; old readers ignore them, matching the additive-field posture used for V4 lineage.
- **Scientific:** a primitive can no longer render evidence selected by array position or silent default; every rendered element is either caller-asserted or family-matched-and-recorded.
- **UX:** investigators see a named refusal instead of a plausible-but-unrelated composition. No interaction-grammar change.
- **Performance:** one list scan per primitive, same shape as today; negligible.
- **Operational:** new refusal reasons surface through the existing adaptation error path; no deployment change.

## 5. Verification plan

- New unit tests: explicit multi-snapshot list with one unmatchable primitive throws with the primitive named; single-snapshot flows byte-identical (existing `fm3-4-composition-resolution` suite green unmodified); recorded basis present per element in composed state.
- Falsifier: reintroduce the positional fallback — the new tests fail.
- Independent validation of SHADOW-0017 against the implemented rule before any ledger status change (validation must be independent per shadow governance; this RFC is the proposal, not the validation).

## 6. Resulting ADR

Accepted refined Option C. See [ADR 0014](../architecture/decisions/0014-fm8-governed-composition-evidence-binding.md) for the immutable decision.

## 7. Notes (related context, not decided here)

- SHADOW-0018 (recorded-advice replay consumption) appears addressed by `09670185` ("consume verified recorded System-1 advice on replay", FM5-R4 tests asserting `RECORDED` provenance without proposer rerun). Flagged for independent validation; no decision is requested by this RFC.
- The phantom-edge concern referenced as SHADOW-0016 (no ledger record exists; known only through SHADOW-0017's text) was addressed by PR #962's relationship checks and is unaffected by this proposal.
## 8. Architecture review addendum (2026-10-22, owner decision still open)

**Scope:** static re-check of current `main@4382e1d` sources; this is an advisory refinement, **not** an accepted ADR, implementation authorization, device qualification, or SHADOW-0017 ledger promotion.

### Source-backed findings

- `FullMonetaEngine.ts` step 8 still chooses `snapshotsList.find(source.family === prim.kind) ?? snapshotsList[i] ?? snapshot`. A failed non-primary `brokerVariant` silently retains the primary slice. `FormaMultiElementRuntime.registerElement` copies the supplied slice/snapshot id and a caller-provided `phenomenonFamily` but does not verify a semantic family mapping. This confirms the central *candidate* defect against current code, but SHADOW-0017 status still requires its own governed validation.
- The closed `RepresentationPrimitiveKind` union currently contains **18**, not 15, kinds (including `AGGREGATION`, `FILTER`, `DETAIL_EXPANSION`). A naïve equality rule leaves `AGGREGATION` vs `AGGREGATE` and `POINT_IDENTITY` vs `POINT`/`POINT_CLOUD` unresolved. Exact string equality alone is not an approved evidence mapping.
- `FullMonetaEngine` validates the primary snapshot, then accepts each additional snapshot for brokering without an explicit comparison of its `analyticalDatasetFingerprint` to the primary snapshot's. `FormaResolutionBroker.brokerVariant` is given a snapshot and context but not the selected graph's or primary snapshot's dataset identity, so per-snapshot admission by itself cannot prove one coherent analytical dataset for the composition. No mixed-dataset *successful exploit* was executed in this static review; the missing coherence guard is a design falsifier to run.
- Distinguish **absent** `options.snapshots` (today's production caller asserting one primary snapshot) from **explicit empty/one/many** lists (caller requesting evidence selection). Otherwise `snapshots: []` remains an implicit primary fallback, defeating explicit binding semantics.

### Recommended amendment to option C before acceptance

1. Preserve the omitted-list production behavior only, explicitly labeling per-element basis as `PRIMARY_ASSERTED` rather than calling it an individually verified family match. Do not grant that assertion to an explicitly supplied empty list.
2. For explicit lists, first require each snapshot's analytical dataset fingerprint to equal the primary snapshot's final analytical fingerprint, pending a separately approved multi-dataset contract. Validate/record kernel identity where applicable; do not conflate the portable dataset fingerprint with the transformed analytical fingerprint.
3. Select only via a closed, reviewed `primitive kind -> admitted source family` mapping. Unmapped/ambiguous kind, missing snapshot, duplicate contradictory matches, mismatched analytical identity and a non-admitted broker result all **refuse with named reasons**. No positional/default substitution.
4. Commit the selected `snapshotId`, `sliceId`, primitive ID and **binding basis** into the composed result's versioned/auditable identity. Check whether changing composed-state members requires a schema/identity update before calling additive fields backward compatible.
5. Add falsifiers: reordered explicit lists are semantically invariant; explicit `[]` refuses; `AGGREGATION`/unsupported mappings refuse until governed; an unrelated-dataset same-family snapshot refuses; a budget/admission refusal does not register the primary instead; the omitted-list production flow remains unchanged. Keep the current FM3/4 graph-edge and admissibility batteries green.

**Owner decision required:** accept refined C, modify it, or request a larger per-primitive binding API. Until that decision/ADR and code review occur, this addendum proposes no change to runtime behavior. It does not justify a Full Moneta completion claim.

## 9. Implementation contract and adversarial gate (2026-10-24)

**Owner approval:** refined Option C accepted, including explicit empty-list refusal, identity coherence before binding, closed source-family mapping, no substitution, and evidence-basis commitment. Explicit-list only maps `DENSITY:DENSITY`, `DISTRIBUTION:DISTRIBUTION`, `CLUSTER:CLUSTER`, `GRAPH:GRAPH` until a reviewed mapping extension. `AGGREGATION` is intentionally *not* `AGGREGATE` by coincidence.

**Versioning:** The unbound direct runtime retains schema/identity v1 unchanged. FM8 emits schema/identity v2 with per-element `primitiveId`, `basis`, `sourceFamily`, analytical fingerprint and kernel version. Exact selected `snapshotId` and `sliceId` are already in every element record and enter the new digest. The omitted-list composition still renders the same admitted primary slice for every primitive, but now records `PRIMARY_ASSERTED`; the changed composition identity is intentional and must be checked by exact-head tests. Existing historical v1 artifacts are not rewritten.

**STOP/falsifiers:** reject mixed analytical dataset/kernel identity, explicit `[]`, unapproved primitive families, absent or ambiguous matches, unadmitted secondary slices and wrong-snapshot broker output before export. Explicit-list order cannot decide evidence. Reject attempts to reconstruct a bound element with a foreign snapshot. Must preserve prior graph-edge fidelity and all default production paths. No scientific evidence authority delegated to TS: it can only pair already issued snapshots under this owner-approved composition policy. Never claim device, real-data, or human qualification from headless tests.

**Risk classification:** high risk, epistemic/rendering binding. Merge requires reviewed exact head, static analysis, test falsifiers, all Vitest shards, Rust, production/browser CI, CodeQL and approval gate. Revalidate SHADOW-0017 separately before retiring its ledger finding.
