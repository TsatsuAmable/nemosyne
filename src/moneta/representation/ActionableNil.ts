/**
 * Moneta Actionable NIL, Ambiguity and Uncertainty Framework (P1-E)
 *
 * Transforms arbitration failures and ambiguous decisions into actionable,
 * evidence-supported investigator dialogues with structured remediation options.
 */

import type { DatasetSignature } from './DatasetSignature.ts';
import type {
  RepresentationRequirements,
} from './RepresentationRequirements.ts';
import type {
  CandidateScore,
  DecisionProvenance,
  RepresentationDecision,
} from './RepresentationDecision.ts';
import type {
  SemanticRepresentationId,
} from './RepresentationCandidate.ts';
import { MONETA_REPRESENTATION_CANDIDATES } from './RepresentationCandidate.ts';
import type {
  NoFeasibleRepresentationError,
  NoFeasibleRepresentationProvenance,
} from './NoFeasibleRepresentationError.ts';
import type { RepresentationDecisionStatus } from './DecisionPolicy.ts';

export type InvestigatorOutcomeState = RepresentationDecisionStatus;

export type RemediationKind =
  | 'adjust-hardware-limit'
  | 'adjust-occlusion-tolerance'
  | 'switch-task'
  | 'aggregate-data'
  | 'supply-temporal-order'
  | 'accept-ambiguous-alternative';

export interface RemedialAction {
  id: string;
  label: string;
  kind: RemediationKind;
  description: string;
  /** True for user preference/hardware bounds; false for critical scientific information-preservation requirements. */
  isSafeToRelax: boolean;
  suggestedRequirementPatch: Partial<RepresentationRequirements>;
  unblocksCandidates: SemanticRepresentationId[];
}

export interface BlockingConstraint {
  rule: string;
  candidateId: SemanticRepresentationId;
  candidateName: string;
  disqualificationReason: string;
  isInformationLossConstraint: boolean;
  isHardwareConstraint: boolean;
  isPerceptualConstraint: boolean;
  remediationAction: RemedialAction | null;
}

export interface InvestigatorActionableOutcome {
  state: InvestigatorOutcomeState;
  readableExplanation: string;
  decision: RepresentationDecision | null;
  nearMisses: CandidateScore[];
  blockingConstraints: BlockingConstraint[];
  availableRemediations: RemedialAction[];
  provenance: DecisionProvenance | NoFeasibleRepresentationProvenance;
}

/**
 * Diagnoses an arbitration result or error into an actionable investigator outcome.
 */
export function diagnoseInvestigatorOutcome(
  signature: DatasetSignature,
  requirements: RepresentationRequirements,
  decisionOrError: RepresentationDecision | NoFeasibleRepresentationError
): InvestigatorActionableOutcome {
  if ('chosenCandidateId' in decisionOrError) {
    const decision = decisionOrError;
    const nearMisses = (decision.rankedCandidates ?? [])
      .filter((c) => c.candidateId !== decision.chosenCandidateId && !c.disqualified)
      .slice(0, 3);

    const availableRemediations: RemedialAction[] = [];
    if (decision.decisionStatus === 'AMBIGUOUS' && decision.runnerUp) {
      const runnerUpDef = MONETA_REPRESENTATION_CANDIDATES[decision.runnerUp.candidateId];
      availableRemediations.push({
        id: `switch_to_${decision.runnerUp.candidateId}`,
        label: `Select alternative: ${runnerUpDef?.name ?? decision.runnerUp.candidateId}`,
        kind: 'accept-ambiguous-alternative',
        description: `Explicitly select the close alternative (${decision.runnerUp.layout}) with utility margin ${decision.decisionMargin?.toFixed(3) ?? '0.000'}.`,
        isSafeToRelax: true,
        suggestedRequirementPatch: {},
        unblocksCandidates: [decision.runnerUp.candidateId],
      });
    }

    let readableExplanation = decision.explanation ?? '';
    if (decision.decisionStatus === 'UNDERDETERMINED') {
      readableExplanation =
        `Underdetermined: ${decision.decisionRationale ?? 'Top candidates are closely tied or below decisive utility threshold.'} ` +
        `Consider refining task intent or applying structural focus.`;
    } else if (decision.decisionStatus === 'AMBIGUOUS') {
      readableExplanation =
        `Ambiguous: ${decision.decisionRationale ?? 'Multiple feasible representations are within competitive margin.'} ` +
        `Investigator may select either candidate safely.`;
    }

    return {
      state: decision.decisionStatus ?? 'DECISIVE',
      readableExplanation,
      decision,
      nearMisses,
      blockingConstraints: [],
      availableRemediations,
      provenance: decision.provenance,
    };
  }

  // Error case: INFEASIBLE
  const error = decisionOrError as NoFeasibleRepresentationError;
  const blockingConstraints: BlockingConstraint[] = [];
  const remediationMap = new Map<string, RemedialAction>();

  for (const candidate of error.nearMisses) {
    if (!candidate.disqualified) continue;
    const reason = candidate.disqualificationReason ?? 'Unknown hard constraint disqualification';
    const candidateDef = MONETA_REPRESENTATION_CANDIDATES[candidate.candidateId as SemanticRepresentationId];
    const candidateName = candidateDef?.name ?? candidate.candidateId;

    const isHardware =
      reason.includes('hardware allows at most') ||
      reason.includes('hardware limit') ||
      reason.includes('element budget');
    const isPerceptual =
      reason.includes('occlusion tolerance') ||
      reason.includes('perceptual');
    const isInfoLoss =
      reason.includes('loses critical information') ||
      reason.includes('loss is not acceptable') ||
      reason.includes('Must preserve') ||
      reason.includes('Must not lose') ||
      reason.includes('information-preservation');

    let remediation: RemedialAction | null = null;

    if (isHardware) {
      const maxEl = requirements.hardwareConstraints?.maxElements ?? 10_000;
      const remId = 'relax_hardware_elements';
      if (!remediationMap.has(remId)) {
        remediation = {
          id: remId,
          label: 'Increase hardware element budget',
          kind: 'adjust-hardware-limit',
          description: `Raise maxElements from ${maxEl.toLocaleString()} to ${(maxEl * 2).toLocaleString()} to permit denser representations.`,
          isSafeToRelax: true,
          suggestedRequirementPatch: {
            hardwareConstraints: {
              ...requirements.hardwareConstraints,
              maxElements: maxEl * 2,
            },
          },
          unblocksCandidates: [candidate.candidateId],
        };
        remediationMap.set(remId, remediation);
      } else {
        remediation = remediationMap.get(remId)!;
        if (!remediation.unblocksCandidates.includes(candidate.candidateId)) {
          remediation.unblocksCandidates.push(candidate.candidateId);
        }
      }
    } else if (isPerceptual) {
      const occTol = requirements.maxOcclusionTolerance ?? 0.2;
      const remId = 'relax_occlusion_tolerance';
      if (!remediationMap.has(remId)) {
        remediation = {
          id: remId,
          label: 'Relax occlusion tolerance threshold',
          kind: 'adjust-occlusion-tolerance',
          description: `Increase maxOcclusionTolerance from ${(occTol * 100).toFixed(0)}% to ${Math.min(100, (occTol + 0.2) * 100).toFixed(0)}% for 3D exploratory layout.`,
          isSafeToRelax: true,
          suggestedRequirementPatch: {
            maxOcclusionTolerance: Math.min(1.0, occTol + 0.2),
          },
          unblocksCandidates: [candidate.candidateId],
        };
        remediationMap.set(remId, remediation);
      } else {
        remediation = remediationMap.get(remId)!;
        if (!remediation.unblocksCandidates.includes(candidate.candidateId)) {
          remediation.unblocksCandidates.push(candidate.candidateId);
        }
      }
    } else if (isInfoLoss) {
      const remId = `info_loss_${candidate.candidateId}`;
      remediation = {
        id: remId,
        label: `Acknowledge information loss for ${candidateName}`,
        kind: 'switch-task',
        description: `Candidate loses critical dimensions required by current task intent. To proceed, change task focus or use multi-representation view.`,
        isSafeToRelax: false,
        suggestedRequirementPatch: {},
        unblocksCandidates: [candidate.candidateId],
      };
      remediationMap.set(remId, remediation);
    }

    blockingConstraints.push({
      rule: candidate.disqualificationReason?.split(':')[0] ?? 'HARD_CONSTRAINT',
      candidateId: candidate.candidateId,
      candidateName,
      disqualificationReason: reason,
      isInformationLossConstraint: isInfoLoss,
      isHardwareConstraint: isHardware,
      isPerceptualConstraint: isPerceptual,
      remediationAction: remediation,
    });
  }

  const nearMisses = (error.nearMisses ?? [])
    .slice()
    .sort((a: CandidateScore, b: CandidateScore) => b.score - a.score)
    .slice(0, 3);

  const readableExplanation =
    `Infeasible: No representation satisfies the declared hard constraints. ` +
    `${blockingConstraints.length} constraint(s) blocked candidates. ` +
    `${remediationMap.size} potential remediation action(s) available.`;

  const fallbackProvenance: NoFeasibleRepresentationProvenance = (error.provenance as NoFeasibleRepresentationProvenance) ?? {
    datasetFingerprint: signature.provenance.datasetFingerprint,
    kernelVersion: signature.provenance.kernelVersion,
    evidenceIds: [],
    requirements,
  };

  return {
    state: 'INFEASIBLE',
    readableExplanation,
    decision: null,
    nearMisses,
    blockingConstraints,
    availableRemediations: Array.from(remediationMap.values()),
    provenance: fallbackProvenance,
  };
}

/**
 * Applies an investigator remediation action to produce updated requirements.
 * Rejects silent relaxation of critical information-preservation constraints.
 */
export function applyRemediation(
  requirements: RepresentationRequirements,
  remediation: RemedialAction
): RepresentationRequirements {
  if (!remediation.isSafeToRelax && Object.keys(remediation.suggestedRequirementPatch).length === 0) {
    throw new Error(
      `Cannot automatically relax critical scientific constraint '${remediation.id}'. ` +
      `User must explicitly modify task requirements.`
    );
  }

  return {
    ...requirements,
    ...remediation.suggestedRequirementPatch,
  };
}
