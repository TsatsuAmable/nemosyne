import { fnv1aHex } from '../atlas/DatasetSpace.ts';
import { NIL_VERSION } from '../interaction/nil/NemosyneInteractionLanguage.ts';
import {
  BOOTSTRAP_FITNESS_MODEL_VERSION,
} from '../moneta/representation/FitnessModel.ts';
import {
  BOOTSTRAP_REPRESENTATION_ONTOLOGY_VERSION,
} from '../moneta/representation/RepresentationGraphAdapter.ts';
import type { StudyCondition, StudyRuntimeVersions, TaskSpec } from './types.ts';

export const STUDY_FREEZE_MANIFEST_SCHEMA_VERSION = '1.0.0' as const;
export const CURRENT_MONETA_ENGINE_VERSION = '2.1.0-v3-bootstrap' as const;

export interface StudyFreezeManifest {
  schemaVersion: typeof STUDY_FREEZE_MANIFEST_SCHEMA_VERSION;
  studyName: string;
  protocolVersion: string;
  protocolStatus: 'DRAFT' | 'FROZEN';
  conditions: readonly StudyCondition[];
  tasks: readonly TaskSpec[];
  runtimeVersions: StudyRuntimeVersions;
  adaptiveBehaviour: {
    policy: 'disabled' | 'frozen' | 'protocol-controlled';
    protocolVisible: true;
  };
}

export interface StudyFreezeSnapshot {
  configHash: string;
  manifest: StudyFreezeManifest;
  runtimeVersions: StudyRuntimeVersions;
}

export type StudyRuntimeVersionsProvider = () => StudyRuntimeVersions;

export function currentStudyRuntimeVersions(kernelVersion: string | null = null): StudyRuntimeVersions {
  return {
    kernelVersion,
    monetaEngineVersion: CURRENT_MONETA_ENGINE_VERSION,
    fitnessModelVersion: BOOTSTRAP_FITNESS_MODEL_VERSION,
    representationOntologyVersion: BOOTSTRAP_REPRESENTATION_ONTOLOGY_VERSION,
    nilVersion: NIL_VERSION,
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function hashStudyFreezeManifest(manifest: StudyFreezeManifest): string {
  return `fnv1a-${fnv1aHex(manifest)}`;
}

function sameRuntimeVersions(a: StudyRuntimeVersions, b: StudyRuntimeVersions): boolean {
  return (
    a.kernelVersion === b.kernelVersion &&
    a.monetaEngineVersion === b.monetaEngineVersion &&
    a.fitnessModelVersion === b.fitnessModelVersion &&
    a.representationOntologyVersion === b.representationOntologyVersion &&
    a.nilVersion === b.nilVersion
  );
}

/**
 * Runtime drift guard for controlled studies.
 *
 * The guard snapshots the declared treatment manifest and exact runtime version
 * vector. Callers must assert it at trial boundaries. Any version/configuration
 * drift fails closed instead of silently changing the treatment mid-session.
 */
export class StudyFreezeGuard {
  private readonly snapshotValue: StudyFreezeSnapshot;

  constructor(
    manifest: StudyFreezeManifest,
    private readonly runtimeVersionsProvider: StudyRuntimeVersionsProvider = () =>
      currentStudyRuntimeVersions(manifest.runtimeVersions.kernelVersion),
  ) {
    this.snapshotValue = {
      configHash: hashStudyFreezeManifest(manifest),
      manifest: clone(manifest),
      runtimeVersions: clone(runtimeVersionsProvider()),
    };
    this.assertCurrent(manifest);
  }

  get snapshot(): StudyFreezeSnapshot {
    return clone(this.snapshotValue);
  }

  assertCurrent(manifest: StudyFreezeManifest = this.snapshotValue.manifest): void {
    const actualHash = hashStudyFreezeManifest(manifest);
    if (actualHash !== this.snapshotValue.configHash) {
      throw new Error(
        `Study configuration drift detected: expected ${this.snapshotValue.configHash}, received ${actualHash}`,
      );
    }

    const currentVersions = this.runtimeVersionsProvider();
    if (!sameRuntimeVersions(currentVersions, this.snapshotValue.runtimeVersions)) {
      throw new Error(
        `Study runtime drift detected: expected ${JSON.stringify(this.snapshotValue.runtimeVersions)}, received ${JSON.stringify(currentVersions)}`,
      );
    }

    if (manifest.protocolStatus === 'FROZEN' && !currentVersions.kernelVersion) {
      throw new Error('Frozen study requires an exact Rust/WASM kernel version');
    }
  }
}
