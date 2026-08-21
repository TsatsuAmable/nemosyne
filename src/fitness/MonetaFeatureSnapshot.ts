import type { PairwiseCandidateFeatureSnapshot } from './PairwiseLearning.ts';
import { PAIRWISE_FEATURE_SCHEMA_VERSION, PAIRWISE_FEATURE_SNAPSHOT_SCHEMA_VERSION } from './PairwiseLearning.ts';
import type { RepresentationDecision, CandidateScore } from '../moneta/representation/RepresentationDecision.ts';
import type { SemanticRepresentationId } from '../moneta/representation/RepresentationCandidate.ts';

export const MONETA_PAIRWISE_FEATURE_DIMENSIONS = [
  'structure',
  'task',
  'scale',
  'informationPreservation',
  'densityHandling',
  'configuredPrior',
] as const;

export type MonetaPairwiseFeatureDimension = (typeof MONETA_PAIRWISE_FEATURE_DIMENSIONS)[number];

export interface CandidateGraphIdentityMap {
  readonly [candidateId: string]: string | undefined;
}

function snapshotForCandidate(
  decision: RepresentationDecision,
  candidate: CandidateScore,
  graphId: string,
): PairwiseCandidateFeatureSnapshot {
  const componentByName = new Map(candidate.components.map((component) => [component.component, component]));
  const features = MONETA_PAIRWISE_FEATURE_DIMENSIONS.map((dimension) => {
    const component = componentByName.get(dimension);
    if (!component) throw new Error(`Candidate ${candidate.candidateId} is missing fitness component: ${dimension}`);
    if (!Number.isFinite(component.rawScore)) throw new TypeError(`Candidate ${candidate.candidateId} has non-finite ${dimension} score`);
    return component.rawScore;
  });

  const datasetFingerprint = decision.provenance.datasetFingerprint;
  const fitnessModelVersion = decision.fitnessModelVersion ?? decision.provenance.fitnessModelVersion;
  if (!datasetFingerprint?.trim()) throw new Error('RepresentationDecision is missing dataset fingerprint provenance');
  if (!fitnessModelVersion?.trim()) throw new Error('RepresentationDecision is missing FitnessModel version provenance');
  if (!graphId.trim()) throw new Error(`Candidate ${candidate.candidateId} is missing a graph identity`);

  return {
    schemaVersion: PAIRWISE_FEATURE_SNAPSHOT_SCHEMA_VERSION,
    featureSchemaVersion: PAIRWISE_FEATURE_SCHEMA_VERSION,
    graphId,
    datasetFingerprint,
    fitnessModelVersion,
    features,
    bootstrapUtility: candidate.score,
  };
}

/**
 * Materializes frozen learning features for every non-disqualified candidate
 * that the application can identify with a concrete RepresentationGraph ID.
 *
 * Raw fitness-dimension scores are captured instead of weighted scores so
 * later learners do not inherit bootstrap weights as baked-in features.
 */
export function captureMonetaPairwiseFeatureSnapshots(
  decision: RepresentationDecision,
  graphIdsByCandidate: CandidateGraphIdentityMap,
): readonly PairwiseCandidateFeatureSnapshot[] {
  const ranked = decision.rankedCandidates ?? [];
  if (ranked.length === 0) throw new Error('RepresentationDecision has no ranked candidates to snapshot');

  const snapshots: PairwiseCandidateFeatureSnapshot[] = [];
  for (const candidate of ranked) {
    if (candidate.disqualified) continue;
    const graphId = graphIdsByCandidate[candidate.candidateId as SemanticRepresentationId];
    if (!graphId) {
      throw new Error(`Missing RepresentationGraph identity for candidate ${candidate.candidateId}`);
    }
    snapshots.push(snapshotForCandidate(decision, candidate, graphId));
  }
  if (snapshots.length < 2) {
    throw new Error('Pairwise judgement requires at least two feasible candidate snapshots');
  }
  return snapshots;
}
