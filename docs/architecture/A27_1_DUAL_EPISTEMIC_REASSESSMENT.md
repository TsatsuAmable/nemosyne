# A27-1 — Dual epistemic architecture reassessment

**Date:** 3 October 2026<br>
**Reviewed main:** `5926da8b9c071bc5eeff02b104d63c8602d6abb0`.<br>
**Disposition:** architecture reassessment delivered; [RFC 0011](../rfcs/0011-dual-epistemic-embodiment-and-preservation.md) is **accepted as amended by delegated adjudication**; its normative adjudication supersedes unresolved proposals below. No runtime capability is delivered.<br>
**Authority:** the [governing vision](../Nemosyne_Definitive_Vision_and_Roadmap.md) defines the destination; [ROADMAP](../ROADMAP.md) controls execution.

> **Adjudication:** RFC 0011 now resolves purpose/context V2, grounded versus conjectural bindings, validation and V4 static inspection. The text below preserves the original reassessment; references to proposed status or awaiting adjudication describe that earlier stage. ROADMAP records current clearance.

## 1. Finding and source reconciliation

PR #929 introduced two legitimate epistemic purposes, durable perceptual memory and an adaptive-depth model research hypothesis. PR #927 subsequently integrated A27-0, whose acceptance concerned an earlier technical head. Merge order did not reconcile the contracts. A27-0 is a sound claim-bearing foundation but is insufficient as the universal admission and persistence contract for the updated product.

The relevant changes are documentation, not implemented runtime behavior. This assessment compares the A27-0 reviewed base `8a5be7fdcb5b3c23ce11ea8cfd3db58f97b2e597` with the reviewed main above.

| Source | Architectural consequence |
| --- | --- |
| [Vision §3.1](../Nemosyne_Definitive_Vision_and_Roadmap.md) | Claim-bearing reproduction and exploratory abduction have different generation requirements; material semantic elements retain explicit epistemic status. |
| [Architecture: dual persistence and replay](../ARCHITECTURE.md) | Generator rerun, preserved experience and later reinterpretation are distinct capabilities. |
| [Semantic embodiment clarification §6](../SEMANTIC_EMBODIMENT_VISION_CLARIFICATION.md) | Missingness and negative space can motivate conjecture, without making inferred completion observed evidence. |
| [Full Moneta §1.1](FULL_MONETA_SEMANTIC_EMBODIMENT_ARCHITECTURE_PLAN.md) | Materialized exploratory output and bounded adaptive-model research are first-class requirements. |
| [System-1/System-2 §1.1](MONETA_SYSTEM1_SYSTEM2_ONNX_ARCHITECTURE.md) | Specialist models are a baseline, not a requirement for separate weights; shared recurrent/adaptive-depth inference is an alternative hypothesis. |
| [A27-0 §§6–9](A27_0_AUTHORITY_VERSION_DECISION.md) | Receipt-backed bindings, production/study qualification and historical closure need purpose-aware extension. A27-0 already captures selected proposals/plans without rerunning inference. |

The actual gaps are typed conjectural provenance, committed epistemic purpose, and supported materialized restoration without the original generator. It would be incorrect to describe A27-0 as requiring model reruns or to discard its existing retained-plan design.

### Pre-writing adversarial contract

**Invariant:** exploration can preserve and communicate conjecture without promoting it to evidence; model changes cannot change grounded analytical identity; historical restoration cannot mint current scientific authorization.

**Authority and production path:** Rust analytical outputs → Moneta grounded snapshot and typed proposals → deterministic Forma admission → context-bound adoption → existing session/package capture → clean-room restoration. Investigation owns context and history; Memory Palace presents retained artifacts.

**Failure modes:** a mode flag bypasses evidence or qualification; a hypothesis receives a fabricated receipt; derived-from-hypothesis values acquire observed authority; hidden adaptive state contaminates a frozen treatment; a missing generator destroys a preserved scene; archive loading executes arbitrary code; retraction disappears on revisit.

**Falsifying evidence:** the production-path campaigns in §7, including successful exploratory and claim-bearing controls. Documentation checks validate records only.

**Non-goals/dependencies:** no estimator, model selection, online-learning implementation, remote service, Quest performance claim or new persistence owner. Public/trust-contract amendment requires acceptance before affected contracts freeze.

## 2. Preserve the foundation; separate the dimensions

Keep Rust/WASM analytical authority, decision-independent `SemanticSnapshotV1`, immutable evidence references, Moneta-owned fixed obligations, deterministic Forma admission, context activation epochs, existing session custody and explicit version dispatch. Keep legacy package/digest behavior unchanged.

The proposed contract separates these dimensions rather than introducing one permissive exploration switch:

| Dimension | Meaning |
| --- | --- |
| Epistemic purpose | Claim-bearing verification or exploratory abduction, committed in Investigation context. Changing purpose creates new context/decision identity and revokes pending adoption. |
| Element epistemic status | OBSERVED, DERIVED, IMPUTED, HYPOTHESIZED or COUNTERFACTUAL on material properties and relations, with dependency provenance. These labels are assertions to validate, not credentials. |
| Availability and validity | Available, unavailable/refused evidence and current eligibility remain separate from epistemic status. Unknown is not zero or observed absence. |
| Permitted use | Production, restricted study or refusal under the applicable policy. Ordinary exploratory use need not be a frozen study. A study can itself investigate exploration. |
| Preservation and generation | Ability to reconstruct captured state, ability to reproduce generation, and permission for current use are independent results. |

A production-authorized exploratory artifact is authorized for explicitly conjectural use, not certified as scientifically true. Exploration does not waive perceptual qualification, accessibility or required uncertainty/status disclosure. A mapping that needs study authorization still needs it.

A value computed from hypothetical inputs cannot gain stronger evidentiary status merely by being called DERIVED. Record its dependencies and preserve the conjectural limitation. Methodologically governed imputation can have real analytical evidence while remaining IMPUTED; epistemic status is not a universal validity ranking.

## 3. Proposed admission amendment

Keep the grounded semantic snapshot unchanged. Store bounded immutable conjectural content in the Moneta proposal/decision under existing session ownership, with a separate identity. Changing the model or conjecture changes proposal/scene identity, not the underlying analytical snapshot identity.

Forma bindings need a closed source distinction:

- **Grounded analytical binding:** existing source, method, receipt/profile and policy checks remain mandatory for the assertion being made.
- **Conjectural binding:** captured candidate content, explicit epistemic status, generator provenance available at creation, assumptions, actual supporting/contradicting references, and uncertainty or its explicit unavailability. Empty support is disclosed, never replaced with a fake analytical receipt.

All candidates remain subject to fixed policy obligations derived before candidate comparison. A closed policy may instantiate candidate-specific disclosure checks, but candidates cannot choose weaker obligations. Structural/geometric plausibility checks do not establish scientific truth. Malformed evidence, unsupported grounded claims and prohibited mappings still refuse.

For example, two observed edges may support proposing a square. The proposed edges remain hypothetical. Their visibility and reverse explanation must preserve that distinction through selection, export and revisit. Missing records may support a missingness descriptor; null alone cannot establish that observations were destroyed, never collected or causally absent.

Validation or promotion creates a new evidence-backed decision with lineage. It never retags the old artifact in place. A switch to claim-bearing purpose must re-admit relevant assertions under claim-bearing requirements; it cannot inherit exploratory permission.

## 4. Preserved experience under existing owners

Investigation/session custody owns durable artifacts. Memory Palace remains a view over that history, but its captured input must be richer than today's DAG projection. Do not revive a parallel renderer-owned truth graph.

Specify three operations independently:

1. **Generator reproduction:** reproduce a generation under the requisite pinned inputs, model/state, policies and protocol. Claim-bearing/study requirements determine the necessary evidence.
2. **Materialized restoration:** safely reconstruct the captured experience from supported declarative artifacts without calling the original generator. Its historical identity is preserved even if that generator is unavailable.
3. **Derived reinterpretation:** intentionally generate or adapt a new perspective under a new identity linked to the old one; never overwrite it.

The capture contract must include bounded selected plan/proposal content; property/relation epistemic types; context/purpose; uncertainty and provenance availability; salient viewpoint/spatial organization; annotations and retained alternatives; explanation references; and required assets with integrity commitments. Define a captured static state first, not an unbounded promise of temporal, pixel-identical or multisensory replay.

Missing generator weights or synthesis implementation must not prevent restoration when the supported stored plan and required assets suffice. Missing critical scene assets or an unsupported/unsafe plan interpreter must yield explicit refusal or explicitly declared degraded inspection, never silent regeneration with today's model. Captured content is validated data, not arbitrary archived executable code.

Retraction can permit visibly historical inspection/restoration while denying active scientific use. Preserve original provenance and add current eligibility/retraction information; do not rewrite the artifact or revive a revoked capability. A preserved scene is not authority to run a fresh analysis or publish a current claim.

**Deferred contract detail for adjudication:** define a restricted historical-inspection capability and its adoption checks separately from current claim-use authorization. Restoration must not bypass A27-0 active-view revocation by renaming execution. The concrete capability design is required before implementing historical restoration.

A27-0's V4 is a prospective format, not shipped by these changes. Resolve this amendment before its schema freezes; no gratuitous V5 is requested. Preserve one final authoritative dataset/kernel context in the first slice. Capturing a historical static perceptual artifact does not create executable historical numerical states or a second analytical dataset authority.

## 5. MiniAGI and the Moneta decision model

The repository names “MiniAGI-inspired” but identifies no external paper, repository, model artifact or evaluated backend. This assessment concerns the merged shared recurrent/adaptive-depth hypothesis; it does not endorse a specific MiniAGI implementation.

A shared learned substrate could emit fast shallow proposals and spend additional recurrence/expert activation on harder exploratory proposals. This changes model topology and compute allocation. It does not merge learned reasoning with deterministic policy authority. Learned “System-2-like” deliberation remains distinct from Moneta's governed final decision and Forma's admission.

The provider-neutral [System1InferencePort](../../src/moneta/system1/System1InferencePort.ts) is a plausible integration seam. Its [closed V1 contracts](../../src/moneta/system1/System1Contracts.ts) are not already an adaptive-state capture protocol: required new state/depth semantics need explicit versioning rather than silently adding mandatory fields.

A bounded experiment should retain the deterministic/specialist baselines and compare equal-task, explicit-budget shallow/deeper inference. Measure completion/proposal quality against known-truth masked examples and genuine ambiguity; unsupported assertion and status leakage; abstention/calibration where defined; value of extra depth; latency, peak memory/energy and capture/governance complexity. Plausible output is not a calibrated probability. Desktop or off-device exploration supplies no Quest deployment evidence.

Capture output and known generator identity/state revision, depth/exit policy, relevant retrieval/memory state, available seeds and nondeterminism disclosures. Do not invent exact reproducibility when state is unavailable. Shared weights, recurrent memory, retrieval caches and random state must not leak exploratory adaptation into frozen empirical execution: use isolated immutable execution state or protocol-controlled transitions with evidence.

The new research allowance does not authorize automatic product learning from investigator judgments or bypass FM6 custody, consent, curation and promotion requirements. An exploratory adaptive-model experiment and production learning from human feedback are distinct proposals. Adaptation is optional for the first materialized exploratory slice.

## 6. Implementation readiness and scope

| Surface | Reassessment |
| --- | --- |
| L0 evidence inspection/normalization | Continue within existing TEC and lane gates. No hypotheses inserted into Rust truth or receipt-backed snapshots. |
| L1 context/perspective | Preflight and independent intent/perspective work remain useful. Closed context identity must incorporate the adjudicated purpose contract before freezing. |
| L2 admission/graph/public persistence format | Hold the affected contract freeze for RFC 0011 adjudication. Preserve the static claim-bearing baseline; add a bounded typed exploratory save/revisit slice after acceptance. |
| Model research | Design comparative protocols independently. No selected model, production learning or hardware qualification is claimed. |

The old #930 preflight is historical evidence from before #927 merged, not a live assertion that #927 remains open. A27-0 acceptance remains valid for its reviewed scope. The new amendment is not implicitly accepted by the request to reevaluate.

Current [MemoryPalaceWorldView](../../src/vr/presentation/epistemic/MemoryPalaceWorldView.ts) projects questions/hypotheses/findings from investigation data; these object kinds are not the five property-level epistemic statuses or a full experienced-artifact archive. [StudyFreezeManifest](../../src/study/StudyFreezeManifest.ts) already distinguishes disabled/frozen/protocol-controlled adaptation; experiments must honor the actual frozen protocol rather than infer that every study permits mutable models. No new source implementation accompanies this assessment.

## 7. Falsifiers required of implementation

These are planned checks, not reported passes:

1. Same grounded evidence with two model revisions keeps snapshot identity equal and retained scene/proposal identity distinct.
2. A partial-shape completion retains observed and hypothesized edges across real admission → export/package → clean-room restore; missing mandatory status cues refuses. Include an ordinary exploratory production-use positive control without study authorization.
3. A derived value depending on conjecture cannot export or promote as observed/authoritatively grounded by retagging, mode switching or archive tampering.
4. Remove the generator after capture: supported materialized restoration still succeeds with the original state and makes no inference call; missing critical assets produces the declared failure/degradation.
5. Claim-bearing execution cannot borrow exploratory generation relaxations; each refusal has a valid claim-bearing positive control.
6. Purpose/context A→B→A rejects stale asynchronous work. Archived admission records cannot mint current capabilities.
7. Exploratory adaptation cannot change a frozen treatment's weights, recurrent state, retrieval state or outputs outside its protocol.
8. Retracted support remains visible in historical restoration and cannot authorize a current scientific assertion; unsupported null-to-cause inference fails.
9. Oversized, malformed or executable scene payloads fail before adoption; retained artifacts remain bounded under repeated capture.

Production-path tests, independent challenge, applicable governed human/device evidence and required CI remain prerequisites for future capability claims.
