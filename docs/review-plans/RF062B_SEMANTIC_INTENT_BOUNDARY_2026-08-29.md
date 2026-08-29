# RF-062B — typed semantic intent boundary

**Status:** IMPLEMENTATION LANDED / REVIEW ACTIVE

**Parent:** RF-062 World composition-root convergence

## Goal

Give interaction adapters one application-facing vocabulary before moving workflow ownership out of `World`. The seam must reduce coupling rather than rename World as an application controller.

This tranche deliberately covers a representative cross-modality slice first: dataset navigation, analytical operation, history and workspace-lens actions. High-frequency pointer/pose/hover/frame traffic remains direct and is not routed through the command layer.

## Production path

```text
desktop AnalystJourneyControls ─┐
                                ├─> ApplicationIntentDispatcher
hand/controller gesture input ──┘          |
                                           v
                                  bootstrap-owned handlers
                                           |
                                           v
                              current World compatibility facade
                                           |
                          existing authoritative subsystem behavior
```

`bootstrap.ts` is the migration composition point. It creates the typed dispatcher, binds the already-created `WorldInputCoordinator.callbacks` to semantic intents, and supplies the same dispatcher to the desktop analyst controls.

The current handlers intentionally delegate to existing behavior:

- `dataset.cycle` -> `World._cycleDataset`;
- `analysis.apply` -> `DataOperationController.applyAsync`;
- `analysis.reset` -> `World.resetDataOperation`;
- `history.undo` / `history.redo` -> existing World compatibility methods;
- `workspace.toggleStatisticalLens` -> existing World compatibility method.

This is a seam, not the final application architecture. Later RF-062 tranches move ownership behind these intents; callers should not need to change again.

## Boundaries

- No `World`, `Partial<World>`, service locator or broad host object is introduced outside bootstrap.
- `ApplicationIntent.ts` owns only the small semantic vocabulary and exhaustive dispatch mapping.
- `InputIntentBindings.ts` depends on a consumer-shaped callback interface, not `WorldInputCoordinator`, so the application layer does not import an input implementation.
- Unknown input operation strings fail closed at the adapter instead of being cast into the intent vocabulary.
- Dispatch failures are surfaced through an explicit adapter error hook.
- Intents are commands: one request has one owning handler. Existing events remain notifications and are not repurposed as universal control flow.
- Frame-loop, hover, pointer, pose, locomotion and capture mechanics stay outside this boundary.
- Rust/WASM/Atlas/Moneta analytical authority is unchanged. The intent layer chooses no analytical result and implements no analytical fallback.

## Falsification evidence

`tests/application-semantic-intents.test.ts` must prove:

1. every declared intent invokes exactly one owning handler;
2. the input callback adapter maps dataset, analysis, reset, undo, redo and statistical-lens mechanics to the typed vocabulary;
3. an unknown analytical operation is rejected rather than coerced;
4. representative desktop UI actions for dataset, analysis, history and workspace state emit the same typed vocabulary used by input;
5. no duplicate semantic dispatch is introduced for those test actions.

Required production gates remain typecheck, lint, architecture boundaries, coverage, production build, Chromium smoke, CodeQL, approval-gate and exact-head Q9 evidence.

## Adversarial review focus

Reject this tranche if review finds any of the following:

- `ApplicationIntentDispatcher` becoming a dependency bag or generic service locator;
- analytical logic moving into the application intent layer;
- gesture mechanics or frame-rate traffic being serialized through intents;
- a second semantic execution path running in parallel with the existing action for one gesture/control activation;
- broad input/UI implementation types leaking into the application contract;
- tests proving only that classes exist rather than that real production adapters use the seam.

## Exit interpretation

The RF-062B representative exit gate is satisfied only when exact-head production evidence agrees with the unit falsifiers: desktop UI and gesture input must both traverse the same typed application boundary for at least dataset, analysis, history and workspace actions. Legacy UI surfaces not yet migrated remain compatibility callers; RF-062C/D and later cleanup must not create a second competing intent vocabulary while those callers converge.
