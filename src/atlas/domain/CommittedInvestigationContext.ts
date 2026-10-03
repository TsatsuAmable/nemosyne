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
}

/** Mutable activation state. Never hashed, never used as scientific meaning. */
export interface CommittedContextActivation {
  readonly contextId: string;
  readonly nodeId: string;
  readonly revision: number;
  readonly activationEpoch: number;
}

/** The bindings an asynchronous result must still hold to be adoptable. */
export interface ContextBinding {
  readonly contextId: string;
  readonly nodeId: string;
  readonly activationEpoch: number;
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

function normalizeEpistemicPurpose(value: unknown): EpistemicPurpose {
  if (value === undefined) return 'CLAIM_BEARING';
  if (typeof value !== 'string' || !EPISTEMIC_PURPOSES.includes(value as EpistemicPurpose)) {
    throw new TypeError(
      `CommittedInvestigationContext epistemicPurpose must be one of: ${EPISTEMIC_PURPOSES.join(', ')}`
    );
  }
  return value as EpistemicPurpose;
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

  const nodeId = normalizeNodeId(candidate.nodeId);
  const epistemicPurpose = normalizeEpistemicPurpose(candidate.epistemicPurpose);
  const intent = canonicalizeInvestigationIntent(candidate.intent);

  const canonical: {
    schemaVersion: 2;
    nodeId: string;
    epistemicPurpose: EpistemicPurpose;
    intent: InvestigationIntentV1;
    perspective?: InvestigationPerspectiveV1;
  } = {
    schemaVersion: COMMITTED_INVESTIGATION_CONTEXT_SCHEMA_V2,
    nodeId,
    epistemicPurpose,
    intent,
  };

  if (candidate.perspective !== undefined) {
    canonical.perspective = canonicalizeInvestigationPerspective(candidate.perspective);
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

  return { ok: true };
}

interface LedgerEntry {
  readonly context: CommittedInvestigationContextV2;
  readonly contextId: string;
  activation: CommittedContextActivation;
}

export class CommittedInvestigationContextLedger {
  private readonly _entries: Map<string, LedgerEntry> = new Map();
  private _revision = 0;
  private _epoch = 0;
  private _activeNodeId: string | null = null;

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
    this._revision = 0;
    this._epoch = 0;
    this._activeNodeId = null;
  }

  commit(nodeId: string, context: unknown): CommittedContextActivation {
    const canonical = canonicalizeCommittedInvestigationContext({ ...(context as object), nodeId });
    const contextId = computeCommittedContextIdentity(canonical);
    this._revision += 1;
    this._epoch += 1;
    const activation: CommittedContextActivation = {
      contextId,
      nodeId: canonical.nodeId,
      revision: this._revision,
      activationEpoch: this._epoch,
    };
    this._entries.set(canonical.nodeId, { context: canonical, contextId, activation });
    this._activeNodeId = canonical.nodeId;
    return activation;
  }

  activate(nodeId: string): CommittedContextActivation {
    const entry = this._entries.get(nodeId);
    if (entry === undefined) {
      throw new Error(`Cannot activate uncommitted investigation context node: ${nodeId}`);
    }
    this._epoch += 1;
    const nodeIdOfEntry = entry.context.nodeId;
    entry.activation = {
      contextId: entry.contextId,
      nodeId: nodeIdOfEntry,
      revision: entry.activation.revision,
      activationEpoch: this._epoch,
    };
    this._activeNodeId = nodeIdOfEntry;
    return entry.activation;
  }

  getCommitted(nodeId: string): CommittedInvestigationContextV2 | undefined {
    return this._entries.get(nodeId)?.context;
  }

  getActivation(nodeId: string): CommittedContextActivation | undefined {
    const entry = this._entries.get(nodeId);
    return entry === undefined ? undefined : entry.activation;
  }

  current(): CommittedContextActivation | undefined {
    return this._activeNodeId === null ? undefined : this.getActivation(this._activeNodeId);
  }

  currentBinding(): ContextBinding | undefined {
    const active = this.current();
    return active === undefined ? undefined : bindingOf(active);
  }
}
