// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { UXTraceRecorder } from '../src/vr/trace/UXTraceRecorder.ts';

describe('UX Inventory & Telemetry Correlation', () => {
  it('emits session-manifest, perf, friction, and hands lifecycle records', async () => {
    let capturedBody: string | null = null;
    const fetchImpl = vi.fn(async (_url: string, init: { body: string }) => {
      capturedBody = init.body;
      return { ok: true, status: 200 };
    });

    const engineMock = {
      camera: new THREE.PerspectiveCamera(),
      addUpdatable: vi.fn(),
      removeUpdatable: vi.fn(),
      input: { hands: [], panels: [], interactables: [] },
    };

    const recorder = new UXTraceRecorder({
      engine: engineMock,
      flushMs: 10,
      fetchImpl,
    });

    recorder.recordSessionManifest({
      datasetName: 'fraud-transactions.csv',
      topology: 'GRAPH',
      datasetFingerprint: 'fnv-1a-9876',
      wasmCapabilities: 0x01,
    });

    recorder.recordPerf({
      severity: 'warning',
      frameMs: 14.5,
      budget: 11.1,
      lodScaleFactor: 0.75,
    });

    recorder.recordFriction({
      pattern: 'RAPID_ABANDONED_GESTURE',
      severity: 'moderate',
      score: 0.65,
      compactTrail: ['select-miss', 'select-miss'],
    });

    recorder.recordHands({
      phase: 'joints-valid',
      hand: 'right',
      ttfrMs: 1200,
    });

    await recorder.flush();

    expect(fetchImpl).toHaveBeenCalled();
    expect(capturedBody).not.toBeNull();
    const batch = JSON.parse(capturedBody!);
    expect(batch.records.some((r: { type: string }) => r.type === 'session-manifest')).toBe(true);
    expect(batch.records.some((r: { type: string }) => r.type === 'perf')).toBe(true);
    expect(batch.records.some((r: { type: string }) => r.type === 'friction')).toBe(true);
    expect(batch.records.some((r: { type: string }) => r.type === 'hands')).toBe(true);
  });
});
