import { canonicalSha256Hex } from '../../security/CryptoHash.js';
import type { SpatialPhenotype } from './FormaSpatialCompiler.js';

export const FORMA_HUMAN_FEEDBACK_SCHEMA_VERSION = 1 as const;

export type CritiqueStatus =
  | 'PROPOSED'
  | 'CONFIRMED'
  | 'INSTANTIATED'
  | 'REJECTED'
  | 'RETAINED';

export type TaskComprehensionOutcome =
  | 'ACCURATE'
  | 'MISUNDERSTOOD'
  | 'INCONCLUSIVE'
  | 'FAILED';

export type MappingPreference =
  | 'PREFERRED'
  | 'ACCEPTABLE'
  | 'DISLIKED'
  | 'REJECTED';

export interface FeedbackScopeV1 {
  readonly domain?: string;
  readonly task?: string;
  readonly population?: string;
}

export interface FeedbackAuthorV1 {
  readonly researcherId: string;
  readonly studyId?: string;
}

export interface EmbodimentCritiqueInputV1 {
  readonly planId: string;
  readonly sliceId: string;
  readonly contextId: string;
  readonly semanticNodeId: string;
  readonly critiqueText: string;
  readonly targetBindingId?: string;
  readonly proposedBinding?: string;
  readonly proposedAlternativePhenotype?: SpatialPhenotype;
  readonly scope?: FeedbackScopeV1;
  readonly author?: FeedbackAuthorV1;
  readonly status?: CritiqueStatus;
  readonly confirmed: boolean;
}

export interface EmbodimentCritiqueRecordV1 {
  readonly schemaVersion: typeof FORMA_HUMAN_FEEDBACK_SCHEMA_VERSION;
  readonly critiqueId: string;
  readonly planId: string;
  readonly sliceId: string;
  readonly contextId: string;
  readonly semanticNodeId: string;
  readonly critiqueText: string;
  readonly targetBindingId?: string;
  readonly proposedBinding?: string;
  readonly proposedAlternativePhenotype?: SpatialPhenotype;
  readonly scope: FeedbackScopeV1;
  readonly author: FeedbackAuthorV1;
  readonly status: CritiqueStatus;
  readonly confirmed: boolean;
  readonly timestamp: number;
}

export interface HumanMeaningJudgmentInputV1 {
  readonly representationId: string;
  readonly bindingId?: string;
  readonly targetPhenotype?: SpatialPhenotype;
  readonly versionIdentity: {
    readonly kernelVersion: string;
    readonly monetaVersion: string;
    readonly formaVersion?: string;
  };
  readonly intendedSemanticMeaning: string;
  readonly perceivedMeaning: string;
  readonly taskComprehensionOutcome: TaskComprehensionOutcome;
  readonly mappingPreference?: MappingPreference;
  readonly misleadingImplication?: string;
  readonly accessibilityComfortIssue?: string;
  readonly scope?: FeedbackScopeV1;
  readonly author: FeedbackAuthorV1;
  readonly confirmed: boolean;
}

export interface HumanMeaningJudgmentRecordV1 {
  readonly schemaVersion: typeof FORMA_HUMAN_FEEDBACK_SCHEMA_VERSION;
  readonly judgmentId: string;
  readonly representationId: string;
  readonly bindingId?: string;
  readonly targetPhenotype?: SpatialPhenotype;
  readonly versionIdentity: {
    readonly kernelVersion: string;
    readonly monetaVersion: string;
    readonly formaVersion?: string;
  };
  readonly intendedSemanticMeaning: string;
  readonly perceivedMeaning: string;
  readonly taskComprehensionOutcome: TaskComprehensionOutcome;
  readonly mappingPreference?: MappingPreference;
  readonly misleadingImplication?: string;
  readonly accessibilityComfortIssue?: string;
  readonly scope: FeedbackScopeV1;
  readonly author: FeedbackAuthorV1;
  readonly confirmed: boolean;
  readonly timestamp: number;
}

export class SelfLabelingForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SelfLabelingForbiddenError';
  }
}

/**
 * Anti-self-labeling guard: ensures automated actions, UI clicks, or passive
 * recommendation views are never recorded as human meaning judgments or critiques.
 */
export function assertNotSelfLabeled(event: {
  automated?: boolean;
  passiveClick?: boolean;
  systemDefault?: boolean;
  source?: string;
}): void {
  if (event.automated === true) {
    throw new SelfLabelingForbiddenError(
      'Automated events cannot generate human feedback or meaning judgments'
    );
  }
  if (event.passiveClick === true) {
    throw new SelfLabelingForbiddenError(
      'Passive UI clicks or recommendation adoptions cannot be recorded as human meaning judgments'
    );
  }
  if (event.systemDefault === true) {
    throw new SelfLabelingForbiddenError(
      'System default selection is not an attributable human critique'
    );
  }
  if (event.source && ['SYSTEM', 'RECOMMENDER', 'AUTOPILOT'].includes(event.source.toUpperCase())) {
    throw new SelfLabelingForbiddenError(
      `Source "${event.source}" is an automated source and cannot supply human testimony`
    );
  }
}

/**
 * Records an attributable, confirmed human critique without mutating production priors.
 */
export function recordEmbodimentCritique(
  input: EmbodimentCritiqueInputV1,
): EmbodimentCritiqueRecordV1 {
  if (!input.planId || !input.sliceId) {
    throw new Error('EmbodimentCritique requires valid planId and sliceId');
  }
  if (!input.critiqueText || input.critiqueText.trim().length === 0) {
    throw new Error('EmbodimentCritique requires non-empty critiqueText');
  }

  const timestamp = Date.now();
  const author: FeedbackAuthorV1 = input.author ?? {
    researcherId: 'researcher-unspecified',
  };
  const scope: FeedbackScopeV1 = input.scope ?? {};
  const status: CritiqueStatus = input.status ?? (input.confirmed ? 'CONFIRMED' : 'PROPOSED');

  const critiqueId = `critique-v1:${canonicalSha256Hex({
    planId: input.planId,
    sliceId: input.sliceId,
    contextId: input.contextId,
    semanticNodeId: input.semanticNodeId,
    critiqueText: input.critiqueText.trim(),
    targetBindingId: input.targetBindingId ?? null,
    proposedBinding: input.proposedBinding ?? null,
    author: author.researcherId,
  })}`;

  return {
    schemaVersion: FORMA_HUMAN_FEEDBACK_SCHEMA_VERSION,
    critiqueId,
    planId: input.planId,
    sliceId: input.sliceId,
    contextId: input.contextId,
    semanticNodeId: input.semanticNodeId,
    critiqueText: input.critiqueText.trim(),
    targetBindingId: input.targetBindingId,
    proposedBinding: input.proposedBinding,
    proposedAlternativePhenotype: input.proposedAlternativePhenotype,
    scope,
    author,
    status,
    confirmed: input.confirmed,
    timestamp,
  };
}

/**
 * Records an attributable, confirmed human meaning judgment distinguishing perceived
 * meaning from preference and task comprehension.
 */
export function recordHumanMeaningJudgment(
  input: HumanMeaningJudgmentInputV1,
): HumanMeaningJudgmentRecordV1 {
  if (!input.representationId || input.representationId.trim().length === 0) {
    throw new Error('HumanMeaningJudgment requires non-empty representationId');
  }
  if (!input.author?.researcherId || input.author.researcherId.trim().length === 0) {
    throw new Error('HumanMeaningJudgment requires an attributable researcherId');
  }
  if (!input.intendedSemanticMeaning || !input.perceivedMeaning) {
    throw new Error('HumanMeaningJudgment requires both intended and perceived meaning');
  }

  const timestamp = Date.now();
  const judgmentId = `meaning-v1:${canonicalSha256Hex({
    representationId: input.representationId,
    bindingId: input.bindingId ?? null,
    intended: input.intendedSemanticMeaning.trim(),
    perceived: input.perceivedMeaning.trim(),
    outcome: input.taskComprehensionOutcome,
    researcherId: input.author.researcherId,
    versionIdentity: input.versionIdentity,
  })}`;

  return {
    schemaVersion: FORMA_HUMAN_FEEDBACK_SCHEMA_VERSION,
    judgmentId,
    representationId: input.representationId,
    bindingId: input.bindingId,
    targetPhenotype: input.targetPhenotype,
    versionIdentity: input.versionIdentity,
    intendedSemanticMeaning: input.intendedSemanticMeaning.trim(),
    perceivedMeaning: input.perceivedMeaning.trim(),
    taskComprehensionOutcome: input.taskComprehensionOutcome,
    mappingPreference: input.mappingPreference,
    misleadingImplication: input.misleadingImplication,
    accessibilityComfortIssue: input.accessibilityComfortIssue,
    scope: input.scope ?? {},
    author: input.author,
    confirmed: input.confirmed,
    timestamp,
  };
}
