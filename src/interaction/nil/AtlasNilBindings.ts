import type { Annotation, Finding, Observation } from '../../atlas/types.ts';
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
}

export interface AtlasNilBindingOptions {
  /** Validate cross-domain constraints before Atlas mutates finding state. */
  beforeRecordFinding?: (
    command: NilCommand,
    finding: Omit<Finding, 'id' | 'timestamp' | 'datasetFingerprint' | 'datasetVersion'>,
  ) => void;
  /** Project a successfully recorded Finding into another existing authority. */
  onFindingRecorded?: (command: NilCommand, finding: Finding) => void;
}

function requiredString(command: NilCommand, key: string): string {
  const value = command.parameters[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`NIL ${command.verb} requires non-empty string parameter '${key}'`);
  }
  return value;
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

  return () => {
    for (const dispose of unregister.reverse()) dispose();
  };
}
