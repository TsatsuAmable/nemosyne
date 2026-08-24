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
export function allocBytes(bytes: Uint8Array): AllocResult {
  const wasm = getMemoryAbiExports();
  const len = bytes.length;
  if (len === 0) return { ptr: 0, len: 0 };
  const ptr = wasm.alloc(len);
  if (ptr === 0) throw new Error('WASM alloc returned 0');
  new Uint8Array(wasm.memory.buffer, ptr, len).set(bytes);
  return { ptr, len };
}
export function deallocBytes(ptr: number, len: number): void {
  const wasm = getMemoryAbiExports();
  if (ptr === 0 || len === 0) return;
  wasm.dealloc(ptr, len);
}
export function readBytes(ptr: number, len: number): Uint8Array {
  const wasm = getMemoryAbiExports();
  if (ptr < 0 || len < 0 || ptr + len > wasm.memory.buffer.byteLength) return new Uint8Array(0);
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
  const wasm = getMemoryAbiExports();
  const ptr = wasm.alloc(len);
  wasm.fill_pattern(ptr, len);
  const bytes = readBytes(ptr, len);
  wasm.dealloc(ptr, len);
  return bytes;
}
export function commandBufferPtr(): number {
  return getMemoryAbiExports().command_buffer_ptr();
}
export function getCommandBufferBytes(byteLength: number): Uint8Array {
  const ptr = commandBufferPtr();
  if (ptr === 0 || byteLength === 0) return new Uint8Array(0);
  return readBytes(ptr, byteLength);
}
