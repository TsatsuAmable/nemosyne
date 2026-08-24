// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { LoadTestPanel } from '../src/vr/ui/LoadTestPanel.ts';
import {
  DEFAULT_LOAD_TEST_PROFILE,
  QUEST_3S_QUALIFICATION_PROFILE,
} from '../src/vr/scalability/LoadTestDriver.ts';
import { WorldTopics } from '../src/utils/EventBus.ts';
import { downloadText } from '../src/utils/Download.ts';

vi.mock('../src/utils/Download.ts', () => ({
  downloadText: vi.fn(() => Promise.resolve()),
}));

/** Build a raycaster whose intersectObject reports a hit inside button `id`. */
function rayHitButton(panel: LoadTestPanel, id: string): THREE.Raycaster {
  const btn = (panel as any)._buttons.find((b: any) => b.id === id);
  if (!btn) throw new Error(`no button '${id}'`);
  const u = (btn.x + btn.w / 2) / panel.width;
  const v = 1 - (btn.y + btn.h / 2) / panel.height;
  const raycaster = new THREE.Raycaster();
  vi.spyOn(raycaster, 'intersectObject').mockReturnValue([
    { object: panel.mesh, uv: new THREE.Vector2(u, v) } as any,
  ]);
  return raycaster;
}

describe('LoadTestPanel button dispatch', () => {
  let panel: LoadTestPanel;
  let onStart: ReturnType<typeof vi.fn>;
  let onStartBoundary: ReturnType<typeof vi.fn>;
  let onStop: ReturnType<typeof vi.fn>;
  let onFlush: ReturnType<typeof vi.fn>;
  let handlers: Record<string, Array<(p: unknown) => void>>;
  const cameraGroup = new THREE.Group();

  beforeEach(() => {
    vi.mocked(downloadText).mockClear();
    onStart = vi.fn();
    onStartBoundary = vi.fn();
    onStop = vi.fn();
    onFlush = vi.fn();
    handlers = {};
    const eventBus = {
      on: (topic: string, h: (p: unknown) => void) => {
        (handlers[topic] ||= []).push(h);
        return () => {};
      },
    };
    panel = new LoadTestPanel(cameraGroup, {
      driver: { phase: 'IDLE' } as any,
      eventBus: eventBus as any,
      onStart: onStart as any,
      onStartBoundary: onStartBoundary as any,
      onStop: onStop as any,
      onFlush: onFlush as any,
    });
    panel.show();
    panel.mesh.updateMatrixWorld();
  });

  it('exposes the six size presets plus the render and 10M boundary actions', () => {
    const ids = (panel as any)._buttons.map((b: any) => b.id);
    expect(ids).toContain('size:1k');
    expect(ids).toContain('size:8k');
    expect(ids).toContain('size:65k');
    expect(ids).toContain('size:100k');
    expect(ids).toContain('size:250k');
    expect(ids).toContain('size:full');
    expect(ids).toContain('start-full');
    expect(ids).toContain('start-quest');
    expect(ids).toContain('start-quest-10m');
    expect(ids).toContain('stop');
    expect(ids).toContain('flush');
    expect(ids).toContain('download');
  });

  it.each([
    ['size:1k', 1_000],
    ['size:8k', 8_000],
    ['size:65k', 65_000],
    ['size:100k', 100_000],
    ['size:250k', 250_000],
  ] as const)('clicking %s starts a single-step run with rowCount %i', (id, rowCount) => {
    const consumed = panel.handleContentClick(rayHitButton(panel, id));
    expect(consumed).toBe(true);
    expect(onStart).toHaveBeenCalledTimes(1);
    const profile = onStart.mock.calls[0][0];
    expect(profile.steps[0].rowCount).toBe(rowCount);
  });

  it('clicking size:full and start-full both start the default staircase profile', () => {
    panel.handleContentClick(rayHitButton(panel, 'size:full'));
    expect(onStart).toHaveBeenLastCalledWith(DEFAULT_LOAD_TEST_PROFILE);

    onStart.mockClear();
    panel.handleContentClick(rayHitButton(panel, 'start-full'));
    expect(onStart).toHaveBeenLastCalledWith(DEFAULT_LOAD_TEST_PROFILE);
  });

  it('starts the declared Quest 3S qualification profile', () => {
    panel.handleContentClick(rayHitButton(panel, 'start-quest'));
    expect(onStart).toHaveBeenLastCalledWith(QUEST_3S_QUALIFICATION_PROFILE);
  });

  it('starts the dedicated Quest 10M Rust boundary probe', () => {
    panel.handleContentClick(rayHitButton(panel, 'start-quest-10m'));
    expect(onStartBoundary).toHaveBeenCalledTimes(1);
    expect(onStart).not.toHaveBeenCalled();
  });

  it('clicking stop / flush dispatches to the provided callbacks', () => {
    expect(panel.handleContentClick(rayHitButton(panel, 'stop'))).toBe(true);
    expect(onStop).toHaveBeenCalledTimes(1);

    expect(panel.handleContentClick(rayHitButton(panel, 'flush'))).toBe(true);
    expect(onFlush).toHaveBeenCalledTimes(1);
  });

  it('download is a no-op until a LOADTEST_COMPLETE summary arrives, then exports it', () => {
    // No summary yet: button is consumed but downloadText is not called.
    expect(panel.handleContentClick(rayHitButton(panel, 'download'))).toBe(true);
    expect(downloadText).not.toHaveBeenCalled();

    // Emit a completion summary through the event bus subscription.
    // (LoadTestSummary.verdict is an object carrying a recommendation string.)
    const summary = {
      verdict: { recommendation: 'Palace scales to 250k.' },
      grade: 'green',
      steps: [],
    };
    handlers[WorldTopics.LOADTEST_COMPLETE][0](summary);
    panel.update(); // flush dirty -> re-render (keeps _lastSummary)

    expect(panel.handleContentClick(rayHitButton(panel, 'download'))).toBe(true);
    expect(downloadText).toHaveBeenCalledTimes(1);
    const [body, filename, mime] = vi.mocked(downloadText).mock.calls[0];
    expect(filename).toMatch(/^nemosyne-loadtest-.*\.json$/);
    expect(mime).toBe('application/json');
    expect(JSON.parse(body)).toEqual(summary);
  });

  it('downloads the latest Quest boundary summary separately from render telemetry', () => {
    const summary = {
      profileName: 'quest-3s-rust-boundary-10m',
      outcome: { status: 'completed' },
      memory: { retainedWasmGrowthBytes: 123 },
      maximumFrameGapMs: 45,
      qualification: { promotionBlockedByAudits: true },
    };
    handlers[WorldTopics.QUEST_BOUNDARY_COMPLETE][0](summary);
    panel.update();

    expect(panel.handleContentClick(rayHitButton(panel, 'download'))).toBe(true);
    const [, filename] = vi.mocked(downloadText).mock.calls[0];
    expect(filename).toMatch(/^nemosyne-quest-boundary-.*\.json$/);
  });

  it('returns false for a click that hits no button', () => {
    const raycaster = new THREE.Raycaster();
    vi.spyOn(raycaster, 'intersectObject').mockReturnValue([
      { object: panel.mesh, uv: new THREE.Vector2(0.001, 0.999) } as any,
    ]);
    expect(panel.handleContentClick(raycaster)).toBe(false);
  });
});
