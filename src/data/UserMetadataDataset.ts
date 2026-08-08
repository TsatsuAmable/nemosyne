/**
 * Living User Telemetry & Sentiment Dataset.
 *
 * Represents an analyst's interaction history, active focus columns,
 * gesture confidence metrics, and sentiment profile as a structured dataset.
 */

export interface UserProfileInfo {
  userId: string;
  userName: string;
  role: string;
  colorHex: number;
}

export interface UserTelemetryRecord {
  timestamp: number;
  activeColumn: string | null;
  dwellTimeMs: number;
  gestureConfidence: number;
  sentimentScore: number; // -1.0 (frustrated) to +1.0 (confident/engaged)
  headPosition: [number, number, number];
}

export class UserMetadataDataset {
  profile: UserProfileInfo;
  records: UserTelemetryRecord[];

  constructor(profile: UserProfileInfo) {
    this.profile = profile;
    this.records = [];
  }

  addRecord(record: UserTelemetryRecord): void {
    this.records.push(record);
    if (this.records.length > 500) {
      this.records.shift();
    }
  }

  getLatestRecord(): UserTelemetryRecord | null {
    return this.records.length > 0 ? this.records[this.records.length - 1] : null;
  }

  getPrimaryFocusColumn(): string | null {
    if (this.records.length === 0) return null;
    const counts = new Map<string, number>();
    for (const r of this.records) {
      if (r.activeColumn) {
        counts.set(r.activeColumn, (counts.get(r.activeColumn) || 0) + r.dwellTimeMs);
      }
    }
    let topCol: string | null = null;
    let maxTime = -1;
    for (const [col, time] of counts.entries()) {
      if (time > maxTime) {
        maxTime = time;
        topCol = col;
      }
    }
    return topCol;
  }

  getAverageSentiment(): number {
    if (this.records.length === 0) return 0.0;
    const sum = this.records.reduce((acc, r) => acc + r.sentimentScore, 0);
    return sum / this.records.length;
  }
}
