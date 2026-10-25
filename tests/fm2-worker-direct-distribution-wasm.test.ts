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
import { normalizeDirectDistributionBindingToSnapshot } from '../src/moneta/representation/SemanticSnapshotV1.ts';
import { buildDirectDistributionBindingV1 } from '../src/wasm/runtime/SemanticEmbodimentBridge.ts';
import { sha256Hex } from '../src/security/CryptoHash.ts';
import { compileFormaAdmission } from '../src/moneta/forma/FormaAdmission.ts';
import { compileFormaSpatialSlice } from '../src/moneta/forma/FormaSpatialCompiler.ts';
import { createKB0Manifest } from '../src/moneta/forma/KB0Manifest.ts';
import { QUEST_CONSTRAINED_BUDGET } from '../src/moneta/forma/FormaResolutionBroker.ts';
import { buildDirectLoopSurfaceViews } from '../src/moneta/representation/DirectLoopViewModels.ts';
import { NemosyneSession } from '../src/session/NemosyneSession.ts';
import { toAnalysisSpec } from '../src/vr/interactions/DataOperations.ts';
import { encodeTypedColumnsPayload } from '../src/wasm/TypedColumnsCodec.ts';

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

function typedPayload(values: readonly number[]): Uint8Array {
  return encodeTypedColumnsPayload({
    rowCount: values.length,
    columns: [{
      name: 'x',
      type: 'numeric',
      values: new Float64Array(values),
      validity: new Uint8Array(values.length).fill(1),
    }],
  });
}

async function seedDirectState(atlas: AtlasCore): Promise<void> {
  expect(bridge.datasetFingerprint(atlas.aggregate.analytical.currentHandle)).toBe(
    atlas.datasetFingerprint,
  );
  const compilation = await atlas.compileDirectDistributionEmbodiment(params);
  const target = compilation.plan.elements[0];
  if (!target) throw new Error('real direct compilation produced no target element');

  const recorded = atlas.recordDirectLedgerCritique({
    investigatorId: 'typed-turnover-test',
    targetElementId: target.id,
    targetPhenomenon: 'DISTRIBUTION',
    critiqueKind: 'SPATIAL_SCALE',
    note: 'The overview needs a constrained alternative before typed turnover.',
  });
  const { alternative, link } = atlas.resolveDirectAlternativeFromCritique(
    recorded.critique.critiqueId,
    { budget: QUEST_CONSTRAINED_BUDGET },
  );
  const alternativeTarget = alternative.plan.elements[0] ?? target;
  atlas.recordDirectAlternativeFeedback(link.linkId, {
    planId: alternative.plan.planId,
    sliceId: alternative.slice.sliceId,
    contextId: alternative.slice.contextId,
    semanticNodeId: alternativeTarget.semanticNodeId,
    critiqueText: 'The constrained alternative preserves the requested distribution detail.',
    confirmed: true,
  });
  atlas.compileObligationPreservingVariants({ snapshot: atlas.getActiveDirectSnapshot()! });
}

function expectDatasetBoundStateCleared(
  atlas: AtlasCore,
  session: NemosyneSession,
  fingerprint: string,
): void {
  expect(atlas.datasetFingerprint).toBe(fingerprint);
  expect(atlas.getActiveDirectSnapshot()).toBeUndefined();
  expect(atlas.getActiveDirectCompileResult()).toBeUndefined();
  expect(atlas.getActiveVariantPair()).toBeUndefined();
  expect(atlas.getActiveFormaResult()).toBeUndefined();
  expect(atlas.getActiveFormaSlice()).toBeUndefined();
  expect(atlas.getDirectFeedbackLinks()).toEqual([]);
  expect(atlas.getDirectAlternativeFeedbackBindings()).toEqual([]);
  expect(atlas.aggregate.getFormaState()).toBeUndefined();

  const surface = buildDirectLoopSurfaceViews({
    links: atlas.getDirectFeedbackLinks(),
    bindings: atlas.getDirectAlternativeFeedbackBindings(),
    variantPair: atlas.getActiveVariantPair(),
  });
  expect(surface.inspector.alternatives).toEqual([]);
  expect(surface.history.bindings).toEqual([]);
  expect(surface.alternative.pair).toBeNull();

  const persisted = session.serialize();
  expect(persisted.formaInvestigationSnapshot).toBeUndefined();
  expect(persisted.directDistributionSnapshot).toBeUndefined();
}

function expectTypedWorkerPayload(atlas: AtlasCore, bytes: Uint8Array): void {
  const payload = (atlas as unknown as { _workerRegistrationPayload(): { type: string; data: unknown } })._workerRegistrationPayload();
  expect(payload.type).toBe('typed');
  const workerBytes = payload.data instanceof Uint8Array
    ? payload.data
    : new Uint8Array(payload.data as ArrayBuffer);
  expect(workerBytes).toEqual(bytes);
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

  it('refuses a caller-supplied clone of a direct snapshot without runtime admission', async () => {
    const data = dataset();
    const atlas = new AtlasCore({ kernel: bridge });
    atlas.loadDataset(data);
    commitContext(atlas);
    try {
      await atlas.compileDirectDistributionEmbodiment(params);
      const captured = atlas.getActiveDirectSnapshot();
      expect(captured).toBeDefined();

      const callerSuppliedSnapshot = structuredClone(captured!);
      expect(() => atlas.compileDirectEmbodiment({ snapshot: callerSuppliedSnapshot })).toThrow(
        'runtime-issued direct-distribution admission'
      );

      const formaOutcome = compileFormaSpatialSlice(
        callerSuppliedSnapshot,
        atlas.getActiveInvestigationContext()!,
        createKB0Manifest(),
      );
      expect(formaOutcome.status).toBe('REFUSED');
      if (formaOutcome.status === 'REFUSED') {
        expect(formaOutcome.refusal.code).toBe('UNTRUSTED_DECODING');
        expect(formaOutcome.refusal.message).toContain('runtime-issued admission capability');
      }
    } finally {
      bridge.destroyDataset(atlas.aggregate.analytical.currentHandle);
    }
  });

  it('refuses a caller self-supply of a self-hashed fake direct snapshot through both public Forma paths', async () => {
    const data = dataset();
    const atlas = new AtlasCore({ kernel: bridge });
    atlas.loadDataset(data);
    commitContext(atlas);
    try {
      const issued = await atlas.captureDirectDistributionBinding(params);
      expect(issued).toBeDefined();
      const issuedBinding = issued!;

      const forgedSource = structuredClone(issuedBinding.source) as unknown as Record<string, unknown>;
      const forgedResult = forgedSource.result as Record<string, unknown>;
      const forgedPayload = forgedResult.payload as Record<string, unknown>;
      const forgedData = forgedPayload.data as Record<string, unknown>;
      const forgedHistogram = forgedData.histogram as Array<Record<string, unknown>>;
      forgedHistogram[0] = { ...forgedHistogram[0], count: 999999 };
      const forgedSourceJson = JSON.stringify(forgedSource);
      const forgedSourceDigest = sha256Hex(forgedSourceJson);
      const forgedBinding = {
        ...issuedBinding,
        sourceJson: forgedSourceJson,
        sourceDigest: forgedSourceDigest,
        receiptId: `direct-distribution:${forgedSourceDigest}`,
        source: forgedSource as unknown as typeof issuedBinding.source,
      };
      const forgedSnapshot = normalizeDirectDistributionBindingToSnapshot(forgedBinding);
      const context = atlas.getActiveInvestigationContext()!;
      // Exercise the legacy caller-controlled field at runtime even though the
      // repaired public TypeScript API no longer declares it.
      const forgedOptions = { runtimeIssuedDirectSnapshot: forgedSnapshot } as never;

      const admission = compileFormaAdmission(forgedSnapshot, context, forgedOptions);
      expect(admission.status).toBe('REFUSED');
      if (admission.status === 'REFUSED') {
        expect(admission.refusal.code).toBe('UNTRUSTED_DECODING');
      }

      const spatial = compileFormaSpatialSlice(
        forgedSnapshot,
        context,
        createKB0Manifest(),
        'SPATIAL_SCATTER_V1',
        forgedOptions,
      );
      expect(spatial.status).toBe('REFUSED');
      if (spatial.status === 'REFUSED') {
        expect(spatial.refusal.code).toBe('UNTRUSTED_DECODING');
      }
    } finally {
      atlas.dispose();
    }
  });

  it('does not let exported transport verification authorize a caller-owned binding through Forma', async () => {
    const data = dataset();
    const atlas = new AtlasCore({ kernel: bridge });
    atlas.loadDataset(data);
    commitContext(atlas);
    try {
      const issued = await atlas.captureDirectDistributionBinding(params);
      expect(issued).toBeDefined();

      // The clone is caller-owned. A structural verifier may validate its
      // bytes, but it must not turn that clone into a live analytical
      // capability merely because the request matches.
      const callerBinding = structuredClone(issued!);
      const verified = verifyTransportedDirectDistributionBindingV1(
        callerBinding,
        { datasetFingerprint: data.fingerprint, kernelVersion: bridge.kernelVersion()! },
        params,
      );
      const callerSnapshot = normalizeDirectDistributionBindingToSnapshot(verified);
      const formaOutcome = compileFormaSpatialSlice(
        callerSnapshot,
        atlas.getActiveInvestigationContext()!,
        createKB0Manifest(),
      );

      expect(formaOutcome.status).toBe('REFUSED');
      if (formaOutcome.status === 'REFUSED') {
        expect(formaOutcome.refusal.code).toBe('UNTRUSTED_DECODING');
        expect(formaOutcome.refusal.message).toContain('runtime-issued admission capability');
      }
    } finally {
      atlas.dispose();
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
      const staleSnapshot = atlas.getActiveDirectSnapshot()!;
      expect(staleSnapshot.body.directDistributionReference).toMatchObject({
        consumerId: 'nemosyne:consumer/direct-distribution/v1',
        datasetFingerprint: data.fingerprint,
      });

      const transformed = await atlas.applyAnalysisAsync(
        toAnalysisSpec('filter', atlas.dataset!, atlas),
      );
      expect(transformed.datasetFingerprint).not.toBe(data.fingerprint);
      expect(atlas.datasetVersion).toBeGreaterThan(1);

      const context = atlas.getActiveInvestigationContext()!;
      expect(compileFormaAdmission(staleSnapshot, context).status).toBe('REFUSED');
      expect(
        compileFormaSpatialSlice(staleSnapshot, context, createKB0Manifest()).status,
      ).toBe('REFUSED');

      const freshCompiled = await atlas.compileDirectDistributionEmbodiment(params);
      const freshSnapshot = atlas.getActiveDirectSnapshot()!;
      expect(freshCompiled.plan.planId).toMatch(/^plan-direct-/);
      expect(freshSnapshot).not.toBe(staleSnapshot);
      expect(freshSnapshot.body.analyticalDatasetFingerprint).toBe(atlas.datasetFingerprint);
      expect(compileFormaAdmission(freshSnapshot, context).status).toBe('ADMITTED');

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

      const typedTransport: WorkerTransport & { posted: unknown[] } = {
        posted: [],
        onmessage: null,
        onerror: null,
        postMessage(msg: unknown) {
          this.posted.push(msg);
          queueMicrotask(() => { void runWorker(new MessageEvent('message', { data: msg })); });
        },
      };
      transport = typedTransport;
      const typedPort = new WorkerAnalyticalPort(typedTransport);
      const typedAtlas = new AtlasCore({ kernel: bridge });
      typedAtlas.setExecutionPort(typedPort);
      const typedBytesA = typedPayload(Array.from({ length: 20 }, (_, index) => index + 1));
      const typedBytesB = typedPayload(Array.from({ length: 20 }, (_, index) => index + 101));
      typedAtlas.loadTypedDataset(typedBytesA, 'worker-typed-a');
      const typedFingerprintA = typedAtlas.datasetFingerprint!;
      const typedVersionA = typedAtlas.datasetVersion;
      const typedBindingA = await typedAtlas.captureDirectDistributionBinding(params);
      expect(typedBindingA?.datasetFingerprint).toBe(typedFingerprintA);
      const typedRegistrationA = [...typedTransport.posted].reverse().find((entry) =>
        (entry as { type?: string }).type === 'REGISTER'
      ) as { registration: AnalyticalDatasetRegistration };
      expect(typedRegistrationA.registration.payload.type).toBe('typed');
      expect(typedRegistrationA.registration.dataset).toEqual({
        fingerprint: typedFingerprintA,
        version: typedVersionA,
      });
      expect(typedRegistrationA.registration.generation).toBe(typedAtlas.generation);
      const registeredBytesA = typedRegistrationA.registration.payload.data instanceof Uint8Array
        ? typedRegistrationA.registration.payload.data
        : new Uint8Array(typedRegistrationA.registration.payload.data as ArrayBuffer);
      expect(registeredBytesA).toEqual(typedBytesA);

      typedAtlas.loadTypedDataset(typedBytesB, 'worker-typed-b');
      await expect(typedPort.execute(request(typedFingerprintA, typedVersionA, 1)))
        .resolves.toMatchObject({ value: null });
      const typedFingerprintB = typedAtlas.datasetFingerprint!;
      const typedBindingB = await typedAtlas.captureDirectDistributionBinding(params);
      expect(typedBindingB?.datasetFingerprint).toBe(typedFingerprintB);
      const typedRegistrationB = [...typedTransport.posted].reverse().find((entry) =>
        (entry as { type?: string }).type === 'REGISTER'
      ) as { registration: AnalyticalDatasetRegistration };
      const registeredBytesB = typedRegistrationB.registration.payload.data instanceof Uint8Array
        ? typedRegistrationB.registration.payload.data
        : new Uint8Array(typedRegistrationB.registration.payload.data as ArrayBuffer);
      expect(typedRegistrationB.registration.dataset).toEqual({
        fingerprint: typedFingerprintB,
        version: typedAtlas.datasetVersion,
      });
      expect(typedRegistrationB.registration.generation).toBe(typedAtlas.generation);
      expect(registeredBytesB).toEqual(typedBytesB);
      typedAtlas.dispose();

      const otherAtlas = new AtlasCore({ kernel: bridge });
      otherAtlas.loadDataset(data);
      expect(() => otherAtlas.compileDirectEmbodiment({ snapshot: freshSnapshot })).toThrow(
        'runtime-issued direct-distribution admission',
      );
      otherAtlas.dispose();

      const freshContext = atlas.getActiveInvestigationContext()!;
      atlas.dispose();
      expect(compileFormaAdmission(freshSnapshot, freshContext).status).toBe('REFUSED');
      port.dispose();
    } finally {
      vi.stubGlobal('self', previousSelf);
    }
  });
});

describe('FM2 typed dataset turnover clears dataset-bound direct state', () => {
  it('drops the live direct carrier when typed ingestion fails without changing the current dataset', async () => {
    const atlas = new AtlasCore({ kernel: bridge });
    const session = new NemosyneSession({ atlas });
    const rowDataset = new Dataset('fm2-failed-typed-load', [
      { name: 'x', type: ColumnType.NUMERIC },
    ], Array.from({ length: 20 }, (_, index) => ({ x: index + 1 })));

    try {
      atlas.loadDataset(rowDataset);
      commitContext(atlas);
      await seedDirectState(atlas);
      await session.captureDirectDistributionBinding(params);
      const currentFingerprint = atlas.datasetFingerprint;
      const currentVersion = atlas.datasetVersion;
      const beforeSnapshot = atlas.getActiveDirectSnapshot();
      const beforeCompile = atlas.getActiveDirectCompileResult();
      const beforeVariants = atlas.getActiveVariantPair();
      const beforeFormaResult = atlas.getActiveFormaResult();
      const beforeFormaSlice = atlas.getActiveFormaSlice();
      const beforeFormaState = atlas.aggregate.getFormaState();
      const beforeLinks = atlas.getDirectFeedbackLinks();
      const beforeBindings = atlas.getDirectAlternativeFeedbackBindings();
      const beforeSession = session.serialize();
      expect(beforeSession.directDistributionSnapshot).toBeTypeOf('string');
      expect(beforeSession.formaInvestigationSnapshot).toBeTypeOf('string');

      expect(() => atlas.loadTypedDataset(new Uint8Array([0, 1, 2, 3]), 'invalid-typed'))
        .toThrow('Kernel rejected typed columns payload.');
      expect(atlas.datasetFingerprint).toBe(currentFingerprint);
      expect(atlas.datasetVersion).toBe(currentVersion);
      expect(atlas.getActiveDirectSnapshot()).toEqual(beforeSnapshot);
      expect(atlas.getActiveDirectCompileResult()).toEqual(beforeCompile);
      expect(atlas.getActiveVariantPair()).toEqual(beforeVariants);
      expect(atlas.getActiveFormaResult()).toEqual(beforeFormaResult);
      expect(atlas.getActiveFormaSlice()).toEqual(beforeFormaSlice);
      expect(atlas.aggregate.getFormaState()).toEqual(beforeFormaState);
      expect(atlas.getDirectFeedbackLinks()).toEqual(beforeLinks);
      expect(atlas.getDirectAlternativeFeedbackBindings()).toEqual(beforeBindings);

      const afterSession = session.serialize();
      expect(afterSession.datasetFingerprint).toBe(beforeSession.datasetFingerprint);
      expect(afterSession.datasetVersion).toBe(beforeSession.datasetVersion);
      expect(afterSession.directDistributionSnapshot).toBe(beforeSession.directDistributionSnapshot);
      expect(afterSession.formaInvestigationSnapshot).toBe(beforeSession.formaInvestigationSnapshot);

      const oldAuthority = await atlas.captureDirectDistributionBinding(params);
      expect(oldAuthority?.datasetFingerprint).toBe(currentFingerprint);
    } finally {
      atlas.dispose();
    }
  }, 60000);

  it('clears direct lineage and persisted Forma state across row, typed, same-fingerprint, and row turnovers', async () => {
    const atlas = new AtlasCore({ kernel: bridge });
    const session = new NemosyneSession({ atlas });
    const rowDataset = new Dataset('fm2-row-turnover', [
      { name: 'x', type: ColumnType.NUMERIC },
    ], Array.from({ length: 20 }, (_, index) => ({ x: index + 1 })));
    const typedA = typedPayload(Array.from({ length: 20 }, (_, index) => index + 10));
    const typedB = typedPayload(Array.from({ length: 20 }, (_, index) => index + 100));

    try {
      atlas.loadDataset(rowDataset);
      commitContext(atlas);
      await seedDirectState(atlas);
      await session.captureDirectDistributionBinding(params);

      const beforeTurnover = session.serialize();
      expect(beforeTurnover.formaInvestigationSnapshot).toBeTypeOf('string');
      expect(beforeTurnover.directDistributionSnapshot).toBeTypeOf('string');
      const beforeForma = JSON.parse(
        Buffer.from(beforeTurnover.formaInvestigationSnapshot!, 'base64').toString('utf8'),
      ) as Parameters<typeof atlas.aggregate.setFormaState>[0];
      expect(beforeForma.directFeedbackLinks).toHaveLength(1);
      expect(beforeForma.directAlternativeFeedbackBindings).toHaveLength(1);

      const typedAHandle = atlas.loadTypedDataset(typedA, 'typed-a');
      expect(typedAHandle).toBeGreaterThan(0);
      expectTypedWorkerPayload(atlas, typedA);
      expectDatasetBoundStateCleared(atlas, session, atlas.datasetFingerprint!);

      commitContext(atlas);
      atlas.aggregate.setFormaState(beforeForma);
      expect(atlas.getDirectFeedbackLinks()).toHaveLength(1);
      const typedAFingerprint = atlas.datasetFingerprint!;
      const typedAVersion = atlas.datasetVersion;

      const typedBHandle = atlas.loadTypedDataset(typedB, 'typed-b');
      expect(typedBHandle).toBeGreaterThan(0);
      expectTypedWorkerPayload(atlas, typedB);
      expectDatasetBoundStateCleared(atlas, session, atlas.datasetFingerprint!);
      expect(atlas.datasetFingerprint).not.toBe(typedAFingerprint);

      commitContext(atlas);
      atlas.aggregate.setFormaState(beforeForma);
      expect(atlas.getDirectFeedbackLinks()).toHaveLength(1);
      const sameFingerprint = atlas.datasetFingerprint!;
      const sameFingerprintVersion = atlas.datasetVersion;
      const samePayloadHandle = atlas.loadTypedDataset(typedB, 'typed-b');
      expect(samePayloadHandle).toBeGreaterThan(0);
      expect(atlas.datasetFingerprint).toBe(sameFingerprint);
      expect(atlas.datasetVersion).toBeGreaterThan(sameFingerprintVersion);
      expect(atlas.datasetVersion).toBeGreaterThan(typedAVersion);
      expectTypedWorkerPayload(atlas, typedB);
      expectDatasetBoundStateCleared(atlas, session, sameFingerprint);

      atlas.aggregate.setFormaState(beforeForma);
      expect(atlas.getDirectFeedbackLinks()).toHaveLength(1);
      atlas.loadDataset(new Dataset('fm2-row-replacement', [
        { name: 'x', type: ColumnType.NUMERIC },
      ], [{ x: 1000 }, { x: 2000 }]));
      const rowPayload = (atlas as unknown as { _workerRegistrationPayload(): { type: string } })._workerRegistrationPayload();
      expect(rowPayload.type).toBe('json');
      expectDatasetBoundStateCleared(atlas, session, atlas.datasetFingerprint!);
    } finally {
      atlas.dispose();
    }
  }, 60000);
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
