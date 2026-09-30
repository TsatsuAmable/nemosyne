# ADR-0009: AP-INV Architecture Preflight for FM1 Question-Aware Moneta

**Status:** ACCEPTED
**Date:** 30 September 2026

**Context:** 
Full Moneta FM1 introduces "Question-Aware Moneta", requiring future representation reasoning to be grounded not just in dataset statistics, but in the explicit `InvestigationIntent` of the researcher (their active question, hypothesis, variables of interest, and task). To prepare for FM1 and future FM2 (Alternative-Aware) without breaking legacy reproducibility, we must define canonical intent shapes, branching semantics, and representation correspondence contracts before `InvestigationIntent` is fully integrated into the representation pipeline.

Active parallel constraint: TEC1 evidence-authority repair is ongoing. This architecture must remain provably disjoint from `ROADMAP.md` updates or evidence-authority mutation (no changes to `src/atlas/types.ts` or `src/atlas/domain/InvestigationAggregate.ts` that would alter V2/V3 digest computation).

## Decision

1. **Evolution of InvestigationGraph and Identity Semantics**: 
   - Retain the existing `src/atlas/domain/InvestigationGraph.ts` as the sole DAG authority.
   - Retain explicit, stable string IDs for `InvestigationNode`. Do not replace node identity with a content-hash scheme. 
   - The `parentId` field on `InvestigationNode` is preserved for convenience and legacy compatibility, but the graph's `_incomingMap` (DAG edges) is the authoritative lineage structure, natively supporting future merge nodes with multiple incoming edges.

2. **Canonical InvestigationIntent V1 and Canonicalization**:
   - Define a minimal `InvestigationIntent` structure (encapsulating research question, hypothesis, variables of interest, and current task).
   - Adopt exact, not approximate, mechanical canonicalization: each present string is Unicode NFC-normalized then trimmed at its boundaries; internal whitespace is preserved; empty-after-trim becomes absent. `variablesOfInterest` preserves caller order and applies the same per-item normalization; empty items are rejected rather than silently dropped. An explicitly empty `variablesOfInterest: []` remains distinct from an absent field. Unknown V1 fields are rejected rather than silently excluded from the canonical identity. No semantic/NLP equivalence.

3. **Draft vs Committed Intent and Version Semantics**:
   - **Draft State**: Mutable working input resides in UI/session state and is not a durable investigation node. Keystrokes do not increment versions.
   - **Committed State**: Only explicit commits (e.g., upon analysis execution or explicit milestone) create a new versioned `InvestigationIntent` bound to a new `InvestigationNode`. 

4. **ResearchContext Ownership and Convergence Plan**:
   - There are currently two `ResearchContext` surfaces (`src/atlas/domain/ResearchContext.ts` and `src/atlas/types.ts ResearchContext` + `NemosyneSession`).
   - For the first implementation slice, AP-INV will introduce `InvestigationIntent` as a standalone structure rather than forcefully merging the `ResearchContext` authorities. A subsequent convergence phase will reconcile the domain class and the session persistence layer before claiming unified ownership.

5. **Graph Lineage, Branching, and Revisit Semantics**:
   - **Branch**: Changing a committed `InvestigationIntent` from an older historical node implicitly forks the DAG via a new outgoing edge, creating a branch sibling.
   - **Revisit**: The required future restore contract is that loading an older `InvestigationNode` restores its exact analytical state and `InvestigationIntent`. The current `InvestigationGraph` alone does not yet snapshot/restore every historical analytical state.
   - **Future Merge**: The DAG edge structure supports future FM2/FM6 merge nodes that resolve divergent intents, relying on edges rather than the legacy `parentId`.

6. **Future RepresentationDecision Correspondence**:
   - Current production Moneta does not yet consume intent. We establish a *future* correspondence contract: once FM1 goes live, `RepresentationDecision` will be deterministically bound to the specific `InvestigationIntent` version. A material change in intent will obligate Moneta to re-evaluate the decision.

7. **Legacy Persistence, Replay Migration, and Fail-Closed Behavior**:
   - **No Silent Rewrites**: Existing V2/V3 investigation digests already hash the persisted `researchContext`. Legacy investigations lacking intent must remain representable and replayable exactly as they are. Do not inject a synthetic "V0" intent that would alter historical digests.
   - **Absence vs Refusal**: Distinguish between "intent absent / legacy-unframed" and a Moneta `ABSTAIN` decision. A missing intent does not automatically force an `ABSTAIN`.
   - **Fail-Closed New Intents**: Malformed NEW intent must be rejected as an invalid intent commit / typed validation failure. Do NOT map malformed intent to Moneta ABSTAIN. ABSTAIN is a representation decision and remains a separate downstream semantic.

8. **Memory Palace and Farcaster as Projections**:
   - Memory Palace strictly **projects** the immutable `InvestigationGraph` visually. It must not author novel nodes or alter identities.
   - Farcaster portals represent UI transitions to other `InvestigationNode` identities in the graph. Neither system becomes a secondary authority for historical truth.

## Executable Falsifiers Required Before Implementation

- **Intent Independence Test**: A test proving that `InvestigationNode` identities and `InvestigationGraph` edges function correctly and maintain stability when `InvestigationIntent` is attached, without requiring a content-hash ID.
- **Legacy Digest Preservation Test**: A test proving that recomputing the digest of a legacy investigation (with undefined intent) yields the exact same cryptographic hash as before, falsifying any silent migration.
- **Mechanical Canonicalization Test**: A metamorphic test proving that trivial mechanical changes (like trailing whitespace) in `InvestigationIntent` canonicalize to the same intent hash, while material changes yield a different hash.
- **Draft vs Commit Separation Test**: A test verifying that mutating a draft intent object does not alter the graph or increment the version until explicitly committed.

## Exact First Implementation Slice

To ensure a provably disjoint surface from TEC1/#834, the first implementation slice will strictly introduce the standalone types, canonicalization logic, and falsifier tests:
- `src/atlas/domain/InvestigationIntent.ts` (new)
- `tests/investigation-intent.test.ts` (new)

It will **not** modify `src/atlas/types.ts`, `src/atlas/domain/InvestigationAggregate.ts`, `src/atlas/domain/InvestigationGraph.ts`, or any existing persistence/digest code in this initial PR.
