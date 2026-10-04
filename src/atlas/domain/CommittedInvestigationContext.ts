/**
 * CommittedInvestigationContext — the domain-owned committed meaning of an investigation step,
 * and the activation epoch that makes stale asynchronous adoption detectable.
 *
 * Authority: A27-0 §5, A27-1 / RFC 0011 (dual epistemic context V2 identity and epistemic purpose).
 */

import { canonicalSha256Hex } from '../../security/CryptoHash.ts';
import {
  canonicalizeInvestigationIntent,
  type InvestigationIntentV1,
} from './InvestigationIntent.ts';
import {
  canonicalizeInvestigationPerspective,
  type InvestigationPerspectiveV1,
} from './InvestigationPerspective.ts';

export const COMMITTED_INVESTIGATION_CONTEXT_SCHEMA_V1 = 1;
export const COMMITTED_INVESTIGATION_CONTEXT_SCHEMA_V2 = 2;

export const CONTEXT_INCOMPATIBLE = 'CONTEXT_INCOMPATIBLE' as const;

export type EpistemicPurpose = 'CLAIM_BEARING' | 'EXPLORATORY_ABDUCTION';

export const EPISTEMIC_PURPOSES: readonly EpistemicPurpose[] = [
  'CLAIM_BEARING',
  'EXPLORATORY_ABDUCTION',
] as const;

export interface CommittedInvestigationContextV1 {
  readonly schemaVersion: 1;
  readonly nodeId: string;
  readonly intent: InvestigationIntentV1;
  readonly perspective?: InvestigationPerspectiveV1;
}

export interface CommittedInvestigationContextV2 {
  readonly schemaVersion: 2;
  readonly nodeId: string;
  readonly epistemicPurpose: EpistemicPurpose;
  readonly intent: InvestigationIntentV1;
  readonly perspective?: InvestigationPerspectiveV1;
  readonly investigationId?: string;
  readonly datasetFingerprint?: string;
  readonly scopeId?: string;
  readonly committedRevision?: number;
  readonly runtimeGeneration?: number;
}

/** Mutable activation state. Never hashed, never used as scientific meaning. */
export interface CommittedContextActivation {
  readonly contextId: string;
  readonly nodeId: string;
  readonly revision: number;
  readonly activationEpoch: number;
  readonly investigationId?: string;
  readonly datasetFingerprint?: string;
  readonly scopeId?: string;
  readonly runtimeGeneration?: number;
}

/** The bindings an asynchronous result must still hold to be adoptable. */
export interface ContextBinding {
  readonly contextId: string;
  readonly nodeId: string;
  readonly activationEpoch: number;
  readonly investigationId?: string;
  readonly datasetFingerprint?: string;
  readonly scopeId?: string;
  readonly runtimeGeneration?: number;
}

export type ContextCompatibility =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly code: typeof CONTEXT_INCOMPATIBLE;
      readonly reason: string;
    };

function normalizeNodeId(value: unknown): string {
  if (typeof value !== 'string') {
    throw new TypeError('CommittedInvestigationContext nodeId must be a string');
  }
  const normalized = value.normalize('NFC').trim();
  if (normalized === '') {
    throw new TypeError('CommittedInvestigationContext nodeId cannot be empty');
  }
  return normalized;
}

function normalizeEpistemicPurpose(value: unknown, isV2 = false): EpistemicPurpose {
  if (value === undefined) {
    if (isV2) {
      throw new TypeError(
        'CommittedInvestigationContext V2 requires explicit epistemicPurpose: "CLAIM_BEARING" | "EXPLORATORY_ABDUCTION"'
      );
    }
    return 'CLAIM_BEARING';
  }
  if (typeof value !== 'string' || !EPISTEMIC_PURPOSES.includes(value as EpistemicPurpose)) {
    throw new TypeError(
      `CommittedInvestigationContext epistemicPurpose must be one of: ${EPISTEMIC_PURPOSES.join(', ')}`
    );
  }
  return value as EpistemicPurpose;
}

function normalizeOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new TypeError(`CommittedInvestigationContext ${fieldName} must be a string`);
  }
  const normalized = value.normalize('NFC').trim();
  if (normalized === '') {
    throw new TypeError(`CommittedInvestigationContext ${fieldName} cannot be empty`);
  }
  return normalized;
}

function normalizeOptionalPositiveInteger(value: unknown, fieldName: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new TypeError(`CommittedInvestigationContext ${fieldName} must be a positive integer`);
  }
  return value;
}

export function canonicalizeCommittedInvestigationContext(
  context: unknown
): CommittedInvestigationContextV2 {
  if (typeof context !== 'object' || context === null || Array.isArray(context)) {
    throw new TypeError('CommittedInvestigationContext must be a non-null object');
  }

  const candidate = context as Record<string, unknown>;
  const allowedKeys = new Set([
    'schemaVersion',
    'nodeId',
    'epistemicPurpose',
    'intent',
    'perspective',
    'investigationId',
    'datasetFingerprint',
    'scopeId',
    'committedRevision',
    'runtimeGeneration',
  ]);
  for (const key of Object.keys(candidate)) {
    if (!allowedKeys.has(key)) {
      throw new TypeError(`Unsupported CommittedInvestigationContext field: ${key}`);
    }
  }

  const version = candidate.schemaVersion;
  if (
    version !== COMMITTED_INVESTIGATION_CONTEXT_SCHEMA_V1 &&
    version !== COMMITTED_INVESTIGATION_CONTEXT_SCHEMA_V2
  ) {
    throw new TypeError(
      `Unsupported CommittedInvestigationContext schema version: ${String(version)}`
    );
  }

  const isV2 = version === COMMITTED_INVESTIGATION_CONTEXT_SCHEMA_V2;
  const nodeId = normalizeNodeId(candidate.nodeId);
  const epistemicPurpose = normalizeEpistemicPurpose(candidate.epistemicPurpose, isV2);
  const intent = canonicalizeInvestigationIntent(candidate.intent);

  const canonical: {
    schemaVersion: 2;
    nodeId: string;
    epistemicPurpose: EpistemicPurpose;
    intent: InvestigationIntentV1;
    perspective?: InvestigationPerspectiveV1;
    investigationId?: string;
    datasetFingerprint?: string;
    scopeId?: string;
    committedRevision?: number;
    runtimeGeneration?: number;
  } = {
    schemaVersion: COMMITTED_INVESTIGATION_CONTEXT_SCHEMA_V2,
    nodeId,
    epistemicPurpose,
    intent,
  };

  if (candidate.perspective !== undefined) {
    canonical.perspective = canonicalizeInvestigationPerspective(candidate.perspective);
  }
  if (candidate.investigationId !== undefined) {
    canonical.investigationId = normalizeOptionalString(candidate.investigationId, 'investigationId');
  }
  if (candidate.datasetFingerprint !== undefined) {
    canonical.datasetFingerprint = normalizeOptionalString(candidate.datasetFingerprint, 'datasetFingerprint');
  }
  if (candidate.scopeId !== undefined) {
    canonical.scopeId = normalizeOptionalString(candidate.scopeId, 'scopeId');
  }
  if (candidate.committedRevision !== undefined) {
    canonical.committedRevision = normalizeOptionalPositiveInteger(candidate.committedRevision, 'committedRevision');
  }
  if (candidate.runtimeGeneration !== undefined) {
    canonical.runtimeGeneration = normalizeOptionalPositiveInteger(candidate.runtimeGeneration, 'runtimeGeneration');
  }

  return canonical;
}

export function computeCommittedContextIdentity(context: unknown): string {
  const canonical = canonicalizeCommittedInvestigationContext(context);
  return `sha256-committed-context-v2-${canonicalSha256Hex(canonical)}`;
}

function bindingOf(activation: CommittedContextActivation): ContextBinding {
  return {
    contextId: activation.contextId,
    nodeId: activation.nodeId,
    activationEpoch: activation.activationEpoch,
    investigationId: activation.investigationId,
    datasetFingerprint: activation.datasetFingerprint,
    scopeId: activation.scopeId,
    runtimeGeneration: activation.runtimeGeneration,
  };
}

export function checkContextCompatibility(
  captured: ContextBinding,
  current: CommittedContextActivation | undefined
): ContextCompatibility {
  if (current === undefined) {
    return {
      ok: false,
      code: CONTEXT_INCOMPATIBLE,
      reason: 'No committed context is active; the captured binding cannot be adopted.',
    };
  }

  const active = bindingOf(current);
  if (captured.contextId !== active.contextId) {
    return {
      ok: false,
      code: CONTEXT_INCOMPATIBLE,
      reason: `Committed context changed: captured ${captured.contextId}, active ${active.contextId}.`,
    };
  }
  if (captured.nodeId !== active.nodeId) {
    return {
      ok: false,
      code: CONTEXT_INCOMPATIBLE,
      reason: `Wrong node: captured ${captured.nodeId}, active ${active.nodeId}.`,
    };
  }
  if (captured.activationEpoch !== active.activationEpoch) {
    return {
      ok: false,
      code: CONTEXT_INCOMPATIBLE,
      reason: `Stale activation epoch: captured ${captured.activationEpoch}, active ${active.activationEpoch}.`,
    };
  }
  if (
    captured.datasetFingerprint !== undefined &&
    active.datasetFingerprint !== undefined &&
    captured.datasetFingerprint !== active.datasetFingerprint
  ) {
    return {
      ok: false,
      code: CONTEXT_INCOMPATIBLE,
      reason: `Dataset fingerprint mismatch: captured ${captured.datasetFingerprint}, active ${active.datasetFingerprint}.`,
    };
  }
  if (
    captured.investigationId !== undefined &&
    active.investigationId !== undefined &&
    captured.investigationId !== active.investigationId
  ) {
    return {
      ok: false,
      code: CONTEXT_INCOMPATIBLE,
      reason: `Investigation mismatch: captured ${captured.investigationId}, active ${active.investigationId}.`,
    };
  }
  if (
    captured.scopeId !== undefined &&
    active.scopeId !== undefined &&
    captured.scopeId !== active.scopeId
  ) {
    return {
      ok: false,
      code: CONTEXT_INCOMPATIBLE,
      reason: `Scope mismatch: captured ${captured.scopeId}, active ${active.scopeId}.`,
    };
  }
  if (
    captured.runtimeGeneration !== undefined &&
    active.runtimeGeneration !== undefined &&
    captured.runtimeGeneration !== active.runtimeGeneration
  ) {
    return {
      ok: false,
      code: CONTEXT_INCOMPATIBLE,
      reason: `Runtime generation mismatch: captured ${captured.runtimeGeneration}, active ${active.runtimeGeneration}.`,
    };
  }

  return { ok: true };
}

interface LedgerEntry {
  readonly context: CommittedInvestigationContextV2;
  readonly contextId: string;
  activation: CommittedContextActivation;
}

export class CommittedInvestigationContextLedger {
  private static _monotonicEpochCounter = 0;
  private readonly _entries: Map<string, LedgerEntry> = new Map();
  private readonly _history: Map<string, LedgerEntry[]> = new Map();
  private _revision = 0;
  private _epoch = 0;
  private _activeNodeId: string | null = null;

  constructor() {
    CommittedInvestigationContextLedger._monotonicEpochCounter += 1;
    this._epoch = CommittedInvestigationContextLedger._monotonicEpochCounter;
  }

  get activeNodeId(): string | null {
    return this._activeNodeId;
  }

  get revision(): number {
    return this._revision;
  }

  get activationEpoch(): number {
    return this._epoch;
  }

  reset(): void {
    this._entries.clear();
    this._history.clear();
    this._revision = 0;
    // Epoch must NEVER rewind to 0 on reset; advance monotonic counter
    CommittedInvestigationContextLedger._monotonicEpochCounter += 1;
    this._epoch = CommittedInvestigationContextLedger._monotonicEpochCounter;
    this._activeNodeId = null;
  }

  commit(nodeId: string, context: unknown): CommittedContextActivation {
    this._revision += 1;
    CommittedInvestigationContextLedger._monotonicEpochCounter += 1;
    this._epoch = CommittedInvestigationContextLedger._monotonicEpochCounter;

    const candidate = ((typeof context === 'object' && context !== null) ? context : {}) as Record<string, unknown>;
    const existingHistory = this._history.get(nodeId) ?? [];
    const canonicalInput: Record<string, unknown> = {
      ...candidate,
      nodeId,
    };
    if (candidate.committedRevision !== undefined) {
      canonicalInput.committedRevision = candidate.committedRevision;
    }

    const canonical = canonicalizeCommittedInvestigationContext(canonicalInput);
    const contextId = computeCommittedContextIdentity(canonical);

    const activation: CommittedContextActivation = {
      contextId,
      nodeId: canonical.nodeId,
      revision: this._revision,
      activationEpoch: this._epoch,
      investigationId: canonical.investigationId,
      datasetFingerprint: canonical.datasetFingerprint,
      scopeId: canonical.scopeId,
      runtimeGeneration: canonical.runtimeGeneration,
    };

    const entry: LedgerEntry = { context: canonical, contextId, activation };
    this._entries.set(canonical.nodeId, entry);

    existingHistory.push(entry);
    this._history.set(canonical.nodeId, existingHistory);
    this._activeNodeId = canonical.nodeId;
    return activation;
  }

  activate(nodeId: string, revision?: number): CommittedContextActivation {
    const history = this._history.get(nodeId);
    if (!history || history.length === 0) {
      throw new Error(`Cannot activate uncommitted investigation context node: ${nodeId}`);
    }

    let targetEntry: LedgerEntry | undefined;
    if (revision !== undefined) {
      targetEntry = history.find((e) => e.activation.revision === revision);
      if (!targetEntry) {
        throw new Error(
          `Cannot activate revision ${revision} for node ${nodeId}; available revisions: ${history.map((e) => e.activation.revision).join(', ')}`
        );
      }
    } else {
      targetEntry = this._entries.get(nodeId) ?? history[history.length - 1];
    }

    CommittedInvestigationContextLedger._monotonicEpochCounter += 1;
    this._epoch = CommittedInvestigationContextLedger._monotonicEpochCounter;

    const updatedActivation: CommittedContextActivation = {
      contextId: targetEntry.contextId,
      nodeId: targetEntry.context.nodeId,
      revision: targetEntry.activation.revision,
      activationEpoch: this._epoch,
      investigationId: targetEntry.context.investigationId,
      datasetFingerprint: targetEntry.context.datasetFingerprint,
      scopeId: targetEntry.context.scopeId,
      runtimeGeneration: targetEntry.context.runtimeGeneration,
    };

    targetEntry.activation = updatedActivation;
    this._entries.set(nodeId, targetEntry);
    this._activeNodeId = targetEntry.context.nodeId;
    return updatedActivation;
  }

  getCommitted(nodeId: string, revision?: number): CommittedInvestigationContextV2 | undefined {
    if (revision !== undefined) {
      const history = this._history.get(nodeId);
      return history?.find((e) => e.activation.revision === revision)?.context;
    }
    return this._entries.get(nodeId)?.context;
  }

  getRevisions(nodeId: string): readonly CommittedInvestigationContextV2[] {
    const history = this._history.get(nodeId);
    return history ? history.map((e) => e.context) : [];
  }

  getActivation(nodeId: string): CommittedContextActivation | undefined {
    const entry = this._entries.get(nodeId);
    return entry === undefined ? undefined : entry.activation;
  }

  current(): CommittedContextActivation | undefined {
    return this._activeNodeId === null ? undefined : this.getActivation(this._activeNodeId);
  }

  getActiveActivation(): CommittedContextActivation | undefined {
    return this.current();
  }

  currentBinding(): ContextBinding | undefined {
    const active = this.current();
    return active === undefined ? undefined : bindingOf(active);
  }
}
