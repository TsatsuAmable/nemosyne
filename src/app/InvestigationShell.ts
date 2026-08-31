import type { AnalystRepresentationOutcome } from './AnalystRepresentationAssessment.ts';
import type {
  ApplicationDispatchIntent,
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
}

interface ActionDefinition {
  id: string;
  label: string;
  intent: ApplicationIntent;
}

const PRIMARY_INTENT_ACTIONS: ActionDefinition[] = [
  {
    id: 'load-sample',
    label: 'Explore another dataset',
    intent: { type: 'dataset.cycle', step: 1 },
  },
  {
    id: 'run-analysis',
    label: 'Find anomalies',
    intent: { type: 'analysis.apply', operation: 'anomaly' },
  },
];

const SECONDARY_INTENT_ACTIONS: ActionDefinition[] = [
  {
    id: 'toggle-lens',
    label: 'Toggle statistical lens',
    intent: { type: 'workspace.toggleStatisticalLens' },
  },
  { id: 'undo', label: 'Undo last analysis', intent: { type: 'history.undo' } },
  { id: 'redo', label: 'Redo analysis', intent: { type: 'history.redo' } },
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createAssessmentRow(label: string, value: string, monospace = false): HTMLElement {
  const row = document.createElement('div');
  const heading = document.createElement('strong');
  heading.style.cssText =
    'color: var(--nms-color-text-secondary); font-size: var(--nms-font-size-meta);';
  heading.textContent = label;
  row.appendChild(heading);

  const valueElement = document.createElement('p');
  valueElement.style.cssText =
    `margin: var(--nms-spacing-x4) 0 0; font-size: ${monospace ? 'var(--nms-font-size-meta)' : 'var(--nms-font-size-body)'};` +
    (monospace ? ' font-family: monospace;' : '');
  valueElement.textContent = value;
  row.appendChild(valueElement);
  return row;
}

export function mountInvestigationShell(actions: InvestigationActions): InvestigationShellHandle {
  injectCssVariables();

  const root = document.createElement('section');
  root.id = 'investigation-shell';
  root.setAttribute('aria-label', 'Nemosyne investigation workspace');
  root.style.cssText = `
    position: fixed;
    inset: 0;
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

  root.appendChild(document.createElement('nms-toast-manager'));

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
      <div id="dataset-indicator" style="padding: var(--nms-spacing-x8) var(--nms-spacing-x12); background: var(--nms-color-surface-raised); border: 1px solid var(--nms-color-surface-border); border-radius: var(--nms-panel-border-radius); font-size: var(--nms-font-size-label); color: var(--nms-color-text-secondary);">No dataset selected</div>
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
  canvasArea.style.cssText = 'grid-area: canvas; position: relative; pointer-events: none;';
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

  const commandPalette = document.createElement(
    'nms-command-palette',
  ) as HTMLNemosyneCommandPaletteElement;
  root.appendChild(commandPalette);

  const datasetIndicator = header.querySelector('#dataset-indicator') as HTMLElement;
  const statusMessage = statusStrip.querySelector('#status-message') as HTMLElement;
  const statusDetails = statusStrip.querySelector('#status-details') as HTMLElement;
  const primaryActions = primarySection.querySelector('#primary-actions') as HTMLElement;
  const secondaryActions = secondarySection.querySelector('#secondary-actions') as HTMLElement;
  const exportBtn = header.querySelector('#export-btn') as HTMLElement;
  const settingsBtn = header.querySelector('#settings-btn') as HTMLElement;

  let lastExport: Uint8Array | null = null;
  let statusTimer: number | null = null;

  const refreshContext = (): void => {
    const dataset = actions.currentDatasetName();
    datasetIndicator.textContent = dataset
      ? `Dataset · ${dataset}`
      : 'No dataset selected · choose data to begin';
  };

  const setStatus = (
    message: string,
    state: 'ready' | 'success' | 'error' = 'ready',
    detail?: string,
  ): void => {
    if (statusTimer !== null) {
      window.clearTimeout(statusTimer);
      statusTimer = null;
    }
    statusMessage.textContent = message;
    statusMessage.style.color =
      state === 'error'
        ? 'var(--nms-color-danger-destructive)'
        : state === 'success'
          ? 'var(--nms-color-interaction-commit)'
          : 'var(--nms-color-text-secondary)';
    statusDetails.textContent = detail ?? '';
    refreshContext();
    if (state !== 'ready') {
      statusTimer = window.setTimeout(() => {
        if (statusMessage.textContent === message) {
          statusMessage.textContent = 'Ready';
          statusMessage.style.color = 'var(--nms-color-text-secondary)';
          statusDetails.textContent = '';
        }
        statusTimer = null;
      }, 5000);
    }
  };

  const reportError = (context: string, error: unknown): void => {
    const message = errorMessage(error);
    console.error(`[InvestigationShell] ${context}:`, error);
    setStatus(`${context} failed`, 'error', message);
  };

  const dispatchWithStatus = async (
    intent: ApplicationDispatchIntent,
    successMessage: () => string,
    failureContext: string,
  ): Promise<boolean> => {
    try {
      await actions.dispatchIntent(intent);
      setStatus(successMessage(), 'success');
      return true;
    } catch (error) {
      reportError(failureContext, error);
      return false;
    }
  };

  const showRepresentationOutcome = (outcome: AnalystRepresentationOutcome): void => {
    const content = document.createElement('div');
    content.style.cssText = 'display: grid; gap: var(--nms-spacing-x16);';

    if (outcome.kind === 'decision') {
      content.appendChild(
        createAssessmentRow('Decision', `Moneta selected ${outcome.family} / ${outcome.layout}`),
      );
      content.appendChild(
        createAssessmentRow('Utility Score', outcome.utilityScore.toFixed(3)),
      );
      content.appendChild(createAssessmentRow('Decision ID', outcome.decisionId, true));
    } else {
      const refusal = document.createElement('strong');
      refusal.style.color = 'var(--nms-color-epistemic-contradiction)';
      refusal.textContent = 'No feasible representation';
      content.appendChild(refusal);
      content.appendChild(
        createAssessmentRow('Failed Constraints', String(outcome.failedConstraintCount)),
      );
      content.appendChild(
        createAssessmentRow('Near-miss Alternatives', String(outcome.nearMissCount)),
      );
      content.appendChild(createAssessmentRow('NIL', outcome.nilId, true));
    }

    explainModal.replaceChildren(content);
    explainModal.dataset.state = outcome.kind;
    (explainModal as HTMLNemosyneModalElement).show();
  };

  const runAssessment = (maxRenderedElements?: number): void => {
    try {
      const outcome = actions.assessRepresentation(maxRenderedElements);
      showRepresentationOutcome(outcome);
      setStatus(
        outcome.kind === 'decision'
          ? `View decision recorded: ${outcome.decisionId}`
          : `NIL outcome recorded: ${outcome.nilId}`,
        'success',
      );
    } catch (error) {
      reportError('Representation assessment', error);
    }
  };

  const createButton = (
    id: string,
    label: string,
    container: HTMLElement,
    variant: 'primary' | 'secondary',
    size: 'sm' | 'md',
    onClick: () => void | Promise<void>,
  ): HTMLElement => {
    const button = document.createElement('nms-button');
    button.id = id;
    button.textContent = label;
    button.setAttribute('variant', variant);
    button.setAttribute('size', size);
    button.style.width = '100%';
    button.addEventListener('click', () => {
      void Promise.resolve(onClick()).catch((error: unknown) => reportError(label, error));
    });
    container.appendChild(button);
    return button;
  };

  for (const action of PRIMARY_INTENT_ACTIONS) {
    createButton(
      `action-${action.id}`,
      action.label,
      primaryActions,
      action.id === 'load-sample' ? 'primary' : 'secondary',
      'md',
      async () => {
        if (action.id === 'load-sample') {
          await dispatchWithStatus(
            action.intent,
            () => `Loaded ${actions.currentDatasetName() ?? 'sample dataset'}`,
            'Dataset change',
          );
        } else {
          await dispatchWithStatus(
            action.intent,
            () => {
              const count = actions.analysisResultCount();
              return `Evidence ready (${count} ${count === 1 ? 'result' : 'results'})`;
            },
            'Analysis',
          );
        }
      },
    );
  }

  createButton(
    'action-mark-moment',
    'Record observation',
    primaryActions,
    'secondary',
    'md',
    () => {
      const observationId = actions.markMoment('Recorded from desktop investigation shell');
      setStatus(`Observation recorded: ${observationId}`, 'success');
    },
  );

  for (const action of SECONDARY_INTENT_ACTIONS) {
    createButton(
      `action-${action.id}`,
      action.label,
      secondaryActions,
      'secondary',
      'sm',
      async () => {
        await dispatchWithStatus(
          action.intent,
          () => `${action.label} executed`,
          action.label,
        );
      },
    );
  }

  const budgetWrapper = document.createElement('div');
  budgetWrapper.style.cssText =
    'display: flex; flex-direction: column; gap: var(--nms-spacing-x4);';
  budgetWrapper.innerHTML = `
    <label for="max-elements" style="font-size: var(--nms-font-size-meta); color: var(--nms-color-text-secondary);">Max rendered elements (optional)</label>
    <input type="number" id="max-elements" min="1" step="1" inputmode="numeric" style="width: 100%; box-sizing: border-box; padding: var(--nms-spacing-x8) var(--nms-spacing-x12); background: var(--nms-color-surface-raised); border: 1px solid var(--nms-color-surface-border); border-radius: var(--nms-panel-border-radius); color: var(--nms-color-text-primary); font-family: inherit; font-size: var(--nms-font-size-label);">
    <nms-button id="assess-btn" variant="secondary" size="sm">Explain current view</nms-button>
  `;
  secondaryActions.appendChild(budgetWrapper);

  const assessBtn = budgetWrapper.querySelector('#assess-btn') as HTMLElement;
  assessBtn.addEventListener('click', () => {
    const input = budgetWrapper.querySelector('#max-elements') as HTMLInputElement;
    const rawBudget = input.value.trim();
    runAssessment(rawBudget ? Number(rawBudget) : undefined);
  });

  const exportInvestigation = async (): Promise<void> => {
    try {
      const bytes = await actions.exportPortableInvestigation();
      lastExport = bytes;
      downloadPackage(bytes, 'nemosyne-investigation.nemosyne');
      setStatus(`Investigation exported (${bytes.byteLength} bytes)`, 'success');
    } catch (error) {
      reportError('Investigation export', error);
    }
  };
  exportBtn.addEventListener('click', () => void exportInvestigation());

  const openSettings = async (): Promise<void> => {
    await dispatchWithStatus(
      { type: 'settings.open' },
      () => 'Settings opened',
      'Settings',
    );
  };
  settingsBtn.addEventListener('click', () => void openSettings());

  replayModal.innerHTML = `
    <div style="display: grid; gap: var(--nms-spacing-x16);">
      <label>
        <span style="font-size: var(--nms-font-size-meta); color: var(--nms-color-text-secondary); display: block; margin-bottom: var(--nms-spacing-x4);">Investigation package</span>
        <input type="file" id="package-input" accept=".nemosyne,application/zip" style="width: 100%; box-sizing: border-box; padding: var(--nms-spacing-x8); background: var(--nms-color-surface-raised); border: 1px solid var(--nms-color-surface-border); border-radius: var(--nms-panel-border-radius); color: var(--nms-color-text-primary); font-family: inherit;">
      </label>
      <nms-button id="replay-btn" variant="primary" disabled>Replay investigation</nms-button>
      <p id="replay-status" aria-live="polite" style="font-size: var(--nms-font-size-meta); color: var(--nms-color-text-secondary); margin: 0;"></p>
    </div>
  `;

  const packageInput = replayModal.querySelector('#package-input') as HTMLInputElement;
  const replayBtn = replayModal.querySelector('#replay-btn') as HTMLElement;
  const replayStatus = replayModal.querySelector('#replay-status') as HTMLElement;

  packageInput.addEventListener('change', () => {
    const file = packageInput.files?.[0];
    if (!file) {
      lastExport = null;
      replayBtn.setAttribute('disabled', '');
      replayStatus.textContent = 'Choose an investigation package to replay.';
      return;
    }

    void file.arrayBuffer()
      .then((bytes) => {
        lastExport = new Uint8Array(bytes);
        replayBtn.removeAttribute('disabled');
        replayStatus.textContent = `Selected: ${file.name} (${bytes.byteLength} bytes)`;
        replayStatus.style.color = 'var(--nms-color-text-secondary)';
      })
      .catch((error: unknown) => {
        lastExport = null;
        replayBtn.setAttribute('disabled', '');
        replayStatus.textContent = `Error: ${errorMessage(error)}`;
        replayStatus.style.color = 'var(--nms-color-danger-destructive)';
      });
  });

  replayBtn.addEventListener('click', () => {
    if (!lastExport) return;
    replayBtn.setAttribute('disabled', '');
    replayStatus.textContent = 'Verifying investigation package…';
    replayStatus.style.color = 'var(--nms-color-text-secondary)';

    void actions.replayPortableInvestigation(lastExport)
      .then((result) => {
        if (!result.success) {
          replayStatus.textContent = replayFailureMessage(result.discrepancies.join('; '));
          replayStatus.style.color = 'var(--nms-color-danger-destructive)';
          return;
        }
        replayStatus.textContent = `Replay verified (${result.eventsMatched} events)`;
        replayStatus.style.color = 'var(--nms-color-interaction-commit)';
      })
      .catch((error: unknown) => {
        replayStatus.textContent = replayFailureMessage(errorMessage(error));
        replayStatus.style.color = 'var(--nms-color-danger-destructive)';
      })
      .finally(() => replayBtn.removeAttribute('disabled'));
  });

  const unsubscribeDatasetContext = actions.subscribeDatasetContext?.(refreshContext) ?? null;

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.metaKey || event.ctrlKey) {
      if (event.key.toLowerCase() === 'e') {
        event.preventDefault();
        exportBtn.click();
      } else if (event.key === ',') {
        event.preventDefault();
        settingsBtn.click();
      }
    }

    if (event.key === 'Escape') {
      (explainModal as HTMLNemosyneModalElement).hide();
      (replayModal as HTMLNemosyneModalElement).hide();
      commandPalette.hide();
    }
  };
  document.addEventListener('keydown', handleKeyDown);

  const commands: CommandPaletteCommand[] = [
    {
      id: 'load-sample',
      label: 'Explore another dataset',
      description: 'Cycle to the next sample dataset',
      category: 'Data',
      action: async () => {
        await dispatchWithStatus(
          { type: 'dataset.cycle', step: 1 },
          () => `Loaded ${actions.currentDatasetName() ?? 'sample dataset'}`,
          'Dataset change',
        );
      },
    },
    {
      id: 'run-analysis',
      label: 'Find anomalies',
      description: 'Run anomaly detection on current dataset',
      category: 'Analysis',
      action: async () => {
        await dispatchWithStatus(
          { type: 'analysis.apply', operation: 'anomaly' },
          () => {
            const count = actions.analysisResultCount();
            return `Evidence ready (${count} ${count === 1 ? 'result' : 'results'})`;
          },
          'Analysis',
        );
      },
    },
    {
      id: 'mark-moment',
      label: 'Record observation',
      description: 'Mark current moment in the evidence ledger',
      category: 'Investigation',
      action: () => {
        const observationId = actions.markMoment('Recorded from desktop investigation shell');
        setStatus(`Observation recorded: ${observationId}`, 'success');
      },
    },
    {
      id: 'export',
      label: 'Export investigation',
      description: 'Export current investigation as a .nemosyne package',
      shortcut: '⌘E',
      category: 'Investigation',
      action: exportInvestigation,
    },
    {
      id: 'toggle-lens',
      label: 'Toggle statistical lens',
      description: 'Show or hide statistical analysis views',
      category: 'View',
      action: async () => {
        await dispatchWithStatus(
          { type: 'workspace.toggleStatisticalLens' },
          () => 'Statistical lens toggled',
          'Statistical lens',
        );
      },
    },
    {
      id: 'undo',
      label: 'Undo last analysis',
      description: 'Revert the last analysis operation',
      category: 'History',
      action: async () => {
        await dispatchWithStatus(
          { type: 'history.undo' },
          () => 'Analysis history moved back',
          'Undo',
        );
      },
    },
    {
      id: 'redo',
      label: 'Redo analysis',
      description: 'Reapply the last undone analysis operation',
      category: 'History',
      action: async () => {
        await dispatchWithStatus(
          { type: 'history.redo' },
          () => 'Analysis history moved forward',
          'Redo',
        );
      },
    },
    {
      id: 'assess',
      label: 'Explain current view',
      description: 'Show Moneta representation decision details',
      category: 'View',
      action: () => runAssessment(),
    },
    {
      id: 'settings',
      label: 'Open settings',
      description: 'Configure Nemosyne preferences',
      shortcut: '⌘,',
      category: 'System',
      action: openSettings,
    },
    {
      id: 'replay',
      label: 'Replay investigation',
      description: 'Verify and replay a .nemosyne package',
      category: 'Investigation',
      action: () => (replayModal as HTMLNemosyneModalElement).show(),
    },
  ];
  commandPalette.commands = commands;

  document.body.appendChild(root);
  setStatus('Ready');
  refreshContext();

  return {
    dispose: () => {
      unsubscribeDatasetContext?.();
      document.removeEventListener('keydown', handleKeyDown);
      if (statusTimer !== null) window.clearTimeout(statusTimer);
      root.remove();
    },
    refreshContext,
  };
}
