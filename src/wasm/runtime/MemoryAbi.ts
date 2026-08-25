import {
  getCachedMemoryView,
  getMemoryAbiExports,
  getRawRuntimeExports,
  setCachedMemoryView,
} from './RuntimeState.ts';
import type { WasmRuntimeExports } from './RuntimeExports.ts';

export interface AllocResult {
  ptr: number;
  len: number;
}

export function refreshMemoryView(): void {
  const wasm = getMemoryAbiExports();
  setCachedMemoryView(new DataView(wasm.memory.buffer));
}

export function getMemoryView(): DataView {
  const wasm = getMemoryAbiExports();
  const view = getCachedMemoryView();
  if (!view || view.buffer !== wasm.memory.buffer)
    setCachedMemoryView(new DataView(wasm.memory.buffer));
  return getCachedMemoryView()!;
}

export function memory(): WebAssembly.Memory {
  return getMemoryAbiExports().memory;
}

/**
 * Allocate a JS-visible buffer whose ownership remains tracked by Rust until an
 * exact matching deallocation. Production bridge payloads should use this path
 * instead of the legacy bump allocator.
 */
export function allocBuffer(len: number): AllocResult {
  if (!Number.isSafeInteger(len) || len <= 0) return { ptr: 0, len: 0 };
  const wasm = getMemoryAbiExports();
  const ptr = wasm.host_buffer_alloc(len);
  if (ptr === 0) throw new Error('WASM host_buffer_alloc returned 0');
  return { ptr, len };
}

export function deallocBuffer(ptr: number, len: number): void {
  if (ptr === 0 || len === 0) return;
  getMemoryAbiExports().host_buffer_dealloc(ptr, len);
}

export function hostBufferAllocationCount(): number {
  return getMemoryAbiExports().host_buffer_allocation_count();
}

export function allocBytes(bytes: Uint8Array): AllocResult {
  const len = bytes.length;
  if (len === 0) return { ptr: 0, len: 0 };
  const allocation = allocBuffer(len);
  new Uint8Array(getMemoryAbiExports().memory.buffer, allocation.ptr, len).set(bytes);
  return allocation;
}

export function deallocBytes(ptr: number, len: number): void {
  deallocBuffer(ptr, len);
}

export function readBytes(ptr: number, len: number): Uint8Array {
  const wasm = getMemoryAbiExports();
  if (
    !Number.isSafeInteger(ptr) ||
    !Number.isSafeInteger(len) ||
    ptr < 0 ||
    len < 0 ||
    ptr + len > wasm.memory.buffer.byteLength
  )
    return new Uint8Array(0);
  return new Uint8Array(wasm.memory.buffer, ptr, len).slice();
}

export function readString(ptr: number, len: number): string {
  return new TextDecoder().decode(readBytes(ptr, len));
}

export function readF32(ptr: number): number {
  return getMemoryView().getFloat32(ptr, true);
}

export function readU32(ptr: number): number {
  return getMemoryView().getUint32(ptr, true);
}

export function update(deltaMs: number, timeMs: number): number {
  return getMemoryAbiExports().update(deltaMs, timeMs);
}

export function call(name: string, ...args: unknown[]): unknown {
  const wasm = getRawRuntimeExports();
  const fn = wasm[name as keyof WasmRuntimeExports];
  if (typeof fn !== 'function') throw new Error(`Unknown WASM export: ${name}`);
  return (fn as (...a: unknown[]) => unknown)(...args);
}

export function debugFillPattern(len: number): Uint8Array {
  const allocation = allocBuffer(len);
  if (allocation.ptr === 0) return new Uint8Array(0);
  const wasm = getMemoryAbiExports();
  try {
    wasm.fill_pattern(allocation.ptr, allocation.len);
    return readBytes(allocation.ptr, allocation.len);
  } finally {
    deallocBuffer(allocation.ptr, allocation.len);
  }
}

export function commandBufferPtr(): number {
  return getMemoryAbiExports().command_buffer_ptr();
}

export function getCommandBufferBytes(byteLength: number): Uint8Array {
  const ptr = commandBufferPtr();
  if (ptr === 0 || byteLength === 0) return new Uint8Array(0);
  return readBytes(ptr, byteLength);
}
