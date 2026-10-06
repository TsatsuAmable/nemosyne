# RFC 0013 — FM8 composition evidence binding

**Status:** PROPOSED for owner review.

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

Pending acceptance. Link the immutable ADR here once recorded.

## 7. Notes (related context, not decided here)

- SHADOW-0018 (recorded-advice replay consumption) appears addressed by `09670185` ("consume verified recorded System-1 advice on replay", FM5-R4 tests asserting `RECORDED` provenance without proposer rerun). Flagged for independent validation; no decision is requested by this RFC.
- The phantom-edge concern referenced as SHADOW-0016 (no ledger record exists; known only through SHADOW-0017's text) was addressed by PR #962's relationship checks and is unaffected by this proposal.