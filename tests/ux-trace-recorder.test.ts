// @ts-nocheck
/**
 * UXTraceRecorder tests: context sampling, head-gaze raycast targets,
 * pointer drift, event stamping (pinch/selection/system/wheel/gesture),
 * tour-change detection, buffered flushing, and endpoint-missing disable.
 */

import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { UXTraceRecorder, type UXTraceRecorderOptions } from '../src/vr/trace/UXTraceRecorder.ts';
import type { HandLike, PanelLike } from '../src/vr/coordinators/types.ts';

class MockHand implements HandLike {
  index: number;
  handedness: string;
  pinched = false;
  pinchDistance = Infinity;
  pinchThreshold = 0.04;
  jointsValid = true;
  rayOrigin = new THREE.Vector3(0.5, 1.2, 0);
  isPinched(): boolean {
    return this.pinched;
  }
  isPoseValid(): boolean {
    return this.jointsValid;
  }
  constructor(index: number, handedness: string) {
    this.index = index;
    this.handedness = handedness;
  }
}

interface MockEngineOptions {
  panels?: PanelLike[];
  interactables?: Array<{ mesh: THREE.Object3D; data?: unknown }>;
  gazeTargets?: THREE.Object3D[];
  pointerRay?: THREE.Ray | null;
}

function makeMockEngine(options: MockEngineOptions = {}) {
  const camera = new THREE.PerspectiveCamera();
  const updatables: unknown[] = [];
  const engine = {
    camera,
    headWorldPos: new THREE.Vector3(0, 1.7, 0),
    addUpdatable: (obj: unknown) => updatables.push(obj),
    removeUpdatable: (obj: unknown) => {
      const i = updatables.indexOf(obj);
      if (i >= 0) updatables.splice(i, 1);
    },
    input: {
      hands: [] as HandLike[],
      panels: options.panels ?? [],
      interactables: options.interactables ?? [],
      pointers: {
        getBestPointerRay: () => options.pointerRay ?? null,
      },
    },
  };
  return { engine, updatables, camera };
}

function makeRecorder(
  overrides: Partial<UXTraceRecorderOptions> = {},
  engineOptions: MockEngineOptions = {}
) {
  const { engine, updatables } = makeMockEngine(engineOptions);
  const fetchImpl = vi.fn(() => Promise.resolve({ ok: true, status: 200 }));
  const recorder = new UXTraceRecorder({
    engine,
    fetchImpl,
    sampleHz: 5,
    flushMs: 1000,
    ...overrides,
  });
  const update = (time: number) => {
    for (const u of updatables) {
      (u as { update: (d: number, t: number) => void }).update(0.016, time);
    }
  };
  return { recorder, fetchImpl, update, engine };
}

describe('UXTraceRecorder', () => {
  it('emits a meta record once hands appear and samples context at sampleHz', () => {
    const { recorder, update } = makeRecorder();
    (recorder as unknown as { _engine: { input: { hands: HandLike[] } } })._engine.input.hands.push(
      new MockHand(0, 'right')
    );

    update(0);
    update(0.2);
    update(0.4);
    update(0.41);

    const buffer = (recorder as unknown as { _buffer: Array<{ type: string; t: number }> })._buffer;
    const meta = buffer.find((r) => r.type === 'meta');
    expect(meta).toBeDefined();

    const contexts = buffer.filter((r) => r.type === 'context');
    expect(contexts.length).toBeGreaterThanOrEqual(2);
    expect(contexts.length).toBeLessThanOrEqual(3);
  });

  it('survives sprite interactables (regression: raycaster.camera must be set) and null meshes', () => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial());
    sprite.position.set(0, 0, -1);
    const { recorder, update, fetchImpl } = makeRecorder(
      {},
      {
        interactables: [
          { mesh: sprite, data: { label: 'label-sprite' } },
          { mesh: null as unknown as THREE.Object3D },
        ],
      }
    );
    (recorder as unknown as { _engine: { input: { hands: HandLike[] } } })._engine.input.hands.push(
      new MockHand(0, 'right')
    );

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      for (let i = 0; i < 15; i++) update(i * 0.1);
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }

    expect(recorder.disabled).toBe(false);
    const buffer = (recorder as unknown as { _buffer: Array<{ type: string }> })._buffer;
    const contexts = buffer.filter((r) => r.type === 'context');
    expect(contexts.length).toBeGreaterThanOrEqual(2);
    expect(fetchImpl).toHaveBeenCalled();
  });

  it('stamps pinch events with hand state, gating and context', () => {
    const hand = new MockHand(1, 'left');
    hand.pinchDistance = 0.031;
    const { recorder, update } = makeRecorder();
    update(0.1);
    recorder.recordPinch(hand, 'start', 'wheel-toggle');

    const buffer = (recorder as unknown as { _buffer: Array<Record<string, unknown>> })._buffer;
    const pinch = buffer.find((r) => r.type === 'pinch') as Record<string, unknown>;
    expect(pinch).toBeDefined();
    expect(pinch.hand).toBe('left');
    expect(pinch.gating).toBe('wheel-toggle');
    expect(pinch.d).toBeCloseTo(0.031, 3);
    expect(pinch.ctx).toBeDefined();
    expect(pinch.t).toBeCloseTo(0.1, 2);
  });

  it('classifies selection dispatches as hud/scene/callback-only/none', () => {
    const { recorder, update } = makeRecorder();
    update(0.05);

    const mesh = new THREE.Mesh();
    recorder.recordSelection({
      hudConsumed: false,
      sceneMesh: mesh,
      sceneData: { label: 'node-42' },
      hadCallback: true,
      pointer: null,
    });
    recorder.recordSelection({
      hudConsumed: true,
      sceneMesh: null,
      hadCallback: false,
      pointer: null,
    });
    recorder.recordSelection({
      hudConsumed: false,
      sceneMesh: null,
      hadCallback: false,
      pointer: null,
    });

    const buffer = (recorder as unknown as { _buffer: Array<Record<string, unknown>> })._buffer;
    const selections = buffer.filter((r) => r.type === 'selection');
    expect(selections.map((s) => s.hit)).toEqual(['scene', 'hud', 'none']);
    expect(String(selections[0].target)).toContain('node-42');
    // Legacy infos without rayValid map to null; explicit values pass through.
    expect(selections.map((s) => s.rayValid)).toEqual([null, null, null]);

    recorder.recordSelection({
      hudConsumed: false,
      sceneMesh: null,
      hadCallback: false,
      pointer: null,
      rayValid: false,
    });
    recorder.recordSelection({
      hudConsumed: false,
      sceneMesh: null,
      hadCallback: false,
      pointer: null,
      rayValid: true,
    });
    const tails = (recorder as unknown as { _buffer: Array<Record<string, unknown>> })._buffer
      .filter((r) => r.type === 'selection')
      .slice(-2);
    expect(tails.map((s) => s.hit)).toEqual(['none', 'none']);
    expect(tails.map((s) => s.rayValid)).toEqual([false, true]);
  });

  it('raycasts head gaze against panels and interactables and prefers data labels', () => {
    const panelMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1));
    panelMesh.position.set(0, 0, -2);
    panelMesh.updateMatrixWorld();
    const panel: PanelLike = { mesh: panelMesh, title: 'GUIDED TOUR' };

    const nodeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2));
    nodeMesh.position.set(0.4, 0, -1.5);
    nodeMesh.updateMatrixWorld();

    const { recorder, update } = makeRecorder(
      {},
      {
        panels: [panel],
        interactables: [{ mesh: nodeMesh, data: { label: 'Q3-revenue' } }],
      }
    );
    update(0);

    const buffer = (recorder as unknown as { _buffer: Array<Record<string, unknown>> })._buffer;
    const ctx = buffer.find((r) => r.type === 'context')?.ctx as {
      gaze: { target: string | null; kind: string | null; dist: number | null };
    };
    // Default camera looks down -Z: panel (2m) is dead ahead, node (1.5m) is off-axis.
    expect(ctx.gaze.target).toBe('GUIDED TOUR');
    expect(ctx.gaze.kind).toBe('panel');
    expect(ctx.gaze.dist).toBeCloseTo(2, 1);
  });

  it('computes drift between head gaze and pointer ray', () => {
    // Pointer ray 90 degrees off the camera forward (-Z): expect ~90 deg drift.
    const pointerRay = new THREE.Ray(new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(1, 0, 0));
    const { recorder, update } = makeRecorder({}, { pointerRay });
    update(0);

    const buffer = (recorder as unknown as { _buffer: Array<Record<string, unknown>> })._buffer;
    const ctx = buffer.find((r) => r.type === 'context')?.ctx as {
      ptr: { driftDeg: number | null };
    };
    expect(ctx.ptr.driftDeg).toBeGreaterThan(85);
    expect(ctx.ptr.driftDeg).toBeLessThan(95);
  });

  it('records system gestures and wheel visibility changes with context', () => {
    const { recorder, update } = makeRecorder();
    update(0.05);
    recorder.recordSystemGesture({ kind: 'both-pinch-suppressed', y0: 1.2, y1: 1.7 });
    recorder.recordWheel(true, 'toggle');

    const buffer = (recorder as unknown as { _buffer: Array<Record<string, unknown>> })._buffer;
    const system = buffer.find((r) => r.type === 'system') as Record<string, unknown>;
    const wheel = buffer.find((r) => r.type === 'wheel') as Record<string, unknown>;
    expect(system.kind).toBe('both-pinch-suppressed');
    expect(system.y1).toBe(1.7);
    expect(wheel.state).toBe('open');
    expect(wheel.via).toBe('toggle');
  });

  it('records gestures from the event bus', () => {
    const handlers: Record<string, (payload?: unknown) => void> = {};
    const eventBus = {
      on: (topic: string, handler: (payload?: unknown) => void) => {
        handlers[topic] = handler;
        return () => delete handlers[topic];
      },
    };
    const { recorder, update } = makeRecorder({ eventBus });
    update(0.05);
    handlers['gesture:recognized']({ name: 'scoopUp', ctx: { confidence: 0.9, source: 'hand' } });

    const buffer = (recorder as unknown as { _buffer: Array<Record<string, unknown>> })._buffer;
    const gesture = buffer.find((r) => r.type === 'gesture') as Record<string, unknown>;
    expect(gesture.name).toBe('scoopUp');
    expect(gesture.confidence).toBeCloseTo(0.9, 2);
    expect(gesture.source).toBe('hand');
  });

  it('emits a tour event when the UI-state tour key changes but not on the first frame', () => {
    let tourState: Record<string, unknown> = { active: true, step: 0, total: 5 };
    const { recorder, update } = makeRecorder({
      getUIState: () => ({ tour: tourState }),
    });
    update(0);
    update(0.1);
    tourState = { active: true, step: 1, total: 5 };
    update(0.2);

    const buffer = (recorder as unknown as { _buffer: Array<Record<string, unknown>> })._buffer;
    const tours = buffer.filter((r) => r.type === 'tour');
    expect(tours.length).toBe(1);
    expect(tours[0].step).toBe(1);
  });

  it('flushes buffered records as a batch and disables on 404', async () => {
    const { recorder, fetchImpl, update } = makeRecorder();
    update(1.1);
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled());

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      { method: string; body: string },
    ];
    expect(url).toBe('/__ux-trace');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body) as { sid: string; records: unknown[] };
    expect(body.sid).toBe(recorder.sessionId);
    expect(body.records.length).toBeGreaterThan(0);

    fetchImpl.mockImplementation(() => Promise.resolve({ ok: false, status: 404 }));
    update(2.5);
    await vi.waitFor(() => expect(recorder.disabled).toBe(true));

    const callsAfterDisable = fetchImpl.mock.calls.length;
    update(4);
    update(6);
    expect(fetchImpl.mock.calls.length).toBe(callsAfterDisable);
  });

  it('requeues records on network failure and caps the buffer', async () => {
    const { recorder, fetchImpl, update } = makeRecorder({ flushMs: 500 });
    fetchImpl.mockImplementation(() => Promise.reject(new Error('offline')));
    update(0);
    update(0.6);
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 10));

    const buffer = (recorder as unknown as { _buffer: unknown[] })._buffer;
    expect(buffer.length).toBeGreaterThan(0);
    expect(recorder.disabled).toBe(false);
  });

  it('dispose unsubscribes from the event bus and stops sampling', () => {
    const handlers: Record<string, (payload?: unknown) => void> = {};
    const eventBus = {
      on: (topic: string, handler: (payload?: unknown) => void) => {
        handlers[topic] = handler;
        return () => delete handlers[topic];
      },
    };
    const { recorder, update } = makeRecorder({ eventBus });
    update(0);
    recorder.dispose();
    update(1.5);

    const buffer = (recorder as unknown as { _buffer: unknown[] })._buffer;
    const before = buffer.length;
    handlers['gesture:recognized']?.({ name: 'scoopUp' });
    update(3);
    expect(buffer.length).toBe(before);
  });
});

describe('UXTraceRecorder feature-flag gating (prodTraceEnabled)', () => {
  function bufferOf(recorder: UXTraceRecorder): Array<Record<string, unknown>> {
    return (recorder as unknown as { _buffer: Array<Record<string, unknown>> })._buffer;
  }

  it('starts disabled with enabled:false and records nothing until setEnabled(true)', async () => {
    const { recorder, fetchImpl, update } = makeRecorder({ enabled: false });
    expect(recorder.enabled).toBe(false);
    update(0.2);
    update(0.5);
    expect(bufferOf(recorder).length).toBe(0);

    recorder.setEnabled(true);
    expect(recorder.enabled).toBe(true);
    recorder.recordSessionManifest({ datasetName: 'supply-chain', buildHash: 'abc1234' });
    // Manifest lands in the buffer synchronously, before any flush.
    const manifest = bufferOf(recorder).find((r) => r.type === 'session-manifest') as
      Record<string, unknown> | undefined;
    expect(manifest?.datasetName).toBe('supply-chain');
    expect(manifest?.buildHash).toBe('abc1234');
    // Sampling resumes and the enabled dev path still flushes to the endpoint.
    update(1.0);
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    const body = JSON.parse(
      (fetchImpl.mock.calls[0] as unknown as [url: string, init: { body: string }])[1].body
    ) as { sid: string; records: unknown[] };
    expect(body.sid).toBe(recorder.sessionId);
    expect(body.records.length).toBeGreaterThan(0);
  });

  it('keeps buffering in memory after endpoint 404 without further fetch traffic', async () => {
    const { recorder, fetchImpl, update } = makeRecorder();
    fetchImpl.mockImplementation(() => Promise.resolve({ ok: false, status: 404 }));
    update(1.1);
    await vi.waitFor(() => expect(recorder.endpointDead).toBe(true));
    // Composite off-state preserved (no network), but memory sink stays live.
    expect(recorder.disabled).toBe(true);
    const callsAfterDeath = fetchImpl.mock.calls.length;
    update(2.0);
    update(3.0);
    // No retry loop and no fallback endpoint: fetch count frozen.
    expect(fetchImpl.mock.calls.length).toBe(callsAfterDeath);
    const buffer = bufferOf(recorder);
    expect(buffer.length).toBeGreaterThan(0);
    const exported = JSON.parse(recorder.exportJson()) as {
      sid: string;
      records: unknown[];
      endpointDead: boolean;
    };
    expect(exported.sid).toBe(recorder.sessionId);
    expect(exported.records.length).toBe(buffer.length);
    expect(exported.endpointDead).toBe(true);
  });

  it('setEnabled(false) stops all sampling work after bounded lifecycle markers', () => {
    const { recorder, update } = makeRecorder();
    update(0.2);
    const before = bufferOf(recorder).length;
    expect(before).toBeGreaterThan(0);

    recorder.setEnabled(false);
    expect(recorder.enabled).toBe(false);
    const afterDisable = bufferOf(recorder).length;
    expect(afterDisable).toBe(before + 2);
    expect(bufferOf(recorder).slice(-2)).toEqual([
      expect.objectContaining({ type: 'trace-lifecycle', event: 'consent-disabled' }),
      expect.objectContaining({ type: 'trace-lifecycle', event: 'trace-end' }),
    ]);

    update(1.0);
    update(2.0);
    expect(bufferOf(recorder).length).toBe(afterDisable);
  });

  it('ships prodTraceEnabled default-off in the governed settings contract', async () => {
    const { SettingsPanel } = await import('../src/vr/ui/SettingsPanel.ts');
    expect(SettingsPanel.DEFAULTS.prodTraceEnabled).toBe(false);
    expect(SettingsPanel.DEFAULTS.telemetryEnabled).toBe(false);
  });
});

describe('InputRouter pinch-edge tap integration', () => {
  it('reports gating decisions for select, wheel and system-suppressed pinches', async () => {
    const { InputRouter } = await import('../src/vr/InputRouter.ts');
    const { Engine } = await import('../src/vr/Engine.ts');
    const engine = new Engine();
    const router = new InputRouter(engine as never);

    const events: Array<{ hand: string; phase: string; gating: string }> = [];
    router.onHandPinchEdge = (hand, phase, gating) => {
      events.push({ hand: hand.handedness ?? '?', phase, gating });
    };

    const handR = { handedness: 'right', isPinched: () => false, getRay: () => new THREE.Ray() };
    const handL = { handedness: 'left', isPinched: () => false, getRay: () => new THREE.Ray() };
    router.addHand(handR as never);
    router.addHand(handL as never);

    let pinched = { right: false, left: false };
    const sources = [
      { handedness: 'right', hand: {}, targetRaySpace: {}, gamepad: null },
      { handedness: 'left', hand: {}, targetRaySpace: {}, gamepad: null },
    ];
    const session = {
      inputSources: sources,
    };

    const setPinch = (right: boolean, left: boolean) => {
      pinched = { right, left };
      (handR as { isPinched: () => boolean }).isPinched = () => pinched.right;
      (handL as { isPinched: () => boolean }).isPinched = () => pinched.left;
    };

    // Single-hand pinch -> select gating.
    setPinch(true, false);
    router._pollSelection(session as never);
    // Two-hand pinch -> system-suppressed for the second hand.
    setPinch(true, true);
    router._pollSelection(session as never);
    // Releases.
    setPinch(false, false);
    router._pollSelection(session as never);

    expect(events).toEqual([
      { hand: 'right', phase: 'start', gating: 'select' },
      { hand: 'left', phase: 'start', gating: 'system-suppressed' },
      { hand: 'right', phase: 'end', gating: 'select-release' },
      { hand: 'left', phase: 'end', gating: 'passive-release' },
    ]);
  });
});
