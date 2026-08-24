# Pre-P1 systematic audit and adversarial review

**Audit date:** 24 August 2026
**Scope:** architecture, Rust/WASM boundary, UI/UX, VR interaction, performance, resilience,
security, maintainability, open-source adoption, tests, workflow runtime, use cases and documentation
**Governing authority:** [Nemosyne Definitive Vision and Roadmap V3](Nemosyne_Definitive_Vision_and_Roadmap.md)
**Decision:** P1 remains blocked by the open high-severity items below and physical Meta Quest 3S
qualification. Migration-exit evidence remains valid.

## Executive verdict

Nemosyne has a coherent analytical authority boundary: Rust/WASM owns facts and scale-sensitive
work, Moneta reasons over compact evidence, TypeScript orchestrates and embodies decisions, and
portable investigations fail closed on provenance drift. The audit found no justification for
reintroducing a JavaScript analytical fallback.

The project is not yet a qualified private preview. Its strongest risks are now product/lifecycle
risk rather than migration incompleteness: oversized coordinators, incomplete real-user browser
journeys, linear spatial-query hot paths despite an installed BVH library, pervasive test type-check
suppression, insufficient adversarial kernel/archive campaigns, and the absence of physical Quest
evidence. The former PR fast lane also omitted coverage, production build and real-browser smoke
from the required check; that is corrected in this audit branch.

The audit made bounded fixes where the intended behaviour was unambiguous. Larger redesigns remain
explicit roadmap work so this review does not smuggle a new architecture into the codebase.

## Method and limitations

The inspection combined:

- governing-vision and authority-boundary comparison;
- source graph, size, ownership and runtime-wiring inspection;
- per-frame allocation and spatial-query review;
- untrusted package and network-boundary review;
- dependency inventory, `npm audit`, duplicate Cargo dependency inspection and library-fit review;
- test partition, assertion quality, suppression and workflow inspection;
- focused adversarial tests and six user-journey walkthroughs;
- public-site semantic, responsive and accessibility review;
- measured local test-lane runtimes on the available Apple development machine.

This was not a physical-device qualification, penetration test, formal accessibility conformance
assessment, scientific validation study or proof that 10M rows are viable on Quest 3S. Those limits
are intentional gates, not inferred passes.

## Findings register

Severity meanings: **blocker** prevents P1 qualification; **high** should land before a private
preview; **medium** belongs in the first hardening/refinement programme; **low** is monitored debt.

| ID       | Area                 | Severity | Finding and adversarial consequence                                                                                                                                                                                                                          | Disposition                                                                                                                                |
| -------- | -------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| CI-01    | CI                   | High     | The required PR context ran Rust, typecheck, lint and ordinary tests, but omitted coverage thresholds, production build and Chromium smoke under a migration-era fast lane. A green PR could therefore ship an unbuildable or non-booting production bundle. | **Fixed:** restored explicit core, Rust and downloaded-artifact Chromium jobs behind the stable `CI / Node 24` aggregate.                  |
| CI-02    | Security             | High     | CodeQL was excluded from pull requests by a stale migration exception. The repository also has no enabled GitHub code-scanning service, so default SARIF upload fails after successful analysis.                                                                 | **Fixed:** PR analysis restored with a zero-finding SARIF gate and retained evidence artifact, independent of the unavailable upload service. |
| CI-03    | Merge integrity      | High     | The approval workflow gave its token write access and invoked auto-merge. With no effective required-check protection, owner-authored PR #362 merged eight seconds after opening, before CI or CodeQL finished.                                                  | **Fixed:** the approval job is now read-only and cannot merge; merge remains a separate post-check action against the current head.          |
| TEST-01  | Test architecture    | Medium   | Four Vitest configs duplicated ownership lists. `wasm-columnar-structure-profile.test.ts` ran in both integration and WASM lanes, wasting runtime and making counts misleading.                                                                              | **Fixed:** one typed manifest supplies every lane; disjointness is tested.                                                                 |
| SEC-01   | Archive import       | High     | `Unzip` lacked the deflate decoder and fell back to `unzipSync`. A highly compressed hostile package could allocate its full contents before budgets were checked, while duplicate normalized entries could shadow a previously extracted payload.              | **Fixed:** registered streaming deflate, removed the synchronous fallback, rejected duplicate paths and added adversarial budget/shadow tests. |
| PERF-01  | VR hand wheel        | Medium   | The visible wheel allocated matrices, vectors and concatenated mesh arrays every update. It also computed an unused pointer angle and carried unused open/close threshold options.                                                                           | **Fixed:** cached scratch values and mesh targets; removed inert API and work.                                                             |
| PERF-02  | Scene selection      | Medium   | The input registry allocated an interactable mesh array on every scene raycast.                                                                                                                                                                              | **Fixed:** maintained the list at registration time.                                                                                       |
| UX-01    | Adaptive assistance  | High     | Dev Lab controls could create a second confidence HUD, frustration responder and JIT hint manager instead of controlling the instances already wired into production. This caused contradictory UI state and duplicated resources.                           | **Fixed:** the UI manager binds to the production controller and registers its real HUD.                                                   |
| DOC-01   | Public promise       | High     | The public page presented Nemosyne as a VR memory-palace product, named the superseded Draco authority and overstated product readiness.                                                                                                                     | **Fixed:** updated copy within the established visual design to state the discovery/reproducibility vision, implemented layers and alpha/device caveats. |
| DOC-02   | Documentation        | Medium   | Multiple active documents described superseded dependency waves, built-vs-wired counts, Draco/JS analytical paths, stale three.js versions or unapproved library proposals.                                                                                  | **Fixed:** replaced the canonical architecture/onboarding references, archived dated historical inputs and removed obsolete navigation.    |
| ARCH-01  | Architecture         | High     | `World.ts` is 2,178 lines; the pre-split `RuntimeBridge.ts` was 1,318; coordinator types 1,237; `AtlasCore.ts` 1,022; and `VRTopologyTranslator.ts` 1,012. Existing “god-object refactoring” tests proved class existence, not cohesion or dependency direction. | **In progress:** lifecycle ownership and the RuntimeBridge ABI-family split are merged. `refactor/coordinator-consumer-contracts` removes the shared World facade, co-locates coordinator ports and freezes their exact surfaces. Atlas and topology-embodiment decomposition remain open. |
| ARCH-02  | Lifecycle            | High     | `WorldUIManager` constructed many GPU/UI resources without an explicit aggregate disposal contract. Engine-wide teardown masked ownership mistakes and made world recreation/partial recovery risky.                                                         | **Fixed in PR #365:** aggregate idempotent teardown, async-ingress cancellation, active-probe cleanup and three-cycle started real-WASM recreation are covered; local and hosted gates are green. |
| PERF-03  | Spatial queries      | High     | `three-mesh-bvh` and a custom `SpatialIndex` existed, while production selection remained linear in registered meshes.                                                                                                                                        | **Fixed on `perf/spatial-accelerator-exit`:** measured object and geometry crossovers with first-hit parity, wired the authoritative BVH into controller/desktop/trace selection, added lifecycle and invalidation contracts, and deleted the test-only grid. Quest crossover remains governed by PERF-04. |
| PERF-04  | Quest capacity       | Blocker  | Hosted/M1 evidence proves the row-free 10M boundary shape, not Quest 3S memory, frame cadence, thermals or practical interaction latency.                                                                                                                    | **Blocked on device:** run the instrumented physical-browser qualification and keep `deviceQualifiedAt10m: false` until governed review.   |
| PERF-05  | Frame allocation     | Medium   | The focused wheel/registry fixes do not establish a zero-allocation render loop across locomotion, panels, topology embodiment and collaboration presence.                                                                                                   | **Open:** add representative frame allocation/GC telemetry and profile sustained interactions on device.                                   |
| UX-02    | Journey completeness | High     | The real Chromium smoke verifies boot/render only. The “complete analyst journey” tier uses mocks and Draco-era names rather than driving load → evidence → Moneta/NIL → investigation → export → replay through visible controls.                           | **Open P1:** add a real-browser golden journey with kernel and accessible desktop controls; retain seam tests separately.                  |
| UX-03    | Input parity         | High     | Controller, hand and desktop behaviours have extensive unit coverage, but semantic parity has not been demonstrated on physical Quest, including focus, cancellation, recovery and error states.                                                             | **Open P1/device:** execute the interaction matrix and record task outcomes, not component presence.                                       |
| UX-04    | Action state         | Medium   | Some wheel actions such as Undo/Redo remain available without an authoritative enabled/disabled state, permitting avoidable no-op or confusing feedback.                                                                                                     | **Open:** expose command availability to every modality and announce disabled reasons.                                                     |
| UX-05    | Canvas UI            | Medium   | Custom canvas-text panels give precise XR control but require continued work for text measurement, focus semantics, contrast, localization and device legibility. A wholesale UI-library migration is not yet evidence-backed.                               | **Open:** benchmark representative panels against a maintained XR UI library on Quest before deciding.                                     |
| UX-06    | Public accessibility | Medium   | The established public-page design uses continuous decorative motion and an external font without a reduced-motion override or local-font resilience check; at 390 px the fixed header also clips the wordmark beside the GitHub action. Content-only scope prevents changing that design in this audit. | **Open:** perform a design-system-approved responsive-header, motion, focus, contrast and font-resilience pass without changing the visual identity. |
| RES-01   | Kernel recovery      | High     | `KernelUnavailable` is explicit, but broader panic/handle invalidation/world-recreation recovery has not been exercised as a sustained fault campaign.                                                                                                       | **Partially fixed:** trapped calls recover through a fresh runtime, and generation fencing prevents stale initialization from reclaiming authority. Checked two-call output bounds, exception-safe host allocation cleanup, malformed-handle and sustained panic campaigns remain. |
| RES-02   | Collaboration        | High     | Signalling has roles, tokens and protocol validation, but no long-duration multi-browser fault/partition/reconnect qualification.                                                                                                                            | **Open P1:** adversarial protocol and two-browser lifecycle tests before preview collaboration is enabled.                                 |
| SEC-02   | Rust/WASM            | High     | Unit/property coverage is strong, but no current broad `unsafe`, fuzz, malformed-buffer, Miri-compatible or handle-exhaustion campaign closes the kernel attack surface.                                                                                     | **Open P1:** inventory `unsafe`, fuzz ABI parsers/handles and record bounded-memory outcomes.                                              |
| SEC-03   | Dependencies         | Low      | `npm audit` reports zero known vulnerabilities across 314 dependencies. Cargo carries duplicate `hashbrown` and `syn` major lines through transitive dependencies.                                                                                           | **Monitor:** review footprint during Rust modernization; do not force unsafe transitive unification.                                       |
| MAINT-01 | Test typing          | High     | 176 of 311 test/spec files use `@ts-nocheck`, weakening fixtures exactly where cross-layer contracts are most complex.                                                                                                                                       | **Open programme:** remove suppression by domain, beginning with package, runtime bridge, world and real-WASM boundary suites.             |
| MAINT-02 | Test assertions      | Medium   | 435 generic `toBeTruthy`, `toBeDefined` or `not.toThrow` assertions provide weaker behavioural evidence than exact state, provenance, output or error contracts.                                                                                             | **Open programme:** replace in critical journeys first; do not mechanically rewrite meaningful uses.                                       |
| MAINT-03 | Hygiene automation   | Medium   | The housekeeping script claimed zero cycles after checking three barrels, claimed a file-size cap without measuring files, checked only `dist/index.html`, and hard-coded a stale Rust pass count.                                                           | **Fixed:** full-source lint, measured hotspots, whole-bundle gzip and complete Rust suite with factual output.                             |
| MAINT-04 | Dependency plans     | Medium   | The old modernization backlog remained open after consolidated dependency PR #358 and proposed some replacements without a current fitness benchmark.                                                                                                        | **Fixed/docs:** archived completed waves; remaining library decisions moved here and to the roadmap.                                       |
| MAINT-05 | Lint signal          | Medium   | The blocking lint gate is green but emits 170 warnings, including unused test fixtures and explicit `any`. Persistent baseline noise makes newly introduced warnings harder to notice.                                                                       | **Open programme:** classify and reduce warnings by test domain, then enforce a non-increasing hosted warning budget.                      |
| MAINT-06 | Rust warning signal  | Medium   | Release compilation is green but reports deprecated FNV helpers, dead migration-era capability constants, unused functions and unnecessary `unsafe` blocks. The noise can conceal new boundary warnings, while changing hashes without a provenance audit could break compatibility. | **Open programme:** classify and remove warnings; govern any fingerprint change as a versioned provenance migration.                       |
| MAINT-07 | Crate packaging      | Low      | `wasm-pack` warned that the separately packaged Rust crate declared MIT but did not carry a discoverable licence file.                                                                                                                                         | **Fixed:** added the crate-local MIT licence so generated package metadata has its legal payload.                                          |
| DOC-03   | Compatibility naming | Medium   | Draco survives intentionally as a compatibility facade, but old UX/test names can still imply analytical authority.                                                                                                                                          | **Open:** rename investigator-facing panels and journeys to representation/Moneta terminology while preserving the governed public facade. |

## Architecture and authority assessment

The production authority chain is coherent:

```text
typed data → Rust/WASM facts and identity → compact DatasetEvidence
          → bounded Moneta decision or NIL → TypeScript embodiment
          → Investigation provenance → .nemosyne replay verification
```

The most important architectural rule is negative: no capability flag, error handler or device
fallback may route analytical work to JavaScript. Desktop is a presentation/recovery modality, not a
second analytical engine.

The next refactor should target lifecycle seams rather than names or line counts. Recommended order:

1. Extract World boot/recovery and runtime teardown into an idempotent lifecycle owner. **Implemented locally on `refactor/world-lifecycle-owner`.**
2. Split `RuntimeBridge` by ABI handle family while keeping one readiness/authority state machine. **Merged in PR #366.**
3. Split coordinator contracts by consumer so `coordinators/types.ts` no longer forms a broad coupling
   hub. **Implemented locally on `refactor/coordinator-consumer-contracts`.**
4. Separate Atlas orchestration from analytical evidence adapters without moving N-dependent work to
   TypeScript.
5. Keep `VRTopologyTranslator` as embodiment only and delete compatibility vocabulary as callers move.

## Open-source and hand-rolled code decisions

Adoption is based on fitness and authority, not package popularity.

| Area                        | Current decision                                                                     | Reason / next evidence                                                                                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ZIP                         | Keep `fflate`; streaming registration fixed                                          | Small, browser-compatible and already integrated. Fuzz hostile ZIP structures before P1.                                                                                                                  |
| Validation                  | Keep `valibot`                                                                       | Replaces hand-written manifest validation with explicit schemas without owning analytical facts.                                                                                                          |
| Binary/columnar data        | Keep MessagePack and Apache Arrow                                                    | Appropriate transport/interchange roles; Rust remains analytical authority.                                                                                                                               |
| Events, colour, tweening    | Keep `nanoevents`, `colord`, `@tweenjs/tween.js`                                     | Focused libraries have already displaced unnecessary custom utilities.                                                                                                                                    |
| Spatial acceleration        | Use the installed `three-mesh-bvh` where benchmarks justify it                       | Production is not wired; converge it with or delete the custom built-only spatial index.                                                                                                                  |
| XR panels                   | Evaluate `three-mesh-ui` or an equivalent maintained library, do not migrate blindly | Current canvas panels encode Nemosyne interaction semantics. Require Quest legibility, frame, disposal and accessibility parity first.                                                                    |
| Signalling/collaboration    | Retain the custom protocol for now                                                   | Its observer/participant roles, provenance and token semantics are project-specific. PeerJS/Yjs would not automatically replace those guarantees. Revisit after protocol tests identify commodity layers. |
| Analytical/statistical code | No JavaScript library replacement                                                    | Rust/WASM exclusively owns these facts. Mature Rust crates may replace hand-written algorithms only with numerical, determinism, provenance and WASM parity evidence.                                     |

## Test quality and workflow runtime

Measured local wall-clock baselines before remediation:

| Lane          | Files | Tests | Wall clock | Finding                                                                                         |
| ------------- | ----: | ----: | ---------: | ----------------------------------------------------------------------------------------------- |
| Fast Node     |     6 |    13 |     0.56 s | Useful but too small; pure contract tests should continue moving here.                          |
| UI-only       |     3 |    13 |     1.05 s | Focused and cheap.                                                                              |
| Integration   |   268 | 1,599 |    33.57 s | Dominant lane; contains mixed ownership and one duplicate WASM file before this audit.          |
| Explicit WASM |    34 |   273 |    13.56 s | Appropriate seam coverage, but allowlist should shrink as mathematical assertions move to Rust. |

The central test-group manifest removes the observed duplicate. The required hosted CI now runs
typecheck → lint → coverage → production build, Rust in parallel, then smoke against the exact
uploaded bundle. Future runtime work should record hosted critical-path duration and optimize setup
or suite ownership; it must not weaken the required evidence.

Test-quality implementation order:

1. Real-browser golden investigation journey and explicit failure/recovery journey.
2. Remove `@ts-nocheck` from portable package, runtime bridge, Moneta decision and World lifecycle
   tests.
3. Replace generic assertions in blocker/high finding tests with exact error, state, provenance and
   resource-count contracts.
4. Split mixed real-WASM/presentation suites and move Rust-owned mathematics to Rust property or
   metamorphic tests.
5. Add mutation testing only to compact security/authority modules after the above contracts are
   strong enough to interpret it.

## Use-case step-through analysis

### UC-1: first investigation and reproducible finding

1. User opens the runtime and loads structured data.
2. Kernel readiness is established; invalid/unavailable state is explicit.
3. Rust ingests typed columns, establishes canonical identity and emits compact evidence.
4. Moneta selects a feasible representation or records NIL.
5. User inspects, filters, compares, annotates and records a finding/discovery.
6. Session exports to `.nemosyne` and replays in a clean environment with identity verification.

**Evidence:** composition, package and replay seam tests are strong. **Gap:** no production-browser
visible-control journey proves the whole experience or error recovery. This is P1-high.

### UC-2: 10M-row investigation on Quest 3S

1. Browser constructs the synthetic typed fixture incrementally.
2. Host copy, Rust ingest, fingerprint, structure profile and borrowed scans are recorded.
3. Reduction/LOD bounds render output independently of row count.
4. XR frame gaps, visibility, memory and sustained drift are captured and exported.

**Evidence:** the row-free boundary and telemetry instrumentation exist and pass on provisioned
runners. **Gap:** no physical Quest 3S result exists; thermal and browser memory behaviour cannot be
inferred from Apple or hosted runners. This remains a promotion blocker.

### UC-3: equivalent controller, hand and desktop investigation

1. User selects and manipulates the same semantic action through each modality.
2. Hover/focus, commit, cancel, unavailable state and feedback are consistent.
3. Loss of tracking or XR exit preserves investigation state and offers desktop recovery.

**Evidence:** broad component/unit coverage and shared dispatch architecture exist. **Gap:** the
matrix has not been executed on device against visible task outcomes; action availability is not
uniformly represented.

### UC-4: collaborative investigation

1. Participant and observer authenticate to signalling with distinct capabilities.
2. Peers share presence, investigation context and permitted actions.
3. Disconnect, reconnect, stale messages and role violations fail safely.
4. Exported provenance distinguishes shared observations from analytical authority.

**Evidence:** protocol, presence and UI foundations are wired. **Gap:** no real two-browser sustained
journey, network-partition soak or hostile-protocol campaign qualifies it for private preview.

### UC-5: malformed or hostile input

1. Oversized, compressed, traversal-bearing or schema-invalid archive is rejected before unbounded
   allocation or state mutation.
2. Invalid ABI handles/buffers fail closed.
3. The user receives a recoverable, non-scientific error; no JS analysis is substituted.

**Evidence:** traversal/schema checks existed; streaming decompression budgets are fixed here.
**Gap:** ZIP and WASM ABI fuzzing plus handle-exhaustion/recovery campaigns remain open.

### UC-6: public discovery and expectation setting

1. Visitor understands that the goal is meaningful, reproducible discovery rather than novelty VR.
2. Visitor can distinguish implemented evidence from pending qualification.
3. Research, roadmap, architecture and source are reachable without marketing overclaim.

**Evidence:** revised content supplies this path while preserving the established page structure,
styling and responsive layout. Continuous decorative motion and font resilience remain explicitly
open under UX-06. Deployment and live-domain verification remain part of this PR's publication gate.

## Documentation disposition

Active authorities after this audit:

- V3 definitive vision: product/research/architecture governance;
- `ROADMAP.md`: live implementation state and issue queue;
- this audit: dated evidence and adversarial findings;
- `IMPLEMENTATION_PLAN_V3.md`: executable V3 sequencing;
- `ARCHITECTURE.md` and developer/study references: technical and operational layers.

Archived in this audit:

- the 14 August built-vs-wired audit;
- the 19 August standardization proposal;
- the stale Draco/JS-era user-story analysis;
- the completed dependency modernization wave backlog.
- the superseded architecture, developer guide, technical specification, wiki, OSS migration plan,
  P1–P20 audit, migration coordination and curation brief.

The completed P0 migration critical path is summarized in the live roadmap and preserved in the
archive rather than occupying the active implementation queue.

## Verification evidence

Final local verification on 24 August 2026 passed:

- TypeScript typecheck: pass;
- ESLint: pass with the recorded 170-warning baseline and no errors;
- coverage suite: 310 files and 1,903 tests passed in 70.67 seconds; 81.43% statements,
  69.72% branches, 78.34% functions and 83.99% lines;
- production Rust/WASM and Vite build: pass;
- native Rust kernel: 170 tests passed;
- real Chromium production smoke against the prebuilt bundle: one test passed;
- recurring hygiene audit: 8/8 dimensions passed; 27 distribution files total 1.32 MiB gzip;
- active documentation: 68 Markdown/HTML files checked with no missing local targets, and the
  public index exposes HTML rather than raw Markdown destinations;
- workflow YAML: parsed successfully;
- public site: desktop and 390 px mobile content inspected in the browser; the original
  `docs/css/styles.css` is unchanged. The observed mobile-header issue remains UX-06.

Hosted pull-request evidence and GitHub Pages publication are the remaining release checks.

## Exit decision

This audit can close when its bounded fixes pass the full local and hosted gates, the public site is
verified and GitHub Pages publishes from `main`. It does **not** reopen P1. The roadmap's blocker and
high findings, particularly physical Quest qualification, lifecycle ownership, real-browser user
journeys, kernel/archive adversarial campaigns and spatial-query performance, govern the next set of
implementations.
