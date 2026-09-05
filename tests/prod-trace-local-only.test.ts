import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { setupDevTraceRecorder } from '../src/app/devTrace.ts';

describe('production UX trace transport boundary', () => {
  it('keeps enabled production traces local even when a network transport is supplied', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200 }));
    const engine = {
      camera: new THREE.PerspectiveCamera(),
      addUpdatable: vi.fn(),
      removeUpdatable: vi.fn(),
      input: { hands: [], panels: [], interactables: [] },
    };

    const recorder = setupDevTraceRecorder(
      {
        recorderOptions: {
          engine,
          enabled: true,
          flushMs: 10,
          endpoint: '/__ux-trace',
          fetchImpl,
        },
        bind: vi.fn(),
      },
      { allowNetworkFlush: false }
    );

    recorder.recordSessionManifest({
      buildHash: 'prod-build',
      datasetFingerprint: 'dataset-fp',
    });
    await recorder.flush();

    expect(fetchImpl).not.toHaveBeenCalled();
    const exported = JSON.parse(recorder.exportJson());
    expect(exported.recordCount).toBeGreaterThan(0);
    expect(
      exported.records.some((record: { type: string }) => record.type === 'session-manifest')
    ).toBe(true);
  });
});
