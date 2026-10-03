import { describe, expect, it, vi, afterEach } from 'vitest';

import { PollingAdapter } from '../src/data/connectors/PollingAdapter.ts';

function okResponse() {
  return { ok: true, json: async () => ({ rows: [{ a: 1 }] }) };
}

describe('RFL cycle 9: polling-adapter generation ownership', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('reconnects cleanly after a settled generation keeps a single loop', async () => {
    vi.useFakeTimers();
    const deferreds: Array<{ resolve: (v: unknown) => void; reject: (e: unknown) => void }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Promise((resolve, reject) => {
            deferreds.push({ resolve, reject });
          }),
      ),
    );
    const adapter = new PollingAdapter({
      url: 'https://example.com/live',
      intervalMs: 1000,
      parseResponse: (json: any) => json,
    });

    adapter.connect();
    deferreds[0].resolve(okResponse());
    await vi.advanceTimersByTimeAsync(0);
    adapter.disconnect();
    adapter.connect();
    await vi.advanceTimersByTimeAsync(1000);

    expect(vi.mocked(globalThis.fetch).mock.calls.length).toBe(2);
    adapter.disconnect();
  });

  // Skipped while RFL-0005 is an open candidate finding: when generation 1
  // is still in flight across a disconnect/reconnect, the stale tick's
  // `finally` clears generation 2's AbortController and arms a duplicate
  // timer, so disconnect() can no longer abort the live fetch and two loops
  // poll concurrently. Unskip to re-verify after generation fencing lands.
  it.skip('stale settlement never clears the live generation controller or duplicates the loop', async () => {
    vi.useFakeTimers();
    const deferreds: Array<{ resolve: (v: unknown) => void; reject: (e: unknown) => void }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Promise((resolve, reject) => {
            deferreds.push({ resolve, reject });
          }),
      ),
    );
    const adapter = new PollingAdapter({
      url: 'https://example.com/live',
      intervalMs: 1000,
      parseResponse: (json: any) => json,
    });

    adapter.connect();
    adapter.disconnect();
    adapter.connect();
    expect(vi.mocked(globalThis.fetch).mock.calls.length).toBe(2);

    const abortError = new Error('The user aborted a request.');
    abortError.name = 'AbortError';
    deferreds[0].reject(abortError);
    await vi.advanceTimersByTimeAsync(0);

    expect((adapter as any)._abortController).not.toBeNull();
    await vi.advanceTimersByTimeAsync(1000);
    expect(vi.mocked(globalThis.fetch).mock.calls.length).toBe(2);
    adapter.disconnect();
  });
});
