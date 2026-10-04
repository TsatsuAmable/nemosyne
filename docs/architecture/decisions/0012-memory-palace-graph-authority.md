# ADR-0012: Memory Palace graph authority

**Status:** Accepted  
**Date:** 2026-10-04  
**Supersedes:** none  
**Superseded by:** none  
**Tracking:** #860

## Context

`src/memory/MemoryPalaceGraph.ts` declares itself the "Authoritative spatial
reasoning graph for the Memory Palace" and is covered by the production
`memory-palace` capability classification. At `main@36dfeb50` the claim does
not match reachability:

- Nothing constructs `MemoryPalaceGraph` outside its own file; no test
  exercises its graph/snapshot authority.
- The product Memory Palace is driven by `MemoryPalaceWorldView`, a
  deterministic projection of `InvestigationAggregate` state (graph
  nodes/edges, observations, findings) via `MemoryPalaceProjectionSource`
  (`FunctionalWorldObjectsPresenter.memorySource`). The view imports only
  `EpistemicObject.ts` contracts (types, colors, cues), never the graph.
- The graph's write paths are evidence-blind: untyped `Map<string, any>`
  stores, `Date.now()` timestamps, caller-supplied objects with no dataset
  fingerprint/digest/receipt binding, and a fail-open `fromSnapshot` restore.
  Its snapshot (`schemaVersion: '1.0.0'`) participates in no digest, replay,
  or V4 preservation contract.

Reviving this store during Memory Palace expansion (FM1 question-context
history, FM2 branch/alternative paths, FM6 learning lineage) without an
explicit decision would create two competing mutable truth sources beside
the investigation/evidence projection path, violating ADR-0001, ADR-0005,
and the dual-epistemic admission boundary (RFC 0011).

## Decision

**RETIRE** `MemoryPalaceGraph` as an authority. The surviving topology is:

- `InvestigationAggregate` plus the governed evidence ledger own epistemic
  object identity, lifecycle, and durable state. This is the single mutable
  truth; it is already digest-bound and replayable.
- The Memory Palace product surface remains a deterministically rebuildable
  read-model projection (`MemoryPalaceProjectionSource` →
  `MemoryPalaceWorldView`), never a second evidence authority.
- `src/memory/EpistemicObject.ts` contracts (object/relation/beacon/thread/
  branch-point types, colors, cues, snapshot interface) are preserved: the
  production view consumes them.
- Future branch/contradiction/rejected-alternative history reuses
  investigation-graph edges, committed context revisions, and V4
  materialized preservation — not a separate palace-owned store.
- Promotion of any Memory Palace content to grounded status is a new
  analytical/evidence event with lineage, never an in-place graph relabel.

Rejected alternatives: **INTEGRATE** would require evidence-bound writes,
determinism, a persistence/replay contract, and rewiring the view onto the
store — a high-risk authority change with no product need, since the
projection already serves the bounded production Memory Palace.
**DEMOTE** keeps a production-classified dormant store with stripped claims
at nearly the cost of retirement and none of the benefit.

## Consequences

- A follow-up retirement implementation deletes `MemoryPalaceGraph.ts` (and
  its barrel re-export), narrows the `memory-palace` registry entry to the
  WorldView path, and adds projection invariant tests. That execution PR —
  not this ADR — closes the remaining #860 exit criteria.
- No Memory Palace expansion may depend on, construct, or persist through
  `MemoryPalaceGraph` after this decision.
- If a future investigation-history need cannot be served by the aggregate/
  committed-context/V4 path, it requires a new ADR; this store is not
  revived implicitly.
