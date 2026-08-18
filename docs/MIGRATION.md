# Nemosyne Migration & Architecture Boundary Register

This register documents the migration path from legacy `World.ts` direct facade properties to the extracted coordinator architecture for Nemosyne `1.0-alpha.2` and beyond.

---

## 1. Domain Boundary Architecture

To prevent architectural density and tight coupling, Nemosyne enforces a strict separation of concerns between analytical truth, spatial embodiment, and application composition:

```
┌────────────────────────────────────────────────────────┐
│                  Nemosyne Application                  │
│          Composition Root & Lifecycle Coordination     │
└───────────────────────────┬────────────────────────────┘
                            │
       ┌────────────────────┴───────────────────┐
       ▼                                        ▼
┌──────────────┐                        ┌───────────────┐
│ Analysis     │                        │ Spatial       │
│ Runtime      │                        │ Runtime       │
├──────────────┤                        ├───────────────┤
│ AtlasCore    │                        │ Engine        │
│ DatasetSpace │                        │ Three.js      │
│ Structures   │                        │ InputRouter   │
│ Provenance   │                        │ UI Panels     │
└──────┬───────┘                        └───────┬───────┘
       │                                        ▲
       │        EmbodimentCommand Pipeline      │
       └────────────────────────────────────────┘
```

### Governing Invariants:
1. **Atlas Boundary**: Atlas analytical models, operation execution, and provenance generation MUST NOT depend on Three.js, WebGL/WebXR, or DOM elements.
2. **Spatial Boundary**: Presentation layers (panels, 3D meshes, controllers) MUST NOT directly mutate Atlas analytical truth or bypass provenance ledgers.
3. **Session Boundary**: Serialized sessions (`NemosyneSession`) must be fully standalone and capable of restoring into an isolated runtime without referencing prior `World` instances.

---

## 2. World.ts Facade Deprecation Register

| Legacy Property / Method (`world.*`) | Canonical Replacement | Status | Target Removal |
|---|---|:---:|:---:|
| `world.dashboard` | `world.uiManager.dashboard` | 🟡 Deprecated | `1.0.0` |
| `world.panelManager` | `world.uiManager.panelManager` | 🟡 Deprecated | `1.0.0` |
| `world.wheelMenu` | `world.uiManager.wheelMenu` | 🟡 Deprecated | `1.0.0` |
| `world.tours` | `world.uiManager.tours` | 🟡 Deprecated | `1.0.0` |
| `world.theme` | `world.engine.theme` | 🟡 Deprecated | `1.0.0` |
| `world.loadTestPanel` | `world.uiManager.loadTestPanel` | 🟡 Deprecated | `1.0.0` |
| `world.telemetryPanel` | `world.uiManager.telemetryPanel` | 🟡 Deprecated | `1.0.0` |
| `world.networkPanel` | `world.uiManager.networkPanel` | 🟡 Deprecated | `1.0.0` |
| `world.spatialAudio` | `world.sceneComposer.spatialAudio` | 🟡 Deprecated | `1.0.0` |
| `world.currentDataset` | `world.sessionController.currentDataset` | 🟡 Deprecated | `1.0.0` |
| `world.datasets` | `world.sessionController.datasets` | 🟡 Deprecated | `1.0.0` |
