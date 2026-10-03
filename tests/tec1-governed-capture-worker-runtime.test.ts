import { afterEach, describe, expect, it } from 'vitest';
import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as bridge from '../src/wasm/RuntimeBridge.ts';
import {
  WorkerAnalyticalPort,
  type WorkerTransport,
} from '../src/atlas/ports/WorkerAnalyticalPort.ts';
import type {
  AnalyticalDatasetRegistration,
  GovernedEvidenceCaptureV1,
} from '../src/atlas/ports/AnalyticalExecutionPort.ts';
import { composeGovernedEvidenceReceiptSnapshot } from '../src/atlas/MonetaEvidenceAuthority.ts';
import { parseEvidenceReceiptBundleV1 } from '../src/data/evidence/EvidenceReceipt.ts';
import { parsePersistedEvidenceReceiptsV1 } from '../src/data/evidence/PersistedEvidenceReceipts.ts';
import {
  DESCRIPTIVE_STATISTICS_CONSUMER_ID_V1,
  parseGovernedConsumerAttestationV1,
} from '../src/data/evidence/GovernedConsumerAttestation.ts';
import {
  DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1,
} from '../src/data/evidence/EvidenceRequirementProfile.ts';

/**
 * Issue #834's fourth required falsifier, at the production path: governed
 * capture must return the *Worker-owned* Rust bundle.
 *
 * Every other Worker test in this repository stubs `globalThis.self` and
 * imports `analytical.worker.ts` into the test realm, where its
 * `import * as bridge` resolves to the same WASM instance as the test's. Such a
 * test cannot distinguish a Worker-owned read from a main-thread global read —
 * both return the same instance, so a cross-runtime handle-aliasing bug (the
 * pre-#834 defect) passes silently.
 *
 * This test runs the real worker module in a separate Node worker thread with
 * its own module graph, WASM instance and handle index space, then asserts the
 * governed capture describes *that* runtime's resident dataset and not the
 * caller's.
 */

/** Adapts a worker_thread to the `WorkerTransport` the port consumes. */
class ThreadedWorkerTransport implements WorkerTransport {
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: ErrorEvent | unknown) => void) | null = null;
  onmessageerror: ((ev: MessageEvent | unknown) => void) | null = null;
  /**
   * Everything the port posts across the boundary, recorded so the test can
   * assert what it *sends* and not only what comes back. Outcome-only assertions
   * miss a transported handle that the Worker happens to ignore today.
   */
  readonly posted: unknown[] = [];

  constructor(readonly worker: Worker) {
    worker.on('message', (data) => {
      this.onmessage?.({ data } as MessageEvent);
    });
    worker.on('error', (err) => {
      this.onerror?.(err);
    });
  }

  postMessage(message: unknown): void {
    this.posted.push(message);
    this.worker.postMessage(message);
  }

  terminate(): void {
    void this.worker.terminate();
  }
}

const WORKER_DATASET = {
  name: 'tec1-worker-runtime',
  columns: [
    { name: 'x', type: 'NUMERIC' as const },
    { name: 'y', type: 'NUMERIC' as const },
  ],
  rows: [
    { x: 1, y: 2 },
    { x: 2, y: 4 },
    { x: 3, y: 9 },
    { x: 4, y: 16 },
  ],
};

const CALLER_DATASET = {
  name: 'tec1-caller-runtime',
  columns: [{ name: 'x', type: 'NUMERIC' as const }],
  rows: [{ x: 41 }, { x: 42 }, { x: 43 }],
};

const liveWorkers: Worker[] = [];

afterEach(() => {
  while (liveWorkers.length) {
    const worker = liveWorkers.pop()!;
    void worker.terminate();
  }
});

async function startWorkerThread(): Promise<ThreadedWorkerTransport> {
  // Vitest serves test modules over http, so `import.meta.url` here is not a
  // file URL; a worker_thread entry must be resolved from disk.
  const entry = pathToFileURL(
    path.resolve(process.cwd(), 'tests/helpers/governedCaptureWorkerThread.ts')
  );
  const worker = new Worker(entry, {
    // The worker imports the shared module graph directly, so Node — not
    // Vitest — transforms it: type stripping for the graph's TypeScript, and a
    // load hook that inlines the Vite env constant the bundler would supply.
    execArgv: [
      ...(process.allowedNodeEnvironmentFlags.has('--experimental-strip-types')
        ? ['--experimental-strip-types']
        : process.allowedNodeEnvironmentFlags.has('--experimental-transform-types')
          ? ['--experimental-transform-types']
          : []),
      '--import',
      pathToFileURL(path.resolve(process.cwd(), 'tests/helpers/runtimeBridgeEnvRegister.mjs')).href,
    ],
  });
  liveWorkers.push(worker);
  return new ThreadedWorkerTransport(worker);
}

/** Waits for the host to import the production module and report readiness. */
function awaitHostReady(worker: Worker): Promise<void> {
  return new Promise((resolve, reject) => {
    const onMessage = (data: { hostReady?: boolean }) => {
      if (data?.hostReady) {
        worker.off('message', onMessage);
        resolve();
      }
    };
    worker.on('message', onMessage);
    worker.once('error', reject);
  });
}

/** Measures a payload in the *worker thread's own* kernel. */
function probeInWorker(
  worker: Worker,
  payload: unknown
): Promise<{ fingerprint: string; kernelVersion: string }> {
  return new Promise((resolve, reject) => {
    const onMessage = (data: { probed?: { fingerprint: string; kernelVersion: string } }) => {
      if (data?.probed) {
        worker.off('message', onMessage);
        resolve(data.probed);
      }
    };
    worker.on('message', onMessage);
    worker.once('error', reject);
    worker.postMessage({ probe: { payload } });
  });
}

describe('TEC1 governed capture from a real Worker runtime (issue #834)', () => {
  it('returns the bundle of the Worker-owned Rust instance, not the caller runtime', async () => {
    // The caller's runtime holds a *different* dataset, so any read that
    // resolved through main-thread state would produce this identity.
    const callerHandle = bridge.loadDatasetJson(CALLER_DATASET);
    const callerFingerprint = bridge.datasetFingerprint(callerHandle);
    const callerKernelVersion = bridge.kernelVersion();

    const transport = await startWorkerThread();
    try {
      await awaitHostReady(transport.worker);
      // Declared identity comes from the worker thread's own kernel.
      const workerIdentity = await probeInWorker(transport.worker, WORKER_DATASET);
      expect(workerIdentity.fingerprint).toBeTruthy();
      expect(workerIdentity.fingerprint).not.toBe(callerFingerprint);

      const port = new WorkerAnalyticalPort(transport);
      const registration: AnalyticalDatasetRegistration = {
        registrationId: 'reg-worker-runtime',
        dataset: { fingerprint: workerIdentity.fingerprint, version: 1 },
        generation: 1,
        payload: { type: 'json', data: WORKER_DATASET },
      };
      await port.registerDataset(registration);
      expect(port.hasRegisteredDataset(1, workerIdentity.fingerprint)).toBe(true);

      const capture: GovernedEvidenceCaptureV1 | null = await port.captureGovernedEvidenceReceipt({
        requestId: 'cap-worker-runtime',
        dataset: { fingerprint: workerIdentity.fingerprint, version: 1 },
        generation: 1,
        // A caller-side handle index is meaningless in the worker's index
        // space; the port must not transport it, and the worker must
        // resolve its own resident handle instead.
        handle: callerHandle,
      });

      // Asserted on what crossed the boundary, not merely on the result: a
      // transported handle that the Worker ignores today would still be a
      // cross-runtime index leak, and an outcome-only assertion cannot see it.
      // The transmitted shape is pinned exactly, so an added field is a failure
      // rather than a silent widening.
      const captureMessage = transport.posted.find(
        (message) =>
          typeof message === 'object' &&
          message !== null &&
          (message as { type?: string }).type === 'CAPTURE_GOVERNED_EVIDENCE'
      ) as { captureRequest?: Record<string, unknown> } | undefined;
      expect(captureMessage).toBeDefined();
      expect(captureMessage!.captureRequest).toBeDefined();
      expect(Object.keys(captureMessage!.captureRequest!).sort()).toEqual([
        'dataset',
        'generation',
        'requestId',
      ]);
      expect(Object.keys(captureMessage!.captureRequest!.dataset as object).sort()).toEqual([
        'fingerprint',
        'version',
      ]);

      expect(capture).not.toBeNull();
      expect(capture!.datasetFingerprint).toBe(workerIdentity.fingerprint);
      expect(capture!.datasetFingerprint).not.toBe(callerFingerprint);
      expect(capture!.kernelVersion).toBe(workerIdentity.kernelVersion);
      expect(capture!.kernelVersion).toBe(callerKernelVersion);

      // The payload is a real Rust bundle, read back through the production
      // parser rather than a hand-rolled shape check, so a malformed or
      // foreign bundle cannot pass by looking approximately right.
      const bundle = parseEvidenceReceiptBundleV1(capture!.rawBundle);
      expect(bundle.datasetFingerprint).toBe(workerIdentity.fingerprint);
      expect(bundle.datasetFingerprint).not.toBe(callerFingerprint);
      expect(bundle.kernelVersion).toBe(workerIdentity.kernelVersion);
      // Non-empty: this is a real issued bundle, not an empty shell that any
      // identity would satisfy.
      expect(bundle.receipts.length).toBeGreaterThan(0);

      // The same read carries the kernel-issued governing-consumer attestation
      // (RFC 0009 tranche 3 slice 2), read back through the production parser.
      const attestation = parseGovernedConsumerAttestationV1(capture!.governedConsumers);
      expect(attestation.datasetFingerprint).toBe(workerIdentity.fingerprint);
      expect(
        attestation.consumers.map((consumer) => ({
          consumerId: consumer.consumerId,
          receiptIds: [...consumer.receiptIds],
        })),
      ).toEqual([
        {
          consumerId: DESCRIPTIVE_STATISTICS_CONSUMER_ID_V1,
          receiptIds: bundle.receipts.map((receipt) => receipt.receiptId),
        },
      ]);

      // And it composes into the closed RFC 0009 envelope through the same
      // pure composer the session uses — the readout is production-usable, not
      // merely well-typed. Since slice 2 the uses are minted from the kernel
      // attestation, one per claimed receipt under the authority's profile.
      const snapshot = composeGovernedEvidenceReceiptSnapshot({
        rawBundle: capture!.rawBundle,
        datasetFingerprint: capture!.datasetFingerprint,
        kernelVersion: capture!.kernelVersion,
        governedConsumers: capture!.governedConsumers,
      });
      expect(snapshot.envelope.uses).toEqual(
        bundle.receipts.map((receipt) => ({
          consumerId: DESCRIPTIVE_STATISTICS_CONSUMER_ID_V1,
          receiptId: receipt.receiptId,
          requirementProfileId: DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1.profileId,
        })),
      );
      const roundTripped = parsePersistedEvidenceReceiptsV1(
        JSON.parse(new TextDecoder().decode(snapshot.bytes))
      );
      expect(roundTripped.bundle.datasetFingerprint).toBe(workerIdentity.fingerprint);
      expect(roundTripped.bundle.receipts).toHaveLength(bundle.receipts.length);

      // The caller's own runtime is untouched by the worker's capture.
      expect(bridge.datasetFingerprint(callerHandle)).toBe(callerFingerprint);
    } finally {
      transport.terminate();
    }
    bridge.destroyDataset(callerHandle);
  }, 60000);
});
