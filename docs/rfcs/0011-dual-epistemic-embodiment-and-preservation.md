# RFC 0011 — Dual epistemic embodiment and materialized preservation

**Status:** accepted as amended (delegated architectural adjudication)<br>
**Date:** 3 October 2026<br>
**Reviewed base:** `5926da8b9c071bc5eeff02b104d63c8602d6abb0`<br>
**Specification and source analysis:** [A27-1 reassessment](../architecture/A27_1_DUAL_EPISTEMIC_REASSESSMENT.md).<br>
**Amends:** [RFC 0010](0010-moneta-semantic-snapshot-and-forma-admission.md). Its historical acceptance and unchanged claim-bearing invariants remain valid. ROADMAP controls sequencing.

## Context

The governing vision now requires both claim-bearing verification and exploratory abduction. RFC 0010 has no closed conjectural binding or committed epistemic-purpose contract and does not fully specify preserved experiential state independent of generator availability. It already records proposals/plans without rerunning models; this amendment extends that foundation.

## Original proposal (resolved by adjudication below)

1. Commit epistemic purpose in Investigation context independently of production/study permission and preservation/generation policy. Purpose changes produce new context identity and revoke pending adoption.
2. Preserve grounded `SemanticSnapshotV1` identity. Capture conjectural values under existing proposal/decision/session ownership with separate immutable identity, never as fabricated receipt-backed truth.
3. Version the binding contract to distinguish grounded analytical sources from captured conjectural sources. Require material property/relation statuses OBSERVED, DERIVED, IMPUTED, HYPOTHESIZED and COUNTERFACTUAL, dependency provenance, uncertainty availability and inspectable support/contradiction. Labels cannot authenticate themselves or upgrade hypothetical dependencies.
4. Extend fixed obligations and deterministic Forma admission to authorize explicitly conjectural ordinary exploratory use, while retaining qualification/study restrictions and all grounded evidence checks. No exploration flag bypasses trust boundaries. Promotion requires a new evidence-backed decision with lineage.
5. Separate generator reproduction, safe materialized restoration and derived reinterpretation. Persist bounded declarative scene state and required assets, salient viewpoint/layout, annotations, retained alternatives, epistemic types and available provenance. A supported retained artifact can be restored without its generator; missing critical rendering dependencies fail or explicitly degrade. Current retraction/use restrictions remain visible and enforceable.
6. Resolve these fields before the prospective V4 schema freezes, maintaining legacy digests and the first-slice authoritative dataset scope. No new database, truth owner or executable archive format.
7. Permit a comparative shared recurrent/adaptive-depth proposal-generator research design, without selecting a model or transferring decision authority. Isolate exploratory adaptive state from frozen claim-bearing/study execution; preserve FM6 requirements for product learning from human judgments.

## Alternatives and consequences

- Treat all exploration as STUDY_ONLY: rejected as a conflation of epistemic purpose with research permission.
- Relax all receipt/replay requirements behind a mode flag: rejected because false grounded claims and archive self-authorization would become possible.
- Add hypotheses to analytical snapshots: rejected because model-dependent conjecture would contaminate grounded identity.
- Separate typed immutable proposal content under existing owners: selected; increases capture size and contract complexity but preserves analytical authority and durable exploratory experience.

Perceptual qualification is still required where policy demands it. Preserving an experience does not establish its truth, exact pixels, current claim eligibility or complete temporal replay. No runtime, model quality, latency or hardware capability is delivered by this RFC.

## Verification and acceptance

A27-1 §7 specifies production-path falsifiers and positive controls. Documentation checks establish document integrity only. The delegated adjudication below resolves the acceptance gate. Its explicit amendments govern affected contracts; implementation and production evidence remain required.

## Resulting ADR

None. Record implementation decisions and exact evidence after implementation; do not rewrite historical acceptance records.

## Architectural adjudication — 3 October 2026 (normative)

**Official disposition: AMEND; ACCEPTED AS AMENDED.** The project owner explicitly delegated binding architectural adjudication in the task “Adjudicate Architectural Inconsistencies Between A27-0 and A27-1 (RFC 0011)”. This records that delegated decision, not a claim that the owner separately reviewed this exact text. These clauses resolve the four seams and take precedence over conflicting prospective language in A27-0/A27-1/RFC 0010. Unchanged invariants and historical acceptance remain in force. Repository-wide execution clearance takes effect when this adjudication is integrated; no implementation or merge is performed by this decision.

**Synchronized base:** `76715ebcf3c2892c92f8fea9882f6f339ddd82cf`, including requested `93807e75` and the subsequent PR #933. Unlike the earlier assessment base, this main contains provisional context/perspective V1 code. Package V4 remains unimplemented: `src/session/NemosynePackage.ts` still defines V1/V2/V3. PR #929 supplied the vision change; #932 supplied A27-1/RFC 0011.

### Contract notation and trust

The TypeScript below defines normative interface boundaries, not landed source declarations. All values are deeply immutable after bounded closed decoding, including defensive copies or deep freezing at ownership boundaries; TypeScript readonly alone does not establish this. `Id` and `Digest` are validated identifiers/digests in their producer-defined encodings, not proof of authenticity. Existing node/investigation/receipt IDs and dataset fingerprints retain exact producer bytes; domain tags are mandatory for newly minted content identities defined here, not retrofits to legacy IDs. `ArtifactRef = { schema: string; id: Id; digest: Digest }`; the referenced schema must be in an explicit versioned allowlist, resolve exactly once and validate before use. Unknown schemas/fields, unresolved references, duplicates, non-finite numbers and over-budget structures refuse. No generic JSON bag may substitute for a family payload, policy scope or conjecture grammar. Exact leaf schemas and size limits belong to their owning contract implementation and are prerequisites for that slice's review, not permission to accept arbitrary values.

### Seam 1 — mandatory purpose and context identity

`epistemicPurpose` is required before the L1 closed context freezes. It is independent of `PRODUCTION`/`STUDY_ONLY` permission and historical inspection. No ambient UI mode, `studyId`, `observerMode` or model preference may supply or override it.

PR #933's `CommittedInvestigationContextV1` and its `sha256-committed-context-v1-` identity remain a provisional legacy domain contract. They must not be silently widened or made current by defaulting missing purpose. Introduce V2 for the governed path:

```ts
type EpistemicPurpose = 'CLAIM_BEARING' | 'EXPLORATORY_ABDUCTION';
type IntentSlot =
  | { kind: 'PRESENT'; value: InvestigationIntentV1 }
  | { kind: 'LEGACY_ABSENT' };
interface InvestigationContextBodyV2 {
  readonly investigationId: Id;
  readonly nodeId: Id;
  readonly contextRevision: number; // immutable commit ordinal, safe nonnegative integer
  readonly analyticalDatasetFingerprint: Digest;
  readonly epistemicPurpose: EpistemicPurpose;
  readonly intent: IntentSlot;
  readonly perspective: InvestigationPerspectiveV1 | null;
  readonly policyScopeRef: ArtifactRef; // closed task/domain/accessibility scope, not authorization
}
interface CommittedInvestigationContextV2 {
  readonly schemaVersion: 2;
  readonly contextId: Id;
  readonly body: InvestigationContextBodyV2;
}
type InvestigationContext = CommittedInvestigationContextV2;
interface ContextActivationV2 {
  readonly contextId: Id;
  readonly investigationId: Id;
  readonly nodeId: Id;
  readonly runtimeInstanceId: Id;
  readonly activationGenerationId: Id; // fresh on ledger/controller recreation
  readonly activationEpoch: number; // runtime-issued monotonic safe integer
}
```

`contextId = H('investigation-context-v2', body)` using A27-0's H. Immutable `contextRevision` participates in the hash; activation epoch does not. Revisit restores the original revision/body/hash and issues a fresh epoch. Recreating a ledger/controller issues a fresh activationGenerationId even in the same runtime; epochs must never wrap or restart within one generation. An edit, including a purpose change, creates a new DAG node/revision; it must not overwrite the map entry for a historical node. The mutable `revision` in the provisional V1 ledger is not the new persisted commit ordinal. Scope content is committed transitively through its verified reference, but its policy meaning is validated by the consuming authority; a caller cannot choose a weaker admission policy.

Intent retains ADR 0009 canonicalization. V2 node/investigation identifiers are exact authoritative IDs, not NFC/trim aliases. Perspective V1 from #933 is the deliberately narrow first slice; its temporal/uncertainty enums are foregrounding requests, not scientific assertions. Admission must resolve supported semantics and refuse unsupported requests. Richer perspective fields require a versioned extension, not silent additions to V1.

Legacy migration requires explicit purpose selection and a new V2 context/decision with linkage to the original; it never rewrites V1–V3 historical digests. `LEGACY_ABSENT` records unavailable old intent, not authorization to default a missing purpose. ResearchContext remains a projection. Production adoption checks the active Investigation-owned binding and runtime instance, then the required fresh capability; serialized activation cannot authorize execution.

### Seam 2 — strict grounded snapshot / conjecture boundary

“100% Rust-grounded” means every analytical value/relation has authoritative Rust provenance and the requisite evidence contract. It does not mean certainty, absence of approximation, or that an input observation is factually infallible. TypeScript may validate, normalize bounded descriptors and hash; it cannot infer new measurements or scan data to fill gaps.

The following defines the closed envelope. `Family` and `FamilyLeafRef<F>` come from the finite versioned L0 adapter table: a family-specific schema, exact typed analytical request, method/parameters/seed, normalization/missingness/sampling, support/approximation/information-loss and content commitments. They cannot be caller-selected arbitrary schemas. Runtime decoding verifies family/request/leaf schema agreement as well as the static discriminant. A new family needs an explicit adapter and claim-complete governed consumer/profile before it can produce AVAILABLE values.

```ts
type GroundedStatus = 'OBSERVED' | 'DERIVED' | 'IMPUTED';
interface EvidenceUseRef {
  readonly datasetFingerprint: Digest;
  readonly kernelVersion: string;
  readonly bundleContentDigest: Digest;
  readonly receiptId: Id;
  readonly receiptContentDigest: Digest;
  readonly consumerId: Id;
  readonly requirementProfileId: Id;
  readonly requirementProfileDigest: Digest;
  readonly admissionPolicyId: Id;
  readonly admissionPolicyDigest: Digest;
}
type SemanticSource<F extends Family> = {
  readonly sourceId: Id;
  readonly family: F;
  readonly requestRef: FamilyRequestRef<F>;
} & (
  | { readonly state: 'AVAILABLE'; readonly analyticalLeafRef: FamilyLeafRef<F>;
      readonly evidenceUses: readonly EvidenceUseRef[] }
  | { readonly state: 'UNAVAILABLE' | 'REFUSED'; readonly reasonRef: ArtifactRef;
      readonly suppliedProvenanceRefs: readonly ArtifactRef[] }
);
interface SemanticSnapshotV1 {
  readonly schemaVersion: 1;
  readonly snapshotId: Id;
  readonly body: {
    readonly analyticalDatasetFingerprint: Digest;
    readonly kernelVersion: string;
    readonly semanticVocabulary: ArtifactRef;
    readonly normalizer: ArtifactRef;
    readonly coverage: readonly FamilyCoverage[];
    readonly sources: readonly { [F in Family]: SemanticSource<F> }[Family][];
    readonly nodes: readonly GroundedSemanticNode[];
    readonly relations: readonly GroundedSemanticRelation[];
    readonly limitations: readonly TypedLimitation[];
  };
}
interface ConjecturalProposalV1 {
  readonly schemaVersion: 1;
  readonly proposalId: Id;
  readonly snapshotId: Id;
  readonly contextId: Id;
  readonly generatorProvenanceRef: ArtifactRef;
  readonly elements: readonly ConjecturalElement[];
}
```

`FamilyCoverage` is the A27-0 ordered requested family/request identity and availability. `GroundedSemanticNode` retains A27-0 nodeId/sourceId/producerSemanticId/propertyPath and typed measurement/unit/frame/refinement descriptors; each value property references a validated family leaf path and carries `GroundedStatus` supplied/justified by that producer's schema. `GroundedSemanticRelation` retains relationId/type/endpoints and authoritative relation leaf reference. Unavailable/refused nodes expose only state/reason, never value bindings. `TypedLimitation` is a closed vocabulary code/source reference plus its schema-validated payload. L0 must publish the first family's exact leaf/descriptor union with its tests; no universal estimator or invented units are authorized by this envelope.

`ConjecturalElement` is a closed bounded proposal-grammar element with elementId, typed property/relation payload reference, status `IMPUTED | HYPOTHESIZED | COUNTERFACTUAL`, assumptions, dependency references, actual supporting/contradicting evidence references and explicit uncertainty availability. A model estimate labeled IMPUTED remains conjectural unless an authoritative analytical method separately establishes the corresponding grounded assertion. Derived-from-conjecture content stays in this proposal branch and cannot become grounded DERIVED by relabeling. Explicit derivation from analytical IMputed outputs may be grounded only where the producer method and evidence justify it, preserving the imputation dependency.

Snapshot hashing, local IDs, ordering, missingness and exclusions remain A27-0 §4; no model, proposal, context or purpose enters snapshot identity. Proposal identity hashes its closed body excluding proposalId under `conjectural-proposal-v1`. References cannot create cycles. Moneta owns proposal capture, including System-1 output; Rust/evidence owners alone supply grounded leaves. Proposal provenance is never a snapshot source. An unavailable grounded source may coexist with a conjectural completion only if no required grounded assertion is claimed and the fixed policy permits the disclosure/completion; it cannot excuse a failed required analytical claim.

### Seam 3 — assertions are validated, never passed through as authority

```ts
type FormaBinding =
  | { kind: 'GROUNDED'; snapshotId: Id; sourceId: Id; propertyPath: string;
      epistemicStatus: GroundedStatus }
  | { kind: 'CONJECTURAL'; proposalId: Id; elementId: Id; propertyPath: string;
      epistemicStatus: 'IMPUTED' | 'HYPOTHESIZED' | 'COUNTERFACTUAL' };
```

Forma validates these assertions at compilation, and production import/export/adoption must preserve and enforce the same discriminant:

1. Closed decode, scope/budget checks and resolution of snapshot/context/proposal identities. Fixed policy comes from the authority, not from the model or archive.
2. GROUNDED: resolve exact property/relation leaf, verify producer-declared status/method, full evidence/profile binding and current disposition through its owner. OBSERVED requires observed lineage; a derived estimate is not observed merely because it is stored in Rust.
3. CONJECTURAL: verify the recorded payload/status, dependency graph, assumptions and available provenance; enforce `EXPLORATORY_ABDUCTION` for these material data bindings. A claim-bearing context may discuss hypothesis text as an investigation question, but cannot present conjectural bindings as established analytical facts. A formal research treatment exploring conjecture uses exploratory purpose plus separate study authorization.
4. Propagate dependency limitations; refuse grounded binding to a conjectural dependency. Validate mixed objects at property/relation granularity, not one object-wide label. Mere labels, model confidence or geometric consistency cannot mint receipts.
5. Enforce mandatory status/uncertainty/support disclosure and qualified mappings in every executable variant. Failure to preserve the distinction refuses; study authorization does not waive it.
6. Bind the admitted result to exact typed content, purpose, obligations and permitted use. Evidence exports accept only appropriately validated grounded assertions with their original status; exploratory artifacts export in their typed namespace. Generic exporters cannot strip the discriminator and emit conjectures as observations. Import verifies commitments and reauthorizes use; archived admission is not a capability.

Promotion produces new analytical evidence and a new decision with lineage, never an in-place status rewrite. The existing PRODUCTION/STUDY_ONLY/REFUSED axis stays separate from epistemic purpose.

### Seam 4 — complete V4 now; separate restoration authority

A27-0's stored proposal/plan closure is necessary but insufficient. Add required fields to the **unshipped V4** `investigation/forma.json` envelope before freezing it. Keep package format 4, digest tag `sha256-canonical-investigation-v4` and envelope version 1; preserve shipped V1–V3 bytes/digests. No V5 is needed for this adjudication. A later incompatible change after V4 ships would still require honest versioning.

Every V4 Forma capture commits the following in addition to A27-0's member set:

| Required field | Closed meaning |
| --- | --- |
| `contextRef` | V2 context including explicit purpose and scope. |
| `conjecturalProposalRefs` | Exact selected/retained proposal artifacts; explicit empty list for no conjectures. |
| `epistemicBindingsRef` | Complete property/relation discriminants, dependencies, caveats and reverse explanations. |
| `generationRecordRef` | Known generator/model/state/input/policy identity and explicit unavailable provenance; generation reproducibility claim is separate from preservation. |
| `staticCapture` | Discriminated `NONE` with reason, or `CAPTURED` with the artifact below. NONE cannot claim materialized-restoration support. |

A CAPTURED artifact contains the selected immutable plan/variant, supported interpreter/schema reference, required asset digests, committed context/binding references, bounded spatial organization and salient viewpoint, annotations, retained alternatives (explicitly empty when none), uncertainty/provenance availability and historical admission references. All captured state and references participate in the V4 digest transitively. Nested versions remain explicit. L2 owns the closed field schema and quantitative limits under these requirements; there is no optional unverified scene blob.

The manifest distinguishes required **restoration** dependencies from known **generation** provenance. A missing generator executable does not invalidate a verified captured plan. Missing committed content or critical rendering assets does; metadata inspection may survive but must not claim a complete restoration. No fetch/evaluation of arbitrary archived code. The first scope is static captured views over the single final analytical context, not arbitrary historical numerical states or event replay.

**Restricted historical-inspection capability:** the current trusted runtime issues a nonserializable `HistoricalInspectionCapability` only after capture integrity, supported safe interpreter, resource limits and any privacy/study access restrictions pass. It binds captureId (the digest of the complete captured artifact), runtime instance, inspection activation generation/epoch and current restriction/disposition check. It authorizes only historical rendering/navigation and inspection export retaining typed content; it cannot authorize analytical execution, active Moneta adoption, scientific evidence export or reuse of historical scientific permission. A retracted/unknown current evidence disposition is visibly marked and disables scientific use, rather than silently represented as current validity. A prohibition on viewing for privacy/study reasons still refuses. Changes revoke/recheck the capability; a serialized archive cannot mint one.

`CurrentUseCapability` remains the distinct fresh admission path with active context/runtime/evidence checks. The inspector must not install historical plans as the current analytical view under a different function name. If the backend cannot enforce the separation and visible status, refuse restoration. This resolves A27-1's deferred capability boundary; implementation must prove it through actual loader → capability → renderer/adoption paths.

### Execution clearance and required evidence

After integration of this decision, the A27-1 adjudication gate is satisfied. Dedicated worktrees and exclusive leases remain mandatory; this does not authorize simultaneous edits to shared session/digest/graph seams.

| Lane | Binding clearance |
| --- | --- |
| **L0-SEM-NORM-A** | Architecturally cleared for the grounded snapshot/first-family adapter slice. Existing TEC and claim-complete consumer/profile prerequisites remain; if no qualifying family is available, expose the specific dependency rather than invent evidence. |
| **L1-PERSPECTIVE-0** | Cleared for a focused V2 context follow-up to provisional #933, including mandatory purpose, identity and immutable commit semantics. Preserve V1 compatibility. Domain evidence is not production integration evidence. |
| **L2-FORMA-0** | Cleared for bounded KB0 and admission/graph contract work against these interfaces in an exclusive worktree. Final freeze/integration depends on merged and verified L0/L1 contracts; do not fork competing context/snapshot types. |
| **L2-FORMA-1** | Remains the serialized production adoption/package/digest/capture/restoration slice after upstream contracts and applicable evidence gates. No blanket clearance for early shared-file wiring. |

L0 and L1 may proceed in parallel only with disjoint declared file sets. L2 may perform disjoint contract/preparatory work, but may not treat architecture clearance as satisfied upstream implementation dependencies. No model deployment/adaptation or capability milestone is promoted.

Required follow-up falsifiers: purpose-only edits change context but not snapshot identity; V1 missing purpose never silently becomes V2; cross-investigation/dataset context substitution and A→B→A fail; old node edits branch rather than overwrite; mixed observed/conjectural save/import/export retains status; hypothetical dependencies cannot mint observed/derived authority; generator removal permits supported static inspection but not fresh claim authorization; retraction/access changes revoke the appropriate capability; missing assets and unknown schemas fail closed. Pair refusals with admitted controls through real production paths. A27-0 §12 and A27-1 §7 remain applicable.
