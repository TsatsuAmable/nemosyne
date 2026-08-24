import { describe, expect, it } from 'vitest';
import {
  getKernelState,
  getKernelUnavailableReason,
  initRuntime,
  invalidateRuntime,
  isReady,
  KernelUnavailableError,
} from '../src/wasm/RuntimeBridge.ts';

describe('RuntimeBridge initialization authority', () => {
  it('shares one initialization attempt between concurrent callers', async () => {
    invalidateRuntime('concurrent initialization test');

    const first = initRuntime();
    const second = initRuntime();
    const [firstModule, secondModule] = await Promise.all([first, second]);

    expect(firstModule).toBe(secondModule);
    expect(getKernelState()).toBe('READY');
    expect(isReady()).toBe(true);
  });

  it('prevents a superseded initialization from restoring authority', async () => {
    invalidateRuntime('start stale initialization');
    const stale = initRuntime();

    invalidateRuntime('superseded initialization');
    const fresh = initRuntime();

    await expect(stale).rejects.toBeInstanceOf(KernelUnavailableError);
    await expect(stale).rejects.toThrow(/superseded by runtime invalidation/i);
    await expect(fresh).resolves.toBeDefined();
    expect(getKernelState()).toBe('READY');
    expect(getKernelUnavailableReason()).toBeNull();
  });
});
