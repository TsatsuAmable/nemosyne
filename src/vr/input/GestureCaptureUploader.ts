/**
 * Privacy-preserving gesture capture upload pipeline (Sprint 23.3).
 *
 * Implements strict opt-in consent gating, on-device feature extraction
 * (Tier A, no raw biometric telemetry), pseudonymous profile hashing,
 * bounded batching, and deduplication.
 */

import type { GestureClass } from '../../../modules/gesture-intelligence/src/contracts.ts';

export interface TierARecord {
  readonly features: readonly number[];
  readonly label: GestureClass;
  readonly confirmed: boolean;
  readonly modelVersion: string | null;
  readonly profileHash: string;
  readonly timestamp: number;
}

export interface TierBRecord {
  readonly left: readonly { x: number; y: number; z: number; pinched: boolean; t: number }[];
  readonly right: readonly { x: number; y: number; z: number; pinched: boolean; t: number }[];
  readonly label: GestureClass;
  readonly modelVersion: string | null;
  readonly profileHash: string;
  readonly timestamp: number;
}

export interface UploaderOptions {
  readonly endpoint?: string;
  readonly consent?: boolean;
  readonly rawTrajectoryConsent?: boolean;
  readonly consentToken?: string;
  readonly deviceSalt?: string;
  readonly maxQueueSize?: number;
  readonly batchSize?: number;
  readonly fetchFn?: typeof fetch;
}

function fnv1aHex(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function computeProfileHash(consentToken: string, deviceSalt: string): string {
  return fnv1aHex(`${consentToken}:${deviceSalt}`);
}

export function computeFeaturesHash(features: readonly number[]): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < features.length; i++) {
    const v = Math.round(features[i] * 10000);
    hash ^= v;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export class GestureCaptureUploader {
  private _endpoint: string;
  private _consent: boolean;
  private _rawTrajectoryConsent: boolean;
  private _profileHash: string;
  private _maxQueueSize: number;
  private _batchSize: number;
  private _fetch: typeof fetch;

  private _tierAQueue: TierARecord[] = [];
  private _tierBQueue: TierBRecord[] = [];
  private _seenKeys = new Set<string>();

  constructor(options: UploaderOptions = {}) {
    this._endpoint = options.endpoint ?? '/api/gesture-ingest';
    this._consent = options.consent ?? false;
    this._rawTrajectoryConsent = options.rawTrajectoryConsent ?? false;
    this._profileHash = computeProfileHash(
      options.consentToken ?? 'anonymous',
      options.deviceSalt ?? 'device-0'
    );
    this._maxQueueSize = options.maxQueueSize ?? 100;
    this._batchSize = options.batchSize ?? 10;
    this._fetch = options.fetchFn ?? (typeof fetch !== 'undefined' ? fetch : (() => Promise.reject(new Error('No fetch'))));
  }

  get consent(): boolean {
    return this._consent;
  }

  setConsent(enabled: boolean): void {
    this._consent = enabled;
    if (!enabled) {
      this.clear();
    }
  }

  get rawTrajectoryConsent(): boolean {
    return this._rawTrajectoryConsent;
  }

  setRawTrajectoryConsent(enabled: boolean): void {
    this._rawTrajectoryConsent = enabled;
    if (!enabled) {
      this._tierBQueue = [];
    }
  }

  get profileHash(): string {
    return this._profileHash;
  }

  queueSize(): { tierA: number; tierB: number } {
    return {
      tierA: this._tierAQueue.length,
      tierB: this._tierBQueue.length,
    };
  }

  queueTierA(
    features: Float32Array | readonly number[],
    label: GestureClass,
    confirmed: boolean,
    modelVersion: string | null = null,
    timestamp: number = Date.now()
  ): boolean {
    if (!this._consent) return false;

    const featArr = Array.from(features);
    const featHash = computeFeaturesHash(featArr);
    const dedupKey = `${this._profileHash}:${featHash}:${modelVersion ?? 'none'}`;

    if (this._seenKeys.has(dedupKey)) return false;
    this._seenKeys.add(dedupKey);

    if (this._tierAQueue.length >= this._maxQueueSize) {
      this._tierAQueue.shift();
    }

    this._tierAQueue.push({
      features: featArr,
      label,
      confirmed,
      modelVersion,
      profileHash: this._profileHash,
      timestamp,
    });

    return true;
  }

  queueTierB(
    left: readonly { x: number; y: number; z: number; pinched: boolean; t: number }[],
    right: readonly { x: number; y: number; z: number; pinched: boolean; t: number }[],
    label: GestureClass,
    modelVersion: string | null = null,
    timestamp: number = Date.now()
  ): boolean {
    if (!this._consent || !this._rawTrajectoryConsent) return false;

    if (this._tierBQueue.length >= this._maxQueueSize) {
      this._tierBQueue.shift();
    }

    this._tierBQueue.push({
      left,
      right,
      label,
      modelVersion,
      profileHash: this._profileHash,
      timestamp,
    });

    return true;
  }

  async flush(): Promise<{ uploadedTierA: number; uploadedTierB: number; success: boolean }> {
    if (!this._consent) {
      return { uploadedTierA: 0, uploadedTierB: 0, success: true };
    }

    const batchA = this._tierAQueue.splice(0, this._batchSize);
    const batchB = this._tierBQueue.splice(0, this._batchSize);

    if (batchA.length === 0 && batchB.length === 0) {
      return { uploadedTierA: 0, uploadedTierB: 0, success: true };
    }

    try {
      const payload = {
        profileHash: this._profileHash,
        tierA: batchA,
        tierB: batchB,
      };

      const res = await this._fetch(this._endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        // Requeue on failure
        this._tierAQueue.unshift(...batchA);
        this._tierBQueue.unshift(...batchB);
        return { uploadedTierA: 0, uploadedTierB: 0, success: false };
      }

      return {
        uploadedTierA: batchA.length,
        uploadedTierB: batchB.length,
        success: true,
      };
    } catch {
      this._tierAQueue.unshift(...batchA);
      this._tierBQueue.unshift(...batchB);
      return { uploadedTierA: 0, uploadedTierB: 0, success: false };
    }
  }

  async requestDeletion(): Promise<boolean> {
    try {
      const res = await this._fetch(`${this._endpoint}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileHash: this._profileHash }),
      });
      this.clear();
      return res.ok;
    } catch {
      return false;
    }
  }

  clear(): void {
    this._tierAQueue = [];
    this._tierBQueue = [];
    this._seenKeys.clear();
  }
}
