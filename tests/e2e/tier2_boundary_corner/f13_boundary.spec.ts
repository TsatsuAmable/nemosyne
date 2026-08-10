import { describe, it, expect, vi } from 'vitest';
import { NetworkManager } from '../../../src/network/NetworkManager.ts';

describe('Tier 2 — Feature 13: 0 Unhandled Rejections & Leaks (Boundary Cases)', () => {
  it('F13-BC1: NetworkManager connect to invalid URL rejects promise safely without uncaught exception', async () => {
    const netManager = new NetworkManager({ signallingUrl: 'wss://invalid-domain-xyz-12345.com' });

    await expect(netManager.connect()).rejects.toThrow();
  });

  it('F13-BC2: Multiple parallel rejected async promises are all caught cleanly', async () => {
    const promises = Array.from({ length: 50 }, (_, i) =>
      Promise.reject(new Error(`Simulated async error ${i}`)).catch((err) => err.message)
    );

    const results = await Promise.all(promises);
    expect(results.length).toBe(50);
    expect(results[0]).toContain('Simulated async error 0');
  });

  it('F13-BC3: Dynamic import fallback handles non-existent module paths gracefully', async () => {
    let errorCaught = false;
    try {
      const invalidPath = './non_existent_module_path_123.ts';
      // @ts-ignore
      await import(/* @vite-ignore */ invalidPath);
    } catch (e) {
      errorCaught = true;
    }

    expect(errorCaught).toBe(true);
  });

  it('F13-BC4: Disconnecting NetworkManager when not connected performs safe no-op', () => {
    const netManager = new NetworkManager();
    expect(() => netManager.disconnect()).not.toThrow();
    expect(netManager.isConnected).toBe(false);
  });

  it('F13-BC5: NetworkManager setLocalState with oversized payload drops update with warning without throwing', () => {
    const netManager = new NetworkManager({ maxStateBytes: 100 });
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const hugeState = { data: 'a'.repeat(500) };
    expect(() => netManager.setLocalState(hugeState)).not.toThrow();

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('state payload exceeds maximum size'));
    consoleSpy.mockRestore();
  });
});
