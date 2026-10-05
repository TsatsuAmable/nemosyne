import { describe, expect, it } from 'vitest';
import { WorkerAnalyticalPort, type WorkerTransport } from '../src/atlas/ports/WorkerAnalyticalPort.ts';
import type { AnalyticalDatasetRegistration } from '../src/atlas/ports/AnalyticalExecutionPort.ts';

describe('WorkerAnalyticalPort registration rejection lifecycle', () => {
  it('does not create a secondary unhandled rejection when caller observes registration failure', async () => {
    let onmessage: ((event: MessageEvent) => void) | null = null;
    let registrationId: string | null = null;
    const transport = {
      get onmessage() { return onmessage; },
      set onmessage(value) { onmessage = value; },
      onerror: null,
      onmessageerror: null,
      postMessage(message: unknown) {
        const data = message as { type?: string; registration?: AnalyticalDatasetRegistration };
        if (data.type === 'REGISTER' && data.registration) registrationId = data.registration.registrationId;
      },
      terminate() {},
    } satisfies WorkerTransport;

    const port = new WorkerAnalyticalPort(transport);
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);

    try {
      const promise = port.registerDataset({
        registrationId: 'reg-observed-failure',
        generation: 1,
        dataset: { fingerprint: 'fp_observed_failure', version: 1 },
        payload: { type: 'typed', data: new Uint8Array([1]) },
      });
      expect(registrationId).toBe('reg-observed-failure');
      onmessage?.(new MessageEvent('message', {
        data: { type: 'REGISTERED', registrationId, error: 'registration refused' },
      }));

      await expect(promise).rejects.toThrow('registration refused');
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
      port.dispose();
    }
  });
});
