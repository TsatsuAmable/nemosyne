import { describe, expect, it } from 'vitest';
import { LoadTestCollector } from '../src/vr/scalability/LoadTestCollector.ts';
import {
  QuestVisibilityTracker,
  captureQuestRuntimeEnvironment,
  computeSustainedPerformanceProxy,
} from '../src/vr/scalability/QuestTelemetry.ts';

describe('Quest telemetry', () => {
  it('classifies sustained frame-cadence drift without claiming temperature access', () => {
    const stable = computeSustainedPerformanceProxy(Array(180).fill(13.8), [], 0);
    expect(stable.signal).toBe('xr-frame-interval');
    expect(stable.classification).toBe('stable');
    expect(stable.temperatureSensorAvailable).toBe(false);

    const degrading = computeSustainedPerformanceProxy(
      [...Array(120).fill(13.8), ...Array(120).fill(20)],
      [],
      12
    );
    expect(degrading.classification).toBe('degrading');
    expect(degrading.p95DriftPercent).toBeGreaterThan(40);
  });

  it('captures declared device, XR framebuffer, refresh rate, and WebGL identity', () => {
    const gl = {
      VENDOR: 1,
      RENDERER: 2,
      VERSION: 3,
      getExtension: () => ({ UNMASKED_VENDOR_WEBGL: 4, UNMASKED_RENDERER_WEBGL: 5 }),
      getParameter: (key: number) => ({ 3: 'WebGL 2', 4: 'Qualcomm', 5: 'Adreno' })[key],
    };
    const session = {
      visibilityState: 'visible',
      environmentBlendMode: 'opaque',
      interactionMode: 'world-space',
      frameRate: 72,
      supportedFrameRates: new Float32Array([72, 90]),
      renderState: { baseLayer: { framebufferWidth: 1832, framebufferHeight: 1920 } },
    };
    const environment = captureQuestRuntimeEnvironment(
      { renderer: { xr: { getSession: () => session }, getContext: () => gl } },
      'META_QUEST_3S'
    );
    expect(environment.declaredDeviceTarget).toBe('META_QUEST_3S');
    expect(environment.identityBasis).toBe('investigator-declared');
    expect(environment.xr.nominalFrameRateHz).toBe(72);
    expect(environment.xr.framebufferWidth).toBe(1832);
    expect(environment.webgl.renderer).toBe('Adreno');
  });

  it('records visibility interruptions and detaches the listener', () => {
    const listener: { current: (() => void) | null } = { current: null };
    const session = {
      visibilityState: 'visible',
      addEventListener: (_type: string, next: () => void) => {
        listener.current = next;
      },
      removeEventListener: (_type: string, next: () => void) => {
        if (listener.current === next) listener.current = null;
      },
    };
    const tracker = new QuestVisibilityTracker(session);
    session.visibilityState = 'hidden';
    listener.current?.();
    session.visibilityState = 'visible';
    listener.current?.();
    const result = tracker.finish();
    expect(result.interruptionCount).toBe(1);
    expect(result.interruptedDurationMs).toBeGreaterThanOrEqual(0);
    expect(listener.current).toBeNull();
  });

  it('aggregates cadence, WASM memory, governor LOD, and rendered reduction per step', () => {
    let wasmBytes = 100;
    let throttleCount = 2;
    const engine = {
      lastFrameMs: 8,
      frameIntervalMs: 13.8,
      frameGovernor: {
        getMetrics: () => ({ lodScaleFactor: throttleCount > 2 ? 0.75 : 1, throttleCount }),
      },
      renderer: {
        info: {
          render: { calls: 4, triangles: 40, points: 100, lines: 0 },
          memory: { geometries: 2, textures: 1 },
        },
      },
    };
    const collector = new LoadTestCollector(engine, { getWasmMemoryBytes: () => wasmBytes });
    collector.startStep({ topology: 'TABULAR', rowCount: 1000, durationSec: 30 });
    for (let index = 0; index < 150; index++) {
      if (index === 75) {
        wasmBytes = 200;
        throttleCount = 5;
      }
      collector.recordFrame(8, engine.renderer.info, 13.8);
    }
    const result = collector.endStep({
      renderedNodeCount: 250,
      specGeometry: 'point',
      specLayout: 'grid',
      loadDurationMs: 42,
    });
    expect(result.frameCadence.p95Ms).toBe(13.8);
    expect(result.memory.wasmPeakBytes).toBe(200);
    expect(result.representation.renderedFraction).toBe(0.25);
    expect(result.representation.governorLodScaleMinimum).toBe(0.75);
    expect(result.representation.governorThrottleEvents).toBe(3);
    expect(result.sustainedPerformance.temperatureSensorAvailable).toBe(false);
    expect(result.loadDurationMs).toBe(42);
  });
});
