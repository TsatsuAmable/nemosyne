export const NEMOSYNE_EXPERIMENT_SPECIMEN_PROTOCOL_VERSION = '1' as const;

export type NemosyneExperimentCapability =
  | 'semantic-embodiment-graph-v1'
  | 'spatial-embodiment-plan-v1';

export interface SpecimenCapabilityContractV1 {
  protocolVersion: typeof NEMOSYNE_EXPERIMENT_SPECIMEN_PROTOCOL_VERSION;
  capabilities: readonly NemosyneExperimentCapability[];
}

export type NemosyneExperimentSpecimenCapabilities = SpecimenCapabilityContractV1;

export const NEMOSYNE_EXPERIMENT_SPECIMEN_CAPABILITIES: SpecimenCapabilityContractV1 = {
  protocolVersion: NEMOSYNE_EXPERIMENT_SPECIMEN_PROTOCOL_VERSION,
  capabilities: ['semantic-embodiment-graph-v1', 'spatial-embodiment-plan-v1'],
};
