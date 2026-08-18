// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { GestureModelStore } from '../src/ai/GestureModelStore.ts';
import { GestureTrainingWorker } from '../src/ai/GestureTrainingWorker.ts';

describe('Sprint 10.3: Gesture AI Model Training & Weight Persistence', () => {
  describe('GestureModelStore', () => {
    let store: GestureModelStore;

    beforeEach(() => {
      store = new GestureModelStore('test_db', 'test_store');
    });

    it('instantiates correctly with database names', () => {
      expect(store).toBeDefined();
      expect(store.dbName).toBe('test_db');
      expect(store.storeName).toBe('test_store');
    });

    it('handles loadWeights fallback when IndexedDB is not available or empty', async () => {
      const weights = await store.loadWeights('test_key');
      expect(weights === null || typeof weights === 'object').toBe(true);
    });
  });

  describe('GestureTrainingWorker', () => {
    let worker: GestureTrainingWorker;

    beforeEach(() => {
      worker = new GestureTrainingWorker(10);
    });

    it('adds trajectory telemetry training samples to buffer', () => {
      expect(worker.sampleCount).toBe(0);
      worker.addSample({
        trajectory: [0, 1, 2, 3],
        label: 'pinchTogether',
        confirmed: true,
        timestamp: Date.now(),
      });
      expect(worker.sampleCount).toBe(1);
    });

    it('executes background micro-epoch training pass over samples', async () => {
      for (let i = 0; i < 6; i++) {
        worker.addSample({
          trajectory: [i, i + 1, i + 2],
          label: 'pinchTogether',
          confirmed: i % 2 === 0,
          timestamp: Date.now() + i * 100,
        });
      }

      const res = await worker.runTrainingPass(0.01, 3);
      expect(res.epochsCompleted).toBe(3);
      expect(res.samplesProcessed).toBe(6);
      expect(res.finalLoss).toBeLessThan(0.5);
    });

    it('clears training sample buffer cleanly', () => {
      worker.addSample({
        trajectory: [1, 2],
        label: 'scoopUp',
        confirmed: true,
        timestamp: Date.now(),
      });
      expect(worker.sampleCount).toBe(1);
      worker.resetBuffer();
      expect(worker.sampleCount).toBe(0);
    });
  });
});
