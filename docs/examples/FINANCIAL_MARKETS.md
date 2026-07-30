# Financial Markets Example

A market-session memory palace built from the `financial-series` sample dataset.

## What it shows

`src/data/SyntheticData.js` generates 48 hourly OHLCV candles for the `MEMO` symbol:

| time | symbol | open | high | low | close | volume |
|---|---|---|---|---|---|---|
| 2026-07-28T00:00:00 | MEMO | 103.42 | 105.10 | 101.80 | 104.15 | 4782 |
| ... | ... | ... | ... | ... | ... | ... |

The Draco engine infers **TIME_SERIES** and lays the candles out as a temporal ribbon. High-volume ticks become larger tokens.

## Artefacts generated

- **OHLCV ribbon** — time-series trail of open/high/low/close values.
- **Volume tokens** — one per tick, sized by `volume`.
- **Anomaly halos** — price or volume outliers glow magenta.

## Try this in VR

1. Launch the app and open the wheel menu.
2. Choose **Views → Dataset** and pick **Financial Candle Series**.
3. Operations you can perform:
   - **Time slice** — wheel menu or `sliceDown` gesture to scrub through the session.
   - **Anomaly on `close` or `volume`** — wheel menu **Ops → Highlight Outliers**.
   - **Sort by volume** — `sliceUp` gesture.
   - **Toggle statistical lens** — `scoopUp` gesture for correlation and TDA panels.

## Note on live market data

The runtime does not currently ship with curated market-data adapters. You can bring your own CSV/JSON file or feed a WebSocket stream through `WebSocketAdapter`. Curated exchange adapters are planned for a future release.

## Export

Use **Panels → Export Story** to download the session and operation log.
