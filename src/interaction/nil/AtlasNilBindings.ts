import type { Annotation, Finding, Observation } from '../../atlas/types.ts';
import type {
  AlternativeCandidate,
  DecisionEmbodiment,
  RepresentationDecision,
} from '../../moneta/representation/RepresentationDecision.ts';
import type { InvestigationNode } from '../../atlas/domain/InvestigationGraph.ts';
import type {
  EmbodimentCritiqueInputV1,
  EmbodimentCritiqueRecordV1,
} from '../../moneta/forma/FormaHumanFeedback.ts';
import type { CommittedInvestigationContextV2 } from '../../atlas/domain/CommittedInvestigationContext.ts';
import type { NilCommand, NilParameterValue } from './NemosyneInteractionLanguage.ts';
import { NilExecutor } from './NilExecutor.ts';

export interface AtlasNilTarget {
  recordObservation(
    observation:
      | string
      | (Omit<Observation, 'id' | 'timestamp' | 'datasetFingerprint' | 'datasetVersion'> & {
          datasetFingerprint?: string;
          datasetVersion?: number;
        }),
  ): Observation;
  recordAnnotation(annotation: Omit<Annotation, 'id' | 'timestamp'>): Annotation;
  recordFinding(
    finding: Omit<Finding, 'id' | 'timestamp' | 'datasetFingerprint' | 'datasetVersion'> & {
      datasetFingerprint?: string;
      datasetVersion?: number;
    },
  ): Finding;

  // FM1 & FM2 alternative & context capabilities
  arbitrateRepresentation?(): RepresentationDecision;
  getRepresentationAlternatives?(): readonly AlternativeCandidate[];
  previewAlternative?(candidateId: string): {
    embodiment: DecisionEmbodiment;
    candidate: AlternativeCandidate;
  };
  compareAlternative?(candidateId: string): {
    current: RepresentationDecision;
    alternative: AlternativeCandidate;
    sharedAnchors: readonly string[];
  };
  branchToAlternative?(candidateId: string, intentOverride?: unknown): InvestigationNode;
  explainDecision?(preference?: string): string;
  recordEmbodimentCritique?(input: EmbodimentCritiqueInputV1): EmbodimentCritiqueRecordV1;
  commitInvestigationContext?(nodeId: string, context: unknown): unknown;
  getActiveInvestigationContext?(): CommittedInvestigationContextV2 | undefined;
  getActiveNodeId?(): string | null | undefined;
  toState?(): { investigationGraph?: { activeNodeId?: string | null } };
}

export interface AtlasNilBindingOptions {
  /** Register Atlas-owned QUESTION/HYPOTHESISE handlers. Disable when a composition root delegates those verbs to another authoritative domain service. */
  bindIntentCommands?: boolean;
  /** Validate cross-domain constraints before Atlas mutates finding state. */
  beforeRecordFinding?: (
    command: NilCommand,
    finding: Omit<Finding, 'id' | 'timestamp' | 'datasetFingerprint' | 'datasetVersion'>,
  ) => void;
  /** Project a successfully recorded Finding into another existing authority. */
  onFindingRecorded?: (command: NilCommand, finding: Finding) => void;

  onAlternativesRequested?: (
    command: NilCommand,
    alternatives: readonly AlternativeCandidate[],
  ) => void;
  onAlternativeCompared?: (
    command: NilCommand,
    comparison: {
      current: RepresentationDecision;
      alternative: AlternativeCandidate;
      sharedAnchors: readonly string[];
    },
  ) => void;
  onAlternativeBranched?: (
    command: NilCommand,
    childNode: InvestigationNode,
  ) => void;
  onAlternativeRejected?: (
    command: NilCommand,
    critique: EmbodimentCritiqueRecordV1,
  ) => void;
  onDecisionExplained?: (
    command: NilCommand,
    explanation: string,
  ) => void;
  onContextCommitted?: (
    command: NilCommand,
    context: CommittedInvestigationContextV2,
  ) => void;
}

function requiredString(command: NilCommand, key: string): string {
  const value = command.parameters[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`NIL ${command.verb} requires non-empty string parameter '${key}'`);
  }
  return value;
}

function targetOrParameterString(command: NilCommand, key: string): string {
  const param = command.parameters[key];
  if (typeof param === 'string' && param.trim().length > 0) {
    return param.trim();
  }
  if (command.targetIds.length > 0 && command.targetIds[0].trim().length > 0) {
    return command.targetIds[0].trim();
  }
  throw new Error(`NIL ${command.verb} requires non-empty parameter '${key}' or targetId`);
}

function requiredNumber(command: NilCommand, key: string): number {
  const value = command.parameters[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`NIL ${command.verb} requires finite numeric parameter '${key}'`);
  }
  return value;
}

function optionalStringArray(value: NilParameterValue | undefined, key: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error(`NIL parameter '${key}' must be a string array`);
  }
  return [...value] as string[];
}

function findingConfidence(command: NilCommand): Finding['confidence'] {
  const value = requiredString(command, 'confidence');
  if (value !== 'preliminary' && value !== 'validated' && value !== 'definitive') {
    throw new Error(
      `NIL CONCLUDE confidence must be one of preliminary, validated, definitive; received '${value}'`,
    );
  }
  return value;
}

/**
 * Bind the subset of NIL research commands that Atlas can already execute as
 * authoritative domain operations.
 *
 * Deliberately unsupported verbs remain unregistered. This prevents the router
 * from inventing UI-side semantics for operations that do not yet have an Atlas
 * domain command.
 */
export function bindAtlasNilHandlers(
  executor: NilExecutor,
  atlas: AtlasNilTarget,
  options: AtlasNilBindingOptions = {},
): () => void {
  const unregister: Array<() => void> = [];

  unregister.push(
    executor.register('OBSERVE', (command) => {
      atlas.recordObservation({
        notes: requiredString(command, 'notes'),
        targetIds: [...command.targetIds],
        tags: optionalStringArray(command.parameters.tags, 'tags'),
      });
    }),
  );

  unregister.push(
    executor.register('ANNOTATE', (command) => {
      atlas.recordAnnotation({
        text: requiredString(command, 'text'),
        position: [
          requiredNumber(command, 'x'),
          requiredNumber(command, 'y'),
          requiredNumber(command, 'z'),
        ],
        targetId: command.targetIds[0],
      });
    }),
  );

  unregister.push(
    executor.register('CONCLUDE', (command) => {
      const findingInput = {
        title: requiredString(command, 'title'),
        description: requiredString(command, 'description'),
        confidence: findingConfidence(command),
        observationIds: optionalStringArray(command.parameters.observationIds, 'observationIds'),
        resultIds: optionalStringArray(command.parameters.resultIds, 'resultIds'),
      };
      options.beforeRecordFinding?.(command, findingInput);
      const finding = atlas.recordFinding(findingInput);
      options.onFindingRecorded?.(command, finding);
    }),
  );

  // FM2: REQUEST_ALTERNATIVE
  if (atlas.getRepresentationAlternatives || atlas.arbitrateRepresentation) {
    unregister.push(
      executor.register('REQUEST_ALTERNATIVE', (command) => {
        let alternatives = atlas.getRepresentationAlternatives?.() ?? [];
        if (alternatives.length === 0 && atlas.arbitrateRepresentation) {
          atlas.arbitrateRepresentation();
          alternatives = atlas.getRepresentationAlternatives?.() ?? [];
        }
        const candidateId =
          typeof command.parameters.candidateId === 'string' &&
          command.parameters.candidateId.trim().length > 0
            ? command.parameters.candidateId.trim()
            : (command.targetIds.length > 0 && command.targetIds[0].trim().length > 0
                ? command.targetIds[0].trim()
                : undefined);
        if (candidateId && atlas.previewAlternative) {
          atlas.previewAlternative(candidateId);
        }
        options.onAlternativesRequested?.(command, alternatives);
      }),
    );
  }

  // FM2: COMPARE
  if (atlas.compareAlternative) {
    unregister.push(
      executor.register('COMPARE', (command) => {
        const candidateId = targetOrParameterString(command, 'candidateId');
        const comparison = atlas.compareAlternative!(candidateId);
        options.onAlternativeCompared?.(command, comparison);
      }),
    );
  }

  // FM2: PREFER (branches to alternative via Road Not Taken)
  if (atlas.branchToAlternative) {
    unregister.push(
      executor.register('PREFER', (command) => {
        const candidateId = targetOrParameterString(command, 'candidateId');
        let intentOverride: unknown = undefined;
        if (typeof command.parameters.researchQuestion === 'string') {
          intentOverride = {
            schemaVersion: 1,
            researchQuestion: command.parameters.researchQuestion,
            hypothesis:
              typeof command.parameters.hypothesis === 'string'
                ? command.parameters.hypothesis
                : undefined,
          };
        } else if (command.parameters.intentOverride !== undefined) {
          intentOverride = command.parameters.intentOverride;
        }
        const childNode = atlas.branchToAlternative!(candidateId, intentOverride);
        options.onAlternativeBranched?.(command, childNode);
      }),
    );
  }

  // FM2: REJECT (records attributable embodiment critique)
  if (atlas.recordEmbodimentCritique) {
    unregister.push(
      executor.register('REJECT', (command) => {
        const candidateId = targetOrParameterString(command, 'candidateId');
        const rationale =
          typeof command.parameters.rationale === 'string' &&
          command.parameters.rationale.trim().length > 0
            ? command.parameters.rationale.trim()
            : (typeof command.parameters.reason === 'string' &&
               command.parameters.reason.trim().length > 0
                ? command.parameters.reason.trim()
                : `Rejected alternative ${candidateId} via NIL`);
        const activeContext = atlas.getActiveInvestigationContext?.();
        const activeNodeId =
          activeContext?.nodeId ??
          atlas.getActiveNodeId?.() ??
          'node-root';
        const critique = atlas.recordEmbodimentCritique!({
          planId: candidateId,
          sliceId: `slice-${candidateId}`,
          contextId: activeContext?.nodeId ?? activeNodeId,
          semanticNodeId: activeNodeId,
          critiqueText: rationale,
          author: { researcherId: command.actor },
          confirmed: true,
          status: 'REJECTED',
          scope: {},
        });
        options.onAlternativeRejected?.(command, critique);
      }),
    );
  }

  // FM2: EXPLAIN
  if (atlas.explainDecision) {
    unregister.push(
      executor.register('EXPLAIN', (command) => {
        const preference =
          typeof command.parameters.preference === 'string'
            ? command.parameters.preference
            : undefined;
        const explanation = atlas.explainDecision!(preference);
        options.onDecisionExplained?.(command, explanation);
      }),
    );
  }

  // FM1: QUESTION (updates active committed context intent)
  if (options.bindIntentCommands !== false && atlas.commitInvestigationContext) {
    unregister.push(
      executor.register('QUESTION', (command) => {
        const question = requiredString(command, 'question');
        const activeContext = atlas.getActiveInvestigationContext?.();
        const activeNodeId =
          activeContext?.nodeId ??
          atlas.getActiveNodeId?.() ??
          atlas.toState?.().investigationGraph?.activeNodeId;
        if (!activeNodeId) {
          throw new Error('NIL QUESTION requires an active investigation node in graph');
        }
        const newContext: CommittedInvestigationContextV2 = {
          schemaVersion: 2,
          nodeId: activeNodeId,
          intent: {
            schemaVersion: 1,
            researchQuestion: question,
            variablesOfInterest: optionalStringArray(command.parameters.variables, 'variables'),
            currentTask:
              typeof command.parameters.task === 'string'
                ? command.parameters.task
                : undefined,
            hypothesis: activeContext?.intent.hypothesis,
          },
          epistemicPurpose: activeContext?.epistemicPurpose ?? 'EXPLORATORY_ABDUCTION',
          perspective: activeContext?.perspective,
        };
        atlas.commitInvestigationContext!(activeNodeId, newContext);
        options.onContextCommitted?.(command, newContext);
      }),
    );
  }

  // FM1: HYPOTHESISE (updates active committed context hypothesis)
  if (options.bindIntentCommands !== false && atlas.commitInvestigationContext) {
    unregister.push(
      executor.register('HYPOTHESISE', (command) => {
        const hypothesis = requiredString(command, 'hypothesis');
        const activeContext = atlas.getActiveInvestigationContext?.();
        const activeNodeId =
          activeContext?.nodeId ??
          atlas.getActiveNodeId?.() ??
          atlas.toState?.().investigationGraph?.activeNodeId;
        if (!activeNodeId) {
          throw new Error('NIL HYPOTHESISE requires an active investigation node in graph');
        }
        const newContext: CommittedInvestigationContextV2 = {
          schemaVersion: 2,
          nodeId: activeNodeId,
          intent: {
            schemaVersion: 1,
            researchQuestion:
              activeContext?.intent.researchQuestion ??
              'Investigation hypothesis testing',
            hypothesis,
            variablesOfInterest: activeContext?.intent.variablesOfInterest,
            currentTask: activeContext?.intent.currentTask,
          },
          epistemicPurpose: activeContext?.epistemicPurpose ?? 'EXPLORATORY_ABDUCTION',
          perspective: activeContext?.perspective,
        };
        atlas.commitInvestigationContext!(activeNodeId, newContext);
        options.onContextCommitted?.(command, newContext);
      }),
    );
  }

  return () => {
    for (const dispose of unregister.reverse()) dispose();
  };
}
