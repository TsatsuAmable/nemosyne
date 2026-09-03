import type { Observation } from '../../atlas/types.ts';
import {
  NIL_VERSION,
  type NilCommand,
  type NilVerb,
  type NilParameterValue,
} from '../../interaction/nil/NemosyneInteractionLanguage.ts';
import type { NilExecutor } from '../../interaction/nil/NilExecutor.ts';
import type {
  DiscoveryReasoningService,
  DiscoveryReasoningSnapshot,
  DiscoveryTestOutcome,
} from './DiscoveryReasoningService.ts';

export interface InvestigationJourneyControllerOptions {
  executor: NilExecutor;
  reasoning: DiscoveryReasoningService;
  investigationId: () => string;
  idFactory?: (prefix: string) => string;
  now?: () => number;
}

export interface RecordUnderstandingInput {
  discoveryId: string;
  title: string;
  description: string;
  resultId: string;
  confidence?: 'preliminary' | 'validated' | 'definitive';
}

function requiredText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

/**
 * Modality-independent product controller for the canonical investigation journey.
 *
 * Desktop and XR call this controller. It emits sequenced NIL commands and then
 * re-reads the authoritative DiscoveryReasoningService/Atlas state. It owns no
 * discovery or analytical state of its own.
 */
export class InvestigationJourneyController {
  private readonly executor: NilExecutor;
  private readonly reasoning: DiscoveryReasoningService;
  private readonly investigationId: () => string;
  private readonly idFactory: (prefix: string) => string;
  private readonly now: () => number;
  private fallbackCounter = 0;

  constructor(options: InvestigationJourneyControllerOptions) {
    this.executor = options.executor;
    this.reasoning = options.reasoning;
    this.investigationId = options.investigationId;
    this.now = options.now ?? (() => Date.now());
    this.idFactory =
      options.idFactory ??
      ((prefix) => {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
          return `${prefix}-${crypto.randomUUID()}`;
        }
        this.fallbackCounter += 1;
        return `${prefix}-${this.now()}-${this.fallbackCounter}`;
      });
  }

  snapshot(): DiscoveryReasoningSnapshot {
    return this.reasoning.snapshot();
  }

  private command(
    verb: NilVerb,
    targetIds: readonly string[],
    parameters: Readonly<Record<string, NilParameterValue>>,
  ): NilCommand {
    const investigationId = this.investigationId();
    return {
      nilVersion: NIL_VERSION,
      commandId: this.idFactory('nil'),
      investigationId,
      sequence: this.executor.expectedSequence(investigationId),
      verb,
      targetIds,
      parameters,
      actor: 'researcher',
    };
  }

  async observe(note: string, targetIds: readonly string[] = []): Promise<Observation> {
    const before = this.reasoning.snapshot().latestObservation?.id ?? null;
    await this.executor.execute(
      this.command('OBSERVE', targetIds, {
        notes: requiredText(note, 'Notice'),
        tags: ['investigation-journey'],
      }),
    );
    const observation = this.reasoning.snapshot().latestObservation;
    if (!observation || observation.id === before) {
      throw new Error('The notice was not recorded by the investigation authority.');
    }
    return observation;
  }

  async ask(observationId: string, question: string): Promise<string> {
    const before = new Set(this.reasoning.snapshot().discoveries.map((entry) => entry.discoveryId));
    await this.executor.execute(
      this.command('QUESTION', [requiredText(observationId, 'Observation')], {
        question: requiredText(question, 'Question'),
      }),
    );
    const created = this.reasoning
      .snapshot()
      .discoveries.find((entry) => !before.has(entry.discoveryId));
    if (!created) throw new Error('The research question was not recorded.');
    return created.discoveryId;
  }

  async hypothesise(discoveryId: string, hypothesis: string): Promise<void> {
    await this.executor.execute(
      this.command('HYPOTHESISE', [requiredText(discoveryId, 'Investigation')], {
        hypothesis: requiredText(hypothesis, 'Hypothesis'),
      }),
    );
  }

  async recordUnderstanding(input: RecordUnderstandingInput): Promise<void> {
    const episode = this.reasoning.snapshot().discoveries.find(
      (entry) => entry.discoveryId === input.discoveryId,
    );
    if (!episode) throw new Error(`Investigation not found: ${input.discoveryId}`);
    const observationIds = episode.evidenceIds.filter((id) => id.startsWith('obs-') || id.startsWith('observation-'));
    await this.executor.execute(
      this.command('CONCLUDE', [input.discoveryId], {
        title: requiredText(input.title, 'Understanding title'),
        description: requiredText(input.description, 'Understanding'),
        confidence: input.confidence ?? 'preliminary',
        observationIds,
        resultIds: [requiredText(input.resultId, 'Analytical evidence')],
        discoveryId: input.discoveryId,
      }),
    );
  }

  async validate(
    discoveryId: string,
    resultId: string,
    outcome: DiscoveryTestOutcome,
  ): Promise<void> {
    const verb: NilVerb =
      outcome === 'SUPPORTS' ? 'SUPPORT' : outcome === 'REFUTES' ? 'REFUTE' : 'TEST';
    await this.executor.execute(
      this.command(verb, [requiredText(discoveryId, 'Investigation')], {
        resultId: requiredText(resultId, 'Analytical evidence'),
        ...(outcome === 'INCONCLUSIVE' ? { outcome: 'INCONCLUSIVE' } : {}),
      }),
    );
  }

  returnToDiscovery(discoveryId: string): { id: string } {
    const node = this.reasoning.returnToConclusion(discoveryId);
    return { id: node.id };
  }
}
