---
title: FM2 direct lineage survives turnover in session restore
author: Tsatsuamable
date: 2026-10-25
branch: director/20261024-fm2-browser
touches:
  - src/app/bootstrap.ts
  - src/atlas/domain/InvestigationAggregate.ts
  - src/session/NemosyneSession.ts
  - tests/smoke/fm2-browser-direct-loop.spec.ts
---

## Decided

Persist direct critique-to-alternative lineage as a lineage-only Forma snapshot after context turnover. Rehydrate that snapshot after Atlas state restore, and refresh the desktop review rail on HISTORY_SEEK so restored evidence is visible without reviving stale controls.

## Tried and ruled out

Keeping the existing active-compilation-only serialization silently omitted the links. Rehydrating before Atlas restore was also insufficient because the authoritative restore path can clear dataset-bound state; the production rail additionally needed a history refresh.

## Watch out

The normal FM2 Chromium smoke is the production falsifier: it must show one recorded alternative after turnover, checkpoint restore, and portable reopen while critique/prefer remain disabled. trail check still reports inherited lexical conflicts in the retained FM2 plan document.
