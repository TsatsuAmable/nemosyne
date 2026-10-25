import { describe, expect, it, vi } from 'vitest';
import { Dataset, ColumnType } from '../src/data/Dataset.ts';
import * as bridge from '../src/wasm/RuntimeBridge.ts';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { InlineAnalyticalPort } from '../src/atlas/ports/InlineAnalyticalPort.ts';
import { WorkerAnalyticalPort, type WorkerTransport } from '../src/atlas/ports/WorkerAnalyticalPort.ts';
import type { AnalyticalExecutionRequest, AnalyticalDatasetRegistration } from '../src/atlas/ports/AnalyticalExecutionPort.ts';
import type { DirectDistributionBindingV1 } from '../src/moneta/representation/DirectDistributionBindingV1.ts';
import type { DistributionEmbodimentRequestV1 } from '../src/moneta/representation/SemanticEmbodimentPayload.ts';
import { verifyTransportedDirectDistributionBindingV1 } from '../src/moneta/representation/DirectDistributionBindingV1.ts';
import { buildDirectDistributionBindingV1 } from '../src/wasm/runtime/SemanticEmbodimentBridge.ts';

function dataset(): Dataset {
  return new Dataset('fm2-worker-real-rust', [
    { name: 'x', type: ColumnType.NUMERIC },
  ], Array.from({ length: 20 }, (_, i) => ({ x: i + 1 })));
}

const params: DistributionEmbodimentRequestV1 = {
  schemaVersion: 1, candidateId: 'DISTRIBUTION_FIELD', measureField: 'x',
  histogramBinCount: 8, ecdfKnotCount: 8, quantileProbabilities: [0, 0.5, 1],
};

const request = (fingerprint: string, version = 1, generation = 1): AnalyticalExecutionRequest => ({
  requestId: 'fm2-binding-' + version,
  operation: 'directDistributionBinding',
  dataset: { fingerprint, version },
  generation,
  params: params as unknown as Record<string, unknown>,
});

function commitContext(atlas: AtlasCore): void {
  atlas.commitInvestigationContext('fm2-snapshot-context', {
    schemaVersion: 2,
    nodeId: 'fm2-snapshot-context',
    epistemicPurpose: 'CLAIM_BEARING',
    intent: {
      schemaVersion: 1,
      researchQuestion: 'Inspect a direct empirical distribution',
      currentTask: 'fm2-snapshot',
    },
  });
}

describe('FM2-WORKER port preserves independent Rust authority', () => {
  it('normal Atlas direct compilation captures a deterministic Rust reference through the inline port', async () => {
    const data = dataset();
    const atlas = new AtlasCore({ kernel: bridge });
    atlas.loadDataset(data);
    commitContext(atlas);
    try {
      const first = await atlas.compileDirectDistributionEmbodiment(params);
      const firstSnapshot = atlas.getActiveDirectSnapshot();
      const second = await atlas.compileDirectDistributionEmbodiment(params);
      const secondSnapshot = atlas.getActiveDirectSnapshot();

      expect(first.plan.planId).toBe(second.plan.planId);
      expect(firstSnapshot?.body.directDistributionReference).toMatchObject({
        consumerId: 'nemosyne:consumer/direct-distribution/v1',
        requirementProfileId: 'direct-empirical-distribution/v1',
        claimKind: 'DESCRIPTIVE_EMPIRICAL_DISTRIBUTION',
        datasetFingerprint: data.fingerprint,
      });
      expect(firstSnapshot?.snapshotId).toBe(secondSnapshot?.snapshotId);
      expect(firstSnapshot?.body.sources[0].evidenceReferences).toEqual([]);
    } finally {
      bridge.destroyDataset(atlas.aggregate.analytical.currentHandle);
    }
  });

  it('keeps snapshot identity independent of decision metadata while retaining exact request binding', async () => {
    const data = dataset();
    const atlas = new AtlasCore({ kernel: bridge });
    atlas.loadDataset(data);
    commitContext(atlas);
    const firstRequest: DistributionEmbodimentRequestV1 = {
      ...params,
      decisionId: 'decision-fm2-a',
      decisionModelVersion: 'model-a',
      decisionModelArtifactHash: 'a'.repeat(64),
    };
    const secondRequest: DistributionEmbodimentRequestV1 = {
      ...params,
      decisionId: 'decision-fm2-b',
      decisionModelVersion: 'model-b',
      decisionModelArtifactHash: 'b'.repeat(64),
    };
    try {
      await atlas.compileDirectDistributionEmbodiment(firstRequest);
      const firstSnapshot = atlas.getActiveDirectSnapshot();
      const firstBinding = buildDirectDistributionBindingV1(
        atlas.aggregate.analytical.currentHandle,
        firstRequest,
      );
      await atlas.compileDirectDistributionEmbodiment(secondRequest);
      const secondSnapshot = atlas.getActiveDirectSnapshot();
      const secondBinding = buildDirectDistributionBindingV1(
        atlas.aggregate.analytical.currentHandle,
        secondRequest,
      );

      expect(firstBinding?.source.analyticalMethod.parameters).toMatchObject({
        request: firstRequest,
      });
      expect(secondBinding?.source.analyticalMethod.parameters).toMatchObject({
        request: secondRequest,
      });
      expect(firstBinding?.sourceDigest).not.toBe(secondBinding?.sourceDigest);
      expect(firstSnapshot?.body).toEqual(secondSnapshot?.body);
      expect(firstSnapshot?.snapshotId).toBe(secondSnapshot?.snapshotId);
    } finally {
      bridge.destroyDataset(atlas.aggregate.analytical.currentHandle);
    }
  });

  it('refuses normal direct compilation when no authoritative port can issue the binding', async () => {
    const data = dataset();
    const atlas = new AtlasCore();
    atlas.loadDataset(data);
    commitContext(atlas);

    await expect(atlas.compileDirectDistributionEmbodiment(params)).rejects.toThrow(
      'Rust binding unavailable or stale'
    );
    expect(atlas.getActiveDirectCompileResult()).toBeUndefined();
    expect(atlas.getActiveDirectSnapshot()).toBeUndefined();
  });

  it('executes the same real Rust source-bound producer through the injected inline port', async () => {
    const data = dataset();
    const handle = bridge.loadDatasetJson(data.toJSON());
    const port = new InlineAnalyticalPort(bridge);
    try {
      const req = { ...request(data.fingerprint), handle };
      const result = await port.execute<DirectDistributionBindingV1>(req);
      expect(result.error).toBeUndefined();
      const binding = result.value!;
      expect(binding.source.result.status).toBe('READY');
      expect(binding.sourceDigest).toMatch(/^[0-9a-f]{64}$/);
      expect(binding.datasetFingerprint).toBe(data.fingerprint);
      expect(bridge.datasetFingerprint(handle)).toBe(data.fingerprint);

      port.supersede({ generation: 2, datasetVersion: 2, datasetFingerprint: 'replacement' });
      const stale = await port.execute<DirectDistributionBindingV1>(req);
      expect(stale.value).toBeNull();
      const replaced = await port.execute<DirectDistributionBindingV1>({
        ...req, generation: 2, dataset: { fingerprint: 'replacement', version: 2 },
      });
      expect(replaced.value).toBeNull();
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('rejects an inline port with no injected direct producer, without a module-global fallback', async () => {
    const data = dataset();
    const handle = bridge.loadDatasetJson(data.toJSON());
    try {
      const incapable = { ...bridge, directDistributionBinding: undefined };
      const port = new InlineAnalyticalPort(incapable);
      const result = await port.execute({ ...request(data.fingerprint), handle });
      // Deliberately use the actual request separately: a missing producer
      // must not invoke any module-global Rust fallback.
      expect(result.value).toBeNull();
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('refuses an inline binding minted for a different distribution request', async () => {
    const data = dataset();
    const mismatchingRequest = { ...params, ecdfKnotCount: 2 };
    const mismatchingKernel = {
      ...bridge,
      directDistributionBinding(handle: number) {
        return bridge.directDistributionBinding?.(handle, mismatchingRequest) ?? null;
      },
    };
    const atlas = new AtlasCore({ kernel: mismatchingKernel });
    atlas.loadDataset(data);
    commitContext(atlas);
    try {
      await expect(atlas.compileDirectDistributionEmbodiment(params)).rejects.toThrow(
        'Rust binding unavailable or stale',
      );
    } finally {
      bridge.destroyDataset(atlas.aggregate.analytical.currentHandle);
    }
  });

  it('uses the real analytical.worker handler, worker-resident handle and exact fences', async () => {
    const previousSelf = globalThis.self;
    let handler: ((event: MessageEvent) => void | Promise<void>) | null = null;
    let transport: WorkerTransport & { posted: unknown[] };
    const workerScope = {
      set onmessage(value: typeof handler) { handler = value; },
      postMessage(msg: unknown) {
        queueMicrotask(() => transport.onmessage?.(new MessageEvent('message', { data: msg })));
      },
    };
    vi.stubGlobal('self', workerScope);
    try {
      await import('../src/atlas/ports/analytical.worker.ts');
      if (!handler) throw new Error('production Worker message handler not registered');
      const runWorker = handler as (event: MessageEvent) => void | Promise<void>;
      transport = {
        posted: [],
        onmessage: null,
        onerror: null,
        postMessage(msg: unknown) {
          this.posted.push(msg);
          queueMicrotask(() => { void runWorker(new MessageEvent('message', { data: msg })); });
        },
      };
      const port = new WorkerAnalyticalPort(transport);
      const data = dataset();
      const registration: AnalyticalDatasetRegistration = {
        registrationId: 'fm2-worker-registration',
        dataset: { fingerprint: data.fingerprint, version: 1 },
        generation: 1,
        payload: { type: 'json', data: data.toJSON() },
      };
      await port.registerDataset(registration);
      const requested = { ...request(data.fingerprint), handle: 999_999, datasetPayload: {
        type: 'json' as const, data: { invalid: 'must-not-cross' },
      } };
      const result = await port.execute<DirectDistributionBindingV1>(requested);
      expect(result.value?.source.result.status).toBe('READY');
      expect(result.value?.datasetFingerprint).toBe(data.fingerprint);
      const posted = transport.posted.find((entry) =>
        (entry as { type?: string }).type === 'EXECUTE') as { request: Record<string, unknown> };
      expect(Object.keys(posted.request).sort()).toEqual(
        ['dataset', 'generation', 'operation', 'params', 'requestId'].sort()
      );

      const atlas = new AtlasCore();
      atlas.setExecutionPort(port);
      atlas.loadDataset(data);
      commitContext(atlas);
      const compiled = await atlas.compileDirectDistributionEmbodiment(params);
      expect(compiled.plan.planId).toMatch(/^plan-direct-/);
      expect(atlas.getActiveDirectSnapshot()?.body.directDistributionReference).toMatchObject({
        consumerId: 'nemosyne:consumer/direct-distribution/v1',
        datasetFingerprint: data.fingerprint,
      });

      const refused = await port.execute<DirectDistributionBindingV1>({
        ...request(data.fingerprint), requestId: 'fm2-invalid-measure',
        params: { ...params, measureField: 'not-present' },
      });
      expect(refused.value).toBeNull();
      expect(refused.error).toBeUndefined();
      const valid = result.value!;
      const altered = { ...valid, sourceDigest: '0'.repeat(64) };
      expect(() => verifyTransportedDirectDistributionBindingV1(altered, {
        datasetFingerprint: data.fingerprint, kernelVersion: valid.kernelVersion,
      })).toThrow('content binding mismatch');

      port.supersede({ generation: 2, datasetVersion: 2, datasetFingerprint: 'new-data' });
      await expect(port.execute(request(data.fingerprint))).resolves.toMatchObject({ value: null });
      await expect(port.execute(request('new-data', 2, 2))).rejects.toThrow('not registered');
      port.dispose();
    } finally {
      vi.stubGlobal('self', previousSelf);
    }
  });
});

function controlledTransport() {
  const worker: WorkerTransport & {
    sent: unknown[];
    terminated: boolean;
    reply(data: unknown): void;
  } = {
    onmessage: null,
    onerror: null,
    sent: [],
    terminated: false,
    postMessage(value: unknown) {
      this.sent.push(value);
      const msg = value as { type?: string; registration?: AnalyticalDatasetRegistration };
      if (msg.type === 'REGISTER' && msg.registration) {
        const reg = msg.registration;
        queueMicrotask(() => this.reply({
          type: 'REGISTERED', registrationId: reg.registrationId,
          generation: reg.generation, datasetVersion: reg.dataset.version,
          datasetFingerprint: reg.dataset.fingerprint,
        }));
      }
    },
    reply(data: unknown) {
      this.onmessage?.(new MessageEvent('message', { data }));
    },
    terminate() { this.terminated = true; },
  };
  return worker;
}

describe('FM2-WORKER recycle and hostile transport controls', () => {
  it('recycles a pending direct binding and requires re-registration in the replacement worker', async () => {
    const oldWorker = controlledTransport();
    const replacement = controlledTransport();
    const port = new WorkerAnalyticalPort(oldWorker, null, null, {}, () => replacement);
    const data = dataset();
    await port.registerDataset({
      registrationId: 'old', dataset: { fingerprint: data.fingerprint, version: 1 },
      generation: 1, payload: { type: 'json', data: data.toJSON() },
    });
    const inFlight = port.execute(request(data.fingerprint));
    port.supersede({ generation: 2, datasetVersion: 2, datasetFingerprint: data.fingerprint });
    await expect(inFlight).resolves.toMatchObject({ value: null });
    expect(oldWorker.terminated).toBe(true);
    await expect(port.execute(request(data.fingerprint, 2, 2)))
      .rejects.toThrow('not registered');
    oldWorker.reply({
      type: 'RESULT', result: {
        requestId: 'fm2-binding-1', generation: 1, datasetVersion: 1,
        datasetFingerprint: data.fingerprint, value: { forged: true },
      },
    });
    await port.registerDataset({
      registrationId: 'new', dataset: { fingerprint: data.fingerprint, version: 2 },
      generation: 2, payload: { type: 'json', data: data.toJSON() },
    });
    const fresh = port.execute(request(data.fingerprint, 2, 2));
    replacement.reply({
      type: 'RESULT', result: {
        requestId: 'fm2-binding-2', generation: 2, datasetVersion: 2,
        datasetFingerprint: data.fingerprint, value: null,
      },
    });
    await expect(fresh).resolves.toMatchObject({ value: null });
    port.dispose();
  });

  it('rejects a malformed binding delivered by a Worker instead of accepting the typed cast', async () => {
    const transport = controlledTransport();
    const port = new WorkerAnalyticalPort(transport);
    const data = dataset();
    await port.registerDataset({
      registrationId: 'admitted', dataset: { fingerprint: data.fingerprint, version: 1 },
      generation: 1, payload: { type: 'json', data: data.toJSON() },
    });
    const pending = port.execute<DirectDistributionBindingV1>(request(data.fingerprint));
    transport.reply({
      type: 'RESULT', result: {
        requestId: 'fm2-binding-1', generation: 1, datasetVersion: 1,
        datasetFingerprint: data.fingerprint, value: {
          consumerId: 'forged', datasetFingerprint: data.fingerprint, kernelVersion: '0.2.1',
        },
      },
    });
    await expect(pending).rejects.toThrow('direct distribution binding refused');
    port.dispose();
  });
});
