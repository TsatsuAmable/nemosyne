// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { InputRouter } from '../../src/vr/InputRouter.ts';
import { WebXRSimulatorAdapter, XRLifecycleScenarioRunner } from '../../dev/xr-simulator/index.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function makeRouter(adapter: WebXRSimulatorAdapter): {
  router: InputRouter;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
} {
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer();
  const engine = {
    renderer: { xr: { getSession: () => adapter.session } },
    camera: new THREE.PerspectiveCamera(75, 1, 0.05, 200),
    cameraGroup: new THREE.Group(),
  };
  const router = new InputRouter(engine as never);
  return { router, renderer, scene };
}

function makeTarget(): { mesh: THREE.Mesh; onSelect: () => void } {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
  );
  mesh.position.set(0, 1.4, -2);
  return { mesh, onSelect: () => {} };
}

describe('P1-USIM / USIM-A — XR lifecycle and async-race conformance', () => {
  it('injects a real session visibility change and input-source disconnect through IWER', async () => {
    const adapter = new WebXRSimulatorAdapter();
    adapter.install();
    try {
      await adapter.startSession();
      const session = adapter.session!;
      const visibilityEvents: string[] = [];
      session.addEventListener('visibilitychange', () => {
        visibilityEvents.push(adapter.sessionVisibilityState);
      });
      expect(adapter.getInputSources().length).toBeGreaterThan(0);

      adapter.setSessionVisibilityState('hidden');
      await adapter.runInFrame(() => 1);
      await sleep(20);
      expect(adapter.sessionVisibilityState).toBe('hidden');
      expect(adapter.getInputSources().length).toBe(0);
      expect(visibilityEvents).toContain('hidden');

      adapter.setSessionVisibilityState('visible');
      await adapter.runInFrame(() => 1);
      await sleep(20);
      expect(adapter.getInputSources().length).toBeGreaterThan(0);

      adapter.setInputSourceConnected('right', false);
      await adapter.runInFrame(() => 1);
      await sleep(20);
      const sources = adapter.getInputSources();
      expect(sources.some((s) => s.handedness === 'right')).toBe(false);
    } finally {
      await adapter.endSession();
      adapter.uninstall();
    }
  }, 20000);

  it('keeps the async-analysis generation guard authoritative across a session exit/re-enter race', async () => {
    const adapter = new WebXRSimulatorAdapter();
    adapter.install();
    try {
      await adapter.startSession();
      const { router, renderer, scene } = makeRouter(adapter);
      const runner = new XRLifecycleScenarioRunner(adapter, router, scene, renderer, {
        buildHash: 'test-build-hash',
      });
      const { mesh } = makeTarget();
      scene.add(mesh);
      scene.updateMatrixWorld(true);

      const result = await runner.run(mesh, () => {});

      expect(result.episode.schemaVersion).toBe('1');
      expect(result.episode.environment.mode).toBe('desktop-simulator');
      expect(result.episode.environment.xrRuntime).toBe('iwer');
      expect(result.episode.scenarioId).toBe('usim-a-lifecycle-async-race');
      expect(result.errors).toHaveLength(0);
      expect(result.episode.outcome).toBe('PASSED');

      // Exactly one committed analysis survives the exit/re-enter (no
      // duplicate, no discard) under the same dataset generation.
      expect(result.scheduler.completed).toBe(1);
      expect(result.scheduler.staleAfterCompute).toBe(0);
      expect(result.published).toBe(1);
      expect(result.committedAnalysisIds).toHaveLength(1);

      // A stale captured press is not replayed as a selection in the new
      // session, and a fresh press still works. `selectsBeforeExit` includes
      // the baseline press plus the held-press fired before the fault.
      expect(result.baselineSelects).toBe(1);
      expect(result.selectsBeforeExit).toBe(2);
      expect(result.selectsAfterReenterNoPress - result.selectsBeforeExit).toBe(0);
      expect(result.selectsAfterReenterFreshPress - result.selectsAfterReenterNoPress).toBe(1);
      expect(result.reenterBindsSources).toBe(true);
      expect(result.reenterRouterFunctional).toBe(true);
    } finally {
      await adapter.endSession();
      adapter.uninstall();
    }
  }, 20000);

  it('rejects an analysis that completes after the dataset generation advanced', async () => {
    const adapter = new WebXRSimulatorAdapter();
    adapter.install();
    try {
      await adapter.startSession();
      const { router, renderer, scene } = makeRouter(adapter);
      const runner = new XRLifecycleScenarioRunner(adapter, router, scene, renderer, {
        buildHash: 'test-build-hash',
      });
      const { mesh } = makeTarget();
      scene.add(mesh);

      const identityBefore = { ...runner.currentIdentity };
      const result = await runner.runStaleGenerationRace();

      expect(result.errors).toHaveLength(0);
      expect(result.episode.scenarioId).toBe('usim-a-lifecycle-stale-generation');
      expect(result.episode.outcome).toBe('PASSED');
      expect(result.published).toBe(0);
      expect(result.scheduler.completed).toBe(0);
      expect(result.scheduler.staleAfterCompute + result.scheduler.staleBeforeCompute).toBeGreaterThanOrEqual(1);
      // The generation truly advanced (not a no-op).
      expect(runner.currentIdentity.datasetVersion).toBe(identityBefore.datasetVersion + 1);
    } finally {
      await adapter.endSession();
      adapter.uninstall();
    }
  }, 20000);
});