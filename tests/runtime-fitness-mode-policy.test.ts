import { describe, expect, it } from 'vitest';
import {
  bootstrapRuntimeFitnessMode,
  currentStudyRuntimeVersions,
  pinnedLearnedRuntimeFitnessMode,
  StudyFreezeGuard,
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

  it('detects learned artifact drift during a frozen study', () => {
    const declared = currentStudyRuntimeVersions(
      'kernel-1',
      pinnedLearnedRuntimeFitnessMode('learned-v2', 'artifact-a'),
    );
    const guard = new StudyFreezeGuard(manifest(declared), () =>
      currentStudyRuntimeVersions(
        'kernel-1',
        pinnedLearnedRuntimeFitnessMode('learned-v2', 'artifact-b'),
      ),
    );
    expect(() => guard.assertCurrent()).toThrow(/runtime drift/i);
  });

  it('rejects a learned runtime identity without an exact artifact hash', () => {
    expect(() => pinnedLearnedRuntimeFitnessMode('learned-v2', '   ')).toThrow(/artifact hash/i);
  });
});
