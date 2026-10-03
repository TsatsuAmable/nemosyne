import { describe, expect, it, vi, afterEach } from 'vitest';

import { PollingAdapter } from '../src/data/connectors/PollingAdapter.ts';

/**
 * Regression evidence for RFL-0005: lifecycle generation fencing in
 * PollingAdapter. The RFL skipped reproducer in
 * tests/rfl-polling-generation.test.ts is deliberately untouched here; its
 * conversion remains RFL's act.
 */
describe('PollingAdapter generation fencing', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('stale settlement keeps the live controller and a single loop, and disconnect aborts the live fetch', async () => {
    vi.useFakeTimers();
    const deferreds: Array<{ resolve: (v: unknown) => void; reject: (e: unknown) => void }> = [];
    const signals: AbortSignal[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: unknown, options: any) => {
        signals.push(options?.signal);
        return new Promise((resolve, reject) => {
          deferreds.push({ resolve, reject });
        });
      }),
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

    // Generation 2 owns the live fetch: its controller survived.
    expect((adapter as any)._abortController).not.toBeNull();
    // Exactly one loop: one interval produces no extra fetch.
    await vi.advanceTimersByTimeAsync(1000);
    expect(vi.mocked(globalThis.fetch).mock.calls.length).toBe(2);

    // Disconnect aborts the live fetch (pre-fix the controller was already
    // nulled, so this was a silent no-op leak).
    adapter.disconnect();
    expect(signals[1].aborted).toBe(true);
    expect(adapter.isConnected()).toBe(false);
  });
});
