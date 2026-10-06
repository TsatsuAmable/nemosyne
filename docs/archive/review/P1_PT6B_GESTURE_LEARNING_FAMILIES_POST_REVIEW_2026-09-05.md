# P1-PT6B Gesture-Learning Event Families — Post-Implementation Adversarial Review

**Date:** 5 September 2026  
**Base reviewed:** `main@ddde20e66a59108cab8d73b68632a9e97808b635`  
**Disposition:** ADOPT if the unchanged exact head passes required promotion gates

## Scope attacked

- `src/governance/GestureLearningFamilies.ts`
- canonical PT3 governed registry / payload / authorization validation
- PT6A label and snapshot contracts
- production `@nemosyne/gesture-intelligence` feature constants
- dormant `GestureCaptureUploader` and `CaptureRecorder` as hostile legacy inputs, not authorities

This tranche defines families and immutable policy/schema references only. No collection path is enabled.

## Findings

### 1. Generic closed schemas cannot enforce cross-field label truth

A naive L2 payload with independent `labelSource`, `predictedGesture` and `assignedGesture` fields would allow structurally valid nonsense such as an `EXPLICIT_CONFIRMATION` whose predicted and assigned gestures differ. Generic payload validation intentionally has no family-specific cross-field logic.

**Fix by construction:** L2 carries one closed `labelCode`. The 36 admissible codes are exactly six confirmations plus 30 directed corrections between different gesture classes. `PROTOCOL_TARGET` is absent from the Product-Mode family. `decodeDerivedGestureLabelCodeV1` maps an admitted code back to the PT6A strong-label semantics without an ambiguous cross-field state.

### 2. Product Analytics and L2/L3 authorization remain cryptographically distinct pins

L2 requires a `CONSENT_RECEIPT` whose authority and policy references are the reviewed derived-learning pins. L3 requires both a raw-research `CONSENT_RECEIPT` and a separately pinned `FROZEN_STUDY_PROTOCOL`. Generic authorization validation compares exact immutable references, not only basis names.

Focused falsifiers supply Product Analytics authority/policy references to L2 and omit the protocol from L3. Both fail the canonical authorization validator.

### 3. L2 cannot contain raw trajectories

The derived family is a closed object containing only feature-schema identity, exactly 56 bounded feature values, one strong-label code and bounded label evidence metadata. Unknown `left`/`right` or other fields are rejected by the canonical payload validator.

The feature artifact is pinned to the production extractor constants (`FEATURE_DIM=56`, `FEATURE_WINDOW_FRAMES=16`, values bounded to `[-1,1]`). A future extractor change therefore cannot silently enter old learning evidence under the same reviewed schema identity.

### 4. L3 is Research-only and deliberately more restrictive

The raw family is `RESEARCH` only, classified `RAW_SPATIAL_TRAJECTORY`, requires the exact perception/gesture treatment runtime component, and uses policy-governed revocation because frozen-protocol semantics are involved. Product session, investigation and discovery identities are forbidden.

The payload bounds each hand to the current 60-sample gesture capacity, requires an explicit schema identity and coordinate frame, bounds coordinates, and represents time as milliseconds from capture start rather than exposing the legacy recorder's absolute timestamp directly.

### 5. The legacy recorder/uploader cannot be wired through unchanged

This review found a useful intentional incompatibility rather than a reason to weaken PT6B:

- `CaptureRecorder` can accumulate more than 60 points; L3 rejects more than 60 per hand.
- legacy raw points use absolute `t`; L3 requires bounded `dtMs` from capture start.
- `GestureCaptureUploader` uses booleans and a generic `/api/gesture-ingest`; PT6B requires purpose-specific immutable authorization references.

**Disposition:** DEFER producer projection and service wiring to PT6C. The future adapter must explicitly normalize/validate timestamps, enforce capacity, attach schema/runtime provenance and acquire purpose-specific authorization. Directly POSTing the legacy Tier B record would be a contract violation.

### 6. `APPLICATION_WORLD_METERS` is an explicit capture coordinate frame, not a universal physical frame

Current hand transforms are consumed as application world-space positions. PT6B records that exact meaning rather than claiming room-scale, body-relative, headset-relative or globally stable coordinates. Recenter/origin semantics remain part of platform/runtime provenance and future research preprocessing.

This is sufficient for a bounded raw-capture family, but no training/equivalence claim may assume cross-session absolute coordinates are directly comparable. A later normalized/body-relative representation must receive a new schema identity rather than silently changing this one.

### 7. Retention values are engineering maxima, not legal/ethics claims

The reviewed artifacts bound derived-learning retention to at most 90 days and raw research retention to at most 14 days, with raw protocols allowed to require shorter retention. These values do not assert GDPR/IRB/ethics sufficiency. The eventual consent/lifecycle authority must enforce the applicable notice and protocol and may shorten retention; it may not silently lengthen these reviewed maxima.

### 8. Family registration does not manufacture a live authority

The immutable authority references describe what a future service must prove. PT6B creates no grant/revoke state, capture token, authenticated route, durable store, exporter or erasure traversal. The existing Product Analytics registry is unchanged and the new learning registry is explicit/separate.

## Falsifiability

The focused suite fails if any of the following regress:

- L2/L3 are merged into Product Analytics by default;
- Product Analytics authority/policy pins are accepted as L2 consent;
- L3 loses its frozen-protocol requirement;
- L2 accepts `PROTOCOL_TARGET`, raw fields, wrong feature width or out-of-range features;
- L3 accepts oversized arrays or arbitrary extra fields;
- feature/trajectory schema artifacts drift without digest changes;
- gesture capacity or feature-width constants drift without a reviewed schema update.

## Residual boundary / next tranche

PT6C should implement purpose-specific consent/capture authority and admission/storage lifecycle for these exact families, or revise the family contract under a new high-risk review first. It must not make the boolean legacy uploader authoritative.

Still deferred: controlled Research-Mode derived-feature family for protocol-target labels; durable learning snapshots; training execution; registry/promotion; shadow/canary deployment.

## Promotion disposition

**ADOPT PT6B**, conditional on unchanged exact-head typecheck, lint, architecture policy, full Vitest/coverage, production build/smoke, Rust, CodeQL and approval gate, with no review debt or `main` drift.
