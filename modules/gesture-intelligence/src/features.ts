/**
 * Shared feature extraction — the single numerical substrate consumed by the
 * heuristic classifier, the ONNX neural classifier, and the personalizer
 * replay. Layout is frozen; see SPRINT.md §Feature vector spec.
 */

import {
  FEATURE_DIM,
  FEATURE_WINDOW_FRAMES,
  type HandFrame,
} from './contracts.ts';

export function decimate(values: readonly number[], n: number): number[] {
  if (n <= 0) return [];
  if (values.length === 0) return [];
  if (values.length === 1) return [values[0]];
  if (n === 1) return [values[values.length - 1]];
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.round((i * (values.length - 1)) / (n - 1));
    out.push(values[idx]);
  }
  return out;
}

function decimateFrames(
  frames: readonly HandFrame[],
  n: number
): HandFrame[] {
  if (frames.length <= n) return [...frames];
  const out: HandFrame[] = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.round((i * (frames.length - 1)) / (n - 1));
    out.push(frames[idx]);
  }
  return out;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function handBlock(
  frames: readonly HandFrame[],
  out: Float32Array,
  speedOffset: number,
  dispOffset: number,
  pinchOffset: number
): void {
  const window = frames.length;
  const speeds = frames.map((f) => Math.hypot(f.speed.x, f.speed.y, f.speed.z));
  for (const [i, v] of decimate(speeds, FEATURE_WINDOW_FRAMES).entries()) {
    out[speedOffset + i] = Math.min(v / 2, 1);
  }
  const first = frames[0].position;
  const last = frames[window - 1].position;
  out[dispOffset] = clamp((last.x - first.x) / 0.5, -1, 1);
  out[dispOffset + 1] = clamp((last.y - first.y) / 0.5, -1, 1);
  out[dispOffset + 2] = clamp((last.z - first.z) / 0.5, -1, 1);
  const pinchedCount = frames.reduce((acc, f) => acc + (f.pinched ? 1 : 0), 0);
  out[pinchOffset] = pinchedCount / window;
}

export function extractFeatures(
  left: readonly HandFrame[],
  right: readonly HandFrame[]
): Float32Array | null {
  if (left.length === 0 || right.length === 0) return null;
  const out = new Float32Array(FEATURE_DIM);
  const leftWin = decimateFrames(left, FEATURE_WINDOW_FRAMES);
  const rightWin = decimateFrames(right, FEATURE_WINDOW_FRAMES);
  handBlock(leftWin, out, 0, 16, 19);
  handBlock(rightWin, out, 20, 36, 39);
  const dists: number[] = [];
  const n = Math.min(leftWin.length, rightWin.length);
  for (let i = 0; i < n; i++) {
    const a = leftWin[i].position;
    const b = rightWin[i].position;
    dists.push(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z));
  }
  const series = decimate(dists.length > 0 ? dists : [0], FEATURE_WINDOW_FRAMES);
  for (const [i, v] of series.entries()) {
    out[40 + i] = Math.min(v / 1.0, 1);
  }
  return out;
}
