# Financial Markets Visualization

Real-time trading floor with market depth and order book visualization.

## Overview

Visualizes cryptocurrency and stock trading data in a 3D market environment. Includes price bars, volume indicators, and bid/ask walls.

## Data Sources

**Simulation Mode (default):**
- Generates price movements every 2 seconds
- Simulates volatility patterns
- Includes both crypto and traditional markets

**Production Integration:**

**Alpaca Markets (Recommended):**
```javascript
const ws = new WebSocket('wss://stream.data.alpaca.markets/v2/iex');
ws.send(JSON.stringify({
  action: 'subscribe',
  trades: ['AAPL', 'MSFT', 'TSLA'],
  quotes: ['BTCUSD', 'ETHUSD']
}));
```

**Binance:**
```javascript
const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@trade');
```

## Market Instruments

Default symbols:
- **Cryptocurrency:** BTC-USD, ETH-USD, SOL-USD
- **Stocks:** AAPL, MSFT, NVDA

## Visual Encoding

**Price Movement:**
| Change | Color | Animation |
|--------|-------|-----------|
| > +1% | Green (#00d4aa) | Scale up 1.2x |
| +0-1% | Light green | Subtle glow |
| -0-1% | Light red | Subtle dim |
| < -1% | Red (#ff3864) | Scale down 0.8x |

**Order Book:**
- **Bids (Green):** Left wall, buy orders
- **Asks (Red):** Right wall, sell orders
- **Mid-price:** Central gold indicator

## FIX Protocol Support

Component can parse FIX messages:
```
8=FIX.4.4|9=100|35=W|55=BTCUSD|268=2|269=0|270=45234|271=100|
```

## Component API

```javascript
// Create market depth visualization
const instrument = document.createElement('a-entity');
instrument.setAttribute('market-depth', {
  symbol: 'BTC-USD',
  price: 45234,
  volume: 15420,
  change: 1.2  // percentage
});
```

## Performance Optimizations

**Update Throttling:**
```javascript
// Limit updates to 10fps for performance
let lastUpdate = 0;
function throttledUpdate(data) {
  if (Date.now() - lastUpdate > 100) {
    updateVisualization(data);
    lastUpdate = Date.now();
  }
}
```

**Lazy Loading:**
- Only render visible instruments
- Use LOD for distant objects

## Configuration

**Volatility Settings:**
```javascript
const volatility = 0.02; // 2% max change per update
const change = (Math.random() - 0.5) * volatility;
```

**WebSocket Reconnection:**
```javascript
ws.onclose = () => {
  setTimeout(() => connectWebSocket(), 5000);
};
```

## Security Considerations

- Use authenticated WebSocket connections
- Rotate API keys regularly
- Validate all incoming price data
- Implement rate limiting

## Compliance

**MiFID II:**
- Timestamp all market data
- Store audit trail
- Best execution reporting

## License

MIT License - TsatsuAmable 2026