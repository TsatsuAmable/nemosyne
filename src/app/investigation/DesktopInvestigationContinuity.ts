import type { InvestigationContinuityController } from './InvestigationContinuityController.ts';

type PaletteCommand = {
  id: string;
  label: string;
  description?: string;
  category?: string;
  shortcut?: string;
  action: () => void | Promise<void>;
};

type PaletteElement = HTMLElement & { commands?: PaletteCommand[] };

export interface DesktopInvestigationContinuityHandle {
  refresh(): Promise<void>;
  dispose(): void;
}

function button(id: string, label: string): HTMLElement {
  const element = document.createElement('nms-button');
  element.id = id;
  element.textContent = label;
  element.setAttribute('label', label);
  element.setAttribute('aria-label', label);
  element.setAttribute('variant', 'secondary');
  element.setAttribute('size', 'sm');
  element.style.width = '100%';
  return element;
}

function downloadPackage(bytes: Uint8Array): void {
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], {
    type: 'application/vnd.nemosyne+zip',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `nemosyne-investigation-${new Date().toISOString().slice(0, 10)}.nemosyne`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function choosePackage(): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.nemosyne,application/vnd.nemosyne+zip,application/zip';
    input.hidden = true;
    document.body.appendChild(input);
    let settled = false;
    const finish = (value: Uint8Array | null): void => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(value);
    };
    input.addEventListener('cancel', () => finish(null), { once: true });
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return finish(null);
      void file.arrayBuffer()
        .then((buffer) => finish(new Uint8Array(buffer)))
        .catch(() => finish(null));
    }, { once: true });
    input.click();
  });
}

/** Desktop presentation for the canonical PT5D continuity controller. */
export function mountDesktopInvestigationContinuity(
  continuity: InvestigationContinuityController,
): DesktopInvestigationContinuityHandle {
  const shell = document.getElementById('investigation-shell');
  const sidebar = shell?.querySelector('aside');
  if (!(sidebar instanceof HTMLElement)) {
    return { refresh: async () => {}, dispose: () => {} };
  }

  const section = document.createElement('details');
  section.id = 'desktop-investigation-continuity';
  section.open = true;
  section.style.cssText = `
    border-top: 1px solid var(--nms-color-surface-border);
    padding-top: var(--nms-spacing-x12);
  `;
  const summary = document.createElement('summary');
  summary.textContent = 'Save & recover';
  summary.style.cssText = `
    cursor: pointer;
    color: var(--nms-color-text-secondary);
    font-size: var(--nms-font-size-meta);
    font-weight: 500;
  `;
  section.appendChild(summary);

  const body = document.createElement('div');
  body.style.cssText = 'display: grid; gap: var(--nms-spacing-x8); margin-top: var(--nms-spacing-x8);';
  section.appendChild(body);

  const state = document.createElement('p');
  state.id = 'continuity-state';
  state.style.cssText = 'margin: 0; color: var(--nms-color-text-secondary); font-size: var(--nms-font-size-meta); line-height: 1.35;';
  body.appendChild(state);

  const save = button('continuity-save-now', 'Save now');
  const checkpoint = button('continuity-checkpoint', 'Create checkpoint');
  const restore = button('continuity-restore-checkpoint', 'Restore latest checkpoint');
  const recover = button('continuity-recover-autosave', 'Recover autosave');
  const exportButton = button('continuity-export-package', 'Export .nemosyne');
  const openButton = button('continuity-open-package', 'Open .nemosyne');
  body.append(save, checkpoint, restore, recover, exportButton, openButton);

  const feedback = document.createElement('p');
  feedback.id = 'continuity-feedback';
  feedback.setAttribute('role', 'status');
  feedback.setAttribute('aria-live', 'polite');
  feedback.style.cssText = 'margin: 0; color: var(--nms-color-text-secondary); font-size: var(--nms-font-size-meta); line-height: 1.35; overflow-wrap: anywhere;';
  body.appendChild(feedback);

  const reviewRail = sidebar.querySelector('#desktop-review-recovery-rail');
  if (reviewRail) reviewRail.insertAdjacentElement('afterend', section);
  else sidebar.appendChild(section);

  const run = async (element: HTMLElement, pending: string, action: () => Promise<string>): Promise<void> => {
    element.setAttribute('disabled', '');
    feedback.textContent = pending;
    try {
      feedback.textContent = await action();
    } catch (error) {
      feedback.textContent = error instanceof Error ? error.message : String(error);
    } finally {
      element.removeAttribute('disabled');
      await refresh();
    }
  };

  const refresh = async (): Promise<void> => {
    try {
      const summaryState = await continuity.summary();
      const latest = summaryState.latestCheckpoint;
      state.textContent = latest
        ? `${summaryState.checkpointCount} ${summaryState.checkpointCount === 1 ? 'checkpoint' : 'checkpoints'} · latest ${latest.label} · ${latest.discoveryCount} discoveries`
        : 'No checkpoints yet';
      restore.toggleAttribute('disabled', !latest);
      if (summaryState.canRecoverAutosave !== null) {
        recover.toggleAttribute('disabled', !summaryState.canRecoverAutosave);
      }
    } catch (error) {
      state.textContent = `Continuity status unavailable · ${error instanceof Error ? error.message : String(error)}`;
    }
  };

  save.addEventListener('click', () => void run(save, 'Saving current investigation…', async () => {
    await continuity.saveNow();
    return 'Investigation saved locally.';
  }));
  checkpoint.addEventListener('click', () => void run(checkpoint, 'Creating checkpoint…', async () => {
    const entry = await continuity.createCheckpoint();
    return `Checkpoint created · ${entry.discoveryCount} discoveries · ${entry.eventCount} evidence events.`;
  }));
  restore.addEventListener('click', () => void run(restore, 'Restoring latest checkpoint…', async () => {
    const entry = await continuity.restoreLatestCheckpoint();
    return `Checkpoint restored · ${entry.label}.`;
  }));
  recover.addEventListener('click', () => void run(recover, 'Checking autosave…', async () => {
    const restored = await continuity.recoverAutosave();
    return restored ? 'Autosave recovered.' : 'No recoverable autosave was found.';
  }));

  const exportCurrent = async (): Promise<void> => {
    await run(exportButton, 'Preparing portable investigation…', async () => {
      const bytes = await continuity.exportCurrent();
      downloadPackage(bytes);
      return `Portable investigation ready · ${bytes.byteLength} bytes.`;
    });
  };
  exportButton.addEventListener('click', () => void exportCurrent());

  const openPortable = async (): Promise<void> => {
    const bytes = await choosePackage();
    if (!bytes) {
      feedback.textContent = 'Open cancelled; current investigation unchanged.';
      return;
    }
    await run(openButton, 'Verifying investigation before opening…', async () => {
      const result = await continuity.openPortable(bytes);
      return result.message;
    });
  };
  openButton.addEventListener('click', () => void openPortable());

  // Retire the older archive buttons from the ordinary desktop rail. The
  // representation-review controls remain; continuity now owns checkpointing.
  const legacyRecovery = [
    sidebar.querySelector('#recovery-archives'),
    sidebar.querySelector('#recovery-freeze'),
    sidebar.querySelector('#recovery-restore-latest'),
  ].filter((element): element is HTMLElement => element instanceof HTMLElement);
  const legacyDisplays = legacyRecovery.map((element) => element.style.display);
  legacyRecovery.forEach((element) => { element.style.display = 'none'; });

  // Replace the shell header export node so its original direct-session click
  // handler cannot bypass the freshness/continuity controller.
  const legacyExport = document.getElementById('export-btn');
  let canonicalHeaderExport: HTMLElement | null = null;
  if (legacyExport instanceof HTMLElement && legacyExport.parentElement) {
    canonicalHeaderExport = legacyExport.cloneNode(true) as HTMLElement;
    canonicalHeaderExport.textContent = 'Export .nemosyne';
    canonicalHeaderExport.addEventListener('click', () => void exportCurrent());
    legacyExport.replaceWith(canonicalHeaderExport);
  }

  // The old shell retains a detached reference for Cmd/Ctrl+E. Capture the
  // shortcut first so that detached legacy button can never fire its old path.
  const shortcutHandler = (event: KeyboardEvent): void => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'e') {
      event.preventDefault();
      event.stopImmediatePropagation();
      void exportCurrent();
    }
  };
  document.addEventListener('keydown', shortcutHandler, true);

  // Repoint command-palette continuity verbs to the same controller and add
  // explicit save/checkpoint/recovery actions.
  const palette = shell?.querySelector('nms-command-palette') as PaletteElement | null;
  const originalCommands = palette?.commands ? [...palette.commands] : null;
  if (palette?.commands) {
    const rewritten = palette.commands.map((command) => {
      if (command.id === 'export') {
        return { ...command, label: 'Export .nemosyne', action: exportCurrent };
      }
      if (command.id === 'replay') {
        return {
          ...command,
          label: 'Open .nemosyne',
          description: 'Verify and reopen a resumable Nemosyne investigation',
          action: openPortable,
        };
      }
      return command;
    });
    rewritten.push(
      {
        id: 'save-investigation',
        label: 'Save now',
        description: 'Save the current investigation locally',
        category: 'Investigation',
        action: () => continuity.saveNow(),
      },
      {
        id: 'checkpoint-investigation',
        label: 'Create checkpoint',
        description: 'Freeze an immutable investigation checkpoint',
        category: 'Investigation',
        action: async () => { await continuity.createCheckpoint(); },
      },
      {
        id: 'recover-investigation',
        label: 'Recover autosave',
        description: 'Restore the latest local autosave',
        category: 'Investigation',
        action: async () => { await continuity.recoverAutosave(); },
      },
    );
    palette.commands = rewritten;
  }

  section.addEventListener('toggle', () => { if (section.open) void refresh(); });
  void refresh();

  return {
    refresh,
    dispose: () => {
      document.removeEventListener('keydown', shortcutHandler, true);
      if (originalCommands && palette) palette.commands = originalCommands;
      if (canonicalHeaderExport?.parentElement && legacyExport instanceof HTMLElement) {
        canonicalHeaderExport.replaceWith(legacyExport);
      }
      legacyRecovery.forEach((element, index) => { element.style.display = legacyDisplays[index] ?? ''; });
      section.remove();
    },
  };
}
