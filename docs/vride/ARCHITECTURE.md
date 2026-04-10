# VRIDE: Technical Architecture

## VR Integrated Development Environment for Nemosyne

**Version:** 0.1.0 - Architecture Draft  
**Branch:** vride  
**Date:** April 2026

---

## 1. Core Philosophy

### The VRIDE Paradigm Shift

Traditional IDEs are built on assumptions that break in VR:
- **Screen → Space:** From 2D windows to 3D embodied environment
- **Typing → Manipulating:** From character input to spatial gestures
- **Seeing → Being:** From observing output to inhabiting the creation

**VRIDE is not a port of 2D tools.** It is a fundamental reimagining of how humans author spatial content when they are *inside* that space.

### What "Editing" Means in VR

In VRIDE, "code" is not text. It is:

1. **Spatial Relationships** - Position, rotation, scale expressed through hand placement
2. **Data Bindings** - Visual pipelines from source → crystal property
3. **Behavioural Logic** - Trigger → Action mappings defined through demonstration
4. **Scene Composition** - Artefacts arranged in semantic groupings

The developer does not "write" a scene. They **curate, arrange, and imbue** data with spatial meaning.

---

## 2. System Architecture

```
                    VRIDE Core
    ┌─────────────────────────────────────────────┐
    │                                             │
    │  ┌──────────┐  ┌──────────┐  ┌──────────┐│
    │  │   SAL    │─►│   LPE    │─►│   CL     ││
    │  │(Assembly)│  │(Preview) │  │(Library) ││
    │  └────┬─────┘  └────┬─────┘  └────┬─────┘│
    │       │             │             │      │
    │       └─────────────┼─────────────┘      │
    │                     │                    │
    │  ┌──────────┐  ┌────┴────┐  ┌──────────┐│
    │  │   DFD    │─►│   SM    │◄─│   COL    ││
    │  │(Data)    │  │(State)  │  │(Collab) ││
    │  └──────────┘  └────┬────┘  └──────────┘│
    │                      │                    │
    │              ┌────────┴────────┐         │
    │              │   Nemosyne      │         │
    │              │   Framework     │         │
    │              └─────────────────┘         │
    └─────────────────────────────────────────────┘
    
    SAL = Scene Assembly Layer
    LPE = Live Preview Engine
    CL  = Component Library
    DFD = Data Flow Designer
    SM  = State Manager
    COL = Collaboration Layer
```

### 2.1 Scene Assembly Layer (SAL)

The SAL is VRIDE's answer to the DOM inspector and scene graph. It provides:

**Spatial Querying:**
```javascript
// Query crystals by spatial properties
const nearby = vride.scene.query({
  proximity: hand.position,
  radius: 2.0,
  type: 'crystal',
  hasProperty: 'data.value > 50'
});

// Group selection via volumetric brush
vride.tools.brush.select({
  shape: 'sphere',
  radius: 0.5,
  mode: 'add' // or 'toggle', 'remove'
});
```

**Hierarchical Navigation:**
- **The Elevator** - Vertical slice through scene depth (y-axis layers)
- **The Constellation** - Radial view of parent-child relationships
- **The Map Room** - Miniature bird's-eye view for teleportation

### 2.2 Live Preview Engine (LPE)

**The Challenge:** WebXR requires stable frame times. Hot-reloading JavaScript can cause frame drops.

**VRIDE's Solution: Dual-Context Architecture**

```
┌─────────────────────────────────────────────────────────┐
│                    LIVE PREVIEW ENGINE                   │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────┐      ┌──────────────────┐         │
│  │  EDITOR CONTEXT  │◄────►│  PREVIEW CONTEXT │         │
│  │  (Stable 90fps)  │      │  (Hot-reload OK) │         │
│  │                  │      │                  │         │
│  │  - UI Overlays   │      │  - User Scene    │         │
│  │  - Tool Handles  │      │  - Crystals      │         │
│  │  - Gizmos        │      │  - Behaviours    │         │
│  │  - Avatars       │      │  - Extensions    │         │
│  └──────────────────┘      └──────────────────┘         │
│           │                         │                    │
│           └───────────┬─────────────┘                    │
│                       ▼                                  │
│              ┌────────────────┐                          │
│  Main Thread │  SYNC LAYER    │ Web Worker               │
│              │  (State-only)  │                          │
│              └────────────────┘                          │
└─────────────────────────────────────────────────────────┘
```

### 2.3 Component Library

VRIDE surfaces Nemosyne primitives through spatial interfaces:

**The Tool Belt** (Hand-attached UI):  
Accessible by looking at palm + pinch gesture

```
   ╭───────────────────╮
   │   COMPONENT       │
   │    PALETTE        │
   ├─────────┬─────────┤
   │Crystal  │Layout   │
   │Factory  │Engines  │
   ├─────────┼─────────┤
   │Data     │Behaviour│
   │Sources  │Pack     │
   ├─────────┼─────────┤
   │Scene    │Ext.     │
   │Presets  │Library  │
   ╰─────────┴─────────╯
```

### 2.4 Data Flow Designer

Visual node-graph for data → visual mappings:

```
        ┌───────────────┐
        │  CSV Source   │
        │  employees    │
        └───────┬───────┘
                │ records[]
                ▼
        ┌───────────────┐
        │  Filter Node  │
        │ dept == "eng" │
        └───────┬───────┘
                │ filtered[]
                ▼
        ┌───────────────┐     ┌───────────────┐
        │ Aggregate Node│────►│  Avg Salary   │
        │ groupBy:dept  │     └───────────────┘
        └───────┬───────┘
                │ grouped[].avg(salary)
                ▼
        ┌───────────────┐
        │ Crystal Array │
        │ layout:bar    │
        └───────────────┘
```

### 2.5 Collaboration Layer

**Architecture:** Client-Server with CRDT

```
┌─────────┐                    ┌─────────┐
│ User A  │◄────WebSocket────►│ Server  │◄────WebRTC───┐
│ (Quest) │    Sync Protocol   │ (Node)  │   Mesh Data │
└─────────┘                    └─────────┘              │
     ▲                                                  │
     │              ┌─────────────────┐                │
     └─────────────►│  CRDT Document  │◄───────────────┘
                    │  (Automerge)    │
                    └─────────────────┘
```

---

## 3. State Management

### VRIDE Project Format (.vride)

```json
{
  "format": "vride-1.0",
  "metadata": {
    "name": "Factory Floor Dashboard",
    "created": "2026-04-09T12:00:00Z",
    "modified": "2026-04-09T14:30:00Z"
  },
  "scene": {
    "root": {
      "artefacts": ["uuid-1", "uuid-2"],
      "environment": {
        "sky": "dark-void",
        "fog": { "type": "exponential", "density": 0.02 },
        "grid": { "visible": true, "spacing": 1.0 }
      }
    },
    "artefacts": {
      "uuid-1": {
        "type": "nemosyne-artefact-v2",
        "transform": { "position": [0, 1.6, -2], "rotation": [0, 0, 0] },
        "spec": { /* artefact definition */ },
        "dataset": { /* embedded or ref */ },
        "bindings": { /* data-crystal mappings */ }
      }
    },
    "datasources": {
      "ws-sensor-feed": {
        "type": "websocket",
        "url": "wss://sensors.factory.local/live",
        "bufferSize": 100
      }
    }
  }
}
```

---

## 4. VR Interaction Patterns

### Precision vs Comfort Trade-offs

| Action | Gesture | Precision | Fatigue |
|--------|---------|-----------|---------|
| Select | Point + Pinch | High | Low |
| Move | Pinch + Drag | Medium | Medium |
| Rotate | Two-hand twist | High | Medium |
| Scale | Two-hand expand | Medium | Low |

### The "Slow-Motion" Modifier

- Hold grip button → time dilation 0.25x
- All movements slowed for micro-adjustments
- Haptic pulses mark "detents" (snap points)

---

## 5. Tech Stack Decisions

### Platform: WebXR (Browser-Based)

**Decision:** Build VRIDE as WebXR application

**Pros:**
- Universal access (Quest, PCVR, Vision Pro)
- Seamless Nemosyne integration
- No app store approval cycles

**Cons:**
- Performance ceiling lower than native
- WebXR API still evolving

### State Sync: Automerge (CRDT)

**Decision:** Use CRDT over Operational Transform

**Trade-off:** CRDT memory overhead ~2x raw state, but enables peer-to-peer fallbacks

---

## 6. Performance Budgets

### Frame Time Allocation (11.1ms @ 90fps)

| System | Budget | Technique |
|--------|--------|-----------|
| Nemosyne Preview | 5ms | LOD, culling, deferred updates |
| VRIDE UI/Gizmos | 3ms | Single draw call UI, baked meshes |
| Input/Physics | 2ms | Predictive hand tracking, simplified collision |
| Network/Sync | 1ms | Async CRDT merging, delta compression |

---

## 8. Open Questions

1. **Hand Tracking vs Controllers:** Mandate hand tracking or support both?
2. **Text Input:** Voice-first with Whisper, virtual keyboard, or companion app?
3. **Cross-Platform Parity:** How much degrades on Quest 2 vs Pro vs PCVR?

---

*"The best IDE is the one that dissolves into the act of creation."*

