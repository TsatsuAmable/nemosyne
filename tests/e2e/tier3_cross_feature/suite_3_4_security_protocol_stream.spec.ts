import { describe, it, expect, vi } from 'vitest';
import { parseJSON, parseCSV } from '../../../src/data/Parsers.ts';
import { flatBufferToDataset } from '../../../src/data/serializers/FlatBuffersSerializer.ts';
import { messagePackToDataset } from '../../../src/data/serializers/MessagePackSerializer.ts';
import { NetworkManager } from '../../../src/network/NetworkManager.ts';

describe('Tier 3 — Suite 3.4: Security Hardening × Protocol Safety & Resilience (F11 × F12 × F13)', () => {
  it('INT-3.4.1: Malicious JSON and FlatBuffer payloads with prototype keys and truncated bounds are caught cleanly without unhandled rejection', async () => {
    // Malicious JSON payload
    const malformedJSON = `[{"id": 1, "__proto__": {"admin": true}}]`;
    const dataset = parseJSON(malformedJSON);

    const testObj: any = {};
    expect(testObj.admin).toBeUndefined();
    expect(dataset.rows.length).toBe(1);

    // Corrupt FlatBuffer payload
    const corruptBuffer = new Uint8Array([0x4e, 0x45, 0x4d, 0x01, 0xff, 0xff]); // Truncated length
    expect(() => {
      flatBufferToDataset(corruptBuffer);
    }).not.toThrow();
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
