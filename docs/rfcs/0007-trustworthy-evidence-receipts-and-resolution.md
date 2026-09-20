# RFC 0007 - Trustworthy evidence receipts and resolution

**Status:** accepted

## Context

TEC0 (#803) established a concrete production gap. Rust already owns rich `EvidenceClaim<T>`
records containing estimand, measurement/geometry context, assumptions, sample support,
uncertainty, stability, sensitivity, limitations and method provenance. Production Moneta,
however, is still fed primarily through:

```text
DatasetStructureProfile
  -> WASM transport
  -> DatasetEvidence
  -> DatasetEvidenceSignature
  -> Moneta / SemanticEmbodimentGraph
```

That path preserves useful analytical values and provenance, but it does not preserve every
epistemic axis carried by `EvidenceClaim<T>`. The existence of rich Rust claim types is
therefore not evidence that Moneta can resolve the governing claim behind an
`evidenceRef`.

TEC1 must close this without turning TypeScript into a second analytical authority, without
making `DatasetEvidenceSignature` the scientific record, and without requiring every
future analytical family to migrate in one release.

## Decision requested

Adopt a versioned **Rust-issued evidence receipt bundle** as the durable bridge between
Rust `EvidenceClaim<T>` records and downstream Moneta / semantic representation.

The receipt is a metadata projection of the governing Rust claim, not a replacement
calculation and not a scalar quality score. Existing `DatasetEvidence` values remain the
compact analytical-value envelope during migration.

## Decision

### 1. EvidenceReceiptBundleV1

Rust/WASM owns creation of a closed version-1 bundle:

```text
EvidenceReceiptBundleV1
  schemaVersion
  datasetFingerprint
  kernelVersion
  receipts[]
```

Each `EvidenceReceiptV1` contains:

- `receiptId`: stable within the dataset/kernel evidence bundle;
- `claimId`: the originating Rust `EvidenceClaim<T>.claim_id`;
- `estimand`;
- `measurementContext`: an explicit tagged state, either `ESTABLISHED` with the
  relevant `MeasurementModelRecord` values or Rust-issued references plus any governing
  semantic-admission policy/result, or `NOT_ESTABLISHED`; an empty array is not allowed to
  masquerade as established context;
- optional `geometry`, including metric, transformations, columns and missingness policy;
- `assumptions[]` with the existing explicit statuses;
- `sampleSupport`;
- optional `uncertainty`;
- optional `stability`;
- `sensitivity[]`;
- `limitations[]`;
- full method provenance including dataset fingerprint and kernel version.

A missing optional axis means **not measured / not established**. It never means zero risk,
stability, certainty or admissibility.

### 2. Receipt identity and scope

Receipt IDs are opaque identifiers issued by Rust. They are resolved only inside a bundle
whose dataset fingerprint and kernel version match the active DatasetEvidence context.

TypeScript must not synthesize a receipt that claims Rust analytical authority. Compatibility
adapters may continue to produce DatasetEvidence without receipts, but such evidence is
explicitly **TEC-unresolved** and cannot satisfy a downstream requirement for a governed
receipt.

For V1, a migrated DatasetEvidence item uses the same identifier as its Rust-issued
`receiptId`. The default receipt ID is the Rust `claimId` when uniqueness is proven inside
the bundle. This eliminates an ungoverned TypeScript claim-to-value mapping. Existing
TypeScript-generated evidence IDs remain compatibility identities until their family migrates.

If later cross-bundle portability requires stronger identity, the receipt ID may become
content-addressed under a new schema version. This RFC does not require a cross-language
canonical-hash protocol in V1.

### 3. Resolver boundary

TypeScript may validate and resolve receipts, but it may not recompute or upgrade them.
A serialized receipt bundle is durable evidence data, not a runtime authority capability.
The live decision path accepts only a resolver minted by `MonetaEvidenceAuthority` from the
current Rust dataset handle, or by the governed replay loader after exact evidence-integrity
and identity checks. Arbitrary caller JSON cannot mint that capability.

The resolver takes:

```text
(dataset fingerprint, kernel version, receipt id, authority-owned requirement profile)
```

Requirement profiles are code/policy-owned contracts for the analytical or representation
operation. A candidate, UI caller or learned model cannot weaken them by requesting fewer
axes.

The resolver returns either the immutable receipt or a typed refusal such as:

- `RECEIPT_NOT_FOUND`
- `DATASET_MISMATCH`
- `KERNEL_MISMATCH`
- `MISSING_REQUIRED_AXIS`
- `VIOLATED_ASSUMPTION`
- `UNRESOLVED_ASSUMPTION`

The resolver does **not** produce a universal `ADMISSIBLE=true` judgment. Scientific
admissibility remains governed by the method-specific analytical admission rules and the
Moneta Evidence Protocol. In particular, the resolver cannot invent a stability threshold,
interpret a missing stability value as stable, or turn the presence of a receipt into
promotion authority. A policy-specific gate may later classify measured stability as
acceptable or unacceptable, but that decision is separate from receipt resolution.

### 4. DatasetEvidence and DatasetEvidenceSignature

`DatasetEvidence` remains a compact analytical-value envelope during TEC1 migration.
This RFC does not make `DatasetEvidenceSignature` an evidence authority.

A migrated DatasetEvidence item must be explicitly bound to a Rust-issued `receiptId`.
The preferred end state is to use the receipt ID as the evidence identity. Where an existing
persisted/compatibility evidence ID must remain stable, Rust must emit the explicit binding or
alias as part of that family's migration; TypeScript may copy it but may not guess, rename or
manufacture the association.

DatasetEvidence V1 may therefore coexist with the companion bundle during incremental
migration, but an ID-semantic change that would break persisted consumers requires the
normal schema/version compatibility process.

`DatasetEvidenceSignature` may retain receipt IDs or evidence IDs for traceability, but
must never copy absence of uncertainty/stability into favourable decision features.

### 5. Semantic embodiment and MCR

For MCR2+ production composition, every `SemanticEmbodimentNodeV1.evidenceRefs` used
to justify scientific or analytical meaning must resolve against the active evidence receipt
bundle.

Unknown, dataset-mismatched, kernel-mismatched or required-axis-incomplete receipts fail
closed before spatial compilation. Structural MCR1 validation remains valid, but structural
non-empty `evidenceRefs` alone are not TEC closure.

Semantic nodes store references only. They do not duplicate receipt payloads, perform
statistical tests, or become an analytical cache.

### 6. Migration and compatibility

Migration is family-by-family:

1. expose a Rust/WASM receipt transport for one already-wrapped `EvidenceClaim<T>`
   family;
2. preserve any established measurement/admission context and represent absent context
   explicitly rather than inventing it;
3. prove prepared-result lifetime, identity and exact-value transport across the real bridge;
4. add TypeScript structural validation and immutable resolution;
5. bind the corresponding DatasetEvidence items to Rust-issued receipt IDs, preserving
   legacy IDs only through explicit Rust-issued aliases where compatibility requires them;
6. only then allow downstream semantic/MCR gates to require those receipts.

Unmigrated families remain usable by the current single-winner compatibility path only
where existing scientific policy already permits them. They are not silently upgraded to
TEC-closed evidence.

## Options considered

### A. Expand DatasetEvidence into a complete EvidenceClaim clone

Rejected. It would duplicate the scientific record in TypeScript and force a broad breaking
migration before one family can be qualified.

### B. Keep only string evidenceRefs with no resolver

Rejected. A non-empty string proves identity syntax, not that the governing claim,
assumptions, support or uncertainty remain available.

### C. Store opaque runtime-only Rust handles in semantic nodes

Rejected as the sole identity mechanism. Runtime-local handles are capabilities and cannot
serve persistence/replay or cross-runtime identity.

### D. Rust-issued durable receipts plus a TypeScript resolver

Accepted. It preserves Rust analytical authority, supports incremental migration, keeps
semantic graphs compact, and makes missing epistemic axes observable instead of silently
favourable.

## Consequences

### Scientific

- uncertainty, stability, assumptions and sensitivity remain independent axes;
- missing axes remain explicit absence, not positive evidence;
- receipt presence alone never means admissible or scientifically strong;
- legacy heuristic labels cannot become calibrated claims through transport.

### Architecture

- Rust/WASM owns receipt creation;
- TypeScript owns validation, orchestration and lookup only;
- DatasetEvidenceSignature remains a projection;
- SemanticEmbodimentGraph and RepresentationGraph carry references, not copied claims.

### Compatibility

DatasetEvidence V1 may coexist with a companion receipt bundle during TEC1. The
companion contract must not be used to smuggle an incompatible change to persisted evidence
identity under the same schema. A future mandatory receipt field, changed identity semantics
without an explicit alias, or incompatible serialization requires the normal version/RFC
compatibility process.

### Persistence and replay

Replay must pin dataset fingerprint, kernel version and receipt identity. Serialized receipts
remain inspectable historical evidence but do not recreate a live resolver capability merely
by being parsed. A governed replay loader must verify the persisted evidence/investigation
integrity and exact identity before minting a replay resolver. If a required receipt cannot be
resolved under that context, the dependent scientific or representation operation fails
closed rather than substituting a newer claim.

## Threat model

The implementation must survive:

1. caller-created receipt lookalikes;
2. reuse of a valid receipt against another dataset;
3. replay under a different kernel version;
4. evidence ID rebound to an unrelated claim;
5. omitted assumptions or support being interpreted as favourable;
6. a legacy heuristic score being presented as measured stability/uncertainty;
7. semantic evidenceRefs that are syntactically valid but unresolved;
8. TypeScript deriving scientific admissibility from receipt presence;
9. candidate/caller-selected requirement profiles that omit inconvenient axes;
10. stale receipt bundles surviving dataset-handle replacement;
11. deserialized caller JSON being treated as a live resolver capability;
12. a resolver returning mutable receipt objects that callers can alter after validation.

## Verification plan

The RFC is fit for implementation only if the first TEC1 slice can prove:

- a real Rust `EvidenceClaim<T>` family emits receipts through the prepared-result WASM
  bridge with exactly one authoritative computation per request;
- receipt dataset/kernel identity matches the live handle or the bridge refuses it;
- assumption status, sample support, uncertainty/stability absence, sensitivity and
  limitations survive serialization exactly;
- TypeScript validation rejects malformed, duplicate and mismatched receipts;
- returned receipts are immutable from the caller's perspective;
- unresolved/missing required axes produce typed refusal rather than positive defaults;
- no TypeScript analytical recomputation is added;
- existing DatasetEvidence compatibility consumers remain source-compatible;
- exact-head Rust tests, focused bridge tests, typecheck, lint, docs checks and CI pass.

## Resulting ADR

After the accepted contract is implemented on a production path, record the immutable
architecture decision as ADR-0007.

