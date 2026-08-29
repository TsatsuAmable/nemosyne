export interface SampleDatasetIdentity {
  key: string;
  label: string;
  dataset: { name?: string | null };
}

export interface ActiveDatasetIdentity {
  key?: string | null;
  name?: string | null;
  label?: string | null;
  datasetName?: string | null;
}

function matchesActiveDataset(
  sample: SampleDatasetIdentity,
  current: ActiveDatasetIdentity,
): boolean {
  if (current.key && sample.key === current.key) return true;

  const activeLabels = new Set(
    [current.name, current.label].filter((value): value is string => !!value),
  );
  if (activeLabels.has(sample.label)) return true;

  return !!current.datasetName && sample.dataset.name === current.datasetName;
}

/**
 * Resolve the legacy World sample-cycle cursor from the dataset that is
 * actually active. Some restore/load paths preserve the human-readable name
 * while omitting the sample key, so identity matching deliberately falls back
 * through label/name and the underlying dataset name.
 *
 * For a non-sample dataset, the sentinel cursor makes a forward cycle enter at
 * the first sample and a backward cycle enter at the last sample.
 */
export function resolveDatasetCycleCursor(
  samples: readonly SampleDatasetIdentity[],
  current: ActiveDatasetIdentity,
  step: number,
): number {
  const currentIndex = samples.findIndex((sample) => matchesActiveDataset(sample, current));
  if (currentIndex >= 0) return currentIndex;
  return step >= 0 ? -1 : 0;
}

export function nextDatasetCycleIndex(
  samples: readonly SampleDatasetIdentity[],
  current: ActiveDatasetIdentity,
  step: number,
): number {
  if (samples.length === 0) return -1;
  const cursor = resolveDatasetCycleCursor(samples, current, step);
  return ((cursor + step) % samples.length + samples.length) % samples.length;
}
