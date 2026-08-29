# P1-QV — Quest validation operations

**Status:** PLANNED ENABLER

**Owners / consumers:** RF-033 evidence architecture, RF-052 governance truth, PERF-04, PERF-05, UX-03, RF-049, RF-050, P1-U9 and later production/private-preview qualification.

**Intent:** turn routine physical Meta Quest development sessions into attributable, reproducible and gate-adjudicable evidence with minimal manual setup, without laundering trial runs into stronger evidence classes than they deserve.

This work is deliberately a thin operational layer over the existing Vite development server, Quest telemetry, load-test profiles, local ignored logs, simulator evidence and promotion policy. It must not create a second telemetry system, a second performance authority, or a second roadmap status authority.

## Problem

Nemosyne already contains much of the machinery needed for physical Quest qualification:

- the Quest 3S qualification load-test profile;
- physical-XR runtime/environment capture;
- fixed performance thresholds and verdict calculation;
- local development-server collection into ignored `logs/` output;
- telemetry analysis grouped by build/runtime/device characteristics;
- a distinct 10M Rust/WASM boundary probe;
- P1-USIM deterministic simulator evidence for simulator-testable invariants;
- roadmap gates that explicitly reserve optics, tracking, comfort, frame pacing, device memory and final physical-XR behavior for real hardware.

The remaining operational gap is that a developer can spend meaningful time exercising Nemosyne on a Quest while the resulting evidence remains weakly attributable or manually classified. Generic `npm run dev` sessions can fall back to an unversioned build identity; load-test results are appended to a common local JSONL sink; firmware/run labels require extra ceremony; analyzer success proves report validity rather than gate success; and UX/device observations are not yet guided into a canonical gate disposition.

The result is avoidable evidence loss: expensive physical-device time can become anecdotal even when the underlying runtime already measured useful facts.

## Governing evidence rule

Automation may reduce ceremony. It may **not** upgrade evidence class.

The required evidence taxonomy is:

```text
ordinary development / ad-hoc trial
        ↓
physical Quest dev-runtime evidence
        ↓
governed physical Quest validation evidence
        ↓
clean-production physical Quest qualification
        ↓
promotion disposition
```

A Vite development run on real Quest hardware may provide authoritative physical-device evidence for properties that genuinely depend on that hardware, but it does not become clean-production evidence merely because the launcher labels it a validation run.

Likewise:

- a simulator run does not become physical-device evidence;
- a valid telemetry schema does not imply a passing performance gate;
- a green performance staircase does not imply UX-03 or P1-U9 completion;
- the current `QUEST 10M` boundary probe does not imply final 10M device qualification;
- a dirty-worktree run may remain useful experimental evidence but cannot silently claim exact-source reproducibility.

Every stored disposition must therefore include both **result** and **evidence class**.

## Desired operator experience

Ordinary development remains unchanged:

```bash
npm run dev
npm run dev:wasm
```

A developer who is already about to use the headset should be able to make the session count by choosing one explicit mode:

```bash
npm run dev:quest
npm run dev:quest:perf
npm run dev:quest:ux
npm run dev:quest:10m
npm run dev:quest:validate
```

The launcher should derive and expose the rest wherever it can do so truthfully:

- exact Git commit/build ID;
- clean/dirty worktree state;
- validation mode;
- owning gate/profile;
- generated run/session ID;
- local evidence directory;
- runtime class (`vite-dev`, later `clean-production-dist`);
- physical/simulator evidence class;
- current locally declared Quest model/firmware where available.

The headset should then require only the information that cannot be safely inferred, plus deliberate user actions needed for the validation scenario itself.

## Proposed run modes

| Command | Purpose | Evidence class | Primary consumers |
| --- | --- | --- | --- |
| `npm run dev` | ordinary development | trial / none | none |
| `npm run dev:wasm` | ordinary WASM development | trial / none | none |
| `npm run dev:quest` | informal physical-headset development with attribution | physical-device trial | exploratory RF discovery |
| `npm run dev:quest:perf` | governed Quest 3S performance staircase | governed physical-device validation | PERF-04 / PERF-05 |
| `npm run dev:quest:ux` | guided controller/hand/task validation | governed physical-device validation | UX-03 / RF-049 / RF-050 / P1-U9 evidence |
| `npm run dev:quest:10m` | current governed 10M Rust/WASM boundary exercise | governed physical-device boundary evidence | RF-029 / RF-051; **not final 10M qualification** |
| `npm run dev:quest:validate` | validation launcher/dashboard selecting eligible lanes | depends on selected lane | cross-gate orchestration |

Names are implementation guidance rather than an API contract; if a smaller command surface proves clearer, preserve the semantic distinction rather than the exact spelling.

## QV0 — evidence taxonomy and validation manifest

Before automating launches, freeze one small versioned manifest contract so every run can answer the same attribution questions.

Minimum manifest fields:

- schema version;
- session/run ID;
- exact source commit/build ID;
- worktree state: `clean`, `dirty`, or `unknown`;
- validation mode;
- requested gate/profile;
- runtime class: at minimum `vite-dev`, `clean-production-dist`, `desktop-browser`, `desktop-simulator`, `physical-webxr` where applicable;
- device evidence class;
- declared Quest model;
- declared firmware version;
- browser/user-agent identity captured by the runtime;
- nominal XR frame rate where available;
- start/end timestamps;
- linked raw/aggregate evidence artifacts;
- resulting gate disposition(s);
- invalidation/reason fields when a run cannot be used for promotion.

### QV0 acceptance

- [ ] one manifest schema is versioned and tested;
- [ ] evidence class and gate result are separate fields;
- [ ] a report cannot imply clean-production qualification solely from physical-device presence;
- [ ] dirty/unknown source attribution is representable without pretending the run is reproducible;
- [ ] existing Quest telemetry can link into the manifest without duplicating its device/runtime fields.

## QV1 — validation launcher and Vite mode plumbing

Add a thin launcher rather than embedding Git/process discovery inside product runtime code.

Responsibilities:

1. resolve current Git HEAD;
2. determine whether tracked source state is clean;
3. map the selected command/mode to a governed validation profile;
4. generate a stable session ID;
5. set Vite-visible build/validation metadata;
6. create the local evidence directory;
7. start the existing Vite dev server with the existing WASM/dev-server plugins;
8. print a concise operator summary and Quest-accessible URL;
9. never modify source, Git state or roadmap status automatically.

Example generated context:

```text
buildId=67ff458b51d49181e14bce8773c038f440c19cca
worktree=clean
validationMode=quest-perf
gate=PERF-04
profile=quest-3s-qualification
sessionId=PERF04-67ff458-20260829T104512
runtime=vite-dev
```

### Dirty-worktree policy

A dirty tree must not prevent experimentation, but it must prevent promotion-grade exact-source claims.

Expected behavior:

```text
VALIDATION SESSION
Build: 67ff458
Working tree: DIRTY
Evidence class: physical-device experimental
Promotion eligibility: NO
```

Clean source may be eligible for adjudication if all other gate prerequisites are met.

Do not generate or commit a patch merely to bless a dirty run. If dirty-state fingerprinting is later useful, treat it as supplemental provenance, not a substitute for an immutable committed source identity.

### QV1 acceptance

- [ ] generic `dev` / `dev:wasm` behavior remains unchanged;
- [ ] validation modes always emit a non-fallback build ID;
- [ ] clean/dirty/unknown state is explicit;
- [ ] mode/gate/profile mappings are centralized and testable;
- [ ] the launcher cannot mark any roadmap gate complete.

## QV2 — local device metadata with truthful reuse

Do not infer firmware or hardware facts that the browser cannot reliably know.

Provide a small local-only device declaration store for facts such as:

- friendly local device label;
- declared Quest model;
- firmware version;
- optional investigator label.

The runtime should continue capturing browser/runtime/WebGL/XR facts directly. The local declaration supplies only the missing investigator-declared facts.

Suggested storage is under ignored local state, for example:

```text
logs/validation/device.json
```

or equivalent local browser storage if that produces a simpler Quest workflow.

Rules:

- firmware/model fields remain visibly investigator-declared;
- the operator can update them before a run;
- a missing required declaration downgrades/invalidates the relevant gate evidence rather than being guessed;
- no user dataset content, camera pose history or interaction trail is added merely to improve convenience.

### QV2 acceptance

- [ ] device declaration is entered once and reused locally;
- [ ] runtime-measured and investigator-declared metadata remain distinguishable;
- [ ] the operator can see/change the active declaration;
- [ ] privacy constraints of the existing bounded telemetry path are preserved.

## QV3 — mode-aware local evidence sink

Retain `logs/` as ignored local evidence, but stop mixing governed validation sessions into an undifferentiated file.

Ordinary development may continue to append to the existing sink. Validation modes should use a session directory such as:

```text
logs/validation/
  PERF04-67ff458-20260829T104512/
    manifest.json
    loadtest-results.jsonl
    analysis.json
    disposition.json
```

UX modes may add bounded files such as:

```text
    ux-results.json
    comfort-observation.json
```

Do not add raw user dataset rows, raw camera trajectories, unrestricted frame traces or unnecessary interaction histories just because the directory is local.

The existing `loadtestResultsPlugin()` should become validation-context aware rather than being replaced. Generic dev behavior remains backward compatible.

### QV3 acceptance

- [ ] validation sessions cannot silently merge evidence from different commits, firmware/browser identities or modes;
- [ ] local log directories remain git-ignored;
- [ ] a failed/aborted run is retained and classified rather than discarded;
- [ ] `FLUSH LOG` / download fallback continues to work when the dev sink is unavailable;
- [ ] file writes remain bounded and local-only by default.

## QV4 — automatic analysis and gate adjudication

Reuse the existing analyzer and fixed performance verdict logic, but add one explicit adjudication layer.

The distinction is mandatory:

```text
report/schema valid ≠ gate passed
```

The adjudicator consumes:

- validated evidence;
- run manifest;
- owning gate definition;
- prerequisite/evidence-class requirements;
- fixed acceptance thresholds already owned by the relevant subsystem.

It emits a bounded disposition:

```text
PASS
FAIL
PARTIAL
INVALID_RUN
BLOCKED
```

with machine-readable reasons.

Examples:

```text
PERF-04  PASS
PERF-05  PARTIAL
```

or:

```text
PERF-04  FAIL
reason: 100k soak p95 exceeded governed threshold
```

or:

```text
P1-U9  BLOCKED
reason: P1-UV final treatment prerequisite not satisfied
```

### 10M guard

The current `QUEST 10M` boundary probe remains RF-029/RF-051 evidence. QV automation must **not** reinterpret its completion as `PERF-04 PASS` or generic 10M device qualification.

A future final 10M profile can become promotion evidence only after its workload envelope, prerequisites and disposition semantics are explicitly governed.

### QV4 acceptance

- [ ] analyzer validity and gate disposition are mechanically separate;
- [ ] gate thresholds are not rewritten after observing a run;
- [ ] evidence-class/prerequisite failures produce `BLOCKED` or `INVALID_RUN`, not `PASS`;
- [ ] red/yellow/failed runs remain useful stored evidence;
- [ ] 10M boundary evidence cannot close PERF-04 by accident;
- [ ] adjudication output never directly edits `docs/ROADMAP.md` or GitHub promotion state.

## QV5 — guided physical UX validation

Add a bounded validation runner for the physical tasks already required by UX-03, RF-049, RF-050 and P1-U9 rather than relying on free-form recollection after a headset session.

The runner should guide and record semantic outcomes for representative tasks such as:

- controller select/commit/cancel;
- supported direct-touch/hand commit;
- near-touch → retreat → ray transition;
- cross-target capture/cancel and tracking-loss recovery;
- dense-data precision escape;
- panel grab/pin/follow/scroll where applicable;
- representation change without semantic-command drift;
- command availability / disabled reason comprehension;
- large text, high contrast and reduced-motion treatment;
- error/recovery path;
- core first-insight / skeptical-investigation tasks on the converged product treatment.

Record outcome-level evidence rather than exhaustive biometric/pose trails:

- pass/fail/not-run;
- accidental activation count where meaningful;
- recoverability;
- task completion/failure reason;
- bounded investigator note;
- input modality;
- treatment/build identity.

A separate sustained-session record should capture required comfort/fatigue observations without pretending a single self-run is a population usability study.

### QV5 acceptance

- [ ] controller and hand evidence are separable;
- [ ] `NOT RUN` remains explicit rather than being interpreted as pass;
- [ ] the same semantic task vocabulary is used across simulator/desktop/physical evidence where appropriate;
- [ ] physical evidence never gets backfilled from IWER;
- [ ] P1-U9 cannot become complete merely because the guided runner itself exists.

## QV6 — validation dashboard / operator surface

`dev:quest:validate` may expose a compact local validation surface that answers:

- Which exact build am I testing?
- Is this source state eligible for promotion-grade evidence?
- Which physical gates are currently runnable?
- Which are blocked by prerequisites?
- Which device declaration is active?
- Which tasks/runs remain in this session?
- Where will evidence be written?
- What did the latest adjudicator conclude?

This surface is an engineering validation tool, not part of the investigator product UX. It should stay dev-only and must not leak into production bundles.

### QV6 acceptance

- [ ] production build contains no validation-dashboard/dev-server dependency path;
- [ ] the dashboard shows blocked prerequisites rather than encouraging invalid evidence collection;
- [ ] one action can start the existing Quest performance profile;
- [ ] one action can start the existing 10M boundary probe with its non-qualification warning;
- [ ] guided UX tasks and current dispositions are visible without exposing raw sensitive telemetry.

## QV7 — clean-production handoff

Do not use the convenience of Vite modes to erase the clean-artifact qualification boundary.

Add a sibling launcher/handoff for final production-path runs once P1-W / RF-053 through RF-056 prerequisites are ready. The resulting manifest must identify:

```text
runtime=clean-production-dist
device=physical-quest-3s
```

rather than `vite-dev`.

The clean-artifact path should preserve as much of the same manifest, collector and adjudicator vocabulary as possible so the difference between dev validation and production qualification is environment evidence, not two unrelated frameworks.

### QV7 acceptance

- [ ] one manifest/adjudication vocabulary spans dev and clean-production runs;
- [ ] clean artifact identity is provable independently of the Vite dev server;
- [ ] dev-only signalling/logging helpers are not accidentally required by a production qualification run;
- [ ] RF-053/RF-056 clean-artifact evidence remains independently satisfiable.

## QV8 — harness self-validation and adversarial review

The validation harness is evidence infrastructure, so defects in it can manufacture false confidence. It therefore needs its own bounded falsification tests.

Required tests/review:

- mode mapping unit tests;
- exact build-ID propagation;
- dirty-state downgrade;
- manifest schema validation;
- evidence-directory isolation;
- malformed/foreign report rejection;
- analyzer-valid-but-gate-fail fixture;
- missing-prerequisite `BLOCKED` fixture;
- explicit 10M non-qualification fixture;
- aborted run preservation;
- dev-only code exclusion from production bundle;
- class-wide search for another path that can write/claim physical-device dispositions;
- adversarial post-implementation review against RF-033/RF-052 evidence truthfulness.

Do not turn every development session into a blocking automated test. This programme exists to reduce operator friction and improve evidence quality, not to add a new blanket PR tax.

## Dependency and sequencing

P1-QV can be implemented largely in parallel with P1-R semantic embodiment convergence and P1-UV visible-product convergence because it changes evidence operations rather than product semantics.

Recommended order:

```text
QV0 manifest/taxonomy
  → QV1 launcher + run modes
    → QV2 local device declaration
      → QV3 isolated local evidence sink
        → QV4 analyzer/adjudicator split
          → QV5 guided UX validation
            → QV6 validation dashboard
              → QV7 clean-production handoff
                → QV8 adversarial harness review
```

However, final expensive physical qualification should consume the latest eligible product state:

```text
P1-R truthful representation
        +
P1-UV converged visible treatment
        +
remaining P1-U implementation
        ↓
P1-QV governed physical validation collection
        ↓
P1-U9 / UX-03 / PERF-04 / PERF-05 dispositions
        ↓
P1-W clean-production wiring
        ↓
QV7 clean-production physical qualification where required
        ↓
private-preview promotion
```

QV implementation may begin earlier and is encouraged to do so. Early governed runs remain useful baselines even when a final gate is still blocked by later product prerequisites.

## Architecture boundaries

1. **No second performance authority.** Existing load-test thresholds/verdict logic remain canonical unless changed through their owning review.
2. **No second telemetry system.** Extend/link the current bounded telemetry and local result sink.
3. **No second product command authority.** UX validation observes/requests existing semantic actions through real production input paths.
4. **No roadmap auto-editing.** The harness emits evidence/dispositions; a reviewed governance step decides status changes.
5. **No evidence laundering.** Mode labels never upgrade simulator→device, dev→production, dirty→immutable or boundary-probe→qualification evidence.
6. **No sensitive evidence creep.** Convenience is not justification for recording raw datasets, pose histories or unrestricted interaction trails.
7. **No validation god class.** Keep launcher/context, manifest, sinks, adjudicators and UX scenario runner as small separately testable responsibilities.
8. **Failures are evidence.** Red, partial, aborted and invalid runs stay attributable and inspectable.

## Definition of done

P1-QV is `VERIFIED COMPLETE` when:

- a clean committed build can be launched into a governed Quest validation mode with one command;
- build identity, mode, gate/profile, run ID, runtime class and local output location are generated automatically;
- Quest model/firmware require at most truthful local declaration and are reused without repeated URL editing;
- physical validation outputs are isolated per run and remain git-ignored;
- existing telemetry/analyzer machinery is reused rather than forked;
- report validity and gate success are mechanically distinct;
- dirty, missing-prerequisite and wrong-evidence-class runs cannot produce promotion-eligible `PASS`;
- the 10M boundary probe cannot masquerade as final device qualification;
- guided controller/hand/comfort evidence can feed UX-03/RF-049/RF-050/P1-U9 dispositions;
- clean-production physical qualification remains a distinct evidence class while sharing the same manifest/adjudication vocabulary;
- production bundles contain no validation-mode/dev-dashboard path;
- adversarial review finds no alternate path capable of manufacturing a stronger evidence claim from weaker inputs.

The success criterion is operational: **wearing the Quest for normal serious testing should require almost no additional clerical work to produce useful governed evidence, while promotion claims remain stricter than trial runs.**
