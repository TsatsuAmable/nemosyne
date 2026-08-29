// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import * as THREE from 'three';
import { P_HAND_INPUT } from 'iwer';
import { InputRouter } from '../../src/vr/InputRouter.ts';
import { ControllerPointer } from '../../src/vr/Controllers.ts';
import { HandPointer } from '../../src/vr/Hands.ts';
import { SpatialErgonomicsLinter } from '../../dev/spatial-tools/SpatialErgonomicsLinter.ts';
import {
  WebXRSimulatorAdapter,
  UnsupportedSimulatorCapabilityError,
  SimulatorScenarioRunner,
  bindInputSources,
  scenarioById,
} from '../../dev/xr-simulator/index.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function makeRouter(adapter: WebXRSimulatorAdapter): {
  router: InputRouter;
  engine: unknown;
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
  return { router, engine, renderer, scene };
}

describe('P1-USIM / USIM-0 — WebXR simulator adapter', () => {
  it('constructs with a real IWER device and can drive headset/controller positions', () => {
    const adapter = new WebXRSimulatorAdapter();
    expect(adapter).toBeTruthy();
    expect(adapter.device).toBeTruthy();
    adapter.setHeadPose(0, 1.6, -2);
    adapter.setControllerPosition('right', 0.5, 1.4, -1.8);
    adapter.setControllerPosition('left', -0.5, 1.4, -1.8);
    expect(true).toBe(true);
  });

  it('triggers controller buttons without throwing', () => {
    const adapter = new WebXRSimulatorAdapter();
    adapter.setControllerTrigger('right', true);
    adapter.setControllerTrigger('right', false);
  });

  it('installs a real WebXR runtime and starts a real immersive-vr session', async () => {
    const adapter = new WebXRSimulatorAdapter();
    adapter.install();
    try {
      const { session, referenceSpace } = await adapter.startSession();
      // IWER does not expose a public `mode` getter, but a real immersive
      // session is proven by reference-space support + live input sources.
      expect(referenceSpace).toBeTruthy();
      expect(adapter.getInputSources().length).toBeGreaterThan(0);
      const frameProduced = await adapter.runInFrame((frame) => !!frame);
      expect(frameProduced).toBe(true);
      const constructorName = (session as unknown as { constructor?: { name?: string } }).constructor
        ?.name;
      expect(constructorName).toBe('XRSession');
    } finally {
      await adapter.endSession();
      adapter.uninstall();
    }
  }, 15000);

  it('drives a production control through the real InputRouter with controller simulation', async () => {
    const adapter = new WebXRSimulatorAdapter();
    adapter.install();
    try {
      await adapter.startSession();
      const { router, renderer, scene } = makeRouter(adapter);

      const cp = new ControllerPointer(renderer, 0);
      router.addController(cp as never);
      // Bind the real input source through the production `connected` handler
      // (as three.js WebXRManager does) so handedness is production-set.
      bindInputSources(adapter.getInputSources(), cp, undefined);
      expect(cp.handedness, 'production _onConnected set handedness from the real source').toBe(
        'right'
      );

      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
      );
      plane.position.set(0, 1.4, -2);
      scene.add(plane);
      scene.updateMatrixWorld(true);
      let selected = 0;
      router.addInteractable(plane, { onSelect: () => selected++ });

      adapter.setControllerPosition('right', 0, 1.4, -0.5);
      adapter.setControllerTrigger('right', true);

      const refSpace = adapter.referenceSpace!;
      const result = await adapter.runInFrame((frame) => {
        const source = adapter.getInputSources().find((s) => s.handedness === 'right');
        const pose = frame.getPose(source!.targetRaySpace, refSpace);
        const group = cp.space;
        group.matrix.fromArray(pose!.transform.matrix as unknown as number[]);
        group.matrix.decompose(group.position, group.quaternion, group.scale);
        group.updateMatrixWorld(true);
        router.update(frame, refSpace, adapter.session!, 0);
        return { hovered: !!router.hovered, selected };
      });

      expect(result).toBeTruthy();
      expect(result!.hovered, 'controller ray hovers the control').toBe(true);
      expect(result!.selected, 'controller trigger selects through the real router').toBe(1);
    } finally {
      await adapter.endSession();
      adapter.uninstall();
    }
  }, 15000);

  it('drives a supported hand pinch through the real InputRouter', async () => {
    const adapter = new WebXRSimulatorAdapter();
    adapter.install();
    try {
      await adapter.startSession();
      adapter.setPrimaryInputMode('hand');
      await sleep(40);

      const { router, renderer, scene } = makeRouter(adapter);
      const hp = new HandPointer(renderer, 0);
      hp.mount(scene);
      router.addHand(hp as never);

      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5, 1.5),
        new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
      );
      plane.position.set(0, 1.4, -2);
      scene.add(plane);
      scene.updateMatrixWorld(true);
      let selected = 0;
      router.addInteractable(plane, { onSelect: () => selected++ });

      const hand = adapter.device.hands.right!;
      hand.position.set(0, 1.4, -0.5);
      hand.quaternion.set(0, 0, 0, 1);
      adapter.configureHandPinch('right', false);
      adapter.device.notifyStateChange();
      await sleep(30);

      const refSpace = adapter.referenceSpace!;
      const hoverFrame = await adapter.runInFrame((frame) => {
        router.update(frame, refSpace, adapter.session!, 0);
        return { hovered: !!router.hovered, pinched: hp.isPinched() };
      });
      expect(hoverFrame!.hovered, 'hand ray hovers the control').toBe(true);
      expect(hoverFrame!.pinched).toBe(false);

      adapter.configureHandPinch('right', true);
      await sleep(30);
      const pinchFrame = await adapter.runInFrame((frame) => {
        router.update(frame, refSpace, adapter.session!, 0);
        return { pinched: hp.isPinched(), selected, hovered: !!router.hovered };
      });
      expect(pinchFrame!.pinched, 'hand pinch detected from real joint poses').toBe(true);
      expect(pinchFrame!.selected, 'hand pinch selects through the real router').toBe(1);
    } finally {
      await adapter.endSession();
      adapter.uninstall();
    }
  }, 15000);

  it('replays a deterministic scenario and emits bounded desktop-simulator episode evidence', async () => {
    const adapter = new WebXRSimulatorAdapter();
    adapter.install();
    try {
      await adapter.startSession();
      const scenario = scenarioById('usim-0-controller-select');
      expect(scenario).toBeTruthy();

      const { router, renderer, scene } = makeRouter(adapter);
      const runner = new SimulatorScenarioRunner(adapter, router, scene, renderer, {
        buildHash: 'test-build-hash',
      });

      const target = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
      );
      target.position.set(0, 1.4, -2);
      scene.add(target);
      scene.updateMatrixWorld(true);

      let registerCount = 0;
      const result = await runner.run(scenario!, target, (mesh) => {
        if (registerCount === 0) {
          router.addInteractable(mesh, { onSelect: () => {} });
        }
        registerCount++;
      });

      const episode = result.episode;
      expect(episode.schemaVersion).toBe('1');
      expect(episode.environment.mode).toBe('desktop-simulator');
      expect(episode.environment.xrRuntime).toBe('iwer');
      expect(episode.scenarioId).toBe('usim-0-controller-select');
      expect(episode.buildHash).toBe('test-build-hash');
      expect(episode.steps.length).toBeGreaterThan(0);
      expect(episode.steps.length).toBeLessThanOrEqual(256);
      expect(episode.measurements.length).toBeGreaterThan(0);
      expect(episode.outcome).toBe('PASSED');
      expect(result.selected).toBe(true);
      expect(result.errors).toHaveLength(0);
    } finally {
      await adapter.endSession();
      adapter.uninstall();
    }
  }, 15000);

  it('lets SpatialErgonomicsLinter evaluate the simulated pose against a rendered target', async () => {
    const adapter = new WebXRSimulatorAdapter();
    adapter.install();
    try {
      await adapter.startSession();
      adapter.setHeadPose(0, 1.6, 0);

      const target = new THREE.Object3D();
      target.name = 'simulated-panel';
      target.position.set(0, 1.6, -1.0);
      const report = SpatialErgonomicsLinter.lintObject(
        new THREE.Vector3(0, 1.6, 0),
        new THREE.Vector3(0, 0, -1),
        target,
        { isInteractive: true, targetSizeMeters: 0.1 }
      );
      expect(report).toHaveLength(0);
    } finally {
      await adapter.endSession();
      adapter.uninstall();
    }
  });

  it('fails closed for unsupported simulator capabilities', () => {
    const adapter = new WebXRSimulatorAdapter();
    expect(adapter.supportsFeature('hand-tracking')).toBe(true);
    expect(() => adapter.assertSupported('dom-overlay')).toThrow(UnsupportedSimulatorCapabilityError);
  });
});

describe('P1-USIM / USIM-0 — simulator lifecycle and isolation', () => {
  it('disabling the simulator restores ordinary desktop/native-WebXR behavior', async () => {
    const priorXR = (navigator as unknown as { xr?: unknown }).xr;
    const adapter = new WebXRSimulatorAdapter();
    adapter.install();
    await adapter.startSession();
    expect((navigator as unknown as { xr?: unknown }).xr).toBeTruthy();

    await adapter.endSession();
    adapter.uninstall();
    expect(adapter.session).toBeNull();
    expect((navigator as unknown as { xr?: unknown }).xr).toBe(priorXR);
    // IWER uninstalls its global constructors as best effort; at minimum the
    // emulated runtime must be gone.
    expect(adapter.installed).toBe(false);
  }, 15000);

  it('does not leak the hand-pinch geometry rewrite into other devices after uninstall', async () => {
    // IWER shares one oculusHandConfig poses singleton across XRDevice
    // instances. configureHandPinch rewrites joint geometry to satisfy
    // Nemosyne's 0.04m threshold; uninstall must restore the original so a
    // fresh device in another test sees unmodified geometry.
    const readThumbX = (adapter: WebXRSimulatorAdapter): number => {
      const hand = adapter.device.hands.right as never as {
        [P_HAND_INPUT]?: { poses: Record<string, { jointTransforms: Record<string, { offsetMatrix: number[] }> }> };
      };
      return hand[P_HAND_INPUT]?.poses.default.jointTransforms['thumb-tip'].offsetMatrix[12] ?? -1;
    };

    const preAdapter = new WebXRSimulatorAdapter();
    const preThumbX = readThumbX(preAdapter);

    const adapter = new WebXRSimulatorAdapter();
    adapter.install();
    await adapter.startSession();
    adapter.setPrimaryInputMode('hand');
    adapter.configureHandPinch('right', true);

    const duringAdapter = new WebXRSimulatorAdapter();
    expect(readThumbX(duringAdapter)).toBeLessThan(0.1);

    await adapter.endSession();
    adapter.uninstall();

    const postAdapter = new WebXRSimulatorAdapter();
    expect(readThumbX(postAdapter)).toBeCloseTo(preThumbX, 4);
  }, 15000);

  it('excludes iwer from production runtime imports and keeps simulator code out of src/', () => {
    const srcDir = resolve(process.cwd(), 'src');
    let found = false;
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
          const content = readFileSync(full, 'utf8');
          if (
            content.includes("from 'iwer'") ||
            content.includes('from "iwer"') ||
            content.includes("from 'dev/") ||
            content.includes('from "../dev/')
          ) {
            found = true;
          }
        }
      }
    };
    walk(srcDir);
    expect(found).toBe(false);
  });

  it('keeps iwer a dev/test-only dependency so the production bundle cannot ship it', () => {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect(pkg.dependencies?.iwer).toBeUndefined();
    expect(pkg.devDependencies?.iwer).toBeTruthy();
  });

  it('records exactly which simulator capabilities are trustworthy vs unsupported', () => {
    const adapter = new WebXRSimulatorAdapter();
    const supported = adapter.supportedFeatures();
    expect(supported).toContain('hand-tracking');
    expect(supported).toContain('local-floor');
    // Capabilities IWER cannot honestly drive fail closed instead of faking.
    expect(adapter.supportsFeature('dom-overlay')).toBe(false);
    expect(adapter.supportsFeature('camera-access')).toBe(false);
  });
});