/**
 * WASM Subsystem — Barrel Export
 */

export { CapabilityFlags } from './capabilities.ts';
export type { CapabilityName } from './capabilities.ts';

export {
  KernelUnavailableError,
  getKernelState,
  getKernelUnavailableReason,
  requireRuntime,
  initRuntime,
  isReady,
  capabilities,
  kernelVersion,
  kernelProvenance,
  datasetRowCount,
  datasetColumnCount,
  destroyDataset,
  loadDatasetJson,
  getDatasetJson,
  parseDatasetBytes,
  runOperation,
  executeOperation,
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

export type { KernelState } from './RuntimeBridge.ts';

export { CommandApplier, COMMAND_MAGIC, COMMAND_VERSION } from './CommandApplier.ts';
export type { ParsedCommand } from './CommandApplier.ts';
