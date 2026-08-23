# Draco Compatibility Inventory

This inventory is scoped to the Moneta Migration Completion Sprint. `src/draco/**` is compatibility surface only; production code imports Moneta directly.

## Production consumers

**None.** The previously identified internal consumers now import `src/moneta/**` directly:

- `src/vr/registerFactories.ts` -> Moneta `VRTopologyTranslator`;
- `src/ui/FileLoader.ts` -> Moneta `ConstraintEngine` topology constants;
- `src/vr/coordinators/LiveStreamCoordinator.ts` -> Moneta `ConstraintEngine` topology constants;
- `src/vr/coordinators/WorldRendererLifecycle.ts` -> Moneta types and `MonetaTopologyNode`;
- `src/vr/World.ts` -> Moneta directly.

`tests/draco-production-import-boundary.test.ts` enforces the zero-production-import boundary.

## Compatibility classification - 23 August 2026

The former Draco tree contained a file-for-file mirror of Moneta's layouts, representation and empirical-evidence modules. Those deep mirrors had no production consumers and were used only by a small number of legacy-named tests. The migration-exit slice moves those tests to canonical Moneta imports and deletes the mirrored subtrees:

- `src/draco/layouts/**` -> **obsolete, deleted**;
- `src/draco/representation/**` -> **obsolete, deleted**;
- `src/draco/evidence/**` -> **obsolete, deleted**.

The remaining top-level files are thin one-line aliases/re-exports only:

- `ConstraintEngine.ts`;
- `ConstraintArbiter.ts`;
- `DracoTopologyNode.ts`;
- `VRTopologyTranslator.ts`;
- `SpatialStrategy.ts`;
- `PositionSemantics.ts`;
- `TDAGlyphs.ts`;
- `EmbodimentHints.ts`;
- `EvidenceInformedRecommender.ts`;
- `RepresentationRequirements.ts`;
- `types.ts`;
- `index.ts`.

They contain no independent analytical, scoring, layout or representation implementation. They are retained temporarily because legacy tests and source-path consumers still exercise individual historical entry points. `src/draco/index.ts` is the preferred compatibility facade.

## Compatibility rule

- Production application/runtime code must import `src/moneta/**` directly.
- Any retained `src/draco/**` file must be a pure alias/re-export with no computation or state.
- New code and new tests must not introduce deep or direct Draco dependencies except a test explicitly proving the compatibility facade.
- A non-trivial implementation under `src/draco/**` is a migration blocker.
- Legacy vocabulary aliases such as `DracoSpec`, `DracoFacts` or `DracoEmpiricalTuner` may remain in canonical Moneta modules while deprecation/migration compatibility is required; aliases do not constitute a second authority.

## Removal plan

1. Migrate remaining ordinary tests from top-level `src/draco/<name>.ts` imports to canonical Moneta imports.
2. Keep one focused compatibility contract that imports `src/draco/index.ts` and proves the legacy facade resolves to Moneta authority.
3. Delete top-level per-file shims once no intentional direct-path compatibility consumer remains.
4. Retain `src/draco/index.ts` only for the declared compatibility window, then remove it under an explicit breaking-change/deprecation decision.

## Inventory result

The production import/call-site inventory is **DONE**. The deep compatibility tree is collapsed. The remaining migration work is a bounded top-level compatibility surface, not hidden implementation authority.
