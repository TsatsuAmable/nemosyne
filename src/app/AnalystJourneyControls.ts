import type { AnalystRepresentationOutcome } from './AnalystRepresentationAssessment.ts';
import type { ApplicationIntentDispatcher } from './intents/ApplicationIntent.ts';

export interface AnalystJourneyControlsHandle {
  dispose(): void;
  refreshContext(): void;
}

export interface AnalystJourneyActions {
  dispatchIntent: ApplicationIntentDispatcher;
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

export const TASK_FIRST_PRIMARY_ACTION_IDS = [
  'analyst-load-sample',
  'analyst-run-analysis',
  'analyst-mark-moment',
] as const;

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

function styleRoot(root: HTMLElement): void {
  root.style.cssText = `
    position: fixed;
    left: 18px;
    bottom: 18px;
    width: min(360px, calc(100vw - 36px));
    max-height: min(72vh, 720px);
    overflow: auto;
    z-index: 30;
    box-sizing: border-box;
    padding: 16px;
    border: 1px solid rgba(122, 220, 255, 0.42);
    border-radius: 12px;
    background: rgba(4, 10, 18, 0.88);
    color: #e8f7ff;
    font: 13px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    backdrop-filter: blur(12px);
    box-shadow: 0 14px 50px rgba(0, 0, 0, 0.28);
  `;
}

function styleButton(element: HTMLButtonElement, emphasis = false): void {
  element.style.cssText = `
    min-height: 42px;
    padding: 9px 12px;
    border-radius: 8px;
    border: 1px solid ${emphasis ? 'rgba(122, 220, 255, 0.8)' : 'rgba(180, 215, 230, 0.35)'};
    background: ${emphasis ? 'rgba(40, 130, 170, 0.28)' : 'rgba(12, 28, 40, 0.76)'};
    color: #f3fbff;
    font: inherit;
    text-align: left;
    cursor: pointer;
  `;
}

export function mountAnalystJourneyControls(
  actions: AnalystJourneyActions,
): AnalystJourneyControlsHandle {
  const root = document.createElement('section');
  root.id = 'analyst-journey-controls';
  root.dataset.shell = 'task-first';
  root.setAttribute('aria-label', 'Nemosyne investigation workspace');
  styleRoot(root);

  const eyebrow = document.createElement('div');
  eyebrow.textContent = 'NEMOSYNE';
  eyebrow.style.cssText =
    'font-size:11px;letter-spacing:.16em;color:#8bdfff;margin-bottom:4px;font-weight:650;';
  root.append(eyebrow);

  const title = document.createElement('h2');
  title.textContent = 'Investigation';
  title.style.cssText = 'font-size:20px;line-height:1.2;margin:0 0 8px;font-weight:650;';
  root.append(title);

  const workspaceContext = document.createElement('p');
  workspaceContext.id = 'analyst-workspace-context';
  workspaceContext.style.cssText = 'margin:0 0 10px;color:#b9d7e5;';
  root.append(workspaceContext);

  const status = document.createElement('p');
  status.id = 'analyst-journey-status';
  status.setAttribute('role', 'status');
  status.style.cssText = 'margin:0 0 12px;color:#e8f7ff;';
  root.append(status);

  const representationOutcome = document.createElement('p');
  representationOutcome.id = 'analyst-representation-outcome';
  representationOutcome.textContent = 'Current view: awaiting assessment';
  representationOutcome.style.cssText =
    'margin:0 0 14px;padding:9px 10px;border-left:2px solid rgba(122,220,255,.55);background:rgba(80,150,180,.08);color:#cfeaf5;';
  root.append(representationOutcome);

  const primaryHeading = document.createElement('h3');
  primaryHeading.textContent = 'What do you want to do?';
  primaryHeading.style.cssText = 'font-size:13px;margin:0 0 8px;color:#f3fbff;font-weight:650;';
  root.append(primaryHeading);

  const primaryTasks = document.createElement('div');
  primaryTasks.id = 'analyst-primary-tasks';
  primaryTasks.style.cssText = 'display:grid;grid-template-columns:1fr;gap:7px;margin-bottom:12px;';
  root.append(primaryTasks);

  let lastExport: Uint8Array | null = null;

  const refreshContext = () => {
    const dataset = actions.currentDatasetName();
    workspaceContext.textContent = dataset
      ? `Dataset · ${dataset}`
      : 'No dataset selected · choose data to begin';
  };

  const setStatus = (message: string, state: 'ready' | 'success' | 'error' = 'ready') => {
    status.dataset.state = state;
    status.setAttribute('role', state === 'error' ? 'alert' : 'status');
    status.textContent = message;
    refreshContext();
  };

  const showRepresentationOutcome = (outcome: AnalystRepresentationOutcome) => {
    representationOutcome.dataset.state = outcome.kind;
    if (outcome.kind === 'decision') {
      representationOutcome.textContent =
        `Current view · Moneta selected ${outcome.family} / ${outcome.layout} ` +
        `(utility ${outcome.utilityScore.toFixed(3)})`;
      return;
    }
    representationOutcome.textContent =
      `No feasible view · NIL: no feasible representation ` +
      `(${outcome.failedConstraintCount} constraints unresolved; ${outcome.nearMissCount} alternatives remain)`;
  };

  const button = (
    parent: HTMLElement,
    id: string,
    label: string,
    action: () => void | Promise<void>,
    emphasis = false,
  ) => {
    const element = document.createElement('button');
    element.id = id;
    element.type = 'button';
    element.textContent = label;
    styleButton(element, emphasis);
    element.addEventListener('click', () => {
      Promise.resolve(action()).catch((error: unknown) => {
        setStatus(`Error: ${error instanceof Error ? error.message : String(error)}`, 'error');
      });
    });
    parent.append(element);
    return element;
  };

  button(primaryTasks, 'analyst-load-sample', 'Explore another dataset', async () => {
    await actions.dispatchIntent({ type: 'dataset.cycle', step: 1 });
    showRepresentationOutcome(actions.assessRepresentation());
    setStatus(`Loaded ${actions.currentDatasetName() ?? 'sample dataset'}`, 'success');
  }, true);
  button(primaryTasks, 'analyst-run-analysis', 'Find anomalies', async () => {
    await actions.dispatchIntent({ type: 'analysis.apply', operation: 'anomaly' });
    setStatus(`Evidence ready (${actions.analysisResultCount()} result)`, 'success');
  });
  button(primaryTasks, 'analyst-mark-moment', 'Record observation', () => {
    const observationId = actions.markMoment('Recorded from desktop investigation shell');
    setStatus(`Observation recorded: ${observationId}`, 'success');
  });

  if (actions.setDatasetPickerVisible) {
    button(root, 'analyst-choose-data', 'Choose data…', () => {
      const nextVisible = !(actions.isDatasetPickerVisible?.() ?? false);
      actions.setDatasetPickerVisible?.(nextVisible);
      setStatus(nextVisible ? 'Dataset chooser opened' : 'Dataset chooser closed');
    });
  }

  const exportButton = button(root, 'analyst-export-package', 'Export investigation', async () => {
    const bytes = await actions.exportPortableInvestigation();
    lastExport = bytes;
    replayButton.disabled = false;
    downloadPackage(bytes, 'nemosyne-investigation.nemosyne');
    setStatus(`Investigation exported (${bytes.byteLength} bytes)`, 'success');
  });
  exportButton.style.marginTop = '7px';

  const tools = document.createElement('details');
  tools.id = 'analyst-investigation-tools';
  tools.style.cssText =
    'margin-top:10px;border-top:1px solid rgba(180,215,230,.22);padding-top:10px;';
  const toolsSummary = document.createElement('summary');
  toolsSummary.textContent = 'Investigation tools';
  toolsSummary.style.cssText = 'cursor:pointer;color:#b9d7e5;margin-bottom:9px;';
  tools.append(toolsSummary);
  root.append(tools);

  const advancedStack = document.createElement('div');
  advancedStack.style.cssText = 'display:grid;grid-template-columns:1fr;gap:7px;';
  tools.append(advancedStack);

  const budgetLabel = document.createElement('label');
  budgetLabel.htmlFor = 'analyst-max-elements';
  budgetLabel.textContent = 'Maximum rendered elements (optional)';
  advancedStack.append(budgetLabel);

  const budgetInput = document.createElement('input');
  budgetInput.id = 'analyst-max-elements';
  budgetInput.type = 'number';
  budgetInput.min = '1';
  budgetInput.step = '1';
  budgetInput.inputMode = 'numeric';
  budgetInput.style.cssText =
    'box-sizing:border-box;width:100%;min-height:38px;padding:7px 9px;border-radius:7px;border:1px solid rgba(180,215,230,.35);background:rgba(5,16,24,.78);color:#f3fbff;';
  advancedStack.append(budgetInput);

  button(advancedStack, 'analyst-assess-representation', 'Explain current view', () => {
    const rawBudget = budgetInput.value.trim();
    const outcome = actions.assessRepresentation(
      rawBudget.length > 0 ? Number(rawBudget) : undefined,
    );
    showRepresentationOutcome(outcome);
    setStatus(
      outcome.kind === 'decision'
        ? `View decision recorded: ${outcome.decisionId}`
        : `NIL outcome recorded: ${outcome.nilId}`,
      'success',
    );
  });
  button(advancedStack, 'analyst-undo-analysis', 'Undo last analysis', async () => {
    await actions.dispatchIntent({ type: 'history.undo' });
    setStatus('Analysis history moved back', 'success');
  });
  button(advancedStack, 'analyst-toggle-statistical-lens', 'Toggle statistical lens', async () => {
    await actions.dispatchIntent({ type: 'workspace.toggleStatisticalLens' });
    setStatus('Statistical lens toggled', 'success');
  });

  const packageLabel = document.createElement('label');
  packageLabel.htmlFor = 'analyst-package-input';
  packageLabel.textContent = 'Investigation package';
  advancedStack.append(packageLabel);

  const packageInput = document.createElement('input');
  packageInput.id = 'analyst-package-input';
  packageInput.type = 'file';
  packageInput.accept = '.nemosyne,application/zip';
  packageInput.style.cssText = 'max-width:100%;color:#cfeaf5;';
  advancedStack.append(packageInput);

  const replayButton = document.createElement('button');
  replayButton.id = 'analyst-replay-package';
  replayButton.type = 'button';
  replayButton.textContent = 'Replay investigation';
  replayButton.disabled = true;
  styleButton(replayButton);
  replayButton.addEventListener('click', () => {
    if (!lastExport) return;
    replayButton.disabled = true;
    setStatus('Verifying investigation package…');
    actions
      .replayPortableInvestigation(lastExport)
      .then((result) => {
        if (!result.success) {
          setStatus(replayFailureMessage(result.discrepancies.join('; ')), 'error');
          return;
        }
        setStatus(`Replay verified (${result.eventsMatched} events)`, 'success');
      })
      .catch((error: unknown) => {
        setStatus(
          replayFailureMessage(error instanceof Error ? error.message : String(error)),
          'error',
        );
      })
      .finally(() => {
        replayButton.disabled = lastExport === null;
      });
  });

  packageInput.addEventListener('change', () => {
    const file = packageInput.files?.[0];
    if (!file) return;
    file
      .arrayBuffer()
      .then((bytes) => {
        lastExport = new Uint8Array(bytes);
        replayButton.disabled = false;
        tools.open = true;
        setStatus(`Investigation selected: ${file.name}`);
      })
      .catch((error: unknown) => {
        setStatus(
          `Error: ${error instanceof Error ? error.message : String(error)}`,
          'error',
        );
      });
  });
  advancedStack.append(replayButton);

  const unsubscribeDatasetContext = actions.subscribeDatasetContext?.(refreshContext) ?? null;
  status.textContent = 'Ready';
  refreshContext();

  document.body.append(root);
  return {
    dispose: () => {
      unsubscribeDatasetContext?.();
      root.remove();
    },
    refreshContext,
  };
}
