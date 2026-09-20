import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readPreparedResult } from '../src/wasm/runtime/PreparedResultBridge.ts';
import { getRawRuntimeExports } from '../src/wasm/runtime/RuntimeState.ts';

vi.mock('../src/wasm/runtime/RuntimeState.ts', () => ({ getRawRuntimeExports: vi.fn() }));

function runtime() {
  const memory = new WebAssembly.Memory({ initial: 1 });
  new Uint8Array(memory.buffer, 8, 2).set([91, 93]);
  return {
    memory,
    prepared_result_read: vi.fn(() => 2),
    prepared_result_destroy: vi.fn(),
    host_buffer_alloc: vi.fn(() => 8),
    host_buffer_dealloc: vi.fn(),
  };
}

describe('prepared-result host ownership faults', () => {
  beforeEach(() => vi.resetAllMocks());

  it.each(['allocation', 'read', 'decode'] as const)(
    'releases ownership after %s failure',
    (fault) => {
      const owner = runtime();
      vi.mocked(getRawRuntimeExports).mockReturnValue(
        owner as unknown as ReturnType<typeof getRawRuntimeExports>
      );
      if (fault === 'allocation')
        owner.host_buffer_alloc.mockImplementation(() => {
          throw new Error('allocation');
        });
      if (fault === 'read')
        owner.prepared_result_read.mockReturnValueOnce(2).mockReturnValueOnce(0);
      if (fault === 'decode') new Uint8Array(owner.memory.buffer, 8, 2).fill(0xff);
      expect(() => readPreparedResult(() => -2146435071)).toThrow();
      expect(owner.prepared_result_destroy).toHaveBeenCalledExactlyOnceWith(2148532225);
      expect(owner.host_buffer_dealloc).toHaveBeenCalledTimes(fault === 'allocation' ? 0 : 1);
    }
  );

  it('cleans up the captured owner when the current runtime changes during preparation', () => {
    const owner = runtime();
    const replacement = runtime();
    vi.mocked(getRawRuntimeExports).mockReturnValue(
      owner as unknown as ReturnType<typeof getRawRuntimeExports>
    );
    expect(
      readPreparedResult(() => {
        vi.mocked(getRawRuntimeExports).mockReturnValue(
          replacement as unknown as ReturnType<typeof getRawRuntimeExports>
        );
        return -2146435071;
      })
    ).toBe('[]');
    expect(owner.prepared_result_destroy).toHaveBeenCalledTimes(1);
    expect(owner.host_buffer_dealloc).toHaveBeenCalledExactlyOnceWith(8, 2);
    expect(replacement.prepared_result_destroy).not.toHaveBeenCalled();
    expect(replacement.host_buffer_dealloc).not.toHaveBeenCalled();
  });
});
