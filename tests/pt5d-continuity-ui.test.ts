// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { InvestigationContinuityController } from '../src/app/investigation/InvestigationContinuityController.ts';
import { mountDesktopInvestigationContinuity } from '../src/app/investigation/DesktopInvestigationContinuity.ts';
import { InvestigationContinuityPanel } from '../src/vr/ui/InvestigationContinuityPanel.ts';

function controller(overrides: Partial<Record<keyof InvestigationContinuityController, unknown>> = {}): InvestigationContinuityController {
  return {
    summary: vi.fn(async () => ({ checkpointCount: 0, latestCheckpoint: null, canRecoverAutosave: true })),
    saveNow: vi.fn(async () => {}),
    createCheckpoint: vi.fn(async () => ({
      archiveId: 'archive:1',
      label: 'Investigation checkpoint',
      datasetFingerprint: 'fp',
      datasetName: 'dataset',
      investigationDigest: 'digest',
      eventCount: 2,
      discoveryCount: 1,
      frozenAt: 1,
    })),
    restoreLatestCheckpoint: vi.fn(async () => ({
      archiveId: 'archive:1',
      label: 'Investigation checkpoint',
      datasetFingerprint: 'fp',
      datasetName: 'dataset',
      investigationDigest: 'digest',
      eventCount: 2,
      discoveryCount: 1,
      frozenAt: 1,
    })),
    recoverAutosave: vi.fn(async () => true),
    exportCurrent: vi.fn(async () => new Uint8Array([1, 2, 3])),
    openPortable: vi.fn(async () => ({
      verification: { success: true, eventsMatched: 2, discrepancies: [] },
      reopened: true,
      resumable: true,
      message: 'Investigation opened and verified (2 evidence events).',
    })),
    ...overrides,
  } as unknown as InvestigationContinuityController;
}

describe('PT5D continuity presentation', () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('desktop replaces the legacy direct export affordance and delegates save actions to the continuity controller', async () => {
    document.body.innerHTML = `
      <section id="investigation-shell">
        <header><button id="export-btn">Export investigation</button></header>
        <aside>
          <details id="desktop-review-recovery-rail">
            <p id="recovery-archives">legacy</p>
            <button id="recovery-freeze">legacy freeze</button>
            <button id="recovery-restore-latest">legacy restore</button>
          </details>
        </aside>
        <nms-command-palette></nms-command-palette>
      </section>
    `;
    const palette = document.querySelector('nms-command-palette') as HTMLElement & { commands: Array<Record<string, unknown>> };
    palette.commands = [
      { id: 'export', label: 'Export investigation', action: vi.fn() },
      { id: 'replay', label: 'Replay investigation', action: vi.fn() },
    ];
    const c = controller();
    const handle = mountDesktopInvestigationContinuity(c);
    await handle.refresh();

    expect(document.getElementById('desktop-investigation-continuity')).toBeTruthy();
    expect(document.getElementById('recovery-freeze')?.style.display).toBe('none');
    expect(document.getElementById('export-btn')?.textContent).toBe('Export .nemosyne');
    expect(palette.commands.find((command) => command.id === 'replay')?.label).toBe('Open .nemosyne');

    document.getElementById('continuity-save-now')?.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(c.saveNow).toHaveBeenCalledTimes(1);

    handle.dispose();
  });

  it('XR save and recovery actions call the same controller and present human-friendly status', async () => {
    const saveNow = vi.fn(async () => {});
    const recoverAutosave = vi.fn(async () => true);
    const c = controller({ saveNow, recoverAutosave });
    const panel = new InvestigationContinuityPanel(new THREE.Group(), c);

    await panel.activate('save');
    expect(saveNow).toHaveBeenCalledTimes(1);
    expect(panel.status).toMatch(/saved locally/i);

    await panel.activate('recover');
    expect(recoverAutosave).toHaveBeenCalledTimes(1);
    expect(panel.status).toMatch(/autosave recovered/i);
    expect(panel.status).not.toMatch(/archive:|schemaVersion|IndexedDB/i);
    panel.dispose();
  });
});
