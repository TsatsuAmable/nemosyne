import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { ValidationOperatorPanel } from '../src/vr/ui/ValidationOperatorPanel.ts';
import { SpatialPanel } from '../src/vr/ui-system/SpatialPanel.ts';
import {
  deriveValidationManifest,
  type ValidationMode,
} from '../src/validation/validation-manifest.ts';
import type { BrowserValidationContext } from '../src/validation/browser-validation-session.ts';
import type { ValidationServerStatus } from '../src/validation/validation-delivery.ts';
import type { WorldEventBusLike } from '../src/vr/coordinators/types.ts';
import type { GuidedUxSubmission } from '../src/validation/guided-ux-validation.ts';

const BUILD = '277c2e73f9206f5b387a856bc8298d8247e39376';
const SESSION = {
  label: 'PERF04-277c2e7-20260905T020000',
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
};

function manifest(mode: ValidationMode = 'quest-perf') {
  return deriveValidationManifest({
    sessionId: SESSION.id,
    sessionLabel: SESSION.label,
    buildId: BUILD,
    worktree: 'clean',
    mode,
    createdAt: '2026-09-05T02:00:00.000Z',
    deviceIdentity: {
      captureBasis: 'adb-system-property',
      model: 'Meta Quest 3S',
      manufacturer: 'Meta',
      buildIncremental: '5123456789012345678',
      buildDisplayId: 'SQ3A.220605.009.A1',
      buildFingerprint: 'oculus/panther/panther:12/SQ3A/5123456789:user/release-keys',
      securityPatch: '2026-08-01',
    },
  });
}

function context(mode: ValidationMode = 'quest-perf'): BrowserValidationContext {
  return {
    session: SESSION,
    manifest: manifest(mode),
    attributable: true,
    attributionIssue:
      'launcher env projected; exact manifest confirmation is pending from the evidence sink',
    source: 'launcher-env-provisional',
  };
}

function status(mode: ValidationMode = 'quest-perf'): ValidationServerStatus {
  const value = manifest(mode);
  return {
    status: 'ok',
    sessionLabel: SESSION.label,
    sessionId: SESSION.id,
    manifest: value,
    progress: {
      target: 3,
      renderCompleted: 1,
      boundaryAttempts: 0,
      buildId: BUILD,
      deviceBuildFingerprint: value.deviceIdentity?.buildFingerprint ?? null,
    },
    gateDisposition: { status: null, reasons: [] },
  };
}

function panelFor(mode: ValidationMode = 'quest-perf') {
  const handlers: Record<string, Array<(value: unknown) => void>> = {};
  const unsubs = [vi.fn(), vi.fn(), vi.fn(), vi.fn()];
  let unsubIndex = 0;
  const callbacks = {
    onStartPerformance: vi.fn(),
    onStartBoundary: vi.fn(),
    onStop: vi.fn(),
    onFlush: vi.fn(),
    onDownload: vi.fn(async () => {}),
    onRefreshStatus: vi.fn(async () => {}),
    onSubmitUx: vi.fn(async () => {}),
  };
  const eventBus = {
    on(topic: string, handler: (value: unknown) => void) {
      (handlers[topic] ||= []).push(handler);
      return unsubs[unsubIndex++];
    },
  } as unknown as WorldEventBusLike;
  const panel = new ValidationOperatorPanel(new THREE.Group(), {
    context: context(mode),
    eventBus,
    ...callbacks,
  });
  panel.show();
  return { panel, callbacks, handlers, unsubs };
}

describe('ValidationOperatorPanel governed semantic dispatch', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses SpatialPanel/UIKit and keeps performance start disabled until sink confirmation', () => {
    const { panel, callbacks } = panelFor('quest-perf');
    expect(panel).toBeInstanceOf(SpatialPanel);
    expect(panel.getActionState('run-performance')?.disabled).toBe(true);
    expect(panel.dispatchAction('run-performance')).toBe(false);
    expect(callbacks.onStartPerformance).not.toHaveBeenCalled();
    panel.dispose();
  });

  it('requires arm then confirm after sink confirmation before performance starts', () => {
    const { panel, callbacks } = panelFor('quest-perf');
    panel.setServerStatus(status('quest-perf'));
    panel.update();

    expect(panel.dispatchAction('run-performance')).toBe(true);
    expect(callbacks.onStartPerformance).not.toHaveBeenCalled();
    expect(panel.getActionState('run-performance')?.label).toBe('CONFIRM PERF');

    expect(panel.dispatchAction('run-performance')).toBe(true);
    expect(callbacks.onStartPerformance).toHaveBeenCalledTimes(1);
    panel.dispose();
  });

  it('requires the same two-action confirmation before the 10M boundary starts', () => {
    const { panel, callbacks } = panelFor('quest-10m');
    panel.setServerStatus(status('quest-10m'));
    panel.update();

    panel.dispatchAction('run-boundary');
    expect(callbacks.onStartBoundary).not.toHaveBeenCalled();
    panel.dispatchAction('run-boundary');
    expect(callbacks.onStartBoundary).toHaveBeenCalledTimes(1);
    panel.dispose();
  });

  it('keeps guided UX controls disabled until the sink confirms the quest-ux manifest', () => {
    const { panel } = panelFor('quest-ux');
    for (const id of ['ux-pass', 'ux-fail', 'ux-skip'] as const) {
      expect(panel.getActionState(id)?.disabled).toBe(true);
      expect(panel.dispatchAction(id)).toBe(false);
    }
    panel.setServerStatus(status('quest-ux'));
    panel.update();
    for (const id of ['ux-pass', 'ux-fail', 'ux-skip'] as const) {
      expect(panel.getActionState(id)?.disabled).toBe(false);
    }
    expect(panel.getActionState('ux-submit')?.disabled).toBe(true);
    panel.dispose();
  });

  it('records guided UX only after confirmation and submits only when complete with comfort', async () => {
    const { panel, callbacks } = panelFor('quest-ux');
    panel.setServerStatus(status('quest-ux'));

    const taskCount = panel
      .getRenderedSummary()
      .match(/Task 1\/(\d+)/)?.[1];
    expect(taskCount).toBeTruthy();
    const total = Number(taskCount);

    for (let index = 0; index < total; index++) {
      expect(panel.dispatchAction('ux-pass')).toBe(true);
    }
    expect(panel.getActionState('ux-submit')?.disabled).toBe(true);

    expect(panel.dispatchAction('comfort-ok')).toBe(true);
    expect(panel.getActionState('ux-submit')?.disabled).toBe(false);
    expect(panel.dispatchAction('ux-submit')).toBe(true);

    await vi.waitFor(() => expect(callbacks.onSubmitUx).toHaveBeenCalledTimes(1));
    const submission = (callbacks.onSubmitUx.mock.calls as unknown as Array<[GuidedUxSubmission]>)[0]?.[0];
    expect(submission).toBeDefined();
    expect(submission?.results).toHaveLength(total);
    expect(submission?.results.every((result) => result.outcome === 'pass')).toBe(true);
    expect(submission?.comfortObservation.outcome).toBe('comfortable');
    panel.dispose();
  });

  it('unsubscribes all validation event streams and disposes UIKit on teardown', () => {
    const { panel, unsubs } = panelFor('quest-perf');
    panel.dispose();
    expect(unsubs.every((unsub) => unsub.mock.calls.length === 1)).toBe(true);
  });
});
