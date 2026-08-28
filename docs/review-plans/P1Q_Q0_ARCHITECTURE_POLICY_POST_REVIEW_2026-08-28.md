# P1-Q Q0 Architecture Policy Pilot - Post-Review

**Date:** 28 August 2026  
**Baseline:** `main@e18ec3bd1c0568ea0f52abac970a7359e01e286d`  
**Reviewed branch:** `chore/p1q-q0-architecture-policy`  
**Hosted measurement run:** `33163881585` at `21d2d9c9f06fe75860a86560ad3f58fe1a4cbab1`  
**Status:** BOUNDED REVIEW COMPLETE / ORDINARY PR PROMOTION EVIDENCE PENDING

## Review question

Does the Q0 dependency-cruiser + ast-grep pilot provide sufficiently high-signal, low-cost architecture evidence to keep, and which portions, if any, should later become required merge gates?

This review intentionally separates four questions:

1. whether the pilot found a real defect;
2. whether scanner warnings represent independent defects or repeated structural evidence;
3. whether the toolchain adds acceptable CI and supply-chain cost;
4. whether ordinary exact-head CI, CodeQL and repository approval agree with the reviewed branch before adoption is classified.

## Defect signal already demonstrated

The first dependency scan exposed a real authority-boundary inversion: `src/session/VaultArchiveStore.ts` consumed the persistence facade from `src/vr/coordinators/types.ts`, making session/persistence meaning depend on a presentation-owned contract. Q0 moved `SessionStoreLike` to the neutral data/session layer and left the VR coordinator surface as a compatibility type re-export.

That is a genuine true positive for the pilot. The change is small, type-directed and aligned with the existing rule that investigation/persistence meaning must not depend on VR/UI presentation state.

No new RF is required for this already-fixed instance. The Q0 rule is the regression mechanism for the architecture class.

## Cycle-family classification

The hosted scan reports **20 cycle warnings across 363 modules / 1,039 dependencies**, but the raw warning count materially overstates the number of distinct structures. The warnings collapse into the following families.

| Family | Representative cycle | Classification | Disposition |
| --- | --- | --- | --- |
| VR scalability telemetry | `LoadTestThresholds.ts -> QuestTelemetry.ts -> LoadTestThresholds.ts` | `QuestTelemetry` has the runtime dependency on `percentile`; `LoadTestThresholds` refers back only through a TypeScript type import expression for `SustainedPerformanceProxy`. No runtime initialization loop is demonstrated. | Q0 evidence. Optional type-ownership cleanup if touched; no new RF. |
| Desktop engine controls | `DesktopControls.ts -> Engine.ts -> DesktopControls.ts` | `Engine` constructs/imports `DesktopControls` at runtime; `DesktopControls` imports `Engine` with `import type`. This is tight type coupling but not a demonstrated runtime module cycle. | Q0 evidence. Prefer a smaller engine/control port if this area is refactored; no new RF. |
| Signalling ticket/core | `SignallingServerCore.ts -> SignedTicket.ts -> SignallingServerCore.ts` | `SignallingServerCore` imports ticket verification at runtime; `SignedTicket` imports only the `NetworkRole` type from the server core. Security-sensitive location, but the reverse edge is type-only and the scan does not demonstrate an authentication, authorization, replay or initialization defect. | Q0 evidence. If modified under collaboration hardening, move shared protocol types such as `NetworkRole` to a neutral network protocol/types module. Existing Stream-C/RF security work remains the authority; no new RF from this cycle alone. |
| Moneta core self-reference | `src/moneta/types.ts -> src/moneta/types.ts` | The file uses `import('./types.ts').IChartPlane` and `import('./types.ts').IInstancedPointCloud` for types declared in the same module. This is a mechanical self-reference, not a runtime cycle. | Q0 noise/cleanup evidence. Replace with direct local type names when touched; no new RF. |
| Moneta representation decision types | `DecisionPolicy.ts -> RepresentationDecision.ts -> DecisionPolicy.ts` | Both reverse dependencies are type ownership between `CandidateScore` and `RepresentationDecisionStatus`; no runtime loop is demonstrated. | Q0 evidence. Shared decision model types can be extracted or ownership made one-way; no new RF. |
| Moneta layout barrel/type knot | repeated `layout -> LayoutBase/types -> layouts/index -> layout` variants | One structural family generates most of the 20 warnings. `src/moneta/types.ts` type-re-exports layout option types from `layouts/index.ts`, while layouts import core Moneta types and the barrel re-exports every layout. The barrel fan-out multiplies one type-direction problem into many reported cycles. | **TARGETED cleanup candidate**, not 15 independent defects. Make type ownership one-way or move layout option contracts to a neutral type module. Do not make a blanket zero-cycle rule required while this family remains intentional/unresolved. No new RF. |

### RF decision

**No cycle family warrants a new roadmap RF at this point.** The review found maintainability and ownership smells but no new demonstrated correctness, scientific-semantics, security, performance, persistence or production-path defect.

Creating RFs from scanner topology alone would violate the project rule that findings are threat/behavior/authority driven rather than scanner-line driven. The signalling family should be revisited whenever its owning Stream-C paths change, but it does not independently establish a new security defect. The Moneta barrel family is useful targeted refactoring evidence, not a reason to inflate the active RF ledger.

## ast-grep lifecycle-script / supply-chain consideration

The hosted `npm ci` emitted npm's `allow-scripts` warning for three packages with lifecycle scripts:

- newly introduced by Q0: `@ast-grep/cli@0.45.2` - `postinstall: node postinstall.js`;
- existing/transitive environment entries: `unrs-resolver@1.12.2` and `wasm-pack@0.15.0` also have postinstall scripts.

Q0 therefore adds a new lifecycle-script-bearing development dependency. Exact version pinning plus the lockfile constrains version/integrity selection, but it does not make postinstall execution risk disappear.

Disposition for Q0:

- record this as a supply-chain cost of adoption, not a hidden implementation detail;
- do not create a new RF because P1-Q Q8 already owns preventive dependency/supply-chain policy;
- if ast-grep is adopted beyond the pilot, explicitly review/approve its lifecycle script under the repository's npm script-allow policy, or prefer a practical distribution path that does not require an unreviewed lifecycle script;
- keep this consideration distinct from `npm audit` output. The hosted run reported zero known npm vulnerabilities, which does not answer lifecycle-script trust.

## Hosted cost evidence

The non-required `Architecture policy pilot` workflow was executed on GitHub-hosted Ubuntu 24.04 with Node `24.19.0` and npm `11.17.0`.

Observed evidence from run `33163881585`:

- `npm ci`: 311 packages installed / 312 audited in approximately **6 seconds** on the measured cold-cache run;
- combined `npm run architecture:check`: **1.84 seconds wall clock**;
- combined policy maximum resident set size: **306,628 KB** (approximately **299 MiB**);
- dependency-cruiser: 363 modules, 1,039 dependencies, **0 errors / 20 cycle warnings**;
- ast-grep rule tests: **1 passed / 0 failed**;
- ast-grep production scan: no blocking findings;
- workflow conclusion: **success**.

The architecture policy itself is cheap relative to dependency installation. A dedicated required job would still pay checkout/setup/install overhead unless it shares an existing install context, so gate design should consider total CI latency rather than quoting only the 1.84-second scanner time.

The temporary branch-only push trigger used solely to obtain this measurement was removed immediately after the successful run. The proposed workflow remains `pull_request` + `workflow_dispatch` and is still non-required.

## Adversarial assessment before ordinary PR gates

### What Q0 does well

- It already found one real presentation/persistence authority inversion that a regex-style source guard did not express cleanly.
- Dependency-direction rules encode architectural meaning rather than individual source strings.
- ast-grep gives structural matching plus positive/negative rule fixtures for constructs such as direct Worker creation.
- The core scan cost is low enough that ordinary PR use is technically plausible.
- Cycles are warnings during the pilot, preventing pre-existing structural debt from becoming a permanently-red gate.

### What Q0 does not prove

- A green static architecture scan does not prove production wiring, scientific correctness, runtime behavior, security, performance, or XR fitness.
- The 20-cycle count is not a defect count and must not become a quality KPI.
- Type-only cycles can be useful refactoring evidence without being runtime hazards.
- ast-grep pattern quality remains rule-specific; every blocking rule needs fixtures and semantic/path scoping.
- Hosted timing from one run establishes order-of-magnitude cost, not a universal latency guarantee.

## Promotion decision still pending

Do **not** classify Q0 as `ADOPT`, `TARGETED ONLY`, or `REJECT` from this document alone.

The remaining promotion evidence is intentionally ordinary repository evidence at one exact head:

1. open the Q0 PR against current `main` only while the branch is 0 commits behind;
2. capture ordinary CI and CodeQL for that exact PR head;
3. capture the repository's actual approval/review outcome rather than manufacturing an approval claim;
4. confirm the non-required architecture-policy PR job also runs successfully at that exact head;
5. only then record the final adoption classification and decide which individual rule(s), if any, deserve promotion to a required gate.

Until those checks agree, Q0 remains **PILOT / NOT A REQUIRED GATE**.
