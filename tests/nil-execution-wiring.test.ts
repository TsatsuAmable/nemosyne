import { describe, expect, it, vi } from 'vitest';
import {
  NIL_VERSION,
  NilExecutor,
  NilSequenceError,
  UnhandledNilCommandError,
  type NilCommand,
} from '../src/interaction/nil/index.ts';

function command(sequence: number, verb: NilCommand['verb'] = 'SELECT'): NilCommand {
  return {
    nilVersion: NIL_VERSION,
    commandId: `cmd-${sequence}`,
    investigationId: 'investigation-1',
    sequence,
    verb,
    targetIds: ['datum-1'],
    parameters: {},
    actor: 'researcher',
  };
}

describe('NIL execution wiring', () => {
  it('dispatches semantic commands without carrying input-modality state', async () => {
    const executor = new NilExecutor();
    const handler = vi.fn();
    executor.register('SELECT', handler);

    await executor.execute(command(0));

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].verb).toBe('SELECT');
    expect(executor.expectedSequence('investigation-1')).toBe(1);
  });

  it('fails closed for unhandled semantic commands', async () => {
    const executor = new NilExecutor();
    await expect(executor.execute(command(0, 'FILTER'))).rejects.toBeInstanceOf(
      UnhandledNilCommandError,
    );
    expect(executor.expectedSequence('investigation-1')).toBe(0);
  });

  it('rejects out-of-order commands so replay cannot silently diverge', async () => {
    const executor = new NilExecutor();
    executor.register('SELECT', () => undefined);

    await expect(executor.execute(command(1))).rejects.toBeInstanceOf(NilSequenceError);
    expect(executor.expectedSequence('investigation-1')).toBe(0);
  });

  it('does not consume a sequence number when a semantic handler fails', async () => {
    const executor = new NilExecutor();
    executor.register('SELECT', () => {
      throw new Error('domain operation rejected');
    });

    await expect(executor.execute(command(0))).rejects.toThrow(/domain operation rejected/i);
    expect(executor.expectedSequence('investigation-1')).toBe(0);
  });

  it('replays a deterministic command stream in sequence', async () => {
    const executor = new NilExecutor();
    const seen: string[] = [];
    executor.register('SELECT', (cmd) => seen.push(cmd.commandId));

    await executor.replay([command(0), command(1), command(2)]);
    expect(seen).toEqual(['cmd-0', 'cmd-1', 'cmd-2']);
    expect(executor.expectedSequence('investigation-1')).toBe(3);
  });
});
