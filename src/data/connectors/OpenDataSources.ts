export interface OpenDataSource {
  key: string;
  label: string;
  transport: 'websocket' | 'polling';
  url: string | null;
  topology: string;
  mode: string;
  windowSize: number;
  intervalMs?: number;
  fetchOptions?: RequestInit;
  subscriptions?: unknown[];
  parseMessage?: ((payload: Record<string, unknown>) => { name: string; rows: Record<string, unknown>[] } | null) | null;
  parseResponse?: ((json: Record<string, unknown>) => { name: string; rows: Record<string, unknown>[] } | null) | null;
}

/**
 * Curated, ready-to-use open live data sources.
 */
export const OPEN_DATA_SOURCES: OpenDataSource[] = [
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
    parseMessage: (payload: Record<string, unknown>) => {
      if (payload?.type !== 'ticker' || payload?.product_id !== 'BTC-USD') return null;
      return {
        name: 'Coinbase BTC-USD Ticker',
        rows: [
          {
            time: (payload.time as string) || new Date().toISOString(),
            product: payload.product_id,
            price: Number(payload.price),
            volume24h: Number(payload.volume_24h),
            open24h: Number(payload.open_24h),
            low24h: Number(payload.low_24h),
            high24h: Number(payload.high_24h),
          },
        ],
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
    parseMessage: (payload: unknown) => {
      // Kraken trade messages: [channelID, [[price, volume, time, side, orderType, misc]], channelName, pair]
      if (!Array.isArray(payload) || !Array.isArray(payload[1])) return null;
      const trades = payload[1] as [number, number, number, string, string, string][];
      return {
        name: 'Kraken BTC/USD Trades',
        rows: trades.map((t) => ({
          time: new Date(Number(t[2]) * 1000).toISOString(),
          pair: (payload[3] as string) || 'BTC/USD',
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
    parseMessage: (payload: Record<string, unknown>) => {
      if (payload?.e !== 'trade') return null;
      return {
        name: 'Binance BTC/USDT Trades',
        rows: [
          {
            time: new Date(Number(payload.T)).toISOString(),
            symbol: payload.s,
            price: Number(payload.p),
            quantity: Number(payload.q),
            buyerIsMaker: payload.m,
          },
        ],
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
    windowSize: 100,
    intervalMs: 60000,
    fetchOptions: {},
    parseResponse: (geojson: Record<string, unknown>) => {
      const features = geojson.features as Array<{
        id: string;
        properties: { time: number; mag: number; place: string; alert?: string };
        geometry?: { coordinates?: [number, number, number] };
      }>;
      if (!geojson || !Array.isArray(features)) return null;
      return {
        name: 'USGS Earthquakes (past hour)',
        rows: features.map((f) => ({
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
    windowSize: 100,
    intervalMs: 10000,
    fetchOptions: {
      headers: { 'User-Agent': 'NemosyneAnalysisSuite/0.1' },
    },
    parseResponse: (json: Record<string, unknown>) => {
      const states = json.states as unknown[][];
      if (!Array.isArray(states)) return null;
      return {
        name: 'OpenSky Aircraft Positions',
        rows: states.map((s) => ({
          icao24: s[0],
          callsign: String(s[1] || '').trim(),
          originCountry: s[2],
          time: new Date(Number(s[3]) * 1000).toISOString(),
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

export function getOpenDataSource(key: string): OpenDataSource | null {
  return OPEN_DATA_SOURCES.find((s) => s.key === key) || null;
}
