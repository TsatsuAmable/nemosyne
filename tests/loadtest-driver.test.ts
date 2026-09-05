// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import {
  LoadTestDriver,
  DEFAULT_LOAD_TEST_PROFILE,
  QUEST_3S_QUALIFICATION_PROFILE,
  type LoadTestProfile,
  type LoadTestWorldLike,
  type LoadTestDriverEngineLike,
} from '../src/vr/scalability/LoadTestDriver';
import { WorldTopics } from '../src/utils/EventBus';

/**
 * State-machine unit test for the LoadTestDriver. No three.js — a fake engine
 * with a controllable `lastFrameMs` and `renderer.info`, and a fake world that
 * records loadDataset calls. Steps use very short durations so the test runs in
 * milliseconds. Frame times are driven to produce a known verdict (all green at
 * 8ms) so we can assert the overall recommendation is computed, not hardcoded.
 */

function makeEngine(frameMs: number): LoadTestDriverEngineLike {
  return {
    lastFrameMs: frameMs,
    renderer: {
      info: {
        render: { calls: 10, triangles: 100, points: 0, lines: 0 },
        memory: { geometries: 1, textures: 0 },
      },
      xr: { getSession: () => null },
    },
  };
}

function makeWorld(
  tracker: { count: number; entries: unknown[] },
  events: { topic: string; payload?: unknown }[]
): LoadTestWorldLike {
  return {
    loadDataset(entry) {
      tracker.count++;
      tracker.entries.push(entry);
    },
    getActiveSpecInfo: () => ({ geometry: 'point', layout: 'grid' }),
    eventBus: {
      emit(topic, payload) {
        events.push({ topic, payload });
      },
    },
  };
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe('LoadTestDriver state machine', () => {
  it('transitions IDLE → SETTLING → MEASURING → COMPLETE across the staircase', async () => {
    const profile: LoadTestProfile = {
      name: 'tiny',
      settleSec: 0,
      steps: [
        { topology: 'TABULAR', rowCount: 1_000, durationSec: 0.05, label: '1k' },
        { topology: 'TABULAR', rowCount: 2_000, durationSec: 0.05, label: '2k' },
      ],
    };
    const tracker = { count: 0, entries: [] as unknown[] };
    const events: { topic: string; payload?: unknown }[] = [];
    const world = makeWorld(tracker, events);
    const driver = new LoadTestDriver(world, makeEngine(8));

    expect(driver.phase).toBe('IDLE');
    driver.run(profile);
    // run() loads the first step immediately and enters SETTLING.
    expect(driver.phase).toBe('SETTLING');
    expect(tracker.count).toBe(1);

    // Tick the settle (0ms) → MEASURING.
    driver.update(0.016, 0);
    expect(driver.phase).toBe('MEASURING');
    expect(driver.currentStep?.rowCount).toBe(1_000);

    // Drive past the 50ms step duration.
    await wait(70);
    driver.update(0.016, 0); // finish step 1 → load step 2 → SETTLING
    expect(tracker.count).toBe(2);
    driver.update(0.016, 0); // settle 0 → MEASURING step 2
    expect(driver.phase).toBe('MEASURING');
    expect(driver.currentStep?.rowCount).toBe(2_000);

    await wait(70);
    driver.update(0.016, 0); // finish step 2 → COMPLETE
    expect(driver.phase).toBe('COMPLETE');
    expect(events.some((e) => e.topic === WorldTopics.LOADTEST_COMPLETE)).toBe(true);
  });

  it('emits LOADTEST_START and LOADTEST_COMPLETE with a computed all-green verdict', async () => {
    const profile: LoadTestProfile = {
      name: 'verdict',
      settleSec: 0,
      steps: [
        { topology: 'TABULAR', rowCount: 1_000, durationSec: 0.03, label: '1k' },
        { topology: 'TABULAR', rowCount: 2_000, durationSec: 0.03, label: '2k' },
      ],
    };
    const tracker = { count: 0, entries: [] as unknown[] };
    const events: { topic: string; payload?: unknown }[] = [];
    const world = makeWorld(tracker, events);
    const driver = new LoadTestDriver(world, makeEngine(8)); // 8ms frames → green

    driver.run(profile);
    expect(events.some((e) => e.topic === WorldTopics.LOADTEST_START)).toBe(true);

    driver.update(0.016, 0); // → MEASURING step 1
    await wait(40);
    driver.update(0.016, 0); // finish 1 → SETTLING step 2
    driver.update(0.016, 0); // → MEASURING step 2
    await wait(40);
    driver.update(0.016, 0); // finish → COMPLETE

    const complete = events.find((e) => e.topic === WorldTopics.LOADTEST_COMPLETE);
    expect(complete).toBeDefined();
    const summary = complete!.payload as {
      verdict: { commandBufferWarrantedAt: number | null; jsPathSufficientTo: number | null };
      steps: { grade: string }[];
    };
    expect(summary.steps.length).toBe(2);
    expect(summary.steps.every((s) => s.grade === 'green')).toBe(true);
    expect(summary.verdict.commandBufferWarrantedAt).toBeNull();
    expect(summary.verdict.jsPathSufficientTo).toBe(2_000);
  });

  it('grades red and reports a warranted command buffer when frames exceed budget', async () => {
    const profile: LoadTestProfile = {
      name: 'red',
      settleSec: 0,
      steps: [
        { topology: 'TABULAR', rowCount: 1_000, durationSec: 0.03, label: '1k' },
        { topology: 'TABULAR', rowCount: 2_000, durationSec: 0.03, label: '2k' },
      ],
    };
    const tracker = { count: 0, entries: [] as unknown[] };
    const events: { topic: string; payload?: unknown }[] = [];
    const world = makeWorld(tracker, events);
    const driver = new LoadTestDriver(world, makeEngine(25)); // 25ms frames → red (p95 > 16.67)

    driver.run(profile);
    driver.update(0.016, 0);
    await wait(40);
    driver.update(0.016, 0);
    driver.update(0.016, 0);
    await wait(40);
    driver.update(0.016, 0);

    const summary = events.find((e) => e.topic === WorldTopics.LOADTEST_COMPLETE)!.payload as {
      verdict: { commandBufferWarrantedAt: number | null; jsPathSufficientTo: number | null };
      steps: { grade: string }[];
    };
    expect(summary.steps.every((s) => s.grade === 'red')).toBe(true);
    expect(summary.verdict.commandBufferWarrantedAt).toBe(1_000);
    expect(summary.verdict.jsPathSufficientTo).toBeNull();
  });

  it('stop() aborts and still emits COMPLETE with partial results', async () => {
    const profile: LoadTestProfile = {
      name: 'abort',
      settleSec: 0,
      steps: [
        { topology: 'TABULAR', rowCount: 1_000, durationSec: 1, label: '1k' },
        { topology: 'TABULAR', rowCount: 2_000, durationSec: 1, label: '2k' },
      ],
    };
    const tracker = { count: 0, entries: [] as unknown[] };
    const events: { topic: string; payload?: unknown }[] = [];
    const world = makeWorld(tracker, events);
    const driver = new LoadTestDriver(world, makeEngine(8));
    driver.run(profile);
    driver.update(0.016, 0); // → MEASURING step 1
    driver.stop();
    expect(driver.phase).toBe('COMPLETE');
    const summary = events.find((e) => e.topic === WorldTopics.LOADTEST_COMPLETE)!.payload as {
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
    expect(driver.phase).toBe('SETTLING');
    expect(tracker.count).toBe(1);

    driver.dispose();
    driver.dispose();
    driver.update(0.016, 0);

    expect(driver.phase).toBe('COMPLETE');
    expect(tracker.count).toBe(1);
    expect(session.removeEventListener).toHaveBeenCalledTimes(1);
    const summaries = events.filter((event) => event.topic === WorldTopics.LOADTEST_COMPLETE);
    expect(summaries).toHaveLength(1);
    expect((summaries[0].payload as { aborted: boolean }).aborted).toBe(true);
    driver.run(profile);
    expect(tracker.count).toBe(1);
  });

  it('stop aborts a measuring step without loading the next dataset and cleans up exactly once', () => {
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
      name: 'dispose-measuring',
      settleSec: 0,
      steps: [
        { topology: 'TABULAR', rowCount: 10, durationSec: 60 },
        { topology: 'TABULAR', rowCount: 20, durationSec: 60 },
      ],
    };

    driver.run(profile);
    driver.update(0.016, 0);
    expect(driver.phase).toBe('MEASURING');
    driver.stop();
    driver.dispose();
    driver.stop();

    expect(driver.phase).toBe('COMPLETE');
    expect(tracker.count).toBe(1);
    expect(driver.steps).toHaveLength(1);
    expect(driver.steps[0].reasons[0]).toBe('step aborted early');
    expect(session.removeEventListener).toHaveBeenCalledTimes(1);
    expect(events.filter((event) => event.topic === WorldTopics.LOADTEST_COMPLETE)).toHaveLength(1);
  });

  it('restores the pre-run dataset on completion so the UI stays usable', async () => {
    const profile: LoadTestProfile = {
      name: 'restore',
      settleSec: 0,
      steps: [{ topology: 'TABULAR', rowCount: 1_000, durationSec: 0.03, label: '1k' }],
    };
    const preRunEntry = { key: 'supply-chain', name: 'Supply Chain Hierarchy' };
    const tracker = { count: 0, entries: [] as unknown[] };
    const events: { topic: string; payload?: unknown }[] = [];
    const world = { ...makeWorld(tracker, events), currentEntry: preRunEntry };
    const driver = new LoadTestDriver(world, makeEngine(8));

    driver.run(profile);
    driver.update(0.016, 0); // → MEASURING
    await wait(40);
    driver.update(0.016, 0); // finish → COMPLETE + restore

    expect(driver.phase).toBe('COMPLETE');
    expect(tracker.count).toBe(2);
    expect(tracker.entries[tracker.entries.length - 1]).toBe(preRunEntry);
  });

  it('skips the restore when no dataset was active before the run', async () => {
    const profile: LoadTestProfile = {
      name: 'no-restore',
      settleSec: 0,
      steps: [{ topology: 'TABULAR', rowCount: 1_000, durationSec: 0.03, label: '1k' }],
    };
    const tracker = { count: 0, entries: [] as unknown[] };
    const events: { topic: string; payload?: unknown }[] = [];
    const driver = new LoadTestDriver(makeWorld(tracker, events), makeEngine(8));

    driver.run(profile);
    driver.update(0.016, 0); // → MEASURING
    await wait(40);
    driver.update(0.016, 0); // finish → COMPLETE, no restore

    expect(driver.phase).toBe('COMPLETE');
    expect(tracker.count).toBe(1);
  });
});
