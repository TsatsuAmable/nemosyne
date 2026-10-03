# FM3-PERCEPT spatial-audio prototype audit

**Date:** 3 October 2026
**Base under audit:** HEAD `731788a3` (`git rev-parse HEAD` → `731788a30051ee572b5552bcda162051642547b8`, branch `fm4-ui-clean`, content-identical to `main@9fca179e` for every audited path — `git diff 9fca179e 731788a3 -- src/vr/audio tests/spatial-audio.test.ts tests/voice-spatial-engine.test.ts tests/selection-feedback.test.ts` is empty; last content touch of `src/vr/audio/` predates the base at `f8c6a1aa`/`300823c3`/`8de33b5a`). Every HEAD citation below is therefore also a base citation.
**Mode:** READ-ONLY analysis + this record. No production, test, or config file was modified.
**Sprint (verbatim, `docs/ROADMAP.md:60`):** "FM3: compositional spatial epistemology, composed Challenge, sonification/haptics experiments and only semantically justified live-stream/River-Tethys treatment; `FM3-PERCEPT` resolves palette/CVD and spatial-audio prototypes." Palette/CVD half resolved by CMS-5 (PR #894); this record closes the spatial-audio half.
**Governing product line:** `docs/ROADMAP.md:46` — "Sonification, haptics and voice remain candidate multimodal representation/interaction channels through versioned mappings and NIL, **not decorative effects or parallel semantic authorities**."

## Verdict

**ARCHIVE for `SpatialAudioSynthesizer` and `SpatialAudioNarrator` (delete in the FM3-PERCEPT cleanup package); `SelectionFeedback` is excluded from the deletion discussion — it is production-live.**

## 1. Method (and its limits)

1. **Read in full:** `src/vr/audio/SpatialAudioSynthesizer.ts` (170 lines), `src/vr/audio/SpatialAudioNarrator.ts` (35), `src/vr/audio/SelectionFeedback.ts` (301), `src/vr/audio/index.ts` (2), `tests/spatial-audio.test.ts`, `tests/voice-spatial-engine.test.ts`, `tests/selection-feedback.test.ts`.
2. **Reachability check:** repo-wide grep of `vr/audio`, `SpatialAudioSynthesizer`, `SpatialAudioNarrator`, `SelectionFeedback`, plus targeted greps for barrel imports (`audio/index`), dynamic `import(...)`, and entry roots. `SelectionFeedback`'s consumer chain traced by hand (`SelectionDispatcher` → `InputRouter` → `Engine` → `World` → coordinators).
3. **Governance reads:** `governance/production-capabilities.json` (all 18 capability `sources` lists enumerated; grep `audio` → zero hits), `tests/hygiene-audit.test.ts` (barrel guardian), `docs/roadmap/P1_FULL_MONETA_INCREMENTAL_CAPABILITY_PLAN.md:510` (the FM3+ `SpatialAudioSynthesizer` row), `docs/ROADMAP.md:46,60`, `docs/INTERACTIONS.md:367-374`.
4. **Census context:** `docs/review-plans/CMS7_LEGACY_TEST_RENT_CENSUS_2026-10-02.md:163` and `docs/review-plans/cms7_legacy_test_rent_census.json:1091` — `spatial-audio.test.ts` already classified RESEARCH_FIXTURE (flagged), `SpatialAudioSynthesizer` listed among "dormant experiment modules … FM3-PERCEPT candidates".
5. **Limits:** no runtime experiments, no test execution, no bundler graph (spot-verified by grep; the classes have so few total references that residual doubt is negligible — every claim is named and checkable). Line numbers drift only.

## 2. Reachability and authority evidence

### 2.1 `SpatialAudioSynthesizer` — zero production importers

- Non-module references total four files: the barrel `src/vr/audio/index.ts:2`, `tests/spatial-audio.test.ts:4`, the P1 plan row (`docs/roadmap/P1_FULL_MONETA_INCREMENTAL_CAPABILITY_PLAN.md:510`), and the CMS-7 census JSON. **No `src/**`, `dev/**`, `scripts/**`, or `e2e/**` file imports it, the barrel, or the other two barrel symbols.** No dynamic import anywhere (`import(` hits for "spatial" are only `scripts/benchmark-spatial-accelerator.mjs:8-9`, unrelated).
- The barrel itself (`src/vr/audio/index.ts`) has **zero importers of its own** — every consumer of every class in this directory imports the concrete file directly (below). It is not one of the 8 guardian-protected subsystem barrels (`tests/hygiene-audit.test.ts:7-16` — `vr/audio` is not in the list; only `vr/perception` is).

### 2.2 `SpatialAudioNarrator` — zero importers, one test, not even barrel-exported

- The barrel does not re-export it (`index.ts:1-2` exports `SelectionFeedback` and `SpatialAudioSynthesizer` only). Its sole non-module reference is `tests/voice-spatial-engine.test.ts:3`. Zero value imports anywhere else; its only other repo appearances are archival docs (`docs/archive/ROADMAP_PHASES_1-20_COMPLETED.md:367`).

### 2.3 `SelectionFeedback` — LIVE (explicit exclusion)

This is the production sound path and stays. Consumer chain, all value imports:

- Constructed unconditionally by the selection path: `src/vr/input/SelectionDispatcher.ts:7` (import), `:41` (field), `:58` (`new SelectionFeedback()`); select feedback fired at `:125-127` (`playSelect`, `flashPointer`, `playHaptic`).
- Exposed router-wide: `src/vr/InputRouter.ts:55` (`feedback: FeedbackLike`), `:128` (`this.feedback = this.dispatcher.feedback`), and `InputRouter` is the engine's input surface (`src/vr/Engine.ts:6`).
- Hover: `src/vr/input/InteractableRegistry.ts:360` (`feedback.playHover?.()`).
- Gesture + haptic: `src/vr/coordinators/WorldInputCoordinator.ts:181-182`.
- Warp/portal: `src/vr/World.ts:1406-1407`; landmark core tones + haptics: `src/vr/coordinators/WorldLandmarkController.ts:122,131-132,151-152` via the `WorldFeedbackLike` interface (`src/vr/coordinators/types.ts:714-719`, wired `src/vr/World.ts:649-653`).
- User-facing settings toggle path: `src/vr/World.ts:2184-2187` → `setToggles` (`SelectionFeedback.ts:67-71`); documented as the product behavior in `docs/INTERACTIONS.md:367-374`.

Test-only reach for the archive targets: `tests/selection-feedback.test.ts:6` pins the **live** class (see §5) and is unaffected by deleting the other two files.

### 2.4 Registry position

`governance/production-capabilities.json` has **no audio entry** (grep `audio` → zero hits in that file). However, the `application-spatial-runtime` capability (classification `production`) lists `src/vr` as a **directory-grain** source — so all three audio files, reachable or not, are covered by production classification purely by directory membership. Unlike `ColorPaletteEngine`, the dormant experiments here never received their own `development-only` entry or `forbiddenPublicExports` guard. Nothing in the registry needs *deleting* alongside the archive (no entry exists); see §7 for the gap.

### 2.5 STOP-grade check (resolved)

The prototype is **not** reachable from production, creates no evidence, and feeds **no decision path**: `playSpatialChime`/`playProximityCue`/`playClusterResonance`/`updateListenerTransform` (`SpatialAudioSynthesizer.ts:61,100,143,153`) terminate in oscillator→panner→`destination` graph nodes — pure output, no read-back, no scores, no analysis truth. Nothing in production would change on deletion. No live consumer needs refusal; nothing here stops the audit.

## 3. Semantics findings (what the code actually does)

### 3.1 The Synthesizer is real WebAudio, not a stub — but implements almost nothing of its own

- Genuine: HRTF `PannerNode` with declared distance model (`SpatialAudioSynthesizer.ts:106-110`: `panningModel = 'HRTF'` default at `:25`, `distanceModel: 'inverse'`, `refDistance 1.0`, `maxDistance 20.0`, `rolloffFactor 1.0`); full listener-frame sync from a THREE camera — world position, forward, and up-vector into the modern `AudioListener` rate fields (`:61-95`, legacy `setPosition/setOrientation` fallback `:83-94`); oscillator envelope with attack/ramp/decay (`:126-128`).
- All spatialization math is the browser's. The code-owned logic is exactly two hand-set mappings: the proximity pitch cue (`:143-148` — clamp window `0.1..5.0`, linear map 300 Hz↔1200 Hz, comment `:145`) and the cluster chord (`:153-163` — hard-coded A-major-7th array `:154`, 1.25/1.5 just-intonation ratios `:156`, `setTimeout` arpeggio `:158-162`). No provenance, no versioning, no user evidence for any constant.

### 3.2 Vocabulary audit (TEC3-MA2 standard): PASS on naming, FAIL on wiring claims

- No forbidden vocabulary anywhere on either class — no `confidence`, no `calibrated`, no "3D-accurate"/calibration language. The header's WebAudio description (`:2-5`) is factually accurate to what the code does.
- **Wiring overstatement (doc-comment):** the Synthesizer header claims it positions "audio chimes, proximity hums, and cluster resonance chords … in 3D VR space" (`:2-5`) — it positions nothing, because nothing composes it (§2.1). The Narrator header makes three concrete wiring claims — narration "for executed operations, anomaly alerts, and guided tour steps" (`SpatialAudioNarrator.ts:2-5`) — **all three are false at HEAD**: there is no operation-runner, anomaly-alert, or guided-tour consumer in the entire repo.
- **Decision-bearing status:** none. This is presentational-only; the `NOT_CALIBRATABLE_FOR_DECISION` machinery of MA2 does not attach because no metric here is consumed for any decision. The hand-set constants are decorative-effect parameters, which is precisely what `docs/ROADMAP.md:46` forbids as a promotion shape ("not decorative effects or parallel semantic authorities") had the surface been composed.

### 3.3 Inherited defects a future composition would ride in for free

- **AudioContext at construction, without a user gesture:** the constructor calls `_initAudio()` unconditionally (`:33→:42`), unlike the live `SelectionFeedback` which resumes on gesture (`SelectionFeedback.ts:85-93`) — an autoplay-policy/suspended-context hazard for any future wiring.
- **Undeclared latest-wins policy:** `speak()` cancels active speech before queuing (`SpatialAudioNarrator.ts:21`) — a semantics decision made silently.
- **`_speechRate` is a write-only field** (`:10`, read only at `:23` to a constant 1.0) — dead configurability, mirroring CMS-6 §4.3's stored-but-unread pattern in miniature.

## 4. Forward-value question (weighed, decided)

FM3's own scope includes sonification experiments, so KEEP-with-intent is a real candidate. Weighed honestly, it loses:

1. **What would FM3 actually reuse?** Not the mappings — the proximity pitch and chord constants are exactly what a governed FM3 sonification must *replace* with analytically justified, versioned mappings promoted "through RepresentationGraph/SpatialEmbodimentPlan" (`docs/ROADMAP.md:60`, P1 plan `:510`). Not the listener transform — it is ~20 lines of standard camera→`AudioListener` plumbing any real composition derives from the canonical scene authority (World/Engine camera group), not a side-channel camera object. Not the panner math — the browser does it. What remains is WebAudio boilerplate, which is platform knowledge, not repo knowledge.
2. **Re-derivation cost is genuinely low** — ~170 lines total, of which the parts worth re-deriving are a fraction, and any promotion path rewrites the surface into a governed channel anyway rather than importing this file into it. P1 plan `:510` itself frames the outcome as "promote through RepresentationGraph/SpatialEmbodimentPlan **or archive/delete** if user evidence is weak"; no user evidence exists, and no experiment is commissioned today — keeping the file buys nothing now.
3. **The repository's established discipline is decisive:** every retained dormant prototype in recent memory was reactivated or removed with its defects intact (MemoryPalaceController → FM1-MEM retirement; ColorPaletteEngine → CMS-5 absorb-then-DELETE; MultimodalPerceptionEngine → CMS-6 ARCHIVE; MovablePanel → FM4-UI-CLEAN deletion). KEEP would also preserve an ungoverned second audio vocabulary alongside the existing, live, gesture-resumed `SelectionFeedback` path — the "second authority" drift CMS-5's record explicitly warns about for colour.
4. **KEEP's cost is an ongoing lie:** both headers already fabricate wiring that does not exist (§3.2).

**VERDICT: ARCHIVE.** The Synthesizer is a real (not fake) 170-line WebAudio prototype whose only code-owned content — two hand-set, unprovenanced mappings — is precisely the content FM3 sonification must regenerate under a governed contract rather than inherit; every genuinely generic line is browser-API boilerplate re-derivable in an afternoon. Deleting it now, with `SelectionFeedback` untouched, removes a dormant second audio authority and its two fixture test suites at zero production risk, while the future FM3 sonification lane loses only boilerplate and gains the chance to inherit no constructor-init, cancellation, or header-vocabulary defects. Nothing of production or evidentiary value is lost; the P1 plan's own "archive/delete" clause is satisfied with user evidence not merely weak but absent.

## 5. Candidate disposition package

| Surface | Disposition | Per-surface detail |
|---|---|---|
| `src/vr/audio/SpatialAudioSynthesizer.ts` (170 lines) | **DELETE_WITH_SURFACE** | Zero importers (§2.1). Nothing re-homes: it implements no algorithm with a canonical counterpart (contrast with CMS-5's WCAG absorb). |
| `src/vr/audio/SpatialAudioNarrator.ts` (35 lines) | **DELETE_WITH_SURFACE** | Zero importers, not barrel-exported (§2.2). |
| `src/vr/audio/index.ts` (barrel) | **DELETE_WITH_SURFACE** | Zero importers of the barrel itself (§2.1); not guardian-protected (`tests/hygiene-audit.test.ts:7-16`). After the two class deletions it would re-export only `SelectionFeedback`, which its consumers already import directly (`SelectionDispatcher.ts:7`) — the barrel is dead weight with or without the archive. |
| `tests/spatial-audio.test.ts` (5 `its`) | **DELETE_WITH_SURFACE** | Census §S10 (`CMS7_...:163`) already classes it RESEARCH_FIXTURE (flagged). All 5 die: `:13-17` pins constructor defaults only; `:19-23, :25-28, :30-33, :35-38` are `expect(...not.toThrow())` vacuities — in the node lane `window` is undefined so `ctx` is null and `playSpatialChime` returns null at `:101`, meaning the it named "when AudioContext is simulated" (`:25`) simulates nothing. No production-path pin exists. |
| `tests/voice-spatial-engine.test.ts` (1 `it`) | **DELETE_WITH_SURFACE** | Pure instantiate-rent ("instantiates SpatialAudioNarrator gracefully", `:6-9`) under a describe block naming a "Voice & Natural Language Spatial Query Engine Suite" that has no other content in the repo. No production-path pin. |
| `tests/selection-feedback.test.ts` (15 `its`, jsdom) | **PROTECT** | Pins the live surface with real assertions: oscillator counts per tone shape (`:68-79`), two-tone chirp timing (`:68-74`), ray-flash color/opacity mutation and non-mutation on toggle (`:81-89, :131-139`), hit-marker spawn/dispose (`:91-100`), haptic actuator pulse values and suppression (`:182-198`), per-gesture/per-mode/per-portal tone coverage (`:141-180`), null-`AudioContext` graceful no-op (`:102-107`). None of these `its` dies with the archive package; the suite needs no edit. |
| `SelectionFeedback` wiring (`SelectionDispatcher`, `InputRouter`, `World`, `WorldInputCoordinator`, `WorldLandmarkController`, `InteractableRegistry`) | **PROTECT** | Untouched by the package; enumerated in §2.3 to keep this exclusion auditable. |
| Registry | **No edit required** | No audio entry exists to delete (§2.4). Directory-grain `src/vr` coverage is unaffected by file deletion. |
| `docs/roadmap/P1_FULL_MONETA_INCREMENTAL_CAPABILITY_PLAN.md:510` | **Update in the deleting PR** (docs-only) | Convert the FM3+ row's open re-evaluation into the recorded disposition, mirroring how FM4-UI-CLEAN's row was closed in `docs/ROADMAP.md`. |

Net test rent retired: **6 `its` across 2 files**, all dies-with-surface; **0 live pins die**.

## 6. Candidate typed contracts if FM3 sonification is ever commissioned

Not for this code (nothing is being revised); the future governed spatial-audio/sonification channel would have to pin, at most:

1. **Listener-frame authority:** panner/listener transforms derive only from the canonical scene/camera authority, deterministically from a recorded camera pose (same pose → same listener transform under replay).
2. **Authored-position encoding:** panner positions come only from governed dataset/world coordinates with a declared coordinate frame and units — no synthetic offsets, no fabricated spatial anchors.
3. **Versioned mapping registry with provenance:** each sonification mapping carries an id, version, and metric-fidelity class (the `estimated`/`surrogate` pattern of `src/vr/perception/PerceptualFitnessSampler.ts`, CMS-6 §3.5), promoted through RepresentationGraph/SpatialEmbodimentPlan per `docs/ROADMAP.md:60`.
4. **No fabricated certainty:** mappings never encode an analytical state or confidence into loudness/pitch without provenance, and hand-set constants are declared unvalidated until user-evidence-backed ("archive/delete if user evidence is weak", P1 plan `:510`).
5. **Gesture-gated context lifecycle:** the `AudioContext` is created/resumed only on a user gesture (the `SelectionFeedback.ts:85-93` pattern) with declared dispose ownership — never the constructor-init pattern of `SpatialAudioSynthesizer.ts:33/42`.

## 7. Protection-gap notes (§7-style)

1. **Directory-grain registry coverage masks dormancy:** `application-spatial-runtime`'s `src/vr` sources list gives every file in the VR tree a "production" umbrella regardless of reachability. The deviation from the better-established pattern (per-file `development-only` entry + `forbiddenPublicExports`, as `ColorPaletteEngine` had) is why three dormant audio files sat unflagged until FM3-PERCEPT. Recommend, for future dormant experiments under `src/vr`, a per-file `development-only` entry rather than directory-grain inheritance. Observed; no registry change is proposed *by this archive* (deleting the files moots it, and no entry exists today to delete).
2. **The barrel was guardian-unprotected:** `vr/audio` was never in the `hygiene-audit.test.ts` subsystem list, so nothing would have caught a public re-export widening. With the barrel deleted (§5), the gap closes by removal; no new forbid-list entry is needed because nothing survives to forbid.
3. **Docs nit for the deleting PR (docs-only, in its remit):** `docs/INTERACTIONS.md:367` cites `src/vr/audio/SelectionFeedback.js` — stale `.js` extension on the one audio file that survives; `docs/archive/ROADMAP_PHASES_1-20_COMPLETED.md:367` is archival and untouched.

## 8. Verification (this host)

- `git rev-parse HEAD` → `731788a30051ee572b5552bcda162051642547b8`; `git diff 9fca179e 731788a3` over all audited paths → empty (base-parity claim in the header).
- All reachability claims are grep-verified at HEAD across `src/`, `tests/`, `scripts/`, `dev/`, `e2e/`, docs, and the registry JSON; all 18 registry capability `sources` lists were enumerated for `vr/audio`/`InputRouter`/`SelectionDispatcher` substrings.
- No production code, test, or config file touched; no test executed; `docs/ROADMAP.md` untouched. Deliverable: this record only.