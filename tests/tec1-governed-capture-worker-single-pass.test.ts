import { beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * RFC 0009 tranche 3 slice 2 follow-up — the Worker capture path's
 * single-pass preference, driven in this test realm (the real worker module,
 * a self stub, and the RuntimeBridge every production worker graph resolves
 * to), because the real-Worker-thread lane cannot run on every host.
 *
 * The three outcomes of the preferred single-pass read must stay distinct
 * inside the worker exactly as the kernel contract defines them: a capture is
 * used as-is; a real refusal (`null`) refuses the capture without consulting
 * the two-call bytes; the `'unsupported'` capability marker falls back to the
 * two-call reads a slice-2-era wasm build still trusts.
 */

const workerRealm = vi.hoisted(() => {
  const state = {
    posted: [] as Array<Record<string, unknown>>,
    combinedRead: 'unsupported' as
      | 'unsupported'
      | null
      | { rawBundle: unknown; governedConsumers: unknown },
    bundleFromProducer: {
      schemaVersion: '1',
      receipts: [{ receiptId: 'descriptive:x' }],
    } as unknown,
    governedConsumers: {
      schemaVersion: '1',
      datasetFingerprint: 'fp-live',
      kernelVersion: 'kernel-1',
      consumers: [{ consumerId: 'c-1', receiptIds: ['descriptive:x'] }],
    } as unknown,
    twoCallReads: 0,
  };
  return state;
});

vi.mock('../src/wasm/RuntimeBridge.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/wasm/RuntimeBridge.ts')>();
  return {
    ...actual,
    isReady: () => true,
    loadDatasetJson: () => 7,
    datasetFingerprint: (handle: number) => (handle === 7 ? 'fp-live' : null),
    kernelVersion: () => 'kernel-1',
    statisticsGovernedCapture: () => workerRealm.combinedRead,
    statisticsEvidenceReceiptBundle: () => {
      workerRealm.twoCallReads += 1;
      return workerRealm.bundleFromProducer;
    },
    statisticsGovernedConsumers: () => {
      workerRealm.twoCallReads += 1;
      return workerRealm.governedConsumers;
    },
  };
});

interface WorkerSelf {
  onmessage: ((ev: { data: unknown }) => Promise<void>) | null;
  postMessage(message: Record<string, unknown>): void;
}

const combinedCapture = {
  rawBundle: { schemaVersion: '1', receipts: [{ receiptId: 'descriptive:x' }] },
  governedConsumers: {
    schemaVersion: '1',
    datasetFingerprint: 'fp-live',
    kernelVersion: 'kernel-1',
    consumers: [{ consumerId: 'c-1', receiptIds: ['descriptive:x'] }],
  },
};

function lastGovernedReply(): Record<string, unknown> {
  const replies = workerRealm.posted.filter((m) => m.type === 'GOVERNED_EVIDENCE');
  expect(replies).toHaveLength(1);
  return replies[0]!;
}

function registerMessage(): unknown {
  return {
    type: 'REGISTER',
    registration: {
      registrationId: 'reg-w1',
      dataset: { fingerprint: 'fp-live', version: 3 },
      generation: 1,
      payload: { type: 'json', data: { name: 'worker-unit', columns: [], rows: [] } },
    },
  };
}

function captureMessage(): unknown {
  return {
    type: 'CAPTURE_GOVERNED_EVIDENCE',
    captureRequest: {
      requestId: 'acap-w1',
      dataset: { fingerprint: 'fp-live', version: 3 },
      generation: 1,
    },
  };
}

describe('analytical.worker single-pass governed capture preference', () => {
  let workerOnmessage: ((ev: { data: unknown }) => Promise<void>) | null = null;

  beforeAll(async () => {
    (globalThis as unknown as { self: WorkerSelf }).self = {
      onmessage: null,
      postMessage: (message: Record<string, unknown>) => {
        workerRealm.posted.push(message);
      },
    };
    await import('../src/atlas/ports/analytical.worker.ts');
    const workerSelf = (globalThis as unknown as { self: WorkerSelf }).self;
    expect(workerSelf.onmessage).toBeTypeOf('function');
    workerOnmessage = workerSelf.onmessage;
    await workerOnmessage!({ data: registerMessage() });
    expect(
      workerRealm.posted.some((m) => m.type === 'REGISTERED' && m.error === undefined)
    ).toBe(true);
  });

  it('uses the single-pass capture when the bridge offers and answers it', async () => {
    workerRealm.combinedRead = combinedCapture;
    workerRealm.posted.length = 0;
    workerRealm.twoCallReads = 0;

    await workerOnmessage!({ data: captureMessage() });

    expect(lastGovernedReply().capture).toEqual({
      requestId: 'acap-w1',
      generation: 1,
      datasetVersion: 3,
      datasetFingerprint: 'fp-live',
      kernelVersion: 'kernel-1',
      rawBundle: { schemaVersion: '1', receipts: [{ receiptId: 'descriptive:x' }] },
      governedConsumers: {
        schemaVersion: '1',
        datasetFingerprint: 'fp-live',
        kernelVersion: 'kernel-1',
        consumers: [{ consumerId: 'c-1', receiptIds: ['descriptive:x'] }],
      },
    });
    expect(workerRealm.twoCallReads).toBe(0);
  });

  it('falls back to the two-call reads when the single-pass read reports unsupported', async () => {
    workerRealm.combinedRead = 'unsupported';
    workerRealm.posted.length = 0;
    workerRealm.twoCallReads = 0;

    await workerOnmessage!({ data: captureMessage() });

    expect(lastGovernedReply().capture).toEqual({
      requestId: 'acap-w1',
      generation: 1,
      datasetVersion: 3,
      datasetFingerprint: 'fp-live',
      kernelVersion: 'kernel-1',
      rawBundle: workerRealm.bundleFromProducer,
      governedConsumers: workerRealm.governedConsumers,
    });
    expect(workerRealm.twoCallReads).toBe(2);
  });

  it('refuses the capture, without consulting the two-call bytes, when the single-pass read is refused', async () => {
    workerRealm.combinedRead = null;
    workerRealm.posted.length = 0;
    workerRealm.twoCallReads = 0;

    await workerOnmessage!({ data: captureMessage() });

    expect(lastGovernedReply().capture).toBeNull();
    expect(workerRealm.twoCallReads).toBe(0);
  });
});
