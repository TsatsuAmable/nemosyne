/**
 * Demo: canvas dual-hand simulator wired to the live gesture engine.
 *
 * Shows honest provenance (source / modelVersion / latencyMs / degradedReason),
 * a calibration readout, feedback buttons feeding the personalizer, and a
 * capture UI that emits raw JSONL in the exact schema `extract_features.ts`
 * consumes — closing the capture→train→deploy loop.
 */

import * as ort from 'onnxruntime-web';
import modelUrl from '../assets/gesture_classifier.onnx?url';
import modelCardJson from '../assets/model_card.json';
import {
  createGestureEngine,
  createPersonalizer,
  createPersistence,
  type GestureClass,
  type GestureEngine,
  type HandSample,
  type ModelCard,
  type Vec3,
} from '../src/index.ts';
import { createNeuralClassifier, createOrtFactory, type OrtNamespaceLike } from '../src/onnx.ts';
import { CaptureRecorder, serializeRawJsonl, type RawInstance } from '../src/capture.ts';

const modelCard = modelCardJson as unknown as ModelCard;

ort.env.wasm.wasmPaths = '/ort-wasm/';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

interface HandState {
  pos: Vec3;
  pinched: boolean;
  color: string;
  screen: { x: number; y: number };
  dragging: boolean;
}

const hands: Record<'left' | 'right', HandState> = {
  left: {
    pos: { x: -0.2, y: 1.2, z: -0.3 },
    pinched: false,
    color: '#60a5fa',
    screen: { x: 0, y: 0 },
    dragging: false,
  },
  right: {
    pos: { x: 0.2, y: 1.2, z: -0.3 },
    pinched: false,
    color: '#f472b6',
    screen: { x: 0, y: 0 },
    dragging: false,
  },
};

function resizeCanvas(): void {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  projectHands();
}

const SCENE = { minX: -0.6, maxX: 0.6, minY: 0.7, maxY: 1.8 };

function worldToScreen(p: Vec3): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  const sx = ((p.x - SCENE.minX) / (SCENE.maxX - SCENE.minX)) * w;
  const sy = h - ((p.y - SCENE.minY) / (SCENE.maxY - SCENE.minY)) * h;
  return { x: sx, y: sy };
}

function screenToWorld(sx: number, sy: number): Vec3 {
  const rect = canvas.getBoundingClientRect();
  const x = SCENE.minX + (sx / rect.width) * (SCENE.maxX - SCENE.minX);
  const y = SCENE.minY + ((rect.height - sy) / rect.height) * (SCENE.maxY - SCENE.minY);
  return { x, y, z: -0.3 };
}

function projectHands(): void {
  hands.left.screen = worldToScreen(hands.left.pos);
  hands.right.screen = worldToScreen(hands.right.pos);
}

function draw(): void {
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.strokeStyle = '#2a3342';
  ctx.lineWidth = 1;
  for (const hand of [hands.left, hands.right]) {
    ctx.beginPath();
    ctx.fillStyle = hand.pinched ? hand.color : '#1f2733';
    ctx.strokeStyle = hand.color;
    ctx.lineWidth = 2;
    ctx.arc(hand.screen.x, hand.screen.y, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(hands.left.screen.x, hands.left.screen.y);
  ctx.lineTo(hands.right.screen.x, hands.right.screen.y);
  ctx.strokeStyle = '#33415a';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function pointerPos(ev: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
}

function nearestHand(x: number, y: number): 'left' | 'right' | null {
  let best: 'left' | 'right' | null = null;
  let bestDist = 36 * 36;
  for (const k of ['left', 'right'] as const) {
    const dx = hands[k].screen.x - x;
    const dy = hands[k].screen.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestDist) {
      bestDist = d;
      best = k;
    }
  }
  return best;
}

canvas.addEventListener('pointerdown', (ev) => {
  const p = pointerPos(ev);
  const k = nearestHand(p.x, p.y);
  if (k) {
    hands[k].dragging = true;
    canvas.setPointerCapture(ev.pointerId);
  }
});
canvas.addEventListener('pointermove', (ev) => {
  const p = pointerPos(ev);
  for (const k of ['left', 'right'] as const) {
    if (hands[k].dragging) {
      hands[k].pos = screenToWorld(p.x, p.y);
      projectHands();
    }
  }
});
canvas.addEventListener('pointerup', (ev) => {
  hands.left.dragging = false;
  hands.right.dragging = false;
  try {
    canvas.releasePointerCapture(ev.pointerId);
  } catch {
    /* ignore */
  }
});

function holdPinch(buttonId: string, which: 'left' | 'right'): void {
  const btn = document.getElementById(buttonId) as HTMLButtonElement;
  const set = (v: boolean): void => {
    hands[which].pinched = v;
    btn.classList.toggle('active', v);
  };
  btn.addEventListener('pointerdown', () => set(true));
  btn.addEventListener('pointerup', () => set(false));
  btn.addEventListener('pointerleave', () => set(false));
}
holdPinch('pinch-left', 'left');
holdPinch('pinch-right', 'right');

function animatePreset(target: { left: Vec3; right: Vec3; lPinch: boolean; rPinch: boolean }, ms = 900): void {
  const startL = { ...hands.left.pos };
  const startR = { ...hands.right.pos };
  const startLP = hands.left.pinched;
  const startRP = hands.right.pinched;
  const t0 = performance.now();
  function step(now: number): void {
    const t = Math.min(1, (now - t0) / ms);
    const e = t * t * (3 - 2 * t);
    hands.left.pos = {
      x: startL.x + (target.left.x - startL.x) * e,
      y: startL.y + (target.left.y - startL.y) * e,
      z: startL.z + (target.left.z - startL.z) * e,
    };
    hands.right.pos = {
      x: startR.x + (target.right.x - startR.x) * e,
      y: startR.y + (target.right.y - startR.y) * e,
      z: startR.z + (target.right.z - startR.z) * e,
    };
    hands.left.pinched = t > 0.4 ? target.lPinch : startLP;
    hands.right.pinched = t > 0.4 ? target.rPinch : startRP;
    projectHands();
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

document.getElementById('preset-idle')?.addEventListener('click', () =>
  animatePreset({
    left: { x: -0.2, y: 1.2, z: -0.3 },
    right: { x: 0.2, y: 1.2, z: -0.3 },
    lPinch: false,
    rPinch: false,
  })
);
document.getElementById('preset-scoop')?.addEventListener('click', () =>
  animatePreset({
    left: { x: -0.2, y: 1.55, z: -0.3 },
    right: { x: 0.2, y: 1.55, z: -0.3 },
    lPinch: false,
    rPinch: false,
  })
);
document.getElementById('preset-push')?.addEventListener('click', () =>
  animatePreset({
    left: { x: -0.2, y: 1.2, z: -0.55 },
    right: { x: 0.2, y: 1.2, z: -0.55 },
    lPinch: false,
    rPinch: false,
  })
);
document.getElementById('preset-pinch-t')?.addEventListener('click', () =>
  animatePreset({
    left: { x: -0.05, y: 1.2, z: -0.3 },
    right: { x: 0.05, y: 1.2, z: -0.3 },
    lPinch: true,
    rPinch: true,
  })
);

const recorder = new CaptureRecorder();
const capturedInstances: RawInstance[] = [];

const captureLabel = document.getElementById('capture-label') as HTMLSelectElement;
const captureStatus = document.getElementById('capture-status') as HTMLElement;
document.getElementById('capture-arm')?.addEventListener('click', () => {
  const label = captureLabel.value as GestureClass;
  recorder.arm(label);
  captureStatus.textContent = `armed: ${label} — perform the gesture, then Stop & Save`;
});
document.getElementById('capture-stop')?.addEventListener('click', () => {
  const inst = recorder.stop();
  if (!inst) {
    captureStatus.textContent = 'no complete capture (need both hands)';
    return;
  }
  capturedInstances.push(inst);
  captureStatus.textContent = `captured ${capturedInstances.length} instance(s), last label=${inst.label}`;
});
document.getElementById('capture-download')?.addEventListener('click', () => {
  if (capturedInstances.length === 0) {
    captureStatus.textContent = 'nothing to download yet';
    return;
  }
  const text = serializeRawJsonl(capturedInstances);
  const blob = new Blob([text], { type: 'application/jsonl' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `captured_${Date.now()}.jsonl`;
  a.click();
  URL.revokeObjectURL(url);
  captureStatus.textContent = `downloaded ${capturedInstances.length} instance(s)`;
});
const captureFile = document.getElementById('capture-file') as HTMLInputElement;
const captureFileStatus = document.getElementById('capture-file-status') as HTMLElement;
captureFile.addEventListener('change', () => {
  const file = captureFile.files?.[0];
  if (!file) return;
  void file.text().then((text) => {
    const lines = text.split('\n').filter((l) => l.trim().length > 0);
    let ok = 0;
    const labels: Record<string, number> = {};
    for (const line of lines) {
      try {
        const row = JSON.parse(line) as { label: string };
        labels[row.label] = (labels[row.label] ?? 0) + 1;
        ok += 1;
      } catch {
        /* skip malformed */
      }
    }
    captureFileStatus.textContent = `loaded ${ok} rows: ${JSON.stringify(labels)}`;
  });
});

const personalizer = createPersonalizer();
const neural = createNeuralClassifier({
  modelUrl,
  modelCard,
  ortFactory: createOrtFactory(ort as unknown as OrtNamespaceLike),
});
const engine: GestureEngine = createGestureEngine({
  neural,
  personalizer,
  persistence: createPersistence(),
});

const hudGesture = document.getElementById('hud-gesture') as HTMLElement;
const hudConfidence = document.getElementById('hud-confidence') as HTMLElement;
const hudSource = document.getElementById('hud-source') as HTMLElement;
const hudVersion = document.getElementById('hud-version') as HTMLElement;
const hudLatency = document.getElementById('hud-latency') as HTMLElement;
const hudDegraded = document.getElementById('hud-degraded') as HTMLElement;
const hudSamples = document.getElementById('hud-samples') as HTMLElement;
const fbStats = document.getElementById('fb-stats') as HTMLElement;
const calReadout = document.getElementById('cal-readout') as HTMLElement;
const engineStatus = document.getElementById('engine-status') as HTMLElement;

let lastGesture: GestureClass = 'idle';
let lastResult = null as null | { gesture: GestureClass; confidence: number; provenance: { source: string; modelVersion: string | null; latencyMs: number; sampleCount: number; windowMs: number; degradedReason: string | null } };

function renderHud(): void {
  if (!lastResult) return;
  hudGesture.textContent = lastResult.gesture;
  hudConfidence.textContent = `conf ${lastResult.confidence.toFixed(2)}`;
  hudSource.textContent = `source: ${lastResult.provenance.source}`;
  hudVersion.textContent = `version: ${lastResult.provenance.modelVersion ?? '—'}`;
  hudLatency.textContent = `latency: ${lastResult.provenance.latencyMs.toFixed(1)}ms`;
  hudDegraded.textContent = `degraded: ${lastResult.provenance.degradedReason ?? 'none'}`;
  hudSamples.textContent = `samples: ${lastResult.provenance.sampleCount} / window ${lastResult.provenance.windowMs.toFixed(0)}ms`;
  const s = personalizer.stats();
  fbStats.textContent = `confirms ${s.confirms} / corrections ${s.corrections}`;
  const c = engine.getCalibration();
  calReadout.textContent = `move ${c.moveThreshold.toFixed(3)} · pinch ${c.pinchThreshold.toFixed(2)} · release ${c.releaseThreshold.toFixed(2)} · speedEma ${c.meanSpeedEma.toFixed(2)}`;
}

document.getElementById('fb-confirm')?.addEventListener('click', () => {
  engine.reportFeedback(lastGesture, true);
  renderHud();
});
document.getElementById('fb-correct')?.addEventListener('click', () => {
  engine.reportFeedback(lastGesture, false);
  renderHud();
});

function renderStatus(): void {
  const st = engine.status();
  engineStatus.textContent = JSON.stringify(st, null, 2);
}

let neuralBusy = false;
let lastNeuralFrame = 0;
const NEURAL_DEBOUNCE_MS = 150;

function tick(now: number): void {
  const ts = now;
  const leftSample: HandSample = {
    hand: 'left',
    position: hands.left.pos,
    pinched: hands.left.pinched,
    timestamp: ts,
  };
  const rightSample: HandSample = {
    hand: 'right',
    position: hands.right.pos,
    pinched: hands.right.pinched,
    timestamp: ts,
  };
  engine.recordSample(leftSample);
  engine.recordSample(rightSample);
  if (recorder.isArmed()) {
    recorder.record(leftSample);
    recorder.record(rightSample);
  }
  const sync = engine.classify();
  lastGesture = sync.gesture;
  lastResult = {
    gesture: sync.gesture,
    confidence: sync.confidence,
    provenance: {
      source: sync.provenance.source,
      modelVersion: sync.provenance.modelVersion,
      latencyMs: sync.provenance.latencyMs,
      sampleCount: sync.provenance.sampleCount,
      windowMs: sync.provenance.windowMs,
      degradedReason: sync.provenance.degradedReason,
    },
  };
  if (!neuralBusy && now - lastNeuralFrame >= NEURAL_DEBOUNCE_MS) {
    lastNeuralFrame = now;
    neuralBusy = true;
    void engine
      .classifyWithNeural()
      .then((r) => {
        if (r.provenance.source === 'onnx') {
          lastGesture = r.gesture;
          lastResult = {
            gesture: r.gesture,
            confidence: r.confidence,
            provenance: {
              source: r.provenance.source,
              modelVersion: r.provenance.modelVersion,
              latencyMs: r.provenance.latencyMs,
              sampleCount: r.provenance.sampleCount,
              windowMs: r.provenance.windowMs,
              degradedReason: r.provenance.degradedReason,
            },
          };
        }
      })
      .catch(() => {
        /* heuristic fallback already reflected by sync classify */
      })
      .finally(() => {
        neuralBusy = false;
      });
  }
  draw();
  renderHud();
  renderStatus();
  requestAnimationFrame(tick);
}

window.addEventListener('resize', resizeCanvas);

void (async () => {
  resizeCanvas();
  const status = await engine.init();
  engineStatus.textContent = JSON.stringify(status, null, 2);
  if (status.runtime === 'heuristic') {
    hudDegraded.textContent = 'degraded: neural unavailable (running heuristic)';
  }
  requestAnimationFrame(tick);
})();