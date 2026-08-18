/**
 * Synthetic labeled trajectory dataset generator (deterministic, seeded).
 *
 * Emits raw 60Hz dual-hand trajectories as JSONL for training/testing the
 * gesture MLP. Kinematics are randomized per instance (scale, jitter, start
 * pose, duration, motion profile); the `idle` class deliberately contains
 * gesture prefixes/tails and drift so it is not trivially separable.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GESTURE_CLASSES, type GestureClass } from '../src/contracts.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, '_output');
const DT_MS = 1000 / 60;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Rng {
  private readonly r: () => number;
  constructor(seed: number) {
    this.r = mulberry32(seed);
  }
  next(): number {
    return this.r();
  }
  range(lo: number, hi: number): number {
    return lo + this.r() * (hi - lo);
  }
  int(lo: number, hi: number): number {
    return Math.floor(this.range(lo, hi + 1));
  }
  gauss(sigma: number): number {
    const u1 = Math.max(this.r(), 1e-9);
    const u2 = this.r();
    return sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
  bool(p = 0.5): boolean {
    return this.r() < p;
  }
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

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

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function easeInOut(rng: Rng): (t: number) => number {
  const kind = rng.int(0, 2);
  if (kind === 0) return smoothstep;
  if (kind === 1) {
    return (t) => Math.pow(t, 1.6);
  }
  return (t) => 1 - Math.pow(1 - t, 1.6);
}

function buildInstance(
  rng: Rng,
  frames: number,
  leftStart: Vec3,
  rightStart: Vec3,
  move: (p: number) => { l: Vec3; r: Vec3; lPinch: boolean; rPinch: boolean },
  label: GestureClass
): Instance {
  const sigma = rng.range(0.005, 0.02);
  const ease = easeInOut(rng);
  const left: RawPoint[] = [];
  const right: RawPoint[] = [];
  for (let i = 0; i < frames; i++) {
    const p = ease(frames > 1 ? i / (frames - 1) : 1);
    const m = move(p);
    left.push({
      x: m.l.x + rng.gauss(sigma),
      y: m.l.y + rng.gauss(sigma),
      z: m.l.z + rng.gauss(sigma),
      pinched: m.lPinch,
      t: Math.round(i * DT_MS),
    });
    right.push({
      x: m.r.x + rng.gauss(sigma),
      y: m.r.y + rng.gauss(sigma),
      z: m.r.z + rng.gauss(sigma),
      pinched: m.rPinch,
      t: Math.round(i * DT_MS),
    });
  }
  return { left, right, label };
}

function startPose(rng: Rng): { left: Vec3; right: Vec3 } {
  const height = rng.range(0.9, 1.6);
  const depth = rng.range(-0.5, -0.1);
  const halfGap = rng.range(0.15, 0.4);
  const lateral = rng.range(-0.1, 0.1);
  return {
    left: { x: lateral - halfGap, y: height, z: depth },
    right: { x: lateral + halfGap, y: height, z: depth },
  };
}

function makeGesture(label: GestureClass, rng: Rng): Instance {
  const frames = rng.int(24, 72);
  const scale = rng.range(0.8, 1.3);
  const { left, right } = startPose(rng);

  switch (label) {
    case 'idle': {
      const variant = rng.int(0, 3);
      if (variant === 0) {
        const drift = rng.range(0, 0.03);
        return buildInstance(rng, frames, left, right, (p) => ({
          l: { x: left.x + drift * p, y: left.y, z: left.z },
          r: { x: right.x - drift * p, y: right.y, z: right.z },
          lPinch: rng.bool(0.1),
          rPinch: rng.bool(0.1),
        }), 'idle');
      }
      if (variant === 1 || variant === 2) {
        const gesture: GestureClass = variant === 1 ? rng.bool() ? 'pinchTogether' : 'scoopUp' : 'pushForward';
        const cut = rng.range(0.3, 0.5);
        const sub = makeGesture(gesture, rng);
        const n = Math.max(5, Math.floor(sub.left.length * cut));
        return { left: sub.left.slice(0, n), right: sub.right.slice(0, n), label: 'idle' };
      }
      const gesture = rng.bool() ? 'pinchApart' : 'scoopUp';
      const sub = makeGesture(gesture, rng);
      const n = Math.max(5, Math.floor(sub.left.length * rng.range(0.5, 0.7)));
      return { left: sub.left.slice(0, n), right: sub.right.slice(0, n), label: 'idle' };
    }
    case 'pinchTogether': {
      const converge = rng.range(0.15, 0.35) * scale;
      const from = rng.range(0.0, 0.3);
      return buildInstance(rng, frames, left, right, (p) => ({
        l: { x: left.x + (converge / 2) * p, y: left.y, z: left.z },
        r: { x: right.x - (converge / 2) * p, y: right.y, z: right.z },
        lPinch: p >= from,
        rPinch: p >= from,
      }), 'pinchTogether');
    }
    case 'pinchApart': {
      const diverge = rng.range(0.15, 0.35) * scale;
      const from = rng.range(0.0, 0.3);
      return buildInstance(rng, frames, left, right, (p) => ({
        l: { x: left.x - (diverge / 2) * p, y: left.y, z: left.z },
        r: { x: right.x + (diverge / 2) * p, y: right.y, z: right.z },
        lPinch: p >= from,
        rPinch: p >= from,
      }), 'pinchApart');
    }
    case 'bothPinched': {
      const wobble = rng.range(0, 0.04);
      return buildInstance(rng, frames, left, right, (p) => ({
        l: { x: left.x + wobble * p, y: left.y, z: left.z },
        r: { x: right.x - wobble * p, y: right.y, z: right.z },
        lPinch: true,
        rPinch: true,
      }), 'bothPinched');
    }
    case 'scoopUp': {
      const rise = rng.range(0.15, 0.45) * scale;
      const lateral = rng.range(-0.08, 0.08);
      const pinchProb = rng.range(0.2, 0.8);
      return buildInstance(rng, frames, left, right, (p) => ({
        l: { x: left.x + lateral * p, y: left.y + rise * p, z: left.z },
        r: { x: right.x - lateral * p, y: right.y + rise * p, z: right.z },
        lPinch: rng.bool(pinchProb),
        rPinch: rng.bool(pinchProb),
      }), 'scoopUp');
    }
    case 'pushForward': {
      const push = rng.range(0.15, 0.4) * scale;
      const lateral = rng.range(-0.08, 0.08);
      const pinchProb = rng.range(0.2, 0.8);
      const dominant = rng.range(0.6, 1.0);
      const retract = rng.bool(0.3);
      return buildInstance(rng, frames, left, right, (p) => {
        const eff = retract ? Math.sin(p * Math.PI) * dominant + (1 - dominant) * p : p;
        return {
          l: { x: left.x + lateral * p, y: left.y, z: left.z - push * eff },
          r: { x: right.x - lateral * p, y: right.y, z: right.z - push * eff },
          lPinch: rng.bool(pinchProb),
          rPinch: rng.bool(pinchProb),
        };
      }, 'pushForward');
    }
    default: {
      return buildInstance(rng, frames, left, right, () => ({
        l: left,
        r: right,
        lPinch: false,
        rPinch: false,
      }), 'idle');
    }
  }
}

function generate(seed: number, perClass: number): Instance[] {
  const rng = new Rng(seed);
  const out: Instance[] = [];
  for (const gesture of GESTURE_CLASSES) {
    for (let i = 0; i < perClass; i++) {
      out.push(makeGesture(gesture, rng));
    }
  }
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function writeJsonl(path: string, instances: Instance[]): void {
  mkdirSync(dirname(path), { recursive: true });
  const lines = instances.map((inst) => JSON.stringify(inst)).join('\n');
  writeFileSync(path, lines + '\n', 'utf8');
}

const train = generate(42, 700);
const test = generate(1337, 150);
writeJsonl(join(OUT_DIR, 'raw_train.jsonl'), train);
writeJsonl(join(OUT_DIR, 'raw_test.jsonl'), test);
console.info(
  `wrote ${train.length} train / ${test.length} test instances to ${OUT_DIR}`
);
