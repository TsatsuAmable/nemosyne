// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { OPEN_DATA_SOURCES, getOpenDataSource } from '../src/data/connectors/OpenDataSources.ts';

describe('OpenDataSources registry', () => {
  it('contains at least one demo and one public source', () => {
    expect(OPEN_DATA_SOURCES.length).toBeGreaterThanOrEqual(2);
    expect(OPEN_DATA_SOURCES.some((s) => s.key === 'demo-stream')).toBe(true);
  });

  it('every source has required metadata', () => {
    for (const source of OPEN_DATA_SOURCES) {
      expect(source.key).toBeTruthy();
      expect(source.label).toBeTruthy();
      expect(['websocket', 'polling']).toContain(source.transport);
      expect(source.topology).toBeTruthy();
    }
  });

  it('retrieves a source by key', () => {
    const source = getOpenDataSource('demo-stream');
    expect(source).toBeTruthy();
    expect(source.key).toBe('demo-stream');
  });

  it('returns null for unknown keys', () => {
    expect(getOpenDataSource('does-not-exist')).toBeNull();
  });

  it('WebSocket sources have a URL and subscription array', () => {
    for (const source of OPEN_DATA_SOURCES.filter((s) => s.transport === 'websocket')) {
      // The bundled demo stream resolves its URL at runtime.
      if (source.url !== null) expect(source.url).toBeTypeOf('string');
      expect(Array.isArray(source.subscriptions)).toBe(true);
    }
  });

  it('polling sources have a URL and parseResponse function', () => {
    for (const source of OPEN_DATA_SOURCES.filter((s) => s.transport === 'polling')) {
      expect(source.url).toBeTypeOf('string');
      expect(typeof source.parseResponse).toBe('function');
    }
  });

  it('coinbase parser extracts a BTC-USD ticker row', () => {
    const source = getOpenDataSource('coinbase-ticker');
    const parsed = source.parseMessage({
      type: 'ticker',
      product_id: 'BTC-USD',
      time: '2026-07-28T12:00:00Z',
      price: '65432.10',
      volume_24h: '12345.67',
      open_24h: '64000.00',
      low_24h: '63000.00',
      high_24h: '66000.00',
    });
    expect(parsed.rows.length).toBe(1);
    expect(parsed.rows[0].price).toBe(65432.1);
    expect(parsed.rows[0].product).toBe('BTC-USD');

    expect(source.parseMessage({ type: 'heartbeat' })).toBeNull();
  });

  it('kraken parser extracts BTC/USD trade rows', () => {
    const source = getOpenDataSource('kraken-trades');
    const parsed = source.parseMessage([
      42,
      [['65000.00', '0.123', '1722172800.4567', 'b', 'm', '']],
      'trade',
      'BTC/USD',
    ]);
    expect(parsed.rows.length).toBe(1);
    expect(parsed.rows[0].price).toBe(65000.0);
    expect(parsed.rows[0].side).toBe('b');

    expect(source.parseMessage({ event: 'heartbeat' })).toBeNull();
  });

  it('binance parser extracts a BTC/USDT trade row', () => {
    const source = getOpenDataSource('binance-trades');
    const parsed = source.parseMessage({
      e: 'trade',
      s: 'BTCUSDT',
      p: '65000.00',
      q: '0.123',
      T: 1722172800000,
      m: true,
    });
    expect(parsed.rows.length).toBe(1);
    expect(parsed.rows[0].price).toBe(65000.0);
    expect(parsed.rows[0].symbol).toBe('BTCUSDT');

    expect(source.parseMessage({ e: 'depthUpdate' })).toBeNull();
  });

  it('usgs parser extracts earthquake rows from GeoJSON', () => {
    const source = getOpenDataSource('usgs-earthquakes');
    const parsed = source.parseResponse({
      features: [
        {
          id: 'us123',
          properties: { time: 1722172800000, mag: 2.5, place: 'Near X', alert: 'green' },
          geometry: { coordinates: [-120, 35, 10] },
        },
      ],
    });
    expect(parsed.rows.length).toBe(1);
    expect(parsed.rows[0].magnitude).toBe(2.5);
    expect(parsed.rows[0].lon).toBe(-120);

    expect(source.parseResponse({})).toBeNull();
  });

  it('opensky parser extracts aircraft rows', () => {
    const source = getOpenDataSource('opensky-aircraft');
    const parsed = source.parseResponse({
      states: [
        [
          'a12345',
          'ABC123 ',
          'USA',
          1722172800,
          null,
          -120,
          35,
          10000,
          false,
          250,
          90,
          5,
          null,
          null,
        ],
      ],
    });
    expect(parsed.rows.length).toBe(1);
    expect(parsed.rows[0].icao24).toBe('a12345');
    expect(parsed.rows[0].callsign).toBe('ABC123');

    expect(source.parseResponse({})).toBeNull();
  });
});
