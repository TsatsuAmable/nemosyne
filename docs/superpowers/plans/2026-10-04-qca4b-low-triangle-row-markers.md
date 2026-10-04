# QCA4b Low-Triangle Row Markers Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` and
> `superpowers:test-driven-development`; complete the tasks in order.

**Goal:** Reduce the QCA0 row-marker triangle workload by two thirds without
changing row addressability, identity, color, scale, placement, picking, or
evidence semantics.

**Architecture:** Keep instancing and every instance payload unchanged. Move the
representation-specific marker choice into a small factory owned by
`ScalableTopologyEmbodiment`, use it for both registered and fallback cloud
construction, and prove the change through the real 100k World production path.

**Spec:** `docs/superpowers/specs/2026-10-04-qca4b-low-triangle-row-markers-design.md`

## Task 1: Pin production semantics and render cost

**Files:**

- Modify: `tests/vr-scalable-artefacts.test.ts`
- Modify: `tests/rf062c-world-production-path.test.ts`
- Modify: `tests/instanced-point-cloud.test.ts`

- [ ] Add a production artifact assertion requiring a tetrahedral marker with
      exactly four triangles while retaining the original instance count.
- [ ] Add the same assertion to the real 100k World/QCA path, alongside the
      existing `ROW_ADDRESSABLE` and 100,000 rendered-node evidence.
- [ ] Add a raycast test that uses the production marker geometry and returns
      the original row payload and instance index.
- [ ] Run the three focused files and confirm RED because production still
      supplies a 12-triangle `BoxGeometry`.

## Task 2: Apply the bounded geometry substitution

**Files:**

- Modify: `src/moneta/embodiment/ScalableTopologyEmbodiment.ts`

- [ ] Add a single exported row-marker geometry factory returning
      `THREE.TetrahedronGeometry(0.052, 0)`.
- [ ] Use it in the fallback cloud and in the geometry supplied to registered or
      per-synthesis factories.
- [ ] Run the focused tests and confirm GREEN.
- [ ] Run affected scalable-representation, interaction, lifecycle and QCA
      production-path tests.

## Task 3: Verify, review, push, and measure

- [ ] Run `npm run docs:check`, `npm run typecheck`, `npm run lint`,
      `npm run build`, and `npm test`.
- [ ] Perform a distinct adversarial review of the exact diff and real World
      call path; fix blockers before push.
- [ ] Push the focused branch and create a stacked PR against
      `codex/qca4a-glyph-warning` while QCA4a remains open.
- [ ] When Quest 3S is attributable over ADB, run the governed exact-head QCA0
      profile and compare triangle count, draw calls, frame cadence, load duration,
      legibility and selection against the accepted baseline.
- [ ] Do not call the optimization adopted or merge-ready until physical evidence
      satisfies the design adoption rule.
