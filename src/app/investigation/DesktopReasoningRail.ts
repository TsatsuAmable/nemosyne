import type { Observation } from '../../atlas/types.ts';
import type {
  BranchDiscoveryInput,
  DiscoveryReasoningSnapshot,
  DiscoveryTestOutcome,
} from './DiscoveryReasoningService.ts';
import type { RecordUnderstandingInput } from './InvestigationJourneyController.ts';

export interface DesktopReasoningRailActions {
  snapshot(): DiscoveryReasoningSnapshot;
  observe(note: string): Promise<Observation>;
  ask(observationId: string, question: string): Promise<string>;
  hypothesise(discoveryId: string, hypothesis: string): Promise<void>;
  recordUnderstanding(input: RecordUnderstandingInput): Promise<void>;
  validate(discoveryId: string, resultId: string, outcome: DiscoveryTestOutcome): Promise<void>;
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

function textarea(id: string, label: string, placeholder: string, rows = 2): HTMLTextAreaElement {
  const element = document.createElement('textarea');
  element.id = id;
  element.setAttribute('aria-label', label);
  element.placeholder = placeholder;
  element.rows = rows;
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

function friendlyStatus(status: string): string {
  if (status === 'UNTESTED') return 'Question saved';
  if (status === 'UNDER_INVESTIGATION') return 'Investigation in progress';
  if (status === 'SUPPORTED') return 'Hypothesis supported';
  if (status === 'REFUTED') return 'Hypothesis refuted';
  if (status === 'INCONCLUSIVE') return 'Evidence inconclusive';
  if (status === 'EXTERNALLY_VALIDATED') return 'Externally validated';
  return status;
}

/**
 * Human-readable desktop journey over the same NIL-backed application controller
 * used by XR. This surface owns no discovery state.
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
  summary.textContent = 'Investigation';
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

  const notice = textarea('reasoning-notice', 'Notice', 'What did you notice in the data?');
  const noticeButton = button('reasoning-notice-save', '1 · Save notice');
  body.append(notice, noticeButton);

  const question = textarea('reasoning-question', 'Research question', 'What question does that notice raise?');
  const questionButton = button('reasoning-question-save', '2 · Ask question');
  body.append(question, questionButton);

  const discoverySelect = document.createElement('select');
  discoverySelect.id = 'reasoning-discovery';
  discoverySelect.setAttribute('aria-label', 'Active investigation');
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

  const hypothesis = textarea('reasoning-hypothesis', 'Hypothesis', 'State a testable hypothesis');
  const hypothesisButton = button('reasoning-hypothesis-save', '3 · Save hypothesis');
  body.append(hypothesis, hypothesisButton);

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

  const understandingTitle = input(
    'reasoning-understanding-title',
    'Understanding title',
    'Short title for what you now understand',
  );
  const understanding = textarea(
    'reasoning-understanding',
    'Understanding',
    'What does the latest analytical evidence mean?',
    3,
  );
  const understandingButton = button('reasoning-understanding-save', '4 · Record understanding');
  body.append(understandingTitle, understanding, understandingButton);

  const outcome = document.createElement('select');
  outcome.id = 'reasoning-test-outcome';
  outcome.setAttribute('aria-label', 'Validation outcome');
  for (const [value, label] of [
    ['SUPPORTS', 'Evidence supports the hypothesis'],
    ['REFUTES', 'Evidence refutes the hypothesis'],
    ['INCONCLUSIVE', 'Evidence is inconclusive'],
  ] as const) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    outcome.appendChild(option);
  }
  outcome.style.cssText = discoverySelect.style.cssText;
  const validateButton = button('reasoning-validate', '5 · Validate hypothesis');
  body.append(outcome, validateButton);

  const branchLabel = input('reasoning-branch-label', 'Branch label', 'Optional follow-up question');
  const branchButton = button('reasoning-branch', 'Explore a follow-up branch');
  const returnButton = button('reasoning-return', 'Return to recorded discovery');
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
  let busy = false;

  const refresh = (): void => {
    const snapshot = actions.snapshot();
    const observation = snapshot.latestObservation;
    const result = snapshot.latestResult;
    context.textContent = observation
      ? `Latest notice · ${observation.notes.slice(0, 70)}${result ? ` · analytical evidence ready` : ' · run an analysis before recording understanding'}`
      : 'Start by saving something you notice in the current dataset.';

    const previous = selectedDiscoveryId ?? discoverySelect.value;
    discoverySelect.replaceChildren();
    for (const discovery of snapshot.discoveries) {
      const option = document.createElement('option');
      option.value = discovery.discoveryId;
      const label = discovery.question?.trim() || discovery.notice;
      option.textContent = `${friendlyStatus(discovery.validationStatus)} · ${label.slice(0, 52)}`;
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

    const selected = snapshot.discoveries.find((entry) => entry.discoveryId === selectedDiscoveryId) ?? null;
    const terminal = Boolean(
      selected &&
        selected.validationStatus !== 'UNDER_INVESTIGATION' &&
        selected.validationStatus !== 'UNTESTED',
    );

    noticeButton.toggleAttribute('disabled', busy);
    questionButton.toggleAttribute('disabled', busy || !observation);
    hypothesisButton.toggleAttribute(
      'disabled',
      busy || !selected || selected.validationStatus !== 'UNTESTED',
    );
    understandingButton.toggleAttribute(
      'disabled',
      busy ||
        !selected ||
        selected.validationStatus !== 'UNDER_INVESTIGATION' ||
        Boolean(selected.conclusion) ||
        !result,
    );
    validateButton.toggleAttribute(
      'disabled',
      busy || !selected?.conclusion || terminal || !result,
    );
    branchButton.toggleAttribute('disabled', busy || !selected?.conclusion);
    returnButton.toggleAttribute('disabled', busy || !selected?.conclusion);

    evidence.replaceChildren();
    if (!selected) {
      evidence.textContent = 'No investigation yet.';
    } else {
      const status = document.createElement('strong');
      status.textContent = friendlyStatus(selected.validationStatus);
      status.style.color = 'var(--nms-color-text-primary)';
      evidence.appendChild(status);

      const questionLine = document.createElement('span');
      questionLine.textContent = `Question · ${selected.question ?? 'not stated'}`;
      evidence.appendChild(questionLine);

      const hypothesisLine = document.createElement('span');
      hypothesisLine.textContent = `Hypothesis · ${selected.hypothesis ?? 'not stated yet'}`;
      evidence.appendChild(hypothesisLine);

      if (selected.conclusion) {
        const understandingLine = document.createElement('span');
        understandingLine.textContent = `Understanding · ${selected.conclusion}`;
        evidence.appendChild(understandingLine);
      }

      const latestTest = selected.analyticalTests.at(-1) ?? null;
      if (latestTest) {
        const validationLine = document.createElement('span');
        validationLine.textContent = `Validation · ${friendlyStatus(selected.validationStatus)} · evidence ${latestTest.evidenceIds.join(', ')}`;
        evidence.appendChild(validationLine);
      }

      const branches = snapshot.branches.filter(
        (branch) => branch.discoveryId === selected.discoveryId,
      );
      if (branches.length > 0) {
        const branchLine = document.createElement('span');
        branchLine.id = 'reasoning-branch-provenance';
        branchLine.textContent = `Follow-ups · ${branches.map((branch) => branch.label).join(' | ')}`;
        evidence.appendChild(branchLine);
      }
    }
  };

  const run = async (action: () => Promise<void>): Promise<void> => {
    if (busy) return;
    busy = true;
    refresh();
    try {
      await action();
    } catch (error: unknown) {
      feedback.textContent = error instanceof Error ? error.message : String(error);
    } finally {
      busy = false;
      refresh();
    }
  };

  discoverySelect.addEventListener('change', () => {
    selectedDiscoveryId = discoverySelect.value || null;
    refresh();
  });

  noticeButton.addEventListener('click', () => {
    void run(async () => {
      const observation = await actions.observe(notice.value);
      feedback.textContent = `Notice saved · ${observation.id}`;
      notice.value = '';
    });
  });

  questionButton.addEventListener('click', () => {
    void run(async () => {
      const observation = actions.snapshot().latestObservation;
      if (!observation) throw new Error('Save a notice first.');
      selectedDiscoveryId = await actions.ask(observation.id, question.value);
      feedback.textContent = 'Research question saved';
      question.value = '';
    });
  });

  hypothesisButton.addEventListener('click', () => {
    void run(async () => {
      if (!selectedDiscoveryId) throw new Error('Ask a research question first.');
      await actions.hypothesise(selectedDiscoveryId, hypothesis.value);
      feedback.textContent = 'Hypothesis saved · investigate with an analytical tool';
      hypothesis.value = '';
    });
  });

  understandingButton.addEventListener('click', () => {
    void run(async () => {
      if (!selectedDiscoveryId) throw new Error('Choose an investigation first.');
      const result = actions.snapshot().latestResult;
      if (!result) throw new Error('Run an analysis before recording understanding.');
      await actions.recordUnderstanding({
        discoveryId: selectedDiscoveryId,
        title: understandingTitle.value,
        description: understanding.value,
        resultId: result.resultId,
      });
      feedback.textContent = 'Understanding recorded · ready to validate';
      understandingTitle.value = '';
      understanding.value = '';
    });
  });

  validateButton.addEventListener('click', () => {
    void run(async () => {
      if (!selectedDiscoveryId) throw new Error('Choose an investigation first.');
      const result = actions.snapshot().latestResult;
      if (!result) throw new Error('No analytical evidence is ready for validation.');
      await actions.validate(
        selectedDiscoveryId,
        result.resultId,
        outcome.value as DiscoveryTestOutcome,
      );
      feedback.textContent = 'Discovery recorded with evidence and reasoning';
    });
  });

  branchButton.addEventListener('click', () => {
    try {
      if (!selectedDiscoveryId) throw new Error('Choose an investigation first.');
      const branch = actions.branch({ discoveryId: selectedDiscoveryId, label: branchLabel.value });
      feedback.textContent = `Follow-up branch recorded · ${branch.id}`;
      branchLabel.value = '';
      refresh();
    } catch (error: unknown) {
      feedback.textContent = error instanceof Error ? error.message : String(error);
    }
  });

  returnButton.addEventListener('click', () => {
    try {
      if (!selectedDiscoveryId) throw new Error('Choose an investigation first.');
      const node = actions.returnToConclusion(selectedDiscoveryId);
      feedback.textContent = `Returned to discovery · ${node.id}`;
      refresh();
    } catch (error: unknown) {
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
