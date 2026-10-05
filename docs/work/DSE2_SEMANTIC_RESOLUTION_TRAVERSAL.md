# DSE2 — Semantic resolution and reversible traversal

**Status:** LANDED via #992 (`main@9e1a0b5e`); completion evidence in section 6 below.
**Roadmap row:** FM-DSE `DSE1 IMPLEMENTED / DSE2 READY` → this tranche.
**Risk tier:** high-risk (representation semantics, dataset identity, cross-budget authority).

## 1. Purpose

Extend the DSE1 direct deterministic compile loop with reversible
dataset → structure → subset → observation traversal, obligation-preserving
device variants, and evict/rebuild lifecycle identity — without adding a
shadow analytical implementation or a second mutable semantic store.

## 2. Scope (three clauses)

1. **Reversible traversal** (`DirectTraversalSession`): open from a compiled
   direct plan element (structure) → bounded subset page → exact observation →
   exact return. Every member is resolved by the resident analytical authority
   through the existing `semanticDetail` port operation; the session never
   fabricates members.
2. **Obligation-preserving variants**: compile the same snapshot+context under
   desktop-expansive and Quest-constrained budgets; admit the pair only when
   all mandatory node/channel obligations survive in both plans with shared
   traversal-root identity.
3. **Evict/rebuild lifecycle**: evict drops materialised pages but retains
   reconstruction descriptors; rebuild re-issues the identical request and
   accepts only byte-identical observation identity, else fails closed.

## 3. Adversarial contract (pre-implementation)

- **Invariant:** every observation a traversal returns is a member resolved by
  the resident analytical authority for the bound (dataset, family, decision);
  return restores the exact parent; variant switch preserves mandatory
  obligations; evict/rebuild preserves traversal identity or refuses.
- **Authority / production path:** Rust/WASM owns membership via the
  `semanticDetail` port op. TS owns session orchestration. Real entry point:
  `AtlasCore` → `InvestigationAggregate` → session module.
- **Failure modes:** (a) mocked tests masking live production refusal;
  (b) direct-decision vs detail-authority decisionId confusion resolving wrong
  members; (c) stale-generation reuse after dataset change; (d) obligation
  drift across budgets; (e) unbounded pages; (f) conjectural elements
  presented as grounded.
- **Falsifying evidence:** refusal battery (no port, unregistered dataset,
  stale generation, fingerprint/family/decision mismatch, over-limit,
  envelope-identity mismatch) must all refuse with zero fabricated members;
  fault-injection tests (drop obligation, corrupt page, advance generation)
  must fail the operation, not degrade silently.
- **Non-goals:** native direct-decision Rust authority establishment (detail
  authority is caller-established via governed builders; recorded as the
  `establishedDetailAuthority` binding); conjectural purpose enforcement
  (DSE3 — DSE2 only preserves the `isConjectural` flag); multi-dataset (DSE4);
  runtime search (DSE5).

## 4. Evidence and exit criteria

- `tests/dse2-semantic-resolution.test.ts`: traversal battery + variant
  equivalence + lifecycle battery + refusal battery, all passing.
- `npm run typecheck`, `npm run lint` (touched files), `npm run docs:check`,
  relevant vitest suites green on the exact PR head.
- Post-implementation adversarial pass recorded in the PR body.
- Roadmap FM-DSE row advances only on merge with exact-head evidence.

## 5. STOP

Stop if traversal requires snapshot-derived builder params (fabrication —
rejected), a second mutable semantic store, or Rust/ABI changes (defer with
an explicit dependency note instead).

## 6. Completion evidence

- `tests/dse2-semantic-resolution.test.ts`: 15/15 green (variants,
  traversal, lifecycle, refusal battery, AtlasCore entry point).
- `tests/dse1-direct-compile.test.ts`: still green (no DSE1 regression).
- `typecheck`, `eslint` (touched files, 0 errors), `docs:check`,
  `architecture:boundaries` green in-worktree; full CI monitored on the PR.
- Mutation probe: weakened envelope-identity guard fails the refusal battery;
  restored and re-verified green.
- Residual: live traversal needs caller-established detail authority via
  governed builders; VR-surface wiring is downstream (DSE3/FM1/FM2).
