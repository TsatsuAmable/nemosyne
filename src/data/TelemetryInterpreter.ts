/**
 * Telemetry Interpreter Engine.
 *
 * Converts raw VR interaction telemetry, dwell vectors, and undo events into
 * structured UserTelemetryRecord entries for UserMetadataDataset.
 */

import { UserMetadataDataset, type UserTelemetryRecord } from './UserMetadataDataset.ts';

export interface RawInteractionEvent {
  eventType: 'hover' | 'select' | 'undo' | 'reset' | 'gesture';
  column?: string;
  dwellMs?: number;
  confidence?: number;
  headPos?: [number, number, number];
}

export class TelemetryInterpreter {
  userDataset: UserMetadataDataset;

  constructor(userDataset: UserMetadataDataset) {
    this.userDataset = userDataset;
  }

  processEvent(evt: RawInteractionEvent): UserTelemetryRecord {
    let sentimentScore = 0.5; // neutral-positive base

    if (evt.eventType === 'undo') {
      sentimentScore = -0.6; // Frustration / correction signal
    } else if (evt.eventType === 'select') {
      sentimentScore = 0.9; // Confident selection signal
    } else if (evt.eventType === 'reset') {
      sentimentScore = -0.3; // Workspace reset
    }

    const record: UserTelemetryRecord = {
      timestamp: Date.now(),
      activeColumn: evt.column || this.userDataset.getPrimaryFocusColumn(),
      dwellTimeMs: evt.dwellMs || 100,
      gestureConfidence: evt.confidence ?? 0.95,
      sentimentScore,
      headPosition: evt.headPos || [0, 1.6, 0],
    };

    this.userDataset.addRecord(record);
    return record;
  }
}
