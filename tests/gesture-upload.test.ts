// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import {
  GestureCaptureUploader,
  computeProfileHash,
  computeFeaturesHash,
} from '../src/vr/input/GestureCaptureUploader.ts';

describe('Global Capture Pipeline & Privacy-Preserving Upload (Sprint 23.3)', () => {
  it('strictly rejects queuing when consent is not granted', () => {
    const uploader = new GestureCaptureUploader({
      consent: false,
    });

    const features = new Float32Array(56).fill(0.5);
    const queued = uploader.queueTierA(features, 'pinchTogether', true);
    expect(queued).toBe(false);
    expect(uploader.queueSize().tierA).toBe(0);
  });

  it('queues Tier A feature rows when consent is enabled', () => {
    const uploader = new GestureCaptureUploader({
      consent: true,
      consentToken: 'user-token-123',
      deviceSalt: 'quest3-salt-abc',
    });

    const features = new Float32Array(56).fill(0.123);
    const queued = uploader.queueTierA(features, 'scoopUp', true, 'v1.0.0');
    expect(queued).toBe(true);
    expect(uploader.queueSize().tierA).toBe(1);

    // Dedup prevents duplicate submissions of identical features
    const duplicate = uploader.queueTierA(features, 'scoopUp', true, 'v1.0.0');
    expect(duplicate).toBe(false);
    expect(uploader.queueSize().tierA).toBe(1);
  });

  it('requires explicit Tier B consent for raw trajectory upload', () => {
    const uploader = new GestureCaptureUploader({
      consent: true,
      rawTrajectoryConsent: false,
    });

    const rawPoints = [{ x: 0, y: 1, z: 0, pinched: false, t: 100 }];
    const queued = uploader.queueTierB(rawPoints, rawPoints, 'pinchApart');
    expect(queued).toBe(false);
    expect(uploader.queueSize().tierB).toBe(0);

    uploader.setRawTrajectoryConsent(true);
    const queuedWithConsent = uploader.queueTierB(rawPoints, rawPoints, 'pinchApart');
    expect(queuedWithConsent).toBe(true);
    expect(uploader.queueSize().tierB).toBe(1);
  });

  it('flushes batches via HTTP POST with requeuing on network failure', async () => {
    let callCount = 0;
    const fetchMock = vi.fn().mockImplementation(async () => {
      callCount += 1;
      if (callCount === 1) {
        return { ok: false, status: 500 };
      }
      return { ok: true, status: 200 };
    });

    const uploader = new GestureCaptureUploader({
      consent: true,
      fetchFn: fetchMock,
      batchSize: 5,
    });

    for (let i = 0; i < 3; i++) {
      uploader.queueTierA([i, i + 1], 'bothPinched', true);
    }
    expect(uploader.queueSize().tierA).toBe(3);

    // First attempt fails -> requeues
    const failResult = await uploader.flush();
    expect(failResult.success).toBe(false);
    expect(uploader.queueSize().tierA).toBe(3);

    // Second attempt succeeds
    const successResult = await uploader.flush();
    expect(successResult.success).toBe(true);
    expect(successResult.uploadedTierA).toBe(3);
    expect(uploader.queueSize().tierA).toBe(0);
  });

  it('computes stable pseudonymous hashes and sends deletion request', async () => {
    const hash1 = computeProfileHash('token-a', 'salt-b');
    const hash2 = computeProfileHash('token-a', 'salt-b');
    expect(hash1).toBe(hash2);
    const featHash1 = computeFeaturesHash([1, 2, 3]);
    const featHash2 = computeFeaturesHash([1, 2, 3]);
    expect(featHash1).toBe(featHash2);

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const uploader = new GestureCaptureUploader({
      consent: true,
      fetchFn: fetchMock,
    });

    const deleted = await uploader.requestDeletion();
    expect(deleted).toBe(true);
    expect(fetchMock).toHaveBeenCalled();
  });
});
