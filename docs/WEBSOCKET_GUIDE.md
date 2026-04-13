# WebSocket Guide

Real-time data streaming for immersive visualizations.

## Overview

Nemosyne supports WebSocket connections for live data updates, enabling real-time VR dashboards and monitoring systems.

## Basic Setup

```javascript
import { DataNativeEngine } from 'nemosyne';

const engine = new DataNativeEngine({
  websocket: {
    url: 'ws://localhost:8080/data',
    reconnect: true,
    reconnectInterval: 5000
  }
});

engine.connectWebSocket();
```

## Event Handling

```javascript
engine.on('websocket-message', (data) => {
  console.log('Received:', data);
  engine.ingest(data);
});

engine.on('websocket-error', (error) => {
  console.error('WebSocket error:', error);
});
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `url` | string | required | WebSocket server URL |
| `reconnect` | boolean | true | Auto-reconnect on disconnect |
| `reconnectInterval` | number | 5000 | Milliseconds between reconnects |
| `binaryType` | string | 'blob' | Binary data handling |

## Protocol

Nemosyne expects messages in the following format:

```json
{
  "type": "update",
  "data": {
    "id": "packet-1",
    "value": 42,
    "timestamp": "2025-04-13T10:00:00Z"
  }
}
```

## Security

- Use `wss://` (secure) in production
- Implement authentication tokens in URL or headers
- Validate all incoming data before ingestion

---

*For more examples, see the [examples/websocket/](../examples/) directory.*
