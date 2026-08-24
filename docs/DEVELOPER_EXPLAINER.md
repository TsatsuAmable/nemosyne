# Nemosyne developer guide

**Status:** current onboarding reference
**Updated:** 24 August 2026
**Read first:** [Definitive Vision](Nemosyne_Definitive_Vision_and_Roadmap.md),
[Roadmap](ROADMAP.md) and [Architecture](ARCHITECTURE.md)

## The mental model

Keep three objects distinct:

1. **Evidence:** analytical facts and identity computed by the Rust/WASM kernel.
2. **Investigation:** what the researcher asked, did, observed, concluded and can reproduce.
3. **Representation:** a bounded, explainable Moneta hypothesis embodied in desktop or WebXR.

Meshes, panels, gestures and network messages are projections or inputs. None owns analytical truth.
When the kernel is unavailable, surface `KernelUnavailable`; never add a JavaScript formula fallback.

## Start here in the code

| Task                              | Entry point                                                      |
| --------------------------------- | ---------------------------------------------------------------- |
| Application boot and composition  | `src/main.ts`, then `src/vr/World.ts`                            |
| Rendering and WebXR lifecycle     | `src/vr/Engine.ts`                                               |
| Rust/WASM calls                   | `src/wasm/RuntimeBridge.ts`                                      |
| Rust analytical implementations   | `wasm/src/`                                                      |
| Evidence access and orchestration | `src/atlas/AtlasCore.ts`, `src/atlas/MonetaEvidenceAuthority.ts` |
| Representation reasoning          | `src/moneta/representation/`, `src/moneta/`                      |
| Investigation state               | `src/atlas/domain/`                                              |
| Portable package and replay       | `src/session/`                                                   |
| Input and selection               | `src/vr/InputRouter.ts`, `src/vr/input/`                         |
| Spatial UI                        | `src/vr/coordinators/WorldUIManager.ts`, `src/vr/ui/`            |
| Network protocol                  | `src/network/`                                                   |
| Study instrument                  | `src/study/`, `docs/study/`                                      |

`src/draco/` exists only for compatibility. New production code imports Moneta directly.

## Follow one dataset

```text
FileLoader or connector
  → typed payload and RuntimeBridge dataset handle
  → Rust canonical fingerprint + DatasetStructureProfile
  → Atlas validates and exposes DatasetEvidence
  → Moneta chooses RepresentationDecision or records NIL
  → World embodies the SpatialStrategy
  → semantic actions update Investigation state
  → NemosyneSession exports/replays the same provenance
```

Large-data code must keep source rows in Rust-owned columnar storage. Prefer handles, borrowed typed
views, compact evidence or bounded render buffers. A convenient TypeScript row reconstruction is an
architectural regression unless explicitly confined to a small presentation fixture.

## Common change recipes

### Add an analytical operation

1. Implement and test the calculation in Rust.
2. Expose a bounded handle/`(ptr, len)` ABI.
3. Add the typed `RuntimeBridge` method and explicit error mapping.
4. Route the semantic command through Atlas/Investigation.
5. Verify provenance, determinism and the WASM seam.
6. Add presentation only after authority tests pass.

### Add representation evidence

1. Define the versioned evidence meaning and Rust source.
2. Extend the structure-profile/evidence ABI with fail-closed validation.
3. Update `DatasetEvidence` and canonical signatures.
4. Add metamorphic/provenance tests.
5. Let Moneta consume the compact fact; do not derive it from raw rows in TypeScript.

### Add a panel or interaction

1. Identify the semantic command/query it presents.
2. Reuse shared input dispatch for desktop, controller and hand paths.
3. Define enabled, hover/focus, commit, cancel and failure states.
4. Register one lifecycle owner and prove idempotent disposal.
5. Test visible behaviour and resource counts; profile per-frame allocations.

### Add collaboration behaviour

1. Extend the authenticated protocol and capability rules.
2. Validate every untrusted field and size before allocation or state mutation.
3. Convert messages to attributable semantic commands.
4. Test role violation, replay, disconnect and reconnect.

## Commands and required gate

```bash
npm install
npm run wasm:dev
npm run typecheck
npm run lint
npm run test:coverage
npm run build
cargo test --manifest-path wasm/Cargo.toml
npm run test:smoke
```

The CI aggregate requires all of these layers. `npm test` is JavaScript/WASM-boundary coverage only;
it does not replace native Rust tests. Playwright smoke uses a real production bundle and Chromium,
not the jsdom WebGL mock.

For iteration, run the smallest authoritative test first. Before a PR, run the full ordered gate.
Scale-sensitive work also needs the appropriate deterministic benchmark and, where relevant, physical
Quest evidence.

## Constraints that are easy to miss

- Source and tests are TypeScript; root tooling is also TypeScript where configured.
- three.js runtime resolution is pinned through the import map and TypeScript path mapping together.
- WebXR local development requires HTTPS; ordinary desktop development can use HTTP.
- Production build success does not make WASM optional at runtime.
- Rendering primitives are not data identifiers or research facts.
- Learned Moneta is opt-in and artifact-pinned; infrastructure readiness is not empirical validity.
- `.nemosyne` import is an untrusted-input boundary with path, schema and decompression budgets.

## Before opening a PR

- confirm the change aligns with V3 and does not add analytical authority in JavaScript;
- inspect the diff for resource ownership, unbounded input and per-frame allocation;
- update `ROADMAP.md` when implementation status or blockers change;
- record benchmark/device limits honestly;
- run the full gate, push the feature/fix branch and open a PR—never push directly to `main`.

Current risks and sequencing are maintained in the
[Pre-P1 Systematic Audit](PRE_P1_SYSTEMATIC_AUDIT.md).
