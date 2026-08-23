import {
  structureProfileToDatasetEvidence,
  type DatasetEvidence,
  type RustDatasetStructureProfile,
} from '../data/evidence/index.ts';

/** Narrow kernel contract for the Moneta evidence composition boundary. */
export interface DatasetStructureProfileKernel {
  computeDatasetStructureProfile(handle: number): RustDatasetStructureProfile | null;
  datasetFingerprint?(handle: number): string | null;
}

/**
 * Convert the Rust-owned structure profile for an existing dataset handle into
 * canonical DatasetEvidence. This boundary does no analytical recomputation.
 */
export function datasetEvidenceFromKernelProfile(
  kernel: DatasetStructureProfileKernel,
  handle: number,
): DatasetEvidence {
  if (!Number.isInteger(handle) || handle <= 0) {
    throw new Error('[AtlasCore] DatasetEvidence requires a valid Rust dataset handle');
  }

  const profile = kernel.computeDatasetStructureProfile(handle);
  if (!profile) {
    throw new Error('[AtlasCore] Rust DatasetStructureProfile unavailable for current dataset');
  }

  const evidence = structureProfileToDatasetEvidence(profile);
  const kernelFingerprint = kernel.datasetFingerprint?.(handle) ?? null;
  if (kernelFingerprint && kernelFingerprint !== evidence.datasetFingerprint) {
    throw new Error(
      '[AtlasCore] DatasetStructureProfile fingerprint drift: ' +
        `profile=${evidence.datasetFingerprint}, kernel=${kernelFingerprint}`,
    );
  }

  return evidence;
}
