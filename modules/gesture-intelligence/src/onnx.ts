/**
 * ONNX-backed neural classifier for @nemosyne/gesture-intelligence.
 *
 * Implements {@link NeuralClassifierPort} over an injected {@link OrtFactoryLike}
 * so the runtime never hard-depends on onnxruntime-web: absent a factory the
 * engine degrades to the heuristic with an explicit `degradedReason`.
 *
 * Honesty guarantees baked into `init()`:
 * - Model bytes are fetched as a Uint8Array and sha256-verified against the
 *   ModelCard BEFORE the inference session is created — a hash mismatch never
 *   reaches the runtime.
 * - The card's `featureDim`, `classes` (order + identity), and input/output
 *   tensor names are validated against the frozen contract; a mismatch fails
 *   init with an explicit reason rather than silently producing garbage.
 * - `score()` measures real wall-clock latency around `session.run` only —
 *   not feature extraction, not fetch — and reports it verbatim.
 */

import {
  FEATURE_DIM,
  GESTURE_CLASSES,
  type GestureClass,
  type ModelCard,
  type NeuralClassifierPort,
  type NeuralScore,
  type OrtFactoryLike,
  type OrtSessionLike,
  type OrtTensorLike,
  type ScoreTable,
} from './contracts.ts';

interface OrtTensorInternal {
  readonly data: Float32Array;
  readonly dims: readonly number[];
}

interface OrtSessionInternal {
  run(inputs: Record<string, OrtTensorInternal>): Promise<Record<string, OrtTensorInternal>>;
  release(): void;
}

export interface OrtNamespaceLike {
  readonly InferenceSession: {
    create(
      source: string | Uint8Array,
      options?: { readonly executionProviders?: readonly string[]; readonly [key: string]: unknown }
    ): Promise<OrtSessionInternal>;
  };
  readonly Tensor: new (
    type: 'float32',
    data: Float32Array,
    dims: readonly number[]
  ) => OrtTensorInternal;
}

/**
 * Wraps an onnxruntime-web-shaped namespace as a contract-conforming
 * {@link OrtFactoryLike}. Only the `wasm` execution provider is requested
 * (`webgl` is deprecated upstream and avoids GPU-context fragility).
 */
export function createOrtFactory(ort: OrtNamespaceLike): OrtFactoryLike {
  return {
    async createSession(source: string | Uint8Array): Promise<OrtSessionLike> {
      const session = await ort.InferenceSession.create(source, {
        executionProviders: ['wasm'],
      });
      return {
        async run(inputs: Record<string, OrtTensorLike>): Promise<Record<string, OrtTensorLike>> {
          const ortInputs: Record<string, OrtTensorInternal> = {};
          for (const [name, t] of Object.entries(inputs)) {
            ortInputs[name] = new ort.Tensor('float32', t.data, t.dims);
          }
          const out = await session.run(ortInputs);
          const result: Record<string, OrtTensorLike> = {};
          for (const [name, t] of Object.entries(out)) {
            result[name] = { data: t.data, dims: t.dims };
          }
          return result;
        },
        release: () => session.release(),
      };
    },
  };
}

export interface NeuralClassifierOptions {
  /** URL of the `.onnx` model bytes; fetched as a Uint8Array for sha256 verification. */
  readonly modelUrl: string;
  /** Preloaded model card (skips the card fetch). */
  readonly modelCard?: ModelCard;
  /** URL of the model card JSON, used when `modelCard` is not supplied. */
  readonly modelCardUrl?: string;
  /** Injected ORT factory; required — no factory means no neural path. */
  readonly ortFactory: OrtFactoryLike;
  /** Fetch implementation (tests inject fakes; production uses global fetch). */
  readonly fetchImpl?: FetchLike;
  /** Clock used for latency measurement. */
  readonly clock?: () => number;
}

export interface FetchLike {
  (url: string): Promise<ResponseLike>;
}

export interface ResponseLike {
  readonly ok: boolean;
  readonly status: number;
  arrayBuffer(): Promise<ArrayBuffer>;
  json(): Promise<unknown>;
}

const defaultFetch: FetchLike = (url) => fetch(url);

function defaultClock(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('crypto.subtle unavailable; cannot verify model hash');
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await subtle.digest('SHA-256', copy);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function validateCard(card: ModelCard): void {
  if (card.featureDim !== FEATURE_DIM) {
    throw new Error(`model card featureDim=${card.featureDim} != contract FEATURE_DIM=${FEATURE_DIM}`);
  }
  if (card.classes.length !== GESTURE_CLASSES.length) {
    throw new Error(`model card classes length=${card.classes.length} != ${GESTURE_CLASSES.length}`);
  }
  for (const [i, c] of card.classes.entries()) {
    if (c !== GESTURE_CLASSES[i]) {
      throw new Error(`model card class[${i}]='${c}' != contract '${GESTURE_CLASSES[i]}'`);
    }
  }
  if (!card.inputName || !card.outputName) {
    throw new Error('model card inputName/outputName missing');
  }
  if (card.sha256.length !== 64) {
    throw new Error(`model card sha256 malformed (len=${card.sha256.length})`);
  }
}

/**
 * Creates a {@link NeuralClassifierPort} over an injected {@link OrtFactoryLike}.
 * `init()` is idempotent-ish: a failed init resets to not-ready and can be retried.
 */
export function createNeuralClassifier(options: NeuralClassifierOptions): NeuralClassifierPort {
  const fetchImpl = options.fetchImpl ?? defaultFetch;
  const clock = options.clock ?? defaultClock;
  let ready = false;
  let modelVersion: string | null = null;
  let card: ModelCard | null = null;
  let session: OrtSessionLike | null = null;

  async function loadCard(): Promise<ModelCard> {
    if (options.modelCard) return options.modelCard;
    if (!options.modelCardUrl) {
      throw new Error('neural init requires modelCard or modelCardUrl');
    }
    const res = await fetchImpl(options.modelCardUrl);
    if (!res.ok) throw new Error(`model card fetch failed: ${res.status}`);
    return (await res.json()) as ModelCard;
  }

  async function loadModelBytes(): Promise<Uint8Array> {
    const res = await fetchImpl(options.modelUrl);
    if (!res.ok) throw new Error(`model fetch failed: ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  }

  async function init(): Promise<boolean> {
    try {
      const loadedCard = await loadCard();
      validateCard(loadedCard);
      const bytes = await loadModelBytes();
      const hash = await sha256Hex(bytes);
      if (hash !== loadedCard.sha256) {
        throw new Error(`sha256 mismatch: file=${hash} card=${loadedCard.sha256}`);
      }
      session = await options.ortFactory.createSession(bytes);
      card = loadedCard;
      modelVersion = loadedCard.version;
      ready = true;
      return true;
    } catch (err) {
      console.warn('[gesture-neural] init failed:', err);
      ready = false;
      session = null;
      card = null;
      modelVersion = null;
      return false;
    }
  }

  async function score(features: Float32Array): Promise<NeuralScore> {
    if (!ready || !session || !card) throw new Error('neural classifier not ready');
    if (features.length !== FEATURE_DIM) {
      throw new Error(`feature length=${features.length} != FEATURE_DIM=${FEATURE_DIM}`);
    }
    const inputs: Record<string, OrtTensorLike> = {
      [card.inputName]: { data: features, dims: [1, FEATURE_DIM] },
    };
    const t0 = clock();
    const out = await session.run(inputs);
    const latencyMs = clock() - t0;
    const outTensor = out[card.outputName];
    if (!outTensor) throw new Error(`output '${card.outputName}' missing from session run`);
    const probs = outTensor.data;
    if (probs.length < GESTURE_CLASSES.length) {
      throw new Error(`output length=${probs.length} < ${GESTURE_CLASSES.length}`);
    }
    const table: Record<GestureClass, number> = {
      idle: 0,
      pinchTogether: 0,
      pinchApart: 0,
      scoopUp: 0,
      pushForward: 0,
      bothPinched: 0,
    };
    for (const [i, c] of GESTURE_CLASSES.entries()) {
      table[c] = probs[i] ?? 0;
    }
    return {
      scores: table as ScoreTable,
      latencyMs,
      modelVersion: modelVersion ?? '',
    };
  }

  function dispose(): void {
    if (session) {
      try {
        session.release();
      } catch (err) {
        console.warn('[gesture-neural] release failed:', err);
      }
    }
    session = null;
    card = null;
    modelVersion = null;
    ready = false;
  }

  return {
    get ready(): boolean {
      return ready;
    },
    get modelVersion(): string | null {
      return modelVersion;
    },
    init,
    score,
    dispose,
  };
}