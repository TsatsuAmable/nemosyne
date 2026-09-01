export type InvestigatorTaskIntent =
  | 'inspect'
  | 'compare'
  | 'challenge'
  | 'record'
  | 'navigate'
  | 'more';

export interface InvestigatorTaskDefinition {
  id: InvestigatorTaskIntent;
  label: string;
  description: string;
}

/** Canonical selected-object task vocabulary shared by desktop and XR presentation. */
export const INVESTIGATOR_TASKS: readonly InvestigatorTaskDefinition[] = [
  { id: 'inspect', label: 'Inspect', description: 'Inspect the selected data object' },
  { id: 'compare', label: 'Compare', description: 'Compare from the selected data object' },
  { id: 'challenge', label: 'Challenge', description: 'Challenge the current interpretation' },
  { id: 'record', label: 'Record', description: 'Record evidence from the selected object' },
  { id: 'navigate', label: 'Navigate', description: 'Navigate from the selected object' },
  { id: 'more', label: 'More', description: 'Open constraints and additional context' },
] as const;

export interface InvestigatorTaskCallbacks {
  onInspect?: (data: Record<string, unknown> | null) => void;
  onCompare?: (data: Record<string, unknown> | null) => void;
  onChallenge?: (data: Record<string, unknown> | null) => void;
  onRecord?: (data: Record<string, unknown> | null) => void;
  onNavigate?: (data: Record<string, unknown> | null) => void;
  onMore?: (data: Record<string, unknown> | null) => void;
}

/**
 * Dispatch one selected-object task into the same callback seam used by the
 * immersive ContextualTaskSurface. This is presentation dispatch only: it does
 * not own selection, analytics, evidence classification, or navigation state.
 */
export function dispatchInvestigatorTask(
  callbacks: InvestigatorTaskCallbacks,
  intent: InvestigatorTaskIntent,
  data: Record<string, unknown> | null,
): boolean {
  const callback = {
    inspect: callbacks.onInspect,
    compare: callbacks.onCompare,
    challenge: callbacks.onChallenge,
    record: callbacks.onRecord,
    navigate: callbacks.onNavigate,
    more: callbacks.onMore,
  }[intent];

  if (!callback) return false;
  callback(data);
  return true;
}
