# ADR-0011: Controlled Adaptive Representation Intelligence for Full Moneta (FM8)

- **Status:** Accepted
- **Date:** 2026-10-04
- **Context:**
  With the completion of FM1 (Perspective & Context), FM2 (Alternatives & Road Not Taken), FM3/FM4 (Composition & Resolution Broker), FM6 (Human Refinement & Forma Knowledge), and FM7 (Representation Search & Synthesis), Nemosyne requires a unifying Full Moneta capability (FM8). The system must synthesize context-aware, compositionally rich, hardware-adapted representations while upholding strict scientific constraints: analytical truth preservation, immutable investigation DAG history, orientation stability during transitions, and bitwise reproducibility under Research Mode freezing.

- **Decision:**
  1. **Unified Full Moneta Orchestration:**
     `FullMonetaEngine` integrates dataset evidence, committed investigator intent/perspective, System-1/2 search, knowledge base precedents, multi-element runtime, and hardware resolution brokering into a single coherent instrument.
  2. **Analytical Invariance Invariant:**
     Adapting, searching, or varying representation resolution operates strictly in perceptual and hypothesis space. Under no circumstances may adaptation mutate raw dataset rows, column types, canonical dataset fingerprints, or historical DAG investigation digests computed by Rust/WASM authority.
  3. **Cognitive Orientation & Transition Stability:**
     Every representation adaptation evaluates an explicit `AdaptationTransition` with landmark stability, semantic continuity, and coordinate scale preservation metrics. Representations must not disorient the investigator with abrupt layout or coordinate inversion.
  4. **Research Mode Freezing:**
     When Research Mode is enabled (`isResearchMode() === true`), all adaptive knowledge stores, model evaluation weights, and search randomizations are frozen to static reference configurations, guaranteeing bitwise-identical investigation replay across independent sessions.
  5. **TechnoCore Multi-Layer Introspection:**
     Full Moneta decisions expose multi-layer explanations bridging analytical evidence, intent alignment, prior advice, Pareto objective trade-offs, composed topology, and hardware budget adaptations.

- **Consequences:**
  - `AtlasCore` and `InvestigationAggregate` expose `adaptRepresentation()`, `explainFullMonetaDecision()`, and `setResearchMode()`.
  - Investigators can navigate between hardware profiles (e.g. PC-XR expansive vs Quest-constrained stickman) and intent shifts with guaranteed analytical and historical reproducibility.
  - Dormant prototypes without declared evidence owners continue to be retired under the FM8-CLEAN lifecycle.
