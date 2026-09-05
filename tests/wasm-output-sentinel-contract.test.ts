import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

describe('WASM serialized-output sentinel contract', () => {
  it('defines zero as no successful serialized payload across Rust and both TypeScript hosts', () => {
    const rust = source('wasm/src/lib.rs');
    const datasetHost = source('src/wasm/runtime/DatasetHandleBridge.ts');
    const kernelHost = source('src/wasm/runtime/KernelContractBridge.ts');

    // write_bytes_out uses 0 when a caller presents an invalid output pointer.
    // A required size of 0 is therefore deliberately not a successful empty
    // serialized value. Current callers encode JSON/provenance payloads, whose
    // canonical successful representation is non-empty (for example [] or {}).
    expect(rust).toContain('fn write_bytes_out(bytes: &[u8], out_ptr: u32, out_len: u32) -> u32');
    expect(rust).toContain('the call fails closed with `0`');

    for (const host of [datasetHost, kernelHost]) {
      expect(host).toContain('if (!Number.isSafeInteger(required) || required <= 0) return null;');
      expect(host).not.toContain('required === 0) return');
    }
  });
});
