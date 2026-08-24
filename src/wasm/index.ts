/**
 * WASM Subsystem — Barrel Export
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

export { CommandApplier, COMMAND_MAGIC, COMMAND_VERSION } from './CommandApplier.ts';
export type { ParsedCommand } from './CommandApplier.ts';
