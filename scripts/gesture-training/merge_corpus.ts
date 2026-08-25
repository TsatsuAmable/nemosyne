/**
 * Merge captured JSONL corpora with the synthetic raw_train/raw_test sets.
 *
 * The pure {@link mergeCorpus} function is the testable core: deterministic,
 * seeded, and side-effect-free. The script `main()` wires it to the filesystem:
 * reads `training/_output/raw_train.jsonl` + `raw_test.jsonl` plus every
 * `captured_*.jsonl` under `--captured-dir`, splits captured 80/20 into train
 * and test, then rewrites the two raw_*.jsonl files with the combined corpora.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GestureClass } from '../../src/gesture/contracts.ts';
import type { RawInstance, RawPoint } from '../../src/gesture/capture.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '_output');

export interface MergeOptions {
  readonly syntheticTrain: readonly RawInstance[];
  readonly syntheticTest: readonly RawInstance[];
  readonly captured: readonly RawInstance[];
  readonly capturedTestFraction?: number;
  readonly seed?: number;
}

export interface MergeResult {
  readonly train: RawInstance[];
  readonly test: RawInstance[];
  readonly capturedUsed: number;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function mergeCorpus(options: MergeOptions): MergeResult {
  const fraction = options.capturedTestFraction ?? 0.2;
  const rng = mulberry32(options.seed ?? 7);
  const shuffled = shuffle([...options.captured], rng);
  const cut = Math.floor(shuffled.length * (1 - fraction));
  const capturedTrain = shuffled.slice(0, cut);
  const capturedTest = shuffled.slice(cut);
  return {
    train: [...options.syntheticTrain, ...capturedTrain],
    test: [...options.syntheticTest, ...capturedTest],
    capturedUsed: shuffled.length,
  };
}

function readJsonl(path: string): RawInstance[] {
  if (!existsSync(path)) return [];
  const text = readFileSync(path, 'utf8');
  const out: RawInstance[] = [];
  for (const line of text.split('\n')) {
    if (line.trim().length === 0) continue;
    const raw = JSON.parse(line) as {
      left: RawPoint[];
      right: RawPoint[];
      label: GestureClass;
    };
    out.push({ left: raw.left, right: raw.right, label: raw.label });
  }
  return out;
}

function writeJsonl(path: string, instances: readonly RawInstance[]): void {
  mkdirSync(dirname(path), { recursive: true });
  const lines = instances.map((inst) => JSON.stringify(inst)).join('\n');
  writeFileSync(path, lines.length > 0 ? lines + '\n' : '', 'utf8');
}

interface ParsedArgs {
  capturedDir: string;
  noSynthetic: boolean;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  let capturedDir = join(OUT, 'captured');
  let noSynthetic = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--captured-dir') capturedDir = argv[++i] ?? capturedDir;
    else if (a.startsWith('--captured-dir=')) capturedDir = a.slice('--captured-dir='.length);
    else if (a === '--no-synthetic') noSynthetic = true;
  }
  return { capturedDir, noSynthetic };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const syntheticTrain = args.noSynthetic ? [] : readJsonl(join(OUT, 'raw_train.jsonl'));
  const syntheticTest = args.noSynthetic ? [] : readJsonl(join(OUT, 'raw_test.jsonl'));
  const capturedFiles = existsSync(args.capturedDir)
    ? readdirSync(args.capturedDir).filter((f) => f.endsWith('.jsonl'))
    : [];
  const captured = capturedFiles.flatMap((f) => readJsonl(join(args.capturedDir, f)));
  const result = mergeCorpus({ syntheticTrain, syntheticTest, captured });
  writeJsonl(join(OUT, 'raw_train.jsonl'), result.train);
  writeJsonl(join(OUT, 'raw_test.jsonl'), result.test);
  console.info(
    `merged: train=${result.train.length} test=${result.test.length} ` +
      `(captured=${result.capturedUsed} from ${capturedFiles.length} file(s))`
  );
}

const invokedAsScript =
  typeof process !== 'undefined' &&
  process.argv[1] !== undefined &&
  process.argv[1].endsWith('merge_corpus.ts');
if (invokedAsScript) void main();