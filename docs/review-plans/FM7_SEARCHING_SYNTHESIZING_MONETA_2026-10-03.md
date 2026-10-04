# FM7 Searching / Synthesizing Moneta — Closure Record

Date: 3 October 2026
Base: `main@5af014bc0082f483c7ce379b35bc5be2beeb0531`
Worktree / Branch: `feat/fm7-searching-synthesizing-moneta`
Status: VERIFIED COMPLETE

## 1. High-Risk Pre-Implementation Adversarial Contract

### Invariant
1. **Grammar Admissibility & Bounded Composition:**
   All candidate representation graphs synthesized by `RepresentationSearchEngine` or materialized via `RepresentationGenomeHandoff` must strictly satisfy `validateGraphAgainstGrammar`. Hard constraints (primitive bounds <= 16, edge bounds <= 32, max depth <= 6, acyclic composition) and pairwise relation admissibility (`ADMISSIBLE_COMPOSITION_RULES`) are enforced fail-closed.
2. **Deterministic Baseline Reproducibility:**
   `DeterministicReferenceComposer` acts as an invariant non-stochastic baseline, producing bitwise-identical `RepresentationGraph` structures given identical `DatasetSignature` inputs across repeated runs.
3. **Analytical & Scientific Authority Invariance:**
   Searching or synthesizing representations operates strictly in hypothesis/representation space. Under no circumstances may search mutate underlying dataset observations, column types, canonical dataset fingerprints, or historical DAG investigation digests computed by Rust/WASM authority.
4. **Transparent 7-Dimensional Objective Vector & Pareto Optimality:**
   Candidate graphs are evaluated across a 7-dimensional objective vector (task relevance, information preservation, perceptual recoverability, interaction cost, resource cost, stability, explicit loss) with all dimensions bounded in [0, 1]. Non-dominated sorting identifies the true Pareto frontier, rejecting arbitrary scalar collapse.
5. **MCR7 Laboratory Genome Handoff Boundary:**
   External evolutionary or laboratory search engines interface via `RepresentationGenomeHandoff`. Any external genome attempting to forge or override `datasetFingerprint` or analytical properties is immediately rejected (`status: 'ABSTAIN'`). Admitted genomes must pass grammar validation (`status: 'ADMITTED'`) or fail closed (`status: 'OUT_OF_GRAMMAR'`).

### Authority and Production Path
1. **Search & Objective Authority:**
   - `src/moneta/search/RepresentationObjectiveModel.ts`: Canonical 7D objective model, Pareto dominance, preference profiles, and TechnoCore trade-off explanations.
   - `src/moneta/search/RepresentationGraphGrammar.ts`: Grammar production bounds, admissible composition rules, and validation.
   - `src/moneta/search/DeterministicReferenceComposer.ts`: Deterministic non-stochastic reference composer.
   - `src/moneta/search/RepresentationGenomeHandoff.ts`: MCR7 laboratory genome handoff adapter with anti-analytical-mutation guards.
   - `src/moneta/search/RepresentationSearchEngine.ts`: Pareto multi-objective search engine with System-1 proposal seeding and lineage tracking.
2. **Investigation & Product Production Path:**
   - `src/atlas/domain/InvestigationAggregate.ts`: Exposes `searchRepresentations(options)` within the active investigation context.
   - `src/atlas/AtlasCore.ts`: Exposes `searchRepresentations(options)` and `explainObjectiveTradeoffs(candidate, preference)` for user and TechnoCore interrogation.

### Primary Failure Modes & Falsifiers
1. **Falsifier A (Combinatorial / Grammar Explosion):**
   - *Attack:* Search produces nonsensical graphs with cyclic dependencies or inadmissible cross-primitive relations (e.g. UNCERTAINTY deriving from DETAIL_EXPANSION).
   - *Mitigation:* `validateGraphAgainstGrammar` rejects invalid topologies fail-closed.
2. **Falsifier B (Analytical Mutation):**
   - *Attack:* Search modifies dataset rows, column profiles, or historical investigation digests.
   - *Mitigation:* Verified bitwise invariance of `atlas.datasetFingerprint` and `atlas.computeDigest()` across multi-generation search sessions.
3. **Falsifier C (Objective Vector & Pareto Domination):**
   - *Attack:* Objective scores escape [0, 1] or the Pareto frontier contains dominated candidates.
   - *Mitigation:* Verified bounded objective vectors and mutual non-domination across rank-1 Pareto candidates.
4. **Falsifier D (Grammar Hard Constraints):**
   - *Attack:* Inadmissible composition relations pass validation silently.
   - *Mitigation:* Hard checks verify failure code and specific violation messages on invalid relations.
5. **Falsifier E (Non-Deterministic Baseline):**
   - *Attack:* Reference composer produces varying graphs across executions.
   - *Mitigation:* Verified bitwise JSON equality across repeated calls for identical dataset signatures.
6. **Falsifier F (MCR7 Analytical Override Leak):**
   - *Attack:* External genome injects a forged `datasetFingerprint`.
   - *Mitigation:* `RepresentationGenomeHandoff` fails closed with status `'ABSTAIN'` and logs analytical tampering attempt.
7. **Falsifier G (Governed Researcher Adjustments):**
   - *Attack:* Researcher preferences ('SIMPLER', 'SHOW_MORE_UNCERTAINTY') fail to adjust utility ranking or lack transparent trade-off explanation.
   - *Mitigation:* `explainObjectiveTradeoffs` articulates dimension scores and alignment with requested profile.

### Falsifying Evidence
- `tests/fm7-searching-synthesizing-moneta.test.ts` (7 comprehensive tests covering all 7 falsifiers, Pareto ranking, grammar enforcement, MCR7 handoff, and TechnoCore explanations).

### Non-Goals / Dependencies
- FM7 provides bounded representation search and synthesis; it does not replace the whole investigation lifecycle (FM8 integrates full adaptive intelligence).
- FM7 does not add external server dependencies or cloud telemetry.

## 2. Post-Implementation Adversarial Review

### Diff & Production Boundary Audit
- Inspected `src/moneta/search/`, `src/atlas/AtlasCore.ts`, `src/atlas/domain/InvestigationAggregate.ts`, `docs/architecture/decisions/0010-ap-search-representation-search-and-synthesis.md`.
- Verified that analytical authority remains strictly in Rust/WASM; no JavaScript analytical fallback added.
- Verified that `RepresentationSearchEngine` operates purely over representation graphs and objective trade-offs without mutating dataset state.
- Verified that `RepresentationGenomeHandoff` blocks malicious payload injections.
- Verified ADR-0010 accepted and registered in `docs/architecture/decisions/README.md`.

### Disposition
- Disposition: PASS
- All blocker findings resolved during verification.

## 3. Verification Evidence
- `tests/fm7-searching-synthesizing-moneta.test.ts`: PASSED (7/7 tests).
- `npm run typecheck`: PASSED (0 errors).
- `npm run lint`: PASSED (0 errors).
- `npm run docs:check`: PASSED.
- `npm run audit:hygiene`: PASSED (9/9 dimensions verified).
- `npm test`: PASSED (55/55 test files, 446/446 tests).

## 4. Residual Risk
- The current System-2 search engine uses bounded mutation and recombination operators over discrete grammar productions; continuous parameter optimization can be incorporated within grammar parameter bounds in subsequent refinements.
