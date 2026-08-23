import {
  assertDatasetEvidence,
  type DatasetEvidence,
} from '../../data/evidence/DatasetEvidence.ts';
import type { AnalyticalIntent, RepresentationRequirements } from './RepresentationRequirements.ts';
import type { RepresentationDecision } from './RepresentationDecision.ts';
import type { DatasetSignature } from './DatasetSignature.ts';
import {
  assertDecisionRelevantSignatureMatchesEvidence,
  datasetEvidenceToSignature,
} from './DatasetEvidenceSignature.ts';
import { MonetaHypothesisEngine } from './MonetaHypothesisEngine.ts';
import { BOOTSTRAP_FITNESS_MODEL_VERSION } from './FitnessModel.ts';
import { NoFeasibleRepresentationError } from './NoFeasibleRepresentationError.ts';
import {
  DEFAULT_MONETA_COMPUTE_BUDGET,
  assertMonetaWithinComputeBudget,
  resolveMonetaComputeBudget,
  type MonetaComputeBudget,
} from './ScalabilityContract.ts';

export interface EvidenceBoundRepresentationDecision {
  decision: RepresentationDecision;
  evidenceIds: readonly string[];
  datasetFingerprint: string;
  kernelVersion: string;
}

/**
 * Verify that a compatibility/caller signature agrees with the canonical
 * evidence-derived signature on every field that can affect the current
 * representation decision. The caller signature is not the analytical source
 * of truth.
 */
export function assertEvidenceBacksSignature(
  evidence: DatasetEvidence,
  signature: DatasetSignature,
): readonly string[] {
  assertDatasetEvidence(evidence);
  const authoritative = datasetEvidenceToSignature(evidence);
  assertDecisionRelevantSignatureMatchesEvidence(signature, authoritative);
  return evidence.evidence.map((item) => item.id);
}

export class EvidenceBackedMoneta {
  private readonly computeBudget: Readonly<MonetaComputeBudget>;

  constructor(
    private readonly engine = new MonetaHypothesisEngine(),
    computeBudget: Partial<MonetaComputeBudget> = DEFAULT_MONETA_COMPUTE_BUDGET,
  ) {
    this.computeBudget = resolveMonetaComputeBudget(computeBudget);
  }

  arbitrate(
    evidence: DatasetEvidence,
    signature: DatasetSignature,
    requirements?: RepresentationRequirements,
    intent?: AnalyticalIntent,
  ): EvidenceBoundRepresentationDecision {
    const evidenceIds = assertEvidenceBacksSignature(evidence, signature);

    // The FitnessModel always consumes the signature reconstructed from the
    // provenance-bearing Rust evidence. Caller-provided analytical values are
    // used only as a mismatch detector. Non-analytical configured family
    // preferences may be preserved until that prior moves fully into the
    // requirements/configuration contract.
    const authoritativeSignature = datasetEvidenceToSignature(evidence);
    if (signature.preferredFamilies) {
      authoritativeSignature.preferredFamilies = [...signature.preferredFamilies];
    }

    let decision: RepresentationDecision;
    try {
      decision = this.engine.arbitrate(authoritativeSignature, requirements, intent);
    } catch (error) {
      if (error instanceof NoFeasibleRepresentationError) {
        throw error.withProvenance({
          datasetFingerprint: evidence.datasetFingerprint,
          kernelVersion: evidence.kernelVersion,
          evidenceIds,
          requirements: requirements ? structuredClone(requirements) : undefined,
          intent: intent ? structuredClone(intent) : undefined,
          fitnessModelVersion: BOOTSTRAP_FITNESS_MODEL_VERSION,
          fitnessModelArtifactHash: null,
        });
      }
      throw error;
    }

    assertMonetaWithinComputeBudget(
      {
        candidateCount: decision.rankedCandidates?.length ?? 0,
        sensitivityScenarioCount: decision.weightSensitivity?.scenarioCount ?? 0,
      },
      this.computeBudget,
    );

    return {
      decision,
      evidenceIds,
      datasetFingerprint: evidence.datasetFingerprint,
      kernelVersion: evidence.kernelVersion,
    };
  }
}
