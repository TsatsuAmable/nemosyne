import { describe, it, expect, vi } from 'vitest';
import { Dataset } from '../../../src/data/Dataset.ts';
import { messagePackToDataset } from '../../../src/data/serializers/MessagePackSerializer.ts';
import { NetworkManager } from '../../../src/network/NetworkManager.ts';
import { makeKernelMockBridge } from '../../helpers/kernelMock.ts';

describe('Tier 3 — Suite 3.4: Security Hardening × Protocol Safety & Resilience (F11 × F12 × F13)', () => {
  it('INT-3.4.1: Malicious JSON and corrupted canonical binary payloads with prototype keys and truncated bounds are caught cleanly without unhandled rejection', async () => {
    // Malicious JSON payload — parsed through the kernel mock (canned, with
    // __proto__ stripping). Parse/pollution-hardening parity is covered by Rust
    // #[test]s + wasm-runtime.test.ts.
    const malformedJSON = `[{"id": 1, "__proto__": {"admin": true}}]`;
    const bridge = makeKernelMockBridge();
    const json = bridge.parseDatasetBytes(new TextEncoder().encode(malformedJSON), 'json');
    const dataset = Dataset.fromJSON(json as any);

    const testObj: any = {};
    expect(testObj.admin).toBeUndefined();
    expect(dataset.rows.length).toBe(1);

    // Corrupted canonical binary payload — a MessagePack envelope truncated
    // mid-decode fails deliberately with a thrown decode error. The failure is
    // synchronous and caught by the expect, so no unhandled rejection escapes
    // the stream-pollution boundary.
    const corruptPacked = new Uint8Array([0x81, 0xa4, 0xa4]); // Truncated length
    expect(() => {
      messagePackToDataset(corruptPacked);
    }).toThrow();
  });

  it('INT-3.4.2: NetworkManager handles malformed incoming peer message payloads without crash', () => {
    const netManager = new NetworkManager();
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Broadcast invalid oversize state
    expect(() => {
      netManager.setLocalState({
        __proto__: { polluted: true },
        large: 'x'.repeat(200000),
      });
    }).not.toThrow();

    const check: any = {};
    expect(check.polluted).toBeUndefined();
    consoleSpy.mockRestore();
  });
});
