import { describe, expect, it, vi } from 'vitest';
import { WorldLifecycleOwner } from '../src/vr/coordinators/WorldLifecycleOwner.ts';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createLifecycle(initializeKernel: () => Promise<void>) {
  const dependencies = {
    startEngine: vi.fn(),
    initializeKernel: vi.fn(initializeKernel),
    onKernelUnavailable: vi.fn(),
    onDisposing: vi.fn(),
    teardown: vi.fn().mockResolvedValue(undefined),
  };
  return { lifecycle: new WorldLifecycleOwner(dependencies), dependencies };
}

describe('WorldLifecycleOwner', () => {
  it('coalesces concurrent starts and starts the engine once', async () => {
    const kernel = deferred();
    const { lifecycle, dependencies } = createLifecycle(() => kernel.promise);

    const first = lifecycle.start();
    const second = lifecycle.start();
    const third = lifecycle.start();

    expect(first).toBe(second);
    expect(second).toBe(third);
    expect(lifecycle.state).toBe('INITIALIZING');
    expect(dependencies.startEngine).toHaveBeenCalledOnce();
    expect(dependencies.initializeKernel).toHaveBeenCalledOnce();

    kernel.resolve();
    await Promise.all([first, second, third]);

    expect(lifecycle.state).toBe('READY');
    await lifecycle.start();
    expect(dependencies.startEngine).toHaveBeenCalledOnce();
    expect(dependencies.initializeKernel).toHaveBeenCalledOnce();
  });

  it('fails closed and coalesces an explicit kernel recovery', async () => {
    const recovery = deferred();
    const initializeKernel = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('kernel boot failed'))
      .mockImplementationOnce(() => recovery.promise);
    const { lifecycle, dependencies } = createLifecycle(initializeKernel);

    await lifecycle.start();

    expect(lifecycle.state).toBe('KERNEL_UNAVAILABLE');
    expect(dependencies.onKernelUnavailable).toHaveBeenCalledOnce();
    expect(dependencies.onKernelUnavailable).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'kernel boot failed' })
    );

    const first = lifecycle.recoverKernel();
    const second = lifecycle.recoverKernel();
    expect(first).toBe(second);
    expect(dependencies.startEngine).toHaveBeenCalledOnce();
    expect(dependencies.initializeKernel).toHaveBeenCalledTimes(2);

    recovery.resolve();
    await Promise.all([first, second]);
    expect(lifecycle.state).toBe('READY');
  });

  it('disposes immediately during deferred boot and ignores its late result', async () => {
    const kernel = deferred();
    const { lifecycle, dependencies } = createLifecycle(() => kernel.promise);
    const start = lifecycle.start();

    const dispose = lifecycle.dispose();
    await dispose;

    expect(lifecycle.state).toBe('DISPOSED');
    expect(dependencies.onDisposing).toHaveBeenCalledOnce();
    expect(dependencies.teardown).toHaveBeenCalledOnce();

    kernel.resolve();
    await start;
    expect(lifecycle.state).toBe('DISPOSED');
    await expect(lifecycle.start()).rejects.toThrow('Cannot start a disposed World lifecycle');
    await expect(lifecycle.recoverKernel()).rejects.toThrow(
      'Cannot start a disposed World lifecycle'
    );
  });

  it('marks a runtime kernel failure unavailable without selecting another engine', async () => {
    const { lifecycle, dependencies } = createLifecycle(() => Promise.resolve());
    await lifecycle.start();

    lifecycle.markKernelUnavailable(new Error('ABI handle invalidated'));

    expect(lifecycle.state).toBe('KERNEL_UNAVAILABLE');
    expect(dependencies.onKernelUnavailable).toHaveBeenCalledOnce();
    expect(dependencies.initializeKernel).toHaveBeenCalledOnce();
    expect(dependencies.startEngine).toHaveBeenCalledOnce();
  });

  it('invalidates a stale boot attempt before starting recovery', async () => {
    const initial = deferred();
    const recovery = deferred();
    const initializeKernel = vi
      .fn<() => Promise<void>>()
      .mockImplementationOnce(() => initial.promise)
      .mockImplementationOnce(() => recovery.promise);
    const { lifecycle, dependencies } = createLifecycle(initializeKernel);

    const staleStart = lifecycle.start();
    lifecycle.markKernelUnavailable(new Error('runtime failed during boot'));
    const recovered = lifecycle.recoverKernel();

    initial.resolve();
    await staleStart;
    expect(lifecycle.state).toBe('INITIALIZING');

    recovery.resolve();
    await recovered;
    expect(lifecycle.state).toBe('READY');
    expect(dependencies.initializeKernel).toHaveBeenCalledTimes(2);
  });

  it('coalesces disposal and remains terminal when teardown reports failure', async () => {
    const { lifecycle, dependencies } = createLifecycle(() => Promise.resolve());
    dependencies.teardown.mockRejectedValueOnce(new Error('cleanup failed'));

    const first = lifecycle.dispose();
    const second = lifecycle.dispose();

    expect(first).toBe(second);
    await expect(first).rejects.toThrow('cleanup failed');
    expect(lifecycle.state).toBe('DISPOSED');
    expect(dependencies.onDisposing).toHaveBeenCalledOnce();
    expect(dependencies.teardown).toHaveBeenCalledOnce();
  });
});
