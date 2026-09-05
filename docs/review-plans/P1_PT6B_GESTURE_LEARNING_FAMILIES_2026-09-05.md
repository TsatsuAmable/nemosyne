# P1-PT6B Gesture-Learning Event Families — Pre-Implementation Adversarial Contract

**Date:** 5 September 2026  
**Base:** `main@ddde20e66a59108cab8d73b68632a9e97808b635`  
**Risk:** HIGH — privacy/consent, research governance, biometric-like raw trajectory data, evidence provenance and future training admissibility

## Bounded mission

Define the first two closed governed collection families that PT6 may later wire to the data service:

1. **L2 derived gesture observation** for bounded 56-dimensional on-device derived features plus strong explicit confirmation/correction labels in Product Mode;
2. **L3 raw spatial trajectory research capture** for bounded dual-hand raw trajectories in Research Mode only.

This tranche defines reviewed notice/retention/authority/protocol policy artifacts, immutable references, closed family schemas, and an explicit gesture-learning registry. It does **not** create a live consent service, capture token endpoint, ingestion route, durable learning store, uploader wiring, training job, model promotion, or deployment.

## Invariants

1. Product Analytics consent can never authorize either learning family.
2. L2 derived-learning consent can never authorize L3 raw trajectory capture.
3. L3 requires both an explicit raw-trajectory consent receipt and a frozen study protocol.
4. L2 is Product Mode only in this tranche and accepts only strong explicit confirmation/correction labels. Controlled protocol-target labels remain admissible at the PT6A snapshot layer but require a future Research-Mode derived-feature family rather than being smuggled through Product Mode.
5. Raw trajectory payloads are structurally impossible in the L2 family.
6. Derived feature arrays are exactly the production feature width and bounded to the extractor's numerical range.
7. Both families require exact application/deployment/platform and perception/gesture treatment provenance; unrelated Moneta/NIL/representation/WASM identities are forbidden.
8. Purpose pseudonyms remain purpose-scoped. Product session, investigation and DiscoveryEpisode identity are forbidden from these first learning families to avoid accidental cross-purpose joins.
9. Family definitions are code-owned, immutable and digest-pinned. Changing notice/retention/authority meaning requires an explicit version/digest change.
10. Defining a family is not evidence that collection is live or lifecycle-complete.

## Production / authority path reviewed before implementation

```text
PT6A strong label + snapshot contracts
  -> PT3 GovernedEventEnvelopeV1 / registry validation
    -> PT6B closed L2 or L3 family definition
      -> future PT6C purpose-specific consent/capture authority
        -> future admission/storage/lifecycle
```

Existing `GestureCaptureUploader` is treated as a hostile legacy prototype. Its `consent` / `rawTrajectoryConsent` booleans and `/api/gesture-ingest` endpoint must not become authority by being referenced from this tranche.

## Primary adversarial attacks

- register L2 with `PRODUCT_ANALYTICS` purpose or product-analytics notice;
- register L3 with only a consent receipt and no frozen protocol;
- allow L3 in Product Mode;
- include raw hand points or arbitrary metadata in L2;
- admit derived feature arrays of the wrong width, non-finite values, or values outside the frozen feature range;
- admit raw point arrays beyond the bounded trajectory capacity or coordinates/timestamps outside declared bounds;
- make Product Mode L2 accept `PROTOCOL_TARGET` and thereby blur controlled-study labels into ordinary product feedback;
- require/permit product-session or investigation identifiers that create cross-purpose linkage;
- omit `perceptionGestureTreatment` runtime provenance;
- let policy artifacts drift without version/digest changes;
- silently interpret family registration as live collection readiness.

## Falsifying evidence required

Focused tests must prove:

- both family definitions construct successfully under the canonical governed registry;
- L2 purpose/data-class/mode/authorization/provenance requirements are exact;
- L3 purpose/data-class/mode and dual authorization bases are exact;
- L2 rejects unknown raw-trajectory fields and wrong feature widths/ranges at payload validation;
- L3 rejects oversized trajectories and unknown fields;
- Product Analytics authorization references cannot satisfy L2/L3 requirements;
- L2 cannot accept a protocol-target label;
- reviewed artifact digests are pinned and deterministic;
- the registry exposes only the explicitly declared PT6B families and does not alter the existing Product Analytics registry.

## Non-goals / deferred work

- purpose-specific grant/revoke/capture authorization persistence;
- authenticated HTTP endpoints;
- durable ingestion/storage/export/erasure;
- raw object storage;
- client uploader replacement;
- controlled Research-Mode derived-feature family for `PROTOCOL_TARGET` labels;
- weak-label (`undo/retry`, inferred context) collection;
- training snapshot materialization from durable stores;
- model training, registry, shadow/canary or rollout.

Any pressure to implement those in this tranche is scope expansion and requires a new adversarial boundary review.
