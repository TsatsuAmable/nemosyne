# Nemosyne — Features

> A personal, experimental WebXR spatial data analysis project — not a maintained
> product or validated scientific instrument. Status below is intentionally
> conservative: **shipped** means the capability is production-wired and exercised
> by repository evidence; **experimental** means it runs but still requires
> qualification or scientific validation; **planned** means it is not yet a product
> claim. See [ROADMAP.md](./docs/ROADMAP.md) for the canonical implementation status.

Nemosyne maps multi-dimensional datasets into interactive 3D investigation spaces
using three.js / WebGL / WebXR, the Moneta representation-intelligence layer, a
Rust/WASM analytical kernel, and an experimental WebRTC collaboration layer.

---

## Core Features

### 1. WebXR Spatial Render Engine — _shipped; physical qualification ongoing_
- Direct three.js + WebXR runtime with explicit performance budgets and Quest validation infrastructure.
- Task-first investigation surfaces with governed desktop/XR task semantics and spatial panel placement.
- Body-locked radial wheel menu (`HandWheelMenu`) and contextual selected-object actions.
- Diegetic holographic inspection and bounded semantic drill-down from dataset structure to exact observations/provenance.
- Spatial audio and haptic interaction feedback.
- Final physical Quest comfort, tracking, direct-touch and sustained frame-pacing claims remain qualification work rather than inferred from simulator evidence.

### 2. Moneta Representation Intelligence & Semantic Embodiment — _shipped bounded core; empirical adaptation experimental_
- Explainable representation selection from governed dataset semantics and analytical-task requirements.
- Dataset-level semantic embodiments include aggregate, empirical distribution/density, governed cluster regions, and source-authoritative relationship graphs alongside legitimate observation-level point views.
- Rust/WASM owns work materially proportional to dataset size and emits bounded semantic payloads; TypeScript adapts those payloads into presentation geometry.
- Representation decisions retain alternatives, decision/provenance identity, and explicit preview/commit/revert semantics.
- Open-ended compositional search and generative geometry are not current product claims; the existing finite representation vocabulary is being validated first.

### 3. Data Operations & History — _shipped_
- Dataset operations execute in the Rust/WASM analytical kernel: filter, sort, aggregate, clustering, time-slice, anomaly detection, and related governed analyses.
- Undo/redo, archive recovery and investigation-state provenance are visible through the product journey.
- Live-stream connectors can feed incremental updates through the governed dataset/representation path.

### 4. Scalability & Bounded Detail — _shipped architecture; device envelope qualification ongoing_
- Instanced rendering, GPU point-cloud, spatial-index and LOD paths are available where appropriate.
- Dataset-level representations avoid requiring every source row to become a persistent visible mark.
- Semantic drill-down requests bounded observation/detail payloads from the resident authoritative runtime instead of rematerialising whole datasets in UI code.
- Large-N and sustained Quest performance claims remain evidence-gated by the physical validation programme.

### 5. Rust / WASM Analytical Kernel — _shipped sole analytical authority_
- Native Rust crate (`wasm/`) owns data parsing, scale-sensitive analytical operations, statistical profiling and governed semantic embodiment payload construction.
- JavaScript analytical fallback has been removed from the production authority path; failure/refusal is surfaced rather than silently selecting a shadow analytical implementation.
- Measurement semantics distinguish storage type from scientific scale semantics, including compositional, circular, temporal and other governed variable types.

### 6. Investigation UX & Interaction — _shipped product semantics; physical-input fitness ongoing_
- Shared investigator vocabulary across desktop and XR: inspect, compare, challenge, record, navigate and contextual follow-up actions.
- Compact status projection exposes focus, analytical readiness/refusal, representation state, evidence, recovery and state origin.
- Explicit reasoning journeys support investigator-authored questions, hypotheses, conclusions, skeptical review, branch lineage and durable recovery without manufacturing analytical truth.
- Gesture, controller, hand/direct-touch and comfort behavior remain subject to physical Quest qualification where simulator evidence is insufficient.

### 7. WebRTC Multi-User Collaboration — _experimental_
- `NetworkManager` / signalling and peer data channels support room presence and bounded collaboration state.
- Canonical signed-ticket admission includes strict role handling and replay protection on the live room-registry path.
- Collaboration remains experimental pending broader network, recovery, privacy and deployment qualification.

### 8. Topological Data Analysis — _shipped bounded analytical capability_
- Rust/WASM TDA capabilities include Mapper-style graph summaries, persistence-derived artifacts and Betti-curve summaries where scientifically admissible.
- TDA surfaces are optional analytical lenses rather than universal claims about every dataset.

### 9. Evidence, Provenance & Reproducibility — _shipped_
- Formal evidence entities preserve investigation context and attributable provenance.
- Append-only evidence and investigation structures support replay, skeptical review, branching lineage and explicit recovery.
- Representation decisions, alternatives and relevant model/artifact identities are retained so the road not taken is inspectable rather than discarded.

### 10. Adaptive Input Filtering & Interaction Diagnostics — _shipped; device tuning ongoing_
- Pointer filtering and interaction-state machinery reduce jitter and expose bounded diagnostics for controller/hand interaction.
- UX-friction and validation telemetry are opt-in and evidence-classified; simulator traces do not become physical-device proof.

### 11. Investigation Replay & `.nemosyne` Packaging — _shipped_
- `.nemosyne` packaging preserves governed investigation artifacts and integrity metadata.
- Headless replay exercises investigation state against the authoritative analytical runtime without requiring WebGL presentation.

### 12. Quest Validation Operations — _experimental infrastructure_
- Versioned validation manifests separate source identity, worktree state, evidence class, runtime class and gate disposition.
- Governed Quest modes distinguish ordinary trial evidence, physical validation and later clean-production qualification.
- Machine-captured ADB device/build identity is structurally separated from investigator-declared fallback metadata.
- The harness deliberately cannot upgrade simulator/dev evidence into final physical qualification; guided UX and clean-production device evidence remain to be collected.

---

## Technical Quality

- **Type safety:** production `src/` is TypeScript-checked; legacy test opt-outs are tracked as debt and should only decrease.
- **Tests:** required Vitest coverage is reconstructed from shards and repository-wide thresholds are enforced; exact file/test counts are intentionally not hard-coded here.
- **CI:** typecheck, lint, documentation integrity, architecture boundaries, coverage, production build, Rust tests and production-browser smoke are gated in GitHub Actions, with specialised evidence workflows for high-risk product paths.
- **Architecture policy:** dependency and AST policy checks guard authority boundaries and architectural regressions.
- **Supply chain:** GitHub Actions are commit-pinned and production runtime trust is kept intentionally narrow.
- **Evidence discipline:** implementation, production wiring, verification and physical qualification are treated as different claims rather than synonyms.

---

## License

MIT © Tsatsu Amable
