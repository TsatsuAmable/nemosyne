import {
  INVESTIGATOR_TASKS,
  type InvestigatorTaskIntent,
} from './intents/InvestigatorTaskIntent.ts';

export interface DesktopSelectionTaskContext {
  label: string;
  data: Record<string, unknown>;
}

export interface DesktopSelectionTaskActions {
  getSelection(): DesktopSelectionTaskContext | null;
  dispatchTask(intent: InvestigatorTaskIntent, data: Record<string, unknown>): boolean;
}

export interface DesktopSelectionTaskRailHandle {
  dispose(): void;
  refresh(): void;
}

function selectionLabel(context: DesktopSelectionTaskContext | null): string {
  return context ? `Selected · ${context.label}` : 'Select a data object to use these tasks';
}

/**
 * Desktop counterpart to the immersive ContextualTaskSurface.
 *
 * The rail attaches to the existing investigation shell sidebar, uses the same
 * six investigator verbs, and delegates each action into the immersive
 * surface's callback seam. It owns no selection or analytical behavior.
 */
export function mountDesktopSelectionTaskRail(
  actions: DesktopSelectionTaskActions,
): DesktopSelectionTaskRailHandle {
  const shell = document.getElementById('investigation-shell');
  const sidebar = shell?.querySelector('aside');
  if (!(sidebar instanceof HTMLElement)) {
    return { dispose: () => {}, refresh: () => {} };
  }

  const section = document.createElement('section');
  section.id = 'desktop-selection-task-rail';
  section.setAttribute('aria-label', 'Selected object tasks');
  section.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: var(--nms-spacing-x8);
    padding-top: var(--nms-spacing-x12);
    border-top: 1px solid var(--nms-color-surface-border);
  `;

  const heading = document.createElement('h2');
  heading.textContent = 'Selected object';
  heading.style.cssText = `
    margin: 0;
    font-size: var(--nms-font-size-meta);
    letter-spacing: 0.1em;
    color: var(--nms-color-interaction-focus);
    font-weight: 650;
  `;
  section.appendChild(heading);

  const context = document.createElement('p');
  context.id = 'desktop-selection-context';
  context.setAttribute('aria-live', 'polite');
  context.style.cssText = `
    margin: 0;
    font-size: var(--nms-font-size-meta);
    color: var(--nms-color-text-secondary);
  `;
  section.appendChild(context);

  const grid = document.createElement('div');
  grid.style.cssText = `
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--nms-spacing-x8);
  `;
  section.appendChild(grid);

  const feedback = document.createElement('p');
  feedback.id = 'desktop-selection-task-feedback';
  feedback.setAttribute('role', 'status');
  feedback.setAttribute('aria-live', 'polite');
  feedback.style.cssText = `
    min-height: 1.25em;
    margin: 0;
    font-size: var(--nms-font-size-meta);
    color: var(--nms-color-text-secondary);
  `;
  section.appendChild(feedback);

  const buttons = new Map<InvestigatorTaskIntent, HTMLElement>();

  const refresh = (): void => {
    const selected = actions.getSelection();
    context.textContent = selectionLabel(selected);
    for (const button of buttons.values()) {
      if (selected) button.removeAttribute('disabled');
      else button.setAttribute('disabled', '');
    }
  };

  for (const task of INVESTIGATOR_TASKS) {
    const button = document.createElement('nms-button');
    button.id = `desktop-task-${task.id}`;
    button.textContent = task.label;
    button.setAttribute('variant', task.id === 'inspect' ? 'primary' : 'secondary');
    button.setAttribute('size', 'sm');
    button.setAttribute('title', task.description);
    button.addEventListener('click', () => {
      const selected = actions.getSelection();
      if (!selected) {
        feedback.textContent = 'Select a data object first.';
        refresh();
        return;
      }
      const dispatched = actions.dispatchTask(task.id, selected.data);
      feedback.textContent = dispatched
        ? `${task.label} · ${selected.label}`
        : `${task.label} is unavailable for this selection.`;
      refresh();
    });
    grid.appendChild(button);
    buttons.set(task.id, button);
  }

  // Put selected-object verbs ahead of the expandable tool drawer so desktop
  // mirrors XR's task-first hierarchy rather than burying the shared vocabulary.
  const details = sidebar.querySelector('details');
  if (details) sidebar.insertBefore(section, details);
  else sidebar.appendChild(section);
  refresh();

  // Selection changes are currently represented by the production selected
  // mesh facade rather than an event. Refresh on pointer/focus return without
  // introducing a second selection store or polling loop.
  const refreshFromInteraction = () => refresh();
  document.addEventListener('pointerup', refreshFromInteraction, true);
  document.addEventListener('focusin', refreshFromInteraction, true);

  return {
    refresh,
    dispose: () => {
      document.removeEventListener('pointerup', refreshFromInteraction, true);
      document.removeEventListener('focusin', refreshFromInteraction, true);
      section.remove();
    },
  };
}
