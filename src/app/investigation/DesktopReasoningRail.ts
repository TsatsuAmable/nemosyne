import type {
  BranchDiscoveryInput,
  DiscoveryReasoningSnapshot,
  RecordDiscoveryTestInput,
  StartDiscoveryInput,
} from './DiscoveryReasoningService.ts';

export interface DesktopReasoningRailActions {
  snapshot(): DiscoveryReasoningSnapshot;
  start(input: StartDiscoveryInput): { discoveryId: string };
  recordTest(input: RecordDiscoveryTestInput): { discoveryId: string; validationStatus: string };
  branch(input: BranchDiscoveryInput): { id: string };
  returnToConclusion(discoveryId: string): { id: string };
  subscribeContext?(handler: () => void): () => void;
}

export interface DesktopReasoningRailHandle {
  refresh(): void;
  dispose(): void;
}

function button(id: string, label: string): HTMLElement {
  const element = document.createElement('nms-button');
  element.id = id;
  element.setAttribute('label', label);
  element.setAttribute('aria-label', label);
  element.setAttribute('variant', 'secondary');
  element.setAttribute('size', 'sm');
  element.style.width = '100%';
  return element;
}

function textarea(id: string, label: string, placeholder: string): HTMLTextAreaElement {
  const element = document.createElement('textarea');
  element.id = id;
  element.setAttribute('aria-label', label);
  element.placeholder = placeholder;
  element.rows = 2;
  element.style.cssText = `
    width: 100%;
    box-sizing: border-box;
    resize: vertical;
    padding: var(--nms-spacing-x8);
    background: var(--nms-color-surface-raised);
    border: 1px solid var(--nms-color-surface-border);
    border-radius: var(--nms-panel-border-radius);
    color: var(--nms-color-text-primary);
    font: inherit;
    font-size: var(--nms-font-size-meta);
  `;
  return element;
}

function input(id: string, label: string, placeholder: string): HTMLInputElement {
  const element = document.createElement('input');
  element.id = id;
  element.setAttribute('aria-label', label);
  element.placeholder = placeholder;
  element.style.cssText = `
    width: 100%;
    box-sizing: border-box;
    padding: var(--nms-spacing-x8);
    background: var(--nms-color-surface-raised);
    border: 1px solid var(--nms-color-surface-border);
    border-radius: var(--nms-panel-border-radius);
    color: var(--nms-color-text-primary);
    font: inherit;
    font-size: var(--nms-font-size-meta);
  `;
  return element;
}

/**
 * Compact desktop authoring surface for explicit researcher reasoning.
 *
 * It owns no discovery state. Every action delegates to DiscoveryReasoningService
 * through the narrow application port and then re-reads authoritative state.
 */
export function mountDesktopReasoningRail(
  actions: DesktopReasoningRailActions,
): DesktopReasoningRailHandle {
  const shell = document.getElementById('investigation-shell');
  const sidebar = shell?.querySelector('aside');
  if (!(sidebar instanceof HTMLElement)) {
    return { refresh: () => {}, dispose: () => {} };
  }

  const section = document.createElement('details');
  section.id = 'desktop-reasoning-rail';
  section.style.cssText = `
    border-top: 1px solid var(--nms-color-surface-border);
    padding-top: var(--nms-spacing-x12);
  `;

  const summary = document.createElement('summary');
  summary.textContent = 'Reasoning';
  summary.style.cssText = `
    cursor: pointer;
    color: var(--nms-color-text-secondary);
    font-size: var(--nms-font-size-meta);
    font-weight: 500;
  `;
  section.appendChild(summary);

  const body = document.createElement('div');
  body.style.cssText = `
    display: grid;
    gap: var(--nms-spacing-x8);
    margin-top: var(--nms-spacing-x8);
  `;
  section.appendChild(body);

  const context = document.createElement('p');
  context.id = 'reasoning-context';
  context.setAttribute('aria-live', 'polite');
  context.style.cssText = `
    margin: 0;
    color: var(--nms-color-text-secondary);
    font-size: var(--nms-font-size-meta);
    line-height: 1.35;
  `;
  body.appendChild(context);

  const question = textarea('reasoning-question', 'Research question', 'What should this observation make us ask?');
  const hypothesis = textarea('reasoning-hypothesis', 'Hypothesis', 'State a testable hypothesis');
  const startButton = button('reasoning-start', 'Start reasoning from latest observation');
  body.append(question, hypothesis, startButton);

  const discoverySelect = document.createElement('select');
  discoverySelect.id = 'reasoning-discovery';
  discoverySelect.setAttribute('aria-label', 'Active reasoning path');
  discoverySelect.style.cssText = `
    width: 100%;
    box-sizing: border-box;
    padding: var(--nms-spacing-x8);
    background: var(--nms-color-surface-raised);
    border: 1px solid var(--nms-color-surface-border);
    border-radius: var(--nms-panel-border-radius);
    color: var(--nms-color-text-primary);
    font: inherit;
    font-size: var(--nms-font-size-meta);
  `;
  body.appendChild(discoverySelect);

  const evidence = document.createElement('div');
  evidence.id = 'reasoning-evidence';
  evidence.setAttribute('aria-live', 'polite');
  evidence.style.cssText = `
    display: grid;
    gap: var(--nms-spacing-x4);
    padding: var(--nms-spacing-x8);
    background: var(--nms-color-surface-raised);
    border: 1px solid var(--nms-color-surface-border);
    border-radius: var(--nms-panel-border-radius);
    color: var(--nms-color-text-secondary);
    font-size: var(--nms-font-size-meta);
    line-height: 1.35;
  `;
  body.appendChild(evidence);

  const outcome = document.createElement('select');
  outcome.id = 'reasoning-test-outcome';
  outcome.setAttribute('aria-label', 'Researcher test interpretation');
  for (const [value, label] of [
    ['SUPPORTS', 'Supports hypothesis'],
    ['REFUTES', 'Refutes hypothesis'],
    ['INCONCLUSIVE', 'Inconclusive'],
  ] as const) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    outcome.appendChild(option);
  }
  outcome.style.cssText = discoverySelect.style.cssText;
  body.appendChild(outcome);

  const conclusion = textarea(
    'reasoning-conclusion',
    'Researcher conclusion',
    'State what the cited analytical result means for this hypothesis',
  );
  const testButton = button('reasoning-record-test', 'Record cited test outcome');
  body.append(conclusion, testButton);

  const branchLabel = input('reasoning-branch-label', 'Branch label', 'Optional branch question');
  const branchButton = button('reasoning-branch', 'Branch here');
  const returnButton = button('reasoning-return', 'Return to tested conclusion');
  body.append(branchLabel, branchButton, returnButton);

  const feedback = document.createElement('p');
  feedback.id = 'reasoning-feedback';
  feedback.setAttribute('role', 'status');
  feedback.setAttribute('aria-live', 'polite');
  feedback.style.cssText = `
    min-height: 1.25em;
    margin: 0;
    color: var(--nms-color-text-secondary);
    font-size: var(--nms-font-size-meta);
  `;
  body.appendChild(feedback);

  let selectedDiscoveryId: string | null = null;

  const refresh = (): void => {
    const snapshot = actions.snapshot();
    const observation = snapshot.latestObservation;
    const result = snapshot.latestResult;
    context.textContent = observation
      ? `Latest observation · ${observation.id}${result ? ` · evidence ready ${result.resultId}` : ' · run an analysis before testing'}`
      : 'Record an observation before starting a reasoning path.';

    const previous = selectedDiscoveryId ?? discoverySelect.value;
    discoverySelect.replaceChildren();
    for (const discovery of snapshot.discoveries) {
      const option = document.createElement('option');
      option.value = discovery.discoveryId;
      const questionLabel = discovery.question?.trim() || discovery.notice;
      option.textContent = `${discovery.validationStatus} · ${questionLabel.slice(0, 54)}`;
      discoverySelect.appendChild(option);
    }
    if (snapshot.discoveries.length > 0) {
      const hasPrevious = snapshot.discoveries.some((entry) => entry.discoveryId === previous);
      discoverySelect.value = hasPrevious
        ? previous
        : snapshot.discoveries[snapshot.discoveries.length - 1]!.discoveryId;
      selectedDiscoveryId = discoverySelect.value;
    } else {
      selectedDiscoveryId = null;
    }

    const startDisabled = !observation;
    startButton.toggleAttribute('disabled', startDisabled);

    const selected = snapshot.discoveries.find((entry) => entry.discoveryId === selectedDiscoveryId) ?? null;
    const terminal = Boolean(selected && selected.validationStatus !== 'UNDER_INVESTIGATION' && selected.validationStatus !== 'UNTESTED');
    testButton.toggleAttribute('disabled', !selected || !result || terminal);
    branchButton.toggleAttribute('disabled', !selected?.conclusion);
    returnButton.toggleAttribute('disabled', !selected?.conclusion);

    evidence.replaceChildren();
    if (!selected) {
      evidence.textContent = 'No reasoning path yet.';
    } else {
      const status = document.createElement('strong');
      status.textContent = selected.validationStatus;
      status.style.color = 'var(--nms-color-text-primary)';
      evidence.appendChild(status);

      const hypothesisLine = document.createElement('span');
      hypothesisLine.textContent = `Hypothesis · ${selected.hypothesis ?? 'not stated'}`;
      evidence.appendChild(hypothesisLine);

      const latestTest = selected.analyticalTests.at(-1) ?? null;
      const evidenceLine = document.createElement('span');
      evidenceLine.textContent = latestTest
        ? `${latestTest.outcome} · cited analytical evidence ${latestTest.evidenceIds.join(', ')}`
        : `Observation evidence · ${selected.evidenceIds.join(', ')}`;
      evidence.appendChild(evidenceLine);

      if (selected.conclusion) {
        const conclusionLine = document.createElement('span');
        conclusionLine.textContent = `Conclusion · ${selected.conclusion}`;
        evidence.appendChild(conclusionLine);
      }

      const activeNode = snapshot.activeGraphNode;
      if (
        activeNode?.metadata?.discoveryId === selected.discoveryId &&
        activeNode.metadata.discoveryRole === 'branch'
      ) {
        const branchLine = document.createElement('span');
        branchLine.id = 'reasoning-branch-provenance';
        branchLine.textContent = `Branch · ${activeNode.label} · from ${activeNode.parentId ?? 'unknown origin'}`;
        evidence.appendChild(branchLine);
      }
    }
  };

  discoverySelect.addEventListener('change', () => {
    selectedDiscoveryId = discoverySelect.value || null;
    refresh();
  });

  startButton.addEventListener('click', () => {
    try {
      const snapshot = actions.snapshot();
      const observation = snapshot.latestObservation;
      if (!observation) throw new Error('Record an observation first.');
      const episode = actions.start({
        observationId: observation.id,
        question: question.value,
        hypothesis: hypothesis.value,
      });
      selectedDiscoveryId = episode.discoveryId;
      feedback.textContent = `Reasoning started · ${episode.discoveryId}`;
      question.value = '';
      hypothesis.value = '';
      refresh();
    } catch (error) {
      feedback.textContent = error instanceof Error ? error.message : String(error);
    }
  });

  testButton.addEventListener('click', () => {
    try {
      const snapshot = actions.snapshot();
      const result = snapshot.latestResult;
      if (!selectedDiscoveryId) throw new Error('Choose a reasoning path first.');
      if (!result) throw new Error('Run an analysis before recording a test outcome.');
      const episode = actions.recordTest({
        discoveryId: selectedDiscoveryId,
        resultId: result.resultId,
        outcome: outcome.value as RecordDiscoveryTestInput['outcome'],
        conclusion: conclusion.value,
      });
      feedback.textContent = `Test recorded · ${episode.validationStatus}`;
      conclusion.value = '';
      refresh();
    } catch (error) {
      feedback.textContent = error instanceof Error ? error.message : String(error);
    }
  });

  branchButton.addEventListener('click', () => {
    try {
      if (!selectedDiscoveryId) throw new Error('Choose a reasoning path first.');
      const branch = actions.branch({
        discoveryId: selectedDiscoveryId,
        label: branchLabel.value,
      });
      feedback.textContent = `Branch recorded · ${branch.id}`;
      branchLabel.value = '';
      refresh();
    } catch (error) {
      feedback.textContent = error instanceof Error ? error.message : String(error);
    }
  });

  returnButton.addEventListener('click', () => {
    try {
      if (!selectedDiscoveryId) throw new Error('Choose a reasoning path first.');
      const conclusionNode = actions.returnToConclusion(selectedDiscoveryId);
      feedback.textContent = `Returned to conclusion · ${conclusionNode.id}`;
      refresh();
    } catch (error) {
      feedback.textContent = error instanceof Error ? error.message : String(error);
    }
  });

  const moreTools = Array.from(sidebar.children).find(
    (child) => child instanceof HTMLDetailsElement,
  );
  if (moreTools) sidebar.insertBefore(section, moreTools);
  else sidebar.appendChild(section);

  const unsubscribe = actions.subscribeContext?.(refresh) ?? null;
  section.addEventListener('toggle', refresh);
  refresh();

  return {
    refresh,
    dispose: () => {
      unsubscribe?.();
      section.remove();
    },
  };
}
