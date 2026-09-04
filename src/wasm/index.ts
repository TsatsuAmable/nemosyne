/**
 * WASM Subsystem — production barrel export.
 *
 * Experimental scene-command-buffer code intentionally stays out of this
 * surface until headset evidence warrants CAP_SCENE_RUST/CAP_COMMAND_BUFFER.
 */

export { CapabilityFlags } from './capabilities.ts';
export type { CapabilityName } from './capabilities.ts';

export {
  KernelUnavailableError,
  KernelAbiError,
  isKernelFatalError,
  getKernelState,
  getKernelUnavailableReason,
  invalidateRuntime,
  requireRuntime,
  initRuntime,
  isReady,
  capabilities,
  kernelVersion,
  kernelProvenance,
  destroyDataset,
  loadDatasetJson,
  loadTypedColumns,
  runOperation,
  statistics,
  datasetFingerprint,
  inferSchema,
  inferTopology,
  inferEncodings,
  computeMapperGraph,
  computePersistenceIntervals,
  computeBetti0Curve,
  computeRadialTree3d,
  computeGrid3d,
  computeForceDirected3d,
  computeTimeRibbon3d,
  computeGeoSurface3d,
  computeStreamline3d,
} from './RuntimeBridge.ts';

export {
  datasetRowCount,
  datasetColumnCount,
  rowMaterialisationCount,
  getDatasetJson,
  parseDatasetBytes,
  executeOperation,
} from './ColumnarBoundary.ts';

export type { KernelState } from './RuntimeBridge.ts';

export { encodeTypedColumnsPayload } from './TypedColumnsCodec.ts';
export type {
  TypedDatasetInput,
  ColumnInput,
  NumericColumnInput,
  CategoricalColumnInput,
} from './TypedColumnsCodec.ts';
