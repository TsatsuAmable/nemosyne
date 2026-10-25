import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { ColumnType, Dataset } from '../src/data/Dataset.ts';
import * as bridge from '../src/wasm/RuntimeBridge.ts';
import {
  WorkerAnalyticalPort,
  type WorkerTransport,
} from '../src/atlas/ports/WorkerAnalyticalPort.ts';
import { NemosyneSession } from '../src/session/NemosyneSession.ts';
import { NemosynePackageManager } from '../src/session/NemosynePackage.ts';
import {
  InvestigationReplayRunner,
  type ReplayVerificationResult,
} from '../src/session/InvestigationReplayRunner.ts';
import { sha256Hex } from '../src/security/CryptoHash.ts';
import { buildDirectDistributionBindingV1 } from '../src/wasm/runtime/SemanticEmbodimentBridge.ts';
import {
  DIRECT_DISTRIBUTION_CONSUMER_ID_V1,
  type DirectDistributionBindingV1,
} from '../src/moneta/representation/DirectDistributionBindingV1.ts';
import {
  createDirectDistributionReplayCarrierV1,
  parseDirectDistributionReplayCarrierV1,
  serializeDirectDistributionReplayCarrierV1,
} from '../src/moneta/representation/DirectDistributionReplayCarrierV1.ts';
import { toAnalysisSpec } from '../src/vr/interactions/DataOperations.ts';

const request = {
  schemaVersion: 1 as const,
  candidateId: 'DISTRIBUTION_FIELD' as const,
  measureField: 'x',
  histogramBinCount: 6,
  ecdfKnotCount: 8,
  quantileProbabilities: [0, 0.25, 0.5, 0.75, 1],
};

function dataset(): Dataset {
  return new Dataset(
    'fm2-replay',
    [{ name: 'x', type: ColumnType.NUMERIC }],
    Array.from({ length: 32 }, (_, index) => ({ x: index + 0.5 })),
  );
}

/** Adapts the production analytical Worker module in a separate Rust runtime. */
class ThreadedWorkerTransport implements WorkerTransport {
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: ErrorEvent | unknown) => void) | null = null;
  onmessageerror: ((ev: MessageEvent | unknown) => void) | null = null;
  readonly posted: unknown[] = [];
  readonly received: unknown[] = [];
  holdResult: ((deliver: () => void) => void) | null = null;
  mutateResult: ((result: Record<string, unknown>) => Record<string, unknown>) | null = null;
  terminated = false;

  constructor(readonly worker: Worker) {
    worker.on('message', (data) => {
      this.received.push(data);
      const deliveredData =
        data?.type === 'RESULT' && data.result && this.mutateResult
          ? { ...data, result: this.mutateResult(data.result as Record<string, unknown>) }
          : data;
      const deliver = () => this.onmessage?.({ data: deliveredData } as MessageEvent);
      if (data?.type === 'RESULT' && this.holdResult) {
        this.holdResult(deliver);
      } else {
        deliver();
      }
    });
    worker.on('error', (error) => this.onerror?.(error));
  }

  postMessage(message: unknown): void {
    this.posted.push(message);
    this.worker.postMessage(message);
  }

  terminate(): void {
    this.terminated = true;
    void this.worker.terminate();
  }
}

const liveWorkers: Worker[] = [];

afterEach(async () => {
  await Promise.all(liveWorkers.splice(0).map((worker) => worker.terminate()));
});

async function startWorkerThread(): Promise<ThreadedWorkerTransport> {
  const entry = pathToFileURL(
    path.resolve(process.cwd(), 'tests/helpers/governedCaptureWorkerThread.ts'),
  );
  const worker = new Worker(entry, {
    execArgv: [
      ...(process.allowedNodeEnvironmentFlags.has('--experimental-transform-types')
        ? ['--experimental-transform-types']
        : process.allowedNodeEnvironmentFlags.has('--experimental-strip-types')
          ? ['--experimental-strip-types']
          : []),
      '--import',
      pathToFileURL(path.resolve(process.cwd(), 'tests/helpers/runtimeBridgeEnvRegister.mjs')).href,
    ],
  });
  liveWorkers.push(worker);
  return new ThreadedWorkerTransport(worker);
}

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

async function replayInFreshWorker(bytes: Uint8Array): Promise<ReplayVerificationResult> {
  const transport = await startWorkerThread();
  await awaitHostReady(transport.worker);
  try {
    return await new Promise((resolve, reject) => {
      const cleanup = () => {
        transport.worker.off('error', onError);
        transport.worker.off('exit', onExit);
        transport.worker.off('message', onMessage);
      };
      const onError = (error: Error) => { cleanup(); reject(error); };
      const onExit = (code: number) => onError(new Error(`Replay Worker exited before replying (${code})`));
      const onMessage = (message: { replayed?: ReplayVerificationResult; replayError?: string }) => {
        if (message.replayError) onError(new Error(message.replayError));
        if (message.replayed) { cleanup(); resolve(message.replayed); }
      };
      transport.worker.once('error', onError);
      transport.worker.once('exit', onExit);
      transport.worker.on('message', onMessage);
      transport.worker.postMessage({ replay: bytes });
    });
  } finally {
    transport.terminate();
  }
}

async function workerSession() {
  const transport = await startWorkerThread();
  await awaitHostReady(transport.worker);
  const atlas = new AtlasCore({ kernel: bridge });
  atlas.loadDataset(dataset());
  atlas.setExecutionPort(new WorkerAnalyticalPort(transport));
  return { transport, atlas, session: new NemosyneSession({ atlas }) };
}

function base64Encode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

type MutableDirectCarrier = {
  binding: Record<string, unknown>;
  request?: Record<string, unknown>;
  use?: Record<string, unknown>;
  [key: string]: unknown;
};

function objectRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('expected object');
  }
  return value as Record<string, unknown>;
}

async function exportedDirectArchive(): Promise<Uint8Array> {
  const data = dataset();
  const atlas = new AtlasCore({ kernel: bridge });
  atlas.loadDataset(data);
  try {
    const session = new NemosyneSession({ atlas });
    await session.captureDirectDistributionBinding(request);
    const snapshot = session.serialize();
    const restored = NemosyneSession.deserialize(snapshot, new AtlasCore({ kernel: null }));
    return await restored.exportPortablePackage({}, undefined, {
      directDistributionBinding: true,
    });
  } finally {
    bridge.destroyDataset(atlas.aggregate.analytical.currentHandle);
  }
}

function payloadWithCarrierMutation(
  archive: Uint8Array,
  mutate: (carrier: MutableDirectCarrier) => void,
): ReturnType<typeof NemosynePackageManager.unpack> {
  const payload = NemosynePackageManager.unpack(archive);
  const carrier = JSON.parse(
    new TextDecoder('utf-8', { fatal: true }).decode(payload.directDistributionBytes!),
  ) as MutableDirectCarrier;
  mutate(carrier);
  const directDistributionBytes = new TextEncoder().encode(JSON.stringify(carrier));
  return {
    ...payload,
    manifest: {
      ...payload.manifest,
      directDistributionDigest: sha256Hex(directDistributionBytes),
    },
    directDistributionBytes,
  };
}

function payloadWithManifestMutation(
  archive: Uint8Array,
  mutate: (manifest: Record<string, unknown>) => void,
): ReturnType<typeof NemosynePackageManager.unpack> {
  const payload = NemosynePackageManager.unpack(archive);
  const manifest = { ...payload.manifest } as Record<string, unknown>;
  mutate(manifest);
  return {
    ...payload,
    manifest: manifest as typeof payload.manifest,
  };
}

describe('FM2 governed direct-distribution replay carrier, real WASM', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    if (!bridge.isReady()) throw new Error('Real WASM runtime required');
  });

  it('captures through Atlas and round-trips a closed carrier with exact Rust source bytes', async () => {
    const data = dataset();
    const atlas = new AtlasCore({ kernel: bridge });
    atlas.loadDataset(data);
    try {
      const binding = await atlas.captureDirectDistributionBinding(request);
      expect(binding).not.toBeNull();
      expect(binding!.consumerId).toBe(DIRECT_DISTRIBUTION_CONSUMER_ID_V1);

      const carrier = createDirectDistributionReplayCarrierV1(binding as DirectDistributionBindingV1, request, {
        datasetFingerprint: data.fingerprint,
        kernelVersion: bridge.kernelVersion(),
      });
      const restored = parseDirectDistributionReplayCarrierV1(
        JSON.parse(new TextDecoder().decode(serializeDirectDistributionReplayCarrierV1(carrier))),
        { datasetFingerprint: data.fingerprint, kernelVersion: bridge.kernelVersion() },
      );
      expect(restored.binding.sourceJson).toBe(binding!.sourceJson);
      expect(restored.binding.sourceDigest).toBe(binding!.sourceDigest);
      expect(restored.binding.receiptId).toBe(binding!.receiptId);
      expect(restored.use).toEqual({
        consumerId: binding!.consumerId,
        receiptId: binding!.receiptId,
        requirementProfileId: binding!.requirementProfileId,
      });
      expect(restored.request).toEqual(request);
    } finally {
      bridge.destroyDataset(atlas.aggregate.analytical.currentHandle);
    }
  }, 60000);

  it('persists the reference from normal Atlas compilation through the existing replay carrier', async () => {
    const data = dataset();
    const atlas = new AtlasCore({ kernel: bridge });
    atlas.loadDataset(data);
    atlas.commitInvestigationContext('fm2-snapshot-replay-context', {
      schemaVersion: 2,
      nodeId: 'fm2-snapshot-replay-context',
      epistemicPurpose: 'CLAIM_BEARING',
      intent: {
        schemaVersion: 1,
        researchQuestion: 'Replay a direct empirical distribution',
        currentTask: 'fm2-snapshot-replay',
      },
    });
    try {
      await atlas.compileDirectDistributionEmbodiment(request);
      const reference = atlas.getActiveDirectSnapshot()?.body.directDistributionReference;
      expect(reference).toBeDefined();

      const session = new NemosyneSession({ atlas });
      const snapshot = session.serialize();
      expect(snapshot.directDistributionSnapshot).toBeTypeOf('string');
      const persisted = JSON.parse(new TextDecoder().decode(
        Uint8Array.from(atob(snapshot.directDistributionSnapshot!), (char) => char.charCodeAt(0)),
      )) as { binding: { sourceDigest: string; receiptId: string } };
      expect(persisted.binding.sourceDigest).toMatch(/^[a-f0-9]{64}$/);
      expect(persisted.binding.receiptId).toBe(`direct-distribution:${persisted.binding.sourceDigest}`);
      expect(reference?.sourceId).toBe(atlas.getActiveDirectSnapshot()?.body.sources[0]?.sourceId);

      const archive = await session.exportPortablePackage({}, undefined, {
        directDistributionBinding: true,
      });
      const replayed = await new InvestigationReplayRunner(bridge).replayArchive(archive);
      expect(replayed.directDistribution).toMatchObject({ status: 'VERIFIED' });
    } finally {
      bridge.destroyDataset(atlas.aggregate.analytical.currentHandle);
    }
  }, 60000);

  it('exports and restores the governed carrier without losing exact bytes', async () => {
    const data = dataset();
    const atlas = new AtlasCore({ kernel: bridge });
    atlas.loadDataset(data);
    const session = new NemosyneSession({ atlas });
    try {
      const binding = await session.captureDirectDistributionBinding(request);
      expect(binding).not.toBeNull();
      const snapshot = session.serialize();
      expect(snapshot.directDistributionSnapshot).toBeTypeOf('string');

      const restored = NemosyneSession.deserialize(
        snapshot,
        new AtlasCore({ kernel: null }),
      );
      const archive = await restored.exportPortablePackage({}, undefined, {
        directDistributionBinding: true,
      });
      const payload = NemosynePackageManager.unpack(archive);
      expect(payload.manifest.directDistributionDigest).toMatch(/^[a-f0-9]{64}$/);
      expect(payload.directDistributionBytes).toEqual(
        new Uint8Array(
          Uint8Array.from(atob(snapshot.directDistributionSnapshot!), (char) => char.charCodeAt(0)),
        ),
      );
    } finally {
      bridge.destroyDataset(atlas.aggregate.analytical.currentHandle);
    }
  }, 60000);

  it('does not serialize or export a live carrier after runtime generation or port replacement', async () => {
    const atlas = new AtlasCore({ kernel: bridge });
    atlas.loadDataset(dataset());
    atlas.commitInvestigationContext('fm2-runtime-lifecycle', {
      schemaVersion: 2,
      nodeId: 'fm2-runtime-lifecycle',
      epistemicPurpose: 'CLAIM_BEARING',
      intent: {
        schemaVersion: 1,
        researchQuestion: 'Reject stale direct-distribution authority',
        currentTask: 'fm2-runtime-lifecycle',
      },
    });
    const session = new NemosyneSession({ atlas });
    try {
      await atlas.compileDirectDistributionEmbodiment(request);
      expect(session.serialize().directDistributionSnapshot).toBeTypeOf('string');

      atlas.setGeneration(atlas.generation + 1);
      expect(session.serialize().directDistributionSnapshot).toBeUndefined();
      await expect(
        session.exportPortablePackage({}, undefined, { directDistributionBinding: true }),
      ).rejects.toThrow('Direct-distribution export requires a Rust-issued carrier for the current dataset');

      await expect(session.captureDirectDistributionBinding(request)).resolves.not.toBeNull();
      atlas.setExecutionPort(null);
      expect(session.serialize().directDistributionSnapshot).toBeUndefined();
      await expect(
        session.exportPortablePackage({}, undefined, { directDistributionBinding: true }),
      ).rejects.toThrow('Direct-distribution export requires a Rust-issued carrier for the current dataset');
    } finally {
      atlas.dispose();
    }
  }, 60000);

  it('exports a restored carrier through the public snapshot wrapper without an archived kernel identity', async () => {
    const data = dataset();
    const atlas = new AtlasCore({ kernel: bridge });
    atlas.loadDataset(data);
    const session = new NemosyneSession({ atlas });
    try {
      await session.captureDirectDistributionBinding(request);
      const archive = await NemosyneSession.exportPortableSnapshot(
        session.serialize(),
        {},
        undefined,
        { directDistributionBinding: true },
      );
      const payload = NemosynePackageManager.unpack(archive);
      expect(payload.directDistributionBytes).toBeDefined();
      expect(payload.manifest.directDistributionDigest).toMatch(/^[a-f0-9]{64}$/);
    } finally {
      bridge.destroyDataset(atlas.aggregate.analytical.currentHandle);
    }
  }, 60000);

  it('replays the exported carrier through the real Rust implementation path', async () => {
    const data = dataset();
    const atlas = new AtlasCore({ kernel: bridge });
    atlas.loadDataset(data);
    const session = new NemosyneSession({ atlas });
    try {
      await session.captureDirectDistributionBinding(request);
      const snapshot = session.serialize();
      const restored = NemosyneSession.deserialize(snapshot, new AtlasCore({ kernel: null }));
      const archive = await restored.exportPortablePackage({}, undefined, {
        directDistributionBinding: true,
      });
      const result = await new InvestigationReplayRunner(bridge).replayArchive(archive);
      expect(result.success).toBe(true);
      expect((result as { directDistribution?: { status: string } }).directDistribution)
        .toMatchObject({ status: 'VERIFIED' });
    } finally {
      bridge.destroyDataset(atlas.aggregate.analytical.currentHandle);
    }
  }, 60000);

  it('replays a carrier captured after a durable filter against the transformed analytical state', async () => {
    const data = dataset();
    const atlas = new AtlasCore({ kernel: bridge });
    atlas.loadDataset(data);
    const originalFingerprint = atlas.datasetFingerprint;
    try {
      const filterResult = atlas.applyAnalysis(
        toAnalysisSpec('filter', atlas.dataset!, atlas),
      );
      expect(filterResult.datasetFingerprint).not.toBe(originalFingerprint);
      expect(atlas.datasetFingerprint).toBe(filterResult.datasetFingerprint);
      expect(
        atlas.evidenceLedger.ledger.some((event) => event.kind === 'analysis'),
      ).toBe(true);

      const session = new NemosyneSession({ atlas });
      const binding = await session.captureDirectDistributionBinding(request);
      expect(binding?.datasetFingerprint).toBe(filterResult.datasetFingerprint);

      const archive = await session.exportPortablePackage({}, undefined, {
        directDistributionBinding: true,
      });
      const payload = NemosynePackageManager.unpack(archive);
      expect(payload.manifest.datasetFingerprint).toBe(originalFingerprint);
      expect(payload.manifest.analyticalDatasetFingerprint).toBe(
        filterResult.datasetFingerprint,
      );

      const replayed = await new InvestigationReplayRunner(bridge).replayArchive(archive);
      expect(replayed.success, replayed.discrepancies.join('\n')).toBe(true);
      expect(replayed.directDistribution).toMatchObject({ status: 'VERIFIED' });
    } finally {
      bridge.destroyDataset(atlas.aggregate.analytical.currentHandle);
    }
  }, 60000);

  it('refuses the direct claim when the transformation log reconstructs a different state', async () => {
    const data = dataset();
    const atlas = new AtlasCore({ kernel: bridge });
    atlas.loadDataset(data);
    try {
      atlas.applyAnalysis(toAnalysisSpec('filter', atlas.dataset!, atlas));
      const session = new NemosyneSession({ atlas });
      await expect(session.captureDirectDistributionBinding(request)).resolves.not.toBeNull();
      const archive = await session.exportPortablePackage({}, undefined, {
        directDistributionBinding: true,
      });
      const payload = NemosynePackageManager.unpack(archive);
      const events = JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(payload.commandLogBytes),
      ) as Array<Record<string, unknown>>;
      const analysis = events.find((event) => event.kind === 'analysis');
      if (!analysis) throw new Error('transformed replay fixture is missing its analysis event');
      const command = objectRecord(analysis.command);
      const operation = objectRecord(command.operation);
      const predicate = objectRecord(operation.predicate);
      predicate.value = Number(predicate.value) + 1;
      payload.commandLogBytes = new TextEncoder().encode(JSON.stringify(events));

      const replayed = await new InvestigationReplayRunner(bridge).replayPayload(payload);
      expect(replayed.success).toBe(false);
      expect(replayed.directDistribution).toMatchObject({ status: 'REFUSED' });
      expect(replayed.directDistribution?.status).not.toBe('VERIFIED');
      expect(replayed.discrepancies.join(' ')).toContain(
        'direct-distribution carrier does not match reconstructed dataset',
      );
    } finally {
      bridge.destroyDataset(atlas.aggregate.analytical.currentHandle);
    }
  }, 60000);

  it('uses the direct carrier identity after a stale representation decision and dataset mutation', async () => {
    const dataA = dataset();
    const dataB = new Dataset(
      'fm2-replay-mutated',
      [{ name: 'x', type: ColumnType.NUMERIC }],
      Array.from({ length: 32 }, (_, index) => ({ x: index + 100.5 })),
    );
    const atlas = new AtlasCore({ kernel: bridge });
    atlas.loadDataset(dataA);
    const decision = atlas.arbitrateRepresentation();
    expect(decision.datasetFingerprint).toBe(dataA.fingerprint);
    atlas.loadDataset(dataB);
    expect(atlas.datasetFingerprint).toBe(dataB.fingerprint);
    expect(atlas.activeRepresentationDecision?.datasetFingerprint).toBe(dataA.fingerprint);

    try {
      const session = new NemosyneSession({ atlas });
      await expect(session.captureDirectDistributionBinding(request)).resolves.not.toBeNull();
      const snapshot = session.serialize();
      const restored = NemosyneSession.deserialize(snapshot, new AtlasCore({ kernel: null }));
      const archive = await restored.exportPortablePackage({}, undefined, {
        directDistributionBinding: true,
      });
      const payload = NemosynePackageManager.unpack(archive);
      expect(payload.manifest.analyticalDatasetFingerprint).toBe(dataB.fingerprint);

      const replayed = await new InvestigationReplayRunner(bridge).replayArchive(archive);
      expect(replayed.success).toBe(true);
      expect(replayed.directDistribution).toMatchObject({ status: 'VERIFIED' });
    } finally {
      bridge.destroyDataset(atlas.aggregate.analytical.currentHandle);
    }
  }, 60000);

  it('captures through a production Worker session, restores, exports, and replays in fresh Rust', async () => {
    const { transport, atlas, session } = await workerSession();
    let archive: Uint8Array;
    try {
      const binding = await session.captureDirectDistributionBinding(request);
      expect(binding).not.toBeNull();
      expect(binding!.source.result.status).toBe('READY');

      const execute = transport.posted.find((message) => {
        const candidate = message as { type?: string; request?: { operation?: string } };
        return candidate.type === 'EXECUTE' && candidate.request?.operation === 'directDistributionBinding';
      }) as { request?: Record<string, unknown> } | undefined;
      expect(execute).toBeDefined();
      expect(execute!.request).not.toHaveProperty('handle');

      const snapshot = session.serialize();
      const restored = NemosyneSession.deserialize(snapshot, new AtlasCore({ kernel: null }));
      archive = await restored.exportPortablePackage({}, undefined, {
        directDistributionBinding: true,
      });
    } finally {
      atlas.dispose();
      transport.terminate();
    }

    const payload = NemosynePackageManager.unpack(archive);
    expect(payload.directDistributionBytes).toBeDefined();
    const replayed = await replayInFreshWorker(archive);
    expect(replayed.success).toBe(true);
    expect(replayed.discrepancies).toEqual([]);
    expect(replayed.directDistribution).toMatchObject({ status: 'VERIFIED' });
  }, 60000);

  it('compiles through a separate production Worker and persists that normal compilation carrier', async () => {
    const { transport, atlas, session } = await workerSession();
    let archive: Uint8Array;
    atlas.commitInvestigationContext('fm2-worker-compilation-context', {
      schemaVersion: 2,
      nodeId: 'fm2-worker-compilation-context',
      epistemicPurpose: 'CLAIM_BEARING',
      intent: {
        schemaVersion: 1,
        researchQuestion: 'Compile a direct empirical distribution in a Worker',
        currentTask: 'fm2-worker-compilation',
      },
    });
    try {
      const compiled = await atlas.compileDirectDistributionEmbodiment(request);
      expect(compiled.plan.planId).toMatch(/^plan-direct-/);
      expect(atlas.getActiveDirectSnapshot()?.body.directDistributionReference).toMatchObject({
        consumerId: DIRECT_DISTRIBUTION_CONSUMER_ID_V1,
        datasetFingerprint: atlas.datasetFingerprint,
      });
      expect(
        transport.posted.some((message) => {
          const candidate = message as { type?: string; request?: { operation?: string } };
          return candidate.type === 'EXECUTE' && candidate.request?.operation === 'directDistributionBinding';
        }),
      ).toBe(true);

      const snapshot = session.serialize();
      expect(snapshot.directDistributionSnapshot).toBeTypeOf('string');
      archive = await session.exportPortablePackage({}, undefined, {
        directDistributionBinding: true,
      });
    } finally {
      atlas.dispose();
      transport.terminate();
    }

    const replayed = await replayInFreshWorker(archive);
    expect(replayed.success).toBe(true);
    expect(replayed.discrepancies).toEqual([]);
    expect(replayed.directDistribution).toMatchObject({ status: 'VERIFIED' });
  }, 60000);

  it('refuses a real Worker binding whose source was minted for a different request', async () => {
    const transport = await startWorkerThread();
    await awaitHostReady(transport.worker);
    const atlas = new AtlasCore({ kernel: bridge });
    atlas.loadDataset(dataset());
    const handle = atlas.aggregate.analytical.currentHandle;
    const mismatchingRequest = { ...request, ecdfKnotCount: 2 };
    transport.mutateResult = (result) => ({
      ...result,
      value: buildDirectDistributionBindingV1(handle, mismatchingRequest),
    });
    atlas.setExecutionPort(new WorkerAnalyticalPort(transport));
    try {
      await expect(atlas.captureDirectDistributionBinding(request)).rejects.toThrow(
        'Source request does not match requested distribution',
      );
    } finally {
      atlas.dispose();
      transport.terminate();
    }
  }, 60000);

  it('refuses a Worker binding whose claim disagrees with independent kernel provenance', async () => {
    const transport = await startWorkerThread();
    await awaitHostReady(transport.worker);
    const atlas = new AtlasCore({ kernel: bridge });
    atlas.loadDataset(dataset());
    transport.mutateResult = (result) => {
      const value = objectRecord(result.value);
      const source = objectRecord(JSON.parse(String(value.sourceJson)));
      const sourceProvenance = objectRecord(source.provenance);
      const forgedKernelVersion = 'forged-worker-kernel';
      sourceProvenance.kernelVersion = forgedKernelVersion;
      value.kernelVersion = forgedKernelVersion;
      value.sourceJson = JSON.stringify(source);
      value.sourceDigest = sha256Hex(String(value.sourceJson));
      value.receiptId = `direct-distribution:${String(value.sourceDigest)}`;
      value.source = source;
      return { ...result, value };
    };
    atlas.setExecutionPort(new WorkerAnalyticalPort(transport));

    try {
      await expect(atlas.captureDirectDistributionBinding(request)).rejects.toThrow(
        'independent kernel provenance',
      );
    } finally {
      atlas.dispose();
      transport.terminate();
    }
  }, 60000);

  it('refuses a stale Worker capture during real worker recycle and requires fresh registration', async () => {
    const oldTransport = await startWorkerThread();
    await awaitHostReady(oldTransport.worker);
    const replacementTransport = await startWorkerThread();
    await awaitHostReady(replacementTransport.worker);

    const atlas = new AtlasCore({ kernel: bridge });
    atlas.loadDataset(dataset());
    const port = new WorkerAnalyticalPort(
      oldTransport,
      null,
      null,
      {},
      () => replacementTransport,
    );
    atlas.setExecutionPort(port);
    const session = new NemosyneSession({ atlas });
    const resultHeld = new Promise<void>((resolve) => {
      oldTransport.holdResult = () => {
        resolve();
      };
    });

    try {
      const staleCapture = session.captureDirectDistributionBinding(request);
      await resultHeld;

      const replacementDataset = new Dataset(
        'fm2-replay-replacement',
        [{ name: 'x', type: ColumnType.NUMERIC }],
        Array.from({ length: 32 }, (_, index) => ({ x: index + 100.5 })),
      );
      atlas.loadDataset(replacementDataset);

      await expect(staleCapture).resolves.toBeNull();
      expect(oldTransport.terminated).toBe(true);
      expect(session.serialize().directDistributionSnapshot).toBeUndefined();

      oldTransport.holdResult = null;
      const freshBinding = await session.captureDirectDistributionBinding(request);
      expect(freshBinding).not.toBeNull();
      expect(freshBinding!.datasetFingerprint).toBe(replacementDataset.fingerprint);
      expect(
        replacementTransport.posted.some((message) => {
          const candidate = message as { type?: string; request?: { operation?: string } };
          return candidate.type === 'EXECUTE' && candidate.request?.operation === 'directDistributionBinding';
        }),
      ).toBe(true);
    } finally {
      atlas.dispose();
      oldTransport.terminate();
      replacementTransport.terminate();
    }
  }, 60000);

  it('refuses altered source bytes even when the original digest is retained', async () => {
    const archive = await exportedDirectArchive();
    const payload = payloadWithCarrierMutation(archive, (carrier) => {
      carrier.binding.sourceJson = carrier.binding.sourceJson + ' altered';
    });
    const result = await new InvestigationReplayRunner(bridge).replayPayload(payload);
    expect(result.success).toBe(false);
    expect(result.directDistribution?.status).toBe('REFUSED');
    expect(result.discrepancies.join(' ')).toContain('Direct-distribution integrity failure');
  }, 60000);

  it('refuses a carrier with a missing source or use record', async () => {
    const archive = await exportedDirectArchive();
    const runner = new InvestigationReplayRunner(bridge);
    const missingSource = payloadWithCarrierMutation(archive, (carrier) => {
      delete carrier.binding.sourceJson;
    });
    const missingUse = payloadWithCarrierMutation(archive, (carrier) => {
      delete carrier.use;
    });
    await expect(runner.replayPayload(missingSource)).resolves.toMatchObject({
      success: false,
      directDistribution: { status: 'REFUSED' },
    });
    await expect(runner.replayPayload(missingUse)).resolves.toMatchObject({
      success: false,
      directDistribution: { status: 'REFUSED' },
    });
  }, 60000);

  it('refuses stale or mismatched use identity and wrong consumer claims', async () => {
    const archive = await exportedDirectArchive();
    const runner = new InvestigationReplayRunner(bridge);
    const staleUse = payloadWithCarrierMutation(archive, (carrier) => {
      if (!carrier.use) throw new Error('test carrier use missing');
      carrier.use.receiptId = 'direct-distribution:' + '0'.repeat(64);
    });
    const wrongConsumer = payloadWithCarrierMutation(archive, (carrier) => {
      if (!carrier.use) throw new Error('test carrier use missing');
      carrier.binding.consumerId = 'nemosyne:consumer/descriptive-statistics/v1';
      carrier.use.consumerId = carrier.binding.consumerId;
    });
    await expect(runner.replayPayload(staleUse)).resolves.toMatchObject({
      success: false,
      directDistribution: { status: 'REFUSED' },
    });
    await expect(runner.replayPayload(wrongConsumer)).resolves.toMatchObject({
      success: false,
      directDistribution: { status: 'REFUSED' },
    });

    const staleKernel = NemosynePackageManager.unpack(archive);
    staleKernel.manifest = {
      ...staleKernel.manifest,
      kernelVersion: 'stale-kernel-version',
    };
    await expect(runner.replayPayload(staleKernel)).resolves.toMatchObject({
      success: false,
      directDistribution: { status: 'REFUSED' },
    });
  }, 60000);

  it('refuses empty or missing manifest kernel identities before direct replay', async () => {
    const archive = await exportedDirectArchive();
    const cases = [
      ['empty kernelVersion', (manifest: Record<string, unknown>) => { manifest.kernelVersion = ''; }],
      ['missing kernelVersion', (manifest: Record<string, unknown>) => { delete manifest.kernelVersion; }],
      ['empty analyticalKernelVersion', (manifest: Record<string, unknown>) => { manifest.analyticalKernelVersion = ''; }],
      ['missing analyticalKernelVersion', (manifest: Record<string, unknown>) => { delete manifest.analyticalKernelVersion; }],
    ] as const;

    for (const [name, mutate] of cases) {
      const payload = payloadWithManifestMutation(archive, mutate);
      expect(() => NemosynePackageManager.pack(payload), name).toThrow();

      const result = await new InvestigationReplayRunner(bridge).replayPayload(payload);
      expect(result.success, name).toBe(false);
      expect(result.directDistribution, name).toMatchObject({ status: 'REFUSED' });
      expect(result.discrepancies.join(' '), name).toContain(
        'Direct-distribution carrier requires explicit non-empty kernel identities',
      );
    }
  }, 60000);

  it('refuses a rehashed forged source instead of trusting the carrier digest', async () => {
    const archive = await exportedDirectArchive();
    const payload = payloadWithCarrierMutation(archive, (carrier) => {
      const source = objectRecord(JSON.parse(String(carrier.binding.sourceJson)));
      const result = objectRecord(source.result);
      const payload = objectRecord(result.payload);
      const data = objectRecord(payload.data);
      const quantiles = data.quantiles as Array<Record<string, unknown>>;
      quantiles[0].value = Number(quantiles[0].value) + 1;
      carrier.binding.sourceJson = JSON.stringify(source);
      carrier.binding.sourceDigest = sha256Hex(String(carrier.binding.sourceJson));
      carrier.binding.receiptId = 'direct-distribution:' + String(carrier.binding.sourceDigest);
      if (!carrier.use) throw new Error('test carrier use missing');
      carrier.use.receiptId = String(carrier.binding.receiptId);
    });
    const result = await new InvestigationReplayRunner(bridge).replayPayload(payload);
    expect(result.success).toBe(false);
    expect(result.directDistribution).toMatchObject({ status: 'REFUSED' });
    expect(result.discrepancies.join(' ')).toContain('does not reproduce through the live Rust producer');
  }, 60000);

  it('keeps a rehashed forged restored carrier explicitly unverified until fresh Rust replay refuses it', async () => {
    const data = dataset();
    const atlas = new AtlasCore({ kernel: bridge });
    atlas.loadDataset(data);
    try {
      const session = new NemosyneSession({ atlas });
      await session.captureDirectDistributionBinding(request);
      const snapshot = session.serialize();
      const carrier = JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(
          Uint8Array.from(atob(snapshot.directDistributionSnapshot!), (char) => char.charCodeAt(0)),
        ),
      ) as MutableDirectCarrier;
      const source = objectRecord(JSON.parse(String(carrier.binding.sourceJson)));
      const result = objectRecord(source.result);
      const payload = objectRecord(result.payload);
      const sourceData = objectRecord(payload.data);
      const quantiles = sourceData.quantiles as Array<Record<string, unknown>>;
      quantiles[0].value = Number(quantiles[0].value) + 1;
      carrier.binding.sourceJson = JSON.stringify(source);
      carrier.binding.sourceDigest = sha256Hex(String(carrier.binding.sourceJson));
      carrier.binding.receiptId = 'direct-distribution:' + String(carrier.binding.sourceDigest);
      if (!carrier.use) throw new Error('test carrier use missing');
      carrier.use.receiptId = String(carrier.binding.receiptId);

      const forgedSnapshot = {
        ...snapshot,
        directDistributionSnapshot: base64Encode(
          new TextEncoder().encode(JSON.stringify(carrier)),
        ),
      };
      const archive = await NemosyneSession.exportPortableSnapshot(
        forgedSnapshot,
        {},
        undefined,
        { directDistributionBinding: true },
      );
      const exported = NemosynePackageManager.unpack(archive);
      expect(exported.manifest.directDistributionDigest).toMatch(/^[a-f0-9]{64}$/);

      const replayed = await new InvestigationReplayRunner(bridge).replayArchive(archive);
      expect(replayed.success).toBe(false);
      expect(replayed.directDistribution).toMatchObject({ status: 'REFUSED' });
      expect(replayed.directDistribution?.status).not.toBe('VERIFIED');
      expect(replayed.discrepancies.join(' ')).toContain('does not reproduce through the live Rust producer');
    } finally {
      bridge.destroyDataset(atlas.aggregate.analytical.currentHandle);
    }
  }, 60000);

  it('refuses present non-string optional request fields through real-WASM replay', async () => {
    const archive = await exportedDirectArchive();
    const runner = new InvestigationReplayRunner(bridge);

    for (const field of ['decisionId', 'decisionModelVersion', 'decisionModelArtifactHash'] as const) {
      const payload = payloadWithCarrierMutation(archive, (carrier) => {
        if (!carrier.request) throw new Error('test carrier request missing');
        carrier.request[field] = 123;
      });
      const result = await runner.replayPayload(payload);
      expect(result.success).toBe(false);
      expect(result.directDistribution?.status).toBe('REFUSED');
      expect(result.discrepancies.join(' ')).toContain(`request.${field} must be a string when present`);
    }
  }, 60000);

  it('rejects a reserved direct-carrier entry without a manifest digest during archive replay', async () => {
    const archive = await exportedDirectArchive();
    const files = unzipSync(archive);
    const manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(files['manifest.json'])) as Record<string, unknown>;
    delete manifest.directDistributionDigest;

    const malformedArchive = zipSync({
      ...files,
      'manifest.json': strToU8(JSON.stringify(manifest)),
    });

    await expect(
      new InvestigationReplayRunner(bridge).replayArchive(malformedArchive),
    ).rejects.toThrow('Direct-distribution bytes require directDistributionDigest');
  }, 60000);

  it('refuses a valid direct carrier embedded in a legacy V1 payload before replay', async () => {
    const archive = await exportedDirectArchive();
    const payload = NemosynePackageManager.unpack(archive);
    const legacyPayload = {
      ...payload,
      manifest: {
        ...payload.manifest,
        formatVersion: 1,
        investigationDigestAlgorithm: undefined,
      },
    };

    const result = await new InvestigationReplayRunner(bridge).replayPayload(legacyPayload);

    expect(result.success).toBe(false);
    expect(result.directDistribution).toMatchObject({ status: 'REFUSED' });
    expect(result.directDistribution?.status).not.toBe('VERIFIED');
    expect(result.discrepancies.join(' ')).toContain(
      'Format-v1 package cannot declare a direct-distribution carrier',
    );
  }, 60000);

  it('refuses dataset invalidation and keeps old packages on their existing path', async () => {
    const archive = await exportedDirectArchive();
    const payload = NemosynePackageManager.unpack(archive);
    const changed = new Dataset(
      'fm2-replay',
      [{ name: 'x', type: ColumnType.NUMERIC }],
      Array.from({ length: 32 }, (_, index) => ({ x: index + 1.5 })),
    );
    const invalidated = {
      ...payload,
      datasetBytes: new TextEncoder().encode(JSON.stringify(changed.toJSON())),
    };
    const refused = await new InvestigationReplayRunner(bridge).replayPayload(invalidated);
    expect(refused.success).toBe(false);
    expect(refused.directDistribution).toMatchObject({ status: 'REFUSED' });

    const oldAtlas = new AtlasCore({ kernel: bridge });
    oldAtlas.loadDataset(dataset());
    try {
      const oldArchive = await new NemosyneSession({ atlas: oldAtlas }).exportPortablePackage();
      const oldResult = await new InvestigationReplayRunner(bridge).replayArchive(oldArchive);
      expect(oldResult.success).toBe(true);
      expect(oldResult.directDistribution).toBeUndefined();
    } finally {
      bridge.destroyDataset(oldAtlas.aggregate.analytical.currentHandle);
    }
  }, 60000);
});
