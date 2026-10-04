# Full Moneta completeness and defect audit — 4 October 2026

**Reviewed source:** `f00b3f90f62ab6c2a06f28f9b21926d8445dd170` (remote main, through PR #953).<br>
**Scope:** FM0–FM8 completeness against the governing vision, A27-0/RFC 0010 and amended RFC 0011; actual application/Atlas/Moneta/Forma/persistence paths and recent learning/search modules.<br>
**Verdict:** **IMPLEMENTATION PARTIAL; Full Moneta is not production-complete.** Several useful domain modules and public Atlas methods exist, but the current VERIFIED COMPLETE claims exceed their evidence. This audit delivers review/repair handoffs, not fixes or runtime qualification. [ROADMAP](../ROADMAP.md) controls execution and subsequent status.

## Evidence and interpretation

This is a bounded source/call-graph audit with targeted executable probes, not an exhaustive repository/security/performance audit. Independent reviewers examined FM1/FM2 integration and FM6–FM8 authority respectively. The primary review examined snapshot/admission/compiler/broker/package boundaries. Findings below distinguish application wiring gaps, defects in callable public paths, and isolated helper defects. A missing UI caller limits exposure; it does not make a falsely authorized helper safe to wire into production.

`BLOCKER` means a blocker to the affected capability's promotion or further unsafe integration, not a claim that the entire existing application is unusable. All listed defects have high-confidence static evidence; entries marked **reproduced** also have deterministic executable evidence. No Quest measurements, human comprehension studies, full CI, browser journey or real Rust/Worker campaign was executed for this review. Existing kernel/legacy capabilities are not invalidated wholesale.

Review contract: do not mistake class names, test counts, caller-provided evidence strings or deterministic hashes for scientific authorization. Trace app → Atlas → analytical owner → admission → adopted view → export/restore; falsify weaker boundaries with candidate substitution, stale context, altered values and unavailable evidence. Preserve existing analytical authority and legacy formats. Changes in this PR are documentation only.

## Completeness assessment

| Capability | Evidence-based assessment | Missing exit |
| --- | --- | --- |
| FM0 trustworthy evidence | Existing governed evidence spine is real but explicitly still active. New Forma/FM8 bypasses it. | Actual family-complete evidence resolution at admission; no fabricated receipts. |
| FM1 context/perspective | Domain V2 and Atlas APIs landed; accepted V2 fields, immutable history and render-time activation checks are incomplete. | Real investigator action → context-aware decision → stale-safe adoption → durable revisit. |
| FM2 alternatives | Inspect/branch helper APIs landed. Branch atomicity and revisit coherence fail; app interaction wiring absent. | UI preview/compare/branch with atomic, immutable DAG/decision/context transitions. |
| FM3 composition/static Forma | Normalizer, compiler and metadata runtime exist. Admission and semantic mapping are insufficient; no package V4 or Forma renderer consumption is established. | Authoritative static vertical slice including render, explanation, export and clean-room restore. |
| FM4 resolution adaptation | Broker exists; content identities, budget enforcement and context checks are insufficient. | Qualified variants that preserve fixed obligations and actual resource limits. |
| FM5 System-1 assistance | Deterministic proposer exists; FM8 invokes it after selection and does not use its proposals to choose the graph. | Governed proposal influence, baseline comparison, pinned model/state and applicable device evidence. No model deployment claimed here. |
| FM6 human refinement | Feedback/knowledge/corpus/evaluator helpers exist. Qualification can be self-minted; corpus and promotion evidence are unsound. | Attributable custody, full-content identity, measured held-out validation and durable qualified use. |
| FM7 search/synthesis | Grammar/objective/search code exists; candidate graph semantics are not carried into FM8 embodiment. | Governed candidate bindings/relations compiled and falsified through the actual product path. |
| FM8 integrated adaptation | Public API orchestration exists but fabricates analytics and copies one slice across graph primitives. | Integrated evidence-backed composition, actual adaptive input influence, frozen-state capture and product/human/device qualification. |
| Exploratory purpose / Memory Palace | Purpose enum exists. Typed conjectural bindings and static historical-inspection capability are not implemented on the new path. | Property-level statuses/provenance, preserved perceptual artifact and separate fresh-use authorization. |

No meaningful completion percentage follows from these findings. The missing work crosses trust and product boundaries, not merely UI polish.

## Prioritized findings and repair contracts

### FMA-01 — fabricated analytics and evidence enter FM8 admission

**BLOCKER / High / static public-path defect.** `src/moneta/adaptation/FullMonetaEngine.ts:122–183` invents receipt/profile/digest strings, groups C1/C2 and counts `floor(rowCount/2)`/`ceil(rowCount/2)`, then declares EXACT/READY and normalizes them. This is reachable through `AtlasCore.adaptRepresentation` → `InvestigationAggregate.ts:852–862`, without the injected analytical owner. A dataset without a cluster field still receives a supposed aggregate analysis. This is not explicitly typed exploratory conjecture.

**Owner/fix:** L0 + FM8 integration owner: remove synthetic authoritative data from runtime code; acquire the selected family output and exact governed receipts through the injected analytical port. Refuse absent analysis/evidence. **Falsifier:** actual Atlas adaptation on unclustered input cannot emit fabricated C1/C2 or mint receipt references; genuine Rust aggregation is the positive control. No app/VR caller of the new API was found, so live UI exposure is not asserted.

### FMA-02 — Forma admission accepts unverified content and caller-selected permission

**BLOCKER / High / reproduced helper boundary defect, reached by FM8.** `FormaAdmission.ts:41–82` checks only whether a source has status REFUSED. It does not validate snapshot digest, resolve evidence/profile/current disposition, derive fixed obligations, validate epistemic bindings, consult qualification or require study capability. Passing requested use REFUSED becomes an ADMITTED PRODUCTION result at line 69. `FormaSpatialCompiler.ts:91–102` adds only a nonempty-reference check; arbitrary reference strings are sufficient. Changing a snapshot value while retaining its old digest still compiles.

**Owner/fix:** L2 admission with L0 evidence owners: closed bounded decoding, verified immutable commitments, owner-issued profiles/disposition, fixed obligations and purpose/study validation at the single admission boundary. Reject REFUSED/unknown requests, not coerce them to production. **Falsifier:** wrong digest, wrong-dataset/profile receipt, retraction, hypothetical→observed relabel and unauthorized study requests refuse before plan creation; genuine authorized grounded and exploratory cases succeed. Existing five status labels/discriminated bindings required by RFC 0011 are absent from these compiler types.

### FMA-03 — spatial mapping invents temporal/uncertainty meaning and loses numeric meaning

**BLOCKER / High / static and reproduced semantic defect.** `FormaSpatialCompiler.ts:109–175` uses hash-sorted node position to label recency/history, appends “interval bounded” after enlarging a sphere, and labels “distribution cloud” without a distribution. A count-only fixture produces interval-labeled output (**reproduced**). Scatter height is `(value % 10) * .2`; surface height clamps to [.1,3], without a governed loss contract. Missing/non-numeric values become index and non-finite numbers become zero. These operations can visually equate different values or describe unsupported science.

**Owner/fix:** L2 compiler: bind each channel to authoritative descriptors and qualified mappings; refuse absent temporal/interval/distribution semantics. Represent loss, units and scales explicitly; unavailable values remain unavailable. **Falsifier:** equal values with different hash order cannot change recency; count-only input cannot become an interval; missingness never becomes an observation; 1 and 11 must not silently encode as the same exact value.

### FMA-04 — every semantic node collapses to the same spatial element ID

**BLOCKER / High / reproduced.** `FormaSpatialCompiler.ts:138` uses `node.nodeId.slice(0,16)`. The normalizer's node IDs all start `semantic-node-v1:`; slicing the first 16 characters retains only the common `semantic-node-v1` tag. Two distinct fixture nodes therefore yield two elements with one identical elementId per phenotype. Reverse explanations and any element-ID keyed consumer cannot distinguish them reliably.

**Owner/fix:** L2 compiler: derive element IDs from the full node identity plus binding/channel/variant identity; validate uniqueness. **Falsifier:** compile multiple normalized nodes and assert one-to-one IDs and reverse trace resolution; never “fix” by mesh index or an equally short shared prefix.

### FMA-05 — adapted plan bytes can change under unchanged identities; budgets/generations are incomplete

**BLOCKER / High / reproduced.** `FormaResolutionBroker.ts:185–264` changes shape/opacity while retaining the compiled sliceId, then hashes variantId from that stale ID, tier, profile name and requested generation. Two same-name budgets permitting VOXEL versus SPHERE yield different elements with identical sliceId and variantId. `maxMemoryBytes`/`maxChannels` are not enforced; a zero budget for both is admitted. The guard at lines 115–126 rejects only older numeric generations, so future generation 999 also admits. `FullMonetaEngine.ts:201–209` recreates the broker and uses generation 1 on each invocation.

**Owner/fix:** L4/L2: hash final adapted content and exact policy/budget commitments; verify actual channels/resources and fresh Investigation-owned activation capability with exact equality. Do not call static tier constants measured device qualification. **Falsifier:** changing material plan content changes identity; unsupported resources/channels refuse; future, stale and recreated-controller activations cannot authorize adoption.

### FMA-06 — context V2 and history violate the adjudicated identity contract

**BLOCKER / High / static public-path defect.** `CommittedInvestigationContext.ts:37–64` lacks investigation/dataset/scope binding, immutable committed revision and runtime/activation-generation fields required by RFC 0011. `reset():219–224` restarts epochs. `InvestigationAggregate.ts:294–304` commits perspective edits to the same node, while ledger line 237 overwrites its historical value. `activateContext():285–286` activates only the ledger, not graph/decision. After branch B and revisit A, a new branch reads B from `graph.activeNodeId` at line 378 and can attach to the wrong parent.

**Owner/fix:** L1: implement the accepted complete context contract and immutable graph-owned commit/revisit transition; align graph, decision and context atomically. **Falsifier:** edit A then revisit original A restores exact old meaning; branch B, revisit A, branch C attaches C to A; identical IDs across datasets/investigations and reset epochs cannot revive old authorization. Preserve explicit versioning rather than silently changing a shipped digest.

### FMA-07 — a rejected alternative branch leaves the graph mutated

**BLOCKER / High / static public-path defect.** `InvestigationAggregate.ts:415–423` inserts and activates a child and edge before `canonicalizeInvestigationIntent(intentOverride)` at lines 431–432. A malformed intent throws after durable in-memory graph mutation, leaving graph and context/decision inconsistent. Existing disqualified-candidate tests cover an earlier refusal, not this failure.

**Owner/fix:** L1/FM2: validate all inputs and stage context/decision/edge before an atomic transition. **Falsifier:** invoke an eligible branch with malformed intent, then assert graph, active node, context, representation and event ledger exactly match their pre-call states. Include successful branching as a control.

### FMA-08 — new product APIs and epoch helper do not establish actual UI/adoption integration

**BLOCKER to completion / High / static integration gap.** `LoadDatasetUseCase.ts:99,139` supplies explicit arbitration requirements; `AtlasCore.ts:1588` applies context-derived requirements only when those are absent. Context/alternative/search/adaptation methods have wrapper/test callers but no corresponding app/VR action wiring. The current surface still uses `RepresentationSurface.ts:116` → `MonetaTopologyNode`. `checkContextCompatibility` has no production caller; `MonetaTopologyNode.ts:124–130` checks local request/candidate tokens, not committed context/epoch. The FM1 test manually calls the compatibility helper, so it cannot establish renderer enforcement.

**Owner/fix:** product integration after repaired authorities: wire investigator actions and context-aware requests into the actual entry point and enforce activation immediately before surface mutation. **Falsifier:** actual UI→load/reselection→render respects two committed questions; delayed embodiment after B or A→B→A cannot update the view. Until this exists, stale rendering is an unenforced required invariant at the new seam, not an asserted exploit already triggered by the current UI.

### FMA-09 — package V4, static preservation and durable new state are absent

**BLOCKER to FM3/FM8 completion / High / static format/integration gap.** `NemosynePackage.ts:35–39,113–122` defines/accepts only V1–V3. `NemosyneSession.ts:410` selects existing formats. There is no `investigation/forma.json` writer/reader, V4 digest, static-capture closure or historical-inspection capability. `FormaSpatialCompiler.ts:269–305` re-runs compilation from caller-supplied inputs; it does not restore a materialized artifact, and capture/replay helpers have no product callers. `InvestigationAggregate.ts:561–586,771–784` omits committed context, feedback, knowledge and frozen research state from the relevant serialized projections.

**Owner/fix:** serialized L2-FORMA-1/persistence owner: implement the accepted V4 archive and full immutable closure, separating safe historical inspection from fresh scientific use. **Falsifier:** real export → pack → clean-room import/revisit preserves context, typed scene, annotations/alternatives and recorded frozen state with generator unavailable; tampered assets refuse atomically. Unmodified legacy fixtures retain their original digests. Helper recompilation is not this evidence.

### FMA-10 — selected graph and advisory proposals do not determine embodiment

**BLOCKER / High / static public-path defect.** `FullMonetaEngine.ts:220–239` registers the same aggregate slice once per selected primitive and substitutes a root-centered COORDINATES_WITH star for the selected graph's actual relationships. TEMPORAL/DENSITY/UNCERTAINTY primitives receive copies of the same aggregate plan. System-1 runs at lines 198–199 after graph selection at 97–105; its proposals are not used to select that graph, only status is retained in provenance.

**Owner/fix:** FM7/FM8 after L2 repair: compile selected authoritative bindings and edges, preserving identity and explicit refusals. Feed advisory proposals into candidate generation/ranking before deterministic admission, or narrow the integration claim. **Falsifier:** graphs differing in bindings/relations produce appropriately different validated plans or refusal, not copies; a controlled advisory proposal change affects candidate handling without weakening obligations.

### FMA-11 — an integer count self-authorizes QUALIFIED knowledge

**BLOCKER / High / reproduced public helper defect.** `FormaKnowledgeBase.ts:91–125` accepts `discoveryOutcomeCount: 1` without attributable evidence records, assigns accuracyRate 1 when there are no judgments and defaults to QUALIFIED. `InvestigationAggregate.ts:555–556` exposes promotion without custody validation. Qualified cases influence proposer scores at `FormaSystem1Proposer.ts:155–163`.

**Probe:** invented template/binding plus count 1 returns QUALIFIED, accuracy 1 and zero critiques/judgments. **Owner/fix:** FM6 governance owner: resolve scoped attributable evidence and owner-issued qualification decisions through their actual owners; counts are derived summaries, not permission. **Falsifier:** that input refuses; independent authorized evidence succeeds; a selection or discovery count cannot substitute for measured comprehension.

### FMA-12 — evaluated-model substitution and fabricated holdout evidence permit promotion

**BLOCKER / High / reproduced isolated learning-module defect.** `FormaPriorEvaluator.ts:146–189` accepts arbitrary weights alongside an unbound `passedGate` report. It fabricates group count by rounding holdoutCount/2 and treats overall improvement as leave-one-group-out robustness. Lines 80–81 default missing known-answer/abstention results to 1. There are no source callers of this evaluator yet.

**Probe:** evaluate weights [1,0,0] on three same-group rows, then promote different zero weights with that report; registry activates the zero weights and records two groups/robustness floor 1. **Owner/fix:** FM6/PT9: bind exact candidate, corpus, feature schema, protocol and policy digests; compute actual group metrics; require measured known-answer and abstention regression results. **Falsifier:** candidate/report/corpus substitution and missing required evaluations refuse; valid measured promotion succeeds. This report does not claim the serving production model has already been changed this way.

### FMA-13 — corpus identity ignores labels/features and absent features are invented

**BLOCKER / High / reproduced isolated learning-module defect.** `FormaCuratedLearningCorpus.ts:249–254` hashes only count, policy and first/last IDs. Replacing the middle of three valid confirmed judgments from ACCURATE to MISUNDERSTOOD changes its judgment/example ID and target label but yields the same corpusId. Lines 123–147/206 supply synthetic feature vectors and default dataset identity when snapshots are missing. These are not legitimate attributable training observations.

**Probe:** use `recordHumanMeaningJudgment` to construct three valid confirmed records; replace the middle record with its MISUNDERSTOOD counterpart. Despite a different middle exampleId and labels 1/0, corpus identity stays equal. Omit feature snapshots: emitted features include [1,.5,0,1]. **Owner/fix:** FM6/PT9: commit complete canonical examples and evidence/feature provenance; exclude records lacking genuine features and emit typed curation issues. **Falsifier:** changing any label/feature/dependency changes corpus identity; absent snapshots cannot produce usable training examples.

## Verification actually obtained

- Existing focused Forma/snapshot tests plus six temporary audit characterization probes: **6 files, 29 tests passed** via `npm run test:integration -- tests/full-moneta-audit-probe.test.ts tests/forma-admission.test.ts tests/forma-spatial-compiler.test.ts tests/forma-resolution-broker.test.ts tests/forma-multi-element-runtime.test.ts tests/moneta-semantic-snapshot.test.ts`.
- Existing FM1/FM2/FM6/FM7/FM8 tests: **5 files, 39 tests passed** via `npm run test:integration -- tests/fm1-perspective-product.test.ts tests/fm2-alternatives-road-not-taken.test.ts tests/fm6-human-refinement-forma-knowledge.test.ts tests/fm7-searching-synthesizing-moneta.test.ts tests/fm8-full-moneta-adaptive-intelligence.test.ts`.
- “Passed” characterization probes assert the observed forbidden behavior; they demonstrate defects, not correctness. The temporary file was removed from the worktree. FMA-02–05 recipes below use the existing compiler fixture for reproduction.
- An initial typecheck included unused imports in that temporary probe and failed on those three probe imports only; it is not reported as a repository defect. After probe removal, `npm run typecheck` passed (exit 0).
- Independent reviewer executed in-memory TypeScript module probes for FMA-11–13 and inspected the public/static paths for FMA-01/10. No source files were edited by reviewers.
- No build/WASM rebuild, full suite, CI result, browser, headset, latency/memory benchmark or human qualification is implied by the focused passes.

### Minimal characterization recipes for repair agents

Reuse the two-group envelope, context and manifest fixture at `tests/forma-spatial-compiler.test.ts:19–108`; it currently uses dummy evidence, so these are compiler-boundary probes, not proof of genuine analytical issuance. Retain the positive authoritative integration control when writing regression tests.

| Probe | Invocation/change | Observed result |
| --- | --- | --- |
| FMA-02a | `compileFormaAdmission(snapshot, context, 'REFUSED')` | ADMITTED / PRODUCTION |
| FMA-02b | Clone snapshot; set first node value to 12345; keep old snapshotId; compile | COMPILED |
| FMA-03 | Context perspective foreground + uncertaintyForegrounding interval on count-only fixture | Every channel becomes interval_bounded |
| FMA-04 | Compile two nodes; compare unique semanticNodeId and elementId counts | 2 semantic IDs, 1 element ID |
| FMA-05a | Broker desktop budget versus same-name budget with allowedShapes ['SPHERE'] | Different element bytes, same sliceId and variantId |
| FMA-05b | Broker desktop budget with maxMemoryBytes/maxChannels 0 and requestedGeneration 999 | ADMITTED |

## Ordered repair handoff

1. **Authority containment — L0/L2/FM8:** FMA-01/02 first. Prevent fabricated evidence admission before new consumer/UI wiring; preserve actual existing analytical paths. Validate against real injected Rust and governed receipt owners.
2. **Identity and history — L1:** FMA-06/07 plus the activation contract in FMA-08. Domain-owned files can be independently claimed where disjoint; shared Aggregate/Atlas changes must be coordinated with FM8 work.
3. **Faithful static embodiment — L2/L4:** FMA-03/04/05 and graph translation FMA-10. Require property-level status, exact binding/identity and refusal controls before resource/perceptual qualification.
4. **Durability and actual product integration — serialized L2-FORMA-1:** FMA-08/09. One owner for session/digest/package/adoption. Run real UI and clean-room replay before restoring FM1–FM4 completion claims.
5. **Learning authority — FM6/PT9:** FMA-11/12/13. This can be reviewed independently, but no production promotion or FM8 adaptive claim until corpus/candidate/evidence identity and attributable qualification are demonstrated.
6. **Integrated qualification — FM5–FM8:** wire honest proposal influence, search/selected graph semantics and frozen-state capture only after prerequisites. Keep Quest/human performance and comprehension claims open until attributable evidence exists.

Each repair PR must name finding IDs, state its exact changed-file ownership, add negative and positive production-path falsifiers, and obtain independent review under AGENTS.md. Do not fix all findings in one broad PR or treat this document as authorization to collide with another worktree. These IDs are audit-local findings, not replacements for existing RF/Shadow ledgers; SHADOW-0002 remains unclosed. New architectural departures require adjudication; implementing the already accepted contracts does not require inventing another architecture programme.
