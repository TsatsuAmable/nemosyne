/**
 * Curated, ready-to-use open live data sources.
 *
 * Each entry describes how to connect, what to subscribe to, and how to turn
 * the remote message format into a Nemosyne row. Sources are grouped by
 * transport (WebSocket vs REST polling).
 *
 * Notes on real-world APIs:
 *  - Coinbase, Kraken, and Binance public WebSocket feeds do not require auth.
 *  - USGS earthquake GeoJSON feed is polled.
 *  - OpenSky Network REST endpoint is polled and may require a user-agent.
 *  - Quest Browser / corporate networks may block some endpoints. If a source
 *    fails, check the live VR console for the error and try the bundled demo
 *    stream (`/__demo-stream`) instead.
 */

export const OPEN_DATA_SOURCES = [
  {
    key: 'demo-stream',
    label: 'Demo Sensor Stream (bundled)',
    transport: 'websocket',
    url: null, // resolved at runtime via World#_demoStreamUrl
    topology: 'TIME_SERIES',
    mode: 'window',
    windowSize: 50,
    subscriptions: [],
    parseMessage: null,
  },
  {
    key: 'coinbase-ticker',
    label: 'Coinbase — BTC-USD Ticker',
    transport: 'websocket',
    url: 'wss://ws-feed.exchange.coinbase.com',
    topology: 'TIME_SERIES',
    mode: 'window',
    windowSize: 60,
    subscriptions: [
      {
        type: 'subscribe',
        product_ids: ['BTC-USD'],
        channels: ['ticker'],
      },
    ],
    parseMessage: (payload) => {
      if (payload?.type !== 'ticker' || payload?.product_id !== 'BTC-USD') return null;
      return {
        name: 'Coinbase BTC-USD Ticker',
        rows: [{
          time: payload.time || new Date().toISOString(),
          product: payload.product_id,
          price: Number(payload.price),
          volume24h: Number(payload.volume_24h),
          open24h: Number(payload.open_24h),
          low24h: Number(payload.low_24h),
          high24h: Number(payload.high_24h),
        }],
      };
    },
  },
  {
    key: 'kraken-trades',
    label: 'Kraken — BTC/USD Trades',
    transport: 'websocket',
    url: 'wss://ws.kraken.com',
    topology: 'TIME_SERIES',
    mode: 'window',
    windowSize: 100,
    subscriptions: [
      {
        event: 'subscribe',
        pair: ['BTC/USD'],
        subscription: { name: 'trade' },
      },
    ],
    parseMessage: (payload) => {
      // Kraken trade messages: [channelID, [[price, volume, time, side, orderType, misc]], channelName, pair]
      if (!Array.isArray(payload) || !Array.isArray(payload[1])) return null;
      const trades = payload[1];
      return {
        name: 'Kraken BTC/USD Trades',
        rows: trades.map((t) => ({
          time: new Date(Number(t[2]) * 1000).toISOString(),
          pair: payload[3] || 'BTC/USD',
          price: Number(t[0]),
          volume: Number(t[1]),
          side: t[3],
        })),
      };
    },
  },
  {
    key: 'binance-trades',
    label: 'Binance — BTC/USDT Trades',
    transport: 'websocket',
    url: 'wss://stream.binance.com:9443/ws/btcusdt@trade',
    topology: 'TIME_SERIES',
    mode: 'window',
    windowSize: 100,
    subscriptions: [],
    parseMessage: (payload) => {
      if (payload?.e !== 'trade') return null;
      return {
        name: 'Binance BTC/USDT Trades',
        rows: [{
          time: new Date(payload.T).toISOString(),
          symbol: payload.s,
          price: Number(payload.p),
          quantity: Number(payload.q),
          buyerIsMaker: payload.m,
        }],
      };
    },
  },
  {
    key: 'usgs-earthquakes',
    label: 'USGS — Recent Earthquakes',
    transport: 'polling',
    url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson',
    topology: 'GEO',
    mode: 'replace',
    intervalMs: 60000,
    fetchOptions: {},
    parseResponse: (geojson) => {
      if (!geojson || !Array.isArray(geojson.features)) return null;
      return {
        name: 'USGS Earthquakes (past hour)',
        rows: geojson.features.map((f) => ({
          id: f.id,
          time: new Date(f.properties.time).toISOString(),
          magnitude: f.properties.mag,
          place: f.properties.place,
          depthKm: f.geometry?.coordinates?.[2],
          lon: f.geometry?.coordinates?.[0],
          lat: f.geometry?.coordinates?.[1],
          alert: f.properties.alert || 'unknown',
        })),
      };
    },
  },
  {
    key: 'opensky-aircraft',
    label: 'OpenSky — Aircraft Positions',
    transport: 'polling',
    url: 'https://opensky-network.org/api/states/all',
    topology: 'GEO',
    mode: 'replace',
    intervalMs: 10000,
    fetchOptions: {
      headers: { 'User-Agent': 'NemosyneAnalysisSuite/0.1' },
    },
    parseResponse: (json) => {
      if (!Array.isArray(json.states)) return null;
      return {
        name: 'OpenSky Aircraft Positions',
        rows: json.states.map((s) => ({
          icao24: s[0],
          callsign: (s[1] || '').trim(),
          originCountry: s[2],
          time: new Date(s[3] * 1000).toISOString(),
          lon: s[5],
          lat: s[6],
          altitude: s[7],
          velocity: s[9],
          heading: s[10],
          verticalRate: s[11],
        })),
      };
    },
  },
];

export function getOpenDataSource(key) {
  return OPEN_DATA_SOURCES.find((s) => s.key === key) || null;
}
