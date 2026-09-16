# UXR2 Resource Ownership, Lifecycle, and Evaluation Plan

**Status:** implementation-ready planning tranche  
**Date:** 16 September 2026  
**Integration base:** `main@8ca83ca61d26d6425dab7f07b90f30cfc489c814`  
**Roadmap authority:** `docs/ROADMAP.md`

## Decision

UXR2 must establish explicit presentation-resource ownership before adaptive eviction. The lifecycle governor may decide *when* a resource changes residency, but it must not guess *who owns destruction*. Shared GPU/runtime resources require last-owner semantics.

Durable investigation state, provenance, scientific evidence, dataset identity, and semantic identity are never presentation resources. `EVICTED` means a disposable projection is gone, not that investigative meaning is deleted.

## Invariants

1. Resource ownership is explicit: `PRIVATE | SHARED | EXTERNAL`.
2. `PRIVATE` resources are destroyed with their owner.
3. `SHARED` resources are destroyed only after the final lease is released.
4. `EXTERNAL` resources are never destroyed by the lifecycle governor.
5. Residency is orthogonal to ownership: `ACTIVE | WARM | COLD | EVICTED`.
6. An ACTIVE semantic focus cannot be evicted by pressure alone.
7. Cold descriptors cannot retain datasets, arbitrary rows, Three.js objects, GPU/transfer buffers, or outgoing Moneta data inputs.
8. Stale asynchronous cleanup/reconstruction cannot mutate a newer lifecycle revision.
9. Presentation eviction cannot create or repair analytical authority.
10. Telemetry reports completed reclamation, not requested reclamation.

## Tranche UXR2-O1: executable ownership falsifiers

Write failing tests before changing disposal semantics.

Required falsifiers:

- two meshes share one material and texture; retiring A must leave B valid;
- two meshes share a non-singleton geometry; retiring A must leave B valid;
- final lease release destroys each shared resource exactly once;
- PRIVATE resources are destroyed on owner retirement;
- EXTERNAL resources are detached but not disposed;
- recursive object teardown cannot bypass lease accounting;
- repeated acquire/release cycles leave zero leaked leases;
- double release fails closed or is idempotently diagnosed, never underflows ownership.

**Exit:** RED tests demonstrate current unsafe shared-resource behavior and define the contract.

## Tranche UXR2-O2: minimal ownership/lease authority

Implement a small authority, separate from `World`, `RepresentationSurface`, and eviction policy.

Suggested contracts:

- `ResourceOwnership = 'PRIVATE' | 'SHARED' | 'EXTERNAL'`
- stable `ResourceHandle` / identity
- `acquire(handle, ownerId)`
- `release(handle, ownerId)`
- last-owner disposal callback
- bounded diagnostic snapshot: live handles, leases, releases, disposal count, invalid-release count

Do not infer ownership by traversing the Three.js scene graph. Existing pooled geometry exemptions should migrate into explicit EXTERNAL/SHARED registration rather than remain a growing hard-coded exception list.

**Exit:** ownership falsifiers GREEN; existing disposal/GPU lifecycle tests remain GREEN; no production lifecycle policy yet.

## Tranche UXR2-L1: pure lifecycle governor

Implement the already-designed `ResourceLifecycleGovernor` with atomic working-set reconciliation, stable identity, `ACTIVE -> WARM -> COLD -> EVICTED`, bounded cleanup, revision protection, bounded telemetry, and final teardown drain.

The governor consumes ownership-aware adapters. It does not directly dispose shared resources.

**Evaluation:**

- active protection;
- atomic over-capacity refusal;
- deterministic identity separation;
- bounded record count under repeated transitions;
- cleanup operations per tick never exceed policy;
- stale async completion cannot overwrite newer state;
- failed cleanup does not increment successful-reclamation counters.

**Exit:** pure state-machine and ownership integration tests GREEN.

## Tranche UXR2-L2: Three.js representation adapter

Refactor disposal into stepwise work units. Every geometry/material/texture destruction request must pass through ownership authority.

A representation cold descriptor contains only bounded reconstruction identity and primitive parameters. It must reject object-bearing or dataset-bearing payloads.

**Evaluation:**

- shared material/texture/geometry survival across partial retirement;
- exactly-once final destruction;
- descriptor forbidden-payload tests;
- large subtree retirement is amortised;
- existing recursive-disposal semantics remain available for demonstrably PRIVATE teardown;
- no disposal cliff is introduced in the synchronous replacement path.

**Exit:** representation adapter and existing GPU-resource regressions GREEN.

## Tranche UXR2-L3: production composition

Wire the governor through `RepresentationSurface` and `World`.

Ordering contract:

1. construct candidate while old projection remains authoritative;
2. validate complete desired working set;
3. register candidate;
4. detach outgoing interaction/selection authority;
5. atomically reconcile one ACTIVE projection;
6. retire heavy resources asynchronously through ownership-aware cleanup;
7. restore semantic selection by durable identity where lawful.

Failure must leave the previous safe representation authoritative.

**Evaluation:**

- replacement-construction failure preserves old projection;
- lifecycle admission refusal preserves old projection;
- clear removes semantic detail synchronously before GPU cleanup;
- world teardown drains ownership and lifecycle registries;
- no leaked handles after repeated dataset/representation replacement;
- Worker-residency refusal remains unchanged.

**Exit:** production-path, world lifecycle, semantic-detail, ownership, and representation tests GREEN.

## Tranche UXR2-E1: software evaluation gate

Run the full relevant verification matrix under repository-supported Node 24:

- ownership unit/falsifier suite;
- lifecycle-governor suite;
- representation lifecycle suite;
- GPU resource lifecycle regressions;
- `RepresentationSurface` regressions;
- bounded semantic transition regressions;
- World production/recreation/lifecycle tests;
- typecheck, lint, architecture boundaries, docs check;
- exact-head CI, CodeQL, and promotion gate.

Collect machine-readable lifecycle snapshots across a deterministic repeated-transition campaign. Required claims are software claims only: bounded live records, bounded leases, exactly-once disposal, bounded cleanup work, and fail-closed semantic authority.

**Exit:** exact-head software evidence green. This does **not** claim physical Quest memory stability.

## Tranche UXR2-E2 / UXR4-UXR5: physical evaluation handoff

Only after software qualification, run Quest evidence:

- 10-minute churn/profile diagnostic first;
- then 30-minute and 60-minute representative investigation sessions;
- frame-time distribution and hitch events;
- GPU/JS/WASM memory signals where measurable, labelled by measurement quality;
- lifecycle/lease counts alongside physical telemetry;
- repeated dataset/representation transitions;
- user-visible regressions, interaction latency, comfort and comprehension observations.

Do not infer byte-precise reclamation from browser APIs that cannot provide it. A flat software registry is necessary but not sufficient evidence for flat physical memory.

**Exit:** physical stability claims only when governed device evidence supports them. Otherwise retain software-qualified status and open the observed failure as the next falsifier.

## Adversarial review gate

Before promotion, independently attack:

- hidden ownership paths that bypass the registry;
- shared resources registered as PRIVATE;
- leaked leases;
- stale callbacks;
- teardown ordering;
- lifecycle telemetry that counts requested rather than completed cleanup;
- unbounded tombstones/event history;
- semantic/provenance state accidentally placed in cold descriptors;
- accidental Worker/WASM authority expansion;
- policy constants presented as scientific thresholds.

Material findings become tests before merge.

## Dependencies and sequencing

`UXR2-O1 -> UXR2-O2 -> UXR2-L1 -> UXR2-L2 -> UXR2-L3 -> UXR2-E1 -> physical UXR2-E2/UXR4-UXR5`.

UXR3 may consume the lifecycle seam once L3/E1 establish safe bounded presentation residency. Adaptive pressure/eviction heuristics come only after ownership and lifecycle correctness. PT9 remains downstream of the existing roadmap prerequisites.

## Implementation references

The detailed lifecycle design and task decomposition already exist on `design/uxr2-resource-lifecycle-governor`:

- `docs/superpowers/specs/2026-09-16-uxr2-resource-lifecycle-governor-design.md`
- `docs/superpowers/plans/2026-09-16-uxr2-resource-lifecycle-governor.md`

This plan adds the missing ownership prerequisite and makes evaluation/promotion boundaries explicit.
