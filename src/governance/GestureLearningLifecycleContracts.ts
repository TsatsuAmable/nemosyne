import {
  DERIVED_GESTURE_OBSERVATION_FAMILY_ID,
  RAW_GESTURE_TRAJECTORY_FAMILY_ID,
} from './GestureLearningFamilies.ts';
import {
  GOVERNED_PURPOSES,
  type AuthorizationEvidenceV1,
} from './GovernedEventContracts.ts';

export type GestureLearningPurposeV1 =
  | typeof GOVERNED_PURPOSES.DERIVED_GESTURE_LEARNING
  | typeof GOVERNED_PURPOSES.RAW_TRAJECTORY_RESEARCH;

export type GestureLearningFamilyIdV1 =
  | typeof DERIVED_GESTURE_OBSERVATION_FAMILY_ID
  | typeof RAW_GESTURE_TRAJECTORY_FAMILY_ID;

export interface GestureLearningCaptureAuthorizationRequestV1 {
  readonly schemaVersion: '1';
  readonly familyId: GestureLearningFamilyIdV1;
  readonly eventId: string;
  readonly producerInstanceId: string;
  readonly streamId: string;
  readonly streamSequence: number;
  readonly protocolEvidence: AuthorizationEvidenceV1 | null;
}

export interface GestureLearningCaptureAuthorizationV1 {
  readonly schemaVersion: '1';
  readonly authorizationId: string;
  readonly purpose: GestureLearningPurposeV1;
  readonly familyId: GestureLearningFamilyIdV1;
  readonly eventId: string;
  readonly producerInstanceId: string;
  readonly streamId: string;
  readonly streamSequence: number;
  readonly receipt: AuthorizationEvidenceV1;
  readonly protocolEvidence: AuthorizationEvidenceV1 | null;
  readonly profilePseudonymId: string;
  readonly authorizedAt: string;
  readonly expiresAt: string;
}

export type GestureLearningEventDispositionStatusV1 =
  | 'STORED'
  | 'EXACT_DUPLICATE'
  | 'REFUSED_GOVERNANCE'
  | 'EVENT_ID_CONFLICT'
  | 'STREAM_OWNERSHIP_CONFLICT'
  | 'SEQUENCE_CONFLICT'
  | 'GAP_REFUSED'
  | 'STORAGE_FAILURE';

export interface GestureLearningEventDispositionV1 {
  readonly eventId: string | null;
  readonly status: GestureLearningEventDispositionStatusV1;
  readonly reasonCode: string | null;
}
