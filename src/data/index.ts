/**
 * Data Subsystem — production barrel export.
 */

export { Dataset, ColumnType } from './Dataset.ts';
export type { ColumnTypeKey, ColumnTypeValue, DatasetEdge, DatasetMeta } from './Dataset.ts';
export {
  CANONICAL_DATASET_IDENTITY_ALGORITHM,
  canonicalDatasetIdentityHex,
  canonicalDatasetIdentityInput,
} from './DatasetIdentity.ts';
export type { CanonicalDatasetIdentityInput } from './DatasetIdentity.ts';

export { AnalysisHistory } from './AnalysisHistory.ts';
export type {
  HistoryFrame,
  HistoryFrameJSON,
  HistorySnapshot,
  HistoryEntry,
} from './AnalysisHistory.ts';

export {
  ImportError,
  ImportWarning,
  ImportErrorCode,
  validateImport,
  formatValidationResult,
} from './ImportError.ts';

export { allSampleDatasets } from './SampleDatasets.ts';
export {
  makeSalesTable,
  makeOrgChart,
  makeWindField,
  makeSocialGraph,
  makeFinancialSeries,
  makeGeoCities,
  makeFlowProcess,
} from './SyntheticData.ts';

export { categoricalColor, numericColor, normalize } from './Encodings.ts';
export { PositionSemanticClassifier } from './PositionSemanticClassifier.ts';

export type {
  ColumnSchema,
  DatasetJSON,
  ColumnStats,
  CorrelationPair,
  CategoricalStats,
  TemporalStats,
  Facts,
  Provenance,
  OperationSpec,
  FilterSpec,
  AggregateSpec,
} from './types.ts';
