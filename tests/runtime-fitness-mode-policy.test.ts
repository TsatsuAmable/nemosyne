import { describe, expect, it } from 'vitest';
import {
  assertRuntimeFitnessMode,
  bootstrapRuntimeFitnessMode,
  currentStudyRuntimeVersions,
  pinnedLearnedRuntimeFitnessMode,
  StudyFreezeGuard,
  type RuntimeFitnessMode,
  type StudyFreezeManifest,
} from '../src/study/index.ts';

function manifest(runtimeVersions = currentStudyRuntimeVersions('kernel-1')): StudyFreezeManifest {
  return {
    schemaVersion: '1.0.0',
    studyName: 'runtime-mode-test',
    protocolVersion: 'v1',
    protocolStatus: 'FROZEN',
    conditions: ['vr_experimental'],
    tasks: [],
    runtimeVersions,
    adaptiveBehaviour: { policy: 'frozen', protocolVisible: true },
  };
}

describe('runtime fitness mode policy', () => {
  it('represents bootstrap mode without an artifact hash', () => {
    const mode = bootstrapRuntimeFitnessMode();
    expect(mode.mode).toBe('bootstrap');
    expect(mode.artifactHash).toBeNull();
  });

  it('pins learned mode to an exact model version and artifact hash', () => {
    const mode = pinnedLearnedRuntimeFitnessMode('learned-v2', 'fnv1a-deadbeef');
    const runtime = currentStudyRuntimeVersions('kernel-1', mode);
    expect(runtime.fitnessModelVersion).toBe('learned-v2');
    expect(runtime.fitnessModelArtifactHash).toBe('fnv1a-deadbeef');
  });

  it('detects learned artifact drift before a frozen study begins', () => {
    const declared = currentStudyRuntimeVersions(
      'kernel-1',
      pinnedLearnedRuntimeFitnessMode('learned-v2', 'artifact-a'),
    );
    expect(() => new StudyFreezeGuard(manifest(declared), () =>
      currentStudyRuntimeVersions(
        'kernel-1',
        pinnedLearnedRuntimeFitnessMode('learned-v2', 'artifact-b'),
      ),
    )).toThrow(/runtime drift/i);
  });

  it('rejects a learned runtime identity without an exact artifact hash', () => {
    expect(() => pinnedLearnedRuntimeFitnessMode('learned-v2', '   ')).toThrow(/artifact hash/i);
  });

  it('rejects a learned runtime identity without a model version', () => {
    expect(() => pinnedLearnedRuntimeFitnessMode('   ', 'artifact-a')).toThrow(/model version/i);
  });

  it('rejects unsupported runtime fitness mode schema versions', () => {
    const invalid = {
      ...bootstrapRuntimeFitnessMode(),
      schemaVersion: '2.0.0',
    } as unknown as RuntimeFitnessMode;

    expect(() => assertRuntimeFitnessMode(invalid)).toThrow(/unsupported.*schema version/i);
  });

  it('rejects a bootstrap runtime with a non-canonical model version', () => {
    const invalid = {
      ...bootstrapRuntimeFitnessMode(),
      fitnessModelVersion: 'learned-v2',
    } as unknown as RuntimeFitnessMode;

    expect(() => assertRuntimeFitnessMode(invalid)).toThrow(/canonical bootstrap/i);
  });

  it('rejects a bootstrap runtime carrying an artifact hash', () => {
    const invalid = {
      ...bootstrapRuntimeFitnessMode(),
      artifactHash: 'artifact-a',
    } as unknown as RuntimeFitnessMode;

    expect(() => assertRuntimeFitnessMode(invalid)).toThrow(/canonical bootstrap/i);
  });

  it('rejects a pinned learned runtime with a blank model version', () => {
    const invalid = {
      schemaVersion: '1.0.0',
      mode: 'pinned-learned',
      fitnessModelVersion: '   ',
      artifactHash: 'artifact-a',
    } as RuntimeFitnessMode;

    expect(() => assertRuntimeFitnessMode(invalid)).toThrow(/exact model version and artifact hash/i);
  });

  it('rejects a pinned learned runtime with a blank artifact hash', () => {
    const invalid = {
      schemaVersion: '1.0.0',
      mode: 'pinned-learned',
      fitnessModelVersion: 'learned-v2',
      artifactHash: '   ',
    } as RuntimeFitnessMode;

    expect(() => assertRuntimeFitnessMode(invalid)).toThrow(/exact model version and artifact hash/i);
  });
});
