# ADR-0010: AP-SEARCH Architecture Preflight for FM7 Representation Search and Synthesis

**Status:** ACCEPTED
**Date:** 3 October 2026

**Context:**
Full Moneta FM7 introduces "Searching / Synthesizing Moneta", advancing Nemosyne from selecting solely among fixed catalogue candidates to constructing and searching new bounded representation hypotheses via multi-objective Pareto exploration.

In accordance with `docs/roadmap/P1_FULL_MONETA_INCREMENTAL_CAPABILITY_PLAN.md` and `docs/architecture/ARCHITECTURE_2027_REVIEW.md`, AP-SEARCH governs the architecture boundaries, grammar authority, objective model, Pareto semantics, deterministic baseline, lineage tracking, and MCR7 genome handoff before the grammar/search loop is implemented.

Active constraints:
- Rust/WASM remains canonical analytical and evidence authority; search/synthesis cannot mutate dataset fingerprints, evidence receipts, or statistical truth.
- Synthesis must be bounded by a typed grammar rather than unconstrained open-ended hallucination.
- Search must evaluate multi-objective trade-offs rather than collapsing into an opaque scalar metric.
- A deterministic reference composer must provide a non-stochastic baseline.
- MCR7 defines the external laboratory genome handoff seam with strict anti-mutation guards.

## Decision

1. **Grammar Authority (`RepresentationGraphGrammar`)**:
   - The grammar operates strictly on valid `RepresentationPrimitiveKind` elements and typed composition relations (`OVERLAY`, `COORDINATES_WITH`, `DERIVES_FROM`, `CONTAINS`, `DETAIL_OF`, `COMPARES_WITH`).
   - Production rules define admissible combinations, preventing structurally contradictory pairings (e.g. attempting to overlay incompatible topologies or un-coordinated spatial coordinate spaces).
   - Bounds: Maximum 16 primitives and 32 composition edges per synthesized graph to preserve cognitive clarity and real-time XR frame budgets.

2. **Representation Objective Model (`RepresentationObjectiveVectorV1`)**:
   - Evaluates candidate graphs across 7 explicit normalized dimensions [0, 1]:
     1. `taskRelevance`: Alignment with active `InvestigationIntent` (variables of interest, epistemic purpose).
     2. `informationPreservation`: Retention of salient dataset structures, variance, cluster separations, or temporal order.
     3. `perceptualRecoverability`: Channel distinctiveness, visual clarity, absence of encoding collisions or misleading visual salience.
     4. `interactionCost`: Complexity of interaction required to navigate or inspect the composition (higher = less effort).
     5. `resourceCost`: Hardware envelope efficiency (GPU draw calls, primitives, memory footprint).
     6. `stability`: Robustness against perturbation and noise as certified by stability evidence.
     7. `explicitLoss`: Quantified information omission or aggregation loss (higher = less loss / more complete).
   - Objectives are inspectable in TechnoCore to expose why compositions were synthesized and their trade-offs.

3. **Deterministic Reference Composer**:
   - For any given `SemanticSnapshotV1` and `CommittedInvestigationContext`, a deterministic reference composer generates the canonical baseline `RepresentationGraph` without stochastic search.
   - Provides the benchmark against which synthesized candidates must demonstrate non-dominated advantage.

4. **Multi-Objective Pareto Search & Seeding**:
   - Implements non-dominated Pareto sorting: candidate A dominates B if A is at least as good as B in all 7 objectives and strictly better in at least one.
   - Preserves a diverse Pareto frontier of inspectable alternatives for "Road Not Taken".
   - System-1 proposals (`FormaSystem1Proposer`) and Forma Knowledge Base priors can seed search starting points or prune unpromising paths, but can never bypass evidence admissibility gates or hard constraints.
   - Researcher adjustments ("simpler", "show more uncertainty", "preserve temporal structure") act as governed Pareto preference projections that prioritize specific objective subspaces without mutating underlying evidence.

5. **Search Lineage & Provenance**:
   - Every synthesized candidate carries full search provenance:
     - `searchSessionId`, `generation`, `parentCandidateIds`, `appliedGrammarRules`, and `paretoRank`.
   - Refusal/disqualification records explain why dominated or invalid candidates were discarded.

6. **MCR7 Laboratory Genome Handoff**:
   - `RepresentationGenomeHandoffV1` defines the unidirectional boundary importing laboratory genomes into production `RepresentationGraph` candidates.
   - Strictly validates genome schemas and immediately rejects any attempt to specify or modify dataset fingerprints, analytical facts, or evidence receipts.
   - If an imported genome is out-of-grammar or evidence-incompatible, it fails closed (`OUT_OF_GRAMMAR` / `ABSTAIN`).

7. **Analytical and Replay Invariance**:
   - Synthesizing or previewing search candidates is strictly pure; it does not mutate dataset fingerprints, session history, or historical investigation digests.
   - Branching to a synthesized candidate follows standard FM2 Road Not Taken semantics: creates a child node with `branches_from` edge, preserving ancestor state bitwise invariant.

## Consequences

- Moneta can generate novel valid representational compositions tailored to investigator intent.
- Researchers can explore alternative trade-offs ("simpler" vs "more detailed") with transparent rationale.
- Search never produces ungrounded visual fantasies: all primitives bind to verified analytical evidence.
- The external laboratory evolutionary engine in `nemosyne-data` has a clean, safe production handoff seam.
