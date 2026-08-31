import type {
  SemanticDetailTransition,
  SemanticDetailTransitionSnapshot,
} from './SemanticDetailTransition.ts';

export interface SemanticDetailReturnControlHandle {
  readonly element: HTMLElement;
  refresh(): void;
  dispose(): void;
}

function isDetailActive(snapshot: SemanticDetailTransitionSnapshot): boolean {
  return snapshot.parent !== null && (snapshot.status === 'PENDING' || snapshot.status === 'READY');
}

/**
 * Desktop product affordance for the A3 reverse transition.
 *
 * Semantic detail is an overlay on top of the selected dataset-level structure,
 * never a replacement representation. Returning therefore clears only the
 * bounded observation overlay/request state and deliberately leaves the parent
 * semantic selection intact. No rows, analytics, or representation rebuilds
 * are involved in this control.
 */
export function mountSemanticDetailReturnControl(
  transition: SemanticDetailTransition,
  root: HTMLElement = document.body,
): SemanticDetailReturnControlHandle {
  const button = document.createElement('nms-button');
  button.id = 'semantic-detail-return';
  button.setAttribute('variant', 'ghost');
  button.setAttribute('size', 'sm');
  button.setAttribute('aria-label', 'Back to containing semantic structure');
  button.textContent = 'Back to structure';
  button.style.cssText = `
    position: fixed;
    top: calc(var(--nms-spacing-x16) + 56px);
    left: 304px;
    z-index: 34;
    pointer-events: auto;
  `;

  let disposed = false;

  const refresh = (): void => {
    if (disposed) return;
    const active = isDetailActive(transition.snapshot);
    button.hidden = !active;
    button.setAttribute('aria-hidden', active ? 'false' : 'true');
  };

  const returnToStructure = (): void => {
    const snapshot = transition.snapshot;
    if (!isDetailActive(snapshot)) {
      refresh();
      return;
    }
    transition.clear();
  };

  button.addEventListener('click', returnToStructure);
  root.appendChild(button);
  const unsubscribe = transition.subscribe(refresh);

  return {
    element: button,
    refresh,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      button.removeEventListener('click', returnToStructure);
      button.remove();
    },
  };
}
