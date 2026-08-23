# Draco Compatibility Inventory

This inventory is scoped to the Moneta Migration Completion Sprint. `src/draco/**` is compatibility surface only; production code should import Moneta directly unless a documented external compatibility boundary requires otherwise.

## Current production consumers

| Consumer | Draco surface | Classification | Migration action |
|---|---|---|---|
| `src/vr/registerFactories.ts` | `VRTopologyTranslator` | obsolete internal compatibility import | **migrated to Moneta in this branch** |
| `src/ui/FileLoader.ts` | `TopologyTypes` via `ConstraintEngine` | obsolete internal compatibility import | migrate to `src/moneta/ConstraintEngine.ts` |
| `src/vr/coordinators/LiveStreamCoordinator.ts` | `TopologyTypes` via `ConstraintEngine` | obsolete internal compatibility import | migrate to `src/moneta/ConstraintEngine.ts` |
| `src/vr/coordinators/WorldRendererLifecycle.ts` | `DracoDataInput`, `DracoFacts`, `DracoTopologyNode` | legacy type vocabulary over Moneta contracts | migrate imports to Moneta, preserve aliases locally only while downstream naming is cleaned |

`src/vr/World.ts` already imports the Moneta implementation directly while retaining temporary local `Draco*` aliases for compatibility vocabulary; it is not a live Draco authority path.

## Compatibility package rule

- Files under `src/draco/**` may re-export or alias `src/moneta/**`.
- Application/runtime production code should not add new imports from `src/draco/**`.
- Tests explicitly exercising legacy compatibility may continue importing `src/draco/**` until the final migration-exit slice.
- Any non-trivial implementation found under `src/draco/**` is a migration blocker and must be moved to Moneta or deleted.

## Exit condition

This inventory is complete when all production consumers above import Moneta directly and a repository architecture test prevents new production imports from `src/draco/**`. At that point the remaining Draco tree can be evaluated mechanically for deletion versus public compatibility retention.
