# FM2 Alternative-Aware Moneta / Road Not Taken — Closure Record

Date: 3 October 2026
Base: `main@b3c4251e9c0d3d58e74b8d9a23203da08fe165e6`
Worktree / Branch: `feat/fm2-alternatives-road-not-taken`
Status: Historical closure claim; superseded by the [4 October completeness audit](FULL_MONETA_COMPLETENESS_AUDIT_2026-10-04.md). Current status is owned by [ROADMAP](../ROADMAP.md).

## 1. High-Risk Adversarial Contract & Invariant

### Invariant
1. **Alternative Inspection & Preserved Semantic Anchors:**
   Rejected or competing representation alternatives evaluated by Moneta are promoted from passive `RejectedAlternative` metadata into bounded inspectable `AlternativeCandidate` identities with preserved spatial embodiments and shared semantic anchors (`numeric_dimensions`, `categorical_dimensions`, `temporal_sequence`, `graph_topology`, `cluster_partitions`).
2. **Preview Purity & Non-Mutation:**
   Previewing or comparing an alternative candidate via `previewAlternative()` or `compareAlternative()` is strictly non-mutating with respect to active representation decision, spatial strategy, investigation graph nodes, and active context.
3. **Fail-Closed Road Not Taken Branching:**
   Branching to an alternative candidate via `branchToAlternative()` fails closed against candidates classified as `DISQUALIFIED` (hard constraint failure) or `ABSTAIN` (insufficient evidence / stability refusal), raising a typed error without adding nodes or edges to the investigation graph.
4. **Lineage Integrity & Historical Invariance:**
   Branching to an eligible candidate adds a child node in `InvestigationGraph` with `kind: 'representation_decision'` and edge relationship `'branches_from'`, updating the active representation on the child node while preserving the parent node's state, attributes, dataset version, and historical investigation digests bitwise invariant.

## 2. Production Boundary & Authority

1. **Analytical & Representation Selection Authority:**
   - Rust/WASM owns canonical analytical evidence (`DatasetEvidence`).
   - `MonetaHypothesisEngine` owns representation arbitration, evaluating candidates against hard constraints and utility scores, populating `alternatives: AlternativeCandidate[]` with eligibility classifications (`ELIGIBLE`, `NEAR_MISS`, `AMBIGUOUS`, `ABSTAIN`, `DISQUALIFIED`).
2. **Domain Aggregate & Lineage:**
   - `InvestigationAggregate` owns investigation session state, graph nodes, context ledger, and event provenance.
   - `InvestigationGraph` enforces DAG acyclicity and records branch lineage with `branches_from` relationship.
   - `CommittedInvestigationContextLedger` preserves context lineage for the branched child node with optional intent overrides.
3. **Production Entry Point:**
   - `AtlasCore` exposes:
     - `getRepresentationAlternatives(): readonly AlternativeCandidate[]`
     - `previewAlternative(candidateId: string): { embodiment: DecisionEmbodiment; candidate: AlternativeCandidate }`
     - `compareAlternative(candidateId: string): { current: RepresentationDecision; alternative: AlternativeCandidate; sharedAnchors: readonly string[] }`
     - `branchToAlternative(candidateId: string, intentOverride?: unknown): InvestigationNode`

## 3. Adversarial Failure Modes & Mitigations

1. **Failure Mode: Branching to Disqualified Candidates**
   - *Attack:* An investigator or adversarial script attempts to branch to a candidate that failed hard constraints (e.g. geometric incompatibility or stability requirement).
   - *Mitigation:* `branchToAlternative()` checks `candidate.eligibility` and immediately throws an error before touching the graph, ledger, or representation state.
2. **Failure Mode: State Mutation during Preview**
   - *Attack:* Calling `previewAlternative()` silently alters the active decision or adds exploratory nodes to the graph.
   - *Mitigation:* `previewAlternative()` constructs a transient `DecisionEmbodiment` from candidate parameters and dataset fingerprint without mutating `activeDecision`, `activeStrategy`, or graph state.
3. **Failure Mode: Historical Parent Node Mutation & Digest Drift**
   - *Attack:* Branching updates or mutates the parent node's metadata, timestamps, or dataset version.
   - *Mitigation:* The parent node is treated as an immutable ancestor; only a new child node and directed edge are appended to `InvestigationGraph`.
4. **Failure Mode: Disconnected Context Lineage**
   - *Attack:* A branched node loses epistemic purpose or intent from the parent investigation.
   - *Mitigation:* `branchToAlternative()` inherits the active committed context, applies canonical intent overrides if supplied, and commits a child context activation with epoch tracking.

## 4. Verification Evidence

- Dedicated FM2 Verification Suite: `tests/fm2-alternatives-road-not-taken.test.ts` (7 tests, 100% pass):
  - Populates AlternativeCandidate list with eligibility, margins, and shared semantic anchors.
  - Previewing alternative returns embodiment without mutating active state or graph.
  - Comparing alternative returns active decision, candidate, and shared anchors.
  - Fails closed when attempting to branch to a disqualified candidate.
  - Creates child branch node with `branches_from` edge, updates active representation, and preserves parent node state bitwise invariant.
  - Commits child context with optional intent override.
  - Computes reproducible digest reflecting alternative embodiment.
- Core & Subsystem Regression:
  - `tests/fm1-perspective-product.test.ts` (12 tests)
  - `tests/investigation-digest-semantic-contract.test.ts` (13 tests)
  - `tests/atlas-moneta-evidence-authority.test.ts` (8 tests)
- Full Project Verification:
  - `npm run typecheck`: PASSED (0 errors).
  - `npm run lint`: PASSED (0 errors, 282 advisory warnings).
  - `npm run docs:check`: PASSED.
  - `npm run audit:hygiene`: PASSED (9/9 dimensions verified).

## 5. Residual Risk

- Downstream interaction UI panels for Road Not Taken (e.g. XR spatial side-by-side comparison lenses) depend on FM3/4 multi-candidate layout rendering.
