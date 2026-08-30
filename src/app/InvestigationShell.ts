import type { AnalystRepresentationOutcome } from './AnalystRepresentationAssessment.ts';
import type {
  ApplicationDispatchIntentDispatcher,
  ApplicationIntent,
} from './intents/ApplicationIntent.ts';
import { injectCssVariables } from '../vr/ui-system/tokens.ts';
import { type CommandPaletteCommand } from '../ui/components/index.ts';

interface HTMLNemosyneModalElement extends HTMLElement {
  show(): void;
  hide(): void;
}

interface HTMLNemosyneCommandPaletteElement extends HTMLElement {
  toggle(): void;
  hide(): void;
  commands: CommandPaletteCommand[];
}

export interface InvestigationShellHandle {
  dispose(): void;
  refreshContext(): void;
}

export interface InvestigationActions {
  dispatchIntent: ApplicationDispatchIntentDispatcher;
  currentDatasetName(): string | null;
  subscribeDatasetContext?(handler: () => void): () => void;
  assessRepresentation(maxRenderedElements?: number): AnalystRepresentationOutcome;
  analysisResultCount(): number;
  markMoment(note: string): string;
  replayPortableInvestigation(bytes: Uint8Array): Promise<{
    success: boolean;
    discrepancies: string[];
    eventsMatched: number;
  }>;
  exportPortableInvestigation(): Promise<Uint8Array>;
  setDatasetPickerVisible?(visible: boolean): void;
  isDatasetPickerVisible?(): boolean;
}

interface PrimaryAction {
  id: string;
  label: string;
  intent: ApplicationIntent | null;
  emphasis?: boolean;
  handler?: () => void | Promise<void>;
}

interface SecondaryAction {
  id: string;
  label: string;
  intent: ApplicationIntent | null;
  handler?: () => void | Promise<void>;
}

const PRIMARY_ACTIONS: PrimaryAction[] = [
  { id: 'load-sample', label: 'Explore another dataset', intent: { type: 'dataset.cycle', step: 1 }, emphasis: true },
  { id: 'run-analysis', label: 'Find anomalies', intent: { type: 'analysis.apply', operation: 'anomaly' } },
  { id: 'mark-moment', label: 'Record observation', intent: null, handler: () => {} },
];

const SECONDARY_ACTIONS: SecondaryAction[] = [
  { id: 'toggle-lens', label: 'Toggle statistical lens', intent: { type: 'workspace.toggleStatisticalLens' } },
  { id: 'undo', label: 'Undo last analysis', intent: { type: 'history.undo' } },
  { id: 'redo', label: 'Redo analysis', intent: { type: 'history.redo' } },
  { id: 'vault', label: 'Evidence vault', intent: null },
];

function downloadPackage(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function replayFailureMessage(detail: string): string {
  const normalized = detail.trim() || 'integrity mismatch';
  const bounded = normalized.length > 400 ? `${normalized.slice(0, 400)}…` : normalized;
  return (
    `Replay verification failed: ${bounded}. ` +
    'Source investigation unchanged; choose another .nemosyne package and retry.'
  );
}

export function mountInvestigationShell(
  actions: InvestigationActions,
): InvestigationShellHandle {
  injectCssVariables();

  const root = document.createElement('section');
  root.id = 'investigation-shell';
  root.setAttribute('aria-label', 'Nemosyne investigation workspace');
  root.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 30;
    display: grid;
    grid-template-columns: 280px 1fr;
    grid-template-rows: auto 1fr auto;
    grid-template-areas:
      "header header"
      "sidebar canvas"
      "status status";
    background: transparent;
    font-family: var(--nms-font-family);
    color: var(--nms-color-text-primary);
    pointer-events: none;
  `;

  const toastManager = document.createElement('nms-toast-manager');
  root.appendChild(toastManager);

  const header = document.createElement('header');
  header.style.cssText = `
    grid-area: header;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--nms-spacing-x16) var(--nms-spacing-x24);
    background: var(--nms-color-surface-base);
    border-bottom: 1px solid var(--nms-color-surface-border);
    pointer-events: auto;
    z-index: 10;
  `;
  header.innerHTML = `
    <div style="display: flex; align-items: center; gap: var(--nms-spacing-x16);">
      <span style="font-size: var(--nms-font-size-meta); letter-spacing: 0.16em; color: var(--nms-color-interaction-focus); font-weight: 650;">NEMOSYNE</span>
      <div style="padding: var(--nms-spacing-x8) var(--nms-spacing-x12); background: var(--nms-color-surface-raised); border: 1px solid var(--nms-color-surface-border); border-radius: var(--nms-panel-border-radius); font-size: var(--nms-font-size-label); color: var(--nms-color-text-secondary);" id="dataset-indicator">No dataset selected</div>
    </div>
    <div style="display: flex; align-items: center; gap: var(--nms-spacing-x12);">
      <nms-button id="export-btn" variant="ghost" size="sm">Export investigation</nms-button>
      <nms-button id="settings-btn" variant="ghost" size="sm">Settings</nms-button>
    </div>
  `;
  root.appendChild(header);

  const sidebar = document.createElement('aside');
  sidebar.style.cssText = `
    grid-area: sidebar;
    display: flex;
    flex-direction: column;
    gap: var(--nms-spacing-x16);
    padding: var(--nms-spacing-x16);
    background: var(--nms-color-surface-base);
    border-right: 1px solid var(--nms-color-surface-border);
    overflow-y: auto;
    pointer-events: auto;
  `;

  const primarySection = document.createElement('div');
  primarySection.innerHTML = `
    <h2 style="font-size: var(--nms-font-size-meta); letter-spacing: 0.1em; color: var(--nms-color-interaction-focus); font-weight: 650; margin: 0 0 var(--nms-spacing-x12);">Primary Actions</h2>
    <div id="primary-actions" style="display: flex; flex-direction: column; gap: var(--nms-spacing-x8);"></div>
  `;
  sidebar.appendChild(primarySection);

  const secondarySection = document.createElement('details');
  secondarySection.innerHTML = `
    <summary style="cursor: pointer; color: var(--nms-color-text-secondary); font-size: var(--nms-font-size-meta); font-weight: 500; margin-bottom: var(--nms-spacing-x8);">More tools</summary>
    <div id="secondary-actions" style="display: flex; flex-direction: column; gap: var(--nms-spacing-x8); margin-top: var(--nms-spacing-x8); padding-top: var(--nms-spacing-x12); border-top: 1px solid var(--nms-color-surface-border);"></div>
  `;
  sidebar.appendChild(secondarySection);
  root.appendChild(sidebar);

  const canvasArea = document.createElement('div');
  canvasArea.style.cssText = `
    grid-area: canvas;
    position: relative;
    pointer-events: auto;
  `;
  root.appendChild(canvasArea);

  const statusStrip = document.createElement('footer');
  statusStrip.style.cssText = `
    grid-area: status;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--nms-spacing-x8) var(--nms-spacing-x16);
    background: var(--nms-color-surface-base);
    border-top: 1px solid var(--nms-color-surface-border);
    font-size: var(--nms-font-size-meta);
    color: var(--nms-color-text-secondary);
    pointer-events: auto;
  `;
  statusStrip.innerHTML = `
    <span id="status-message">Ready</span>
    <span id="status-details" style="display: flex; gap: var(--nms-spacing-x16);"></span>
  `;
  root.appendChild(statusStrip);

  const explainModal = document.createElement('nms-modal');
  explainModal.setAttribute('size', 'md');
  explainModal.setAttribute('title', 'Representation Assessment');
  root.appendChild(explainModal);

  const replayModal = document.createElement('nms-modal');
  replayModal.setAttribute('size', 'md');
  replayModal.setAttribute('title', 'Replay Investigation');
  root.appendChild(replayModal);

  const datasetModal = document.createElement('nms-modal');
  datasetModal.setAttribute('size', 'lg');
  datasetModal.setAttribute('title', 'Choose Dataset');
  root.appendChild(datasetModal);

  const commandPalette = document.createElement('nms-command-palette') as HTMLNemosyneCommandPaletteElement;
  root.appendChild(commandPalette);

  let lastExport: Uint8Array | null = null;

  const datasetIndicator = header.querySelector('#dataset-indicator') as HTMLElement;
  const statusMessage = statusStrip.querySelector('#status-message') as HTMLElement;
  const statusDetails = statusStrip.querySelector('#status-details') as HTMLElement;
  const primaryActionsContainer = primarySection.querySelector('#primary-actions') as HTMLElement;
  const secondaryActionsContainer = secondarySection.querySelector('#secondary-actions') as HTMLElement;

  const refreshContext = () => {
    const dataset = actions.currentDatasetName();
    datasetIndicator.textContent = dataset ? `Dataset · ${dataset}` : 'No dataset selected · choose data to begin';
  };

  const setStatus = (message: string, state: 'ready' | 'success' | 'error' = 'ready', detail?: string) => {
    statusMessage.textContent = message;
    statusMessage.style.color = state === 'error' ? 'var(--nms-color-danger-destructive)' : state === 'success' ? 'var(--nms-color-interaction-commit)' : 'var(--nms-color-text-secondary)';
    if (detail) {
      statusDetails.textContent = detail;
    }
    refreshContext();
    if (state !== 'ready') {
      setTimeout(() => {
        if (statusMessage.textContent === message) {
          statusMessage.textContent = 'Ready';
          statusMessage.style.color = 'var(--nms-color-text-secondary)';
        }
      }, 5000);
    }
  };

  const showRepresentationOutcome = (outcome: AnalystRepresentationOutcome) => {
    let content = '';
    if (outcome.kind === 'decision') {
      content = `
        <div style="display: grid; gap: var(--nms-spacing-x16);">
          <div>
            <strong style="color: var(--nms-color-text-secondary); font-size: var(--nms-font-size-meta);">Decision</strong>
            <p style="margin: var(--nms-spacing-x4) 0 0; font-size: var(--nms-font-size-body);">Moneta selected <strong>${outcome.family} / ${outcome.layout}</strong></p>
          </div>
          <div>
            <strong style="color: var(--nms-color-text-secondary); font-size: var(--nms-font-size-meta);">Utility Score</strong>
            <p style="margin: var(--nms-spacing-x4) 0 0; font-size: var(--nms-font-size-body);">${outcome.utilityScore.toFixed(3)}</p>
          </div>
          <div>
            <strong style="color: var(--nms-color-text-secondary); font-size: var(--nms-font-size-meta);">Decision ID</strong>
            <p style="margin: var(--nms-spacing-x4) 0 0; font-size: var(--nms-font-size-meta); font-family: monospace;">${outcome.decisionId}</p>
          </div>
        </div>
      `;
    } else {
      content = `
        <div style="display: grid; gap: var(--nms-spacing-x16);">
          <div style="color: var(--nms-color-epistemic-contradiction);">
            <strong>No feasible representation</strong>
          </div>
          <div>
            <strong style="color: var(--nms-color-text-secondary); font-size: var(--nms-font-size-meta);">Failed Constraints</strong>
            <p style="margin: var(--nms-spacing-x4) 0 0; font-size: var(--nms-font-size-body);">${outcome.failedConstraintCount}</p>
          </div>
          <div>
            <strong style="color: var(--nms-color-text-secondary); font-size: var(--nms-font-size-meta);">Near-miss Alternatives</strong>
            <p style="margin: var(--nms-spacing-x4) 0 0; font-size: var(--nms-font-size-body);">${outcome.nearMissCount}</p>
          </div>
          <p style="font-size: var(--nms-font-size-meta); color: var(--nms-color-text-secondary);">NIL: ${outcome.nilId}</p>
        </div>
      `;
    }
    // Modal owns a persistent light-DOM slot. Write there before show(); its
    // shadow render may be recreated without destroying the caller's content.
    explainModal.innerHTML = content;
    (explainModal as HTMLNemosyneModalElement).show();
  };

  const createActionButton = (action: PrimaryAction, container: HTMLElement) => {
    const btn = document.createElement('nms-button');
    btn.id = `action-${action.id}`;
    btn.setAttribute('label', action.label);
    btn.setAttribute('variant', action.emphasis ? 'primary' : 'secondary');
    btn.setAttribute('size', 'md');
    btn.style.width = '100%';
    btn.addEventListener('click', async () => {
      if (action.intent) {
        await actions.dispatchIntent(action.intent);
      } else if (action.handler) {
        await action.handler();
      }
    });
    container.appendChild(btn);
  };

  const createSecondaryButton = (action: SecondaryAction, container: HTMLElement) => {
    const btn = document.createElement('nms-button');
    btn.id = `action-${action.id}`;
    btn.setAttribute('label', action.label);
    btn.setAttribute('variant', 'secondary');
    btn.setAttribute('size', 'sm');
    btn.style.width = '100%';
    btn.addEventListener('click', async () => {
      if (action.intent) {
        await actions.dispatchIntent(action.intent);
        setStatus(`${action.label} executed`, 'success');
      } else if (action.handler) {
        await action.handler();
      }
    });
    container.appendChild(btn);
  };

  PRIMARY_ACTIONS.forEach(action => createActionButton(action, primaryActionsContainer));
  SECONDARY_ACTIONS.forEach(action => createSecondaryButton(action, secondaryActionsContainer));

  const budgetWrapper = document.createElement('div');
  budgetWrapper.style.display = 'flex';
  budgetWrapper.style.flexDirection = 'column';
  budgetWrapper.style.gap = 'var(--nms-spacing-x4)';
  budgetWrapper.innerHTML = `
    <label style="font-size: var(--nms-font-size-meta); color: var(--nms-color-text-secondary);">Max rendered elements (optional)</label>
    <input type="number" id="max-elements" min="1" step="1" inputmode="numeric" style="width: 100%; padding: var(--nms-spacing-x8) var(--nms-spacing-x12); background: var(--nms-color-surface-raised); border: 1px solid var(--nms-color-surface-border); border-radius: var(--nms-panel-border-radius); color: var(--nms-color-text-primary); font-family: inherit; font-size: var(--nms-font-size-label);">
    <nms-button id="assess-btn" variant="secondary" size="sm">Explain current view</nms-button>
  `;
  secondaryActionsContainer.appendChild(budgetWrapper);

  const exportBtn = header.querySelector('#export-btn') as HTMLElement;
  exportBtn.addEventListener('click', async () => {
    const bytes = await actions.exportPortableInvestigation();
    lastExport = bytes;
    downloadPackage(bytes, 'nemosyne-investigation.nemosyne');
    setStatus(`Investigation exported (${bytes.byteLength} bytes)`, 'success');
  });

  const settingsBtn = header.querySelector('#settings-btn') as HTMLElement;
  settingsBtn.addEventListener('click', () => {
    void actions.dispatchIntent({ type: 'settings.open' });
    setStatus('Settings opened', 'success');
  });

  const assessBtn = budgetWrapper.querySelector('#assess-btn') as HTMLElement;
  assessBtn.addEventListener('click', () => {
    const rawBudget = (document.getElementById('max-elements') as HTMLInputElement)?.value.trim();
    const outcome = actions.assessRepresentation(rawBudget.length > 0 ? Number(rawBudget) : undefined);
    showRepresentationOutcome(outcome);
    setStatus(outcome.kind === 'decision' ? `View decision recorded: ${outcome.decisionId}` : `NIL outcome recorded: ${outcome.nilId}`, 'success');
  });

  const replayContent = `
    <div style="display: grid; gap: var(--nms-spacing-x16);">
      <label>
        <span style="font-size: var(--nms-font-size-meta); color: var(--nms-color-text-secondary); display: block; margin-bottom: var(--nms-spacing-x4);">Investigation package</span>
        <input type="file" id="package-input" accept=".nemosyne,application/zip" style="width: 100%; padding: var(--nms-spacing-x8); background: var(--nms-color-surface-raised); border: 1px solid var(--nms-color-surface-border); border-radius: var(--nms-panel-border-radius); color: var(--nms-color-text-primary); font-family: inherit;">
      </label>
      <nms-button id="replay-btn" variant="primary" disabled>Replay investigation</nms-button>
      <p id="replay-status" style="font-size: var(--nms-font-size-meta); color: var(--nms-color-text-secondary); margin: 0;"></p>
    </div>
  `;
  replayModal.innerHTML = replayContent;

  const packageInput = replayModal.querySelector('#package-input') as HTMLInputElement;
  const replayBtn = replayModal.querySelector('#replay-btn') as HTMLElement;
  const replayStatus = replayModal.querySelector('#replay-status') as HTMLElement;

  if (packageInput) {
    packageInput.addEventListener('change', () => {
      const file = packageInput.files?.[0];
      if (!file) return;
      file.arrayBuffer().then(bytes => {
        lastExport = new Uint8Array(bytes);
        replayBtn.removeAttribute('disabled');
        if (replayStatus) replayStatus.textContent = `Selected: ${file.name} (${bytes.byteLength} bytes)`;
      }).catch(err => {
        if (replayStatus) {
          replayStatus.textContent = `Error: ${err.message}`;
          replayStatus.style.color = 'var(--nms-color-danger-destructive)';
        }
      });
    });
  }

  if (replayBtn) {
    replayBtn.addEventListener('click', () => {
      if (!lastExport) return;
      replayBtn.setAttribute('disabled', '');
      if (replayStatus) {
        replayStatus.textContent = 'Verifying investigation package…';
        replayStatus.style.color = 'var(--nms-color-text-secondary)';
      }
      actions.replayPortableInvestigation(lastExport).then(result => {
        if (!result.success) {
          if (replayStatus) {
            replayStatus.textContent = replayFailureMessage(result.discrepancies.join('; '));
            replayStatus.style.color = 'var(--nms-color-danger-destructive)';
          }
          return;
        }
        if (replayStatus) {
          replayStatus.textContent = `Replay verified (${result.eventsMatched} events)`;
          replayStatus.style.color = 'var(--nms-color-interaction-commit)';
        }
      }).catch(err => {
        if (replayStatus) {
          replayStatus.textContent = replayFailureMessage(err.message);
          replayStatus.style.color = 'var(--nms-color-danger-destructive)';
        }
      }).finally(() => {
        replayBtn.removeAttribute('disabled');
      });
    });
  }

  const markMomentAction = PRIMARY_ACTIONS.find(a => a.id === 'mark-moment');
  if (markMomentAction) {
    markMomentAction.handler = () => {
      const observationId = actions.markMoment('Recorded from desktop investigation shell');
      setStatus(`Observation recorded: ${observationId}`, 'success');
    };
  }

  const vaultAction = SECONDARY_ACTIONS.find(a => a.id === 'vault');
  if (vaultAction) {
    vaultAction.handler = () => {
      setStatus('Evidence vault opened in VR', 'success');
    };
  }

  const unsubscribeDatasetContext = actions.subscribeDatasetContext?.(refreshContext) ?? null;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey) {
      switch (e.key.toLowerCase()) {
        case 'e':
          e.preventDefault();
          exportBtn.click();
          break;
        case 's':
          e.preventDefault();
          settingsBtn.click();
          break;
      }
    }
    if (e.key === 'Escape') {
      const modals: Array<HTMLNemosyneModalElement | HTMLNemosyneCommandPaletteElement> = [
        explainModal as HTMLNemosyneModalElement,
        replayModal as HTMLNemosyneModalElement,
        datasetModal as HTMLNemosyneModalElement,
        commandPalette,
      ];
      modals.forEach(m => m.hide?.());
    }
  };
  document.addEventListener('keydown', handleKeyDown);

  const commands: CommandPaletteCommand[] = [
    { id: 'load-sample', label: 'Explore another dataset', description: 'Cycle to the next sample dataset', shortcut: '⌘D', category: 'Data', action: async () => { await actions.dispatchIntent({ type: 'dataset.cycle', step: 1 }); setStatus(`Loaded ${actions.currentDatasetName() ?? 'sample dataset'}`, 'success'); } },
    { id: 'run-analysis', label: 'Find anomalies', description: 'Run anomaly detection on current dataset', shortcut: '⌘A', category: 'Analysis', action: async () => { await actions.dispatchIntent({ type: 'analysis.apply', operation: 'anomaly' }); setStatus(`Evidence ready (${actions.analysisResultCount()} result)`, 'success'); } },
    { id: 'mark-moment', label: 'Record observation', description: 'Mark current moment in evidence ledger', shortcut: '⌘M', category: 'Investigation', action: () => { const observationId = actions.markMoment('Recorded from desktop investigation shell'); setStatus(`Observation recorded: ${observationId}`, 'success'); } },
    { id: 'export', label: 'Export investigation', description: 'Export current investigation as .nemosyne package', shortcut: '⌘E', category: 'Investigation', action: async () => { const bytes = await actions.exportPortableInvestigation(); lastExport = bytes; downloadPackage(bytes, 'nemosyne-investigation.nemosyne'); setStatus(`Investigation exported (${bytes.byteLength} bytes)`, 'success'); } },
    { id: 'toggle-lens', label: 'Toggle statistical lens', description: 'Show/hide TDA and correlation views', shortcut: '⌘L', category: 'View', action: async () => { await actions.dispatchIntent({ type: 'workspace.toggleStatisticalLens' }); setStatus('Statistical lens toggled', 'success'); } },
    { id: 'undo', label: 'Undo last analysis', description: 'Revert the last analysis operation', shortcut: '⌘Z', category: 'History', action: async () => { await actions.dispatchIntent({ type: 'history.undo' }); setStatus('Analysis history moved back', 'success'); } },
    { id: 'redo', label: 'Redo analysis', description: 'Reapply the last undone analysis operation', shortcut: '⌘⇧Z', category: 'History', action: async () => { await actions.dispatchIntent({ type: 'history.redo' }); setStatus('Analysis history moved forward', 'success'); } },
    { id: 'assess', label: 'Explain current view', description: 'Show Moneta representation decision details', category: 'View', action: () => { const outcome = actions.assessRepresentation(); showRepresentationOutcome(outcome); setStatus(outcome.kind === 'decision' ? `View decision recorded: ${outcome.decisionId}` : `NIL outcome recorded: ${outcome.nilId}`, 'success'); } },
    { id: 'vault', label: 'Open evidence vault', description: 'Manage frozen investigation snapshots', category: 'Investigation', action: () => { setStatus('Evidence vault opened in VR', 'success'); } },
    { id: 'settings', label: 'Open settings', description: 'Configure Nemosyne preferences', shortcut: '⌘,', category: 'System', action: () => { void actions.dispatchIntent({ type: 'settings.open' }); setStatus('Settings opened', 'success'); } },
    { id: 'replay', label: 'Replay investigation', description: 'Verify and replay a .nemosyne package', category: 'Investigation', action: () => { (replayModal as HTMLNemosyneModalElement).show(); } },
  ];
  commandPalette.commands = commands;

  document.body.appendChild(root);
  setStatus('Ready');
  refreshContext();

  return {
    dispose: () => {
      unsubscribeDatasetContext?.();
      document.removeEventListener('keydown', handleKeyDown);
      root.remove();
    },
    refreshContext,
  };
}
