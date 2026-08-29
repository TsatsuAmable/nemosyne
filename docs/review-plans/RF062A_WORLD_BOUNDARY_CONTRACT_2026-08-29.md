# RF-062A — World composition-root boundary contract

**Status:** IMPLEMENTATION / REVIEW ACTIVE

**Parent:** `RF062_WORLD_COMPOSITION_ROOT_CONVERGENCE_2026-08-29.md`

## Governing invariant

> **World may know everybody; nobody else may know World.**

`src/vr/World.ts` is the runtime composition root and compatibility facade. Feature, domain, presentation, session, input, collaboration, live-service and analytical modules must not import or receive `World` as an application dependency.

This tranche prevents new dependency-direction regressions before later RF-062 tranches move ownership out of World. It does not claim that World has already converged or that broad coordinator contracts have already been removed.

## Blocking rule

The already-required Q0 dependency-cruiser boundary set now contains `world-is-composition-root`.

The rule rejects a `src/**` module importing `src/vr/World.ts` unless the importer is one of the explicitly reviewed composition/diagnostic adapters below. It runs through the existing `architecture:boundaries:test` and `architecture:boundaries` steps in the required Node 24 CI chain. No second architecture-policy engine or required workflow is introduced.

## Approved exceptions

The initial migration allowlist is deliberately narrow:

- `src/app/bootstrap.ts` — canonical composition/bootstrap entry point;
- `src/app/diagnostics.ts` — existing diagnostics adapter;
- `src/app/browserEnvelopeDiagnostics.ts` — governed browser-envelope instrumentation;
- `src/app/resourceEnvelopeDiagnostics.ts` — governed resource-envelope instrumentation.

These are **exceptions, not architectural destinations**. They may compose or observe the World compatibility facade while RF-062H moves optional diagnostic/load-test installation out of the core graph. New exceptions require an explicit RF-062 review-plan update explaining why the dependency cannot instead be expressed as a narrow capability.

## What this mechanically prevents

Because production modules cannot import the `World` type/value, a new feature module cannot directly accept `World`, `Partial<World>`, `{ world: World }`, or otherwise depend on World through a normal TypeScript import without tripping the required boundary gate.

This does **not** prove that every existing locally-declared broad host/callback bag is narrow. Detecting architectural shape from property count or naming heuristics would create a noisy pseudo-rule. Those contracts are reviewed and retired tranche-by-tranche under RF-062C through RF-062I, while this rule prevents the strongest form of back-reference from spreading.

## Falsifying fixture

`scripts/check-architecture-boundary-fixture.mjs` reuses the exact blocking production rule objects and proves three states in an isolated temporary tree:

1. a production-to-Draco dependency still fails with `no-production-draco-imports`;
2. a feature-to-World dependency fails with `world-is-composition-root`;
3. after repairing the feature edge, an approved bootstrap-to-World composition edge passes.

The fixture therefore proves both fail-closed rejection and the intended positive exception. It does not rely on a permanently-invalid production fixture or source-text grep.

## Adversarial boundaries

RF-062A must not:

- prohibit `World` from composing the runtime;
- move behavior merely to make the rule pass;
- introduce `WorldContext`, `WorldServices`, a service locator, or another object that recreates World under a different name;
- make diagnostics a blanket exemption for feature code;
- infer architectural quality from World line count;
- alter Atlas/Rust/WASM/Moneta authority;
- claim that local broad host bags are solved simply because direct World imports are blocked.

## Exit gate

RF-062A may be marked `IMPLEMENTATION LANDED / REVIEW ACTIVE` when:

- the negative World fixture fails for the intended rule;
- the approved bootstrap fixture passes;
- the real repository passes `architecture:boundaries` with no new violations;
- ordinary exact-head CI, CodeQL, approval-gate and Q9 promotion evidence are green before merge;
- post-implementation review finds no broadened allowlist, replacement service locator or accidental runtime behavior change.

RF-062A is only the guardrail. RF-062B remains the next architecture tranche: introduce typed semantic intents so UI/input callers can migrate off direct World callbacks without creating a replacement god coordinator.
