# A27-0 — Full Moneta authority, identity and version decision

**Date:** 3 October 2026<br>
**Exact reviewed base:** `8a5be7fdcb5b3c23ce11ea8cfd3db58f97b2e597` (`origin/main`, merged PR #923).<br>
**Disposition:** **ACCEPTED — implementation handoff ready** (project-owner acceptance, 3 October 2026). No production capability or downstream tranche is complete.<br>
**Scope:** the identity/admission/version seam requested by [ERA-ASTRA1](ARCHITECTURE_2027_REVIEW.md), not a repeat architecture review.<br>
**Governing authorities:** [Definitive Vision](../Nemosyne_Definitive_Vision_and_Roadmap.md), [ROADMAP](../ROADMAP.md), [Full-Moneta target](FULL_MONETA_SEMANTIC_EMBODIMENT_ARCHITECTURE_PLAN.md). [RFC 0010](../rfcs/0010-moneta-semantic-snapshot-and-forma-admission.md) records explicit project-owner acceptance of the contracts below on 3 October 2026, following review of PR #927 at `4cc007827e9103d0e8efd2ddcef8e025e5372dd6`. The architecture acceptance gate is satisfied; implementation starts from fresh main after integration of this PR, under the dependencies and exclusive ownership in §14.

## 1. Decision summary

1. Introduce `SemanticSnapshotV1`: an immutable, bounded, decision-independent projection of authoritative analytical outputs and exact evidence references. It is a new contract, not a new analytical store or a renamed `SemanticEmbodimentGraphV1`.
2. Moneta deterministically derives and fixes obligations from that snapshot, committed Investigation context and a pinned obligation policy **before candidate generation/comparison**. Persist them inside the decision record; Forma cannot author a weaker set.
3. Forma has one admission/compiler entry point. It delegates scientific admissibility to existing claim owners and returns either a purpose-scoped admitted result or a typed refusal. Parsing a result never grants execution authority.
4. Separate analytical admissibility, perceptual qualification and permitted use. Only `PRODUCTION`, `STUDY_ONLY`, or `REFUSED` describes permitted use. Study execution is explicitly authorized by the study owner and never promotes a mapping.
5. Persist selected inputs/results/plans under a new package V4 and `sha256-canonical-investigation-v4`. Preserve package V1–V3 and their digests unchanged. Exact historical reconstruction, current execution eligibility and compatible adaptation are separate outcomes.
6. Keep the existing owners. No new manager, remote service, ontology, mutable knowledge registry, judgment database, model or parallel admission authority is needed.

### Pre-writing adversarial contract

**Invariant:** presentation and perspective changes cannot change analytical snapshot identity; no candidate, study flag, archive or resource budget can mint stronger evidence, weaken mandatory meaning, or turn historical consistency into current execution authority.

**Authority/production path:** injected Atlas analytical port → Rust family/receipt outputs → governed evidence resolution → Moneta fixed decision context → Forma → context-checked runtime adoption; session export/package/digest/replay owns durability. NIL remains semantic interaction authority.

**Failure modes:** hashing decision metadata as truth; treating opaque receipt IDs as content commitments; caller-selected profiles; candidate-authored obligations; study controls becoming production priors; replay recomputing today's decision; stale same-runtime context; immutable old receipts masking retraction; legacy readers ignoring new authority.

**Falsifying evidence:** source tracing now and the positive/negative production-path scenarios in §12 before implementation promotion. **Non-goals:** new analytical methods, evidence closure by prose, runtime implementation, human/device qualification, adaptive learning and search.

## 2. Reviewed source and governing evidence

The attached Gemini [Mac convergence report](../review-plans/MAC_PRE_ASTRA_CONVERGENCE_2026-10-03.md) is historical intake evidence; its older cleanliness and readiness statements are not current authority. This task fetched remote main, confirmed #923 merged and the ERA artifact present, inspected worktrees and open PRs (none at intake), and found no unexpired host workstream lease before claiming this dedicated worktree. Branch: `architecture/a27-0-authority-version-decision`. Lease owner: `codex-a27-0`. No other checkout was edited. Before delivery, origin/main advanced to `c55165bf94ec0eb0ead44693020ef269922c72ee` via #926, adding only a candidate shadow-ledger record about earlier tranche naming. The diff changes no reviewed source or A27-0 document seam; the reviewed base remains the immutable #923 head. The candidate is not treated as an accepted finding or closed by this decision.

Read alongside the vision/roadmap/current architecture: [dataset-first design](MONETA_DATASET_FIRST_SEMANTIC_EMBODIMENT.md), [MCR0](MONETA_MCR0_AUTHORITY_SCHEMA.md), [System-1/System-2](MONETA_SYSTEM1_SYSTEM2_ONNX_ARCHITECTURE.md), [capability ladder](../roadmap/P1_FULL_MONETA_INCREMENTAL_CAPABILITY_PLAN.md), [MCR plan](../roadmap/P1_MCR_COMPOSITIONAL_REPRESENTATION_EXPANSION.md), [evidence protocol](../research/MONETA_EVIDENCE_PROTOCOL.md), [ADR 0009](decisions/0009-ap-inv-fm1-question-aware-investigation.md), [RFC 0007](../rfcs/0007-trustworthy-evidence-receipts-and-resolution.md), and [RFC 0009](../rfcs/0009-persisted-governed-evidence-replay.md).

Source anchors below are repository-relative and bind to the exact base above. They describe current code, not future enforcement.

| Current source | Observed contract / implication |
| --- | --- |
| `src/data/evidence/DatasetEvidence.ts` | Compact values carry method/version/kernel/parameters/seed/missingness/sampling/limitations. This is not a generic receipt or a universal scientific admission certificate. |
| `src/atlas/MonetaEvidenceAuthority.ts`, `src/atlas/ports/AnalyticalExecutionPort.ts` | Live authority is injected and identity-checked; governed capture composes Rust-issued bundle and consumer attestation with authority-owned policy. Do not mint semantic consumer uses from TS names. |
| `src/data/evidence/ConsumerPolicyRegistry.ts`, `EvidenceRequirementProfile.ts` | The current registered consumer is descriptive statistics. Profiles are minted capabilities and exact historical lookup can refuse. Every family name is not already governed. |
| `src/moneta/representation/SemanticEmbodimentPayload.ts` | The actual exported envelope is `SemanticEmbodimentEnvelopeV1`; the target document's `SemanticEmbodimentPayloadV1` is shorthand, not an additional existing type. READY/REFUSED, approximation, information contract and analytical method already exist. |
| `src/wasm/runtime/SemanticEmbodimentBridge.ts`; `ClusterEmbodimentPayload.ts`, `GraphEmbodimentPayload.ts` | Real family builders consume explicit requests; decision provenance and detail authority are currently coupled. Preserve that legacy detail contract; use explicit projection rather than deleting provenance from its wire format. |
| `src/moneta/representation/SemanticEmbodimentGraphV1.ts` | Required `decisionId`, `graphId`, `provenanceRef` and optional presentation hints make it a decision-bound carrier. String evidence references do not prove resolution. |
| `RepresentationGraph.ts`, `RepresentationGraphAdapter.ts`, `RepresentationDecision.ts` under the same directory | V1 graph has loose visual encodings/policies; the decision includes compatibility embodiment and near-miss fields. Neither is a future Forma execution token. |
| `ComposedRepresentationValidation.ts` | Compatibility provenance can waive missing semantic nodes; shared evidence strings are used for some relations. Neither rule is sufficient for the new scientific binding boundary. |
| `src/moneta/MonetaTopologyNode.ts`, `RepresentationGraphRuntimeAdapter.ts`, `src/app/dataset/SemanticEmbodimentLoader.ts` | Current production selection uses the compatibility runtime, which refuses multiple renderable primitives. Schema existence is not composition/admission delivery. |
| `src/atlas/domain/InvestigationIntent.ts`, `ResearchContext.ts`, `InvestigationGraph.ts`; `src/atlas/types.ts` | Intent canonicalization is standalone; two ResearchContext surfaces exist; graph node IDs and DAG edges own lineage. Do not replace nodes with content hashes. |
| `src/atlas/domain/InvestigationAggregate.ts` (`toState`, `restoreState`, `computeDigest`) | Graph serialization exists, but the current semantic digest projection does not commit the graph as future context authority. |
| `src/session/NemosyneSession.ts`, `NemosynePackage.ts`, `InvestigationReplayRunner.ts`; `src/investigation/InvestigationDigest.ts` | Existing capture/package/replay/digest must remain the single persistence path. RFC 0009's closed receipt envelope cannot carry arbitrary Forma fields. |
| `src/vr/coordinators/WorldSessionController.ts`, `src/app/investigation/InvestigationContinuityController.ts`, `src/vr/presentation/representation/RepresentationSurface.ts` | Restore/adoption crosses dataset load, Atlas restoration, representation and presentation. Lifetime checks alone do not establish a committed perspective revision. |
| `src/moneta/representation/DecisionPolicy.ts`, `EvidenceBackedMoneta.ts`, `src/interaction/nil/NemosyneInteractionLanguage.ts` | Existing representation ABSTAIN/infeasibility and NIL semantic commands are distinct. A malformed context is not ABSTAIN; pipeline refusal is not a NIL command. |
| `src/study/StudyFreezeManifest.ts`, `src/judgement/RepresentationJudgement.ts`, `JudgementLedger.ts`, `src/fitness/PromotionGate.ts` | Treatment pinning, attributed feedback and explicit promotion have owners. None currently supplies generic Forma study authorization or perceptual qualification. |
| `src/security/CryptoHash.ts` | Reuse canonical JSON/SHA-256. It maps non-finite numbers to null, so new closed parsers must reject them **before** hashing; hashing is not validation or authentication. |

## 3. Authority graph and ownership

```text
Rust/WASM analytical outputs + exact governed evidence
  │ claim-owned resolution/admissibility (not utility)
  ▼
L0 SemanticSnapshotV1 ────────┐
                             ├─ Moneta fixes decision context + obligations
Investigation committed C ───┘           │
                                        ▼
                           candidate RepresentationGraphV2 + bindings
                             (manual / deterministic / S1 / S2)
                                        │
policy + pinned knowledge + use authorization + capability envelope
                                        ▼
                              ONE Forma admission/compiler
                                        │
                         admitted immutable result OR refusal
                                        │
                 session capture/digest/replay ↔ adoption authority
                                        │
                        applicable plan → runtime / NIL
```

| State/transition | Single owner | Allowed downstream operation |
| --- | --- | --- |
| Analytical fact, membership, topology, data-derived geometry | Rust/WASM through selected runtime | Reference/transport; never TS recomputation |
| Claim admissibility, required profile, evidence disposition/withdrawal | Existing claim/protocol and evidence authorities | Resolve exact policy; reject absent/invalid authority |
| Snapshot projection | L0 normalization at injected analytical/evidence boundary | Deterministic field projection and finite contract checks only |
| Committed intent, perspective, lineage | Investigation aggregate/graph | Explicit commit/branch/revisit; session is serializer, not another owner |
| Fixed obligations and proposal decision | Moneta representation authority | Derive once before proposals; record policy/content identity |
| Mapping legality, obligation coverage and backend compilation | Forma under Moneta | Delegate scientific checks; satisfy/refuse, never weaken |
| Human meaning qualification and study authorization | Claim-appropriate research/human owner; existing study custody | Scoped evidence/promotion references, not author assertions |
| Knowledge view | Immutable compiler manifest assembled from those owners | Resolve pinned entries; no copied mutable judgment authority |
| Adoption and resource selection | Existing runtime/session lifecycle owners | Check current context/purpose/evidence; choose an admitted applicable variant |
| Durable bytes, compatibility and replay integrity | Existing session/package/digest/replay owners | Version dispatch; preserve history; no authority from JSON alone |
| Critique/judgment retention and learning promotion | Existing judgment/fitness governance | Attribute exact targets; curate and explicitly promote later |

## 4. Decision-independent snapshot and exact identity

### 4.1 Minimal value

`SemanticSnapshotV1 = { schemaVersion: 1, snapshotId, body }`. Its closed `body` is:

```text
analyticalDatasetFingerprint
kernelVersion
semanticVocabulary: { id, version, digest }
normalizer: { id, version, digest }
coverage: ordered family/request descriptors
sources: ordered source records
nodes: ordered semantic node records
relations: ordered supported semantic relation records
limitations: ordered typed limitations
```

A source record contains a unique local `sourceId`, family, exact analytical request identity, method/version/parameters/seed and normalization/missingness/sampling contracts, approximation/support/information-loss state, and immutable analytical content reference. It references **only the analytical projection** of a family output or DatasetEvidence item, not decision metadata. Its evidence references contain `(datasetFingerprint, kernelVersion, bundleContentDigest, receiptId, receiptContentDigest, consumerId, requirementProfileId, requirementProfileDigest, admissionPolicyId, admissionPolicyDigest)` for every governing claim. Digests commit exact validated content; opaque receipt IDs are not globally unique hashes. An unsupported or unmigrated claim cannot fabricate these references. For UNAVAILABLE/REFUSED sources, retain the exact requested identity and only provenance actually supplied by the authority; absent analytical content/method/evidence fields remain absent under that state-specific schema. Such a source can support a disclosure of unavailability, never a value binding.

A node contains stable local semantic ID, source reference, typed property/measurement/unit/frame descriptors, abstraction/refinement references and explicit state. Analytical values live once in bounded typed leaves or referenced captured artifacts; nodes do not clone receipts. Relations must reference authoritative relation leaves: membership, comparison compatibility or causal direction is never inferred from proximity or shared receipt strings.

State is a discriminated union: `AVAILABLE` with exact approximation descriptor, `UNAVAILABLE` with reason, or `REFUSED` with owning reason. Missing uncertainty is explicit absence; measured zero is a value. There is no generic "partial = safe" flag. Coverage lists the requested families/analytical parameters and their availability, so an absent requested family cannot look like evidence of no phenomenon. The finite family vocabulary is a versioned adapter table, not a universal ontology service.

### 4.2 Identity algorithm

For new contracts only, define `H(tag, body) = tag + ':' + canonicalSha256Hex({ tag, body })`, using `src/security/CryptoHash.ts` after closed bounded decoding. For the snapshot use tag `semantic-snapshot-v1`; exclude `snapshotId` itself. Each referenced analytical artifact has a domain-tagged content digest, so changing its bytes requires a changed reference. Receipt content, profiles, method versions/parameters/seeds, ontology/normalizer versions, approximation, missing/refused state and limitations all participate directly or through verified content digests.

The new parsers reject unknown fields, non-JSON values, non-finite numbers, sparse arrays, ambiguous references, duplicate IDs and oversized/cyclic structures before hashing. Numbers use the existing canonical serializer's finite-number and negative-zero behavior. Do not alter that serializer or legacy hashes. Strings in analytical outputs are preserved; only intent/perspective display text follows explicitly declared normalization. Arrays preserve order unless the producer contract declares them sets; declared sets are sorted by stable code-unit IDs at creation, duplicates rejected, and the decoder rejects noncanonical ordering. No locale-dependent sorting or hidden normalization during replay. In this V1 contract, coverage is ordered by family then analytical-request digest; sources by sourceId; nodes by nodeId; relations by relationId; evidence-use references by their full tuple; typed limitations by code then source reference. These are declared sets. Family payload arrays (bins, quantiles, coordinates, receipt parameter tuples) retain the authoritative producer order. Intent/perspective foreground arrays retain declared order. Local sourceId is H('semantic-source-v1', the source record without sourceId); nodeId is H('semantic-node-v1', {sourceId, producerSemanticId, propertyPath}); relationId is H('semantic-relation-v1', its type, endpoints and authoritative source reference encoded as a closed object). A family without stable producerSemanticId/propertyPath cannot qualify this adapter. SnapshotId is never included in these local-ID preimages, preventing circular hashing.

**Excluded from snapshot identity:** decision IDs/timestamps/model/rank, Investigation node/branch/intent/perspective IDs, candidate/template/plan IDs, backend/device/load state, capture time, runtime handles, filenames/locations, presentation hints and human preferences. Their provenance survives in the capture/decision records. Excluding them from truth identity does not mean erasing them.

**Fixed coverage is important:** two views over the same captured analytical state share one snapshot. If a view requests another analysis, different bins, another subset, or additional evidence, this creates a new analytical state/snapshot with explicit derivation lineage. It is not a mere perspective change. Changing the policy/profile bound to a claim creates a new evidence-bound snapshot even if its numeric value is unchanged; dataset identity remains stable. Reordering display foregrounds does not reorder snapshot sources.

Retraction does not mutate an old content hash. The evidence owner supplies a **current disposition revision** at admission/adoption. A changed receipt requires a new source/snapshot identity; a retracted receipt makes the old admission non-executable. Current validity is deliberately not a mutable field inside an immutable snapshot. Lack of a supported disposition authority yields refusal, not an assumed "not retracted".

### 4.3 Current analytical inputs and V1 compatibility

For the first slice choose one family whose Rust output **and claim-complete governed consumer/profile** are available. Descriptive-statistics receipts alone do not qualify density, distribution, clusters or graph topology. The family adapter copies authoritative descriptors; if request/output provenance lacks required semantics, refuse and route that missing output to L0's governed handoff. Do not infer units, aliases, ordering or causal meaning to make normalization succeed.

Keep complete `SemanticEmbodimentEnvelopeV1`/Cluster/Graph envelopes for existing production/detail/replay. The L0 adapter explicitly excludes their decision fields from the new analytical projection and records the original envelope separately for legacy provenance. Existing semantic IDs may be reused only if the family contract proves their decision independence; otherwise use a source-qualified stable local key from authoritative identifiers. Never hash mesh indices into semantic IDs.

`SemanticEmbodimentGraphV1` remains compatibility-only for the new path. It may be generated per decision from a snapshot by an explicit adapter, preserving old decision coupling. It is never the snapshot's authority input and cannot reverse-mint a governed snapshot from its strings alone.

## 5. Committed context and fixed obligations

### 5.1 Investigation context C

Create an immutable `CommittedInvestigationContextV1` value owned by Investigation, containing `investigationId`, existing stable `nodeId`, `contextRevision`, analytical dataset fingerprint, intent (exact canonical `InvestigationIntentV1` or explicit legacy absence), perspective, and the declared task/domain/accessibility scope consumed by policy. `contextId = H('investigation-context-v1', body)`. Context IDs commit content; they do **not** replace graph node IDs. DAG edges remain authoritative lineage and are committed by the new persistence format.

Perspective is a subordinate value, not a standalone manager. The first closed perspective contract contains foreground semantic IDs/kinds, ordered foreground variables, viewpoint purpose, held-constant references and optional **references to existing supported** comparison/temporal frames. It has no free-form filter, causal assertion or executable temporal-window expression. Applying a filter/window that changes support routes through NIL → Atlas → Rust and yields new analytical identity. Unresolvable perspective references fail before commit. Intent uses ADR 0009 NFC/trim/order/absence rules; malformed new context is invalid input, not a legacy empty context and not Moneta ABSTAIN.

The domain ResearchContext becomes an accessor/projection of committed Investigation meaning; mutable session research metadata is not a second commit authority. `studyId`/`observerMode` are not scientific input or authorization. The approved scope consumed by admission is explicit in C; a study runtime capability is separate. Draft edits affect previews only. Explicit commit creates a new context revision/node; revisit restores the exact value; editing an old node branches via DAG edges. Legacy absence is preserved without adding synthetic fields to V2/V3 digests.

### 5.2 Obligation function and timing

Moneta evaluates `O = deriveObligations(S, C, P)` where S is the verified snapshot, C the committed context, and P the exact authority-owned obligation-policy version/digest. P declares required evidence profiles and claim policies; candidates cannot supply replacements. O is fixed before candidate generation, ranking or device feasibility. It contains `(snapshotId, contextId, policyRef, obligations[])` and `obligationSetId = H('semantic-obligations-v1', body)`.

Each obligation is `{ id, semanticSourceRef, propertyOrRelation, class, requirementPredicateRef, evidenceUseRefs, limitationsToExpose, activation }`. Its id is H('semantic-obligation-v1', that record without id); O orders obligations by id and rejects duplicates. The class means:

| Class | Fixed obligation semantics |
| --- | --- |
| `MUST_PRESERVE` | Every executable variant must cover it plus the limitations/uncertainty/missingness that qualify it. No device exception. |
| `PROGRESSIVE` | Overview may defer the stated detail, but must expose its existence/limitations and an explicit supported NIL activation path. On activation the declared predicate is mandatory; inability to materialize returns refusal and retains the last valid view. No silent omission or promising unavailable detail. |
| `OPTIONAL` | May omit with recorded omission; if included, ordinary binding/evidence/qualification rules still apply. Optional never means scientifically unchecked. |

Requirement predicates are closed, versioned symbolic constraints (required semantic relation, order/units/support, caveat exposure, detail availability), not arbitrary scripts or inferred numerical thresholds. Mechanical coverage is distinct from human recoverability. The latter requires scoped qualification for production. Unavailable semantics may produce a mandatory **disclosure of unavailability**, not an invented value.

O is a nested immutable member of a new Moneta decision record, alongside S/C/proposal references and the admitted result or refusal. It has a content identity for cross-checks but no separate mutable table/store. If no candidate fits O, refuse; changing the question explicitly makes a new C/decision, not a retroactive weakening. Candidate-added supported meaning invokes the same fixed policy to check its evidence/caveats; it cannot remove or demote O. If it requires an obligation outside the fixed policy's scope, start a new decision context and freeze the expanded set before comparing candidates.

Forma may select qualified transforms/channels, instantiate typed parameters, allocate non-analytical geometry and generate admitted variants. Rust still owns data-derived reductions/layouts. The resource governor selects only among applicable admitted variants; it cannot edit bindings/O or let a cheap surrogate stand in for mandatory meaning. Mandatory channel unavailable with no qualified fallback is refusal.

## 6. Exact Forma input and output tuples

### 6.1 Input

```text
FormaInput = (
  S: verified SemanticSnapshotV1,
  C: committed Investigation context,
  O: Moneta-owned fixed obligation set,
  G: RepresentationGraphV2 + proposed typed bindings + proposal provenance,
  K: pinned FormaKnowledgeManifestV1 + resolved immutable entry artifacts,
  P: exact compiler/obligation/evidence/qualification policy references,
  U: requested purpose and authority-minted authorization,
  B: device/backend/accessibility capability envelope + budget contract,
  E: injected evidence/disposition and qualification resolution capabilities
)
```

S/C/O/G/K/P/B/U's declarative fields are durable inputs. E and U's runtime authorization are nonserializable capabilities, supplied by the relevant owners, not JSON booleans. Current evidence/qualification disposition revisions are captured in the admission record and rechecked before adoption. No ambient current model, knowledge lookup, UI state or hidden default is an input. Compiler binary/build digest and declared transform implementations are pinned.

G carries an exact snapshot/context/O reference. The accepted graph V2 retains compositional primitives/edges and NIL/detail references; removes authoritative loose `visualEncoding`/free-form policy strings in favor of closed versioned references and typed binding proposals. Every data-bearing property references semantic source, evidence use, channel, transform/version/digest, domain/range/units, order/topology constraints and limitations. `generatedBy` is provenance only. Model/manual origin is never a waiver. Unknown transforms or composition relations refuse; shared evidence alone never proves comparability.

### 6.2 Output

```text
FormaResult =
  { status: 'ADMITTED', resultId, record, plan }
  | { status: 'REFUSED', refusal, inputCommitments }

record = {
  inputCommitments, evidenceDispositions, perceptualQualifications,
  permittedUse: 'PRODUCTION' | 'STUDY_ONLY', authorizationReference,
  fixedObligationSetId, coverageByObligationAndVariant, omissions,
  resolvedBindingIds, knowledgeManifestId, compilerAndTransformRefs,
  planId, backendPlanDigests, explanationIndex, limitations
}
```

`plan` is the immutable `PerceptualEmbodimentPlanV1` value, nested in the admitted result: typed bindings, bounded variants, spatial backend(s), NIL/detail references and capability/accessibility applicability. `planId = H('perceptual-plan-v1', plan body without self-ID)`; `resultId = H('forma-result-v1', record without self-ID)`. Input commitments include exact selected G plus any model/runtime/feature/proposal artifacts that actually influenced it. Record unresolved optional artifacts as unavailable provenance only when they are not required to explain or execute the result; never make up their identity.

Output identity commits coverage, permitted use, scoped qualification, all transforms and backend parameters. The explanation index is a deterministic reverse map from each data-bearing backend property → binding → primitive → semantic source → claim/receipt/profile. It must be validated for total coverage; no generated explanatory prose can repair a missing reference. Decorative properties are explicitly non-data-bearing and cannot encode stronger meaning by convention silently.

Runtime receives an **ephemeral execution authorization** minted only after evidence/purpose/context checks, bound to resultId, variant, runtime instance/generation, dataset registration and context activation epoch. The serialized ADMITTED tag is never such a capability. Same-content revisit increments the activation epoch, preventing an A→B→A race. Before atomic adoption, recheck these bindings, evidence/qualification disposition revisions, device applicability and study liveness; stale results release staged resources without replacing the valid current view. Existing owners perform these checks around their real mutation points; no new adoption manager. A relevant evidence/qualification disposition-change notification also revokes an already active execution authorization. The owner must cease the affected embodiment and expose a non-executable/refused state; a stale or unavailable required refresh cannot retain authority. Refresh/freshness requirements come from the pinned owning policy, never a candidate-selected timeout. Historical records remain intact.

## 7. Admission versus permitted use

Scientific admissibility remains the existing claim-specific disposition, not a new scalar. The result records separate fields:

- `analyticalDisposition`: existing protocol result per analytical claim; resolution is necessary, not sufficient;
- `perceptualQualification`: `QUALIFIED`, `UNVALIDATED`, or `CONTRAINDICATED` for exact mapping/claim/scope/version;
- `permittedUse`: `PRODUCTION`, `STUDY_ONLY`, or `REFUSED` (REFUSED is represented by the refusal branch).

| Analytical and perceptual state | Requested use | Result |
| --- | --- | --- |
| Required analytical claims ELIGIBLE, all required mapping claims qualified in scope, current policies satisfied | Production | PRODUCTION |
| Required analytical claims ELIGIBLE; human meaning claim REQUIRES-HUMAN or explicit perceptual control; intact mechanical constraints | Authorized frozen study | STUDY_ONLY, bound to exact protocol/treatment/session and mappings |
| Same unqualified mapping | Production | REFUSED / USE_NOT_PERMITTED |
| Any required analytical claim INVALID, ABSTAIN, MACHINE-FALSIFICATION-ONLY, missing or unresolved | Either | REFUSED; bounded diagnostics remain data, not an executable embodiment |
| Qualified plan, but device cannot preserve mandatory meaning or context is stale | Either | REFUSED |

`REQUIRES-HUMAN` is scoped to the perceptual claim here; it cannot cover up invalid analytical evidence. Deliberately misleading **perceptual** mappings may be executed as predeclared study controls when their transforms truthfully describe the manipulated mapping, analytical input remains valid, and mechanical obligations remain intact. The study manifest must name exact control mappings, contraindications, claims withheld from production, exposure boundaries and authorized scope. A control that fabricates an analytical relation, removes a mandatory caveat, or cannot meet a hard semantic predicate is refused in this pipeline; a more permissive research renderer would require a separate explicit RFC, not a study flag bypass.

Study authorization is minted by the existing study owner only after protocol acceptance/freeze and applicable human authorization. Neither a candidate-authored manifest nor `researchContext.studyId` suffices. Production selection, runtime adoption, replay and learning ingestion must all enforce purpose. A study-only result has no automatic cast to a production result. Successful execution records an observation, not qualification. Promotion requires attributable evidence, separate claim-owner adjudication and an explicit new scoped qualification revision, followed by fresh ordinary admission producing a new resultId. Original study results remain STUDY_ONLY forever. First L2 contract work defaults to refusal until the real study authority is wired.

## 8. Minimal KB0 manifest

`FormaKnowledgeManifestV1` is a bounded immutable value with `{schemaVersion, manifestId, entries, capabilityTableRef, qualificationPolicyRef}`. Each entry contains exact `{kind, id, version, contentDigest, authorityRef, scope, evidenceBasis, evidenceRefs, limitations, contraindicationRefs, qualificationRef, supersedesRef?}`. Kinds for KB0 are only `TRANSFORM`, `CHANNEL`, `RECIPE`, `QUALIFICATION`, `CONTRAINDICATION`. Qualification references point to governed decisions for **mapping + claim + task/domain/population/accessibility/device scope + permitted use**; they are not template-wide popularity badges.

Knowledge artifacts are resolved from a closed local table by exact identity/digest. Missing artifact/version refuses; no network retrieval or dynamic plugin execution at admission/replay. The manifest is captured once per decision and references original judgment/study custody; it does not copy those records into another mutable knowledge base. Content hashes establish identity, not authenticity or human qualification. The resolver accepts trusted policy/custody references, not an archive's self-issued promotion.

Seed only deterministic static spatial recipes over the first L0-qualified family. Record `DOMAIN_CONVENTION` or `PRIOR_ART` honestly; neither implies automatic human validation. A seed without the qualification its production claim requires is study-only or refused. KB0 defines no universal confidence, learning loop, vector store, model, discovery service, arbitrary transform language or general multimodal engine.

System-1 may propose/rank recipe IDs, primitive compositions, binding choices, bounded parameters and search order. System-2 may propose explicit new compositions/transforms only inside the admitted grammar; unknown transforms stay unsupported until separately qualified. Forma still verifies exact sources/profiles, measurement legality, relation authority, fixed O, qualification/use scope, capabilities, bounds, fallbacks and reverse explanation. Proposal provenance pins the actual selected artifact/result; models cannot propose evidence policy, new truth, obligation weakening, or promotion.

## 9. Replay and persistence

### 9.1 Minimum immutable closure

An exact admitted embodiment requires: source analytical dataset identity and reproducible dataset/derivation artifacts; semantic snapshot and its analytical leaves; exact receipts/consumer uses/profile/policy identities; committed C and relevant DAG lineage; fixed O; selected G and consumed proposal artifacts/provenance; K and its exact resolved binding/qualification artifacts; compiler/transform/backend/NIL implementation identities; complete admitted result and selected backend plan/variant; execution purpose and study freeze reference where used. Seeds and feature/model/runtime hashes are required where those mechanisms actually contributed. Recording model identity does not require rerunning the model to display its recorded proposal.

Use existing session/package custody. The accepted V4 contract adds reserved `investigation/forma.json` (closed version-1 envelope), committed by an exact-byte member digest **and** the new semantic digest. Its envelope owns tables of the immutable values above, reference links to the existing receipt entry and recorded active result/variant. Package-local analytical/knowledge artifacts have bounded entries and content digests; path/name alone is not identity. Each referenced artifact must resolve once; duplicates, conflicting IDs, dangling refs and unknown required members refuse. Shared receipt bytes are referenced, not copied per plan.

V4 commits the existing V3 semantic projection unchanged as a nested historical component, plus the exact Forma envelope/member digest, committed context/DAG projection and all referenced artifact digests. The closed V4 manifest declares its format/digest, all required members and identities. No V4 data is placed inside RFC 0009's closed receipt V1 envelope. V1–V3 readers/digests stay unchanged and cannot issue Forma authorization. Older readers must reject V4; invalid V4 is never retried as V3. Adding new governed consumers activates only with the versioned consumer-policy contract for the new path, not by making every old V3 archive require new uses.

The first V4 slice retains RFC 0009's **one final analytical dataset/kernel context** limitation. It may retain historical DAG nodes as inspectable lineage, but it cannot promise executable replay of their uncaptured analytical states. Cross-dataset comparisons or arbitrary intermediate-state restoration require a later separately reviewed versioned extension. Multiple perspectives over the same captured analytical state are supported.

### 9.2 Replay outcomes

| Outcome | Required behavior |
| --- | --- |
| `EXACT_HISTORICAL` | Verify the complete recorded closure and reproduce the recorded decision/plan bytes and meaning. Do not rerun retrieval, ranking, synthesis or current knowledge. Executing it additionally requires available compatible **pinned** backend semantics and fresh permitted-use authorization. This is semantic/plan exactness, not a claim of identical pixels, physical device behavior or human interpretation. |
| `COMPATIBLE_ADAPTATION` | Explicit user action creates a derived decision/result and lineage with adapter/compiler identity and differences. Re-admit under current evidence/use policy. It may select a different qualified channel/variant/backend or migrate representation grammar while preserving required meaning; it never overwrites or calls itself the old exact result. |
| `UNSUPPORTED_HISTORICAL` | Missing/unsupported required compiler, profile, artifact, backend semantics or unsafe version. Preserve inspectable historical records; return REPLAY_UNSUPPORTED without execution. No hidden nearest-version fallback. |

Fresh current eligibility is an additional check, not a rewrite of historical admission. Retraction can leave a complete historical record inspectable while execution refuses with EVIDENCE_UNAVAILABLE / RETRACTED. Re-admission after a changed policy/qualification produces a new resultId. An exact plan can be inspectable without being executable; present both facts. If older implementation bytes are not safe to load, refuse execution rather than downloading arbitrary archived code.

Reallocating runtime handles, GPU objects or non-data-bearing viewport/camera state within recorded backend applicability does not change the semantic plan. Changing selected variant, data-bearing channel, units, mapping, analytical request, source, context or knowledge is an explicit adaptation/new decision. Restoring the recorded variant is exact; switching to another already admitted variant is a recorded adaptation event even when snapshot/O remain equal. Never silently adapt a frozen study treatment.

**Old investigations:** V1–V3 can replay only the contracts they actually captured. They lack the complete Forma closure and cannot be upgraded to EXACT_HISTORICAL Forma by rerunning current Moneta. An explicit new branch may normalize newly verified evidence and admit a new result with `derivedFrom` linkage; it is adaptation, not backfilled history.

## 10. Small refusal taxonomy

`RefusalV1 = { code, stage, reason, subjectRefs, owningPolicyRef?, cause?, retryCondition? }`. Closed `code` determines behavior; bounded typed `reason` preserves the owning failure without an ever-growing top-level enum. `cause` retains the original receipt/profile/semantic refusal. Refusal carries no executable plan or authority capability.

| Code | Covered reasons / exact owner |
| --- | --- |
| `INVALID_INPUT` | Malformed, unknown-field/version-shape, forged capability, ambiguous refs, integrity failure, bounds; decoder/package boundary. Unsupported *well-formed* historical contracts use REPLAY_UNSUPPORTED. |
| `SEMANTICS_UNSUPPORTED` | Unsupported family/relation; normalization needs invented meaning; L0/Moneta capability table. |
| `EVIDENCE_UNAVAILABLE` | MISSING_REQUIRED, RETRACTED, WRONG_DATASET, WRONG_KERNEL, WRONG_RECEIPT, WRONG_PROFILE_VERSION, REQUIRED_AXIS_MISSING, DISPOSITION_UNKNOWN; governed evidence owner. |
| `CLAIM_NOT_ADMISSIBLE` | Existing INVALID/ABSTAIN/MACHINE-FALSIFICATION-ONLY or unmet analytical claim policy; claim owner. |
| `CONTEXT_INCOMPATIBLE` | Stale context/activation epoch, wrong node/snapshot or incompatible scope; Investigation/adoption owner. |
| `POLICY_VIOLATION` | Candidate attempts to weaken O/evidence requirements, unauthorized policy or changed mandatory binding; Moneta/Forma. |
| `BINDING_UNAVAILABLE` | No legal/qualified perceptual binding, mandatory meaning has no qualified fallback, unknown transform; Forma/qualification owner. |
| `RESOURCE_UNSATISFIABLE` | Legal mandatory binding exists but current budget/device/accessibility cannot execute any qualified variant; Forma/resource owner. |
| `USE_NOT_PERMITTED` | STUDY_ONLY requested for production, absent/expired/wrong study authorization, withdrawn qualification; purpose/qualification owner. |
| `REPLAY_UNSUPPORTED` | Historical contract/profile/compiler/required artifact cannot be safely restored; replay owner. |

Validation order is decode/integrity → context/identity → evidence/scientific policy → fixed-policy integrity → binding/qualification/use → budget → adoption recheck. Keep all bounded diagnostics; choose the first failing stage as the primary refusal. Do not collapse upstream refusal to "no geometry". Production requiring a known study-only mapping uses USE_NOT_PERMITTED; no legal mapping at all uses BINDING_UNAVAILABLE. A missing historical implementation is REPLAY_UNSUPPORTED; an available implementation finding retracted evidence is EVIDENCE_UNAVAILABLE.

Existing Moneta `ABSTAIN` remains a scientific/representation decision with inspectable near-misses; `INFEASIBLE` remains no feasible candidate. They can be causes of refusal but are not overwritten. NIL remains the interaction language; the legacy phrase "NIL outcome" means no active selection, not a replacement for these typed states.

## 11. Version and object disposition

| Contract | Disposition | Exact boundary |
| --- | --- | --- |
| DatasetEvidence V1; Rust family envelopes/receipts V1 | KEEP | Preserve existing wire shape and analytical authority. Family-specific new semantics need their own version decision; L0 only projects supported outputs. |
| SemanticEmbodimentGraphV1 | COMPATIBILITY_ONLY for new Forma | Old identity, decision linkage and replay stay unchanged. No V1 reinterpretation. |
| SemanticSnapshotV1 | VERSION (new contract) | New decision-independent identity replaces the proposed upstream role, not old data. Avoid a redundant SemanticEmbodimentGraphV2 with the same authority. |
| RepresentationGraph schema 1.0.0 | VERSION → 2.0.0 | Mandatory snapshot/semantic bindings, typed policy refs and removal of authoritative loose encodings are incompatible. Explicit adapter only; no compatibility waiver. |
| RepresentationDecision | EXTEND via versioned decision-record envelope | Keep legacy value/verbatim digest; new record owns C/S/O/proposal/result. Do not overload optional V1 provenance as mandatory admission. |
| InvestigationIntentV1 | KEEP | ADR 0009 exact canonicalization and legacy absence. |
| Investigation context / perspective | EXTEND via new committed V1 value | Existing graph owns it, stable node IDs retained; V4 commits it. Two ResearchContext surfaces converge by adapters, not duplicate write owners. |
| SpatialEmbodimentPlanV1 | KEEP | First backend, nested/referenced by admitted plan. `semanticGraphId` still refers to an explicit legacy graph projection, not silently to snapshotId. New outer binding table resolves its IDs to snapshot/primitive/binding IDs and requires complete coverage. |
| Spatial plan with mandatory changed wire fields | VERSION if needed later | Current outer plan enforces completeness without changing V1 semantics. If backend cannot stay V1, STOP for explicit V2 adapter decision. |
| PerceptualEmbodimentPlanV1 / admitted result | VERSION (new immutable values) | Persist inside the decision/session envelope, one writer, no independent plan service. |
| SemanticObligationV1 | EXTEND as nested decision value | No separately editable obligation registry. |
| PerceptualBindingV1 / PerceptualChannelSpecV1 | EXTEND as nested plan / closed capability table | No separately mutable objects or dynamic channel registry. |
| SemanticResolutionProfileV1 | EXTEND as bounded variants inside admitted plan | No global richness manager; initial static slice may have one variant per result. |
| FormaKnowledgeBaseV1 | DO_NOT_BUILD as a store | Implement the pinned manifest/view only. |
| MetaphorTemplateV1 / MetaphorCaseV1 | EXTEND recipes / DEFER case indexes | Recipes are immutable manifest entries; cases reference existing decisions/judgments, no copied first-class store in KB0. |
| EmbodimentCritiqueV1 / HumanMeaningJudgmentV1 | EXTEND existing judgment envelopes later | Subordinate typed content targeting exact result/binding/context, captured under existing attribution/custody; no new database. |
| BehaviourRuleV1 / BehaviourPlanV1 | DO_NOT_BUILD in L2-0 | Later qualified plan values only when justified; no generic behavior engine now. |
| Package V1–V3 / digest V1–V3 / receipt envelope V1 | KEEP | Historical meaning unchanged. |
| Package V4 / digest V4 / Forma entry V1 / study freeze extension | VERSION | New required authority cannot be ignored by old readers; study treatment needs a new version before Forma execution. |
| World model, new service/model/ontology, genome grammar | DO_NOT_BUILD | Outside this decision and first static slice. |

The outer spatial binding table is an adapter, not an alternative source of truth: it must exactly agree with V1 element semantic IDs, representation primitive IDs, dataset/decision/graph IDs and the generated compatibility graph. Missing optional V1 fields are legal only for old replay; a new Forma-produced backend must populate all bindings required by its outer contract. The adapter may refuse rather than manufacture a V1 information kind that cannot faithfully express the source.

## 12. Architectural falsifiers and scenario adjudication

These are required future acceptance tests, **not executed production tests** for this documentation PR. Each needs a positive control through the same real entry point so universal refusal cannot pass.

| ID / attack | Exact owner and required result |
| --- | --- |
| F01 Perspective invariance | L0 + Investigation: temporal and uncertainty foregrounding over equal analytical coverage have equal snapshotId and distinct C/decision identities; differing representation decisions do not change truth identity. |
| F02 Evidence substitution/retraction | Governed evidence owner + adoption: same dataset/receipt ID with changed content fails digest/resolution; retraction invalidates execution of old result with EVIDENCE_UNAVAILABLE. Historical bytes remain inspectable. |
| F03 Candidate cheating | Moneta + Forma: candidate drops/demotes MUST_PRESERVE or weakens profile; POLICY_VIOLATION. Cheap rendering cannot rescue it. |
| F04 Study leakage | Study owner + Forma + production adoption/learning ingress: successful misleading/unvalidated control remains STUDY_ONLY. Production request, archive flag edit, or proposal selection refuses USE_NOT_PERMITTED (or integrity INVALID_INPUT). Explicit later qualification creates a new result. |
| F05 Stale asynchronous adoption | Investigation + runtime surface/session controller: compile for A, commit B, receive A; CONTEXT_INCOMPATIBLE before mutation. Also A→B→A must reject the old activation epoch. |
| F06 Device degradation | Forma + existing resource governor: Quest lacks mandatory channel and no qualified applicable fallback; RESOURCE_UNSATISFIABLE, old valid view retained or explicit no-executable-view state. No different scientific story. |
| F07 Exact replay | Session/package/replay: retained old compiler/knowledge/model-selected proposal reproduces recorded result without inference; unavailable historical dependencies yield REPLAY_UNSUPPORTED. Current knowledge must not change old plan bytes. |
| F08 Human critique | Judgment custody + Moneta: confirmed better mapping becomes an attributed proposal/alternative; evidence bytes unchanged; no production prior update. LLM parsing alone is not human confirmation. |
| F09 Same receipt, incompatible frames | Forma delegates relation admissibility: two nodes sharing a receipt but with incompatible units/support cannot acquire COMPARES_WITH/causal direction through string overlap; CLAIM_NOT_ADMISSIBLE. |
| F10 Forged serialized ADMITTED | Package loader + authority mint: self-consistent archive hashes do not establish issuer/authenticity or promotion; no capability unless relevant trusted admission/purpose policies are satisfied. |
| F11 Legacy downgrade | Version dispatch: remove Forma member or relabel V4 as V3; no Forma capability. Unmodified V3 fixture keeps identical digest and old replay behavior. |
| F12 Hash collision by canonicalization | Closed parser: NaN/Infinity/undefined/sparse arrays cannot become legitimate null/missing analytical values before hashing. Decision-only envelope metadata changes leave snapshot identity stable. |
| F13 Optional/progressive exploit | Forma + NIL/detail: optional added claim is still evidence-bound; progressive detail cannot advertise a route that is unsupported. Activation refuses without losing overview. |
| F14 Partial replay/exposure | Replay + adoption: fail the last reference/claim after others validate; no partial capability, no partially replaced view. Unknown retraction status cannot be cached as valid. |

Newly inferred failure class from source review: adding a global Forma consumer to the existing V3 registry invalidates historical V3 archives even though no wire field changed. F11 must include unchanged old consumers and version-scoped new consumer activation, not just ZIP parsing.

## 13. RFC/ADR acceptance and unresolved INVESTIGATE items

RFC 0010 is **accepted by the project owner on 3 October 2026**, as recorded in its acceptance statement. It covers new snapshot identity, graph V2 mandatory bindings, context/O/admission identity, restricted study purpose, and V4 persistence/replay. These public/trust contracts are authorized for implementation under §14 after this PR is integrated. An ADR follows implementation; acceptance alone is not an implemented-architecture claim. No replacement of Rust, evidence protocol or NIL is requested. A request to let a study bypass analytical invalidity or mandatory mechanical semantics requires a separate replacement RFC and explicit human/project-owner adjudication.

| INVESTIGATE | Owner / gate / safe behavior meanwhile |
| --- | --- |
| I01 Which first family has complete governed receipt/consumer/profile coverage? | L0 + TEC checkpoint; inspect real Rust bridge and exports. Refuse unqualified families; never declare all supported from enums. |
| I02 Exact mapping qualification scope and human recoverability evidence | L6 research owner; production qualifier must exist before production admission. Seed recipes stay unvalidated/study-restricted. |
| I03 Current withdrawal/retraction and qualification-disposition integration | Existing evidence/research owner with L0/L2; choose bounded authority adapter and authoritative revision source before executable Forma promotion. No general registry/service is authorized. Missing source means refusal. |
| I04 Historical backend implementation availability/security and physical replay applicability | Session/runtime + L4; only pinned supported implementations execute; missing/unsafe is unsupported. No pixel/device-equivalence claim. |
| I05 Intermediate analytical states or multiple datasets in one investigation | Future persistence RFC, outside initial one-context V4; inspect lineage but refuse uncaptured execution. |
| I06 Full graph/detail family projection into legacy spatial V1 | L0/L2 adapter test; if lossless binding cannot be expressed, refuse that family and request a bounded version decision before widening. |

These are finite capability/evidence questions with an assigned owner and refusal behavior, not alternative authority answers. If implementation discovers that any cannot be resolved under these owners, return **REVISE** and reopen the affected RFC boundary. A27-0's architecture acceptance gate is satisfied. The INVESTIGATE items remain scoped implementation/evidence prerequisites with their stated refusal behavior; acceptance does not close them.

## 14. Machine-addressable implementation handoff

The following is dispatch data, **not three concurrent leases**. Refresh ROADMAP, origin/main, claims and validated shadow findings before starting. Acquire an exclusive worktree lease. All lanes are high-risk. RFC acceptance is recorded. After PR #927 is integrated, L0 may resolve I01 and start its first contract slice once the affected TEC handoff is satisfied; L1 may start its disjoint perspective contract slice. L2 consumes their merged contracts. Shared capture/digest/adoption integration is serialized as L2-FORMA-1, not quietly assigned to all three.

```yaml
contract: A27-0-handoff-v1
reviewed_base: 8a5be7fdcb5b3c23ce11ea8cfd3db58f97b2e597
accepted_rfc: docs/rfcs/0010-moneta-semantic-snapshot-and-forma-admission.md
acceptance_date: 2026-10-03
acceptance_authority: project-owner-explicit-review
integration_pr: 927
dispatch_requires: [PR927_INTEGRATED, fresh_origin_main, exclusive_worktree_lease]
shared_exclusive_later:
  tranche: L2-FORMA-1
  owner: Claude-after-L0-handoff
  paths:
    - src/atlas/types.ts
    - src/atlas/domain/InvestigationAggregate.ts
    - src/session/NemosyneSession.ts
    - src/session/NemosynePackage.ts
    - src/session/InvestigationReplayRunner.ts
    - src/investigation/InvestigationDigest.ts
    - src/app/investigation/InvestigationContinuityController.ts
    - src/vr/coordinators/WorldSessionController.ts
    - src/vr/presentation/representation/RepresentationSurface.ts
    - src/study/StudyFreezeManifest.ts
  rule: No initial lane edits these files; explicit integration lease after all contracts merge.
lanes:
  Claude_L0:
    tranche: L0-SEM-NORM-A
    requires: [RFC0010_ACCEPTED, affected_TEC_consumer_profile_handoff]
    allowed_existing:
      - src/atlas/MonetaEvidenceAuthority.ts
      - src/atlas/ports/AnalyticalExecutionPort.ts
      - src/atlas/adapters/RustAnalyticalEvidenceAdapter.ts
      - src/data/evidence/ConsumerPolicyRegistry.ts
      - src/data/evidence/EvidenceRequirementProfile.ts
    allowed_new:
      - src/data/evidence/SemanticSnapshot.ts
      - src/data/evidence/SemanticSnapshotNormalizer.ts
      - tests/semantic-snapshot.test.ts
      - tests/semantic-snapshot-live.test.ts
    read_only:
      - src/moneta/representation/SemanticEmbodimentPayload.ts
      - src/moneta/representation/ClusterEmbodimentPayload.ts
      - src/moneta/representation/GraphEmbodimentPayload.ts
      - src/wasm/runtime/SemanticEmbodimentBridge.ts
      - wasm/src/moneta/
    invariants: [F01, F02, F09, F11, F12]
    tests:
      - Real injected analytical port produces the first qualified family snapshot.
      - Decision/perspective metadata does not alter snapshot identity; claim content does.
      - Missing/retracted/wrong-profile sources refuse; no TS data reduction or aliases.
      - Existing V3 consumer fixtures retain exact behavior under version-scoped activation.
    stop:
      - Required Rust output/receipt/attestation is absent; request a separate TEC-owned slice.
      - New analytical method or invented vocabulary would be needed.
      - Shared persistence or representation schema change is needed before its integration lease.
  OpenCode_L1:
    tranche: L1-PERSPECTIVE-0
    requires: [RFC0010_ACCEPTED, ADR0009]
    allowed_existing:
      - src/atlas/domain/InvestigationIntent.ts
      - src/atlas/domain/ResearchContext.ts
      - src/atlas/domain/InvestigationGraph.ts
      - tests/investigation-intent.test.ts
    allowed_new:
      - src/atlas/domain/CommittedInvestigationContext.ts
      - src/atlas/domain/InvestigationPerspective.ts
      - tests/investigation-perspective.test.ts
    invariants: [F01, F05, F11]
    tests:
      - Draft/commit/branch/revisit preserve stable node IDs and authoritative DAG edges.
      - Canonical intent and perspective hash fixtures preserve absence and variable order.
      - View-only perspective leaves snapshot unchanged; filters require analytical derivation.
      - Context revision and activation epoch distinguish A-to-B-to-A.
    stop:
      - A view field implicitly filters rows, computes statistics or invents a relation.
      - Context authority would remain writable in both session and domain.
      - Durable session/digest integration is required; hand off to the exclusive integration slice.
    claim_limit: Domain contract tests alone do not establish production commit/revisit or replay closure.
  Codex_L2:
    tranche: L2-FORMA-0-plus-KB0
    requires: [RFC0010_ACCEPTED, L0_contract_merged, L1_contract_merged]
    allowed_new:
      - src/moneta/representation/RepresentationGraphV2.ts
      - src/moneta/representation/FormaContracts.ts
      - src/moneta/representation/SemanticObligations.ts
      - src/moneta/representation/FormaKnowledgeManifest.ts
      - src/moneta/representation/FormaContractValidation.ts
      - tests/forma-contracts.test.ts
      - tests/forma-knowledge-manifest.test.ts
      - tests/forma-obligations.test.ts
    read_only:
      - src/moneta/representation/RepresentationGraph.ts
      - src/moneta/representation/RepresentationDecision.ts
      - src/moneta/representation/ComposedRepresentationValidation.ts
      - src/moneta/representation/SpatialEmbodimentPlanV1.ts
      - src/data/evidence/
      - src/atlas/domain/
    invariants: [F02, F03, F04, F06, F09, F10, F12, F13]
    validators:
      - Closed bounded decoding before hashing; exact refs and domain-separated identity.
      - Derive fixed O from S/C/pinned policy before proposals; reject candidate weakening.
      - Total property reverse mapping, units/order/relation legality, fallback acyclicity.
      - Purpose and qualification fail closed; parsed ADMITTED cannot mint execution authority.
      - Manifest exact artifacts and custody, no current-version substitution or copied evidence.
    do_not_build:
      - renderer, generic behavior engine, dynamic registry, new store or network service
      - learned model, synthesis/search, world model, adaptive feedback or production replay
      - automatic adapter waiver for V1 compatibility provenance
    stop:
      - Missing profile, qualification or study authority is being replaced with a fixture approval.
      - Mandatory meaning can fit only by weakening O or inventing analysis.
      - Required source/context contract changes; return to that lane instead of editing it.
    claim_limit: Contracts/fixtures establish no executable production Forma capability.
```

The serialized integration slice then implements V4 coherent capture → pack → clean-room replay → purpose/context-checked adoption and minimum explanation/non-adaptive feedback through the actual production paths in §2. It owns production F01–F14 evidence, new version fixtures and applicable CI. It must update the production-readiness registry when implementation creates new verification/deployment obligations. This proposal introduces no service or deployed capability and does not alter that registry.

## 15. Review limits

The source-backed independent boundary review found the closed receipt envelope, uncommitted DAG authority, global consumer activation hazard, standalone intent helper, absent retraction mechanism and same-runtime stale-context gap. The decision explicitly addresses those seams; they remain implementation prerequisites, not claims of fixes. Documentation/integrity checks and exact-head post-writing disposition are recorded in the PR. No human study, physical-device test or new production-path falsifier was run for this architecture-only change.
