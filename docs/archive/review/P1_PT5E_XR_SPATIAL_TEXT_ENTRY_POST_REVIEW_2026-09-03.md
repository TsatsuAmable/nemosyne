# P1-PT5E XR Spatial Text Entry - Post-Implementation Adversarial Review

**Date:** 3 September 2026  
**Base:** `main@fdbf25b656d82f5b0d768d078fdfaed4949ca942`  
**Reviewed production/test head:** `c5ec07594c27c4e4b807401c4afb7f9216f79365`  
**PR:** #646

## Disposition

**ADOPT, conditional on the literal final PR head passing all required promotion gates.**

The reviewed production/test head removes the browser-modal text-entry dependency from the ordinary XR investigation journey without introducing a second investigation authority. Text editing remains bounded, ephemeral presentation state; explicit Submit is the only route into the existing `InvestigationJourneyController`, which continues to emit sequenced NIL commands before authoritative Atlas/discovery state is re-read.

The final PR head may differ from the reviewed production/test head only by this review record or subsequent fix-forward changes that are themselves re-reviewed. Any production or test change after this record invalidates the disposition until re-reviewed.

## Attack surface reviewed

The review attacked:

1. browser-modal or DOM-only input remaining on the normal XR journey;
2. mutation caused by typing, Shift, Backspace, Clear, Cancel or empty Submit;
3. unbounded text growth;
4. partial Understanding state after entering only a title;
5. controller-ray hit regions diverging from rendered content coordinates;
6. a modality-specific XR semantic path bypassing `InvestigationJourneyController` / NIL;
7. stale observation, discovery or result references being reinterpreted by the panel instead of rejected by the existing authority path;
8. raw internal discovery enums leaking back into researcher-facing language;
9. an input character set too weak for ordinary scientific statements.

## Findings and fixes

### PT5E-R1 - controller-ray content coordinates were offset by the title bar

**Severity before fix:** High for interaction fitness.

`MovablePanel.render()` translates panel content below the title bar, while the old `InvestigationJourneyPanel.handleContentClick()` compared raw canvas Y coordinates directly with content-space button coordinates. The result was a systematic title-bar offset between rendered controls and their controller-ray hit regions.

**Fix:** content hit testing now subtracts `titleBarHeight + 4` before applying scroll offset. A dedicated falsifier maps the rendered Notice button center back through the panel transform and proves it activates the expected spatial action.

**Status:** fixed and covered.

### PT5E-R2 - first spatial keyboard could not express numerical analytical hypotheses

**Severity before fix:** High for scientific workflow fitness.

The first implementation supported letters and punctuation but not digits or comparison operators. That made ordinary hypotheses such as `value > 10.5` impossible to author in-headset, defeating the claim that normal investigation authoring no longer required the browser modal.

**Fix:** the bounded key set now includes digits plus compact analytical/punctuation characters including comparison, arithmetic, percentage, slash and grouping characters. A dedicated falsifier enters `value > 10.5` and proves the exact text reaches the unchanged `hypothesise(discoveryId, hypothesis)` controller call only after explicit Submit.

**Status:** fixed and covered.

## Invariants verified by code and falsifiers

- `window.prompt()` is no longer called by `InvestigationJourneyPanel` for Notice, Question, Hypothesis or Understanding authoring.
- Character entry does not call the journey controller.
- Cancel does not call the journey controller and discards unfinished text.
- Empty Submit is refused while text-entry mode remains active.
- Text length is bounded before semantic dispatch: 500 characters for Notice/Question/Hypothesis, 120 for Understanding title, 1000 for Understanding description.
- Understanding title is presentation-only until description is also supplied; the domain receives one existing `recordUnderstanding` call containing both fields and the captured evidence/result identity.
- Submission nulls the active entry before awaiting the semantic action, preventing duplicate Submit from dispatching the same text twice.
- Question/Hypothesis/Understanding continue to carry explicit observation/discovery/result identities into the existing controller. The panel does not invent replacement evidence if state changes while authoring; the controller/domain path remains responsible for accepting or rejecting those identities.
- Validation actions remain unchanged and continue through the same shared controller.
- Researcher-facing status text remains human language rather than raw `SUPPORTED` / `UNDER_INVESTIGATION` vocabulary.
- No unfinished text is written to session persistence, Atlas, InvestigationGraph or DiscoveryEpisode state.

## Authority review

The authoritative path remains:

```text
XR panel/controller interaction
  -> bounded ephemeral text buffer
    -> explicit Submit
      -> InvestigationJourneyController
        -> NilExecutor with expected sequence
          -> Atlas / DiscoveryReasoningService
```

PT5E adds no analytical calculation, no discovery store, no secondary command schema and no XR-only semantic command.

## Residual risks and claim boundary

The tranche intentionally does **not** establish:

- comfortable high-volume typing on a physical headset;
- voice dictation, handwriting or predictive entry;
- a complete mathematical equation editor or Unicode scientific notation surface;
- accessibility completeness for text authoring;
- physical-device controller ergonomics, fatigue or target-acquisition quality;
- live-human UX fitness.

Those are empirical/device questions for the remaining PT5 repeated live UX sessions and refinement loop. They are not software-path blockers for removing the browser-modal dependency.

## Promotion requirements

Promote only if the literal final PR head passes:

- CI, including typecheck, lint, architecture enforcement, Rust tests, Vitest coverage, production build and Chromium production smoke;
- CodeQL;
- Architecture policy;
- Q8;
- Q9 exact-head promotion evidence;
- UV0;
- Wiki validation;
- approval gate;
- final PR head/review-thread race check.

Any failure is fix-forward evidence. Any production/test change after this review requires another adversarial pass before merge.
