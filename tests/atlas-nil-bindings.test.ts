import { describe, expect, it, vi } from 'vitest';
import {
  NIL_VERSION,
  NilExecutor,
  UnhandledNilCommandError,
  bindAtlasNilHandlers,
  type AtlasNilTarget,
  type NilCommand,
} from '../src/interaction/nil/index.ts';

function command(
  sequence: number,
  verb: NilCommand['verb'],
  parameters: NilCommand['parameters'],
  targetIds: readonly string[] = [],
): NilCommand {
  return {
    nilVersion: NIL_VERSION,
    commandId: `cmd-${sequence}`,
    investigationId: 'investigation-1',
    sequence,
    verb,
    targetIds,
    parameters,
    actor: 'researcher',
  };
}

function atlasTarget(): AtlasNilTarget & {
  recordObservation: ReturnType<typeof vi.fn>;
  recordAnnotation: ReturnType<typeof vi.fn>;
  recordFinding: ReturnType<typeof vi.fn>;
} {
  return {
    recordObservation: vi.fn((input) => ({
      id: 'obs-1',
      timestamp: 1,
      notes: typeof input === 'string' ? input : input.notes,
      datasetFingerprint: 'fp',
      datasetVersion: 1,
    })),
    recordAnnotation: vi.fn((input) => ({ id: 'ann-1', timestamp: 1, ...input })),
    recordFinding: vi.fn((input) => ({
      id: 'finding-1',
      timestamp: 1,
      datasetFingerprint: 'fp',
      datasetVersion: 1,
      ...input,
    })),
  } as unknown as AtlasNilTarget & {
    recordObservation: ReturnType<typeof vi.fn>;
    recordAnnotation: ReturnType<typeof vi.fn>;
    recordFinding: ReturnType<typeof vi.fn>;
  };
}

describe('Atlas NIL bindings', () => {
  it('routes OBSERVE, ANNOTATE and CONCLUDE through Atlas domain methods', async () => {
    const executor = new NilExecutor();
    const atlas = atlasTarget();
    bindAtlasNilHandlers(executor, atlas);

    await executor.execute(
      command(0, 'OBSERVE', { notes: 'cluster boundary looks unstable', tags: ['cluster'] }, ['cluster-7']),
    );
    await executor.execute(
      command(1, 'ANNOTATE', { text: 'inspect here', x: 1, y: 2, z: 3 }, ['cluster-7']),
    );
    await executor.execute(
      command(2, 'CONCLUDE', {
        title: 'Boundary instability',
        description: 'The boundary varies under the tested condition.',
        confidence: 'preliminary',
        observationIds: ['obs-1'],
        resultIds: ['result-1'],
      }),
    );

    expect(atlas.recordObservation).toHaveBeenCalledWith({
      notes: 'cluster boundary looks unstable',
      targetIds: ['cluster-7'],
      tags: ['cluster'],
    });
    expect(atlas.recordAnnotation).toHaveBeenCalledWith({
      text: 'inspect here',
      position: [1, 2, 3],
      targetId: 'cluster-7',
    });
    expect(atlas.recordFinding).toHaveBeenCalledWith({
      title: 'Boundary instability',
      description: 'The boundary varies under the tested condition.',
      confidence: 'preliminary',
      observationIds: ['obs-1'],
      resultIds: ['result-1'],
    });
    expect(executor.expectedSequence('investigation-1')).toBe(3);
  });

  it('does not consume sequence when a required semantic parameter is invalid', async () => {
    const executor = new NilExecutor();
    const atlas = atlasTarget();
    bindAtlasNilHandlers(executor, atlas);

    await expect(executor.execute(command(0, 'OBSERVE', { notes: '' }))).rejects.toThrow(
      /requires non-empty string parameter 'notes'/i,
    );
    expect(executor.expectedSequence('investigation-1')).toBe(0);
    expect(atlas.recordObservation).not.toHaveBeenCalled();
  });

  it('leaves unsupported verbs unregistered rather than inventing UI-side semantics', async () => {
    const executor = new NilExecutor();
    bindAtlasNilHandlers(executor, atlasTarget());

    await expect(executor.execute(command(0, 'FILTER', {}))).rejects.toBeInstanceOf(
      UnhandledNilCommandError,
    );
  });
});
