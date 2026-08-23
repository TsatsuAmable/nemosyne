# Draco Compatibility Inventory

This inventory is scoped to the Moneta Migration Completion Sprint. `src/draco/**` is compatibility surface only; production code imports Moneta directly.

## Production consumers

**None.** The previously identified internal consumers now import `src/moneta/**` directly:

- `src/vr/registerFactories.ts` → Moneta `VRTopologyTranslator`;
- `src/ui/FileLoader.ts` → Moneta `ConstraintEngine` topology constants;
- `src/vr/coordinators/LiveStreamCoordinator.ts` → Moneta `ConstraintEngine` topology constants;
- `src/vr/coordinators/WorldRendererLifecycle.ts` → Moneta types and `MonetaTopologyNode`.

`src/vr/World.ts` already used Moneta directly. Temporary local `Draco*` variable/type aliases may remain where renaming them would create unrelated churn; they are vocabulary compatibility, not imports or authority paths.

## Compatibility package rule

- Files under `src/draco/**` may only re-export or alias `src/moneta/**`.
- Application/runtime production code may not import from `src/draco/**`.
- Tests explicitly exercising legacy compatibility may continue importing `src/draco/**` until the final migration-exit slice.
- Any non-trivial implementation found under `src/draco/**` is a migration blocker and must be moved to Moneta or deleted.

## Inventory result

The production import/call-site inventory is complete. `tests/draco-production-import-boundary.test.ts` enforces a zero-production-import boundary. The remaining work is mechanical classification of the compatibility tree into retained public aliases versus obsolete files that can be deleted safely.
