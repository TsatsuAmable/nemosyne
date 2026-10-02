# CMS-6 — multimodal perception contract audit

**Date:** 2 October 2026
**Base:** `main@87502f7d` (#890, CMS-2 FlatBuffers retirement merge), branch `review/cms6-perception-contract-audit`
**Mode:** READ-ONLY ANALYSIS + docs deliverable only. No production code, test, or config file was modified. `docs/ROADMAP.md` left untouched.
**Sprint (verbatim, `docs/ROADMAP.md` "Claude parallel maintenance sprints"):** "Audit `MultimodalPerceptionEngine` heuristic confidence/action semantics against NIL and the System-1/System-2 architecture. Extract candidate typed cue contracts and falsifiers; do not describe heuristic scores as calibrated confidence and do not make the prototype production authority."
**Exit criterion (verbatim):** "Bounded REVISE/ARCHIVE proposal with explicit cue contract, authority boundary and evidence needed before implementation."

## Verdict

**ARCHIVE for `MultimodalPerceptionEngine` (delete the engine and its semantics in a future cleanup package); REVISE-shaped cue contracts below are candidates for a future FM5-S1B surface, not for this code. ARCHIVE for `GeometricGestureRecognizer` unless a trajectory-gesture experiment is explicitly commissioned.**

On the evidence observed: the engine is dormant and production-unreachable (§3), every one of its heuristic outputs carries naming or semantics the architecture forbids (§4), the production interaction path it would complement already exists and needs nothing from it (§3.4), and a governed lane (`modules/gesture-intelligence`) already implements the honest patterns the engine only names (§4.8). Rewriting it into typed cue contracts now would be speculative implementation with no consumer; the prototype must not be promoted. The only patterns worth carrying forward are named in §5/§6 and must be re-homed into the future System-1 artifact contract, not preserved via this file.

## 1. Method (and its limits)

1. **Read in full:** `src/vr/perception/MultimodalPerceptionEnvelope.ts`, `src/vr/perception/GeometricGestureRecognizer.ts`, `src/vr/perception/PerceptualFitnessSampler.ts` and `src/vr/perception/index.ts` (scope boundary, §3.5); `tests/multimodal-perception-envelope.test.ts`; the gesture recognizer block of `tests/sprint-27-4-resilience-and-gestures.test.ts`; `governance/production-capabilities.json` entries touching `src/vr/perception`; `tests/production-capability-registry.test.ts` and `tests/hygiene-audit.test.ts` (both are registry/barrel guardians).
2. **Reachability check:** grep of `MultimodalPerceptionEngine` / `GeometricGestureRecognizer` / the `vr/perception` barrel across `src/`, `tests/`, `scripts/` and the production entry roots (`src/main.ts`, `src/app/bootstrap.ts`, `index.html`). Spot-verified, not a full bundler graph like CMS-7's — but the two classes have so few total references (three test files, one registry entry, one barrel) that the residual doubt is negligible; every claim is named and checkable.
3. **Architecture vocabulary read:** `docs/architecture/MONETA_SYSTEM1_SYSTEM2_ONNX_ARCHITECTURE.md` (read in full — it is the governing System-1/System-2 decision record), NIL (`src/interaction/nil/NemosyneInteractionLanguage.ts`, `src/interaction/nil/NilExecutor.ts`, the Finding type at `src/atlas/types.ts:178-187`), and the Moneta/MA2 calibration vocabulary (`docs/audits/TEC3_MA2_CONTROL_HARNESS_2026-10-02.md` governing rule and dispositions summary).
4. **Census context:** `docs/review-plans/CMS7_LEGACY_TEST_RENT_CENSUS_2026-10-02.md` §S10 (read on its branch `census/cms7-legacy-test-rent`@`454705ef`, not yet merged to main).
5. **Limits:** no runtime experiments were performed (all findings are direct code reads); no test was executed; line numbers drift only.

## 2. Sprint definition audit — what this surface is

`MultimodalPerceptionEngine` ("Definitive Vision §11" header comment) accepts caller-supplied gaze/gesture/voice candidates and produces a `MultimodalPerceptionSnapshot` containing a fused numeric `confidence`, a `source` label, and a string `resolvedAction`. It contains no input extraction, no measurement, and no calibration machinery: every numeric "confidence" it touches is a caller-supplied float or a constant. `GeometricGestureRecognizer` is a separate, self-contained $3D-style trajectory matcher: normalize → nearest template by path distance → `score`.

Both live under `src/vr/perception/` in one directory with `PerceptualFitnessSampler`, which is **not** the audit target and must not be confused with it (§3.5).

## 3. Reachability and authority evidence (the "production authority" question)

### 3.1 Zero production importers

- `MultimodalPerceptionEngine` appears in exactly three files outside its own module and the barrel: `tests/multimodal-perception-envelope.test.ts` (direct import), `tests/production-capability-registry.test.ts` (as a *forbidden* string; §3.3), and the registry JSON. No `src/**` file other than `src/vr/perception/index.ts` imports it or the barrel.
- `GeometricGestureRecognizer` has exactly one non-module usage: `tests/sprint-27-4-resilience-and-gestures.test.ts:4` (via the barrel). No `src/**` file imports it.
- Production entry roots are clean: `src/main.ts`, `src/app/bootstrap.ts`, `src/app/index.ts` and `index.html` contain no perception references.

### 3.2 Registry position

`governance/production-capabilities.json` (entry `multimodal-perception-engine`, lines 169-174): `classification: "development-only"`, `"reason": "Dormant experimental perception model awaiting an evidence-backed product integration."` Neither file appears in any production capability's `sources`. There is no `forbiddenPublicExports` rule for the `vr/perception` barrel (unlike e.g. `legacy-collaborative-state-sync`) — the barrel re-exports both classes, and only the barrel-existence guardian (`tests/hygiene-audit.test.ts`, subsystems list) keeps the barrel alive. **Gap (bounded):** the dev-only protection is weaker here than for sibling dev-only entries — nothing currently forbids `src/vr/index`-level or any other barrel from re-exporting `MultimodalPerceptionEngine`. Observed only; no change proposed in this sprint.

### 3.3 A test exists specifically to keep the prototype out of invariants

`tests/production-capability-registry.test.ts:311-316` ("does not use barrel availability as evidence that dormant research systems are production-working") asserts `tests/architectural-invariants.test.ts` does **not** contain `MultimodalPerceptionEngine`. The repo's own governance already treats the engine as a research fixture that must not appear in architectural-invariant surface. CMS-7 §S10's `RESEARCH_FIXTURE pending CMS-6` classification of its tests is consistent with this.

### 3.4 The production interaction path already exists and does not use this engine

- **Gestures:** the production recognizers are `src/vr/interactions/HandGestureRecognizer.ts` (consumed by `src/vr/coordinators/WorldInputCoordinator.ts:71`) — deterministic pose-pattern → named gesture, with cooldowns and *no confidence field at all* — and the `@nemosyne/gesture-intelligence` engine via `src/vr/input/GestureIntelligenceAdapter.ts`. Gesture events ride `WorldTopics.GESTURE_RECOGNIZED` (`src/utils/EventBus.ts:27,60`), not the perception engine's snapshot. The governed gesture-learning lane consumes gesture-intelligence *contracts* only, and MA2's P-5 promotion gate explicitly records "features/confidence/card-metrics non-use" (`docs/audits/TEC3_MA2_CONTROL_HARNESS_2026-10-02.md` §Covered-by-slice-3, P-5).
- **NIL:** perception reaching NIL is an architectural boundary, stated in `docs/architecture/MONETA_SYSTEM1_SYSTEM2_ONNX_ARCHITECTURE.md` §1.3 ("Perception does not directly emit NIL commands") and in `src/interaction/NilExecutor.ts` lines 38-39 ("Perception layers may create commands, but only semantic handlers registered here perform domain operations"). The engine builds commands for nobody: nothing consumes `resolvedAction`.

**Finding (STOP-grade check, resolved):** the prototype is *not* reachable from production and its heuristic scores do *not* feed any decision path. Nothing here stops the audit; no live consumer needs refusal.

### 3.5 Same-directory counter-case (scope exclusion, stated explicitly)

`src/vr/perception/PerceptualFitnessSampler.ts` **is** production-reachable (`src/app/{cluster,density,distribution,graph}EvidenceDiagnostics.ts` import it) and is a *different, governed* surface: its outputs are Moneta `PerceptualFitnessEvidence` with metric-fidelity classes (`'estimated'`/`'surrogate'` and per-metric `method` strings), pinned by `tests/perceptual-fitness.test.ts` and MA2 §8b (F-7). It is the model of what "honest uncertainty metadata" looks like in this repository. CMS-7 §S10 names only the two prototype files as CMS-6's target; this boundary was verified and respected.

## 4. Naming and semantics audit — where heuristic scores overstate themselves

### 4.1 `confidence` on caller-supplied claims (fail: vocabulary)

`GazeCandidate.confidence` (:22), `GestureCandidate.confidence` (:28), `VoiceIntentCandidate.confidence` (:36) and `MultimodalPerceptionSnapshot.confidence` (:45) are generic float fields. The governing System-1 contract says the opposite: "`confidence` must not be used as a generic label for an arbitrary score" (`MONETA_SYSTEM1_SYSTEM2_ONNX_ARCHITECTURE.md` §3). Nothing validates range: the unimodal branches copy the raw input straight through (`evaluateSnapshot` :135, :139, :143 — `overallConfidence = this._latestVoice!.confidence` etc.), so a caller-supplied 42 becomes snapshot `confidence: 42`. The engine fabricates no evidence; it *relabels and fuses* supplied floats under a governed-sounding name.

### 4.2 Fusion bonus (fail: arithmetic semantics)

Hybrid branches add `+ 0.1` to the mean of two constituent confidences (:127, :131): `min(1, (voice + gaze)/2 + 0.1)`. A fused claim is thereby *always higher* than at least one of its inputs — disagreement between modalities, the informative case, is arithmetically rewarded. The constant is unjustified and unmarked in code. This is the exact pattern MA2 exists to catch: an unmeasured constant doing decision work on an uncalibrated scale.

### 4.3 Hand-set modality thresholds (fail: no controls)

`hasGaze > 0.4`, `hasGesture > 0.5`, `hasVoice > 0.6` (:117-119) — three different hand-set constants, no dwell-duration gating (the only genuinely measured field, `dwellDurationMs`, is stored and never read), and no positive/negative controls anywhere in the repo. Per the MA2 governing rule ("metric presence is not metric admissibility"; `docs/audits/TEC3_MA2_CONTROL_HARNESS_2026-10-02.md` header), these are all `NOT_CALIBRATABLE_FOR_DECISION` today. Naming them "confidence" thresholds presents a calibration that does not exist.

### 4.4 Fallback/abstention is nearly dead, and the default state fabricates a mid-confidence snapshot (fail: failure semantics)

- `fallbackReason: 'low_signal_confidence'` fires only when `overallConfidence < 0.5` (:154). Reachability arithmetic from the thresholds (§4.3): voice-only (>0.6) and gesture-only (>0.5) can never fall below 0.5; hybrid branches are even higher. The fallback is reachable **only** for gaze-only signals in the band (0.4, 0.5].
- The empty state — no gaze, gesture or voice at all — returns `source: 'CONTROLLER'`, `confidence: 0.5` (constant, :122), and **no** fallback reason, i.e. a fabricated mid-confidence "no-opinion" snapshot that is indistinguishable in kind from a real snapshot. This contradicts the architecture's failure rule "ABSTAIN/fallback, never fabricated certainty" (§12, trade-offs table). The engine observes "nothing" and calls it 0.5.
- Only two tests exercise the engine and none covers the low-fallback or empty branches (4 tests total; the empty state is untouched, so this degeneracy is unpinned and unobserved by CI).

### 4.5 `personalizationState: 'calibrated'` — the word "calibrated" as a bare label (fail: this is the sharpest vocabulary violation)

`personalizationState` is `'default' | 'calibrated' | 'adapted'` (:45, :57), settable by any caller (::setPersonalizationState, :96-101) and echoed into every snapshot. Setting `'calibrated'` changes **no behavior**: no threshold moves, no score is recomputed, no record of any calibration exists. In this repository's established vocabulary, "calibrated" means demonstrated positive/negative control separation with a recorded disposition — and until then the mandated word is `NOT_CALIBRATABLE_FOR_DECISION` (MA2 governing rule; MA3 exists precisely because no such record surface exists yet). A prototype whose state machine carries a decorative `'calibrated'` enum value teaches the codebase that calibration is a flag you can set. Similarly, `tests/multimodal-perception-envelope.test.ts:10` constructs the engine with `personalizationState: 'calibrated'` and asserts it round-trips — the test *reinforces* the false vocabulary. (`modules/gesture-intelligence/src/calibration.ts` shows the real thing: named thresholds, derived read-time values, pinned constants — calibration as measured state, not a label.)

### 4.6 `resolvedAction` — a hidden second command vocabulary (fail: boundary)

`resolvedAction` is synthesized by string interpolation: `'filter_outliers:cluster-7'` (:128), `'pinch_select:node-104'` (:132), the intent or gesture name alone (:136, :140), `'focus:<id>'` (:144). Observed problems:
- None of `filter_outliers`, `pinch_select` is a `NilVerb` (`src/interaction/nil/NemosyneInteractionLanguage.ts:11-31`: `FOCUS … CHANGE_SCALE …`). The synthesized vocabulary is not NIL-compatible even if someone routed it.
- Nothing routes it: no consumer exists, so Perception synthesizes domain action strings that would, if ever wired, bypass the deterministic resolver + `InteractionIntent` + NIL boundary the architecture mandates (§1.3, §4.4 "emits typed `InteractionCue` values, never string actions").
- The string format (`intent:entity`) conflates verb and target in one untyped field — the exact anti-pattern the architecture names ("a hidden second command system", §4.4).

The architecture document flagged this precisely on `2026-09-29` (§2.1: "its fixed confidence thresholds and string `resolvedAction` synthesis are laboratory-only and are not an acceptable production semantic boundary") and scheduled it (§13 FM5-S1B: "replace `MultimodalPerceptionEngine` string-action semantics with typed cue contracts **or archive it**"). This audit confirms that judgment on the current build.

### 4.7 `GeometricGestureRecognizer` — honest output, overstated name, and an observed purity violation

- The returned `score` is honest (`// 0 (no match) to 1 (perfect match)`, :21) — a normalized nearest-template path distance. The **parameter** `minConfidence = 0.65` (:49) overstates it: a geometric distance margin has produced no calibration and the return type even calls the same thing `score`. Rename to `minMatchScore` if the surface survives.
- The default `0.65` is hand-set with no fixture evidence; the single suite asserts only two well-separated templates above 0.7.
- **Purity finding (observed):** `_resample` mutates the caller's array (`points.splice(i, 0, q)`, :111) — `recognize()` and `addTemplate()` (via `_normalizePoints`) are not side-effect-free on their input. `GestureMatchResult` is otherwise derived deterministically, but the surface violates the repository's own module rule elsewhere stated ("`updateCalibration` never mutates its input", `modules/gesture-intelligence/src/calibration.ts`). Any future use must fix this contract first.
- Normalization is scale-invariant (`_scaleToUnitBox`, :144-167): a 3-centimeter micro-movement and a full-arm swipe are the same shape. That is a *declared semantics decision* (shape matching), currently undeclared — plausible for deliberate gestures, hazardous for incidental motion rejection.

### 4.8 Contrast: the governed lane already exists in-repo

`modules/gesture-intelligence/src/contracts.ts` (module rule, :12-15): "`confidence` is always derived from measured quantities, never a hardcoded constant", with `Provenance` reporting the path that actually produced the numbers (`source: 'onnx' | 'heuristic'`, `degradedReason`), and `calibration.ts` implementing derived-threshold adaptation with pinned constants. MA2 additionally established the naming precedent `periodicityHeuristicScore` (TEC2 rename, MA2 §9b): this repository's convention is **`HeuristicScore`/`HeuristicStrength` vocabularies with explicit provenance**, not `confidence`. The prototype's vocabulary post-dates nothing and pre-dates what this contract requires — it simply is not governed.

## 5. Candidate typed cue contracts (extraction, not implementation)

The engine maps three input modalities through hand-set thresholds to a fused name and a string action. Extracted as the candidate contracts the *future* System-1 surface (FM5-S1B) would have to satisfy, with the evidence needed before any of them could ever be implemented. Shape follows `MONETA_SYSTEM1_SYSTEM2_ONNX_ARCHITECTURE.md` §3/§4.4 and MA2's vocabulary.

**Common result shape (replaces every `confidence` float):**

```
CueResult  = { cueId, scoreSource: 'deterministic'|'learned'|'provider',
               rawScore (never named 'confidence'), scoreRegime, provenance,
               observationTimestampMs + observationAge, featureSchemaVersion,
               abstainReason?, NOT_CALIBRATABLE_FOR_DECISION? (until MA3-style
               control separation exists and is recorded) }
```

| # | Candidate cue | Signal → heuristic → today's output | Candidate typed contract | Falsifier that would pin it | Authority allowed to consume | Evidence needed before implementation |
|---|---|---|---|---|---|---|
| C1 | **Gaze target candidate** (deterministic) | caller gaze ray + `dwellDurationMs` (stored, never read) → threshold 0.4 → `resolvedAction: 'focus:<id>'`, `confidence` passthrough | `GazeTargetCue { targetCandidates: [{entityId, dwellMs, ray}], abstain? }` — dwell is the measured quantity; target selection is a runtime/geometric resolver job (§2.2 "Advisory targeting") | Dwell-threshold boundary pair: target acquired below/at/above the dwell threshold on synthetic gaze traces (false-activation negative: incidental fixations); the resolved target must be invariant to ray noise within declared bounds | Deterministic interaction resolver only → `InteractionIntent` → NIL `FOCUS`; never analysis truth | Dwell false-activation rate on recorded traces; agreement with the production pointer/router path (`src/vr/InputRouter.ts` family) where both resolve the same target |
| C2 | **Trajectory gesture template match** ($3D) | caller point sequence → nearest-template path distance → `templateName + score`, gate `minConfidence 0.65` | `GestureTemplateMatchCue { templateName, matchScore, inputFrameCount, scaleInvariance: 'declared', purity: 'no caller-array mutation' }` | Negative controls: scale-matched non-gesture noise and reversed-direction trajectory must score below gate; positive must clear it at each declared invariance class; purity falsifier: caller input array unchanged (deep-equal before/after) | Experimental/advisory only (§2.2 "Named symbolic gesture vocabulary: Experimental only"); must never feed NIL directly | Recorded separation D between positives and the noise/reversal negatives, per template, plus the incidental-motion negative class |
| C3 | **Voice intent candidate** (provider) | caller-supplied `{intent, transcript, parameters, confidence}` → threshold 0.6 → intent string becomes action stem | `VoiceIntentCue { intent, transcriptExcerpt?, parameters, providerScore, provider, provenance }` — renamed from `confidence` to `providerScore`: it is the provider's own claim, not ours | Metamorphic: identical transcript under score perturbation must not change the *typed* intent; a nonsense transcript must abstain, not select the nearest intent | Deterministic resolver; provider text is "Advisory until NIL" (§2.2); transcript provenance is privacy-scoped (§11) | Provider-declared score semantics (what the provider's number means, and that it is stable); privacy/consent boundary for transcripts recorded per §11 |
| C4 | **Multimodal co-occurrence arbitration** | two modality branches true → `HYBRID_MULTIMODAL`, mean + 0.1 bonus → fused `confidence` | `MultimodalArbitrationCue { fusedProposal: InteractionIntentProposal?, arbitrationRule: versioned, modalityCues: [C1|C2|C3 …], disagreement? }` — no additive bonus; disagreement between modalities is surfaced, never scored into a higher number | Negative control: mutually inconsistent single-modality noise must not fuse into any proposal (today's +0.1 guarantees the opposite); arbitration output must be reproducible from identical cue inputs (determinism) | Deterministic resolver → `InteractionIntent` → NIL only; System-1 may alter search/priority, never admissibility (§6) | An agreed arbitration rule spec with its own positive/negative control pairs; absence of any calibrated fused score until MA3 |
| C5 | **Perception provenance/freeze metadata** | `modelVersion`/`featureSchema`/`isFrozen`/`personalizationState` | Retain this part of the prototype's design — it is the piece the architecture doc credits (§2.1 "demonstrates freezeable perception metadata") — as the future artifact/treatment metadata block, with `'calibrated'` **removed** from the enum until a calibration record (MA3-class) can back it | Freeze falsifier (already exists, honest): frozen state forbids personalization mutation; extend it: a snapshot recorded under a frozen treatment is byte-reproducible under replay | Study/research treatment harness; provenance consumers | A MA3 calibration-record surface that is the only writer of the word "calibrated" |

**Explicitly not a candidate:** the `+0.1` fusion bonus, the raw-float `confidence` passthrough, and the `personalizationState: 'calibrated'` label have no typed-contract future — they are the failure modes this audit found, listed for deletion, not revision.

## 6. Authority boundary (explicit)

1. **Heuristic scores are not calibrated confidence.** Every number on this surface is a heuristic score on an uncalibrated scale. Per the MA2 governing rule, a decision-bearing metric is admissible only with recorded positive/negative control separation on its own decision scale, plus family-specific diagnostics — and the disposition is otherwise `NOT_CALIBRATABLE_FOR_DECISION`. No such control exists for any field on either prototype class.
2. **No cue may name, carry, or imply the word "calibrated"** except a future MA3-class calibration-record authority that actually writes it.
3. **Consumers:** candidate cues C1-C4 may be consumed only by (a) the deterministic interaction resolver producing `InteractionIntent` for the `NilExecutor` boundary, or (b) System-2 Moneta as advisory/priority input it can "ignore, challenge, reproduce and replace" (§1.4). No cue may reach: NIL directly (no "Perception emits NIL"), evidence admission or representation authority (System-2 owns that; §6), or any analytics-producing path (`NilExecutor` doc boundary, :38-39).
4. **Freeze semantics are a research-treatment concern only** (C5) and confer no additional authority on the frozen scores.
5. **No promotion path exists.** The registry entry is `development-only` and stays so; FM5-S1B is the only sanctioned route to a production perception surface, and it replaces this code rather than promoting it.

## 7. Bounded REVISE/ARCHIVE proposal

**ENGINE (`src/vr/perception/MultimodalPerceptionEnvelope.ts`) — ARCHIVE.** Delete in a future cleanup package: the engine class, the 4-test `tests/multimodal-perception-envelope.test.ts` fixture (CMS-7 §S10: RESEARCH_FIXTURE, 4 `its`, integration lane), and the `multimodal-perception-engine` registry entry. This mirrors the CMS-2 precedent, where the code, entry and tests went out together once reachability was proven non-production. Nothing in production would change (zero importers, §3.1).

**Revise-instead-of-archive would be justified only if:** the FM5-S1B lane is commissioned *and* the cue contracts in §5 acquire their named control evidence. Until then, rewriting the file would be speculative implementation on a dormant surface — the exact "laboratory-only" boundary the architecture doc already drew. No revision PR is proposed by this sprint.

**What must be re-homed before deletion (carried, not lost):** the freezeable-treatment metadata pattern (modelVersion/featureSchema/freeze/fallbackReason — C5), which the System-1 artifact contract (§3 of the architecture doc) must absorb when FM5-S1B is implemented. Also add, at cleanup time, the barrel forbid-list entry for `MultimodalPerceptionEngine`/`GestureCandidate`-family symbols that the dev-only sibling entries already carry (the protection gap, §3.2) — cheap, boundary-only, in the deleting PR's remit.

**RECOGNIZER (`src/vr/perception/GeometricGestureRecognizer.ts`) — ARCHIVE** unless a trajectory-gesture experiment is explicitly commissioned; if commissioned first, the entry conditions are: fix the caller-array mutation (§4.7), rename `minConfidence` → `minMatchScore`, declare the scale-invariance semantics, and record the C2 falsifier separation. Its 1 test (`tests/sprint-27-4-resilience-and-gestures.test.ts` "GeometricGestureRecognizer" block; the file's other two `its` are resilience tests, not perception) retires with the surface; the remaining tests keep their class.

**Vocabulary debt (docs-only, no code):** the phrase "calibrated" as a decorative enum value is the one item with teaching potential across the codebase. This audit's disposition is that the word stays out of the prototype — if the surface survives anything, it survives C5 without the word.

## 8. Test reconciliation (feeds CMS-7's RESEARCH_FIXTURE entries)

| Test file | Census §S10 class | Disposition under this verdict |
|---|---|---|
| `tests/multimodal-perception-envelope.test.ts` (4, integration lane) | RESEARCH_FIXTURE pending CMS-6 | Retires with the ARCHIVE package, surface and registry entry together (CMS-2 pattern). No replacement invariant needed: `tests/production-capability-registry.test.ts:311-316` already pins the engine out of invariants, and `tests/hygiene-audit.test.ts` barrel-list entry drops with the barrel's perception section being re-pointed at `PerceptualFitnessSampler`-only content. |
| `tests/sprint-27-4-resilience-and-gestures.test.ts` (3; 1 gesture block) | mixed; gesture part RESEARCH_FIXTURE pending CMS-6 | Gesture block retires with the recognizer; resilience blocks keep their class. |

## 9. Verification (this host)

- `npm run docs:check` → **PASSED** ("DOCUMENTATION INTEGRITY PASSED"), re-run after writing this file.
- No production code, test or config file touched; `docs/ROADMAP.md` untouched. Deliverable: this file only.
- Evidence trail: every file:line citation above read at base `87502f7d` on branch `review/cms6-perception-contract-audit`; census §S10 read on `origin/census/cms7-legacy-test-rent`@`454705ef` (branch not yet in main).