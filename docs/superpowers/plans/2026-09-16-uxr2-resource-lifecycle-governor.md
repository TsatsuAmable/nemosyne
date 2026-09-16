# UXR2 Resource Lifecycle Governor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the first production `ACTIVE -> WARM -> COLD -> EVICTED` presentation-resource lifecycle so Nemosyne's retained Three.js resources follow the bounded semantic working set rather than session age.

**Architecture:** Add a standalone `ResourceLifecycleGovernor` that owns presentation residency policy and telemetry, not analytical meaning. `RepresentationSurface` remains the semantic projection owner and registers/demotes representation runtimes through the governor; a stepwise Three.js adapter makes cleanup genuinely amortised. Worker/Rust dataset residency remains unchanged and fail closed.

**Tech Stack:** TypeScript, Three.js, Vitest, WebXR runtime composition through `World`, existing Node 24 / Rust-WASM CI.

**Spec:** `docs/superpowers/specs/2026-09-16-uxr2-resource-lifecycle-governor-design.md`

## Global Constraints

- Rust/WASM and Atlas remain analytical authority; this governor owns presentation residency only.
- `ACTIVE` resources explicitly present in the working set cannot be evicted by pressure or capacity cleanup.
- Cold descriptors must not retain a `Dataset`, arbitrary row arrays, Three.js objects, GPU/transfer buffers, or the outgoing `MonetaDataInput`.
- Worker/WASM residency is out of scope until an explicit governed release ABI exists.
- Over-capacity working-set declarations fail atomically and preserve the previous safe state.
- Expensive projection disposal must be stepwise; wrapping recursive `disposeObject()` in one queued callback is insufficient.
- Lifecycle async completions may mutate a record only when their captured lifecycle revision still matches.
- Physical long-session stability is not claimed by this PR; that remains UXR4/UXR5 evidence.
- Execute and promote under the repository-supported Node 24 runtime.

---## File Map

- Create `src/vr/scalability/ResourceLifecycleGovernor.ts`: lifecycle types, stable identity keying, atomic working-set reconciliation, bounded cleanup queue, stale-revision protection, telemetry snapshots, final drain.
- Create `src/vr/presentation/representation/RepresentationResourceLifecycle.ts`: representation-specific runtime adapter and bounded cold descriptor; no analytical authority.
- Modify `src/utils/Dispose.ts`: add non-recursive disposal primitive used by the stepwise adapter while preserving existing recursive `disposeObject()` semantics.
- Modify `src/vr/presentation/representation/RepresentationSurface.ts`: register the active projection, retire the outgoing projection through the governor, preserve selection identity, retain immediate-dispose fail-safe when lifecycle registration cannot be established.
- Modify `src/vr/World.ts`: own/configure/tick/dispose the governor, derive resource identity from Atlas, expose descriptive lifecycle telemetry.
- Modify `src/app/uv0TestHandle.ts`: expose the lifecycle snapshot in dev/test instrumentation only.
- Create `tests/resource-lifecycle-governor.test.ts`: pure lifecycle, boundedness, capacity refusal, stale async and telemetry falsifiers.
- Create `tests/representation-resource-lifecycle.test.ts`: bounded descriptor and incremental Three.js cleanup falsifiers.
- Modify `tests/rf062c-representation-surface.test.ts`: lifecycle-aware replace/clear/dispose behavior and immediate fallback.
- Modify `tests/stream-a-a3-bounded-observation-transition.test.ts`: prove detail clears immediately when its parent leaves ACTIVE while analytical Worker rules remain unchanged.
- Modify `tests/rf062c-world-production-path.test.ts`: production composition/tick/teardown evidence.

---

### Task 1: Pure Resource Lifecycle Authority

**Files:**

- Create: `src/vr/scalability/ResourceLifecycleGovernor.ts`
- Create: `tests/resource-lifecycle-governor.test.ts`

**Interfaces:**

- Consumes: no Moneta/Atlas scientific types; identity is durable metadata only.
- Produces: `ResourceResidency`, `ResourceIdentity`, `WorkingSetDeclaration`, `ResourceLifecyclePolicy`, `ResourceLifecycleAdapter`, `ResourceLifecycleGovernor`, `ResourceLifecycleSnapshot`.
- [ ] **Step 1: Write the failing state-machine tests**

Add tests for stable identity separation, active protection, atomic over-capacity refusal, WARM/COLD/EVICTED progression, EVICTED record removal, and deterministic snapshots:

```ts
const policy: ResourceLifecyclePolicy = {
  policyVersion: 'test/v1',
  maxDeclarations: 1,
  maxActiveResources: 1,
  maxWarmResources: 0,
  maxColdDescriptors: 0,
  maxCleanupOperationsPerTick: 1,
  maxTransitionEvents: 8,
};

type TestDescriptor = { schemaVersion: 'test/v1'; id: string };
type TestRuntime = { id: string };

function identity(semanticId: string): ResourceIdentity {
  return {
    family: 'TEST',
    datasetFingerprint: 'fp',
    datasetGeneration: 1,
    datasetVersion: 1,
    decisionId: 'decision',
    semanticId,
  };
}
function active(semanticId: string): WorkingSetDeclaration {
  return { identity: identity(semanticId), desired: 'ACTIVE', priority: 'FOCUS' };
}
function fakeRegistration(
  resourceIdentity: ResourceIdentity,
  overrides: Partial<ResourceLifecycleAdapter<TestRuntime, TestDescriptor>> = {}
): ResourceRegistration<TestRuntime, TestDescriptor> {
  return {
    identity: resourceIdentity,
    runtime: { id: resourceIdentity.semanticId },
    adapter: {
      family: 'TEST',
      validateDescriptor: (value): value is TestDescriptor =>
        typeof value === 'object' &&
        value !== null &&
        (value as TestDescriptor).schemaVersion === 'test/v1' &&
        typeof (value as TestDescriptor).id === 'string',
      detach: vi.fn(),
      coolStep: vi.fn(() => ({
        status: 'COMPLETE',
        descriptor: { schemaVersion: 'test/v1', id: resourceIdentity.semanticId },
      })),
      forceDispose: vi.fn(),
      ...overrides,
    },
  };
}

it('refuses an over-capacity declaration without mutating the prior safe state', () => {
  const governor = new ResourceLifecycleGovernor(policy);
  governor.register(fakeRegistration(identity('a')));
  expect(governor.reconcile([active('a')]).accepted).toBe(true);
  const before = governor.getSnapshot();
  expect(governor.reconcile([active('a'), active('b')])).toEqual(
    expect.objectContaining({ accepted: false })
  );
  expect(governor.getSnapshot().counts).toEqual(before.counts);
});
```

- [ ] **Step 2: Run the new test file and prove RED**

Run: `npx vitest run tests/resource-lifecycle-governor.test.ts`

Expected: FAIL because `ResourceLifecycleGovernor.ts` and its exports do not exist.

- [ ] **Step 3: Implement the minimal public lifecycle contracts and atomic reconciliation**

Use explicit identity fields rather than `JSON.stringify` order for the key:

```ts
export type ResourceResidency = 'ACTIVE' | 'WARM' | 'COLD' | 'EVICTED';
export type DesiredResidency = 'ACTIVE' | 'WARM';
export type WorkingSetPriority = 'FOCUS' | 'CONTEXT' | 'SPECULATIVE';

export interface ResourceIdentity {
  family: string;
  datasetFingerprint: string | null;
  datasetGeneration: number | null;
  datasetVersion: number | null;
  decisionId: string | null;
  semanticId: string;
}

export interface WorkingSetDeclaration {
  identity: ResourceIdentity;
  desired: DesiredResidency;
  priority: WorkingSetPriority;
}

export interface ResourceLifecyclePolicy {
  policyVersion: string;
  maxDeclarations: number;
  maxActiveResources: number;
  maxWarmResources: number;
  maxColdDescriptors: number;
  maxCleanupOperationsPerTick: number;
  maxTransitionEvents: number;
}

export type LifecycleStepResult<D> = { status: 'PENDING' } | { status: 'COMPLETE'; descriptor: D };

export interface ResourceLifecycleAdapter<R, D> {
  family: string;
  validateDescriptor(value: unknown): value is D;
  detach(runtime: R): void;
  coolStep(runtime: R): LifecycleStepResult<D> | Promise<LifecycleStepResult<D>>;
  forceDispose(runtime: R): void | Promise<void>;
  reconstruct?(descriptor: D): R | Promise<R>;
}

export interface ResourceRegistration<R, D> {
  identity: ResourceIdentity;
  runtime: R;
  adapter: ResourceLifecycleAdapter<R, D>;
  estimatedCost?: number | null;
}

export function resourceIdentityKey(identity: ResourceIdentity): string {
  return [
    identity.family,
    identity.datasetFingerprint ?? '',
    identity.datasetGeneration ?? '',
    identity.datasetVersion ?? '',
    identity.decisionId ?? '',
    identity.semanticId,
  ]
    .map((part) => encodeURIComponent(String(part)))
    .join('|');
}
```

`validateWorkingSet()` performs the same complete capacity/duplicate checks without mutation. `reconcile()` must call that validation before changing any record. Duplicate keys, declaration overflow, ACTIVE overflow, or declared-WARM overflow return `{ accepted: false, reason }` and leave the current records untouched.

- [ ] **Step 4: Run Task 1 tests and make them GREEN**

Run: `npx vitest run tests/resource-lifecycle-governor.test.ts`

Expected: PASS for identity, capacity, ACTIVE protection and deterministic transition tests.

- [ ] **Step 5: Commit the pure authority**

```bash
git add src/vr/scalability/ResourceLifecycleGovernor.ts tests/resource-lifecycle-governor.test.ts
git commit -m "feat(uxr2): add resource lifecycle authority"
```

---

### Task 2: Bounded Cleanup, Async Revision Safety, and Telemetry

**Files:**

- Modify: `src/vr/scalability/ResourceLifecycleGovernor.ts`
- Modify: `tests/resource-lifecycle-governor.test.ts`

**Interfaces:**

- Consumes: Task 1 lifecycle records and policy.
- Produces: adapter stepping, `tick()`, `dispose()`, lifecycle transition ring and cumulative snapshot counters.
- [ ] **Step 1: Add RED tests for bounded work and stale async completion**

Use a deferred adapter completion to prove old revisions cannot commit after a newer declaration:

```ts
it('ignores a delayed cool completion after the record revision advances', async () => {
  let resolveDeferred!: (value: LifecycleStepResult<TestDescriptor>) => void;
  const deferred = new Promise<LifecycleStepResult<TestDescriptor>>((resolve) => {
    resolveDeferred = resolve;
  });
  const governor = new ResourceLifecycleGovernor({ ...policy, maxWarmResources: 0 });
  governor.register(fakeRegistration(identity('a'), { coolStep: () => deferred.promise }));
  governor.reconcile([active('a')]);
  governor.reconcile([]);
  governor.tick();

  governor.register(fakeRegistration(identity('a'))); // fresh runtime, newer revision
  governor.reconcile([active('a')]);
  deferred.resolve({ status: 'COMPLETE', descriptor: { schemaVersion: 'test/v1', id: 'stale' } });
  await Promise.resolve();

  expect(governor.getSnapshot().counts.ACTIVE).toBe(1);
  expect(governor.getSnapshot().counts.COLD).toBe(0);
});
```

Also assert that 20 queued resources with `maxCleanupOperationsPerTick: 3` start at most three cleanup steps per call to `tick()`.

- [ ] **Step 2: Run the focused file and prove the new assertions RED**

Run: `npx vitest run tests/resource-lifecycle-governor.test.ts`

Expected: FAIL because `tick()`, async revision checks and transition telemetry are absent.

- [ ] **Step 3: Implement bounded cleanup and revision-checked completion**

Each record owns a monotonically increasing `revision` and optional `inFlightRevision`. `tick()` starts no more than `maxCleanupOperationsPerTick` work units and captures the revision before invoking an adapter step. Apply a completion only when the record still exists and `record.revision === capturedRevision`.

When `coolStep()` returns `COMPLETE`, validate the descriptor before setting `runtime = null` and moving to `COLD`. Descriptor validation failure leaves the record WARM, records an error transition, and must not claim reclamation.

When `COLD` count exceeds `maxColdDescriptors`, transition the oldest undeclared COLD record to EVICTED, record the bounded event, and remove the live record immediately.

- [ ] **Step 4: Implement descriptive telemetry**

```ts
export interface ResourceLifecycleSnapshot {
  policyVersion: string;
  declaredWorkingSetSize: number;
  counts: Record<ResourceResidency, number>;
  queuedCleanupCount: number;
  transitions: readonly ResourceLifecycleTransition[];
  cumulative: {
    cooled: number;
    evicted: number;
    reconstructed: number;
    failed: number;
  };
}
```

Keep only `maxTransitionEvents` transition records. A requested transition that fails must increment `failed` and must not increment `cooled`, `evicted`, or `reconstructed`.

- [ ] **Step 5: Implement final drain for world teardown**

`dispose()` may perform immediate `forceDispose()` after the engine is paused because there is no interactive frame budget during final teardown. It must be idempotent, await any force-dispose promises, clear records/queues, and reject future registrations.

- [ ] **Step 6: Run focused tests and typecheck**

Run:

```bash
npx vitest run tests/resource-lifecycle-governor.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit bounded cleanup and telemetry**

```bash
git add src/vr/scalability/ResourceLifecycleGovernor.ts tests/resource-lifecycle-governor.test.ts
git commit -m "feat(uxr2): bound lifecycle cleanup and telemetry"
```

---

### Task 3: Stepwise Three.js Representation Adapter

**Files:**

- Modify: `src/utils/Dispose.ts`
- Create: `src/vr/presentation/representation/RepresentationResourceLifecycle.ts`
- Create: `tests/representation-resource-lifecycle.test.ts`

**Interfaces:**

- Consumes: Task 2 `ResourceLifecycleAdapter`.
- Produces: `disposeObjectShallow()`, `RepresentationResourceRuntime`, `RepresentationColdDescriptorV1`, `createRepresentationResourceAdapter()`.
- [ ] **Step 1: Write RED tests for shallow disposal and descriptor safety**

Prove one call disposes only the named object, not its whole subtree:

```ts
it('disposeObjectShallow does not recursively dispose children', () => {
  const parent = new THREE.Group();
  const child = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  const disposeGeometry = vi.spyOn(child.geometry, 'dispose');
  parent.add(child);

  disposeObjectShallow(parent);

  expect(disposeGeometry).not.toHaveBeenCalled();
});
```

Add an adapter test with a node whose `dataInput` contains both `dataset` and `rows`. After cooling completes, assert the descriptor equals only fixed primitive identity fields and contains neither object by reference nor serialized row content.

- [ ] **Step 2: Run the new adapter test and prove RED**

Run: `npx vitest run tests/representation-resource-lifecycle.test.ts`

Expected: FAIL because the shallow disposer and adapter do not exist.

- [ ] **Step 3: Refactor `Dispose.ts` without changing recursive behavior**

Extract the existing single-object work into a public helper, then keep recursion in `disposeObject()`:

```ts
export function disposeObjectShallow(
  obj: THREE.Object3D | { dispose(): void } | null | undefined
): void {
  if (!obj) return;
  // Dispose this object's non-shared geometry, material textures/material,
  // invoke its own dispose() when present, then detach from parent.
  // Do not recurse into children here.
}

export function disposeObject(obj: THREE.Object3D | { dispose(): void } | null | undefined): void {
  if (!obj) return;
  const object3D = obj as THREE.Object3D;
  const children = object3D.children ? object3D.children.slice() : [];
  disposeObjectShallow(obj);
  for (const child of children) disposeObject(child);
}
```

Run existing disposal/GPU tests after this refactor so shared pooled geometries retain their current protection.

- [ ] **Step 4: Implement the fixed representation runtime and descriptor**

```ts
export interface RepresentationColdDescriptorV1 {
  schemaVersion: 'representation-resource/v1';
  datasetFingerprint: string | null;
  datasetGeneration: number | null;
  datasetVersion: number | null;
  decisionId: string | null;
  semanticId: string;
  representationKind: string | null;
}

export interface RepresentationResourceRuntime {
  identity: ResourceIdentity;
  node: MonetaTopologyNode;
  diagnostic: MonetaDiagnosticHUD | null;
  disposalStack: THREE.Object3D[];
  diagnosticDisposed: boolean;
}
```

Do not put `dataInput`, `Dataset`, row arrays, `semanticEmbodimentPromise`, or Worker payloads on either interface.

- [ ] **Step 5: Implement one-work-unit-at-a-time cooling**

`detach()` must cancel pending semantic embodiment, unregister updatable/interactable/diagnostic authority, clear structure handles, and remove the node/diagnostic groups from their parents without disposing their trees.

`coolStep()` processes exactly one unit per invocation: either one `Object3D` from `disposalStack` using `disposeObjectShallow()`, or the diagnostic object's final `dispose()`. Before shallow disposal of an object, copy/push its current children so they become later units. When the stack and diagnostic are exhausted, return:

```ts
return {
  status: 'COMPLETE',
  descriptor: {
    schemaVersion: 'representation-resource/v1',
    ...runtime.identity,
    representationKind: runtime.node.representationDecision?.chosenCandidateId ?? null,
  },
};
```

The descriptor validator must check exact primitive fields and reject extra object-bearing values rather than trusting a type assertion.

- [ ] **Step 6: Implement `forceDispose()` for paused teardown**

Drain the remaining stack synchronously with `disposeObjectShallow()`, dispose the diagnostic once, and tolerate repeated calls.

- [ ] **Step 7: Run focused + existing lifecycle regressions**

Run:

```bash
npx vitest run tests/representation-resource-lifecycle.test.ts tests/gpu-resource-lifecycle.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit the adapter**

```bash
git add src/utils/Dispose.ts src/vr/presentation/representation/RepresentationResourceLifecycle.ts tests/representation-resource-lifecycle.test.ts
git commit -m "feat(uxr2): add incremental representation cleanup"
```

---

### Task 4: Wire Lifecycle Ownership into `RepresentationSurface`

**Files:**

- Modify: `src/vr/presentation/representation/RepresentationSurface.ts`
- Modify: `tests/rf062c-representation-surface.test.ts`

**Interfaces:**

- Consumes: Task 2 governor, Task 3 representation adapter.
- Produces: lifecycle-aware replacement/clear/dispose while keeping `RepresentationSurface` the semantic selection/projection owner.
- [ ] **Step 1: Extend the surface tests before production code**

Add lifecycle-aware fixtures with a real test governor and assert:

```ts
it('detaches the outgoing representation immediately but defers heavy disposal to governor ticks', () => {
  surface.replace({ topology: 'TABULAR' }, null);
  surface.replace({ topology: 'TABULAR' }, null);

  expect(removeUpdatable).toHaveBeenCalledWith(first);
  expect(removeInteractable).toHaveBeenCalledWith(first.artifact!.nodeMeshes[0]);
  expect(first.group.parent).toBeNull();
  expect(first.artifact!.nodeMeshes[0].geometry).not.toHaveProperty('disposed', true);
  expect(governor.getSnapshot().queuedCleanupCount).toBeGreaterThan(0);
});
```

Also retain existing tests for replacement-construction failure and selection restoration, plus a fallback test proving that a surface with no lifecycle dependencies uses the old immediate disposal path.

- [ ] **Step 2: Run the surface test and prove the lifecycle assertions RED**

Run: `npx vitest run tests/rf062c-representation-surface.test.ts`

Expected: new lifecycle tests FAIL while existing tests remain green.

- [ ] **Step 3: Add optional lifecycle dependencies**

Extend `RepresentationSurfaceDependencies` with:

```ts
resourceLifecycle?: ResourceLifecycleGovernor;
createResourceIdentity?: (
  decision: RepresentationDecision | null,
  projectionOrdinal: number
) => ResourceIdentity | null;
```

Optionality is the documented fail-safe for isolated tests/legacy callers. Production `World` must provide both; Task 5 supplies production-path evidence.

- [ ] **Step 4: Split current teardown into detach/retire versus immediate fallback**

Before replacement, construct the candidate node and diagnostic while the old current remains authoritative. Increment a private projection ordinal only for a candidate that reaches admission; pass that ordinal to `createResourceIdentity()` so two render incarnations of the same dataset/decision cannot alias one lifecycle record.

For the lifecycle-enabled path, run `validateWorkingSet([next ACTIVE])` before mutating the current surface. If validation refuses, immediately dispose the unbound candidate and keep the old representation/selection untouched. Then register the candidate runtime as WARM and call one atomic `reconcile([next ACTIVE])`; that demotes/detaches the old registered runtime and promotes the new record without ever asking the governor to choose between two semantic foci.

```ts
const nextNode = this.createNode(...); // may throw; old current remains untouched
const nextDiagnostic = this.createDiagnostic(this.dependencies, nextNode);
const ordinal = this.projectionOrdinal + 1;
const identity = this.dependencies.createResourceIdentity?.(representationDecision, ordinal) ?? null;
const declaration = identity ? { identity, desired: 'ACTIVE', priority: 'FOCUS' } as const : null;
if (governor && declaration && !governor.validateWorkingSet([declaration]).accepted) {
  disposeObject(nextNode.group);
  nextDiagnostic.dispose();
  throw new Error('representation lifecycle admission refused');
}
```

If lifecycle dependencies are unavailable, keep the existing immediate recursive disposal path so resources are never leaked merely because lifecycle wiring is absent.

- [ ] **Step 5: Register and atomically swap exactly one ACTIVE representation**

Register the candidate runtime before reconciliation. Capture the old semantic selection, publish `null` so subordinate detail clears, then reconcile `[next ACTIVE]`. If that reconciliation refuses despite successful preflight, unregister/force-dispose the candidate, restore the old selection, and leave the old ACTIVE record untouched because reconciliation itself is atomic. On success, assign `currentNode`/`diagnostic`, bind the new interaction/updatable authority, restore semantic selection by identity, and commit the projection ordinal.

- [ ] **Step 6: Keep `clear()` and `dispose()` semantically immediate**

`clear()` must leave `currentNode`, `diagnostic`, and `selectedMesh` null before it returns, even though heavy GPU disposal continues later. `dispose()` must be idempotent and retire the active projection; the owning `World` drains the governor during final teardown.

- [ ] **Step 7: Run focused representation regressions**

Run:

```bash
npx vitest run tests/rf062c-representation-surface.test.ts tests/representation-resource-lifecycle.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit surface integration**

```bash
git add src/vr/presentation/representation/RepresentationSurface.ts tests/rf062c-representation-surface.test.ts
git commit -m "feat(uxr2): govern representation residency"
```

---

### Task 5: Compose the Governor in Production `World`

**Files:**

- Modify: `src/vr/World.ts`
- Modify: `src/app/uv0TestHandle.ts`
- Modify: `tests/rf062c-world-production-path.test.ts`

**Interfaces:**

- Consumes: Tasks 1-4.
- Produces: canonical production ownership, Atlas-bound resource identity, per-frame cleanup stepping, teardown drain and observable snapshots.
- [ ] **Step 1: Write production-path RED assertions**

Extend `rf062c-world-production-path.test.ts` to assert that a real `World` owns one governor, a successful dataset load produces one ACTIVE representation record, replacing the dataset queues cleanup for the previous projection, and final world disposal empties the lifecycle registry.

```ts
expect(world.resourceLifecycleGovernor.getSnapshot().counts.ACTIVE).toBe(1);
const second = getSampleDataset('fraud-graph');
if (!second) throw new Error('fraud-graph sample is required');
await world.loadDataset({
  name: second.label,
  topology: second.topology,
  dataset: second.dataset,
  maxDepth: second.depth,
});
expect(world.resourceLifecycleGovernor.getSnapshot().queuedCleanupCount).toBeGreaterThan(0);
world.resourceLifecycleGovernor.tick();
```

Do not make the test assert physical memory reduction; it is software residency evidence only.

- [ ] **Step 2: Run the production-path test and prove RED**

Run: `npx vitest run tests/rf062c-world-production-path.test.ts`

Expected: FAIL because `World` has no lifecycle governor composition yet.

- [ ] **Step 3: Add a named production policy and World owner**

Use an intentionally non-caching V1 policy because automatic reconstruction is not yet implemented:

```ts
export const REPRESENTATION_RESOURCE_POLICY_V1: ResourceLifecyclePolicy = {
  policyVersion: 'representation-resource/v1',
  maxDeclarations: 1,
  maxActiveResources: 1,
  maxWarmResources: 0,
  maxColdDescriptors: 0,
  maxCleanupOperationsPerTick: 4,
  maxTransitionEvents: 64,
};
```

`maxWarmResources: 0` and `maxColdDescriptors: 0` make WARM and COLD transition states rather than caches in this first production adapter. The numbers are operational configuration, exposed in telemetry, and make no physical-performance claim.

Add `resourceLifecycleGovernor: ResourceLifecycleGovernor` to `World`, construct it before `RepresentationSurface`, and add `update(): void { this.tick(); }` to `ResourceLifecycleGovernor`, then register it directly with `this.engine.addUpdatable(this.resourceLifecycleGovernor)`.

- [ ] **Step 4: Derive identity from Atlas, not from retained `MonetaDataInput`**

Pass this callback into `RepresentationSurface`:

```ts
createResourceIdentity: (decision, projectionOrdinal) => ({
  family: 'MONETA_REPRESENTATION',
  datasetFingerprint: this.atlas.datasetFingerprint,
  datasetGeneration: this.atlas.generation,
  datasetVersion: this.atlas.datasetVersion,
  decisionId: decision?.id ?? null,
  semanticId: `representation:${decision?.id ?? `v${this.atlas.datasetVersion}`}:projection:${projectionOrdinal}`,
}),
```

This callback reads current durable Atlas identity only; it never closes over `result.dataInput` or source rows.

- [ ] **Step 5: Add descriptive runtime telemetry**

Append compact counts to the existing throttled DOM telemetry:

```ts
const resources = this.resourceLifecycleGovernor.getSnapshot();
const resourceText = `RES: A${resources.counts.ACTIVE}/W${resources.counts.WARM}/C${resources.counts.COLD}/Q${resources.queuedCleanupCount}`;
```

Expose the same structured snapshot through `uv0TestHandle` for dev/verification tooling. Do not add it to durable investigation snapshots or scientific provenance.

- [ ] **Step 6: Make teardown ownership explicit**

After pausing the engine and disposing `RepresentationSurface`, remove the governor from the engine updatables and `await resourceLifecycleGovernor.dispose()` before `engine.dispose()`. Preserve the existing aggregate teardown-error behavior.

- [ ] **Step 7: Run focused production tests**

Run:

```bash
npx vitest run tests/rf062c-world-production-path.test.ts tests/world-lifecycle-owner.test.ts tests/world-recreation-lifecycle.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit production composition**

```bash
git add src/vr/World.ts src/app/uv0TestHandle.ts tests/rf062c-world-production-path.test.ts
git commit -m "feat(uxr2): compose lifecycle governor in world"
```

---

### Task 6: Preserve Semantic-Detail Fail-Closed Semantics

**Files:**

- Modify: `tests/stream-a-a3-bounded-observation-transition.test.ts`
- Production code change: none is planned; if this RED test exposes an ordering defect, fix only the lifecycle/selection ordering necessary to restore the existing fail-closed contract and record that extra production file in the task commit.

**Interfaces:**

- Consumes: `RepresentationSurface.subscribeSelection()` and existing `SemanticDetailTransition.clear()` behavior.
- Produces: evidence that parent retirement clears presentation detail immediately and never repairs Worker residency.
- [ ] **Step 1: Add a lifecycle-parent-retirement test**

Start a READY bounded detail transition, then replace/clear the parent surface through the lifecycle-enabled surface. Assert synchronously, before any governor cleanup tick:

```ts
surface.clear();
expect(transition.snapshot).toEqual(
  expect.objectContaining({ status: 'IDLE', parent: null, observationIds: [] })
);
expect(governor.getSnapshot().queuedCleanupCount).toBeGreaterThan(0);
```

This proves semantic-detail presentation disappears when parent authority detaches, even while heavy projection disposal is still queued.

- [ ] **Step 2: Retain the existing Worker-residency refusal test**

Keep/assert the path where `hasRegisteredDataset(...) !== true` produces the existing refusal text:

```ts
expect(transition.snapshot).toEqual(
  expect.objectContaining({
    status: 'REFUSED',
    refusalReason: 'authoritative dataset is not resident in the analytical Worker',
  })
);
```

The lifecycle governor must not appear in that analytical decision path.

- [ ] **Step 3: Run the semantic-detail lane**

Run:

```bash
npx vitest run tests/stream-a-a3-bounded-observation-transition.test.ts tests/stream-a-a4-exact-datum-inspection.test.ts
```

Expected: PASS without adding any dataset registration or JS analytical fallback.

- [ ] **Step 4: Commit evidence-only test changes**

```bash
git add tests/stream-a-a3-bounded-observation-transition.test.ts
git commit -m "test(uxr2): preserve detail authority during eviction"
```

---

### Task 7: Boundedness Stress Evidence and Roadmap Truth

**Files:**

- Create: `tests/uxr2-resource-lifecycle-boundedness.test.ts`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/roadmap/P1_UXR_SEMANTIC_EFFICIENCY_UX_RUNTIME_AND_VERIFICATION.md`

**Interfaces:**

- Consumes: production-composed governor and representation surface.
- Produces: repeated-transition evidence and honest post-tranche status.

- [ ] **Step 1: Add repeated-transition RED/green evidence**

Drive at least 100 finite representation registrations/replacements against the governor with the V1 policy and drain ticks between transitions. Define local stress helpers in the new test file so it does not depend on another test module:

```ts
const governor = new ResourceLifecycleGovernor(REPRESENTATION_RESOURCE_POLICY_V1);
const adapter: ResourceLifecycleAdapter<
  { id: string },
  { schemaVersion: 'stress/v1'; id: string }
> = {
  family: 'MONETA_REPRESENTATION',
  validateDescriptor: (value): value is { schemaVersion: 'stress/v1'; id: string } =>
    typeof value === 'object' &&
    value !== null &&
    (value as { schemaVersion?: string }).schemaVersion === 'stress/v1',
  detach: vi.fn(),
  coolStep: vi.fn((runtime) => ({
    status: 'COMPLETE',
    descriptor: { schemaVersion: 'stress/v1', id: runtime.id },
  })),
  forceDispose: vi.fn(),
};
const makeIdentity = (i: number): ResourceIdentity => ({
  family: 'MONETA_REPRESENTATION',
  datasetFingerprint: 'fp',
  datasetGeneration: 1,
  datasetVersion: 1,
  decisionId: 'decision',
  semanticId: `rep-${i}`,
});

for (let i = 0; i < 100; i += 1) {
  const identity = makeIdentity(i);
  governor.register({ identity, runtime: { id: identity.semanticId }, adapter });
  expect(governor.reconcile([{ identity, desired: 'ACTIVE', priority: 'FOCUS' }]).accepted).toBe(
    true
  );
  for (let tick = 0; tick < 8; tick += 1) governor.tick();
}
const snapshot = governor.getSnapshot();
expect(snapshot.counts.ACTIVE).toBe(1);
expect(snapshot.counts.WARM).toBe(0);
expect(snapshot.counts.COLD).toBe(0);
expect(snapshot.transitions.length).toBeLessThanOrEqual(policy.maxTransitionEvents);
```

Also assert no descriptor or record reachable from a public snapshot contains the synthetic dataset/row payload used by the test.

- [ ] **Step 2: Run all UXR2-focused tests**

Run:

```bash
npx vitest run \
  tests/resource-lifecycle-governor.test.ts \
  tests/representation-resource-lifecycle.test.ts \
  tests/rf062c-representation-surface.test.ts \
  tests/rf062c-world-production-path.test.ts \
  tests/stream-a-a3-bounded-observation-transition.test.ts \
  tests/uxr2-resource-lifecycle-boundedness.test.ts
```

Expected: PASS.

- [ ] **Step 3: Update roadmap status only after the production path is green**

Change UXR2 from `PARTIAL / NEXT FORWARD FRONTIER` to a bounded statement equivalent to:

> **LIFECYCLE AUTHORITY SEAM LANDED / PHYSICAL LONG-SESSION EVIDENCE OPEN** — the representation resource family now follows an explicit bounded ACTIVE/WARM/COLD/EVICTED lifecycle with amortised cleanup and descriptive telemetry. This does not establish Worker/WASM eviction or 30/60-minute Quest resource stability.

Change UXR3 only enough to record that the semantic-working-set residency seam is production-wired for the representation resource family. Keep bounded streaming/backpressure and multi-family/device-aware residency explicitly open and next.

Do not mark UXR2/UXR3 or P1-UXR VERIFIED COMPLETE.

- [ ] **Step 4: Run docs integrity and formatting**

Run:

```bash
npm run docs:check
npx prettier --check \
  docs/ROADMAP.md \
  docs/roadmap/P1_UXR_SEMANTIC_EFFICIENCY_UX_RUNTIME_AND_VERIFICATION.md
```

Expected: PASS, with no unrelated roadmap reformatting.

- [ ] **Step 5: Commit boundedness evidence and status truth**

```bash
git add tests/uxr2-resource-lifecycle-boundedness.test.ts docs/ROADMAP.md docs/roadmap/P1_UXR_SEMANTIC_EFFICIENCY_UX_RUNTIME_AND_VERIFICATION.md
git commit -m "test(uxr2): prove bounded representation residency"
```

---

### Task 8: High-Risk Exact-Head Verification and Promotion

**Files:**

- No planned production-file changes. Fix forward only if verification or adversarial review finds a blocker.

**Interfaces:**

- Consumes: exact implementation head from Tasks 1-7.
- Produces: reproducible promotion evidence and one reviewed PR.

- [ ] **Step 1: Re-fetch `origin/main` and reconcile drift before final evidence**

```bash
git fetch origin main
git log --oneline --decorate --max-count=3 origin/main
```

If `origin/main` moved after the implementation branch began, reconcile before final verification. Never present pre-reconciliation results as exact-head evidence.

- [ ] **Step 2: Run the high-risk focused gate under Node 24**

Run:

```bash
npm run typecheck
npm run lint
npm run docs:check
npx vitest run \
  tests/resource-lifecycle-governor.test.ts \
  tests/representation-resource-lifecycle.test.ts \
  tests/rf062c-representation-surface.test.ts \
  tests/rf062c-world-production-path.test.ts \
  tests/stream-a-a3-bounded-observation-transition.test.ts \
  tests/stream-a-a4-exact-datum-inspection.test.ts \
  tests/gpu-resource-lifecycle.test.ts \
  tests/governor-event-loop.test.ts \
  tests/uxr2-resource-lifecycle-boundedness.test.ts
```

Expected: all commands exit 0.

- [ ] **Step 3: Run repository-wide exact-head evidence**

Run the repository-wide commands from current executable configuration:

```bash
npm run wasm:dev
npm run test:all
npm run test:coverage
npm run build
npm run test:smoke
npm run test:smoke:collaboration
```

`test:all` is the current aggregate that includes the Rust test launcher plus the full Vitest path. Record any command that cannot run as skipped/blocked, never as green.

- [ ] **Step 4: Perform the required independent post-implementation adversarial review**

Give the reviewer the exact diff plus this attack surface:

```text
Review this high-risk UXR2 lifecycle diff against the committed design.
Try to falsify: ACTIVE protection; atomic over-capacity refusal; stable dataset/decision identity;
no Dataset/rows/MonetaDataInput retained after COLD; actual per-frame cleanup boundedness rather than queued recursive disposal;
stale async revision safety; semantic-detail fail-closed Worker residency; teardown idempotence; telemetry truthfulness;
and production wiring through World -> RepresentationSurface -> ResourceLifecycleGovernor.
Classify findings BLOCKER / DEFER / SUGGESTION. Do not treat unit-only evidence as proof of the production path.
```

Fix every BLOCKER and rerun the affected focused + exact-head gates. Record valid DEFER items in the PR without expanding the tranche recursively.

- [ ] **Step 5: Verify the immutable final commit**

```bash
git status --short
git show --check --stat HEAD
git rev-parse HEAD
git rev-parse origin/main
```

Expected: clean worktree, no whitespace errors, branch still based on/reconciled with the current integration head.

- [ ] **Step 6: Push and open one high-risk implementation PR**

The PR body must include:

- risk classification: **high-risk**;
- exact base and head SHAs;
- the pre-implementation invariant/authority/failure-mode/falsifier contract from the spec;
- focused and repository-wide verification evidence;
- independent post-review disposition;
- explicit residuals: Worker/WASM release ABI absent, multi-family working set absent, UXR3 streaming/backpressure still open, physical 30/60-minute Quest evidence open, #745 human-comprehension evidence independently open.

Do not use GitHub closing-keyword syntax for #745.

- [ ] **Step 7: Merge only on live exact-head GitHub gates**

Inspect CI, CodeQL, approval-gate and product-evidence workflows for the PR head. Enable guarded auto-merge only after review threads are resolved and the live risk metadata is accepted. If any required workflow fails, diagnose and fix forward on the same tranche rather than merging around it.

- [ ] **Step 8: Post-merge truth reconciliation**

Confirm `main` contains the merge, verify #745 remains open, release the workstream lease, and state the next frontier as the remaining UXR3 bounded streaming/backpressure + multi-resource-family residency work. Do not promote physical stability claims from software evidence.

---

## Plan Completion Criteria

The plan is complete only when the merged production path establishes all of the following simultaneously:

1. One explicit presentation-residency authority exists and is composed in `World`.
2. A production representation is ACTIVE while outgoing resources detach immediately and cool incrementally.
3. Cleanup work is truly bounded by individual Three.js disposal units, not merely by queued recursive calls.
4. Repeated representation turnover has finite live records and a bounded telemetry ring.
5. COLD state retains only a fixed primitive descriptor and no analytical/source payload.
6. Stale async cleanup cannot mutate a newer resource revision.
7. Semantic detail remains subordinate to parent presentation and still fails closed on Worker residency.
8. Roadmap claims remain bounded to software lifecycle authority, with UXR3 and physical evidence residuals explicit.
