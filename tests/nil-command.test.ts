import { describe, expect, it } from 'vitest';
import {
  NIL_VERSION,
  canonicalizeNilCommand,
  validateNilCommand,
  type NilCommand,
} from '../src/interaction/nil/NemosyneInteractionLanguage.ts';

function commandFixture(): NilCommand {
  return {
    nilVersion: NIL_VERSION,
    commandId: 'command-17',
    investigationId: 'investigation-1',
    sequence: 17,
    verb: 'FILTER',
    targetIds: ['dataset:active'],
    parameters: { threshold: 0.5, field: 'score' },
    actor: 'researcher',
  };
}

describe('Nemosyne Interaction Language', () => {
  it('represents semantic intent without device-specific input fields', () => {
    const command = commandFixture();
    expect(validateNilCommand(command)).toEqual([]);
    expect(Object.keys(command)).not.toEqual(
      expect.arrayContaining(['controller', 'button', 'gesture', 'mouse', 'gaze', 'handPose'])
    );
  });

  it('rejects invalid replay sequence numbers', () => {
    const command = commandFixture();
    command.sequence = -1;
    expect(validateNilCommand(command)).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'sequence' })])
    );
  });

  it('rejects non-finite numerical parameters', () => {
    const command = commandFixture();
    command.parameters = { threshold: Number.NaN };
    expect(validateNilCommand(command)).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'parameters.threshold' })])
    );
  });

  it('canonicalizes parameter ordering for deterministic replay', () => {
    const left = commandFixture();
    left.parameters = { z: 2, a: 1 };
    const right = commandFixture();
    right.parameters = { a: 1, z: 2 };
    expect(canonicalizeNilCommand(left)).toBe(canonicalizeNilCommand(right));
  });

  it('supports representation-intelligence commands in the same semantic language', () => {
    const command = commandFixture();
    command.verb = 'REQUEST_ALTERNATIVE';
    command.targetIds = ['representation:current'];
    command.parameters = {};
    expect(validateNilCommand(command)).toEqual([]);
  });
});
