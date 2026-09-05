# UX trace observability improvements after PR #674

Date: 2026-09-05

This note captures candidate logging improvements that increase explanatory power without turning the product into a telemetry firehose. They are not part of the privacy remediation contract and should be implemented in separately reviewable tranches.

## Principle

Prefer causal, bounded, semantically named events over more frequent raw sampling. Every added record should answer a concrete diagnostic question and carry enough correlation to join with the validation session, dataset, representation decision, and user-visible outcome.

## Priority 1: interaction outcome spans

Add a short-lived interaction span keyed by an `interactionId` from intent through routing, target resolution, command dispatch, state mutation, presentation update, and visible acknowledgement. Record compact timestamps and terminal outcome (`success`, `refused`, `no-op`, `error`, `timeout`).

Questions answered:
- Did the user gesture fail to classify, fail to route, hit the wrong target, dispatch correctly but mutate nothing, or mutate state without visible feedback?
- Where is perceived latency introduced?

Do not record raw payload bodies by default. Record semantic action names, target class/identity, timing, and outcome.

## Priority 2: state-transition breadcrumbs

Emit bounded records when major analyst-visible states change: dataset load start/ready/fail, representation decision/preview/commit/revert, investigation phase, panel visibility/focus, input mode, tracking availability, kernel readiness/degradation, collaboration state, and validation gate state.

Each breadcrumb should include `from`, `to`, `reason`, and the authority that caused the transition. This makes traces reconstructable without requiring per-frame state snapshots.

## Priority 3: friction episodes, not isolated symptoms

Wire the existing `recordFriction` sink to a deterministic detector that groups repeated misses, repeated undo/retry, oscillating menu open/close, repeated gesture rejection, long dwell without progress, and action→reversal loops into bounded episodes. Emit start/end, trigger counts, duration, and recovery outcome.

Keep thresholds governed and testable. Do not infer emotion or psychological state.

## Priority 4: performance-to-UX correlation

Wire `recordPerf` to meaningful budget transitions rather than every frame. Correlate frame-time/degradation events with the current interaction span, representation family/layout, rendered element count, panel count, input mode, and recovery action such as LOD reduction.

This distinguishes an interaction design failure from an interaction that was correct but visibly late because the runtime was overloaded.

## Priority 5: representation-explanation logging

At each Moneta representation decision, log a compact decision envelope: decision id, dataset fingerprint/version, representation family/layout, requirements hash, winning score, top rejected alternatives with reason codes, model/artifact version, stability result, and whether the user later previewed, committed, reverted, or manually overrode it.

Do not duplicate full analytical results. Correlate to their existing provenance IDs/hashes.

## Priority 6: evidence completeness markers

Add explicit trace lifecycle markers such as `trace-start`, `consent-enabled`, `consent-disabled`, `dataset-boundary`, `buffer-drop`, `export-requested`, and `trace-end`. Include monotonically increasing sequence numbers and cumulative dropped-count snapshots.

These markers make absence distinguishable from silence and make truncated exports obvious.

## Priority 7: export integrity envelope

Wrap user-exported trace JSON in a small versioned envelope containing schema version, trace sid, validation-session pair when valid, build id, first/last sequence, record count, dropped count, creation/export timestamps, and a digest of the canonical record array. This is integrity metadata, not a signature, but it makes accidental corruption and misassociation detectable.

## Priority 8: privacy-aware target vocabulary

Replace ad-hoc free-text labels where practical with stable semantic target identifiers (`settings.prodTrace`, `wheel.analysis.filter`, `representation.node`, etc.) plus optional bounded display labels. This improves aggregation and reduces accidental inclusion of sensitive dataset values in UI target strings.

## Priority 9: trace health diagnostics

Expose a tiny local diagnostics snapshot: recorder enabled state, endpoint policy, buffered count, dropped count, last sequence, last event time, and schema version. This should be readable by validation tooling but should not itself generate noisy trace traffic.

## Priority 10: governed scenario markers

Allow Quest validation scripts to emit explicit scenario/step markers into the same trace (`scenario-start`, `task-start`, `task-pass/fail`, `scenario-end`) using the validated session identity. This gives device evidence a deterministic join between the scripted protocol and observed UX/runtime behavior.

## Suggested implementation order

1. Interaction outcome spans + lifecycle/completeness markers.
2. Performance budget transitions + friction episodes.
3. Representation decision envelopes.
4. Export integrity envelope + stable semantic target vocabulary.
5. Governed Quest scenario markers and automated trace/evidence ingestion.

Each tranche should add falsifiers for disabled-state privacy, bounded memory, schema compatibility, deterministic correlation, and no unintended network transport before promotion.
