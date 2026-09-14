// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { LoadTestPanel } from '../src/vr/ui/LoadTestPanel.ts';
import { SpatialPanel } from '../src/vr/ui-system/SpatialPanel.ts';
import {
  DEFAULT_LOAD_TEST_PROFILE,
  QUEST_3S_QUALIFICATION_PROFILE,
} from '../src/vr/scalability/LoadTestDriver.ts';
import { WorldTopics } from '../src/utils/EventBus.ts';
import { downloadText } from '../src/utils/Download.ts';

vi.mock('../src/utils/Download.ts', () => ({
  downloadText: vi.fn(() => Promise.resolve()),
}));

describe('LoadTestPanel UIKit dispatch', () => {
  let panel: LoadTestPanel;
  let onStart: ReturnType<typeof vi.fn>;
  let onStartBoundary: ReturnType<typeof vi.fn>;
  let onStop: ReturnType<typeof vi.fn>;
  let onFlush: ReturnType<typeof vi.fn>;
  let handlers: Record<string, Array<(p: unknown) => void>>;
  let unsubs: Array<ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.mocked(downloadText).mockClear();
    onStart = vi.fn();
    onStartBoundary = vi.fn();
    onStop = vi.fn();
    onFlush = vi.fn();
    handlers = {};
    unsubs = [];

    const eventBus = {
      on: (topic: string, handler: (payload: unknown) => void) => {
        (handlers[topic] ||= []).push(handler);
        const unsub = vi.fn();
        unsubs.push(unsub);
        return unsub;
      },
    };

    panel = new LoadTestPanel(new THREE.Group(), {
      driver: { phase: 'IDLE', run: vi.fn() } as any,
      eventBus: eventBus as any,
      onStart: onStart as any,
      onStartBoundary: onStartBoundary as any,
      onStop: onStop as any,
      onFlush: onFlush as any,
    });
  });

  afterEach(() => {
    panel?.dispose();
  });

  it('uses SpatialPanel/UIKit rather than legacy canvas hit testing', () => {
    expect(panel).toBeInstanceOf(SpatialPanel);
  });

  it.each([
    ['size:1k', 1_000],
    ['size:8k', 8_000],
    ['size:65k', 65_000],
    ['size:100k', 100_000],
    ['size:250k', 250_000],
  ] as const)('dispatching %s starts rowCount %i', (id, rowCount) => {
    expect(panel.dispatchAction(id)).toBe(true);
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart.mock.calls[0][0].steps[0].rowCount).toBe(rowCount);
  });

  it('preserves full staircase and Quest 3S profiles', () => {
    panel.dispatchAction('size:full');
    expect(onStart).toHaveBeenLastCalledWith(DEFAULT_LOAD_TEST_PROFILE);

    panel.dispatchAction('start-full');
    expect(onStart).toHaveBeenLastCalledWith(DEFAULT_LOAD_TEST_PROFILE);

    panel.dispatchAction('start-quest');
    expect(onStart).toHaveBeenLastCalledWith(QUEST_3S_QUALIFICATION_PROFILE);
  });

  it('starts Quest 10M through the dedicated boundary callback only', () => {
    panel.dispatchAction('start-quest-10m');
    expect(onStartBoundary).toHaveBeenCalledTimes(1);
    expect(onStart).not.toHaveBeenCalled();
  });

  it('dispatches stop and flush through the provided callbacks', () => {
    expect(panel.dispatchAction('stop')).toBe(true);
    expect(panel.dispatchAction('flush')).toBe(true);
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onFlush).toHaveBeenCalledTimes(1);
  });

  it('downloads the authoritative completed load-test summary unchanged', () => {
    expect(panel.dispatchAction('download')).toBe(true);
    expect(downloadText).not.toHaveBeenCalled();

    const summary = {
      profileName: 'tabular-staircase',
      verdict: { recommendation: 'Palace scales to 250k.' },
      steps: [],
    };
    handlers[WorldTopics.LOADTEST_COMPLETE][0](summary);
    panel.update();

    panel.dispatchAction('download');
    expect(downloadText).toHaveBeenCalledTimes(1);
    const [body, filename, mime] = vi.mocked(downloadText).mock.calls[0];
    expect(filename).toMatch(/^nemosyne-loadtest-.*\.json$/);
    expect(mime).toBe('application/json');
    expect(JSON.parse(body)).toEqual(summary);
  });

  it('labels and downloads Quest boundary evidence separately', () => {
    const summary = {
      profileName: 'quest-3s-rust-boundary-10m',
      outcome: { status: 'completed' },
      memory: { retainedWasmGrowthBytes: 123 },
      maximumFrameGapMs: 45,
      qualification: { promotionBlockedByAudits: true },
    };
    handlers[WorldTopics.QUEST_BOUNDARY_COMPLETE][0](summary);
    panel.update();

    panel.dispatchAction('download');
    const [body, filename] = vi.mocked(downloadText).mock.calls[0];
    expect(filename).toMatch(/^nemosyne-quest-boundary-.*\.json$/);
    expect(JSON.parse(body)).toEqual(summary);
  });

  it('unsubscribes all load-test event listeners on dispose', () => {
    expect(unsubs).toHaveLength(6);
    panel.dispose();
    expect(unsubs.every((unsub) => unsub.mock.calls.length === 1)).toBe(true);
    panel = null as never;
  });

  it('returns false for unknown semantic actions', () => {
    expect(panel.dispatchAction('does-not-exist' as never)).toBe(false);
  });
});
