# P1-QV5/QV6 headset validation closed-loop — pre-implementation adversarial review

**Date:** 2026-09-05  
**Base:** `main@277c2e73f9206f5b387a856bc8298d8247e39376`  
**Scope:** device-facing validation identity, deliberate run start, evidence delivery acknowledgement, same-build/device protocol progress, and the bounded QV5 guided physical-UX runner.

## Finding

The existing Quest measurement path is materially stronger than its on-device verification experience. `LoadTestPanel` can measure and display performance truth, while QV1-QV3 already own exact source/session attribution, ADB device identity and per-session evidence routing. The defect is the seam between those systems: the headset does not project the existing validation truth, does not receive a durable delivery acknowledgement, and cannot show whether the three-run discipline has actually been satisfied by stored evidence.

The fix must therefore **not** create another promotion or device-identity authority in VR UI code.

## Authority map

- Validation mode/gates/evidence class: `src/validation/validation-manifest.ts`.
- Exact build/worktree/device attribution: `scripts/quest-validation.mjs` + ADB capture.
- Browser session tagging: `src/validation/validation-session.ts`.
- Physical runtime facts: `src/vr/scalability/QuestTelemetry.ts`.
- Evidence persistence: `dev/loadtest-server.ts` under ignored `logs/validation/<session>/`.
- Performance thresholds/verdicts: existing load-test subsystem; unchanged by this tranche.
- QV5 outcomes: bounded semantic pass/fail/not-run records only. No raw pose, biometric, dataset-row or unrestricted gesture trace capture is introduced.

## Falsification questions

1. Can an ordinary `npm run dev` session accidentally become governed evidence? It must remain generic and backward compatible.
2. Can a mismatched or malformed browser session write into the active validation session? It must fail closed.
3. Can the headset increment a local “3/3” counter without evidence reaching disk? It must not; progress must be computed from stored, attributable artifacts.
4. Can a governed run bypass the heavy-run confirmation through the existing developer start callback? It must not.
5. Can manual URL firmware/run labels override machine-captured ADB identity in governed telemetry? They must not.
6. Can QV5 create a second interaction telemetry system or capture raw trajectories by convenience? It must not.
7. Can the new operator surface leak into ordinary production bundles? Existing DEV-only composition and production-bundle exclusion gates must continue to prove it does not.
8. Can QV5 runner existence itself close UX gates? No. It only produces attributable physical evidence for later adjudication.

## Planned implementation

- Add a fail-closed browser projection of launcher-provided validation identity.
- Align Quest runtime telemetry with that governed session before falling back to legacy URL declarations.
- Extend the existing dev evidence sink with opt-in receipt v1, exact active-manifest status, and same-build/device progress computed from written artifacts.
- Add a dev-only `ValidationOperatorPanel` as the governed start surface; keep the legacy `LoadTestPanel` for ad-hoc development only.
- Require an arm/confirm sequence before Quest performance and 10M boundary starts.
- Implement the QV5 task vocabulary as bounded semantic outcomes plus a comfort observation, stored as `ux-results.json` and `comfort-observation.json` only under the matching `quest-ux` session.
- Preserve simulator/physical and Vite-dev/clean-production evidence-class boundaries.

## STOP conditions

Stop rather than promote the tranche if tests show any path that can:

- write foreign/malformed evidence into a governed session;
- count uncaptured runs;
- label simulator or generic dev data as physical governed evidence;
- bypass deliberate heavy-run start in a governed session;
- treat the 10M boundary as final device qualification; or
- capture unbounded/raw user interaction data as part of QV5.
