import {
  INVESTIGATOR_TASKS,
  type InvestigatorTaskIntent,
} from './intents/InvestigatorTaskIntent.ts';

export interface DesktopSelectionTaskContext {
  label: string;
  data: Record<string, unknown>;
}

export interface DesktopSelectionTaskAvailability {
  available: boolean;
  reason?: string;
}

export interface DesktopSelectionTaskActions {
  getSelection(): DesktopSelectionTaskContext | null;
  dispatchTask(intent: InvestigatorTaskIntent, data: Record<string, unknown>): boolean;
  taskAvailability?(
    intent: InvestigatorTaskIntent,
    data: Record<string, unknown> | null,
  ): DesktopSelectionTaskAvailability;
  subscribeSelectionContext?(handler: () => void): () => void;
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
    for (const task of INVESTIGATOR_TASKS) {
      const button = buttons.get(task.id);
      if (!button) continue;
      const availability: DesktopSelectionTaskAvailability = selected
        ? (actions.taskAvailability?.(task.id, selected.data) ?? { available: true })
        : { available: false, reason: 'Select an object' };
      if (availability.available) button.removeAttribute('disabled');
      else button.setAttribute('disabled', '');
      button.setAttribute('title', availability.reason ?? task.description);
      button.setAttribute('aria-description', availability.reason ?? task.description);
    }
  };

  for (const task of INVESTIGATOR_TASKS) {
    const button = document.createElement('nms-button');
    button.id = `desktop-task-${task.id}`;
    // nms-button mirrors light-DOM text into its shadow control. Using the
    // component's label attribute avoids exposing the same visible label twice
    // through the composed accessibility/text tree.
    button.setAttribute('label', task.label);
    button.setAttribute('aria-label', task.label);
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
      const availability = actions.taskAvailability?.(task.id, selected.data) ?? {
        available: true,
      };
      if (!availability.available) {
        feedback.textContent = availability.reason ?? `${task.label} is unavailable.`;
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

  // The composition root supplies a read-only authoritative selection/context
  // subscription. Avoid document-wide interaction listeners that would turn
  // focus or pointer activity into a second, timing-sensitive selection signal.
  const unsubscribeSelectionContext = actions.subscribeSelectionContext?.(refresh) ?? null;

  return {
    refresh,
    dispose: () => {
      unsubscribeSelectionContext?.();
      section.remove();
    },
  };
}
