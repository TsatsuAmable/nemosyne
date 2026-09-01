/**
 * Status Strip & Calm Spotlight Context Model (Sprint 24.8, P1-UV C2).
 *
 * The strip is a presentation-only projection. It does not classify analytical
 * state, infer epistemic relationships, or own recovery/history authority.
 */

import { InteractionMode } from '../input/InteractionModeController.ts';
import type { SemanticEmbodimentPresentationStatus } from '../../moneta/embodiment/SemanticEmbodimentStatus.ts';
import type { RepresentationDecisionStatus } from '../../moneta/representation/DecisionPolicy.ts';

export type SemanticColorRole =
  | 'neutral'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'analysis'
  | 'observation';

export const SEMANTIC_PALETTE: Record<SemanticColorRole, string> = {
  neutral: '#8892b0',
  accent: '#64ffda',
  success: '#20c997',
  warning: '#ffd166',
  danger: '#ef476f',
  analysis: '#70a5fd',
  observation: '#d8b4e2',
};

export type InvestigationAnalyticalStatus =
  | SemanticEmbodimentPresentationStatus
  | 'IDLE';
export type RepresentationCommitState = 'COMMITTED' | 'PREVIEW';
export type InvestigationDecisionState = RepresentationDecisionStatus | 'PENDING';

export interface InvestigationEvidenceSummary {
  supports: number;
  refutes: number;
  observations: number;
  findings: number;
}

export interface InvestigationRecoverySummary {
  canUndo: boolean;
  canRedo: boolean;
  archiveCount: number;
}

export interface InvestigationOriginSummary {
  activeNodeId: string | null;
  parentNodeId: string | null;
  branchSourceId: string | null;
}

export interface InvestigationStatusProjection {
  focusLevel: string;
  focusTarget: string | null;
  analyticalStatus: InvestigationAnalyticalStatus;
  analyticalMessage: string | null;
  decisionState: InvestigationDecisionState;
  representationState: RepresentationCommitState;
  previewDecisionId: string | null;
  evidence: InvestigationEvidenceSummary;
  recovery: InvestigationRecoverySummary;
  origin: InvestigationOriginSummary;
}

export interface StatusStripState {
  datasetLabel: string;
  topology: string;
  itemCount: number;
  mode: InteractionMode;
  focusLevel: string;
  focusTarget: string | null;
  lastAction: string | null;
  nextAffordance: string | null;
  analyticalStatus: InvestigationAnalyticalStatus;
  analyticalMessage: string | null;
  decisionState: InvestigationDecisionState;
  representationState: RepresentationCommitState;
  previewDecisionId: string | null;
  evidence: InvestigationEvidenceSummary;
  recovery: InvestigationRecoverySummary;
  origin: InvestigationOriginSummary;
}

export const DEFAULT_STATUS_STRIP_STATE: StatusStripState = {
  datasetLabel: 'NONE',
  topology: 'TABULAR',
  itemCount: 0,
  mode: 'NAVIGATE',
  focusLevel: 'dataset',
  focusTarget: null,
  lastAction: null,
  nextAffordance: 'Select dataset or open HandWheel',
  analyticalStatus: 'IDLE',
  analyticalMessage: null,
  decisionState: 'PENDING',
  representationState: 'COMMITTED',
  previewDecisionId: null,
  evidence: { supports: 0, refutes: 0, observations: 0, findings: 0 },
  recovery: { canUndo: false, canRedo: false, archiveCount: 0 },
  origin: { activeNodeId: null, parentNodeId: null, branchSourceId: null },
};

function clampCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function compactId(value: string | null, max = 24): string {
  if (!value) return 'ROOT';
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

export class StatusStripController {
  private _state: StatusStripState = {
    ...DEFAULT_STATUS_STRIP_STATE,
    evidence: { ...DEFAULT_STATUS_STRIP_STATE.evidence },
    recovery: { ...DEFAULT_STATUS_STRIP_STATE.recovery },
    origin: { ...DEFAULT_STATUS_STRIP_STATE.origin },
  };
  private _spotlightEntityId: string | null = null;

  get state(): StatusStripState {
    return this._state;
  }

  get spotlightEntityId(): string | null {
    return this._spotlightEntityId;
  }

  setDatasetContext(datasetLabel: string, topology: string, itemCount: number): void {
    this._state.datasetLabel = datasetLabel;
    this._state.topology = topology;
    this._state.itemCount = itemCount;
  }

  setInteractionMode(mode: InteractionMode): void {
    this._state.mode = mode;
  }

  setFocusTarget(target: string | null): void {
    this._state.focusTarget = target;
  }

  setFocusContext(level: string, target: string | null): void {
    this._state.focusLevel = level || 'dataset';
    this._state.focusTarget = target;
  }

  setNextAffordance(nextAffordance: string | null): void {
    this._state.nextAffordance = nextAffordance;
  }

  setInvestigationState(projection: InvestigationStatusProjection): void {
    this._state.focusLevel = projection.focusLevel || 'dataset';
    this._state.focusTarget = projection.focusTarget;
    this._state.analyticalStatus = projection.analyticalStatus;
    this._state.analyticalMessage = projection.analyticalMessage;
    this._state.decisionState = projection.decisionState;
    this._state.representationState = projection.representationState;
    this._state.previewDecisionId = projection.previewDecisionId;
    this._state.evidence = {
      supports: clampCount(projection.evidence.supports),
      refutes: clampCount(projection.evidence.refutes),
      observations: clampCount(projection.evidence.observations),
      findings: clampCount(projection.evidence.findings),
    };
    this._state.recovery = {
      canUndo: projection.recovery.canUndo,
      canRedo: projection.recovery.canRedo,
      archiveCount: clampCount(projection.recovery.archiveCount),
    };
    this._state.origin = { ...projection.origin };
  }

  recordAction(action: string, nextAffordance?: string): void {
    this._state.lastAction = action;
    if (nextAffordance) {
      this._state.nextAffordance = nextAffordance;
    }
  }

  setSpotlight(entityId: string | null): void {
    this._spotlightEntityId = entityId;
  }

  /**
   * Compatibility formatter retained for existing callers/tests. C2's visible
   * panel uses formatInvestigationLines() so legacy format contracts do not
   * silently change under unrelated consumers.
   */
  formatStripText(): string {
    const dataPart = `${this._state.topology} / ${this._state.itemCount.toLocaleString()} items`;
    const modePart = `MODE: ${this._state.mode}`;
    const focusPart = this._state.focusTarget ? `FOCUS: ${this._state.focusTarget}` : 'FOCUS: NONE';
    const actionPart = this._state.lastAction ? `ACTION: ${this._state.lastAction}` : null;

    return [dataPart, modePart, focusPart, actionPart].filter(Boolean).join(' · ');
  }

  /** Compact normal-mode grounding text; each row answers one C2 question family. */
  formatInvestigationLines(): string[] {
    const focus = this._state.focusTarget
      ? `${this._state.focusLevel.toUpperCase()}:${compactId(this._state.focusTarget)}`
      : this._state.focusLevel.toUpperCase();
    const context = `${this._state.datasetLabel} · ${this._state.topology}/${this._state.itemCount.toLocaleString()} · FOCUS ${focus}`;

    const evidence = this._state.evidence;
    const analysis =
      `ANALYSIS ${this._state.analyticalStatus} · DECISION ${this._state.decisionState} · ` +
      `${this._state.representationState} · EVIDENCE +${evidence.supports}/-${evidence.refutes} O${evidence.observations} F${evidence.findings}`;

    const recoveryTokens = [
      this._state.recovery.canUndo ? 'UNDO' : null,
      this._state.recovery.canRedo ? 'REDO' : null,
      this._state.recovery.archiveCount > 0 ? `ARCHIVE×${this._state.recovery.archiveCount}` : null,
    ].filter(Boolean);
    const origin = this._state.origin.branchSourceId
      ? `BRANCH FROM ${compactId(this._state.origin.branchSourceId)}`
      : this._state.origin.parentNodeId
        ? `FROM ${compactId(this._state.origin.parentNodeId)}`
        : this._state.origin.activeNodeId
          ? `STATE ${compactId(this._state.origin.activeNodeId)}`
          : 'ORIGIN ROOT';
    const recovery = `RECOVERY ${recoveryTokens.length > 0 ? recoveryTokens.join('/') : 'NONE'} · ${origin}`;

    const change = this._state.lastAction ?? 'No recorded change';
    const next = this._state.nextAffordance ?? 'Continue investigation';
    const action = `CHANGE ${change} · NEXT ${next}`;

    return [context, analysis, recovery, action];
  }
}
