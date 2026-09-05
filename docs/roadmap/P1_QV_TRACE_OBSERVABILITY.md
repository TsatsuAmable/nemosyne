# P1-QV Trace Observability

Date: 2026-09-05
Status: planned follow-on after PR #674 privacy remediation

## Objective

Increase the explanatory power of local UX/runtime evidence without increasing raw sampling volume or weakening consent. Prefer causal, bounded, semantically named events that answer a concrete diagnostic question and can be joined to the validation session, dataset, representation decision, and user-visible outcome.

## Current assets

Nemosyne already has substantial observability machinery. The next work should connect it rather than invent a parallel telemetry stack.

- `UXTraceRecorder` records context, pinch/selection/system/wheel/gesture events and exposes `recordPerf`, `recordFriction`, and UX hand-lifecycle sinks.
- `docs/UX_INVENTORY.md` is the canonical mapping from 12 qualitative UX phenomena (UX-001..UX-012) to trace signals and thresholds.
- `scripts/analyze-ux-trace.mjs` derives selection effectiveness, pointer/gaze drift, frustration windows, ergonomics, discoverability, and the UX phenomenon scorecard from dev JSONL traces.
- `TelemetryCollector` maintains a second local opt-in observation surface with frame histograms, operations, gestures, errors, dwell/miss signals, and an owned `UXFrustrationAnalyzer`.
- `AdaptiveAssistController` already feeds selection misses/panel toggles into that frustration analyzer and reacts to the result in-product.
- `AdaptiveFrameGovernor` emits semantic `PERFORMANCE_THROTTLE` transitions.
- `UserJourneyScoreCalculator` exists but is currently a calculator/test surface rather than a production evidence producer.
- `XREvaluationEpisode` already reserves `uxTraceReference` / `investigationReference`, but trace linkage is not yet completed.

## Adversarial gaps

### O1. Production export is not directly consumable by the existing analyzer

Production `exportJson()` writes one JSON envelope with `records[]`. `scripts/analyze-ux-trace.mjs` currently reads newline-delimited individual records and groups only objects with top-level `sid` and numeric `t`. A downloaded production trace therefore does not flow directly into the canonical analyzer.

**Remediation:** teach one canonical parser to accept both dev JSONL batches/records and the exported JSON envelope, normalize to one in-memory record stream, and reject malformed/truncated input explicitly.

### O2. Causal chains stop at adjacent events

Current traces can show a pinch, selection and later state, but do not carry one stable causal identifier from user intent through gesture classification/routing, semantic target resolution, command dispatch, analytical mutation, presentation update and acknowledgement.

**Remediation:** add bounded `interactionId` spans with stages and one terminal outcome: `success`, `refused`, `no-op`, `error`, or `timeout`. Store semantic action/target identifiers and timings, not raw payload bodies.

### O3. Existing high-value trace sinks are not on the production path

`recordPerf` and `recordFriction` are exercised by tests but have no runtime producers. The UX trace `recordHands` lifecycle sink is likewise not wired to the optical hand-tracking lifecycle. Meanwhile equivalent signals already exist elsewhere (`AdaptiveFrameGovernor`, `TelemetryCollector`/`UXFrustrationAnalyzer`, gesture/input lifecycle).

**Remediation:** bridge existing authorities into the trace rather than calculate duplicate signals. Emit only semantic transitions/episodes, not per-frame duplicates.

### O4. Parallel observability vocabularies cannot be deterministically joined

`TelemetryCollector`/`UXFrustrationAnalyzer` use wall-clock `Date.now()` and action strings; `UXTraceRecorder` uses an engine-relative trace clock and typed trace records. The same user action can therefore appear in two systems without a shared event/correlation id or clock basis.

**Remediation:** introduce a small shared semantic observation envelope (`observationId`, monotonic timestamp, semantic action, target id, optional interactionId). Each consented sink may project the same observation into its own storage model. Do not merge the consent controls: telemetry and production trace remain independently gated.

### O5. Trace completeness is implicit

Sequence numbers and dropped counts exist, but there are no explicit lifecycle records telling an analyst whether silence means nothing happened, recording was disabled, the buffer truncated history, or export occurred before session end.

**Remediation:** add bounded markers: `trace-start`, `consent-enabled`, `consent-disabled`, `dataset-boundary`, `buffer-drop`, `export-requested`, `trace-end`. Include cumulative dropped count and first/last sequence in export metadata.

### O6. Export has no schema/integrity identity

The export contains `sid`, counts and records but no trace schema version or content digest.

**Remediation:** version the export envelope and include canonical-record digest, build id, validated session pair when present, first/last sequence, record/dropped counts and creation/export timestamps. This detects accidental corruption or misassociation; it is integrity metadata, not a cryptographic signer identity.

### O7. Free-text target labels reduce privacy and comparability

Some target descriptions can include dataset labels/names. They are useful while debugging one session but poor aggregation keys and can copy user-controlled or sensitive labels into trace data.

**Remediation:** prefer stable semantic target ids such as `settings.prodTrace`, `wheel.analysis.filter`, `panel.inspector`, `representation.node`; keep bounded display labels optional and apply explicit redaction policy.

### O8. Representation choice is weakly connected to downstream UX

Moneta already has decision/provenance identities, rejected alternatives and model/artifact versioning, but UX trace does not currently carry a compact representation decision envelope or link later preview/commit/revert/manual-override behavior back to that decision.

**Remediation:** log references, not duplicate analytics: decision id, dataset fingerprint/version, family/layout, requirements hash, winning score, top rejected reason codes, model/artifact version, stability result, then correlate later user disposition.

### O9. Validation protocol and observed trace are not yet one evidence graph

Quest validation has strong launcher-generated session identity, while the XR evaluation episode reserves trace references. Scenario/task boundaries are not yet first-class trace markers and exported traces are not automatically ingested into the per-session evidence directory.

**Remediation:** add governed `scenario-start`, `task-start`, `task-outcome`, `scenario-end` markers and a local ingest command that validates session identity, normalizes the trace, computes its digest, runs the analyzer, and writes derived artifacts under the existing validation session directory. No automatic network upload.

### O10. Journey-cost scoring is not measured from authoritative transitions

`UserJourneyScoreCalculator` can compute phase cost when given durations, but production does not yet derive those durations from authoritative journey/state transitions.

**Remediation:** derive phase intervals from explicit journey/interaction/state markers before using the score for research claims. Keep it diagnostic until empirical validation supports stronger interpretation.

## Recommended order

1. **O1 + O5 + O6:** make production exports analyzable, complete and integrity-checkable.
2. **O2:** causal interaction spans. This provides the largest increase in debugging power per byte logged.
3. **O3 + O4:** bridge existing performance/friction/hand authorities into one correlated semantic observation stream while preserving separate consent.
4. **O8:** connect Moneta decisions to user acceptance/reversal and runtime cost.
5. **O9:** close the Quest evidence loop with scenario markers and local automated ingestion.
6. **O7 + O10:** harden privacy vocabulary and derive journey-cost evidence from authoritative transitions.

## Gate discipline

Each tranche must falsify: disabled-state non-observation, consent withdrawal, bounded memory, schema backward compatibility, deterministic correlation, malformed-input rejection, no unintended network transport, and exact validation-session attribution. New metrics must map to a documented diagnostic question or UX inventory phenomenon; otherwise they do not belong in the trace.
