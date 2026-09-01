import type { AtlasCore } from '../../atlas/AtlasCore.ts';
import {
  createDefaultRequirements,
  type AnalyticalTask,
  type RepresentationRequirements,
} from '../../moneta/representation/RepresentationRequirements.ts';
import {
  hashRequirements,
  type InvestigatorActionableOutcome,
  type RemedialAction,
} from '../../moneta/representation/ActionableNil.ts';
import type { RepresentationDecision } from '../../moneta/representation/RepresentationDecision.ts';

export interface RepresentationDecisionSummary {
  id: string | null;
  candidateId: string | null;
  family: string | null;
  layout: string | null;
  status: string | null;
  utilityScore: number | null;
  preserves: readonly string[];
  loses: readonly string[];
}

export interface RepresentationAlternativeSummary {
  candidateId: string;
  family: string;
  layout: string;
  utilityScore: number;
  preserves: readonly string[];
  loses: readonly string[];
  disqualified: boolean;
  reason: string | null;
}

export interface RepresentationConstraintSummary {
  rule: string;
  candidateId: string;
  candidateName: string;
  reason: string;
  remediationId: string | null;
}

export interface RepresentationRemediationSummary {
  id: string;
  label: string;
  description: string;
  deviceFeasibility: string;
  scientificallyPermissible: boolean;
}

export interface RepresentationReviewSnapshot {
  outcomeState: string | null;
  explanation: string | null;
  current: RepresentationDecisionSummary | null;
  preview: RepresentationDecisionSummary | null;
  previewActionId: string | null;
  alternatives: readonly RepresentationAlternativeSummary[];
  constraints: readonly RepresentationConstraintSummary[];
  remediations: readonly RepresentationRemediationSummary[];
  canRevertLastChange: boolean;
  lastRemediationId: string | null;
}

export interface RepresentationReviewHost {
  atlas: AtlasCore;
  getOutcome(): InvestigatorActionableOutcome | null;
  getFencedPreviewDecision(): RepresentationDecision | null;
  getFencedPreviewAction(): RemedialAction | null;
  previewRemediation(action: RemedialAction): boolean;
  commitRemediation(action: RemedialAction): void;
  cancelRemediationPreview(): void;
  applyRemediation(action: RemedialAction): void;
}

function summarizeDecision(decision: RepresentationDecision | null): RepresentationDecisionSummary | null {
  if (!decision) return null;
  return {
    id: decision.id ?? null,
    candidateId: decision.chosenCandidateId ?? null,
    family: decision.chosenFamily ?? decision.representationFamily ?? null,
    layout: decision.chosenLayout ?? decision.embodiment?.primaryLayout ?? null,
    status: decision.decisionStatus ?? null,
    utilityScore: Number.isFinite(decision.utilityScore) ? decision.utilityScore : null,
    preserves: decision.preserves ?? [],
    loses: decision.loses ?? [],
  };
}

function reconstructRequirements(
  events: ReturnType<AtlasCore['remediationEvents']>,
): RepresentationRequirements {
  let requirements = createDefaultRequirements('individual-inspection');
  for (const event of events) {
    if (event.requirementPatch) {
      requirements = { ...requirements, ...event.requirementPatch };
    }
  }
  return requirements;
}

/**
 * Presentation/orchestration seam for skeptical representation review.
 *
 * It reads the existing Moneta/Atlas outcome and invokes the existing fenced
 * preview/commit path. Explicit task comparison is a researcher-authored
 * requirement change evaluated by Moneta, not a UI-selected analytical result.
 * Revert is append-only: it reconstructs the requirements immediately before
 * the latest remediation, verifies persisted hashes, then applies those prior
 * requirements as a new remediation event through the same World-owned path.
 */
export class RepresentationReviewService {
  private readonly host: RepresentationReviewHost;

  constructor(host: RepresentationReviewHost) {
    this.host = host;
  }

  snapshot(): RepresentationReviewSnapshot {
    const outcome = this.host.getOutcome();
    const current = this.host.atlas.activeRepresentationDecision;
    const preview = this.host.getFencedPreviewDecision();
    const previewAction = preview ? this.host.getFencedPreviewAction() : null;
    const events = this.host.atlas.remediationEvents();
    const last = events.at(-1) ?? null;

    const ranked = current?.rankedCandidates ?? outcome?.nearMisses ?? [];
    const alternatives: RepresentationAlternativeSummary[] = ranked
      .filter((candidate) => candidate.candidateId !== current?.chosenCandidateId)
      .slice(0, 5)
      .map((candidate) => ({
        candidateId: candidate.candidateId,
        family: candidate.family,
        layout: candidate.layout,
        utilityScore: candidate.score,
        preserves: candidate.preserves,
        loses: candidate.loses,
        disqualified: Boolean(candidate.disqualified),
        reason: candidate.disqualificationReason ?? null,
      }));

    return {
      outcomeState: outcome?.state ?? current?.decisionStatus ?? null,
      explanation: outcome?.readableExplanation ?? current?.explanation ?? null,
      current: summarizeDecision(current),
      preview: summarizeDecision(preview),
      previewActionId: previewAction?.id ?? null,
      alternatives,
      constraints: (outcome?.blockingConstraints ?? []).map((constraint) => ({
        rule: constraint.rule,
        candidateId: constraint.candidateId,
        candidateName: constraint.candidateName,
        reason: constraint.disqualificationReason,
        remediationId: constraint.remediationAction?.id ?? null,
      })),
      remediations: (outcome?.availableRemediations ?? []).map((action) => ({
        id: action.id,
        label: action.label,
        description: action.description,
        deviceFeasibility: action.deviceFeasibility,
        scientificallyPermissible: action.isSafeToRelax,
      })),
      canRevertLastChange: Boolean(
        last &&
        last.datasetFingerprint === this.host.atlas.datasetFingerprint &&
        last.oldRequirementsHash !== last.newRequirementsHash,
      ),
      lastRemediationId: last?.remediationId ?? null,
    };
  }

  preview(remediationId: string): RepresentationReviewSnapshot {
    const action = this.findCurrentAction(remediationId);
    return this.previewAction(action);
  }

  previewTaskAlternative(task: AnalyticalTask): RepresentationReviewSnapshot {
    const action: RemedialAction = {
      id: `compare-task:${task}`,
      label: `Compare ${task}`,
      kind: 'switch-task',
      description: `Preview Moneta's representation for the investigator-declared ${task} task.`,
      isSafeToRelax: true,
      deviceFeasibility: 'unverified',
      suggestedRequirementPatch: { task },
      unblocksCandidates: [],
    };
    return this.previewAction(action);
  }

  commit(remediationId?: string): RepresentationReviewSnapshot {
    const previewAction = this.host.getFencedPreviewAction();
    const action = previewAction && (!remediationId || previewAction.id === remediationId)
      ? previewAction
      : remediationId
        ? this.findCurrentAction(remediationId)
        : null;
    if (!action) throw new Error('No current representation preview is available to accept.');
    this.host.commitRemediation(action);
    return this.snapshot();
  }

  rejectPreview(): RepresentationReviewSnapshot {
    this.host.cancelRemediationPreview();
    return this.snapshot();
  }

  revertLastChange(): RepresentationReviewSnapshot {
    const events = this.host.atlas.remediationEvents();
    const last = events.at(-1);
    if (!last) throw new Error('No representation remediation is available to revert.');
    if (last.datasetFingerprint !== this.host.atlas.datasetFingerprint) {
      throw new Error('The latest remediation belongs to a different dataset and cannot be reverted here.');
    }
    if (last.oldRequirementsHash === last.newRequirementsHash) {
      throw new Error('The latest remediation did not change representation requirements.');
    }

    const previous = reconstructRequirements(events.slice(0, -1));
    const current = reconstructRequirements(events);
    if (hashRequirements(previous) !== last.oldRequirementsHash) {
      throw new Error('Prior representation requirements do not match the recorded remediation provenance.');
    }
    if (hashRequirements(current) !== last.newRequirementsHash) {
      throw new Error('Current representation requirements do not match the recorded remediation provenance.');
    }

    const revertAction: RemedialAction = {
      id: `revert:${last.remediationId}:${Date.now()}`,
      label: `Revert ${last.remediationId}`,
      kind: last.kind,
      description: 'Restore the exact requirements that preceded the latest remediation.',
      isSafeToRelax: true,
      deviceFeasibility: last.deviceFeasibility,
      suggestedRequirementPatch: previous,
      unblocksCandidates: [],
      constraintCode: last.constraintCode,
    };
    this.host.applyRemediation(revertAction);
    return this.snapshot();
  }

  private previewAction(action: RemedialAction): RepresentationReviewSnapshot {
    if (!this.host.previewRemediation(action)) {
      throw new Error(`Representation preview unavailable for ${action.id}.`);
    }
    return this.snapshot();
  }

  private findCurrentAction(remediationId: string): RemedialAction {
    const outcome = this.host.getOutcome();
    const action = outcome?.availableRemediations.find((candidate) => candidate.id === remediationId);
    if (!action) {
      throw new Error(`Current representation state has no remediation ${remediationId}.`);
    }
    return action;
  }
}
