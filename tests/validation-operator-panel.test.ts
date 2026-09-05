// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { ValidationOperatorPanel } from '../src/vr/ui/ValidationOperatorPanel.ts';
import { deriveValidationManifest } from '../src/validation/validation-manifest.ts';

const BUILD = '277c2e73f9206f5b387a856bc8298d8247e39376';
const SESSION = {
  label: 'PERF04-277c2e7-20260905T020000',
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
};

function manifest(mode = 'quest-perf') {
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

function context(mode = 'quest-perf') {
  return {
    session: SESSION,
    manifest: manifest(mode),
    attributable: true,
    attributionIssue: 'launcher env projected; exact manifest confirmation is pending from the evidence sink',
    source: 'launcher-env-provisional',
  };
}

function status(mode = 'quest-perf') {
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
      deviceBuildFingerprint: value.deviceIdentity.buildFingerprint,
    },
    gateDisposition: { status: null, reasons: [] },
  };
}

function rayHitButton(panel: ValidationOperatorPanel, id: string): THREE.Raycaster {
  const btn = (panel as any)._buttons.find((button: any) => button.id === id);
  if (!btn) throw new Error(`no button '${id}'`);
  const u = (btn.x + btn.w / 2) / panel.width;
  const v = 1 - (btn.y + btn.h / 2) / panel.height;
  const raycaster = new THREE.Raycaster();
  vi.spyOn(raycaster, 'intersectObject').mockReturnValue([
    { object: panel.mesh, uv: new THREE.Vector2(u, v) } as any,
  ]);
  return raycaster;
}

function panelFor(mode = 'quest-perf') {
  const handlers: Record<string, Array<(value: unknown) => void>> = {};
  const callbacks = {
    onStartPerformance: vi.fn(),
    onStartBoundary: vi.fn(),
    onStop: vi.fn(),
    onFlush: vi.fn(),
    onDownload: vi.fn(async () => {}),
    onRefreshStatus: vi.fn(async () => {}),
    onSubmitUx: vi.fn(async () => {}),
  };
  const panel = new ValidationOperatorPanel(new THREE.Group(), {
    context: context(mode),
    eventBus: {
      on(topic: string, handler: (value: unknown) => void) {
        (handlers[topic] ||= []).push(handler);
        return () => {};
      },
    } as any,
    ...callbacks,
  });
  panel.show();
  panel.mesh.updateMatrixWorld();
  return { panel, callbacks, handlers };
}

describe('ValidationOperatorPanel governed start fencing', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not expose a clickable performance start until the sink confirms the exact manifest', () => {
    const { panel, callbacks } = panelFor('quest-perf');
    const arm = (panel as any)._buttons.find((button: any) => button.id === 'run-performance');
    expect(arm.disabled).toBe(true);
    expect(panel.handleContentClick(rayHitButton(panel, 'run-performance'))).toBe(false);
    expect(callbacks.onStartPerformance).not.toHaveBeenCalled();
  });

  it('requires arm then confirm after sink confirmation before performance starts', () => {
    const { panel, callbacks } = panelFor('quest-perf');
    panel.setServerStatus(status('quest-perf'));
    panel.update();

    expect(panel.handleContentClick(rayHitButton(panel, 'run-performance'))).toBe(true);
    expect(callbacks.onStartPerformance).not.toHaveBeenCalled();
    panel.update();
    expect((panel as any)._buttons.find((button: any) => button.id === 'run-performance').label).toBeUndefined();

    expect(panel.handleContentClick(rayHitButton(panel, 'run-performance'))).toBe(true);
    expect(callbacks.onStartPerformance).toHaveBeenCalledTimes(1);
  });

  it('requires the same two-action confirmation before the 10M boundary starts', () => {
    const { panel, callbacks } = panelFor('quest-10m');
    panel.setServerStatus(status('quest-10m'));
    panel.update();

    panel.handleContentClick(rayHitButton(panel, 'run-boundary'));
    expect(callbacks.onStartBoundary).not.toHaveBeenCalled();
    panel.update();
    panel.handleContentClick(rayHitButton(panel, 'run-boundary'));
    expect(callbacks.onStartBoundary).toHaveBeenCalledTimes(1);
  });

  it('keeps guided UX controls disabled until the sink confirms the quest-ux manifest', () => {
    const { panel } = panelFor('quest-ux');
    for (const id of ['ux-pass', 'ux-fail', 'ux-skip', 'ux-submit']) {
      expect((panel as any)._buttons.find((button: any) => button.id === id).disabled).toBe(true);
    }
    panel.setServerStatus(status('quest-ux'));
    panel.update();
    for (const id of ['ux-pass', 'ux-fail', 'ux-skip', 'ux-submit']) {
      expect((panel as any)._buttons.find((button: any) => button.id === id).disabled).toBe(false);
    }
  });
});
