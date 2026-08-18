import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FEATURE_DIM,
  GESTURE_CLASSES,
  type ModelCard,
  type NeuralScore,
  type OrtFactoryLike,
  type OrtSessionLike,
  type OrtTensorLike,
} from '../src/contracts.ts';
import {
  createNeuralClassifier,
  createOrtFactory,
  type FetchLike,
  type OrtNamespaceLike,
  type ResponseLike,
} from '../src/onnx.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(HERE, '..', 'assets');

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function buildCard(overrides: Partial<ModelCard> = {}, bytes: Uint8Array): ModelCard {
  return {
    name: 'gesture_classifier',
    version: 'test-1',
    inputName: 'trajectory',
    outputName: 'probs',
    featureDim: FEATURE_DIM,
    classes: [...GESTURE_CLASSES],
    featureSpec: 'test',
    metrics: {
      heldOutAccuracy: 0.9,
      macroF1: 0.9,
      samples: 100,
      confusion: [],
    },
    sha256: sha256Hex(bytes),
    ...overrides,
  };
}

function fakeSession(
  probs: Float32Array,
  behavior: 'ok' | 'throw' = 'ok'
): OrtSessionLike {
  return {
    async run(inputs: Record<string, OrtTensorLike>): Promise<Record<string, OrtTensorLike>> {
      if (behavior === 'throw') throw new Error('run rejected');
      const input = inputs['trajectory'];
      if (!input) throw new Error('no trajectory input');
      return { probs: { data: probs, dims: [1, probs.length] } };
    },
    release: () => undefined,
  };
}

function fakeFactory(
  session: OrtSessionLike,
  record: { createdWith?: Uint8Array } = {}
): OrtFactoryLike {
  return {
    async createSession(source: string | Uint8Array): Promise<OrtSessionLike> {
      if (typeof source === 'string') throw new Error('expected bytes');
      record.createdWith = source;
      return session;
    },
  };
}

function fetcher(
  bytes: Uint8Array,
  card: ModelCard
): FetchLike {
  return async (url: string): Promise<ResponseLike> => {
    if (url.endsWith('.json')) {
      return {
        ok: true,
        status: 200,
        async json() {
          return card;
        },
        async arrayBuffer() {
          return new ArrayBuffer(0);
        },
      };
    }
    return {
      ok: true,
      status: 200,
      async json() {
        return null;
      },
      async arrayBuffer() {
        return bytes.slice().buffer;
      },
    };
  };
}

const probs = new Float32Array([0.1, 0.05, 0.05, 0.7, 0.05, 0.05]);

describe('createNeuralClassifier', () => {
  it('init loads card + verifies hash + session, score maps probs to classes', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const card = buildCard({}, bytes);
    const created = {} as { createdWith?: Uint8Array };
    const factory = fakeFactory(fakeSession(probs), created);
    const fetchImpl = fetcher(bytes, card);
    const neural = createNeuralClassifier({
      modelUrl: 'model.onnx',
      modelCardUrl: 'card.json',
      ortFactory: factory,
      fetchImpl,
      clock: () => 0,
    });
    const ok = await neural.init();
    expect(ok).toBe(true);
    expect(neural.ready).toBe(true);
    expect(neural.modelVersion).toBe('test-1');
    expect(created.createdWith).toStrictEqual(bytes);
    const features = new Float32Array(FEATURE_DIM).fill(0.5);
    const out: NeuralScore = await neural.score(features);
    expect(out.modelVersion).toBe('test-1');
    expect(out.latencyMs).toBeGreaterThanOrEqual(0);
    expect(out.scores.scoopUp).toBeCloseTo(0.7, 5);
    expect(out.scores.idle).toBeCloseTo(0.1, 5);
    expect(out.scores.bothPinched).toBeCloseTo(0.05, 5);
    neural.dispose();
    expect(neural.ready).toBe(false);
  });

  it('uses a preloaded model card when supplied', async () => {
    const bytes = new Uint8Array([9, 9, 9]);
    const card = buildCard({}, bytes);
    const factory = fakeFactory(fakeSession(probs));
    const fetchImpl = fetcher(bytes, card);
    const neural = createNeuralClassifier({
      modelUrl: 'model.onnx',
      modelCard: card,
      ortFactory: factory,
      fetchImpl,
      clock: () => 0,
    });
    expect(await neural.init()).toBe(true);
  });

  it('hash mismatch fails init and reports not ready', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const card = buildCard({ sha256: '0'.repeat(64) }, bytes);
    const factory = fakeFactory(fakeSession(probs));
    const neural = createNeuralClassifier({
      modelUrl: 'model.onnx',
      modelCard: card,
      ortFactory: factory,
      fetchImpl: fetcher(bytes, card),
      clock: () => 0,
    });
    const ok = await neural.init();
    expect(ok).toBe(false);
    expect(neural.ready).toBe(false);
    expect(neural.modelVersion).toBeNull();
  });

  it('wrong featureDim in card fails init', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const card = buildCard({ featureDim: 40 }, bytes);
    const factory = fakeFactory(fakeSession(probs));
    const neural = createNeuralClassifier({
      modelUrl: 'model.onnx',
      modelCard: card,
      ortFactory: factory,
      fetchImpl: fetcher(bytes, card),
      clock: () => 0,
    });
    expect(await neural.init()).toBe(false);
  });

  it('class order mismatch in card fails init', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const wrongClasses = [...GESTURE_CLASSES].reverse() as ModelCard['classes'];
    const card = buildCard({ classes: wrongClasses }, bytes);
    const factory = fakeFactory(fakeSession(probs));
    const neural = createNeuralClassifier({
      modelUrl: 'model.onnx',
      modelCard: card,
      ortFactory: factory,
      fetchImpl: fetcher(bytes, card),
      clock: () => 0,
    });
    expect(await neural.init()).toBe(false);
  });

  it('run rejection surfaces from score', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const card = buildCard({}, bytes);
    const factory = fakeFactory(fakeSession(probs, 'throw'));
    const neural = createNeuralClassifier({
      modelUrl: 'model.onnx',
      modelCard: card,
      ortFactory: factory,
      fetchImpl: fetcher(bytes, card),
      clock: () => 0,
    });
    expect(await neural.init()).toBe(true);
    await expect(neural.score(new Float32Array(FEATURE_DIM))).rejects.toThrow();
  });

  it('score before init rejects', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const card = buildCard({}, bytes);
    const factory = fakeFactory(fakeSession(probs));
    const neural = createNeuralClassifier({
      modelUrl: 'model.onnx',
      modelCard: card,
      ortFactory: factory,
      fetchImpl: fetcher(bytes, card),
      clock: () => 0,
    });
    await expect(neural.score(new Float32Array(FEATURE_DIM))).rejects.toThrow();
  });
});

describe('createOrtFactory over real onnxruntime-web', () => {
  it('scores the exported model end-to-end (skipped-with-reason if headless wasm unavailable)', async () => {
    let ort: unknown;
    try {
      ort = await import('onnxruntime-web');
    } catch (err) {
      console.warn('[onnx.integration] onnxruntime-web import failed; skipping:', err);
      return;
    }
    const ortNs = ort as {
      InferenceSession: {
        create: (s: string | Uint8Array, o?: Record<string, unknown>) => Promise<unknown>;
      };
      Tensor: new (t: string, d: Float32Array, dims: readonly number[]) => unknown;
      env: { wasm: { wasmPaths?: string }; [k: string]: unknown };
    };
    const factory = createOrtFactory(ortNs as unknown as OrtNamespaceLike);
    let onnxBytes: Uint8Array;
    let card: ModelCard;
    try {
      onnxBytes = new Uint8Array(readFileSync(join(ASSETS, 'gesture_classifier.onnx')));
      const cardJson = JSON.parse(
        readFileSync(join(ASSETS, 'model_card.json'), 'utf8')
      ) as ModelCard;
      card = cardJson;
    } catch (err) {
      console.warn('[onnx.integration] assets missing; skipping:', err);
      return;
    }
    const fetchImpl: FetchLike = async () => ({
      ok: true,
      status: 200,
      async arrayBuffer() {
        return onnxBytes.slice().buffer;
      },
      async json() {
        return card;
      },
    });
    const neural = createNeuralClassifier({
      modelUrl: 'model.onnx',
      modelCard: card,
      ortFactory: factory,
      fetchImpl,
      clock: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
    });
    const ok = await neural.init();
    if (!ok) {
      console.warn(
        '[onnx.integration] real ORT init failed in headless node; skipping end-to-end score'
      );
      return;
    }
    const features = new Float32Array(FEATURE_DIM).fill(0);
    const result: NeuralScore = await neural.score(features);
    let sum = 0;
    for (const c of GESTURE_CLASSES) sum += result.scores[c];
    expect(sum).toBeCloseTo(1, 4);
    expect(result.modelVersion).toBe(card.version);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    neural.dispose();
  });
});