# QCA0 L1 Quest Scale-Knee Baseline

**Status:** Approved design, pre-implementation  
**Date:** 4 October 2026  
**Integration target:** `main@baf80d80676867a952f43d0db2060743f7e1837e`  
**Canonical roadmap:** `docs/ROADMAP.md`  
**Programme:** `docs/work/quest-compute/README.md`

## 1. Purpose

QCA0 needs a small physical-Quest experiment that identifies where the current
production WebXR path stops meeting its frame budget before QCA2 or QCA4 changes
are attempted. It is a diagnostic baseline, not a qualification of Full Moneta
Forma and not a substitute for the later multi-family semantic-embodiment suite.

The experiment must answer three bounded questions:

1. At what source/rendered cardinality does the row-addressable production path
   cross the Quest frame budget?
2. How does end-to-end production load duration scale across that knee?
3. Do scene workload, frame time and the adaptive governor change together in a
   way that justifies a controlled QCA4 rendering experiment?

## 2. Evidence already available

The exact-head physical run `PERF04-1349202-20261004T113227` is retained as the
100k row-addressable control. It was captured on an ADB-identified Quest 3S from
clean build `1349202e3f917136c9b5f8b4c3af6198934ca996`, with active WebXR and a
completed, non-aborted `uxr0-functional-5m` profile.

QV4 correctly adjudicated PERF-04 `FAIL` and PERF-05 `PARTIAL`. The measured
100k step recorded a 113.0-second production load, 117.0 ms application-frame
p50, 177.0 ms p95, 220.5 ms p99, 100% dropped-frame classification, about 2.45M
average triangles, about 109 average draw calls, 100,000 rendered nodes and an
LOD scale fixed at 0.4 without a reduction in rendered cardinality. The custody
bundle digest is
`b12858bbb995e720ffaf67d558f752259cf81a79d55762d98ffa45c22febff3b`.

That run is valid evidence for the current row-addressable fallback. Its null
candidate identity and null semantic-embodiment status mean it must not be cited
as a performance result for Moneta Forma semantic summaries.

## 3. Scope

In scope:

- a short governed Quest 3S scale-knee profile;
- the existing real `World.loadDataset` and representation production path;
- truthful completion timing for each dataset load;
- frame, cadence, scene workload, memory and governor aggregates;
- exact source and rendered cardinality at every measured step;
- custody-sealed, exact-head physical evidence;
- a ranked evidence handoff to QCA2 and QCA4.

Out of scope:

- Full Moneta Forma or multi-family semantic-embodiment qualification;
- PERF-04 or PERF-05 promotion;
- the 250k stretch workload;
- thirty- or sixty-minute thermal/resource qualification;
- implementing a rendering, Worker, WASM or SIMD optimization;
- treating correlation as CPU/GPU/component attribution.

## 4. High-risk pre-implementation adversarial contract

**Invariant:** every recorded step must describe the real adopted production
representation for the declared cardinality on the exact Quest/build, and the
profile must fail closed rather than measuring a superseded, incomplete,
non-XR, misidentified or differently represented scene.

**Authority and production path:** Rust/WASM and Atlas retain analytical and
dataset identity authority. `World.loadDataset` remains the production entry
point. `LoadTestDriver` owns only experiment sequencing and bounded aggregates.
The validation launcher/sink owns device/build attribution and custody. No QCA
code may create a second analytical or representation authority.

**Primary failure modes:** a promise dispatch is timed instead of completed
representation construction; a later dataset load supersedes the active step;
Worker-local residency loss globally invalidates an independent runtime; the
profile silently runs without active XR or Quest 3S attribution; warmup is
graded; the adaptive governor changes visual scale but not cardinality and is
misreported as effective; the test is mislabeled as Forma evidence; a partial
or aborted run emits a recommendation; remote-main reconciliation drops the
load-completion or fail-closed fixes already proven on the control run.

**Falsifying evidence:** state-machine tests for asynchronous completion,
rejection, supersession, stop and late completion; manifest/profile tests;
production `World` integration; real Worker/WASM residency recovery; exact
candidate/coverage assertions; custody tests; and one exact-head physical Quest
run whose evidence contains every graded step.

**Non-goals/dependencies:** the tranche does not select or implement the QCA2 or
QCA4 intervention. It depends on reconciling current `main` without losing the
five QCA0 integrity commits that produced the sealed control. The later Forma
suite remains separate L3 evidence.

## 5. Chosen experiment

Add a named profile `qca0-row-addressable-knee-v1` with declared device target
`META_QUEST_3S` and these steps:

| Step | Rows | Measurement | Role |
| --- | ---: | ---: | --- |
| cold-start warmup | 1,000 | 10 s | explicitly ungraded |
| 1k baseline | 1,000 | 15 s | graded |
| 8k | 8,000 | 15 s | graded |
| 32k | 32,000 | 15 s | graded |
| 65k | 65,000 | 15 s | graded |
| 100k | 100,000 | 30 s | graded control anchor |

Each step receives a five-second settle period after the production load has
actually completed. The total measured window is 90 seconds; load and settle
time are additional and intentionally observable. No 250k step is included.

The profile is deliberately named `row-addressable`. A completed step must
record `coverageMode: ROW_ADDRESSABLE`, the declared source-row count and the
actual rendered-node count. A semantic candidate, semantic summary or other
coverage mode is not silently accepted into this comparison; the run becomes
invalid for this profile and must be rerun under an appropriately named lane.

## 6. Governed lane and evidence semantics

Add a QCA-specific governed validation mode rather than overloading the UXR
qualification profiles. The mode has no PERF-04/PERF-05 promotion authority.
It reuses the existing ADB attribution, exact-build manifest, deliberate
on-device ARM/CONFIRM path, evidence sink, hashing and custody bundle.

The QCA analysis distinguishes capture validity from performance outcome:

- `VALID_CAPTURE`: exact identity and profile, active XR, all graded steps
  completed, expected row-addressable coverage and custody finalized;
- `INVALID_RUN`: identity/profile mismatch, non-XR capture, missing step,
  candidate/coverage mismatch, supersession, abort, load failure or custody
  failure.

Green/yellow/red step grades are observations within a valid capture. A red
performance result does not invalidate QCA0; it identifies the knee. QCA0 does
not mint a product-promotion PASS.

## 7. Production data flow

```text
governed Quest launcher
  -> exact build + ADB Quest 3S manifest
    -> on-device Device Validation ARM / CONFIRM
      -> LoadTestDriver(qca0-row-addressable-knee-v1)
        -> deterministic stress Dataset
          -> World.loadDataset
            -> Atlas / Moneta / RepresentationSurface production path
              -> adopted row-addressable representation
                -> settle
                  -> bounded frame/scene/memory/governor aggregates
                    -> evidence sink
                      -> QCA validity analysis + custody bundle
```

The driver starts settling only after the `World.loadDataset` completion
boundary resolves and `world.currentEntry` is exactly the entry it requested.
During settling and measuring, replacement of that entry aborts and invalidates
the run. Stop/dispose fences late completion by generation.

## 8. Metrics and interpretation

Every graded step records:

- source row count and rendered node count;
- representation coverage mode, geometry and layout;
- completed load duration;
- application-frame and XR-cadence p50/p95/p99, average FPS and dropped rate;
- draw calls, triangles, points, lines, geometry and texture counts;
- scene and visible-scene object counts;
- JS heap and WASM-memory bounded aggregates where available;
- adaptive-governor minimum/final LOD scale and throttle-event count;
- visibility interruptions and final XR visibility state.

The scale knee is the smallest graded cardinality whose governed grade is red,
or whose p95/dropped-rate boundary first crosses the executable threshold when
no discrete grade change occurs. This is an experimental observation, not a
claim that cardinality caused every measured cost.

## 9. Handoff rules

The QCA0 evidence authorizes:

- **QCA4** when frame degradation scales with rendered cardinality or submitted
  workload. Its first experiment changes one rendering/cardinality variable and
  compares the same profile on physical Quest.
- **QCA2** when completed load duration materially increases across the knee.
  Its first work is stage timing across existing Worker/WASM, arbitration,
  representation construction and upload boundaries, not an assumed offload.
- **QCA1** only if later stage timing identifies a substantive eligible
  Rust/WASM kernel. The existing 100k control alone does not justify SIMD work.

The later multi-family Forma suite is reconsidered after a bounded QCA2/QCA4
intervention produces a measurable improvement. It remains necessary before a
general Moneta Forma performance claim.

## 10. Error handling

- Dataset-load rejection records a typed load failure and finalizes as invalid.
- Dataset supersession aborts without restoring over the newer investigator
  action.
- Stop/dispose aborts and never emits a positive recommendation.
- Candidate or coverage mismatch invalidates the QCA comparison instead of
  coercing it into row-addressable evidence.
- Missing browser memory or GPU timing remains unavailable, never zero-filled.
- A Worker-local missing registration is retried/recovered locally and must not
  invalidate an independently healthy main runtime.
- Evidence delivery or custody failure remains visible and promotion-ineligible.

## 11. Test contract

Implementation is not accepted unless tests can falsify these claims:

1. The profile cardinalities, durations, warmup status and Quest 3S target are
   frozen.
2. Measurement cannot start before asynchronous production load completion.
3. Rejection, supersession, stop and stale late completion fail closed.
4. Every graded step must match its declared source cardinality and
   row-addressable coverage.
5. The warmup is excluded from knee and overall verdict decisions.
6. The QCA mode cannot qualify PERF-04 or PERF-05.
7. The on-device production panel remains the only governed start path.
8. QCA analysis rejects incomplete, non-XR, misattributed or uncustodied runs.
9. The real Worker recovers missing local dataset registration without global
   runtime invalidation.
10. The real `World` call graph is exercised, not only a fake-driver helper.

Focused verification covers driver/profile tests, validation manifest and
operator-panel tests, QCA analysis/custody tests, production World integration,
the real Worker/WASM recovery test, typecheck, lint, build and docs checks. The
final claim requires one exact-head physical Quest capture.

## 12. Remote-main reconciliation

Before implementation, merge current `origin/main` into the feature branch.
The integration must inspect overlapping changes in `LoadTestDriver`,
`devEvidence`, the validation panel/tests and QCA documentation. It must retain
upstream Forma changes while re-establishing, with tests, the five integrity
properties already proven by the sealed control:

1. explicit Quest 3S profile attribution;
2. awaited production load completion;
3. immutable preservation of the earlier invalid engineering baseline;
4. dataset-supersession failure closure;
5. Worker-local residency recovery without global runtime invalidation.

The branch head that receives the new physical evidence must be the exact head
reviewed and proposed for integration.

## 13. Alternatives rejected

### Full five-family Forma suite first

Deferred. It is L3 qualification evidence and is unnecessarily broad for
locating the first bottleneck.

### Reuse only the sealed 100k control

Rejected as the complete QCA0 experiment. It proves severe failure at one scale
but cannot locate the knee or distinguish fixed overhead from N-dependent cost.

### Run the existing staircase unchanged

Rejected. The 250k stretch adds device time and risk without answering the first
optimization question, while the current step spacing omits the useful 32k knee
probe.

### Treat the scale test as Forma qualification

Rejected. The workload is intentionally row-addressable and has no READY
semantic candidate. Honest naming and separate evidence prevent a control from
being laundered into a product-level claim.

## 14. Exit

This QCA0 tranche is complete when:

- the integrity fixes survive current-main reconciliation;
- the named L1 profile and no-gate governed lane are production-wired;
- focused and required automated verification pass;
- an exact-head Quest 3S run is custody-finalized as `VALID_CAPTURE`;
- the scale knee and top three measured bottleneck hypotheses are recorded;
- QCA2/QCA4 receive one-variable next experiments;
- residual semantic representativeness limits are explicit.

It may not claim PERF-04/05 qualification, Full Moneta Forma performance,
component attribution not measured by the run, or improvement before a matched
post-change physical comparison exists.
