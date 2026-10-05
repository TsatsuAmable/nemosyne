# FM1/FM2 direct-loop product integration

**Status:** PROPOSED (planning only — authorizes no code changes).
**Roadmap rows:** FM1 `PRODUCT INTEGRATION OPEN`, FM2 `SURFACE QUALIFICATION OPEN`.
**Risk tier of the proposed work:** high-risk (interaction grammar + representation-authority routing; needs its own pre-implementation contract and independent post-review, possibly an RFC/ADR for NIL dual-path semantics).

## Goal

Bridge the completed DSE direct loop (DSE1–3, DSE6-qualified) into the
researcher-facing product path: NIL intent actions and
inspector/history/alternative views must operate on direct compilations,
traversals, disclosures, and critique→alternative links — not only on the
legacy FullMoneta stack.

## Success criteria

- Every in-scope NIL command and surface reads direct-loop state through the
  real `AtlasCore` path.
- No legacy NIL/branch/critique behavior regresses; DSE1–3 + DSE6 and FM2
  batteries stay green.
- Investigator-visible disclosure, purpose, and link lineage are qualified
  headless; on-device rendering/comprehension remains DSE6-physical business.

## Approach

Reuse the landed aggregate entry points rather than new authority: route NIL
`PREFER` to `resolveDirectAlternativeFromCritique` when a direct compilation
is active (explicit precedence, legacy branch preserved where a FullMoneta
decision owns the context); record `REJECT` into the direct critique ledger
and link it to the alternative with author attribution intact; render
disclosures, links, and variant pairs from aggregate getters in inspector,
history, and alternative view-models; carry links/bindings on existing
history/package capture (extend only if a gap is proven).

## Steps

1. Define NIL dual-path routing and legacy-fallback precedence (possible
   RFC/ADR if command semantics change); implement `PREFER`/`REJECT` direct
   routes in `src/interaction/nil/AtlasNilBindings.ts` reusing aggregate methods.
2. Add inspector disclosure + purpose view-models over
   `discloseDirectConjectural` and traversal bindings.
3. Add history/alternative view-models over `getDirectFeedbackLinks`,
   `getDirectAlternativeFeedbackBindings`, and `getActiveVariantPair`.
4. Verify `EvidenceLedger`/V4 packaging carries links/bindings; extend only on
   proven gap.
5. Production-path batteries: NIL→aggregate→link, view-model rendering,
   refusal preservation (purpose, authority, budget), legacy regression suite.

## Validation plan

- `tests/fm-direct-loop-integration.test.ts` (new): NIL command → link record
  → view-model assertions through `AtlasCore`; unknown-link, wrong-purpose,
  and self-labeling refusals.
- Existing suites: DSE1–3, DSE6, FM2 NIL/branch batteries green unmodified.
- `npm run typecheck`, `npm run lint`, `npm run docs:check`,
  `npm run architecture:boundaries`; full CI on the implementation PR.

## Risks / open questions

- NIL dual-path semantics may need an RFC/ADR — the implementer decides
  during step 1 and stops for governance if command trust changes.
- VR rendering/comprehension qualification is explicitly out of scope
  (device lane). No open product questions: surfaces render existing
  aggregate state; no new authority is proposed.
