import type { RepresentationDecision } from '../moneta/representation/RepresentationDecision.ts';
import { captureMonetaPairwiseFeatureSnapshots, type CandidateGraphIdentityMap } from '../fitness/MonetaFeatureSnapshot.ts';
import { PairwiseFeatureSnapshotLedger } from '../fitness/PairwiseFeatureSnapshotLedger.ts';
import { AnalystJudgementController, type PairwisePreferenceInput } from '../judgement/AnalystJudgementController.ts';
import { JudgementLedger } from '../judgement/JudgementLedger.ts';
import type { PairwisePreferenceJudgement } from '../judgement/RepresentationJudgement.ts';

export interface PairwiseJudgementTransactionInput extends PairwisePreferenceInput {
  decision: RepresentationDecision;
  graphIdsByCandidate: CandidateGraphIdentityMap;
}

/**
 * Application-level atomic coordinator for researcher pairwise evidence.
 *
 * Candidate features are captured from the exact Moneta decision shown to the
 * researcher and committed together with the judgement. If either append fails,
 * both append-only ledgers are restored to their pre-transaction snapshots.
 */
export class JudgementFeatureTransaction {
  constructor(
    private readonly judgementController: AnalystJudgementController,
    private readonly judgementLedger: JudgementLedger,
    private readonly featureLedger: PairwiseFeatureSnapshotLedger,
  ) {}

  recordPairwise(input: PairwiseJudgementTransactionInput): PairwisePreferenceJudgement {
    const features = captureMonetaPairwiseFeatureSnapshots(input.decision, input.graphIdsByCandidate);
    const judgementBefore = this.judgementLedger.toJSON();
    const featuresBefore = this.featureLedger.toJSON();

    try {
      this.featureLedger.appendBatch(features);
      return this.judgementController.prefer({
        preferredGraphId: input.preferredGraphId,
        alternativeGraphId: input.alternativeGraphId,
        strength: input.strength,
        rationale: input.rationale,
      });
    } catch (error) {
      this.featureLedger.restore(featuresBefore);
      this.judgementLedger.restore(judgementBefore);
      throw error;
    }
  }
}
