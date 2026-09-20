import { getRawRuntimeExports } from './RuntimeState.ts';

export function readPreparedResult(
  prepare: (runtime: ReturnType<typeof getRawRuntimeExports>) => number,
  options: { nullOnReadMismatch?: boolean } = {}
): string | null {
  const runtime = getRawRuntimeExports();
  const rawToken = prepare(runtime);
  if (!Number.isInteger(rawToken)) {
    throw new Error('Rust prepared-result admission failed');
  }
  const token = rawToken >>> 0;
  if (token === 0) return null;
  if (token === 0xffffffff) throw new Error('Rust prepared-result resource limit exceeded');
  try {
    const length = runtime.prepared_result_read(token, 0, 0);
    if (!Number.isSafeInteger(length) || length <= 0 || length > 512 * 1024 * 1024) {
      throw new Error('Invalid prepared-result length');
    }
    const pointer = runtime.host_buffer_alloc(length);
    if (!pointer) throw new Error('Prepared-result output allocation failed');
    try {
      if (runtime.prepared_result_read(token, pointer, length) !== length) {
        if (options.nullOnReadMismatch) return null;
        throw new Error('Prepared-result read failed');
      }
      return new TextDecoder('utf-8', { fatal: true }).decode(
        new Uint8Array(runtime.memory.buffer, pointer, length)
      );
    } finally {
      runtime.host_buffer_dealloc(pointer, length);
    }
  } finally {
    runtime.prepared_result_destroy(token);
  }
}
