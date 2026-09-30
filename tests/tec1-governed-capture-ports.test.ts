import { describe, expect, it, vi } from 'vitest';
import { InlineAnalyticalPort } from '../src/atlas/ports/InlineAnalyticalPort.ts';
import { WorkerAnalyticalPort } from '../src/atlas/ports/WorkerAnalyticalPort.ts';
import type {
  AnalyticalExecutionRequest,
  GovernedEvidenceCaptureRequest,
  GovernedEvidenceCaptureV1,
} from '../src/atlas/ports/AnalyticalExecutionPort.ts';
import type { AnalyticalKernelPort } from '../src/atlas/adapters/AnalyticalKernelPort.ts';
import { KernelUnavailableError } from '../src/wasm/runtime/RuntimeState.ts';

/**
 * Issue #834 port-level falsifiers (transport and freshness), independent of
 * AtlasCore. These are the refusals that make "the injected port is the only
 * acquisition authority" true for each port implementation:
 *
 *  - inline: the producer is read from the injected kernel instance, under the
 *    requested identity, and a supersession that races the read refuses;
 *  - transport: the Worker's answer is re-fenced at this boundary, the caller's
 *    handle index is never transported, and refusal/saturation/disposal are
 *    typed failures rather than silent nulls.
 */

const LIVE_FINGERPRINT = 'fp-live';
const LIVE_VERSION = 3;

function inlineKernel(
  options: {
    fingerprint?: string | null;
    kernelVersion?: string | null;
    rawBundle?: unknown;
    omitProducer?: boolean;
    onProduce?: () => void;
  } = {}
) {
  const rawBundle = 'rawBundle' in options ? options.rawBundle : { schemaVersion: '1' };
  const produce = vi.fn(function (this: { marker?: string }) {
    // Proves the port read the producer through the injected instance; a bare
    // call would lose the receiver and fail here.
    if (this?.marker !== 'injected-kernel') {
      throw new Error('producer invoked without the injected kernel as receiver');
    }
    options.onProduce?.();
    return rawBundle;
  });
  const kernel = {
    marker: 'injected-kernel',
    datasetFingerprint: vi.fn(() =>
      options.fingerprint === undefined ? LIVE_FINGERPRINT : options.fingerprint
    ),
    kernelVersion: vi.fn(() =>
      options.kernelVersion === undefined ? 'kernel-1' : options.kernelVersion
    ),
    statistics: vi.fn(() => null),
    loadDatasetJson: vi.fn(() => 11),
    ...(options.omitProducer ? {} : { statisticsEvidenceReceiptBundle: produce }),
  } as unknown as AnalyticalKernelPort;
  return { kernel, produce };
}

function captureRequest(
  overrides: Partial<GovernedEvidenceCaptureRequest> = {}
): GovernedEvidenceCaptureRequest {
  return {
    requestId: 'acap-1',
    dataset: { fingerprint: LIVE_FINGERPRINT, version: LIVE_VERSION },
    generation: 1,
    handle: 7,
    ...overrides,
  };
}

function executionRequest(): AnalyticalExecutionRequest {
  return {
    requestId: 'areq-seed',
    operation: 'statistics',
    dataset: { fingerprint: LIVE_FINGERPRINT, version: LIVE_VERSION },
    generation: 1,
    params: {},
    datasetPayload: { type: 'json', data: { name: 'seed', columns: [], rows: [] } },
  };
}

function capture(overrides: Partial<GovernedEvidenceCaptureV1> = {}): GovernedEvidenceCaptureV1 {
  return {
    requestId: 'acap-1',
    generation: 1,
    datasetVersion: LIVE_VERSION,
    datasetFingerprint: LIVE_FINGERPRINT,
    kernelVersion: 'kernel-1',
    rawBundle: { schemaVersion: '1' },
    ...overrides,
  };
}

describe('InlineAnalyticalPort governed-evidence capture (issue #834)', () => {
  it('refuses a superseded generation without consulting the producer', async () => {
    const { kernel, produce } = inlineKernel();
    const port = new InlineAnalyticalPort(kernel);
    port.supersede({ generation: 2 });
    expect(await port.captureGovernedEvidenceReceipt(captureRequest())).toBeNull();
    expect(produce).not.toHaveBeenCalled();
  });

  it('refuses a superseded dataset version without consulting the producer', async () => {
    const { kernel, produce } = inlineKernel();
    const port = new InlineAnalyticalPort(kernel);
    port.supersede({ datasetVersion: LIVE_VERSION + 1 });
    expect(await port.captureGovernedEvidenceReceipt(captureRequest())).toBeNull();
    expect(produce).not.toHaveBeenCalled();
  });

  it('refuses a kernel that cannot attest the producer capability', async () => {
    const { kernel } = inlineKernel({ omitProducer: true });
    const port = new InlineAnalyticalPort(kernel);
    expect(await port.captureGovernedEvidenceReceipt(captureRequest())).toBeNull();
  });

  it('refuses when the injected kernel reports another identity for the handle', async () => {
    const { kernel, produce } = inlineKernel({ fingerprint: 'fp-somewhere-else' });
    const port = new InlineAnalyticalPort(kernel);
    expect(await port.captureGovernedEvidenceReceipt(captureRequest())).toBeNull();
    expect(produce).not.toHaveBeenCalled();
  });

  it('refuses when the kernel has no bundle or no kernel version', async () => {
    const noBundle = inlineKernel({ rawBundle: null });
    expect(
      await new InlineAnalyticalPort(noBundle.kernel).captureGovernedEvidenceReceipt(
        captureRequest()
      )
    ).toBeNull();
    const noVersion = inlineKernel({ kernelVersion: null });
    expect(
      await new InlineAnalyticalPort(noVersion.kernel).captureGovernedEvidenceReceipt(
        captureRequest()
      )
    ).toBeNull();
  });

  it('refuses a capture superseded while the producer was reading', async () => {
    const port = { current: null as InlineAnalyticalPort | null };
    const { kernel } = inlineKernel({
      onProduce: () => port.current!.supersede({ generation: 2 }),
    });
    const inline = new InlineAnalyticalPort(kernel);
    port.current = inline;
    expect(await inline.captureGovernedEvidenceReceipt(captureRequest())).toBeNull();
  });

  it('refuses a request with no handle rather than guessing one', async () => {
    const { kernel } = inlineKernel();
    const port = new InlineAnalyticalPort(kernel);
    expect(
      await port.captureGovernedEvidenceReceipt(captureRequest({ handle: undefined }))
    ).toBeNull();
  });

  it('resolves the resident handle for a registered dataset and reads the injected kernel', async () => {
    const { kernel, produce } = inlineKernel();
    const port = new InlineAnalyticalPort(kernel);
    await port.execute(executionRequest());

    const result = await port.captureGovernedEvidenceReceipt(
      captureRequest({ handle: undefined })
    );
    expect(result).toEqual({
      requestId: 'acap-1',
      generation: 1,
      datasetVersion: LIVE_VERSION,
      datasetFingerprint: LIVE_FINGERPRINT,
      kernelVersion: 'kernel-1',
      rawBundle: { schemaVersion: '1' },
    });
    expect(produce).toHaveBeenCalledTimes(1);
    expect(produce).toHaveBeenCalledWith(11);
  });
});

interface PostedMessage {
  type: string;
  captureRequest?: Record<string, unknown>;
}

function workerTransport() {
  const postedMessages: PostedMessage[] = [];
  let handler: ((ev: MessageEvent) => void) | null = null;
  return {
    postedMessages,
    get onmessage() {
      return handler;
    },
    set onmessage(next: ((ev: MessageEvent) => void) | null) {
      handler = next;
    },
    onerror: null as ((ev: ErrorEvent | unknown) => void) | null,
    onmessageerror: null as ((ev: MessageEvent | unknown) => void) | null,
    postMessage(message: unknown) {
      postedMessages.push(message as PostedMessage);
    },
    terminate() {},
    reply(data: unknown) {
      handler?.({ data } as MessageEvent);
    },
    governedRequests() {
      return postedMessages.filter((m) => m.type === 'CAPTURE_GOVERNED_EVIDENCE');
    },
  };
}

describe('WorkerAnalyticalPort governed-evidence capture (issue #834)', () => {
  it('transports analytical identity only, never the caller handle index', async () => {
    const transport = workerTransport();
    const port = new WorkerAnalyticalPort(transport);
    const pending = port.captureGovernedEvidenceReceipt(captureRequest({ handle: 7 }));

    const sent = transport.governedRequests();
    expect(sent).toHaveLength(1);
    expect(sent[0]!.captureRequest).toEqual({
      requestId: 'acap-1',
      dataset: { fingerprint: LIVE_FINGERPRINT, version: LIVE_VERSION },
      generation: 1,
    });
    expect('handle' in sent[0]!.captureRequest!).toBe(false);

    transport.reply({ type: 'GOVERNED_EVIDENCE', requestId: 'acap-1', capture: capture() });
    await expect(pending).resolves.toEqual(capture());
  });

  it('resolves null when the Worker-owned authority refuses', async () => {
    const transport = workerTransport();
    const port = new WorkerAnalyticalPort(transport);
    const pending = port.captureGovernedEvidenceReceipt(captureRequest());
    transport.reply({ type: 'GOVERNED_EVIDENCE', requestId: 'acap-1', capture: null });
    await expect(pending).resolves.toBeNull();
  });

  it('rejects a Worker answer describing another dataset identity', async () => {
    const transport = workerTransport();
    const onKernelFailure = vi.fn();
    const port = new WorkerAnalyticalPort(transport, onKernelFailure);
    const pending = port.captureGovernedEvidenceReceipt(captureRequest());
    transport.reply({
      type: 'GOVERNED_EVIDENCE',
      requestId: 'acap-1',
      capture: capture({ datasetFingerprint: 'fp-other' }),
    });
    await expect(pending).rejects.toBeInstanceOf(KernelUnavailableError);
    expect(onKernelFailure).toHaveBeenCalledTimes(1);
  });

  it('rejects a Worker answer carrying another generation or version', async () => {
    for (const drift of [{ generation: 2 }, { datasetVersion: LIVE_VERSION + 1 }]) {
      const transport = workerTransport();
      const port = new WorkerAnalyticalPort(transport, null);
      const pending = port.captureGovernedEvidenceReceipt(captureRequest());
      transport.reply({
        type: 'GOVERNED_EVIDENCE',
        requestId: 'acap-1',
        capture: capture(drift),
      });
      await expect(pending).rejects.toBeInstanceOf(KernelUnavailableError);
    }
  });

  it('resolves null for a capture superseded while in flight', async () => {
    const transport = workerTransport();
    const port = new WorkerAnalyticalPort(transport);
    const pending = port.captureGovernedEvidenceReceipt(captureRequest());
    port.supersede({ generation: 2 });
    await expect(pending).resolves.toBeNull();
    // A late Worker answer for the superseded request cannot resurrect it.
    transport.reply({ type: 'GOVERNED_EVIDENCE', requestId: 'acap-1', capture: capture() });
    await expect(pending).resolves.toBeNull();
  });

  it('rejects when capture admission is saturated', async () => {
    const transport = workerTransport();
    const port = new WorkerAnalyticalPort(transport, null, null, {
      maxPendingGovernedCaptures: 1,
    });
    const first = port.captureGovernedEvidenceReceipt(captureRequest({ requestId: 'acap-1' }));
    await expect(
      port.captureGovernedEvidenceReceipt(captureRequest({ requestId: 'acap-2' }))
    ).rejects.toThrow(/saturated/);
    transport.reply({ type: 'GOVERNED_EVIDENCE', requestId: 'acap-1', capture: null });
    await expect(first).resolves.toBeNull();
  });

  it('rejects on a disposed port or a failing transport', async () => {
    const disposedTransport = workerTransport();
    const disposed = new WorkerAnalyticalPort(disposedTransport);
    disposed.dispose();
    await expect(disposed.captureGovernedEvidenceReceipt(captureRequest())).rejects.toThrow(
      /disposed/
    );

    const failing = workerTransport();
    failing.postMessage = () => {
      throw new Error('transport offline');
    };
    const onKernelFailure = vi.fn();
    const port = new WorkerAnalyticalPort(failing as never, onKernelFailure);
    await expect(port.captureGovernedEvidenceReceipt(captureRequest())).rejects.toThrow(
      /transport postMessage failed/
    );
    expect(onKernelFailure).toHaveBeenCalledTimes(1);
  });
});
