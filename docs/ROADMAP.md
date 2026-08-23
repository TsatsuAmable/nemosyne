### P2 — Integration wave

- Moneta consumes authoritative `DatasetEvidence` and Representation Ontology contracts.
- Existing single-family decisions are represented as simple `RepresentationGraph`s before composition search is introduced.
- Spatial Runtime remains the graph embodiment adapter and does not reinterpret Moneta semantics.
- Research Harness freezes exact Rust/Moneta/Fitness/Ontology/NIL/perception versions.
- 2D and VR treatments consume equivalent semantic representation contracts.
- Learned execution remains pinned and opt-in until held-out evidence plus monitoring/rollback justify a governance change.
- Pattern-fragility evidence remains advisory and explainable until controlled outcome evidence justifies any stronger role.

## Design boundaries

- **Rust owns N-dependent work.** Parsing, storage, filtering, statistics, clustering, topology, spectral analysis, evidence construction, large-data reduction and other work materially proportional to dataset size remain Rust/WASM responsibilities.
- **Moneta is a bounded control plane.** Canonical representation reasoning consumes compact Rust-derived evidence and investigator semantics; it must not require raw-row traversal or full-dataset JS materialisation.
- **Tests live with authority.** Exhaustive correctness tests belong at the lowest authoritative layer capable of proving the property. Rust-owned analytical semantics are specified primarily in Rust; higher layers test contracts and integration rather than independently reproducing those algorithms.
- **Boundary coverage is irreducible.** Moving authoritative tests into Rust must not remove the small set of JS/WASM, browser, rendering, WebXR and end-to-end tests needed to prove cross-layer behaviour.
- **Source rows are not visible elements.** Headset render budgets constrain reduced/LOD primitives, not the number of observations stored in the analytical dataset.
- **Bootstrap is the safe default.** An explicit learned-runtime request must never silently switch artifact or silently fall back to bootstrap.
- **Hard constraints precede learned ranking.** Learned models may reorder feasible candidates; they may not resurrect a bootstrap-disqualified candidate.
- **Registry activation is not provenance.** Reproducible execution pins an immutable artifact hash and model version in decision/study state.
- **Promotion eligibility is not empirical truth.** Passing the gate means the artifact satisfies the declared evidence policy, not that Moneta is universally better.
- **Holdout groups, not judgement volume, define the comparison unit.** Repeated judgements within one dataset+researcher group must not outweigh another independent group in the headline promotion metric.
- **Mean improvement, win consistency and effect robustness are distinct.** Promotion requires worthwhile average improvement, distributed wins and resistance to a single influential group.
- **Skepticism targets claims, not people.** Pattern-fragility/apophenia-pressure signals describe evidence and analytical conditions, never investigator psychology.
- **Explain before scoring.** Any skepticism signal must expose contributing evidence and concrete falsification actions; a single unexplained number is insufficient.
- **Learning does not own analytical facts.** Research-relevant facts remain Rust/WASM-authoritative; learned ranking consumes frozen Moneta feature evidence.
- **No compositional/adaptive leapfrogging.** Gate 9/10 sophistication does not substitute for Gate 1–8 falsifiability and validation.

## Documentation cleanup policy

Every PR touching an architectural area must update active documentation. Superseded active prose is rewritten to V3 terminology or moved to `docs/archive/` when it has historical value. The repository must not maintain competing live descriptions of representation authority, research goals or implementation gates.

## Verification baseline

For **local fast checks**, implementation PRs should run the smallest ownership-aligned set that proves their claims, as applicable:

```text
node scripts/cargo-test.mjs                  # Rust analytical/data correctness
npx vitest run <affected-test-files...>      # focused TypeScript/application correctness
npx vitest run <affected-wasm-contracts...>  # focused JS/WASM boundary contracts
npm run typecheck
npm run lint
npm run wasm:dev
npm run build
npm run audit:hygiene
```

These focused commands are the recommended contributor feedback loop, not a replacement for the repository's current PR CI contract. Until the CI lanes are explicitly split, PR CI still runs the full `npm test` suite in addition to its other required checks.

Broad `npm test`, workspace-wide coverage aggregation, Playwright/WebXR integration and performance benchmark suites remain mandatory where affected or at their designated main/scheduled gates, but should not be duplicated in additional ad hoc jobs when a narrower deterministic gate already proves the changed property. Focused correctness/parity tests are mandatory for claimed functionality. A skipped test is not evidence for a claimed gate. Coverage assurance runs separately on `main`/schedule so PR feedback remains fast without abandoning centralized coverage thresholds.

## Pickup instruction
