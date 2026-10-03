# FM1 Perspective and Context V2 Product Consumption — Closure Record

Date: 3 October 2026
Base: `main@62aecff66e5f1a541604a37f597fe2dae1be22f2`
Worktree / Branch: `feat/fm1-perspective-product`
Status: VERIFIED COMPLETE

## 1. High-Risk Adversarial Contract & Invariant

### Invariant
1. **Analytical Dataset & Snapshot Identity Invariance:**
   Investigation perspectives, epistemic stances, and contextual focus shifts are non-destructive lens transformations. The canonical Rust/WASM analytical state (`datasetFingerprint`, `immutableDatasetFingerprint`), analytical snapshot hashes (`SemanticSnapshotV1.snapshotId`), and underlying observation row counts remain bitwise invariant under perspective activation and representation arbitration.
2. **Context Lifecycle and Digest Integrity:**
   Committed investigation contexts (`InvestigationContextV2`, `CommittedInvestigationContextLedger`) preserve historical investigation replay digests without mutating legacy replay hashes.
3. **Fail-Closed Population Integrity:**
   Views and perspectives cannot silently narrow, filter, or discard observations. Any perspective specification attempting population filtering or invalid mode selection must refuse closed without mutating the active analytical boundary.
4. **Metamorphic Whitespace & Question Preservation:**
   Investigator intent transformations and context identity generation must be deterministic and invariant to non-semantic whitespace variations.

## 2. Production Boundary & Authority

1. **Analytical Authority:**
   - Rust/WASM owns authoritative numerical, statistical, topological, and dataset identity.
   - `InvestigationAggregate` maintains historical investigation state, node ledgers, and event provenance.
2. **Context & Perspective Product Layer:**
   - `src/atlas/domain/CommittedInvestigationContext.ts`: Canonical context ledger with monotonic sequence ordering, deterministic identity, and claim-bearing context state.
   - `src/atlas/domain/InvestigationAggregate.ts`: Root aggregate coordinator exposing `commitContext()`, `getActiveContext()`, `activateContext()`, and `setPerspective()`.
   - `src/atlas/AtlasCore.ts`: Production entry point binding context lifecycle, perspective selection, and question-aware representation arbitration (`arbitrateRepresentation()`).
   - `src/moneta/representation/RepresentationRequirements.ts`: `createRequirementsFromContext()` translating investigation intent tasks and variables into representation requirements without shadow analytics.
   - `src/moneta/representation/MonetaHypothesisEngine.ts`: Hypothesis engine enriching representation decisions with `contextIdentity`, `intentIdentity`, and `perspectiveIdentity` provenance.
   - `src/moneta/forma/FormaAdmission.ts`: Forma admission binding `contextId` and `planId` to committed context identity.
   - `src/moneta/forma/FormaSpatialCompiler.ts`: Spatial compiler executing perspective foregrounding (e.g. recency highlights, historical context, uncertainty intervals) strictly in visual encoding properties while preserving exact node counts and analytical snapshot identity.

## 3. Adversarial Failure Modes & Mitigations

1. **Failure Mode: Silent Population Filtering via Perspective**
   - *Attack:* A perspective attempts to filter or subset rows (e.g. dropping older observations).
   - *Mitigation:* `FormaSpatialCompiler` and `InvestigationAggregate` reject population narrowing; perspective foregrounding adjusts visual styling tokens (color, annotation) only, keeping node counts and underlying data identical.
2. **Failure Mode: Analytical Snapshot Mutation**
   - *Attack:* Applying a perspective alters the compiled `SemanticSnapshotV1.snapshotId` or modifies Rust dataset fingerprints.
   - *Mitigation:* Verified in `tests/fm1-perspective-product.test.ts` that `snapshot.snapshotId` and `dataset.fingerprint()` remain bitwise identical before and after perspective application.
3. **Failure Mode: Investigation Digest Drift**
   - *Attack:* Storing context ledgers in `InvestigationAggregate` alters legacy investigation digests.
   - *Mitigation:* Investigation digest computation hashes analytical nodes, dataset fingerprints, and event ledgers; `contextLedger` is cleanly segregated and does not invalidate historical replay digests.
4. **Failure Mode: Non-deterministic Context Identity on Whitespace**
   - *Attack:* Extra whitespace in research questions causes different context identities or triggers duplicate recomputations.
   - *Mitigation:* Metamorphic tests verify whitespace normalization and deterministic identity generation across arbitrary variations.

## 4. Verification Evidence

- Dedicated FM1 Product Consumption Suite: `tests/fm1-perspective-product.test.ts` (12 tests, 100% pass):
  - Root node initializes with default context in CLAIM_BEARING status.
  - Commits valid context and tracks monotonic sequence.
  - Enriches RepresentationDecision with question-aware intent and context provenance.
  - Generates deterministic context identities invariant to whitespace.
  - Applies perspective foregrounding without mutating underlying node count or analytical snapshot identity.
  - Refuses population-narrowing perspectives.
  - Integrates with Forma admission binding context identity to admission records.
  - Preserves investigation aggregate replay digest across context activation.
- Core and Subsystem Regression:
  - `tests/forma-admission.test.ts` (13 tests)
  - `tests/forma-multi-element-runtime.test.ts` (10 tests)
  - `tests/forma-resolution-broker.test.ts` (10 tests)
  - `tests/forma-spatial-compiler.test.ts` (12 tests)
  - `tests/forma-system1-proposer.test.ts` (11 tests)
  - `tests/investigation-perspective.test.ts` (6 tests)
  - `tests/atlas-core.test.ts` (5 tests)
- Full Project Verification:
  - `npm run typecheck`: PASSED (0 errors).
  - `npm run lint`: PASSED (0 errors, 282 advisory warnings).
  - `npm run docs:check`: PASSED.
  - `npm run audit:hygiene`: PASSED (9/9 dimensions verified).
  - `npm test`: PASSED (502 test files, 100% passed).

## 5. Residual Risk

- Downstream learning loop (FM6/7) and human feedback refinement are not yet connected to perspective transitions; this is strictly downstream per roadmap sequencing.
