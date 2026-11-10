---
title: "FM2 browser review: typed dataset turnover leaves direct lineage"
author: Tsatsuamable
date: 2026-10-25
branch: director/20261024-fm2-browser
---

## Decided
The FM2 browser diff fences direct runtime capabilities and row-backed dataset turnover, but the sibling AtlasCore.loadTypedDataset production path does not clear InvestigationAggregate direct feedback lineage or _formaState.

## Tried and ruled out
Focused real-WASM/Worker, replay, continuity, typecheck, lint, docs:check, and 28 focused integration tests passed. Normal Playwright could not be verified in this sandbox: production build wasm-bindgen install and preview listen both returned EPERM.

## Watch out
Add a typed-dataset turnover regression through the production Atlas/session/review path; assert old alternatives disappear and are not serialized after a typed replacement. Treat the retained plan lexical trail conflicts as inherited until the plan is rewritten or subordinated.
