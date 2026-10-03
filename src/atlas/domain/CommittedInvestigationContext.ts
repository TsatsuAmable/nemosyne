/**
 * CommittedInvestigationContext — the domain-owned committed meaning of an investigation step,
 * and the activation epoch that makes stale asynchronous adoption detectable.
 *
 * Authority: A27-0 §5 (committed context and fixed obligations), §9 (ephemeral execution
 * authorization bound to a context activation epoch) and invariants F01/F05/F11.
 *
 * Three separations matter and are enforced structurally here:
 *
 * 1. Content identity is content-addressed and immutable. `contextId` is a pure function of the
 *    committed meaning, so "revisit restores the exact value" holds by construction rather than by
 *    remembering a mutable copy.
 * 2. Activation state (revision, activationEpoch) is NOT hashed. Same-content revisit increments
 *    the epoch, which is precisely what makes an A->B->A race distinguishable from a genuine
 *    return to A.
 * 3. `studyId` and `observerMode` are deliberately absent. A27-0 §5 states they are not
 *    scientific input and not authorization, so admitting them here would let a study label or a
 *    UI mode read as analytical scope. Absence is preserved, never backfilled with defaults.
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

export const CONTEXT_INCOMPATIBLE = 'CONTEXT_INCOMPATIBLE' as const;

export interface CommittedInvestigationContextV1 {
  readonly schemaVersion: 1;
  readonly nodeId: string;
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

export function canonicalizeCommittedInvestigationContext(
  context: unknown
): CommittedInvestigationContextV1 {
  if (typeof context !== 'object' || context === null || Array.isArray(context)) {
    throw new TypeError('CommittedInvestigationContext must be a non-null object');
  }

  const candidate = context as Record<string, unknown>;
  const allowedKeys = new Set(['schemaVersion', 'nodeId', 'intent', 'perspective']);
  for (const key of Object.keys(candidate)) {
    if (!allowedKeys.has(key)) {
      throw new TypeError(`Unsupported CommittedInvestigationContext field: ${key}`);
    }
  }

  if (candidate.schemaVersion !== COMMITTED_INVESTIGATION_CONTEXT_SCHEMA_V1) {
    throw new TypeError(
      `Unsupported CommittedInvestigationContext schema version: ${String(candidate.schemaVersion)}`
    );
  }

  const nodeId = normalizeNodeId(candidate.nodeId);
  const intent = canonicalizeInvestigationIntent(candidate.intent);

  const canonical: {
    schemaVersion: 1;
    nodeId: string;
    intent: InvestigationIntentV1;
    perspective?: InvestigationPerspectiveV1;
  } = {
    schemaVersion: COMMITTED_INVESTIGATION_CONTEXT_SCHEMA_V1,
    nodeId,
    intent,
  };

  if (candidate.perspective !== undefined) {
    canonical.perspective = canonicalizeInvestigationPerspective(candidate.perspective);
  }

  return canonical;
}

export function computeCommittedContextIdentity(context: unknown): string {
  const canonical = canonicalizeCommittedInvestigationContext(context);
  return `sha256-committed-context-v1-${canonicalSha256Hex(canonical)}`;
}

function bindingOf(activation: CommittedContextActivation): ContextBinding {
  return {
    contextId: activation.contextId,
    nodeId: activation.nodeId,
    activationEpoch: activation.activationEpoch,
  };
}

/**
 * Compare a result's captured binding against the currently committed activation.
 *
 * Fail-closed: anything other than an exact three-way match refuses with CONTEXT_INCOMPATIBLE,
 * including a missing current activation. An exact match returns ok, which is the positive
 * control that keeps a universal-refusal implementation from passing review.
 */
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
  readonly context: CommittedInvestigationContextV1;
  readonly contextId: string;
  activation: CommittedContextActivation;
}

/**
 * Sole domain owner of committed investigation context.
 *
 * The session-side ResearchContext is not a second commit authority (A27-0 §5); it may only
 * project what this ledger has committed. Durable session/digest integration of that projection is
 * the serialized L2-FORMA-1 integration slice and is deliberately out of this lane's file set.
 */
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

  /** Commit new meaning at a node: a new context revision, and a new activation epoch. */
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

  /**
   * Revisit an already-committed node. Restores the exact committed value and increments the
   * activation epoch, so returning to A after A->B is distinguishable from the original A.
   */
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

  /** The exact committed content for a node. Absence is reported, never defaulted. */
  getCommitted(nodeId: string): CommittedInvestigationContextV1 | undefined {
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