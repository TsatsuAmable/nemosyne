# scriptc Native TypeScript Evaluation Plan

**Status:** planned experiment, not an architectural commitment  
**Owner lane:** L4 Runtime & Device Efficiency (currently Mac experimental capacity)  
**Decision rule:** no production migration until semantic parity, authority boundaries, portability, debugging and measured benefit are demonstrated.

## Purpose

Evaluate whether selected non-UI TypeScript can be compiled to small native artifacts with scriptc without creating a second analytical authority or weakening Nemosyne's replay/provenance guarantees.

This is a **runtime/tooling optimization experiment, not a Full-Moneta architectural dependency**. Rust/WASM remains the sole analytical authority. Browser/WebXR rendering, device lifecycle and UI remain outside this experiment. Any direct Quest/browser use would require a separately justified native-host topology and therefore belongs to the MAC-Q5 escape-hatch class, not ordinary FM5.

## T0 — Toolchain and baseline

On the Mac lane, pin the scriptc version and record host/SDK/Node/compiler versions. Build a trivial fully-static executable and retain:
- `scriptc coverage` report;
- compile time, binary size and dynamic-remainder status;
- cold/warm startup latency and peak RSS;
- release and dev/debug builds.

Repeat the trivial probe on Linux CI before any promotion. Windows is informative only until Nemosyne's Windows support decision is resolved.

**Exit:** reproducible pinned build on Mac + Linux, or STOP with incompatibility record.

## T1 — Canary: deterministic investigation utility

First real target: `src/investigation/InvestigationDigest.ts`.

Create the thinnest possible CLI/test harness around representative production inputs. Run the same fixture corpus through Node and scriptc.

Required evidence:
1. `scriptc coverage` classification and every dynamic/unsupported site;
2. byte-for-byte digest/output parity across normal, empty, boundary and malformed inputs;
3. deterministic repeated-run parity;
4. existing relevant unit/property tests unchanged;
5. startup latency, execution latency, peak RSS, binary size and build time;
6. sanitizer/dev-debug run where supported;
7. failure/exception behaviour comparison.

**Promotion threshold:** 100% semantic parity. Native adoption requires a material measured deployment/runtime benefit; compilation alone is not a benefit.

## T2 — Pure contracts and registry logic

Subject to T1 PASS, evaluate dependency-light deterministic modules:
- `src/moneta/system1/System1Contracts.ts`;
- `src/fitness/FitnessModelRegistry.ts`;
- other pure validation/normalisation/serialization helpers discovered by coverage census.

Use differential/property tests: Node implementation is the comparison implementation, while existing governed fixtures and invariants remain the oracle. Never treat Node/scriptc agreement as proof of scientific correctness.

**Exit:** classify each module STATIC / DYNAMIC-REMAINDER / REJECT, with measured costs.

## T3 — bounded native sidecar/tool prototype

Only after T1/T2 PASS **and only if there is an actual deployable native sidecar/tool target**, prototype a native executable around provider-neutral System-1/Forma proposal orchestration or another measured dependency-light utility. It may:
- validate proposal contracts;
- transform bounded feature vectors;
- invoke an already-approved model/runtime only through the existing pinned proposal contract where feasible;
- emit proposals plus version/provenance metadata.

It may **not**:
- compute authoritative DatasetEvidence;
- bypass Rust/WASM;
- choose/promote a representation or perceptual binding outside Moneta/Forma governance;
- mutate Investigation state directly;
- silently fall back to a semantically different dynamic path.

Compare native sidecar vs current TS runtime for startup, RSS, proposal latency where applicable, packaging friction and replay equivalence. If no real native deployment topology exists, record T3 as NOT-APPLICABLE rather than inventing one.

## T4 — Native utility/agent census

If T1-T3 justify continuation, run `scriptc coverage` over dependency-light CLI/worker utilities and classify candidates. Prefer frequently spawned, short-lived tools where Node startup/RSS is actually material.

Candidate families:
- replay/digest/verification utilities;
- model/fitness registry inspection;
- deterministic provenance/package validators;
- bounded agent/dispatcher helpers with no browser dependency.

Do not migrate long-lived code merely to reduce startup time.

## Explicit exclusions

Do not compile as part of this programme:
- WebXR, Three.js rendering, DOM/UI/panel code;
- input/device/browser lifecycle;
- Worker ownership paths unless separately qualified;
- Rust/WASM analytical algorithms or TS code that would duplicate them;
- evidence-admissibility or promotion authority merely to gain speed;
- modules requiring unsupported dynamic semantics unless a separately measured dynamic build has a compelling operational case.

## Measurement protocol

For every candidate record: source commit, scriptc version, host/target, coverage %, dynamic sites, build mode, binary size, build time, cold/warm latency distributions, peak RSS, semantic differential result, test corpus hash and disposition.

Use at least 30 timed process starts after an untimed warm-up for startup-sensitive tools. Report median and p95, not a single run. For substantive workloads use a fixed fixture corpus and enough repetitions to expose variance. Preserve raw measurements as CI artifacts.

## Adoption gate

A module may become native only when all are true:
- semantic differential suite passes;
- deterministic/replay properties are unchanged;
- no authority boundary moves;
- Linux CI can reproduce the build;
- debugging/observability is adequate;
- packaging/security implications are reviewed;
- measured benefit is material for its actual workload;
- Node path remains available until native qualification is complete.

Otherwise retain TypeScript and record why. A negative result is a successful experiment.

## Roadmap placement

- **Now / L4 runtime experiment:** T0-T2. Non-blocking against FM0-FM4 and current P1-TEC work.
- **Conditional L4 follow-up:** T3 only if T0-T2 expose a real native deployment/tool target with measurable value; it may consume the provider-neutral System-1/Forma proposal contract but is not an FM5 gate.
- **Post-T3 only:** T4 census and selective native packaging.
- **Never a prerequisite for Full Moneta:** scriptc is an implementation optimization path, not a scientific/product capability gate.
