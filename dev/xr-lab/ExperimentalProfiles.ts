import { generic, metaQuest2, metaQuest3, metaQuestPro, type XRDeviceConfig } from 'iwer';

export type EvidenceTier = 'S0' | 'S1' | 'S2' | 'S3' | 'S4' | 'S5';
export type InputTopology = 'controller' | 'hand' | 'controller+hand' | 'transient-pointer';

export interface DeviceEnvelope {
  id: string;
  label: string;
  vendorFamily: 'meta' | 'generic-webxr' | 'apple-like' | 'constrained-standalone';
  evidenceTier: EvidenceTier;
  runtime: 'iwer' | 'native-browser' | 'vendor-simulator' | 'physical';
  inputTopologies: InputTopology[];
  refreshRatesHz: number[];
  nominalRefreshRateHz: number;
  /** Deliberately a test envelope, never a claim about physical hardware. */
  cpuBudgetScale: number;
  gpuBudgetScale: number;
  memoryBudgetMb: number | null;
  iwerConfig?: XRDeviceConfig;
  notes: string;
}

export interface FaultEnvelope {
  id: string;
  trackingPositionNoiseM: number;
  trackingAngularNoiseDeg: number;
  droppedPoseProbability: number;
  poseFreezeMs: number;
  workerLatencyMs: readonly [number, number];
  periodicFrameSpikeMs: number;
  frameSpikeEveryNFrames: number;
  inputDisconnectProbability: number;
}

export interface DatasetEnvelope {
  id: string;
  rows: number;
  semanticStructures: number;
  dimensions: number;
  topology: 'tabular' | 'time-series' | 'graph' | 'manifold' | 'mixed';
}

export interface ExperimentCell {
  id: string;
  device: DeviceEnvelope;
  fault: FaultEnvelope;
  dataset: DatasetEnvelope;
  repetition: number;
}

const cloneConfig = (config: XRDeviceConfig, name: string): XRDeviceConfig => ({ ...config, name });
const genericWebXRConfig: XRDeviceConfig = {
  ...metaQuest3,
  name: 'Nemosyne Generic WebXR',
  controllerConfig: generic,
  supportedFeatures: [
    'viewer',
    'local',
    'local-floor',
    'bounded-floor',
    'unbounded',
    'hand-tracking',
  ],
  supportedFrameRates: [72, 90],
  internalNominalFrameRate: 90,
  userAgent: 'Nemosyne-WebXR-Lab/1.0 GenericWebXR',
};

export const DEVICE_ENVELOPES: Record<string, DeviceEnvelope> = {
  'quest3-class': {
    id: 'quest3-class',
    label: 'Quest 3-class IWER',
    vendorFamily: 'meta',
    evidenceTier: 'S2',
    runtime: 'iwer',
    inputTopologies: ['controller', 'hand', 'controller+hand'],
    refreshRatesHz: [72, 80, 90, 120],
    nominalRefreshRateHz: 90,
    cpuBudgetScale: 1,
    gpuBudgetScale: 1,
    memoryBudgetMb: null,
    iwerConfig: cloneConfig(metaQuest3, 'Nemosyne Quest 3-class'),
    notes: 'API/device-profile simulation only; not physical Quest qualification.',
  },
  'quest2-class': {
    id: 'quest2-class',
    label: 'Quest 2-class IWER',
    vendorFamily: 'meta',
    evidenceTier: 'S2',
    runtime: 'iwer',
    inputTopologies: ['controller', 'hand'],
    refreshRatesHz: [72, 80, 90, 120],
    nominalRefreshRateHz: 72,
    cpuBudgetScale: 0.65,
    gpuBudgetScale: 0.55,
    memoryBudgetMb: null,
    iwerConfig: cloneConfig(metaQuest2, 'Nemosyne Quest 2-class'),
    notes:
      'Useful lower standalone envelope; budget scales are Nemosyne test knobs, not hardware measurements.',
  },
  'quest-pro-class': {
    id: 'quest-pro-class',
    label: 'Quest Pro-class IWER',
    vendorFamily: 'meta',
    evidenceTier: 'S2',
    runtime: 'iwer',
    inputTopologies: ['controller', 'hand'],
    refreshRatesHz: [72, 80, 90, 120],
    nominalRefreshRateHz: 90,
    cpuBudgetScale: 0.9,
    gpuBudgetScale: 0.8,
    memoryBudgetMb: null,
    iwerConfig: cloneConfig(metaQuestPro, 'Nemosyne Quest Pro-class'),
    notes: 'Independent Meta interaction/profile envelope.',
  },
  'generic-webxr': {
    id: 'generic-webxr',
    label: 'Generic WebXR 6DoF',
    vendorFamily: 'generic-webxr',
    evidenceTier: 'S1',
    runtime: 'iwer',
    inputTopologies: ['controller'],
    refreshRatesHz: [72, 90],
    nominalRefreshRateHz: 90,
    cpuBudgetScale: 1,
    gpuBudgetScale: 1,
    memoryBudgetMb: null,
    iwerConfig: genericWebXRConfig,
    notes: 'Vendor-neutral WebXR assumptions and fallback-profile coverage.',
  },
  'constrained-standalone': {
    id: 'constrained-standalone',
    label: 'Constrained standalone envelope',
    vendorFamily: 'constrained-standalone',
    evidenceTier: 'S3',
    runtime: 'iwer',
    inputTopologies: ['controller', 'hand'],
    refreshRatesHz: [72],
    nominalRefreshRateHz: 72,
    cpuBudgetScale: 0.5,
    gpuBudgetScale: 0.45,
    memoryBudgetMb: 1024,
    iwerConfig: cloneConfig(metaQuest2, 'Nemosyne Constrained Standalone'),
    notes:
      'Synthetic stress envelope intended to falsify assumptions below the current reference device.',
  },
  'transient-pointer-contract': {
    id: 'transient-pointer-contract',
    label: 'Transient-pointer contract',
    vendorFamily: 'apple-like',
    evidenceTier: 'S1',
    runtime: 'native-browser',
    inputTopologies: ['transient-pointer'],
    refreshRatesHz: [90, 96],
    nominalRefreshRateHz: 90,
    cpuBudgetScale: 1,
    gpuBudgetScale: 1,
    memoryBudgetMb: null,
    notes:
      'Contract profile for gaze/pinch style transient-pointer input. Requires Safari/visionOS execution to raise evidence tier.',
  },
};

export const FAULT_ENVELOPES: Record<string, FaultEnvelope> = {
  clean: {
    id: 'clean',
    trackingPositionNoiseM: 0,
    trackingAngularNoiseDeg: 0,
    droppedPoseProbability: 0,
    poseFreezeMs: 0,
    workerLatencyMs: [0, 0],
    periodicFrameSpikeMs: 0,
    frameSpikeEveryNFrames: 0,
    inputDisconnectProbability: 0,
  },
  noisy: {
    id: 'noisy',
    trackingPositionNoiseM: 0.005,
    trackingAngularNoiseDeg: 0.5,
    droppedPoseProbability: 0.01,
    poseFreezeMs: 100,
    workerLatencyMs: [5, 40],
    periodicFrameSpikeMs: 25,
    frameSpikeEveryNFrames: 180,
    inputDisconnectProbability: 0.002,
  },
  hostile: {
    id: 'hostile',
    trackingPositionNoiseM: 0.02,
    trackingAngularNoiseDeg: 2,
    droppedPoseProbability: 0.05,
    poseFreezeMs: 500,
    workerLatencyMs: [20, 150],
    periodicFrameSpikeMs: 50,
    frameSpikeEveryNFrames: 90,
    inputDisconnectProbability: 0.01,
  },
  'falsifier-input-loss': {
    id: 'falsifier-input-loss',
    trackingPositionNoiseM: 0,
    trackingAngularNoiseDeg: 0,
    droppedPoseProbability: 0,
    poseFreezeMs: 0,
    workerLatencyMs: [0, 0],
    periodicFrameSpikeMs: 0,
    frameSpikeEveryNFrames: 0,
    inputDisconnectProbability: 1,
  },
  'falsifier-frame-spike': {
    id: 'falsifier-frame-spike',
    trackingPositionNoiseM: 0,
    trackingAngularNoiseDeg: 0,
    droppedPoseProbability: 0,
    poseFreezeMs: 0,
    workerLatencyMs: [0, 0],
    periodicFrameSpikeMs: 50,
    frameSpikeEveryNFrames: 1,
    inputDisconnectProbability: 0,
  },
};

export const DATASET_ENVELOPES: Record<string, DatasetEnvelope> = {
  tiny: { id: 'tiny', rows: 100, semanticStructures: 8, dimensions: 4, topology: 'tabular' },
  'dense-low-structure': {
    id: 'dense-low-structure',
    rows: 1_000_000,
    semanticStructures: 8,
    dimensions: 12,
    topology: 'mixed',
  },
  'sparse-high-structure': {
    id: 'sparse-high-structure',
    rows: 10_000,
    semanticStructures: 600,
    dimensions: 24,
    topology: 'mixed',
  },
  'high-dimensional': {
    id: 'high-dimensional',
    rows: 100_000,
    semanticStructures: 40,
    dimensions: 256,
    topology: 'manifold',
  },
};

export function expandExperimentMatrix(input: {
  devices: string[];
  faults: string[];
  datasets: string[];
  repetitions: number;
}): ExperimentCell[] {
  if (!Number.isInteger(input.repetitions) || input.repetitions < 1)
    throw new Error('repetitions must be a positive integer');
  const cells: ExperimentCell[] = [];
  for (const deviceId of input.devices) {
    const device = DEVICE_ENVELOPES[deviceId];
    if (!device) throw new Error(`unknown device envelope: ${deviceId}`);
    for (const faultId of input.faults) {
      const fault = FAULT_ENVELOPES[faultId];
      if (!fault) throw new Error(`unknown fault envelope: ${faultId}`);
      for (const datasetId of input.datasets) {
        const dataset = DATASET_ENVELOPES[datasetId];
        if (!dataset) throw new Error(`unknown dataset envelope: ${datasetId}`);
        for (let repetition = 1; repetition <= input.repetitions; repetition++) {
          cells.push({
            id: `${deviceId}__${faultId}__${datasetId}__r${repetition}`,
            device,
            fault,
            dataset,
            repetition,
          });
        }
      }
    }
  }
  return cells;
}
