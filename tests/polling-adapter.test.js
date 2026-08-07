// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PollingAdapter } from '../src/data/connectors/PollingAdapter.ts';

describe('PollingAdapter', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it('requires a url and parseResponse', () => {
    expect(() => new PollingAdapter()).toThrow('url');
    expect(() => new PollingAdapter({ url: 'https://example.com' })).toThrow('parseResponse');
  });

  it('polls and emits normalized updates', async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [{ properties: { mag: 2.5, time: Date.now(), place: 'A' } }],
      }),
    });

    const adapter = new PollingAdapter({
      url: 'https://example.com/quakes',
      intervalMs: 1000,
      parseResponse: (json) => ({
        rows: json.features.map((f) => ({ mag: f.properties.mag, place: f.properties.place })),
      }),
    });

    const updateSpy = vi.fn();
    adapter.onUpdate(updateSpy);

    adapter.connect();
    await vi.advanceTimersByTimeAsync(100);

    expect(updateSpy).toHaveBeenCalledOnce();
    const update = updateSpy.mock.calls[0][0];
    expect(update.dataset.rows.length).toBe(1);
    expect(update.dataset.rows[0].mag).toBe(2.5);

    adapter.disconnect();
  });

  it('emits an error when fetch fails', async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    });

    const adapter = new PollingAdapter({
      url: 'https://example.com/quakes',
      intervalMs: 1000,
      parseResponse: (json) => json,
    });

    const statusSpy = vi.fn();
    adapter.onStatus(statusSpy);

    adapter.connect();
    await vi.advanceTimersByTimeAsync(100);

    expect(statusSpy).toHaveBeenCalledWith('error', 'HTTP 503 Service Unavailable');

    adapter.disconnect();
  });

  it('reports connected state via isConnected', async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rows: [] }),
    });

    const adapter = new PollingAdapter({
      url: 'https://example.com/quakes',
      intervalMs: 1000,
      parseResponse: (json) => json,
    });

    expect(adapter.isConnected()).toBe(false);
    adapter.connect();

    // Wait for the first async tick to schedule the next poll.
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();
    expect(adapter.isConnected()).toBe(true);

    adapter.disconnect();
    expect(adapter.isConnected()).toBe(false);
  });

  it('ignores AbortError when disconnected mid-poll', async () => {
    vi.useFakeTimers();
    const deferred = {};
    globalThis.fetch = vi.fn().mockImplementation(() => {
      return new Promise((resolve, reject) => {
        deferred.resolve = resolve;
        deferred.reject = reject;
      });
    });

    const adapter = new PollingAdapter({
      url: 'https://example.com/quakes',
      intervalMs: 1000,
      parseResponse: (json) => json,
    });

    const statusSpy = vi.fn();
    adapter.onStatus(statusSpy);

    adapter.connect();
    adapter.disconnect();

    const err = new Error('The user aborted a request.');
    err.name = 'AbortError';
    deferred.reject(err);
    await vi.advanceTimersByTimeAsync(100);

    expect(statusSpy).not.toHaveBeenCalledWith('error', expect.any(String));
  });
});
