import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_LOAD_TEST_PROFILE,
  QUEST_3S_QUALIFICATION_PROFILE,
  LoadTestDriver,
  type LoadTestProfile,
} from '../src/vr/scalability/LoadTestDriver.ts';
import { WorldTopics } from '../src/utils/EventBus.ts';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeEngine(lastFrameMs: number) {
  return {
    lastFrameMs,
    frameIntervalMs: 13.8,
    frameGovernor: {
      getMetrics: () => ({ lodScaleFactor: 1, throttleCount: 0 }),
    },
    renderer: {
      xr: { getSession: () => null },
      getContext: () => null,
      info: {
        render: { calls: 1, triangles: 1, points: 1, lines: 0 },
        memory: { geometries: 1, textures: 1 },
      },
    },
  };
}

function makeWorld(
  tracker: { count: number; entries: unknown[] },
  events: { topic: string; payload?: unknown }[] = []
) {
  return {
    eventBus: {
      emit(topic: string, payload?: unknown) {
        events.push({ topic, payload });
      },
    },
    async loadDataset(entry: unknown) {
      tracker.entries.push(entry);
    },
    getActiveSpecInfo() {
      return {
        geometry: 'POINT',
        layout: 'GRID_3D',
        renderedNodeCount: 1,
      };
    },
  };
}

describe('LoadTestDriver', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('runs a profile through load, settle, sample, and completion', async () => {
    const tracker = { count: 0, entries: [] as unknown[] };
    const events: { topic: string; payload?: unknown }[] = [];
    const driver = new LoadTestDriver(makeWorld(tracker, events), makeEngine(8));
    const profile: LoadTestProfile = {
      name: 'test',
      settleSec: 0,
      steps: [{ topology: 'TABULAR', rowCount: 10, durationSec: 0.01 }],
    };
    driver.run(profile);
    expect(driver.phase).toBe('LOADING');
    driver.update(0.016, 0);
    await wait(20);
    driver.update(0.016, 0);
    expect(driver.phase).toBe('COMPLETE');
    expect(tracker.entries).toHaveLength(1);
    expect(events.some((event) => event.topic === WorldTopics.LOADTEST_COMPLETE)).toBe(true);
  });

  it('refuses to start while already active', () => {
    const tracker = { count: 0, entries: [] as unknown[] };
    const driver = new LoadTestDriver(makeWorld(tracker), makeEngine(8));
    const profile: LoadTestProfile = {
      name: 'test',
      settleSec: 10,
      steps: [{ topology: 'TABULAR', rowCount: 10, durationSec: 10 }],
    };
    driver.run(profile);
    const runId = driver.runId;
    driver.run(profile);
    expect(driver.runId).toBe(runId);
  });

  it('stops and emits an aborted summary', async () => {
    const tracker = { count: 0, entries: [] as unknown[] };
    const events: { topic: string; payload?: unknown }[] = [];
    const driver = new LoadTestDriver(makeWorld(tracker, events), makeEngine(8));
    const profile: LoadTestProfile = {
      name: 'test',
      settleSec: 0,
      steps: [{ topology: 'TABULAR', rowCount: 10, durationSec: 60 }],
    };
    driver.run(profile);
    driver.update(0.016, 0);
    await wait(10);
    driver.update(0.016, 0);
    driver.stop();
    const complete = events.find((event) => event.topic === WorldTopics.LOADTEST_COMPLETE);
    expect(complete).toBeDefined();
    const summary = complete?.payload as {
      aborted: boolean;
      steps: unknown[];
    };
    expect(summary.aborted).toBe(true);
    expect(summary.steps.length).toBe(1);
  });

  it('default profile is the documented 1k→250k TABULAR staircase', () => {
    const rowCounts = DEFAULT_LOAD_TEST_PROFILE.steps.map((s) => s.rowCount);
    expect(rowCounts).toEqual([1_000, 8_000, 65_000, 100_000, 250_000]);
    expect(DEFAULT_LOAD_TEST_PROFILE.steps.every((s) => s.topology === 'TABULAR')).toBe(true);
  });

  it('declares the physical Quest 3S soak profile and emits privacy-bounded metadata', async () => {
    const profile: LoadTestProfile = {
      name: QUEST_3S_QUALIFICATION_PROFILE.name,
      deviceTarget: 'META_QUEST_3S',
      settleSec: 0,
      steps: [{ topology: 'TABULAR', rowCount: 1_000, durationSec: 0.01 }],
    };
    const events: { topic: string; payload?: unknown }[] = [];
    const driver = new LoadTestDriver(makeWorld({ count: 0, entries: [] }, events), makeEngine(8));
    driver.run(profile);
    driver.update(0.016, 0);
    await wait(20);
    driver.update(0.016, 0);
    const summary = events.find((event) => event.topic === WorldTopics.LOADTEST_COMPLETE)!
      .payload as {
      version: string;
      device: { declaredDeviceTarget: string; identityBasis: string };
      collection: Record<string, boolean | string>;
    };
    expect(summary.version).toBe('2');
    expect(summary.device.declaredDeviceTarget).toBe('META_QUEST_3S');
    expect(summary.device.identityBasis).toBe('unavailable');
    expect(summary.collection.rawFrameTraceIncluded).toBe(false);
    expect(summary.collection.datasetRowsIncluded).toBe(false);
    expect(summary.collection.cameraPosesIncluded).toBe(false);
  });

  it('dispose aborts during settling and detaches visibility without another frame', () => {
    const session = {
      visibilityState: 'visible',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const engine = makeEngine(8);
    engine.renderer.xr.getSession = () => session;
    const tracker = { count: 0, entries: [] as unknown[] };
    const events: { topic: string; payload?: unknown }[] = [];
    const driver = new LoadTestDriver(makeWorld(tracker, events), engine);
    const profile: LoadTestProfile = {
      name: 'dispose-settling',
      settleSec: 60,
      steps: [
        { topology: 'TABULAR', rowCount: 10, durationSec: 60 },
        { topology: 'TABULAR', rowCount: 20, durationSec: 60 },
      ],
    };
    driver.run(profile);
    driver.dispose();
    expect(driver.phase).toBe('COMPLETE');
    expect(session.removeEventListener).toHaveBeenCalled();
  });
});
