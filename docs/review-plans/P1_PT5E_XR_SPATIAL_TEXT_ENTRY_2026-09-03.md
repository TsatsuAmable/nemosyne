# P1-PT5E XR Spatial Text Entry - Pre-Implementation Adversarial Review

**Date:** 3 September 2026  
**Base:** `main@fdbf25b656d82f5b0d768d078fdfaed4949ca942`  
**Programme:** P1-PT5 catalogue loading, NIL parity and discovery-workflow convergence

## Why this tranche exists

PT5A through PT5D made governed datasets loadable, brought dataset-library parity into XR, established the canonical Notice -> Question -> Hypothesis -> Investigation -> Understanding -> Validation -> Discovery journey, and made investigations saveable/reopenable/recoverable.

One ordinary XR dependency remains visibly browser-modal: `InvestigationJourneyPanel` uses `window.prompt()` for Notice, Question, Hypothesis and Understanding text. A browser prompt is outside the spatial panel interaction model and may be unavailable or unusable during immersive XR. It also prevents the browser/IWER path from proving that a normal investigation can be authored without leaving the headset interaction surface.

This tranche removes that dependency without creating a second investigation or text-semantics authority.

## Invariant

Text entry is presentation state only. No investigation mutation may occur until the researcher explicitly submits non-empty bounded text. Submitted text must continue through the existing `InvestigationJourneyController` and its sequenced NIL path.

Cancel, clear, backspace, shift and character-entry operations must never create Atlas, InvestigationGraph or DiscoveryEpisode mutations.

## Authority and production path

```text
controller ray / XR panel click
  -> InvestigationJourneyPanel spatial text-entry buffer
    -> explicit Submit
      -> InvestigationJourneyController
        -> sequenced NilExecutor
          -> Atlas / DiscoveryReasoningService / DiscoveryEpisodeStore
```

The spatial keyboard owns only an ephemeral bounded string buffer and rendering/hit targets. It must not own semantic journey state, bypass NIL, infer analytical evidence, or persist a shadow copy of investigation text.

## Primary failure modes to attack

1. `window.prompt`, DOM-only input, or another browser modal remains on the normal XR authoring path.
2. Entering or editing characters dispatches a semantic command before explicit submit.
3. Cancel or empty submit creates partial Notice/Question/Hypothesis/Understanding state.
4. Text input is unbounded and can create pathological canvas/render or command payload growth.
5. The Understanding two-field flow can save a title before a description exists, creating partial domain state.
6. Controller hit regions do not align with rendered keyboard controls because content coordinates ignore the panel title-bar transform.
7. XR gains modality-specific domain commands instead of delegating to `InvestigationJourneyController`.
8. Existing human-facing discovery language regresses into internal enum/status vocabulary.
9. The spatial character set is too weak for ordinary scientific authoring, for example numerical thresholds or comparison expressions.

## Bounded design

- one in-panel QWERTY-style keyboard rendered by the existing canvas panel;
- letters, digits and a compact scientific/punctuation set, plus space, one-shot shift, backspace, clear, cancel and explicit submit;
- enough analytical symbols for ordinary threshold/comparison statements without attempting a full equation editor;
- per-field character caps: Notice/Question/Hypothesis 500, Understanding title 120, Understanding description 1000;
- no persistence of unfinished text;
- no speech, handwriting, predictive text or platform keyboard integration in this tranche;
- no physical-headset ergonomics claim from browser/IWER evidence.

## Falsifying evidence

Focused tests must prove:

- Notice authoring works with `window.prompt` unavailable/uninvoked;
- typing before submit causes no controller mutation;
- cancel causes no controller mutation;
- empty submit is refused while the spatial entry remains active;
- character limits are enforced before semantic dispatch;
- numeric thresholds/comparison symbols survive spatial entry into the existing hypothesis controller call;
- Understanding title and description are gathered in presentation state and dispatched atomically as one existing `recordUnderstanding` call;
- ordinary validation language remains human-facing;
- the panel still delegates all domain actions to the shared journey controller.

Repository exact-head CI, Chromium production smoke, UV0, CodeQL, architecture policy, Q8, Q9, Wiki validation and approval remain promotion requirements.

## Claim boundary

A successful tranche may claim that the normal browser/IWER XR investigation authoring path no longer depends on browser-modal text prompts. It may not claim comfortable high-volume typing on physical headsets, voice dictation, accessibility completeness, a full mathematical equation editor, or live-human UX fitness. Those require later device/human evidence and repeated PT5 product-learning sessions.
