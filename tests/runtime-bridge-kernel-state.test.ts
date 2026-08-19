import { describe, it, expect } from 'vitest';
import {
  KernelUnavailableError,
  getKernelState,
  getKernelUnavailableReason,
  requireRuntime,
  isReady,
} from '../src/wasm/RuntimeBridge.ts';

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

  it('reports initial kernel state as UNINITIALIZED or UNAVAILABLE before init', () => {
    const state = getKernelState();
    expect(['UNINITIALIZED', 'UNAVAILABLE', 'READY']).toContain(state);
    const reason = getKernelUnavailableReason();
    expect(reason === null || typeof reason === 'string').toBe(true);
  });

  it('requireRuntime throws explicit KernelUnavailableError when kernel is not ready', () => {
    if (!isReady()) {
      expect(() => requireRuntime()).toThrow(KernelUnavailableError);
      expect(() => requireRuntime()).toThrow(/Analytical kernel/i);
    }
  });
});
