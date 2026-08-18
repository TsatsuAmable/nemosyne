/**
 * Raw-trajectory -> 56-dim feature extraction for training.
 *
 * Reuses the runtime extractor from src/features.ts verbatim so training and
 * inference can never drift apart.
 */

import { createReadStream, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { GESTURE_CLASSES, type GestureClass, type HandFrame } from '../src/contracts.ts';
import { extractFeatures } from '../src/features.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, '_output');

interface RawPoint {
  x: number;
  y: number;
  z: number;
  pinched: boolean;
  t: number;
}

interface Instance {
  left: RawPoint[];
  right: RawPoint[];
  label: GestureClass;
}

function toFrames(points: RawPoint[]): HandFrame[] {
  const frames: HandFrame[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    let speed = { x: 0, y: 0, z: 0 };
    if (i > 0) {
      const prev = points[i - 1];
      const dtSec = (p.t - prev.t) / 1000;
      if (dtSec > 0.001) {
        speed = {
          x: (p.x - prev.x) / dtSec,
          y: (p.y - prev.y) / dtSec,
          z: (p.z - prev.z) / dtSec,
        };
      }
    }
    frames.push({ position: { x: p.x, y: p.y, z: p.z }, pinched: p.pinched, timestamp: p.t, speed });
  }
  return frames;
}

async function convert(inputPath: string, outputPath: string): Promise<number> {
  const rl = createInterface({ input: createReadStream(inputPath, 'utf8') });
  const lines: string[] = [];
  for await (const line of rl) {
    if (line.trim().length === 0) continue;
    const inst = JSON.parse(line) as Instance;
    const features = extractFeatures(toFrames(inst.left), toFrames(inst.right));
    if (!features) throw new Error(`feature extraction failed for label ${inst.label}`);
    lines.push(
      JSON.stringify({ features: Array.from(features), label: GESTURE_CLASSES.indexOf(inst.label) })
    );
  }
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, lines.join('\n') + '\n', 'utf8');
  return lines.length;
}

async function main(): Promise<void> {
  const trainCount = await convert(
    join(OUT_DIR, 'raw_train.jsonl'),
    join(OUT_DIR, 'feat_train.jsonl')
  );
  const testCount = await convert(
    join(OUT_DIR, 'raw_test.jsonl'),
    join(OUT_DIR, 'feat_test.jsonl')
  );
  console.info(`converted ${trainCount} train / ${testCount} test feature rows`);
}

void main();
