// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { InteractionModeController } from '../src/vr/input/InteractionModeController.ts';
import { GestureOwnershipManager, CRITICAL_ACTIONS_REDUNDANCY } from '../src/vr/input/GestureOwnershipManager.ts';
import { StatusStripController } from '../src/vr/ui/StatusStripController.ts';
import { PanelRolesManager } from '../src/vr/ui/PanelRolesManager.ts';
import { ContextualTaskSurface } from '../src/vr/ui/ContextualTaskSurface.ts';
import { WorldInputCoordinator } from '../src/vr/coordinators/WorldInputCoordinator.ts';
import { WorldUIManager } from '../src/vr/coordinators/WorldUIManager.ts';
import { buildIntentWheelMenuCategories, buildWheelMenuCategories } from '../src/vr/coordinators/WheelMenuBuilder.ts';
import { WorldEventBus } from '../src/utils/EventBus.ts';

describe('VR UX Convergence, Spatial Intelligence & Interaction Engineering', () => {
  describe('1. InteractionModeController & Authoritative State Transitions', () => {
    it('initializes to INTERACT mode and transitions with history tracking', () => {
      const transitions: any[] = [];
      const controller = new InteractionModeController({
        initialMode: 'INTERACT',
        onModeChange: (evt) => transitions.push(evt),
      });

      expect(controller.currentMode).toBe('INTERACT');
      expect(controller.modeHistory.length).toBe(0);

      const changed = controller.setMode('NAVIGATE', 'spatial_reposition');
      expect(changed).toBe(true);
      expect(controller.currentMode).toBe('NAVIGATE');
      expect(controller.modeHistory).toEqual(['INTERACT']);
      expect(transitions.length).toBe(1);
      expect(transitions[0].from).toBe('INTERACT');
      expect(transitions[0].to).toBe('NAVIGATE');
      expect(transitions[0].reason).toBe('spatial_reposition');

      // Idempotent setMode returns false
      expect(controller.setMode('NAVIGATE')).toBe(false);

      // Revert mode steps back through history
      controller.setMode('TRANSFORM', 'inspect_cluster');
      expect(controller.currentMode).toBe('TRANSFORM');
      expect(controller.modeHistory).toEqual(['INTERACT', 'NAVIGATE']);

      const reverted = controller.revertMode();
      expect(reverted).toBe(true);
      expect(controller.currentMode).toBe('NAVIGATE');
      expect(transitions[transitions.length - 1].reason).toBe('revert');
    });

    it('manages focus states across multiple spatial surfaces', () => {
      const controller = new InteractionModeController();

      expect(controller.getFocusState('panel-recommendation')).toBe('idle');
      controller.setFocusState('panel-recommendation', 'focused');
      controller.setFocusState('cluster-node-42', 'hovered');

      expect(controller.getFocusState('panel-recommendation')).toBe('focused');
      expect(controller.getFocusState('cluster-node-42')).toBe('hovered');

      controller.clearFocusStates();
      expect(controller.getFocusState('panel-recommendation')).toBe('idle');
    });
  });

  describe('2. GestureOwnershipManager & Zero Silent Suppression', () => {
    it('resolves both-pinch contextually for every interaction mode with non-empty HUD chips', () => {
      const manager = new GestureOwnershipManager();

      const navRes = manager.resolveBothPinch('NAVIGATE');
      expect(navRes.action).toBe('world_two_hand_transform');
      expect(navRes.isSuppressed).toBe(false);
      expect(navRes.hudFeedbackChip.length).toBeGreaterThan(0);

      const interactRes = manager.resolveBothPinch('INTERACT');
      expect(interactRes.action).toBe('commit_selection');
      expect(interactRes.isSuppressed).toBe(false);

      const transformRes = manager.resolveBothPinch('TRANSFORM');
      expect(transformRes.action).toBe('scale_rotate_artifact');
      expect(transformRes.isSuppressed).toBe(false);

      const observeRes = manager.resolveBothPinch('OBSERVE');
      expect(observeRes.action).toBe('resume_interaction');
      expect(observeRes.isSuppressed).toBe(false);
    });

    it('enforces that all critical spatial actions satisfy >= 2 input channels redundancy', () => {
      const manager = new GestureOwnershipManager();
      for (const req of CRITICAL_ACTIONS_REDUNDANCY) {
        expect(manager.hasSufficientRedundancy(req.actionId)).toBe(true);
        expect(manager.getRedundancyChannels(req.actionId).length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('3. StatusStripController Persistent Grounding & Spotlight', () => {
    it('maintains structured grounding state and formats strip text cleanly', () => {
      const strip = new StatusStripController();

      strip.setDatasetContext('FINANCIAL_SERIES', 'TIME_SERIES', 45000);
      strip.setInteractionMode('NAVIGATE');
      strip.setFocusTarget('Cluster #3');
      strip.recordAction('Filter Range', 'Drag slice handles to refine');

      expect(strip.state.datasetLabel).toBe('FINANCIAL_SERIES');
      expect(strip.state.topology).toBe('TIME_SERIES');
      expect(strip.state.itemCount).toBe(45000);
      expect(strip.state.mode).toBe('NAVIGATE');
      expect(strip.state.focusTarget).toBe('Cluster #3');
      expect(strip.state.lastAction).toBe('Filter Range');
      expect(strip.state.nextAffordance).toBe('Drag slice handles to refine');

      const formatted = strip.formatStripText();
      expect(formatted).toContain('TIME_SERIES / 45,000 items');
      expect(formatted).toContain('MODE: NAVIGATE');
      expect(formatted).toContain('FOCUS: Cluster #3');
      expect(formatted).toContain('ACTION: Filter Range');

      strip.setSpotlight('entity-target-99');
      expect(strip.spotlightEntityId).toBe('entity-target-99');
    });
  });

  describe('4. PanelRolesManager & WorldUIManager Governance', () => {
    let engine: any;
    let cameraGroup: THREE.Group;
    let analystAnchor: THREE.Group;
    let eventBus: WorldEventBus;

    beforeEach(() => {
      cameraGroup = new THREE.Group();
      analystAnchor = new THREE.Group();
      eventBus = new WorldEventBus();
      engine = {
        camera: new THREE.PerspectiveCamera(),
        cameraGroup,
        scene: new THREE.Scene(),
        input: {
          hands: [],
          panels: [],
          setPanelManager: vi.fn(),
          addPanel: vi.fn(),
          setHandWheelMenu: vi.fn(),
          feedback: { playGestureTone: vi.fn(), playHaptic: vi.fn() },
          raycaster: { ray: new THREE.Ray() },
        },
        addUpdatable: vi.fn(),
        addHudObject: vi.fn(),
        performanceBudget: { addSnapshot: vi.fn(), isCritical: () => false },
      };
    });

    it('manages panel registration and role-based lifecycle directly', () => {
      const manager = new PanelRolesManager('ANALYST');
      manager.registerPanel('task-p1', 'Task 1', 'task');
      manager.registerPanel('task-p2', 'Task 2', 'task');
      manager.registerPanel('task-p3', 'Task 3', 'task');
      manager.registerPanel('diag-p1', 'Diagnostic 1', 'diagnostic');

      expect(manager.openPanel('task-p1')).toBe(true);
      expect(manager.openPanel('task-p2')).toBe(true);
      expect(manager.getOpenPanelsByRole('task').length).toBe(2);

      // 3rd task closes oldest (task-p1)
      expect(manager.openPanel('task-p3')).toBe(true);
      expect(manager.isPanelOpen('task-p1')).toBe(false);
      expect(manager.isPanelOpen('task-p2')).toBe(true);
      expect(manager.isPanelOpen('task-p3')).toBe(true);

      // Diagnostic disallowed in ANALYST
      expect(manager.openPanel('diag-p1')).toBe(false);

      // Switching to DEVELOPER allows diagnostic
      manager.setUIMode('DEVELOPER');
      expect(manager.openPanel('diag-p1')).toBe(true);

      manager.minimizeAll();
      expect(manager.isPanelOpen('task-p2')).toBe(false);
      expect(manager.isPanelOpen('task-p3')).toBe(false);
    });

    it('instantiates WorldUIManager with registered panel roles and governance', () => {
      const uiManager = new WorldUIManager(engine, analystAnchor, eventBus, {
        getSetting: () => 'novice',
      });

      expect(uiManager.statusStrip).toBeDefined();
      expect(uiManager.panelRolesManager).toBeDefined();
      expect(uiManager.contextualTaskSurface).toBeDefined();

      // Enforces maximum 2 task panels rule
      expect(uiManager.panelRolesManager.openPanel('recommendation')).toBe(true);
      expect(uiManager.panelRolesManager.openPanel('dracoExplainer')).toBe(true);
      expect(uiManager.panelRolesManager.getOpenPanelsByRole('task').length).toBe(2);

      // Diagnostic panel is blocked in ANALYST mode
      expect(uiManager.panelRolesManager.uiMode).toBe('ANALYST');
      const diagOpened = uiManager.panelRolesManager.openPanel('telemetry');
      expect(diagOpened).toBe(false);

      // When switched to DEVELOPER mode, diagnostic panels can open
      uiManager.panelRolesManager.setUIMode('DEVELOPER');
      expect(uiManager.panelRolesManager.openPanel('telemetry')).toBe(true);
      expect(uiManager.panelRolesManager.isPanelOpen('telemetry')).toBe(true);
    });

    it('toggles panels with role discipline and synchronizes visibility', () => {
      const uiManager = new WorldUIManager(engine, analystAnchor, eventBus);
      uiManager.panelRolesManager.setUIMode('DEVELOPER');

      const mockPanel: any = { mesh: new THREE.Mesh(), visible: false };

      const opened = uiManager.togglePanelWithRole('recommendation', mockPanel);
      expect(opened).toBe(true);
      expect(uiManager.panelRolesManager.isPanelOpen('recommendation')).toBe(true);

      const closed = uiManager.togglePanelWithRole('recommendation', mockPanel);
      expect(closed).toBe(false);
      expect(uiManager.panelRolesManager.isPanelOpen('recommendation')).toBe(false);
    });
  });

  describe('5. ContextualTaskSurface & Topology-Aware Filtering', () => {
    it('filters actions dynamically based on active dataset topology', () => {
      const surface = new ContextualTaskSurface();

      surface.setTopology('GRAPH');
      surface.setIntent('Analyse');
      const graphActions = surface.getAvailableActions().map((a) => a.id);
      expect(graphActions).toContain('find_communities');
      expect(graphActions).toContain('detect_anomalies');
      expect(graphActions).not.toContain('time_slice');

      surface.setTopology('TIME_SERIES');
      const timeActions = surface.getAvailableActions().map((a) => a.id);
      expect(timeActions).toContain('time_slice');
      expect(timeActions).not.toContain('find_communities');

      surface.setTopology('TABULAR');
      const tabularActions = surface.getAvailableActions().map((a) => a.id);
      expect(tabularActions).toContain('cluster_kmeans');
      expect(tabularActions).toContain('filter_range');
    });
  });

  describe('6. WorldInputCoordinator Both-Pinch & Gesture Integration', () => {
    let engine: any;
    let eventBus: WorldEventBus;
    let callbacks: any;

    beforeEach(() => {
      eventBus = new WorldEventBus();
      callbacks = {
        onApplyOperation: vi.fn(),
        onCycleDataset: vi.fn(),
        onResetData: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
        onToggleStatisticalLens: vi.fn(),
        onToggleSettingsPanel: vi.fn(),
        onCommitSelection: vi.fn(),
        onToggleTransformHandle: vi.fn(),
        onRecordAction: vi.fn(),
        onModeChanged: vi.fn(),
        onLog: vi.fn(),
      };
      engine = {
        cameraGroup: new THREE.Group(),
        scene: new THREE.Scene(),
        input: {
          hands: [],
          feedback: { playGestureTone: vi.fn(), playHaptic: vi.fn() },
          raycaster: { ray: new THREE.Ray() },
        },
        locomotion: {
          flightMode: false,
          ascend: vi.fn(),
          descend: vi.fn(),
        },
        addUpdatable: vi.fn(),
      };
    });

    it('resolves bothPinched contextually based on active InteractionMode', () => {
      const coordinator = new WorldInputCoordinator(engine, eventBus, { callbacks });

      // In default INTERACT mode -> resolves to commit_selection
      expect(coordinator.getInteractionMode()).toBe('INTERACT');
      coordinator.onGesture('bothPinched');
      expect(callbacks.onCommitSelection).toHaveBeenCalled();
      expect(callbacks.onLog).toHaveBeenCalledWith(['⊙ Commit Selection']);
      expect(callbacks.onRecordAction).toHaveBeenCalledWith('⊙ Commit Selection');

      // Transition to TRANSFORM mode -> resolves to scale_rotate_artifact
      coordinator.setInteractionMode('TRANSFORM');
      expect(callbacks.onModeChanged).toHaveBeenCalledWith('TRANSFORM');
      coordinator.onGesture('bothPinched');
      expect(callbacks.onToggleTransformHandle).toHaveBeenCalled();
      expect(callbacks.onLog).toHaveBeenCalledWith(['⤢ Scale & Rotate Artifact']);

      // Transition to OBSERVE mode -> bothPinched resumes INTERACT mode
      coordinator.setInteractionMode('OBSERVE');
      coordinator.onGesture('bothPinched');
      expect(coordinator.getInteractionMode()).toBe('INTERACT');
      expect(callbacks.onLog).toHaveBeenCalledWith(['▶ Resume Interaction']);
    });

    it('records executed actions on standard gestures', () => {
      const coordinator = new WorldInputCoordinator(engine, eventBus, { callbacks });

      coordinator.onGesture('pinchTogether');
      expect(callbacks.onApplyOperation).toHaveBeenCalledWith('filter');
      expect(callbacks.onRecordAction).toHaveBeenCalledWith('Filter Slice', 'Inspect filtered clusters');

      coordinator.onGesture('pinchApart');
      expect(callbacks.onApplyOperation).toHaveBeenCalledWith('aggregate');
      expect(callbacks.onRecordAction).toHaveBeenCalledWith('Aggregate Metric', 'Inspect aggregation summary');

      coordinator.onGesture('rotateCW');
      expect(callbacks.onRedo).toHaveBeenCalled();
      expect(callbacks.onRecordAction).toHaveBeenCalledWith('Redo Operation');
    });
  });

  describe('7. WheelMenuBuilder Intent Structure & Study Actions', () => {
    it('constructs complete 6-intent taxonomy with Study Mark Moment action', () => {
      const markMomentSpy = vi.fn();
      const applyOpSpy = vi.fn();
      const stubWorld: any = {
        uiManager: { panelManager: { togglePanel: vi.fn(), recenter: vi.fn() } },
        collaborationCoordinator: { isConnected: () => false },
        engine: { locomotion: {} },
        applyDataOperation: applyOpSpy,
        previewDataOperation: vi.fn(),
        clearOperationPreview: vi.fn(),
        markMoment: markMomentSpy,
        startTour: vi.fn(),
        exportAnalysisStory: vi.fn(),
        exportScreenshot: vi.fn(),
        _cycleDataset: vi.fn(),
        isLiveConnected: () => false,
        connectLiveStream: vi.fn(),
        disconnectLiveStream: vi.fn(),
        saveSession: vi.fn(),
        loadSession: vi.fn(),
        setPortalsEnabled: vi.fn(),
        _cycleThemePreset: vi.fn(),
        _toggleMiniOverview: vi.fn(),
        _togglePeerPresenceHUD: vi.fn(),
        _toggleSettingsPanel: vi.fn(),
        undoAnalysis: vi.fn(),
        redoAnalysis: vi.fn(),
        resetDataOperation: vi.fn(),
      };

      const categories = buildIntentWheelMenuCategories(stubWorld);
      expect(categories.length).toBe(6);
      const catIds = categories.map((c) => c.id);
      expect(catIds).toEqual(['ANALYSE', 'VIEW', 'DATA', 'STUDY', 'COLLABORATE', 'SYSTEM']);

      // Study category contains Mark Moment
      const studyCat = categories.find((c) => c.id === 'STUDY');
      const markMomentItem = studyCat?.items.find((item) => item.id === 'mark-moment');
      expect(markMomentItem).toBeDefined();

      markMomentItem?.callback();
      expect(markMomentSpy).toHaveBeenCalled();
    });

    it('maintains backwards compatibility for legacy buildWheelMenuCategories', () => {
      const stubWorld: any = {
        uiManager: { panelManager: { togglePanel: vi.fn() } },
        collaborationCoordinator: { isConnected: () => false },
        engine: { locomotion: {} },
        applyDataOperation: vi.fn(),
        previewDataOperation: vi.fn(),
        clearOperationPreview: vi.fn(),
        isLiveConnected: () => false,
        portalsEnabled: false,
        _cycleDataset: vi.fn(),
        _cycleThemePreset: vi.fn(),
        undoAnalysis: vi.fn(),
        redoAnalysis: vi.fn(),
        resetDataOperation: vi.fn(),
      };

      const categories = buildWheelMenuCategories(stubWorld);
      expect(categories.length).toBeGreaterThan(0);
      expect(categories.some((c) => c.id === 'panels')).toBe(true);
      expect(categories.some((c) => c.id === 'ops')).toBe(true);
    });
  });
});
