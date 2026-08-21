import { BOOTSTRAP_FITNESS_MODEL_VERSION } from '../moneta/representation/FitnessModel.ts';

export const RUNTIME_FITNESS_MODE_SCHEMA_VERSION = '1.0.0' as const;

export type RuntimeFitnessMode =
  | {
      schemaVersion: typeof RUNTIME_FITNESS_MODE_SCHEMA_VERSION;
      mode: 'bootstrap';
      fitnessModelVersion: typeof BOOTSTRAP_FITNESS_MODEL_VERSION;
      artifactHash: null;
    }
  | {
      schemaVersion: typeof RUNTIME_FITNESS_MODE_SCHEMA_VERSION;
      mode: 'pinned-learned';
      fitnessModelVersion: string;
      artifactHash: string;
    };

export function bootstrapRuntimeFitnessMode(): RuntimeFitnessMode {
  return {
    schemaVersion: RUNTIME_FITNESS_MODE_SCHEMA_VERSION,
    mode: 'bootstrap',
    fitnessModelVersion: BOOTSTRAP_FITNESS_MODEL_VERSION,
    artifactHash: null,
  };
}

export function pinnedLearnedRuntimeFitnessMode(
  fitnessModelVersion: string,
  artifactHash: string,
): RuntimeFitnessMode {
  const version = fitnessModelVersion.trim();
  const hash = artifactHash.trim();
  if (!version) throw new TypeError('Pinned learned runtime requires a non-empty FitnessModel version');
  if (!hash) throw new TypeError('Pinned learned runtime requires an exact artifact hash');
  return {
    schemaVersion: RUNTIME_FITNESS_MODE_SCHEMA_VERSION,
    mode: 'pinned-learned',
    fitnessModelVersion: version,
    artifactHash: hash,
  };
}

export function assertRuntimeFitnessMode(mode: RuntimeFitnessMode): RuntimeFitnessMode {
  if (mode.schemaVersion !== RUNTIME_FITNESS_MODE_SCHEMA_VERSION) {
    throw new TypeError(`Unsupported RuntimeFitnessMode schema version: ${mode.schemaVersion}`);
  }
  if (mode.mode === 'bootstrap') {
    if (mode.fitnessModelVersion !== BOOTSTRAP_FITNESS_MODEL_VERSION || mode.artifactHash !== null) {
      throw new Error('Bootstrap runtime mode must use the canonical bootstrap FitnessModel and no artifact hash');
    }
    return mode;
  }
  if (!mode.fitnessModelVersion.trim() || !mode.artifactHash.trim()) {
    throw new Error('Pinned learned runtime mode requires exact model version and artifact hash');
  }
  return mode;
}
