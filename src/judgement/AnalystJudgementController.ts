import {
  type AbsoluteRatingJudgement,
  type AlternativeRejectionJudgement,
  type DiscoveryOutcomeLinkJudgement,
  type JudgementOutcome,
  type JudgementProvenance,
  type JudgementRatingDimension,
  type PairwisePreferenceJudgement,
  REPRESENTATION_JUDGEMENT_SCHEMA_VERSION,
  type RepresentationJudgement,
  type WeightAdjustmentJudgement,
} from './RepresentationJudgement.ts';
import { JudgementLedger } from './JudgementLedger.ts';

export interface AnalystJudgementContext {
  investigationId: string;
  researcherId: string;
  provenance: JudgementProvenance;
}

export interface AnalystJudgementControllerOptions {
  context: () => AnalystJudgementContext;
  now?: () => number;
  nextId?: () => string;
}

export interface PairwisePreferenceInput {
  preferredGraphId: string;
  alternativeGraphId: string;
  strength?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  rationale?: string;
}

export interface AbsoluteRatingInput {
  graphId: string;
  dimension: JudgementRatingDimension;
  rating: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  rationale?: string;
}

export interface WeightAdjustmentInput {
  dimension: string;
  previousWeight: number;
  proposedWeight: number;
  applied: boolean;
  rationale?: string;
}

export interface AlternativeRejectionInput {
  rejectedGraphId: string;
  reasonCodes: readonly string[];
  rationale?: string;
}

export interface DiscoveryOutcomeInput {
  discoveryId: string;
  graphId: string;
  outcome: JudgementOutcome;
  rationale?: string;
}

/**
 * Application-layer capture boundary for Analyst Cockpit refinement actions.
 *
 * UI surfaces call this controller; they never mutate Moneta weights or model
 * state directly. Every action becomes an append-only RepresentationJudgement.
 * The controller deliberately has no renderer or learning dependency so desktop
 * and VR cockpit surfaces can share identical research semantics.
 */
export class AnalystJudgementController {
  private readonly now: () => number;
  private readonly nextId: () => string;
  private generatedId = 0;

  constructor(
    private readonly ledger: JudgementLedger,
    private readonly options: AnalystJudgementControllerOptions,
  ) {
    this.now = options.now ?? (() => Date.now());
    this.nextId = options.nextId ?? (() => `judgement-${this.generatedId++}`);
  }

  prefer(input: PairwisePreferenceInput): PairwisePreferenceJudgement {
    return this.append({
      ...this.base('PAIRWISE_PREFERENCE', input.rationale),
      kind: 'PAIRWISE_PREFERENCE',
      preferredGraphId: input.preferredGraphId,
      alternativeGraphId: input.alternativeGraphId,
      strength: input.strength,
    });
  }

  rate(input: AbsoluteRatingInput): AbsoluteRatingJudgement {
    return this.append({
      ...this.base('ABSOLUTE_RATING', input.rationale),
      kind: 'ABSOLUTE_RATING',
      graphId: input.graphId,
      dimension: input.dimension,
      rating: input.rating,
    });
  }

  adjustWeight(input: WeightAdjustmentInput): WeightAdjustmentJudgement {
    return this.append({
      ...this.base('WEIGHT_ADJUSTMENT', input.rationale),
      kind: 'WEIGHT_ADJUSTMENT',
      dimension: input.dimension,
      previousWeight: input.previousWeight,
      proposedWeight: input.proposedWeight,
      applied: input.applied,
    });
  }

  reject(input: AlternativeRejectionInput): AlternativeRejectionJudgement {
    return this.append({
      ...this.base('ALTERNATIVE_REJECTION', input.rationale),
      kind: 'ALTERNATIVE_REJECTION',
      rejectedGraphId: input.rejectedGraphId,
      reasonCodes: [...input.reasonCodes],
    });
  }

  linkDiscoveryOutcome(input: DiscoveryOutcomeInput): DiscoveryOutcomeLinkJudgement {
    const judgement = {
      ...this.base('DISCOVERY_OUTCOME_LINK', input.rationale),
      kind: 'DISCOVERY_OUTCOME_LINK' as const,
      discoveryId: input.discoveryId,
      graphId: input.graphId,
      outcome: input.outcome,
    };
    judgement.provenance.discoveryId = input.discoveryId;
    return this.append(judgement);
  }

  private base(kind: RepresentationJudgement['kind'], rationale?: string) {
    const context = this.options.context();
    const investigationId = context.investigationId.trim();
    const researcherId = context.researcherId.trim();
    if (!investigationId || !researcherId) {
      throw new Error('Analyst judgement context requires investigationId and researcherId');
    }
    return {
      schemaVersion: REPRESENTATION_JUDGEMENT_SCHEMA_VERSION,
      judgementId: this.nextId(),
      investigationId,
      researcherId,
      sequence: this.ledger.expectedSequence(investigationId),
      recordedAt: this.now(),
      kind,
      provenance: structuredClone(context.provenance),
      rationale,
    };
  }

  private append<T extends RepresentationJudgement>(judgement: T): T {
    this.ledger.append(judgement);
    return structuredClone(judgement);
  }
}
