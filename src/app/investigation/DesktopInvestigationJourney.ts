import type { DiscoveryTestOutcome } from './DiscoveryReasoningService.ts';
import type { InvestigationJourneyController } from './InvestigationJourneyController.ts';

export interface DesktopInvestigationJourneyOptions {
  journey: InvestigationJourneyController;
  subscribeContext?: (handler: () => void) => () => void;
}

export interface DesktopInvestigationJourneyHandle {
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
    width: 100%; box-sizing: border-box; resize: vertical;
    padding: var(--nms-spacing-x8); background: var(--nms-color-surface-raised);
    border: 1px solid var(--nms-color-surface-border);
    border-radius: var(--nms-panel-border-radius); color: var(--nms-color-text-primary);
    font: inherit; font-size: var(--nms-font-size-meta);
  `;
  return element;
}

function input(id: string, label: string, placeholder: string): HTMLInputElement {
  const element = document.createElement('input');
  element.id = id;
  element.setAttribute('aria-label', label);
  element.placeholder = placeholder;
  element.style.cssText = `
    width: 100%; box-sizing: border-box; padding: var(--nms-spacing-x8);
    background: var(--nms-color-surface-raised); border: 1px solid var(--nms-color-surface-border);
    border-radius: var(--nms-panel-border-radius); color: var(--nms-color-text-primary);
    font: inherit; font-size: var(--nms-font-size-meta);
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

/** Mount the PT5C staged journey and retire the older combined C4 reasoning rail. */
export function mountDesktopInvestigationJourney(
  options: DesktopInvestigationJourneyOptions,
): DesktopInvestigationJourneyHandle {
  const sidebar = document.getElementById('investigation-shell')?.querySelector('aside');
  if (!(sidebar instanceof HTMLElement)) return { refresh: () => {}, dispose: () => {} };

  document.getElementById('desktop-reasoning-rail')?.remove();

  const section = document.createElement('details');
  section.id = 'desktop-investigation-journey';
  section.open = true;
  section.style.cssText = 'border-top:1px solid var(--nms-color-surface-border);padding-top:var(--nms-spacing-x12);';

  const summary = document.createElement('summary');
  summary.textContent = 'Investigation';
  summary.style.cssText = 'cursor:pointer;color:var(--nms-color-text-secondary);font-size:var(--nms-font-size-meta);font-weight:500;';
  section.appendChild(summary);

  const body = document.createElement('div');
  body.style.cssText = 'display:grid;gap:var(--nms-spacing-x8);margin-top:var(--nms-spacing-x8);';
  section.appendChild(body);

  const context = document.createElement('p');
  context.id = 'investigation-journey-context';
  context.setAttribute('aria-live', 'polite');
  context.style.cssText = 'margin:0;color:var(--nms-color-text-secondary);font-size:var(--nms-font-size-meta);line-height:1.35;';
  body.appendChild(context);

  const notice = textarea('investigation-notice', 'Notice', 'What did you notice in the data?');
  const noticeButton = button('investigation-notice-save', '1 · Save notice');
  const question = textarea('investigation-question', 'Research question', 'What question does that notice raise?');
  const questionButton = button('investigation-question-save', '2 · Ask question');
  body.append(notice, noticeButton, question, questionButton);

  const discoverySelect = document.createElement('select');
  discoverySelect.id = 'investigation-discovery';
  discoverySelect.setAttribute('aria-label', 'Active investigation');
  discoverySelect.style.cssText = 'width:100%;box-sizing:border-box;padding:var(--nms-spacing-x8);background:var(--nms-color-surface-raised);border:1px solid var(--nms-color-surface-border);border-radius:var(--nms-panel-border-radius);color:var(--nms-color-text-primary);font:inherit;font-size:var(--nms-font-size-meta);';
  body.appendChild(discoverySelect);

  const hypothesis = textarea('investigation-hypothesis', 'Hypothesis', 'State a testable hypothesis');
  const hypothesisButton = button('investigation-hypothesis-save', '3 · Save hypothesis');
  body.append(hypothesis, hypothesisButton);

  const evidence = document.createElement('div');
  evidence.id = 'investigation-evidence';
  evidence.setAttribute('aria-live', 'polite');
  evidence.style.cssText = 'display:grid;gap:var(--nms-spacing-x4);padding:var(--nms-spacing-x8);background:var(--nms-color-surface-raised);border:1px solid var(--nms-color-surface-border);border-radius:var(--nms-panel-border-radius);color:var(--nms-color-text-secondary);font-size:var(--nms-font-size-meta);line-height:1.35;';
  body.appendChild(evidence);

  const understandingTitle = input('investigation-understanding-title', 'Understanding title', 'Short title for what you now understand');
  const understanding = textarea('investigation-understanding', 'Understanding', 'What does the latest analytical evidence mean?', 3);
  const understandingButton = button('investigation-understanding-save', '4 · Record understanding');
  body.append(understandingTitle, understanding, understandingButton);

  const outcome = document.createElement('select');
  outcome.id = 'investigation-validation-outcome';
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
  const validateButton = button('investigation-validate', '5 · Validate hypothesis');
  const returnButton = button('investigation-return', 'Return to recorded discovery');
  body.append(outcome, validateButton, returnButton);

  const feedback = document.createElement('p');
  feedback.id = 'investigation-feedback';
  feedback.setAttribute('role', 'status');
  feedback.setAttribute('aria-live', 'polite');
  feedback.style.cssText = 'min-height:1.25em;margin:0;color:var(--nms-color-text-secondary);font-size:var(--nms-font-size-meta);';
  body.appendChild(feedback);

  let selectedDiscoveryId: string | null = null;
  let busy = false;

  const refresh = (): void => {
    const snapshot = options.journey.snapshot();
    const observation = snapshot.latestObservation;
    const result = snapshot.latestResult;
    context.textContent = observation
      ? `Latest notice · ${observation.notes.slice(0, 66)}${result ? ' · analytical evidence ready' : ' · use an analytical tool next'}`
      : 'Start by saving something you notice in the current dataset.';

    const previous = selectedDiscoveryId ?? discoverySelect.value;
    discoverySelect.replaceChildren();
    for (const discovery of snapshot.discoveries) {
      const option = document.createElement('option');
      option.value = discovery.discoveryId;
      option.textContent = `${friendlyStatus(discovery.validationStatus)} · ${(discovery.question ?? discovery.notice).slice(0, 52)}`;
      discoverySelect.appendChild(option);
    }
    if (snapshot.discoveries.length) {
      selectedDiscoveryId = snapshot.discoveries.some((entry) => entry.discoveryId === previous)
        ? previous
        : snapshot.discoveries.at(-1)!.discoveryId;
      discoverySelect.value = selectedDiscoveryId;
    } else selectedDiscoveryId = null;

    const selected = snapshot.discoveries.find((entry) => entry.discoveryId === selectedDiscoveryId) ?? null;
    const isTerminal = Boolean(selected && !['UNTESTED', 'UNDER_INVESTIGATION'].includes(selected.validationStatus));
    noticeButton.toggleAttribute('disabled', busy);
    questionButton.toggleAttribute('disabled', busy || !observation);
    hypothesisButton.toggleAttribute('disabled', busy || !selected || selected.validationStatus !== 'UNTESTED');
    understandingButton.toggleAttribute('disabled', busy || !selected || selected.validationStatus !== 'UNDER_INVESTIGATION' || Boolean(selected.conclusion) || !result);
    validateButton.toggleAttribute('disabled', busy || !selected?.conclusion || isTerminal || !result);
    returnButton.toggleAttribute('disabled', busy || !selected?.conclusion);

    evidence.replaceChildren();
    if (!selected) {
      evidence.textContent = 'No investigation yet.';
      return;
    }
    for (const text of [
      friendlyStatus(selected.validationStatus),
      `Question · ${selected.question ?? 'not stated'}`,
      `Hypothesis · ${selected.hypothesis ?? 'not stated yet'}`,
      selected.conclusion ? `Understanding · ${selected.conclusion}` : null,
      selected.analyticalTests.at(-1)
        ? `Validation · ${friendlyStatus(selected.validationStatus)} · evidence ${selected.analyticalTests.at(-1)!.evidenceIds.join(', ')}`
        : null,
    ]) {
      if (!text) continue;
      const line = document.createElement('span');
      line.textContent = text;
      evidence.appendChild(line);
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
  noticeButton.addEventListener('click', () => void run(async () => {
    const observation = await options.journey.observe(notice.value);
    feedback.textContent = `Notice saved · ${observation.id}`;
    notice.value = '';
  }));
  questionButton.addEventListener('click', () => void run(async () => {
    const observation = options.journey.snapshot().latestObservation;
    if (!observation) throw new Error('Save a notice first.');
    selectedDiscoveryId = await options.journey.ask(observation.id, question.value);
    feedback.textContent = 'Research question saved';
    question.value = '';
  }));
  hypothesisButton.addEventListener('click', () => void run(async () => {
    if (!selectedDiscoveryId) throw new Error('Ask a research question first.');
    await options.journey.hypothesise(selectedDiscoveryId, hypothesis.value);
    feedback.textContent = 'Hypothesis saved · investigate with an analytical tool';
    hypothesis.value = '';
  }));
  understandingButton.addEventListener('click', () => void run(async () => {
    if (!selectedDiscoveryId) throw new Error('Choose an investigation first.');
    const result = options.journey.snapshot().latestResult;
    if (!result) throw new Error('Run an analysis before recording understanding.');
    await options.journey.recordUnderstanding({
      discoveryId: selectedDiscoveryId,
      title: understandingTitle.value,
      description: understanding.value,
      resultId: result.resultId,
    });
    feedback.textContent = 'Understanding recorded · ready to validate';
    understandingTitle.value = '';
    understanding.value = '';
  }));
  validateButton.addEventListener('click', () => void run(async () => {
    if (!selectedDiscoveryId) throw new Error('Choose an investigation first.');
    const result = options.journey.snapshot().latestResult;
    if (!result) throw new Error('No analytical evidence is ready for validation.');
    await options.journey.validate(selectedDiscoveryId, result.resultId, outcome.value as DiscoveryTestOutcome);
    feedback.textContent = 'Discovery recorded with evidence and reasoning';
  }));
  returnButton.addEventListener('click', () => {
    try {
      if (!selectedDiscoveryId) throw new Error('Choose an investigation first.');
      const node = options.journey.returnToDiscovery(selectedDiscoveryId);
      feedback.textContent = `Returned to discovery · ${node.id}`;
      refresh();
    } catch (error: unknown) {
      feedback.textContent = error instanceof Error ? error.message : String(error);
    }
  });

  const moreTools = Array.from(sidebar.children).find((child) => child instanceof HTMLDetailsElement);
  if (moreTools) sidebar.insertBefore(section, moreTools);
  else sidebar.appendChild(section);

  const unsubscribe = options.subscribeContext?.(() => queueMicrotask(refresh)) ?? null;
  refresh();
  return {
    refresh,
    dispose: () => {
      unsubscribe?.();
      section.remove();
    },
  };
}
