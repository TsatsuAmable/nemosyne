# Nemosyne VR Ecosystem: Complete Setup Guide

## Step-by-Step Setup Documentation

**Version:** 1.2.0  
**Last Updated:** April 14, 2026  
**Branches:** `vride`, `gestures`, `memory-palace-vr`

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Branch 1: VRIDE](#branch-1-vride)
4. [Branch 2: Gestures](#branch-2-gestures)
5. [Branch 3: Memory Palace VR](#branch-3-memory-palace-vr)
6. [MemPalace API Server](#mempalace-api-server)
7. [Integration Testing](#integration-testing)
8. [Troubleshooting](#troubleshooting)

---

## Overview

This repository contains three interconnected VR development branches:

| Branch | Purpose | Components |
|--------|---------|------------|
| **vride** | VR IDE for data visualization | 6DOF crystals, MemPalace adapter, templates |
| **gestures** | Hand/eye tracking formalism | Gesture recognition, interaction patterns |
| **memory-palace-vr** | Real-time VR datasphere | 6DOF crystals, sync bridge, demo |

**Integration Flow:**
```
MemPalace SQLite → API Server → memory-palace-vr → vride (IDE)
                     ↓
              gestures (input formalism)
```

---

## Prerequisites

### System Requirements

- **OS:** macOS 14+, Linux, or Windows 11
- **Node.js:** 16+ with npm
- **Python:** 3.9+ (for API server)
- **MemPalace:** Installed with indexed data
- **VR Headset:** Optional (Quest 2/Pro, Vision Pro, or PCVR)

### Verify Installation

```bash
# Check Node.js
node --version  # Should be v16+

# Check Python
python3 --version  # Should be 3.9+

# Check MemPalace
ls ~/.mempalace/palace/palace.db  # Should exist

# Verify wrapper
~/.openclaw/workspace-main/tools/mempalace-wrapper.sh status
```

---

## Branch 1: VRIDE

### Step 1.1: Checkout and Setup

```bash
cd /Users/tsatsuamable/Documents/nemosyne
git fetch origin
git checkout vride
```

### Step 1.2: View Documentation

```bash
# Documentation files
cat docs/vride/ARCHITECTURE.md      # Technical architecture
cat docs/vride/PRODUCT.md           # UX vision
cat docs/vride/RISKS.md              # Red team assessment
cat docs/vride/IMPLEMENTATION.md    # Phased roadmap
```

### Step 1.3: Start VRIDE Example

```bash
# Open example in browser
open vride/examples/vride-with-memory-palace.html

# Or serve with Python
python3 -m http.server 8080 --directory vride
# Navigate to: http://localhost:8080/examples/vride-with-memory-palace.html
```

### Step 1.4: Verify Components

The VRIDE branch includes:
- ✅ `vride/src/components/nemosyne-memory-crystal.js` - 6DOF crystal
- ✅ `vride/src/adapters/MemPalaceAPIAdapter.js` - API connection
- ✅ `vride/examples/vride-with-memory-palace.html` - Working demo
- ✅ `vride/docs/INTEGRATION_MEMORY_PALACE.md` - Setup docs

---

## Branch 2: Gestures

### Step 2.1: Checkout and View

```bash
git fetch origin
git checkout gestures
```

### Step 2.2: Review Gesture Specs

```bash
# Core specifications
cat docs/gestures/GESTURE_SPECIFICATION.md   # Technical formalism
cat docs/gestures/GESTURE_ENGINE.md          # Implementation
cat docs/gestures/HUMAN_INTERACTION_PATTERNS.md  # UX research
cat docs/gestures/README.md                   # Quick reference
```

### Step 2.3: Key Gesture Concepts

**Gesture Hierarchy:**
- **L0:** Micro-gestures (<16ms) - Intention signals
- **L1:** Atomic gestures (<50ms) - Pinch, grab, point
- **L2:** Compound gestures (<100ms) - Two-hand scale/rotate
- **L3:** Sequential gestures (<200ms) - Gesture sequences
- **L4:** Choreographic (<500ms) - Full-body phrases
- **L5:** Ambient (continuous) - Pre-conscious signals

**Core Components:**
- **Hand State:** 26 DOF per hand
- **Eye Tracking:** Fixation detection
- **Multimodal:** Hand + Eye fusion
- **GEL:** Gesture Expression Language

---

## Branch 3: Memory Palace VR

### Step 3.1: Checkout and Setup

```bash
git fetch origin
git checkout memory-palace-vr
```

### Step 3.2: Run the Demo

```bash
# Install dependencies
cd examples/memory-palace-vr
npm install

# Start dev server
npm run dev

# Open: http://localhost:5173
```

### Step 3.3: Key Features

The memory-palace-vr branch provides:
- ✅ **6DOF Crystals** - Position, rotation (quaternion), scale
- ✅ **Real-Time Sync** - 3s polling, WebSocket-ready
- ✅ **Semantic Layout** - Wings → clusters, rooms → orbitals
- ✅ **LOD System** - 4 levels for performance
- ✅ **Sample Data** - 50+ demo crystals

**File Structure:**
```
examples/memory-palace-vr/
├── index.html              # Main demo
├── ARCHITECTURE.md          # Technical docs
├── src/
│   ├── nemosyne-memory-crystal.js  # 6DOF component
│   ├── mempalcae-adapter.js       # DB bridge
│   └── sync-bridge.js              # Real-time sync
└── package.json
```

---

## MemPalace API Server

### Step 4.1: Start the Server

```bash
cd ~/.openclaw/workspace-main/mempalace-api
chmod +x start.sh
./start.sh
```

**Expected Output:**
```
[DB] Connected to /Users/tsatsuamable/.mempalace/palace/palace.db
[DB] Connected: 895 drawers
[HTTP] Server running on http://localhost:8765
[HTTP] Endpoints:
  GET http://localhost:8765/api/health
  GET http://localhost:8765/api/stats
  GET http://localhost:8765/api/structure
  GET http://localhost:8765/api/drawers
  GET http://localhost:8765/api/changes?since=<timestamp>
[WS] Server running on ws://localhost:8766
```

### Step 4.2: Test Endpoints

```bash
# Health check
curl http://localhost:8765/api/health
# {"status":"healthy","service":"mempalace-api"}

# Get stats
curl http://localhost:8765/api/stats
# {"drawer_count":895,"deleted_count":12,...}

# Get all drawers
curl http://localhost:8765/api/drawers | head -c 500
# [Large JSON with positions and colors]

# Get changes since timestamp
curl "http://localhost:8765/api/changes?since=1"
# {"modified":[...],"deleted":[...],"timestamp":...}
```

### Step 4.3: Python API Usage

```python
import requests

# Fetch all drawers with 6DOF positions
response = requests.get('http://localhost:8765/api/drawers')
data = response.json()
crystals = data['drawers']
print(f"Loaded {len(crystals)} crystals")

# Poll for changes
changes = requests.get('http://localhost:8765/api/changes?since=last_time').json()
if changes['modified']:
    print(f"{len(changes['modified'])} modified, {len(changes['deleted'])} deleted")
```

---

## Integration Testing

### Test 1: VRIDE + MemPalace

```bash
# 1. Ensure API server is running
curl http://localhost:8765/api/health

# 2. Open VRIDE example
open /Users/tsatsuamable/Documents/nemosyne/vride/examples/vride-with-memory-palace.html

# 3. Check browser console for:
# "[MemPalaceAPIAdapter] Connected: X crystals"
# "6DOF Crystal Created: ..."
```

### Test 2: Memory Palace VR Demo

```bash
# 1. In memory-palace-vr branch
cd /Users/tsatsuamable/Documents/nemosyne/examples/memory-palace-vr

# 2. Install and run
npm install
npm run dev

# 3. Open http://localhost:5173
# Should see starfield with animated crystals
# Hover over crystals for glow effect
# Click for preview panel
```

### Test 3: Direct API Client

```javascript
// In browser console
const adapter = new MemPalaceAPIAdapter({
  baseUrl: 'http://localhost:8765',
  wsUrl: 'ws://localhost:8766'
});

// Initialize
const crystals = await adapter.initialize();
console.log(`Loaded ${crystals.length} crystals`);

// Listen for updates
document.addEventListener('changes', (e) => {
  console.log('Update:', e.detail);
});
```

---

## Troubleshooting

### API Server Won't Start

**Problem:** Python not found  
**Fix:** `brew install python3` or use Python from TOOLS.md venv

**Problem:** MemPalace database not found  
**Fix:**
```bash
# Check location
ls ~/.mempalace/palace/palace.db

# If missing, index some content
~/.openclaw/workspace-main/tools/mempalace-wrapper.sh mine ~/Documents
```

**Problem:** Port already in use  
**Fix:**
```bash
# Find and kill process
lsof -i :8765
kill <pid>

# Or use different port
python3 server.py --port 8767
```

### VR Content Not Loading

**Problem:** CORS errors  
**Fix:** Serve files via HTTP, not file://

**Problem:** Crystals not appearing  
**Check:**
- WebXR compatible browser (Firefox, Chrome)
- JavaScript console for errors
- API server running and responding

### WebSocket Disconnects

**Normal behavior:**
- Server auto-reconnects after 5 seconds
- Polling continues as fallback

**Verify:**
```bash
# Check WebSocket server
lsof -i :8766

# Check browser console for "WebSocket connected"
```

---

## Architecture Summary

```
┌────────────────────────────────────────────────────────────────┐
│                    ECOSYSTEM OVERVIEW                             │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│   MemPalace SQLite DB (895 drawers indexed)                      │
│                    │                                             │
│                    ▼                                             │
│   ┌────────────────────────────────────────┐                       │
│   │  MemPalace API Server                 │                       │
│   │  - HTTP REST API (port 8765)            │                       │
│   │  - WebSocket (port 8766)               │                       │
│   │  - Spatial calculation               │                       │
│   └───────────┬──────────────────────────┘                       │
│               │                                                  │
│               │                                                  │
│   ┌───────────▼──────────┐            ┌───────────▼──────────┐       │
│   │ memory-palace-vr      │            │ vride (IDE)           │       │
│   │ - Standalone demo      │            │ - Template customizer   │       │
│   │ - Real-time sync        │◄─────────│ - 6DOF crystals         │       │
│   │ - LOD system           │   Uses   │ - MemPalace adapter     │       │
│   └───────────┬──────────┘            └───────────┬──────────┘       │
│               │                                  │                  │
│               │                                  │                  │
│   ┌───────────▼──────────┐            ┌───────────▼──────────┐       │
│   │ gestures              │            │ User                  │       │
│   │ - Input formalism     │            │ Developer/Data Scientist       │
│   │ - Recognition engine    │            │ Educator                │       │
│   │ - Interaction patterns  │            │ Explorer                │       │
│   └───────────────────────┘            └───────────────────────┘       │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

---

## Command Reference

### Quick Start Commands

```bash
# Complete setup from scratch
cd /Users/tsatsuamable/Documents/nemosyne

# 1. Fetch all branches
git fetch origin

# 2. Start API server (& runs in background)
cd ~/.openclaw/workspace-main/mempalace-api
./start.sh &

# 3. Open VRIDE example
open vride/examples/vride-with-memory-palace.html

# 4. Run Memory Palace Demo
cd examples/memory-palace-vr
npm install && npm run dev
```

### Git Branch Commands

```bash
# Switch to branch
git checkout vride
git checkout gestures
git checkout memory-palace-vr

# Update branch from origin
git pull origin vride

# Push local changes
git push origin vride
```

---

## Files Created

### Documentation (2,158 lines)
- `docs/vride/ARCHITECTURE.md`
- `docs/vride/PRODUCT.md`
- `docs/vride/RISKS.md`
- `docs/vride/IMPLEMENTATION.md`
- `docs/gestures/GESTURE_SPECIFICATION.md`
- `docs/gestures/GESTURE_ENGINE.md`
- `docs/gestures/HUMAN_INTERACTION_PATTERNS.md`
- `docs/gestures/README.md`

### Code (2,807 lines)
- `examples/memory-palace-vr/src/nemosyne-memory-crystal.js`
- `examples/memory-palace-vr/src/mempalcae-adapter.js`
- `examples/memory-palace-vr/src/sync-bridge.js`
- `examples/memory-palace-vr/index.html`
- `vride/src/components/nemosyne-memory-crystal.js`
- `vride/src/adapters/MemPalaceAPIAdapter.js`
- `vride/examples/vride-with-memory-palace.html`

### API Server (714 lines)
- `~/.openclaw/workspace-main/mempalace-api/server.py`
- `~/.openclaw/workspace-main/mempalace-api/start.sh`

**Total:** 5,679+ lines of implementation

---

*"VR data visualization + AI memory + spatial interaction = embodied cognition."*