# Nemosyne Development Roadmap

**Last Updated:** 2025-04-14  
**Current Version:** 1.2.1  
**Current Phase:** Phase 5 Complete (Architecture Consolidation + Build System Stabilization)

---

## Phase 0: Foundation ✅ COMPLETE
**Timeline:** Weeks 1-2  
**Goal:** Research and theory development

- [x] Research data topology categories (graphs, fields, time-series, hierarchies, networks)
- [x] Study VR interaction patterns and affordances
- [x] Define artefact taxonomy (what types of VR objects work for what data?)
- [x] Document findings in `/research`

---

## Phase 1: Specification ✅ COMPLETE
**Timeline:** Weeks 3-4  
**Goal:** Define the framework's architecture and APIs

- [x] Artefact specification format (schema for defining artefacts)
- [x] Behaviour system design (how artefacts respond to events)
- [x] Transform pipeline (data → 3D representation)
- [x] Core framework architecture (A-Frame integration)
- [x] Write specification docs

**Deliverables:**
- `ARCHITECTURE.md` — Technical design decisions
- `docs/RESEARCH_AGENDA.md` — Research hypotheses and validation plan
- `docs/DATA_GEOMETRY_VR.md` — Data-to-geometry mapping theory

---

## Phase 2: Core Framework ✅ COMPLETE
**Timeline:** Weeks 5-8  
**Goal:** Build the foundational library

- [x] Base Artefact class/component
- [x] Transform engine (PropertyMapper, LayoutEngine)
- [x] Behaviour system (AnimationEngine, GestureController)
- [x] Event handling (TelemetryEngine, ResearchTelemetry)
- [x] Initial set of primitive artefacts (8 visual primitives)
- [x] Unit tests — **373 tests, 83.5% coverage**

**Key Modules:**
| Module | Status | Coverage |
|--------|--------|----------|
| AnimationEngine | ✅ Stable | 100% statements |
| GestureController | ✅ Stable | 100% statements |
| TelemetryEngine | ✅ Stable | 96.8% statements |
| LayoutEngine | ✅ Stable | 78% statements |
| TopologyDetector | ✅ Stable | 89.3% statements |
| NemosyneDataPacket | ✅ Stable | 75.1% statements |
| PropertyMapper | ✅ Stable | 87.7% statements |

---

## Phase 3: Examples + Integration Tests ✅ COMPLETE
**Timeline:** Weeks 9-12  
**Goal:** Demonstrate capabilities with working examples

- [x] "Hello World" — Basic VR data viz
- [x] Network graph (social connections, dependencies)
- [x] Time-series (stock prices, sensor data over time)
- [x] Bar chart with categorical data
- [x] Timeline spiral for temporal data
- [x] Data tree with hierarchical data
- [x] **Integration tests with Playwright (26 tests)**
- [x] Memory Palace VR integration

**Example Gallery:**
- `examples/hello-world/` — Getting started
- `examples/network-galaxy/` — Force-directed graph
- `examples/bar-chart/` — Categorical visualization
- `examples/timeline-spiral/` — Temporal data
- `examples/data-tree/` — Hierarchical data
- `examples/virtual-worlds/` — Composite scenes
- `examples/memory-palace-vr/` — Memory palace integration

---

## Phase 4: Documentation + CI/CD ✅ COMPLETE
**Timeline:** Ongoing  
**Goal:** Make it usable by others

- [x] Comprehensive README (150 lines, research framing)
- [x] Complete API reference (`docs/API_REFERENCE_COMPLETE.md`)
- [x] Layout guide (`docs/LAYOUT_GUIDE.md`)
- [x] Component gallery (`docs/COMPONENT_GALLERY.md`)
- [x] WebSocket streaming guide (`docs/WEBSOCKET_GUIDE.md`)
- [x] TypeScript definitions
- [x] CLI tool (`npx nemosyne init`)
- [x] CI/CD with GitHub Actions (test, build, docs)
- [x] Code of conduct and contributing guidelines
- [x] GitHub issue and PR templates

---

## Phase 5: Testing Infrastructure ✅ COMPLETE (v1.2.0)
**Timeline:** April 2025  
**Goal:** Comprehensive test coverage and CI integration

- [x] **373 unit tests** with Jest
- [x] **26 Playwright integration tests**
- [x] **83.5% code coverage**
- [x] CI type checking with TypeScript
- [x] Gesture interaction testing
- [x] Performance benchmarking
- [x] Telemetry and gaze tracking tests
- [x] Layout algorithm validation

---

## Phase 5.5: Architecture Consolidation ✅ COMPLETE (v1.2.1)
**Timeline:** April 14, 2025  
**Goal:** Unify framework source and ensure documentation accuracy

- [x] Consolidate `framework/src/` into `src/framework/` for single source of truth
- [x] Fix webpack build compatibility (replace CDN imports with npm dependencies)
- [x] Fix ESLint config for ES modules (.eslintrc.cjs)
- [x] Add `calculatePositions()` to framework LayoutEngine for API compatibility
- [x] Verify all README documented APIs are exported and functional
- [x] All 484 tests passing, builds successful
- [x] Documentation now matches implementation

---

## Phase 6: Expansion 🚧 IN PROGRESS
**Timeline:** Q2-Q3 2025  
**Goal:** Build a rich ecosystem of VR data components

### v1.3.0 Planned Features
- [ ] GitHub Wiki with tutorials
- [ ] Video tutorial series
- [ ] Mobile VR optimizations
- [ ] Physics integration (Ammo.js full support)
- [ ] Enhanced gesture recognition
- [ ] Voice command support
- [ ] Multiplayer sync (WebRTC)

### Component Wishlist
- [ ] Advanced artefacts (chord diagrams, Sankey flows, heatmaps)
- [ ] Composite artefacts (combinations of primitives)
- [ ] Audio-reactive artefacts
- [ ] AI-assisted artefact generation (v2.0)

---

## Phase 7: Real-World Validation 🚧 PENDING
**Timeline:** Q3-Q4 2025  
**Goal:** Prove practical value through research

### Research Questions
1. **Spatial Encoding Efficacy** — Does 3D improve topology comprehension?
2. **Datumplane Semantics** — Are axis assignments intuitive?
3. **Perceptual Density Limits** — At what point does 3D become overwhelming?
4. **Memory Palace Hypothesis** — Does spatial memory aid data recall?
5. **Multi-User Shared Reference Frames** — Can collaborators navigate shared spaces?

### Target Deployments
- [ ] IoT sensor dashboard
- [ ] Business intelligence VR
- [ ] Scientific visualization
- [ ] Education/training tools

See `docs/RESEARCH_AGENDA.md` for detailed hypotheses and validation plan.

---

## Phase 8: v2.0 — AR + AI 🚧 FUTURE
**Timeline:** 2026+  
**Goal:** Next-generation capabilities

- [ ] AR mode (WebXR hit-test)
- [ ] AI-assisted artefact generation
- [ ] Collaborative editing
- [ ] Commercial support tiers

---

## Version History

| Version | Date | Highlights |
|---------|------|------------|
| v1.2.1 | 2025-04-14 | Framework source consolidation, build system fixes, documentation compliance |
| v1.2.0 | 2025-04-13 | Integration tests, 373 tests, 83.5% coverage |
| v1.1.0 | 2025-04-13 | Test suite, CLI tool, TypeScript definitions |
| v1.0.0 | 2025-04-13 | API stabilization |
| v0.2.0 | 2025-04-10 | WebSocket streaming, ResearchTelemetry |
| v0.1.0 | 2025-04-07 | Initial release |

---

*Note: v1.x denotes API stability, not feature completeness. Major features continue in v1.x releases per semantic versioning principles.*
