import type { World } from '../vr/World.ts';
import {
  assessAnalystRepresentation,
  type AnalystRepresentationOutcome,
} from './AnalystRepresentationAssessment.ts';

export interface AnalystJourneyControlsHandle {
  dispose(): void;
}

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

export function mountAnalystJourneyControls(world: World): AnalystJourneyControlsHandle {
  const root = document.createElement('section');
  root.id = 'analyst-journey-controls';
  root.setAttribute('aria-label', 'Analyst journey controls');

  const title = document.createElement('h2');
  title.textContent = 'ANALYST JOURNEY';
  root.append(title);

  const status = document.createElement('p');
  status.id = 'analyst-journey-status';
  status.setAttribute('role', 'status');
  status.textContent = 'Ready';
  root.append(status);

  const representationOutcome = document.createElement('p');
  representationOutcome.id = 'analyst-representation-outcome';
  representationOutcome.textContent = 'Moneta outcome: pending';
  root.append(representationOutcome);

  let lastExport: Uint8Array | null = null;

  const setStatus = (message: string, state: 'ready' | 'success' | 'error' = 'ready') => {
    status.dataset.state = state;
    status.setAttribute('role', state === 'error' ? 'alert' : 'status');
    status.textContent = message;
  };

  const showRepresentationOutcome = (outcome: AnalystRepresentationOutcome) => {
    representationOutcome.dataset.state = outcome.kind;
    if (outcome.kind === 'decision') {
      representationOutcome.textContent =
        `Moneta selected ${outcome.family} / ${outcome.layout} ` +
        `(utility ${outcome.utilityScore.toFixed(3)})`;
      return;
    }
    representationOutcome.textContent =
      `NIL: no feasible representation (${outcome.failedConstraintCount} failed constraints; ` +
      `${outcome.nearMissCount} near misses)`;
  };

  const button = (id: string, label: string, action: () => void | Promise<void>) => {
    const element = document.createElement('button');
    element.id = id;
    element.type = 'button';
    element.textContent = label;
    element.addEventListener('click', () => {
      Promise.resolve(action()).catch((error: unknown) => {
        setStatus(`Error: ${error instanceof Error ? error.message : String(error)}`, 'error');
      });
    });
    root.append(element);
  };

  const budgetLabel = document.createElement('label');
  budgetLabel.htmlFor = 'analyst-max-elements';
  budgetLabel.textContent = 'Maximum rendered elements (optional)';
  root.append(budgetLabel);

  const budgetInput = document.createElement('input');
  budgetInput.id = 'analyst-max-elements';
  budgetInput.type = 'number';
  budgetInput.min = '1';
  budgetInput.step = '1';
  budgetInput.inputMode = 'numeric';
  root.append(budgetInput);

  button('analyst-load-sample', 'Load sample', () => {
    world._cycleDataset(1);
    showRepresentationOutcome(assessAnalystRepresentation(world.atlas, world.session));
    setStatus(`Loaded ${world.currentEntry?.name ?? 'sample dataset'}`, 'success');
  });
  button('analyst-assess-representation', 'Assess representation', () => {
    const rawBudget = budgetInput.value.trim();
    const outcome = assessAnalystRepresentation(
      world.atlas,
      world.session,
      rawBudget.length > 0 ? Number(rawBudget) : undefined,
    );
    showRepresentationOutcome(outcome);
    setStatus(
      outcome.kind === 'decision'
        ? `Representation decision recorded: ${outcome.decisionId}`
        : `NIL outcome recorded: ${outcome.nilId}`,
      'success',
    );
  });
  button('analyst-run-analysis', 'Run analysis', () => {
    world.dataOperationController.apply('anomaly');
    setStatus(`Evidence ready (${world.atlas.results.length} result)`, 'success');
  });
  button('analyst-mark-moment', 'Record observation', () => {
    const observation = world.markMoment('Recorded from desktop analyst controls');
    setStatus(`Observation recorded: ${observation.id}`, 'success');
  });

  const packageLabel = document.createElement('label');
  packageLabel.htmlFor = 'analyst-package-input';
  packageLabel.textContent = 'Investigation package';
  root.append(packageLabel);

  const packageInput = document.createElement('input');
  packageInput.id = 'analyst-package-input';
  packageInput.type = 'file';
  packageInput.accept = '.nemosyne,application/zip';
  packageInput.addEventListener('change', () => {
    const file = packageInput.files?.[0];
    if (!file) return;
    file
      .arrayBuffer()
      .then((bytes) => {
        lastExport = new Uint8Array(bytes);
        replayButton.disabled = false;
        setStatus(`Investigation selected: ${file.name}`);
      })
      .catch((error: unknown) => {
        setStatus(
          `Error: ${error instanceof Error ? error.message : String(error)}`,
          'error',
        );
      });
  });
  root.append(packageInput);

  const replayButton = document.createElement('button');
  replayButton.id = 'analyst-replay-package';
  replayButton.type = 'button';
  replayButton.textContent = 'Replay investigation';
  replayButton.disabled = true;
  replayButton.addEventListener('click', () => {
    if (!lastExport) return;
    replayButton.disabled = true;
    setStatus('Verifying investigation package…');
    world
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

  button('analyst-export-package', 'Export investigation', async () => {
    const bytes = await world.session.exportPortablePackage({
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      webxrSupported: 'xr' in navigator,
    });
    lastExport = bytes;
    replayButton.disabled = false;
    downloadPackage(bytes, 'nemosyne-investigation.nemosyne');
    setStatus(`Investigation exported (${bytes.byteLength} bytes)`, 'success');
  });
  root.append(replayButton);

  document.body.append(root);
  return { dispose: () => root.remove() };
}
