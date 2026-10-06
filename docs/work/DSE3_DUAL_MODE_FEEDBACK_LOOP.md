# DSE3 — Dual-mode feedback loop

**Status:** LANDED via #993 (`main@7068b588`); completion evidence in section 6 below.
**Roadmap row:** FM-DSE `DSE2 IMPLEMENTED / DSE3 READY` → this tranche.
**Risk tier:** high-risk (epistemic typing, investigation identity, feedback attribution).

## 1. Purpose

Close the smallest complete investigation loop on the direct path: conjectural
content stays visibly disclosed and purpose-gated, an attributable critique
resolves to a recompiled alternative (Road Not Taken), and outcome feedback
binds to that link with V4-replayable lineage.

## 2. Scope (four clauses)

1. **Purpose enforcement:** traversal open/inspect refuses conjectural targets
   unless purpose is EXPLORATORY (omitted purpose defaults to CLAIM_BEARING —
   fail closed). Aggregate supplies the active context purpose.
2. **Visible disclosure:** per-element disclosure records joining plan
   elements to admitted proposals (status, generator provenance, uncertainty
   text); unbound/mismatched proposals refuse.
3. **Critique → alternative:** recompile the same snapshot/context with
   adjusted budget/obligations/admission into a linked alternative; the link
   (critique → prior → alternative) carries deterministic identity.
4. **Attributable feedback + lineage:** outcome feedback delegates to the
   existing FM6 critique record (author + anti-self-labeling intact) and binds
   to the link; links/bindings live on the aggregate beside critique records.

## 3. Adversarial contract (pre-implementation)

- **Invariant:** no conjectural observation is traversable under CLAIM_BEARING;
  every disclosure names its proposal and generator; every alternative names
  its critique and prior; every feedback names its author and link.
- **Authority / production path:** Rust/WASM owns members (unchanged);
  admission owns proposal validity (unchanged); aggregate owns links. Real
  entry: `AtlasCore` → `InvestigationAggregate` → `DirectFeedbackLoop`.
- **Failure modes:** (a) permissive purpose default leaking conjecture;
  (b) disclosure naming the wrong proposal (join-key confusion);
  (c) alternative silently switching the active compilation;
  (d) feedback laundering automated events as human judgment;
  (e) link records bypassing history capture (V4 lineage gap).
- **Falsifying evidence:** purpose matrix tests (grounded/conjectural ×
  CLAIM/EXPLORATORY/omitted); wrong-proposal and unknown-critique refusals;
  self-labeling feedback refusal; determinism of disclosure/link ids.
- **Non-goals:** legacy `branchToAlternative` migration (FullMoneta stack
  unchanged); VR-surface disclosure rendering (downstream FM1/FM2 surfaces);
  native direct-decision Rust authority (still deferred); multi-dataset (DSE4);
  runtime search (DSE5).

## 4. Evidence and exit criteria

- `tests/dse3-dual-mode-feedback.test.ts` green (disclosure, purpose matrix,
  critique→alternative, feedback binding, AtlasCore entry point).
- DSE1/DSE2 batteries still green; `typecheck`, `lint`, `docs:check`,
  `architecture:boundaries` green; full CI on the PR.
- Post-implementation adversarial pass in the PR body.
- Roadmap FM-DSE row advances only on merge with exact-head evidence.

## 5. STOP

Stop if disclosure requires inventing proposal linkage the admission result
does not carry, if alternatives need legacy representation decisions, or if
feedback needs new trust authority beyond FM6 attribution.

## 6. Completion evidence

- `tests/dse3-dual-mode-feedback.test.ts`: 12/12 green (disclosure,
  purpose matrix incl. CLAIM_BEARING context switch, critique→alternative,
  feedback binding, AtlasCore full loop).
- DSE1 (8) + DSE2 (15) batteries still green.
- `typecheck`, `eslint` (0 errors), `docs:check`,
  `architecture:boundaries` green in-worktree; full CI monitored on the PR.
- Mutation probe: removed purpose guard fails the purpose-matrix test;
  restored and re-verified green.
- Residual: VR-surface disclosure rendering is downstream (FM1/FM2);
  native direct-decision Rust authority still deferred.
