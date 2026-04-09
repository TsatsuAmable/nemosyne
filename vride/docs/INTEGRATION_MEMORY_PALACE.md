# VRIDE + Memory Palace Integration

## Connect 6DOF Crystals to Real MemPalace Data

**Version:** 1.0.0  
**Branch:** `vride`

---

## Overview

This integration connects VRIDE's 6DOF crystal components to the live MemPalace database via REST API and WebSocket.

**Architecture:**
```
MemPalace SQLite → REST API → WebSocket → MemPalaceAPIAdapter → nemosyne-memory-crystal
```

---

## Setup

### 1. Start MemPalace API Server

```bash
cd ~/.openclaw/workspace-main/mempalace-api
chmod +x start.sh
./start.sh
```

**Output:**
- HTTP API: `http://localhost:8765`
- WebSocket: `ws://localhost:8766`

### 2. Test Connection

```bash
curl http://localhost:8765/api/health
# {"status":"healthy","service":"mempalace-api"}

curl http://localhost:8765/api/stats
# {"drawer_count":895,"deleted_count":12,...}
```

### 3. Load VRIDE Example

```bash
cd /Users/tsatsuamable/Documents/nemosyne/vride
# Open examples/vride-with-memory-palace.html in browser
```

---

## API Reference

### MemPalaceAPIAdapter

```javascript
const adapter = new MemPalaceAPIAdapter({
  baseUrl: 'http://localhost:8765',  // HTTP API
  wsUrl: 'ws://localhost:8766'       // WebSocket
});

// Initialize
const crystals = await adapter.initialize();

// Listen for updates
document.addEventListener('changes', (e) => {
  const { additions, moves, deletions } = e.detail;
  // Update scene
});
```

### HTTP Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check |
| `GET /api/stats` | Database statistics |
| `GET /api/structure` | Wings/rooms/halls |
| `GET /api/drawers` | All drawers with positions |
| `GET /api/changes?since=ts` | Changes since timestamp |

### WebSocket Events

| Event | Payload |
|-------|---------|
| `init` | Full crystal data |
| `update` | Delta changes |

---

## Features

- ✅ Real-time sync via WebSocket
- ✅ HTTP polling fallback
- ✅ Smooth 6DOF transitions (500ms)
- ✅ Automatic reconnection
- ✅ Spatial position calculation
- ✅ Embedding-based color mapping

---

*"Your data, in VR, in real-time."*