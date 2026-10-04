# ADR-0013: Minimum Nemosyne architecture and four-subsystem boundary

**Status:** Accepted  
**Date:** 2026-10-04  
**Supersedes:** none  
**Superseded by:** none  
**Tracking:** RFC 0012, #989

## Context

The definitive product vision requires useful scientific discovery, authoritative evidence, inspectable composition, dual epistemic purposes (grounded abduction vs. conjectural exploration), durable investigation replay, and progressive improvement from human feedback. 

Prior integration tranches and the ADAPT embodiment proposals accumulated speculative resident machinery:
- Mandatory System-1 advisory inference (`FormaSystem1Proposer`) executing on every representation compilation, even when advice is bypassed;
- Multi-generation population search (`RepresentationSearchEngine.search`) running inside the default runtime loop;
- Parallel mutable semantic graphs (`SemanticEmbodimentGraphV1` alongside canonical `SemanticSnapshotV1`);
- Proliferating persistent stores and controllers (separate Memory Palace, Road Not Taken, and TechnoCore stores) creating competing mutable truth sources;
- Planned resident training pipelines, world models, and speculative multimodal runtimes.

This added significant cognitive and architectural overhead without improving the core scientific investigator loop: import dataset → formulate question → inspect bounded multi-phenomenon overview → explain decision → refine/branch → test hypothesis → record conclusion → persist/reopen package.

## Decision

Adopt the **four-subsystem minimum architecture** defined in RFC 0012 and remove speculative machinery from the default product execution path:

1. **Data and evidence runtime**: Rust/WASM owns canonical data, N-dependent analytics, and scale-sensitive reductions; bounded Worker queries; existing evidence policy enforces claim gating.
2. **Investigation**: Single authoritative domain aggregate (`InvestigationAggregate` with `AtlasCore` application facade) owning committed intent/purpose, branches, discoveries, attributable feedback, artifact selection, and durable history.
3. **Representation compiler (Moneta + Forma)**: Deterministic evidence-bound composition grammar, inspectable alternatives, admission checks, and spatial plan compilation. These remain distinct contracts within a single compiler subsystem.
4. **Presentation and input**: Modality-independent scene, lifecycle, and interaction owner; desktop and WebXR surfaces are adapters; NIL (Natural Interaction Language) remains the semantic command boundary.

### Executable Consolidation and Phasing Rules

- **Direct deterministic compile path**: A direct compile from `Dataset` → bounded analytical evidence → spatial embodiment plan must execute without loading optional neural models, running evolutionary search, or requiring remote network services.
- **Retire production duplication**: Retire `SemanticEmbodimentGraphV1` as a second active truth source. Canonical `SemanticSnapshotV1` owns grounded semantics; preserve only read-only decoders needed for archive compatibility.
- **Externalize heavy research execution**: Move population search, genome evolution (`RepresentationGenomeHandoff`), and model training outside the shipping browser application. The offline research lab produces versioned candidate graphs and qualified prior artifacts, which the product compiler validates and admits through identical gates.
- **Merge UX state projections**: Memory Palace, Road Not Taken, and TechnoCore remain user-visible metaphors and views, but project exclusively from `InvestigationAggregate` and `EvidenceLedger` rather than maintaining independent state authorities.
- **Fail-closed admission**: Moving search and learning offline does not relax product gates. All imported artifacts must face identical local admission, integrity, and provenance validation before embodiment.

## Consequences

- **Positive**:
  - Dramatically simplified core call graph and execution path: cold boot and view synthesis do not block on model instantiation or evolutionary loops.
  - Zero loss of scientific honesty: analytical truth remains strictly Rust-owned (ADR-0001), dual-epistemic distinction remains typed and visible (RFC 0011), and replay remains bitwise deterministic.
  - Bounded resource complexity: overview transfer and scene elements remain bounded independently of row count $N$.
- **Negative / Trade-offs**:
  - Runtime evolutionary search is removed from the interactive desktop/VR loop; non-catalogue candidate graphs must be produced offline or pre-compiled into versioned libraries.
  - Requires clean migration and caller removal across existing Moneta adaptation test suites before retiring legacy coordinator methods.
- **Neutral**:
  - Offline learning, model evaluation, and synthesis research programmes continue unimpeded using repo/CI tooling.
