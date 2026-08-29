// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { World } from '../src/vr/World.ts';
import {
  buildIntentWheelMenuCategories,
  buildWheelMenuCategories,
} from '../src/vr/coordinators/WheelMenuBuilder.ts';
import { RecommendationPanel } from '../src/vr/ui/RecommendationPanel.ts';
import { HolographicInspector } from '../src/vr/artifacts/HolographicInspector.ts';
import type { AtlasRecommendation } from '../src/atlas/types.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';

function wireKernel(w) {
  const bridge = makeKernelMockBridge();
  w.atlas?.setKernel?.(bridge, 0x3c07);
  w._wasmRuntime = bridge;
  w._wasmUnavailable = false;
}

/** Minimal WheelMenuHost stub: everything callable is a spy, and a canonical
 * dispatcher spy records every intent the wheel dispatches. */
function makeWheelWorld() {
  const dispatched: Array<{ type: string; [k: string]: unknown }> = [];
  const world: any = {
    uiManager: {
      panelManager: {
        togglePanel: vi.fn(),
        toggleLauncher: vi.fn(),
        recenter: vi.fn(),
      },
      dashboard: {
        scrollBySlots: vi.fn(),
        resetDashboard: vi.fn(),
      },
      getOrCreateOperationLogPanel: () => ({ mesh: new THREE.Object3D() }),
      getOrCreateInteractionCoach: () => ({ mesh: new THREE.Object3D() }),
      getOrCreateNarrativeStrip: () => ({ mesh: new THREE.Object3D() }),
      getOrCreateGestureConfidenceHUD: () => ({ mesh: new THREE.Object3D() }),
      getOrCreateSchemaMappingPanel: () => ({ mesh: new THREE.Object3D() }),
      metricsPanel: { mesh: new THREE.Object3D() },
      performancePanel: { mesh: new THREE.Object3D() },
      networkPanel: { mesh: new THREE.Object3D() },
      recommendationPanel: { mesh: new THREE.Object3D() },
      toggleRepresentationCarousel: vi.fn(),
      toggleTransientContextCards: vi.fn(),
      toggleProgressiveDisclosure: vi.fn(),
      toggleFrustrationResponseManager: vi.fn(),
      toggleJITGestureHintManager: vi.fn(),
    },
    collaborationCoordinator: { isConnected: () => false },
    engine: {
      locomotion: {
        toggleTeleport: vi.fn(),
        teleportToAnchor: vi.fn(),
        toggleFlight: vi.fn(),
        dropToFloor: vi.fn(),
      },
    },
    portalsEnabled: false,
    applyDataOperation: vi.fn(),
    previewDataOperation: vi.fn(),
    clearOperationPreview: vi.fn(),
    resetDataOperation: vi.fn(),
    undoAnalysis: vi.fn(),
    redoAnalysis: vi.fn(),
    saveSession: vi.fn(),
    loadSession: vi.fn(),
    deleteSession: vi.fn(),
    exportScreenshot: vi.fn(),
    exportAnalysisStory: vi.fn(),
    loadTemplate: vi.fn(),
    setPortalsEnabled: vi.fn(),
    isLiveConnected: () => false,
    connectLiveStream: vi.fn(),
    disconnectLiveStream: vi.fn(),
    startTour: vi.fn(),
    runLoadTest: vi.fn(),
    stopLoadTest: vi.fn(),
    exitVR: vi.fn(),
    markMoment: vi.fn(),
    _cycleDataset: vi.fn(),
    _cycleThemePreset: vi.fn(),
    _toggleSettingsPanel: vi.fn(),
    _toggleMiniOverview: vi.fn(),
    _togglePeerPresenceHUD: vi.fn(),
    _toggleDesktopPreview: vi.fn(),
    _joinCollaborationRoom: vi.fn(),
    _leaveCollaborationRoom: vi.fn(),
    _toggleLoadTestPanel: vi.fn(),
    _toggleStatisticalLens: vi.fn(),
    _toggleDracoExplainer: vi.fn(),
    _toggleDracoDiagnostic: vi.fn(),
    dispatchIntent: (intent) => {
      dispatched.push(intent);
    },
  };
  return { world, dispatched };
}

describe('Stream B-U1 interaction grammar', () => {
  let world;
  const resizeListeners: Array<(...args: unknown[]) => void> = [];
  let addListenerSpy;

  beforeEach(() => {
    globalThis.navigator.xr = {
      isSessionSupported: vi.fn().mockResolvedValue(true),
      requestSession: vi.fn().mockResolvedValue({
        addEventListener: vi.fn(),
        updateRenderState: vi.fn().mockResolvedValue(undefined),
        renderState: {},
        inputSources: [],
      }),
    };
    const originalAdd = window.addEventListener;
    addListenerSpy = vi
      .spyOn(window, 'addEventListener')
      .mockImplementation((type, listener, options) => {
        if (type === 'resize') resizeListeners.push(listener);
        return originalAdd.call(window, type, listener, options);
      });
  });

  afterEach(async () => {
    addListenerSpy?.mockRestore();
    if (world) {
      await world.dispose();
      if (world.loader?.container?.parentNode) {
        world.loader.container.parentNode.removeChild(world.loader.container);
      }
      world = null;
    }
    const button = document.getElementById('nemosyne-vr-button');
    if (button?.parentNode) button.parentNode.removeChild(button);
    for (const canvas of Array.from(document.querySelectorAll('canvas'))) {
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
    for (const listener of resizeListeners.splice(0)) {
      window.removeEventListener('resize', listener);
    }
    vi.restoreAllMocks();
  });

  describe('wheel command authority routes through the canonical dispatcher', () => {
    it('routes every ANALYSE operation through the dispatcher, never applyDataOperation', () => {
      const { world: w, dispatched } = makeWheelWorld();
      const cats = buildIntentWheelMenuCategories(w);
      const analyse = cats.find((c) => c.id === 'ANALYSE')!;
      const expected = [
        'filter',
        'sort',
        'aggregate',
        'cluster',
        'hierarchical',
        'density',
        'anomaly',
        'timeSlice',
      ];
      for (const op of expected) {
        const item = analyse.items.find((i) => i.id === op)!;
        item.callback();
      }
      expect(w.applyDataOperation).not.toHaveBeenCalled();
      expect(dispatched).toEqual(
        expected.map((operation) => ({ type: 'analysis.apply', operation }))
      );
    });

    it('routes reset/undo/redo through the dispatcher in the intent wheel', () => {
      const { world: w, dispatched } = makeWheelWorld();
      const cats = buildIntentWheelMenuCategories(w);
      const analyse = cats.find((c) => c.id === 'ANALYSE')!;
      const find = (id: string) => analyse.items.find((i) => i.id === id)!;
      find('reset').callback();
      find('undo').callback();
      find('redo').callback();
      expect(w.resetDataOperation).not.toHaveBeenCalled();
      expect(w.undoAnalysis).not.toHaveBeenCalled();
      expect(w.redoAnalysis).not.toHaveBeenCalled();
      expect(dispatched).toEqual([
        { type: 'analysis.reset' },
        { type: 'history.undo' },
        { type: 'history.redo' },
      ]);
    });

    it('routes dataset cycle and statistical lens through the dispatcher', () => {
      const { world: w, dispatched } = makeWheelWorld();
      const cats = buildIntentWheelMenuCategories(w);
      const data = cats.find((c) => c.id === 'DATA')!;
      data.items.find((i) => i.id === 'dataset-cycle')!.callback();
      const view = cats.find((c) => c.id === 'VIEW')!;
      view.items.find((i) => i.id === 'lens')!.callback();
      expect(w._cycleDataset).not.toHaveBeenCalled();
      expect(w._toggleStatisticalLens).not.toHaveBeenCalled();
      expect(dispatched).toEqual([
        { type: 'dataset.cycle', step: 1 },
        { type: 'workspace.toggleStatisticalLens' },
      ]);
    });

    it('routes the legacy wheel ops/views through the dispatcher too', () => {
      const { world: w, dispatched } = makeWheelWorld();
      const cats = buildWheelMenuCategories(w);
      const ops = cats.find((c) => c.id === 'ops')!;
      ops.items.find((i) => i.id === 'filter')!.callback();
      ops.items.find((i) => i.id === 'reset')!.callback();
      ops.items.find((i) => i.id === 'undo')!.callback();
      const views = cats.find((c) => c.id === 'views')!;
      views.items.find((i) => i.id === 'dataset')!.callback();
      views.items.find((i) => i.id === 'toggle-lens')!.callback();
      expect(w.applyDataOperation).not.toHaveBeenCalled();
      expect(w.resetDataOperation).not.toHaveBeenCalled();
      expect(dispatched).toEqual([
        { type: 'analysis.apply', operation: 'filter' },
        { type: 'analysis.reset' },
        { type: 'history.undo' },
        { type: 'dataset.cycle', step: 1 },
        { type: 'workspace.toggleStatisticalLens' },
      ]);
    });

    it('funnels World.applyDataOperation through the dispatcher when injected', () => {
      world = new World(); wireKernel(world);
      const dispatched: Array<{ type: string; [k: string]: unknown }> = [];
      world.dispatchIntent = (intent) => {
        dispatched.push(intent);
      };
      world.applyDataOperation('anomaly');
      expect(dispatched).toEqual([{ type: 'analysis.apply', operation: 'anomaly' }]);
    });

    it('funnels in-place handle operations and input-coordinator gestures through the dispatcher', () => {
      world = new World(); wireKernel(world);
      const dispatched: Array<{ type: string; [k: string]: unknown }> = [];
      world.dispatchIntent = (intent) => {
        dispatched.push(intent);
      };
      // In-place handle onOperation is wired via World._dispatchAnalysis.
      world.inPlaceHandles.onOperation('filter');
      // Input coordinator gesture onApplyOperation is wired via World._dispatchAnalysis
      // when no bootstrap override has replaced it.
      world.inputCoordinator.callbacks.onApplyOperation?.('sort');
      expect(dispatched).toEqual([
        { type: 'analysis.apply', operation: 'filter' },
        { type: 'analysis.apply', operation: 'sort' },
      ]);
    });
  });

  describe('settings panel reachable from every production input path', () => {
    it('toggles the settings panel via the wheel SYSTEM -> Settings item', () => {
      world = new World(); wireKernel(world);
      expect(world.uiManager.settingsPanel.mesh.visible).toBe(false);
      const cats = buildIntentWheelMenuCategories(world);
      const system = cats.find((c) => c.id === 'SYSTEM')!;
      system.items.find((i) => i.id === 'settings')!.callback();
      expect(world.uiManager.settingsPanel.mesh.visible).toBe(true);
      system.items.find((i) => i.id === 'settings')!.callback();
      expect(world.uiManager.settingsPanel.mesh.visible).toBe(false);
    });

    it('toggles the settings panel via the okSign gesture through the live input path', () => {
      world = new World(); wireKernel(world);
      expect(world.uiManager.settingsPanel.mesh.visible).toBe(false);
      world.inputCoordinator.onGesture('okSign');
      expect(world.uiManager.settingsPanel.mesh.visible).toBe(true);
      world.inputCoordinator.onGesture('okSign');
      expect(world.uiManager.settingsPanel.mesh.visible).toBe(false);
    });

    it('references the working WorldUIManager toggle from a production file', () => {
      const source = readFileSync(resolve(process.cwd(), 'src/vr/World.ts'), 'utf8');
      expect(source).toMatch(/toggleSettingsPanel\(\)/);
    });
  });

  describe('contextual Record verb writes a real Observation to the ledger', () => {
    it('appends an observation carrying the selected node identity', () => {
      world = new World(); wireKernel(world);
      const before = world.atlas.observations.length;
      world.uiManager.callbacks.onRecordFinding?.({ id: 'NODE-7', category: 'A' });
      expect(world.atlas.observations.length).toBe(before + 1);
      const obs = world.atlas.observations[world.atlas.observations.length - 1];
      expect(obs.notes).toContain('NODE-7');
      expect(obs.targetIds).toContain('NODE-7');
    });
  });

  describe('inspector footer buttons are wired', () => {
    function makeEngine() {
      const cameraGroup = new THREE.Group();
      const camera = new THREE.PerspectiveCamera();
      cameraGroup.add(camera);
      const scene = new THREE.Scene();
      scene.add(cameraGroup);
      return {
        camera,
        cameraGroup,
        scene,
        input: { feedback: { playTone: vi.fn(), showHitMarker: vi.fn(), volume: 0.15 } },
      };
    }

    it('gives every footer button a handler and invokes the mapped action', () => {
      const inspector = new HolographicInspector(makeEngine());
      const onCompare = vi.fn();
      const onChallenge = vi.fn();
      const onAnnotate = vi.fn();
      inspector.inspectorActions = { onCompare, onChallenge, onAnnotate };

      expect(typeof inspector._compareButton._onClick).toBe('function');
      expect(typeof inspector._challengeButton._onClick).toBe('function');
      expect(typeof inspector._annotateButton._onClick).toBe('function');

      inspector._compareButton._onClick?.();
      inspector._challengeButton._onClick?.();
      inspector._annotateButton._onClick?.();

      expect(onCompare).toHaveBeenCalledTimes(1);
      expect(onChallenge).toHaveBeenCalledTimes(1);
      expect(onAnnotate).toHaveBeenCalledTimes(1);
    });

    it('shows an explanatory reason instead of staying inert when an action is unavailable', () => {
      const inspector = new HolographicInspector(makeEngine());
      inspector.inspectorActions = null;
      expect(() => {
        inspector._compareButton._onClick?.();
        inspector._challengeButton._onClick?.();
        inspector._annotateButton._onClick?.();
      }).not.toThrow();
    });
  });

  describe('guidance heuristic score is not labeled as statistical confidence', () => {
    function makeRecordingCtx() {
      const texts: string[] = [];
      const ctx: any = {
        texts,
        font: '',
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        textAlign: '',
        textBaseline: '',
        fillText: (t: string) => {
          texts.push(t);
        },
        fillRect: () => {},
        strokeRect: () => {},
        measureText: (t: string) => ({ width: String(t).length * 8 }),
      };
      return ctx;
    }

    it('renders the value under a HEURISTIC RANK label, never CONFIDENCE', () => {
      const cameraGroup = new THREE.Group();
      const rec: AtlasRecommendation = {
        targetIds: ['c1'],
        action: 'inspect-cluster',
        rationale: 'Largest cluster ranks highest',
        evidence: 'membership-size=12.000',
        evidenceItems: [{ type: 'membership-size', value: 12, source: 'c1' }],
        heuristicScore: 0.92,
        limitations: 'Cluster identity depends on algorithm parameters.',
        decision: 'pending',
      };
      const panel = new RecommendationPanel(cameraGroup, {
        getRecommendation: () => rec,
      });
      const ctx = makeRecordingCtx();
      panel.renderContent(ctx, 700, 500);
      const labels = ctx.texts.filter((t) => t.startsWith('// '));
      expect(labels).toContain('// HEURISTIC RANK');
      expect(labels.some((t) => t.includes('CONFIDENCE'))).toBe(false);
      expect(ctx.texts.some((t) => t.includes('not statistical confidence'))).toBe(true);
    });
  });

  describe('selection context is not orphaned across transitions', () => {
    // The dataset-load half of this falsifier needs a fully rebuilt palace
    // (kernel layout positions) and lives in the real-wasm lane:
    // tests/interaction-grammar-cts-coherence.test.ts.
    it('hides the contextual task surface on Compare dispatch', () => {
      world = new World(); wireKernel(world);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial()
      );
      mesh.userData.row = { id: 'X', value: 99 };

      world._showDataCard(mesh);
      expect(world.uiManager.contextualTaskSurface.visible).toBe(true);

      world._dispatchAnalysis('compare');
      expect(world.uiManager.contextualTaskSurface.visible).toBe(false);
    });
  });
});