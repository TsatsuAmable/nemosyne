/**
 * Nemosyne Interaction Language (NIL) — modality-independent semantic commands.
 *
 * Physical input belongs to Perception/Gesture Intelligence. NIL records what
 * the researcher intends to do, so the same investigation can be replayed from
 * VR, desktop, accessibility interfaces, agents, or future modalities.
 */

export const NIL_VERSION = '1.0.0' as const;

export type NilVerb =
  | 'FOCUS'
  | 'ZOOM'
  | 'EXPAND'
  | 'COLLAPSE'
  | 'RETURN'
  | 'SELECT'
  | 'FILTER'
  | 'ISOLATE'
  | 'GROUP'
  | 'COMPARE'
  | 'JOIN'
  | 'SPLIT'
  | 'SHOW'
  | 'HIDE'
  | 'REPLACE'
  | 'OVERLAY'
  | 'ENCODE'
  | 'REMAP'
  | 'EXPAND_DETAIL'
  | 'CHANGE_SCALE'
  | 'CLUSTER'
  | 'CORRELATE'
  | 'ANOMALY'
  | 'DISTRIBUTE'
  | 'PROJECT'
  | 'TRANSFORM'
  | 'SPECTRAL_ANALYSE'
  | 'TRACE'
  | 'OBSERVE'
  | 'QUESTION'
  | 'HYPOTHESISE'
  | 'TEST'
  | 'SUPPORT'
  | 'REFUTE'
  | 'ANNOTATE'
  | 'CONCLUDE'
  | 'PREFER'
  | 'REJECT'
  | 'ADJUST_WEIGHT'
  | 'REQUEST_ALTERNATIVE'
  | 'EXPLAIN';

export type NilParameterValue = string | number | boolean | null | readonly string[] | readonly number[];

export interface NilCommand {
  nilVersion: typeof NIL_VERSION;
  commandId: string;
  investigationId: string;
  sequence: number;
  verb: NilVerb;
  targetIds: readonly string[];
  parameters: Readonly<Record<string, NilParameterValue>>;
  actor: 'researcher' | 'agent' | 'replay';
}

export interface NilValidationIssue {
  path: string;
  message: string;
}

function nonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function finiteParameter(value: NilParameterValue): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) {
    return value.every((entry) => typeof entry !== 'number' || Number.isFinite(entry));
  }
  return true;
}

export function validateNilCommand(command: NilCommand): NilValidationIssue[] {
  const issues: NilValidationIssue[] = [];

  if (command.nilVersion !== NIL_VERSION) {
    issues.push({ path: 'nilVersion', message: `unsupported NIL version: ${command.nilVersion}` });
  }
  if (!nonEmpty(command.commandId)) issues.push({ path: 'commandId', message: 'must be non-empty' });
  if (!nonEmpty(command.investigationId)) {
    issues.push({ path: 'investigationId', message: 'must be non-empty' });
  }
  if (!Number.isSafeInteger(command.sequence) || command.sequence < 0) {
    issues.push({ path: 'sequence', message: 'must be a non-negative safe integer' });
  }
  if (command.targetIds.some((id) => !nonEmpty(id))) {
    issues.push({ path: 'targetIds', message: 'target identifiers must be non-empty' });
  }

  for (const [key, value] of Object.entries(command.parameters)) {
    if (!nonEmpty(key)) issues.push({ path: 'parameters', message: 'parameter keys must be non-empty' });
    if (!finiteParameter(value)) {
      issues.push({ path: `parameters.${key}`, message: 'numeric parameters must be finite' });
    }
  }

  return issues;
}

export class InvalidNilCommandError extends Error {
  readonly issues: readonly NilValidationIssue[];

  constructor(issues: readonly NilValidationIssue[]) {
    super(`Invalid NIL command: ${issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ')}`);
    this.name = 'InvalidNilCommandError';
    this.issues = issues;
  }
}

export function assertNilCommand(command: NilCommand): void {
  const issues = validateNilCommand(command);
  if (issues.length > 0) throw new InvalidNilCommandError(issues);
}

/**
 * Canonical replay representation. Object keys are emitted in a fixed order;
 * parameters are sorted lexicographically to avoid modality/runtime ordering.
 */
export function canonicalizeNilCommand(command: NilCommand): string {
  assertNilCommand(command);
  const parameters = Object.fromEntries(
    Object.entries(command.parameters).sort(([left], [right]) => left.localeCompare(right))
  );
  return JSON.stringify({
    nilVersion: command.nilVersion,
    commandId: command.commandId,
    investigationId: command.investigationId,
    sequence: command.sequence,
    verb: command.verb,
    targetIds: [...command.targetIds],
    parameters,
    actor: command.actor,
  });
}
