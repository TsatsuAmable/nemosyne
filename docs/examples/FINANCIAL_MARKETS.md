# Financial Markets Example

FIX protocol visualization for trading desks.

## Use Case
Monitor live order flow, market depth, and execution quality.

## Data Schema
```jsonn{
  "orders": [
    {,      "clOrdID": "ORD-20260407-001",
      "symbol": "AAPL",
      "side": "BUY",
      "orderQty": 1000,      "price": 178.50,
      "ordType": "LIMIT",      "timeInForce": "GTC",
      "transactTime": "20260407-13:30:00.000"
    }  ],  "marketData": {
    "symbol": "AAPL",
    "bid": 178.48,    "ask": 178.52,
    "bidSize": 5000,
    "askSize": 3000  }}
```

## Artefacts
- **Order Book:** Bid/ask columns with depth visualization
- **Order Flow:** Animated particles showing execution
- **Price Ladder:** Vertical price scale with current position
- **Session Volume:** Hourly bars showing activity

## FIX Protocol Integration
- Tag 35 (MsgType) → Visual category
- Tag 39 (OrdStatus) → Color mapping
- Tag 150 (ExecType) → Animation trigger

## Extensions Required
- FIX parser module
- High-frequency update optimization
- Order matching visualization
