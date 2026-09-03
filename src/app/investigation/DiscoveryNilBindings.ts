import type { NilCommand } from '../../interaction/nil/NemosyneInteractionLanguage.ts';
import type { NilExecutor } from '../../interaction/nil/NilExecutor.ts';
import type { DiscoveryReasoningService } from './DiscoveryReasoningService.ts';

function requiredString(command: NilCommand, key: string): string {
  const value = command.parameters[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`NIL ${command.verb} requires non-empty string parameter '${key}'`);
  }
  return value.trim();
}

function requiredDiscoveryId(command: NilCommand): string {
  const id = command.targetIds[0];
  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new Error(`NIL ${command.verb} requires a discovery target id`);
  }
  return id;
}

/**
 * Bind investigation/discovery NIL verbs to the authoritative reasoning service.
 *
 * `OBSERVE`, `ANNOTATE`, and `CONCLUDE` remain Atlas-owned. CONCLUDE can notify
 * the reasoning service after Atlas has recorded the explicit Finding; see the
 * Atlas NIL binding callback wired by the application composition root.
 */
export function bindDiscoveryNilHandlers(
  executor: NilExecutor,
  reasoning: DiscoveryReasoningService,
): () => void {
  const unregister: Array<() => void> = [];

  unregister.push(
    executor.register('QUESTION', (command) => {
      const observationId = command.targetIds[0];
      if (!observationId) throw new Error('NIL QUESTION requires an observation target id');
      reasoning.ask({
        observationId,
        question: requiredString(command, 'question'),
      });
    }),
  );

  unregister.push(
    executor.register('HYPOTHESISE', (command) => {
      reasoning.hypothesise({
        discoveryId: requiredDiscoveryId(command),
        hypothesis: requiredString(command, 'hypothesis'),
      });
    }),
  );

  unregister.push(
    executor.register('SUPPORT', (command) => {
      reasoning.validate({
        discoveryId: requiredDiscoveryId(command),
        resultId: requiredString(command, 'resultId'),
        outcome: 'SUPPORTS',
      });
    }),
  );

  unregister.push(
    executor.register('REFUTE', (command) => {
      reasoning.validate({
        discoveryId: requiredDiscoveryId(command),
        resultId: requiredString(command, 'resultId'),
        outcome: 'REFUTES',
      });
    }),
  );

  unregister.push(
    executor.register('TEST', (command) => {
      if (requiredString(command, 'outcome') !== 'INCONCLUSIVE') {
        throw new Error('NIL TEST only records an INCONCLUSIVE validation outcome in PT5C');
      }
      reasoning.validate({
        discoveryId: requiredDiscoveryId(command),
        resultId: requiredString(command, 'resultId'),
        outcome: 'INCONCLUSIVE',
      });
    }),
  );

  return () => {
    for (const dispose of unregister.reverse()) dispose();
  };
}
