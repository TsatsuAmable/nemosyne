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
import {
  classifyHardConstraint,
  type HardConstraintCode,
  type HardConstraintCategory,
} from './HardConstraintCode.ts';
import { fnv1aHex } from '../../atlas/DatasetSpace.ts';
import { canonicalJsonStringify } from '../../investigation/InvestigationDigest.ts';

/**
 * Canonical hash of a requirements object. Matches the hash the engine records
 * as `DecisionProvenance.requirementsHash`, so remediation provenance can be
 * correlated with the decision that prompted it.
 */
export function hashRequirements(requirements: RepresentationRequirements): string {
  return fnv1aHex(canonicalJsonStringify(requirements));
}

export type InvestigatorOutcomeState = RepresentationDecisionStatus;

export type RemediationKind =
  | 'adjust-hardware-limit'
  | 'adjust-frustum-exclusion-tolerance'
  | 'switch-task'
  | 'aggregate-data'
  | 'supply-temporal-order'
  | 'accept-ambiguous-alternative';

/**
 * RF-027: separates *scientific permissibility* (may this constraint be
 * relaxed without falsifying the science?) from *measured device/runtime
 * feasibility* (can the target device actually render the relaxed bound?).
 *
 * `isSafeToRelax` reports scientific permissibility only. Hardware / frustum
 * exclusion bounds are scientifically safe to relax but their relaxed value
 * is NOT verified against any real device, so `deviceFeasibility` is
 * `'unverified'` until a qualification run proves otherwise. The remediation
 * copy must not claim the doubled bound is device-safe.
 */
export type DeviceFeasibility = 'unverified' | 'feasible' | 'infeasible';

export interface RemedialAction {
  id: string;
  label: string;
  kind: RemediationKind;
  description: string;
  /** Scientific permissibility only: true for preference/hardware bounds; false for critical information-preservation requirements. */
  isSafeToRelax: boolean;
  /** RF-027: measured device/runtime feasibility of the relaxed bound. `'unverified'` until a qualification run proves it. */
  deviceFeasibility: DeviceFeasibility;
  suggestedRequirementPatch: Partial<RepresentationRequirements>;
  unblocksCandidates: SemanticRepresentationId[];
  /** RF-027: the typed hard-constraint code this remediation addresses. */
  constraintCode?: HardConstraintCode;
}

/**
 * RF-027: durable, replayable provenance for a remediation action. Records
 * the full remediation → old requirements → new requirements → resulting
 * decision chain so an analyst can replay why a requirement changed.
 */
export interface RemediationProvenance {
  remediationId: string;
  kind: RemediationKind;
  constraintCode?: HardConstraintCode;
  category: HardConstraintCategory;
  scientificPermissibility: 'permissible' | 'impermissible';
  deviceFeasibility: DeviceFeasibility;
  datasetFingerprint: string;
  /** Canonical hash of requirements before the patch was applied. */
  oldRequirementsHash: string;
  /** Canonical hash of requirements after the patch was applied. */
  newRequirementsHash: string;
  /** The requirement patch that was applied, for replay reconstruction. */
  requirementPatch: Partial<RepresentationRequirements>;
  /** Decision id produced by re-arbitration under the new requirements, once known. */
  resultingDecisionId?: string;
  timestamp: number;
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
        deviceFeasibility: 'unverified',
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

    // RF-027: route remediation by the typed machine-readable constraint code,
    // NOT by substring-matching the human-readable disqualification reason.
    const code = candidate.disqualificationCode;
    const category = classifyHardConstraint(code);
    const isHardware = category === 'hardware';
    const isPerceptual = category === 'perceptual';
    const isInfoLoss = category === 'scientific-info-loss';

    let remediation: RemedialAction | null = null;

    if (isHardware) {
      const maxEl = requirements.hardwareConstraints?.maxElements ?? 10_000;
      const remId = 'relax_hardware_elements';
      if (!remediationMap.has(remId)) {
        remediation = {
          id: remId,
          label: 'Increase hardware element budget',
          kind: 'adjust-hardware-limit',
          description: `Raise maxElements from ${maxEl.toLocaleString()} to ${(maxEl * 2).toLocaleString()} to permit denser representations. Scientifically permissible (not an information-preservation constraint), but device feasibility is UNVERIFIED — a target-device qualification run is required before relying on the larger bound.`,
          isSafeToRelax: true,
          deviceFeasibility: 'unverified',
          constraintCode: code,
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
      const occTol = requirements.maxFrustumExclusionTolerance ?? 0.2;
      const remId = 'relax_frustum_exclusion_tolerance';
      if (!remediationMap.has(remId)) {
        remediation = {
          id: remId,
          label: 'Relax frustum exclusion tolerance threshold',
          kind: 'adjust-frustum-exclusion-tolerance',
          description: `Increase maxFrustumExclusionTolerance from ${(occTol * 100).toFixed(0)}% to ${Math.min(100, (occTol + 0.2) * 100).toFixed(0)}% for 3D exploratory layout. The hard gate bounds view-frustum/depth-range exclusion, NOT occlusion. Scientifically permissible, but device feasibility is UNVERIFIED until a qualification run confirms legibility on the target headset.`,
          isSafeToRelax: true,
          deviceFeasibility: 'unverified',
          constraintCode: code,
          suggestedRequirementPatch: {
            maxFrustumExclusionTolerance: Math.min(1.0, occTol + 0.2),
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
        deviceFeasibility: 'unverified',
        constraintCode: code,
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

/**
 * RF-027: build a durable, replayable provenance record for an applied
 * remediation. Captures remediation → old requirements → new requirements →
 * (optional) resulting decision, with scientific permissibility and device
 * feasibility separated. Callers persist this via the EvidenceLedger
 * `remediation` event so the chain survives `.nemosyne` export/import replay.
 */
export function buildRemediationProvenance(
  remediation: RemedialAction,
  oldRequirements: RepresentationRequirements,
  newRequirements: RepresentationRequirements,
  datasetFingerprint: string,
  timestamp: number,
  resultingDecisionId?: string
): RemediationProvenance {
  return {
    remediationId: remediation.id,
    kind: remediation.kind,
    constraintCode: remediation.constraintCode,
    category: classifyHardConstraint(remediation.constraintCode),
    scientificPermissibility: remediation.isSafeToRelax ? 'permissible' : 'impermissible',
    deviceFeasibility: remediation.deviceFeasibility,
    datasetFingerprint,
    oldRequirementsHash: hashRequirements(oldRequirements),
    newRequirementsHash: hashRequirements(newRequirements),
    requirementPatch: remediation.suggestedRequirementPatch,
    resultingDecisionId,
    timestamp,
  };
}
