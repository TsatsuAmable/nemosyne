# FM6 Human-Refined Moneta / Forma Knowledge — Closure Record

Date: 3 October 2026
Base: `main@feaaf32e4dd9c043df15123629587448908b4937`
Worktree / Branch: `feat/fm6-human-refinement-forma-knowledge`
Status: VERIFIED COMPLETE

## 1. High-Risk Pre-Implementation Adversarial Contract

### Invariant
1. **Human Refinement Provenance & Testimonial Integrity:**
   `EmbodimentCritiqueV1` and `HumanMeaningJudgmentV1` records capture attributable, confirmed human testimony distinguishing perceived meaning from preference and task comprehension. Unconfirmed or automated events fail closed and are never admitted as human feedback or training supervision.
2. **Anti-Self-Labeling Invariant:**
   Passive UI adoptions, recommendation clicks, and system defaults cannot generate human preference or meaning judgments (`assertNotSelfLabeled` fails closed with `SelfLabelingForbiddenError`).
3. **Analytical & Scientific Invariance:**
   Recording human critiques, meaning judgments, or linking discovery outcomes NEVER alters underlying dataset rows, canonical dataset fingerprints, or analytical digests computed by Rust/WASM authority.
4. **Governed Knowledge Base Promotion & Contraindication Tracking:**
   Promotion of metaphor cases into the versioned Forma Knowledge Base (`FormaKnowledgeBaseV1`) requires verified evidence thresholds (minimum confirmed records, accuracy rate >= 0.75). Cases with severe misleading implications are classified as `CONTRAINDICATED` and penalized during System-1 retrieval. In Research Mode, the knowledge store freezes to guarantee bitwise reproducibility.
5. **PT9 Curated Learning Corpus & Model Registry Promotion Gates:**
   Curated learning corpora maintain strict separation between evidence categories (`PREFERENCE`, `MEANING_RECOVERY`, `DISCOVERY_OUTCOME`, `SCIENTIFIC_VALIDATION`) and enforce dataset-disjoint holdout partitioning. Promoted priors must reproducibly exceed transparent baseline accuracy on held-out test partitions while maintaining 100% known-answer pass rates and 100% abstention compliance, with explicit rollback capability.

### Authority and Production Path
1. **Human Feedback & Knowledge Base Authority:**
   - `src/moneta/forma/FormaHumanFeedback.ts`: Canonical schema and validators for `EmbodimentCritiqueRecordV1`, `HumanMeaningJudgmentRecordV1`, and `assertNotSelfLabeled`.
   - `src/moneta/forma/FormaKnowledgeBase.ts`: Versioned `FormaKnowledgeBaseV1`, `FormaMetaphorCaseV1`, and `FormaKnowledgeStore`.
2. **Curated Learning & Gated Evaluation:**
   - `src/learning/FormaCuratedLearningCorpus.ts`: PT9 curated multi-evidence dataset builder with disjoint partition policy.
   - `src/learning/FormaPriorEvaluator.ts`: Evaluates candidate priors against baseline on held-out partitions and manages gated promotion/rollback into `FitnessModelRegistry`.
3. **System-1 Proposal & Investigation Aggregate Production Path:**
   - `src/moneta/forma/FormaSystem1Proposer.ts`: Queries qualified cases and flags contraindications, respecting Research Mode frozen stores.
   - `src/atlas/domain/InvestigationAggregate.ts` and `src/atlas/AtlasCore.ts`: Expose authoritative entry points for recording critiques, meaning judgments, discovery links, and querying the Forma Knowledge Base.

### Primary Failure Modes & Falsifiers
1. **Falsifier A (Self-Labeling):**
   - *Attack:* Automated UI recommendation adoptions or passive clicks generate synthetic human meaning judgments.
   - *Mitigation:* `assertNotSelfLabeled` intercepts passive/automated sources and throws `SelfLabelingForbiddenError`.
2. **Falsifier B (Analytical Corruption):**
   - *Attack:* Recording human feedback or knowledge base cases mutates dataset fingerprints or investigation digests.
   - *Mitigation:* Verified bitwise equality between `atlas.datasetFingerprint` and `atlas.computeDigest()` before and after recording critiques and judgments.
3. **Falsifier C (Unqualified Promotion):**
   - *Attack:* A candidate prior that regresses on held-out tasks or violates abstention constraints gets promoted to active status in the Model Registry.
   - *Mitigation:* `FormaPriorEvaluator.evaluate()` checks `candidateAccuracy > baselineAccuracy`, `knownAnswerPassRate === 1.0`, and `abstentionComplianceRate === 1.0`. `promoteToRegistry()` throws if the evaluation gate failed.
4. **Falsifier D (Unconfirmed Testimony):**
   - *Attack:* Unconfirmed critiques or draft survey responses get mixed into the curated learning corpus.
   - *Mitigation:* `FormaCuratedLearningCorpusBuilder` excludes unconfirmed records and logs `UNCONFIRMED_HUMAN_TESTIMONY` issues.
5. **Falsifier E (Research Mode Drift):**
   - *Attack:* Running in Research Mode with a frozen prior version silently incorporates new live knowledge cases.
   - *Mitigation:* `FormaKnowledgeStore.freeze()` blocks mutations, and `FormaSystem1Proposer` tags proposals with `'RESEARCH_MODE_FROZEN_PRIORS'`.

### Falsifying Evidence
- `tests/fm6-human-refinement-forma-knowledge.test.ts` (6 comprehensive tests covering all 5 falsifiers, holdout gating, Model Registry rollback, and System-1 integration).

### Non-Goals / Dependencies
- FM6 does not implement open-ended combinatorial grammar search (that is FM7).
- FM6 does not introduce external cloud telemetry services or multi-tenant database servers (retains local custody and adheres to production readiness boundaries).

## 2. Post-Implementation Adversarial Review

### Diff & Production Boundary Audit
- Inspected `src/moneta/forma/FormaHumanFeedback.ts`, `FormaKnowledgeBase.ts`, `FormaSystem1Proposer.ts`, `src/learning/FormaCuratedLearningCorpus.ts`, `FormaPriorEvaluator.ts`, `src/atlas/domain/InvestigationAggregate.ts`, and `src/atlas/AtlasCore.ts`.
- Confirmed that Rust/WASM remains the sole analytical authority; no JavaScript analytical fallback was added.
- Verified that `AtlasCore` and `InvestigationAggregate` expose human refinement and discovery outcome linking without mutating analytical state or historical digests.
- Verified that `FitnessModelRegistry` handles promotion and rollback cleanly with cryptographic artifact hashing.

### Disposition
- Disposition: PASS
- All blocker findings resolved during verification.

## 3. Verification Evidence
- `tests/fm6-human-refinement-forma-knowledge.test.ts`: PASSED (6/6 tests).
- `tests/*forma*`: PASSED (all Forma tests pass).
- `npm run typecheck`: PASSED (0 errors).
- `npm run lint`: PASSED (0 errors).
- `npm run docs:check`: PASSED.
- `npm run audit:hygiene`: PASSED (9/9 dimensions verified).

## 4. Residual Risk
- System-1 prior models in FM6 are transparent linear ranking models with case-based knowledge priors; non-linear ONNX proposal models remain an optional FM5/FM7 extension subject to target-device WebGPU/WASM measurement.
