import { describe, it, expect, vi } from 'vitest';
import { KernelUnavailableError } from '../src/wasm/RuntimeBridge.ts';

describe('RuntimeBridge Kernel Lifecycle & Explicit State Architecture', () => {
  it('instantiates KernelUnavailableError with correct properties and prototype inheritance', () => {
    const err = new KernelUnavailableError('Custom test reason', 'UNAVAILABLE');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(KernelUnavailableError);
    expect(err.name).toBe('KernelUnavailableError');
    expect(err.code).toBe('KERNEL_UNAVAILABLE');
    expect(err.state).toBe('UNAVAILABLE');
    expect(err.reason).toBe('Custom test reason');
    expect(err.message).toContain('[KernelUnavailable] Custom test reason');
  });

  it('reports fresh module state as UNINITIALIZED with no unavailable reason', async () => {
    // A fresh module instance gives a deterministic pre-init state without
    // depending on whether any other test file initialized the shared
    // RuntimeBridge singleton in this worker.
    vi.resetModules();
    const fresh = await import('../src/wasm/RuntimeBridge.ts');
    expect(fresh.getKernelState()).toBe('UNINITIALIZED');
    expect(fresh.getKernelUnavailableReason()).toBeNull();
    expect(fresh.isReady()).toBe(false);
  });

  it('requireRuntime throws KernelUnavailableError before initialization (fail-closed)', async () => {
    // Unconditional: evaluated against a fresh, never-initialized module so
    // the fail-closed guard cannot be silently skipped by a READY kernel.
    vi.resetModules();
    const fresh = await import('../src/wasm/RuntimeBridge.ts');
    // A reset module re-evaluates RuntimeState.ts, so its error class is a
    // distinct object from the statically imported one; pin against fresh's.
    expect(() => fresh.requireRuntime()).toThrow(fresh.KernelUnavailableError);
    expect(() => fresh.requireRuntime()).toThrow(/Analytical kernel/i);
    expect(() => fresh.requireRuntime()).toThrow(/has not been initialized/i);
  });
});
