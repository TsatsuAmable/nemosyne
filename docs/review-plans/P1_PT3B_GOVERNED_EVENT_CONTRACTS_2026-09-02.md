# P1-PT3B governed-event contracts adversarial review

**Date:** 2 September 2026

**Status:** implementation complete; independent post-review cleared; pre-merge

**Authority:** accepted RFC 0003

**Scope:** closed TypeScript contracts, deterministic canonical payload digests, an immutable event-family registry, fail-closed envelope admission, and negative falsifiers

## Invariant

An envelope is structurally valid only when its versioned family definition proves the exact purpose, non-empty data-class set and derived sensitivity; required identity, dataset and runtime references are present while forbidden references are absent; authorization and retention references exactly match immutable registry pins; and a bounded JSON payload satisfies its closed schema and canonical SHA-256 digest. It becomes admitted only after a separately supplied trusted authority verifies the referenced receipt/policy state, retention-policy currency and applicable Research Mode freeze at evaluation time. The boundary must never repair, default, reinterpret or silently discard unknown input.

This tranche does not make governed collection a production property. No live producer, queue, transport, durable store, export or lifecycle path will call the new boundary yet, and PT3B must state that limitation explicitly.

## Authority and bounded call path

`src/governance/` owns the new transport-boundary vocabulary and validation. It may depend on the audited SHA-256 primitive, but not on UI, networking, persistence, telemetry, Atlas, Moneta, NIL, study-domain or Rust/WASM implementations. It references those authorities through versioned identifiers without redefining their meaning.

The hostile wire entry is bounded UTF-8 JSON text, not an arbitrary executable JavaScript object. Its parser rejects duplicate keys before materializing the value, bounds input bytes/depth/nodes, and never evaluates accessors or Proxy traps. Any already-decoded-value helper is internal and consumes only the parser's plain JSON values.

The executable path in this tranche is:

```text
bounded UTF-8 JSON text
  -> duplicate-rejecting strict JSON parser + value bounds
    -> exact envelope/family/version lookup
      -> identity + dataset + runtime policy checks
        -> authorization + retention pin checks
          -> closed payload schema + domain-separated canonical digests
            -> defensively cloned/frozen StructurallyValidGovernedEventEnvelopeV1
              -> trusted current-authority decision
                -> admitted immutable event or typed refusal
```

The future production path remains the RFC path: a real producer must invoke this admission entry point before record, queue or export, and PT4 ingestion must validate independently before durable storage.

## Primary failure modes to attack

1. Unknown top-level, nested or payload properties survive because JavaScript ignores or strips them.
2. Duplicate JSON keys, non-finite numbers, excessive input bytes/depth/node count or lone Unicode surrogates hash to a plausible JSON value or consume unbounded resources. Executable-object hazards are excluded by accepting wire text rather than caller-owned objects.
3. Family metadata permits an empty class set, a purpose outside the intersection of class permissions, a declared sensitivity below the computed maximum, duplicate classes, or a dataset reference without `SCIENTIFIC_DATASET_REFERENCE`.
4. Empty, duplicated or collapsed identity values make profile, session, investigation and discovery identity interchangeable; forbidden identity context is tolerated.
5. Dataset catalogue coordinates use a mutable revision, omit an artifact digest, or disagree about catalogue and scientific identity.
6. Applicable runtime components are absent, `unknown`/placeholder values are accepted, an adaptive model lacks its artifact digest, or forbidden components drift into a family.
7. One authorization purpose or basis authorizes another; duplicate references appear to satisfy a required combination; policy coordinates are incomplete or family-incompatible; or shape/static-pin checks are mislabeled as current consent/policy authority.
8. A producer substitutes its own retention policy or supplies the right policy ID with a different version/digest.
9. Payload bytes are measured differently from the bytes that are hashed, allowing limit or digest disagreement.
10. Exact-duplicate identity covers only payload data, allowing purpose, identity, runtime, authorization or retention mutations to reuse an event ID/digest pair.
11. A registered family, parsed source object or returned envelope is mutated through a retained alias.
12. An empty registry or permissive toy bypass makes every negative test pass without exercising a complete family definition.
13. Tests exercise only internal helpers and never the exported JSON-text structural-validation and authority-gated admission entry points.
14. The tranche overclaims replay-ledger, revocation, erasure, Research Mode freeze-drift enforcement or live producer coverage that it does not implement.

## Frozen digest and registry decisions

- `NEMOSYNE_CANONICAL_JSON_SHA256_V1` hashes UTF-8 bytes of `nemosyne:governed-payload:v1\n` followed by the validated payload's canonical JSON.
- `NEMOSYNE_GOVERNED_EVENT_SHA256_V1` hashes UTF-8 bytes of `nemosyne:governed-event-content:v1\n` followed by canonical JSON for every semantic envelope field except `contentDigest`; it includes `payloadDigest` and the payload.
- Canonical JSON sorts object keys by ECMAScript UTF-16 code-unit order, preserves array order, uses JSON string escaping, rejects unpaired UTF-16 surrogates, permits only finite JSON numbers, and normalizes negative zero to `0`. Validation limits are applied before canonicalization; canonical payload UTF-8 byte length is the family size measure.
- The public JSON-text boundary permits at most 1,250,000 UTF-8 bytes, nesting depth 32 and 50,000 parsed nodes. A family may permit at most 1,000,000 canonical payload bytes, and validation reports at most 100 detailed issues plus one limit marker.
- Policy/reference digests use an explicit `SHA256` algorithm field and lowercase 64-hex values.
- The implementation exports an immutable registry builder for trusted code-level definitions but enables no production event family. Tests must register one complete operational-aggregate-like family with exact schema, identity/runtime rules, authorization combination and retention pin. This is registry-mechanics evidence only; enabling a real family requires the actual reviewed authorization and retention policy artifacts plus producer-path review.

## Cheapest falsifying evidence

- Drive structural negative cases through the exported JSON-text validator and authority failures through `admitGovernedEventEnvelopeV1(jsonText, registry, authority)`.
- Establish canonical byte and digest goldens independent of object key order, including the chosen negative-zero and Unicode policies.
- Reject unknown envelope, family and payload versions, unknown properties at every governed envelope level, and family/purpose/class/sensitivity mismatches.
- Reject every missing-required and present-forbidden identity, dataset and runtime component; reject cross-kind identity value reuse.
- Reject missing, duplicate, wrong-purpose, wrong-basis and wrong-policy authorization combinations, plus any retention pin mismatch.
- Reject payload-schema extensions, digest mismatch and size/depth/node-limit violations.
- Attempt to mutate source definitions, returned registry views, source JSON-derived aliases and every returned nested value, then prove subsequent validation/admission behavior is unchanged.
- Verify the governance boundary imports only the hashing utility and JSON-compatible types, and run the repository architecture gate.

## Non-goals and dependencies

- No production event family is enabled. No live producer migration, consent UI/store, pseudonym generator, key rotation, deletion mapping, queue, network transport, ingestion service, durable store, export adapter or erasure traversal.
- No stateful stream registry, duplicate/idempotency ledger, out-of-order/gap disposition, revocation queue processing or current-policy resolver. Envelope structure is necessary but not sufficient evidence for those later properties.
- No built-in receipt/current-policy authority and no Research Mode `StudyFreezeGuard` wiring or runtime-drift observation. The admission API requires a trusted authority capability, but PT3B supplies no production implementation of it.
- No `.nemosyne` format-v3 identity migration and no mutation of Atlas, NIL, study-domain, dataset or Rust/WASM formats.
- No RF-040, privacy-compliance, production-collection, product-mode-adaptation or governed-research completion claim.
- The accepted RFC remains the architectural decision. If executable design requires changing its identity, purpose, class, authorization, retention, runtime or public-format semantics, implementation stops for a reviewed RFC amendment.

## Planned post-implementation review

An independent reviewer will compare the diff and exported admission path to this invariant, replay these failure modes, inspect registry immutability and dependency direction, and classify findings as `BLOCKER`, `DEFER` or `SUGGESTION`. PT3B may merge only after blockers are fixed and the remaining defers are recorded without promotion overclaim.

## Pre-implementation adversarial disposition

Independent review found five blockers in the first draft: structural checks were mislabeled as authoritative admission; canonicalization lacked a complete frozen preimage; a payload-only digest could not support exact-duplicate semantics; returned-value alias mutation was untested; and an empty/toy registry could pass trivially. This revision resolves them through authority-gated admission, the frozen dual-digest rules above, defensive immutable values, and a complete contract-like test definition while keeping all production families disabled. The reviewer also identified hostile Proxy and duplicate-key risk; the public wire boundary is now bounded JSON text with duplicate rejection rather than arbitrary `unknown` objects.

## Implementation outcome

The tranche implements the bounded parser, closed payload schemas, immutable family registry, exact identity/dataset/runtime/authorization/retention checks, dual canonical digests, structural validator and trusted-authority admission entry point under `src/governance/`. The dependency boundary allows only governance-internal imports plus `src/security/CryptoHash.ts`. `EMPTY_GOVERNED_EVENT_REGISTRY_V1` deliberately enables no production family.

Registry construction additionally fails closed on unstable versions, unknown schema/lifecycle values, purpose/class contradictions, incomplete minimum authorization bases and authorization-incompatible revocation behavior. Ordinary consent-backed collection requires `DISCARD_QUEUED`; Research/frozen-study and consent-backed validation combinations require `POLICY_GOVERNED`. Optional backup/share requires an explicit user action. These are registry-mechanics constraints, not evidence that any corresponding producer or authority implementation exists.

## Post-implementation adversarial disposition

The independent reviewer initially classified registry enum gaps, session-linked consent omission, unstable version aliases, incorrect revocation semantics and insufficient falsifier breadth as `BLOCKER`. Those issues were fixed and re-reviewed. The final exact-workspace disposition is **no blockers**.

The remaining items are `DEFER` by scope: reviewed production-family enablement; live producer and independent ingestion wiring; real consent/current-policy and `StudyFreezeGuard` authorities; stateful stream duplicate/gap/replay handling; lifecycle, revocation and erasure traversal; pseudonym/key operations; and any production/privacy/product-completion claim. No `SUGGESTION` changes the merge fitness of this tranche.

## Verification evidence

- Focused PT3B suite: 42/42 passing, including parser limits, digest goldens, all identity/runtime requirement coordinates, both dataset dispositions, nested unknown properties, exact authorization combinations, revocation semantics, alias isolation, recursive returned-value immutability and the authority gate.
- Fast suite: 164/164 passing; TypeScript typecheck passed.
- Production build passed. Existing Rust dead-code/deprecation warnings and bundle chunk warnings remain unchanged and are not represented as fixed here.
- Documentation integrity and the 9/9 hygiene audit passed.
- The full source architecture boundary passed over 446 modules / 1,412 dependencies, and its fail-closed fixture proved the governance-to-product rejection plus the allowed hash edge under the supported bundled Node runtime.
- Focused ESLint passed with no errors; the existing `no-console` warning in the architecture fixture remains. Scoped formatting for the implementation and review artifact passed. Repository-wide formatting is not claimed: the existing broad formatting backlog, including `docs/ROADMAP.md`, still makes the global check fail.
- The full coverage suite passed: 462 files / 2,813 tests; 81.51% statements, 70.50% branches, 81.23% functions and 84.11% lines.
