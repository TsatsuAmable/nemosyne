---
title: FM2 browser intent commit and bounded compare claim repair
author: Tsatsuamable
date: 2026-10-25
branch: director/20261024-fm2-browser
touches:
  - docs/superpowers/plans/2026-10-25-fm2-browser.md
  - src/app/investigation/DesktopDirectLoopControls.ts
  - src/app/investigation/DiscoveryNilBindings.ts
  - src/app/investigation/InvestigationJourneyNilRuntime.ts
  - src/app/investigation/installInvestigationJourney.ts
  - src/utils/EventBus.ts
  - tests/dse3-dual-mode-feedback.test.ts
  - tests/fm2-desktop-direct-critique.test.ts
  - tests/pt5c-investigation-journey.test.ts
  - tests/smoke/fm2-browser-direct-loop.spec.ts
---

## Decided
The normal investigation composition now lets Atlas own QUESTION/HYPOTHESISE while projecting successful commands into DiscoveryReasoningService; a typed event refreshes the direct rail after context turnover. The Chromium claim explicitly excludes rendered compare/branch/defer qualification.

## Tried and ruled out
Keeping discovery-only QUESTION/HYPOTHESISE handlers left visible intent out of the committed Atlas context. Clearing the stale compile message during refresh hid the discard refusal. Adding a rendered compare/branch/defer surface would expand this tranche beyond the existing authority and roadmap dependency.

## Watch out
`trail check` still reports inherited lexical conflicts in the retained FM2 plan document; the commit message records that these are historical wording matches, not restored TypeScript/Rust fallback or mock-only authority. Full Vitest and real Chromium evidence are required for future changes to this path.
