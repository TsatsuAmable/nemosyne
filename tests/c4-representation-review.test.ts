import { describe, expect, it, vi } from 'vitest';
import type { AtlasCore } from '../src/atlas/AtlasCore.ts';
import {
  buildRemediationProvenance,
  type InvestigatorActionableOutcome,
  type RemedialAction,
} from '../src/moneta/representation/ActionableNil.ts';
import {
  createDefaultRequirements,
} from '../src/moneta/representation/RepresentationRequirements.ts';
import type { RepresentationDecision } from '../src/moneta/representation/RepresentationDecision.ts';
import {
  RepresentationReviewService,
} from '../src/app/investigation/RepresentationReviewService.ts';

function decision(candidateId: string, utilityScore: number): RepresentationDecision {
  const requirements = createDefaultRequirements('individual-inspection');
  return {
    id: `decision-${candidateId}`,
    chosenCandidateId: candidateId as RepresentationDecision['chosenCandidateId'],
    chosenFamily: 'POINT',
    chosenLayout: 'GRID_3D',
    representationFamily: 'POINT',
    utilityScore,
    decisionStatus: 'DECISIVE',
    preserves: [],
    loses: [],
    evidence: [],
    rejectedAlternatives: [],
    embodiment: {
      primaryLayout: 'GRID_3D',
      primaryGeometry: 'ICOSA_NODE',
      primaryBehavior: 'STATIC',
      primaryInteraction: 'INSPECT_CELL',
      spatialStrategy: {} as RepresentationDecision['embodiment']['spatialStrategy'],
    },
    provenance: {
      generatedAt: 1,
      engine: 'test',
      version: 'test',
      datasetFingerprint: 'fp-1',
      requirementsHash: JSON.stringify(requirements),
    },
    datasetSignature: {} as RepresentationDecision['datasetSignature'],
  };
}

function fixture() {
  const current = decision('points-basic', 0.8);
  const preview = decision('points-dense', 0.7);
  const action: RemedialAction = {
    id: 'switch-overview',
    label: 'Switch to overview',
    kind: 'switch-task',
    description: 'Use an overview task for this representation.',
    isSafeToRelax: true,
    deviceFeasibility: 'unverified',
    suggestedRequirementPatch: { task: 'overview' },
    unblocksCandidates: [],
  };
  const oldRequirements = createDefaultRequirements('individual-inspection');
  const newRequirements = { ...oldRequirements, task: 'overview' as const };
  const remediation = buildRemediationProvenance(
    action,
    oldRequirements,
    newRequirements,
    'fp-1',
    10,
  );

  let fencedPreview: RepresentationDecision | null = null;
  const applyRemediation = vi.fn();
  const commitRemediation = vi.fn(() => {
    fencedPreview = null;
  });
  const cancelRemediationPreview = vi.fn(() => {
    fencedPreview = null;
  });
  const previewRemediation = vi.fn(() => {
    fencedPreview = preview;
    return true;
  });

  const atlas = {
    activeRepresentationDecision: current,
    datasetFingerprint: 'fp-1',
    remediationEvents: () => [remediation],
  } as unknown as AtlasCore;
  const outcome: InvestigatorActionableOutcome = {
    state: 'INFEASIBLE',
    readableExplanation: 'One declared constraint prevents a candidate.',
    decision: null,
    nearMisses: [],
    blockingConstraints: [{
      rule: 'task-fit',
      candidateId: 'points-dense' as never,
      candidateName: 'Dense points',
      disqualificationReason: 'Task mismatch',
      isInformationLossConstraint: false,
      isHardwareConstraint: false,
      isPerceptualConstraint: false,
      remediationAction: action,
    }],
    availableRemediations: [action],
    provenance: current.provenance,
  };

  const service = new RepresentationReviewService({
    atlas,
    getOutcome: () => outcome,
    getFencedPreviewDecision: () => fencedPreview,
    previewRemediation,
    commitRemediation,
    cancelRemediationPreview,
    applyRemediation,
  });

  return {
    action,
    oldRequirements,
    service,
    previewRemediation,
    commitRemediation,
    cancelRemediationPreview,
    applyRemediation,
  };
}

describe('P1-UV C4 representation review', () => {
  it('reads constraints and previews through the existing fenced remediation owner', () => {
    const { action, service, previewRemediation } = fixture();

    const before = service.snapshot();
    expect(before.outcomeState).toBe('INFEASIBLE');
    expect(before.constraints[0]?.remediationId).toBe(action.id);
    expect(before.preview).toBeNull();

    const after = service.preview(action.id);
    expect(previewRemediation).toHaveBeenCalledOnce();
    expect(previewRemediation).toHaveBeenCalledWith(action);
    expect(after.preview?.candidateId).toBe('points-dense');
    expect(after.previewActionId).toBe(action.id);
  });

  it('accepts or rejects only the current remediation action', () => {
    const {
      action,
      service,
      commitRemediation,
      cancelRemediationPreview,
    } = fixture();

    service.preview(action.id);
    service.commit(action.id);
    expect(commitRemediation).toHaveBeenCalledWith(action);

    service.preview(action.id);
    service.rejectPreview();
    expect(cancelRemediationPreview).toHaveBeenCalledOnce();

    expect(() => service.preview('not-current')).toThrow(
      'Current representation state has no remediation not-current.',
    );
  });

  it('reverts by appending an inverse remediation patch that restores the verified prior requirements', () => {
    const { oldRequirements, service, applyRemediation } = fixture();

    expect(service.snapshot().canRevertLastChange).toBe(true);
    service.revertLastChange();

    expect(applyRemediation).toHaveBeenCalledOnce();
    const inverse = applyRemediation.mock.calls[0]?.[0] as RemedialAction;
    expect(inverse.id).toContain('revert:switch-overview:');
    expect(inverse.suggestedRequirementPatch).toEqual(oldRequirements);
    expect(inverse.kind).toBe('switch-task');
  });
});
