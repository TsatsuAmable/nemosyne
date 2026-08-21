import {
  assertNilCommand,
  type NilCommand,
  type NilVerb,
} from './NemosyneInteractionLanguage.ts';

export type NilCommandHandler = (command: NilCommand) => void | Promise<void>;

export class UnhandledNilCommandError extends Error {
  readonly verb: NilVerb;

  constructor(verb: NilVerb) {
    super(`No NIL handler registered for ${verb}`);
    this.name = 'UnhandledNilCommandError';
    this.verb = verb;
  }
}

export class NilSequenceError extends Error {
  readonly investigationId: string;
  readonly expected: number;
  readonly actual: number;

  constructor(investigationId: string, expected: number, actual: number) {
    super(
      `Out-of-order NIL command for ${investigationId}: expected sequence ${expected}, received ${actual}`,
    );
    this.name = 'NilSequenceError';
    this.investigationId = investigationId;
    this.expected = expected;
    this.actual = actual;
  }
}

/**
 * Modality-independent execution boundary for NIL.
 *
 * Perception layers may create commands, but only semantic handlers registered
 * here perform domain operations. Device events, hand poses, controller buttons,
 * and pointer state never enter this executor contract.
 */
export class NilExecutor {
  private readonly handlers = new Map<NilVerb, NilCommandHandler>();
  private readonly nextSequenceByInvestigation = new Map<string, number>();

  register(verb: NilVerb, handler: NilCommandHandler): () => void {
    if (this.handlers.has(verb)) {
      throw new Error(`NIL handler already registered for ${verb}`);
    }
    this.handlers.set(verb, handler);
    return () => {
      if (this.handlers.get(verb) === handler) this.handlers.delete(verb);
    };
  }

  expectedSequence(investigationId: string): number {
    return this.nextSequenceByInvestigation.get(investigationId) ?? 0;
  }

  resetInvestigation(investigationId: string, nextSequence = 0): void {
    if (!Number.isSafeInteger(nextSequence) || nextSequence < 0) {
      throw new Error('nextSequence must be a non-negative safe integer');
    }
    this.nextSequenceByInvestigation.set(investigationId, nextSequence);
  }

  async execute(command: NilCommand): Promise<void> {
    assertNilCommand(command);

    const expected = this.expectedSequence(command.investigationId);
    if (command.sequence !== expected) {
      throw new NilSequenceError(command.investigationId, expected, command.sequence);
    }

    const handler = this.handlers.get(command.verb);
    if (!handler) throw new UnhandledNilCommandError(command.verb);

    // Advance only after the semantic operation succeeds. Failed handlers leave
    // the command replayable at the same deterministic sequence position.
    await handler(command);
    this.nextSequenceByInvestigation.set(command.investigationId, expected + 1);
  }

  async replay(commands: readonly NilCommand[]): Promise<void> {
    for (const command of commands) await this.execute(command);
  }
}
