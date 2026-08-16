/**
 * Adaptive assist coordinator (Phase 22.3 Tier B).
 *
 * Wires the three previously built-only assistive UI components into the
 * runtime and feeds the UX frustration analyzer that drives them:
 *
 *  - GestureConfidenceHUD — panel of live per-gesture confidence bars,
 *    updated from `gesture:recognized` bus events.
 *  - FrustrationResponseManager — camera-space hint card shown when the
 *    analyzer's dissatisfaction score crosses the user-mode threshold.
 *  - JITGestureHintManager — diegetic ghost-hand hints after repeated
 *    selection misses or gesture misfires.
 *
 * The analyzer itself (`UXFrustrationAnalyzer`, owned by the telemetry
 * collector) had no producers before this controller: selection dispatch
 * outcomes, gesture recognition, and panel toggles are now recorded into it.
 */

import * as THREE from 'three';
import { FrustrationResponseManager } from '../ui/FrustrationResponseManager.ts';
import { JITGestureHintManager } from '../ui/JITGestureHintManager.ts';
import { GestureConfidenceHUD } from '../ui/GestureConfidenceHUD.ts';
import type { UXFrustrationAnalyzer } from '../../utils/UXFrustrationAnalyzer.ts';
import { WorldTopics } from '../../utils/EventBus.ts';
import type { WorldEventBusLike } from './types.ts';
import type { SelectionDispatchInfo } from '../input/SelectionDispatcher.ts';

interface AdaptiveAssistEngineLike {
  addUpdatable(obj: unknown): void;
  removeUpdatable(obj: unknown): void;
  input: {
    addPanel(panel: unknown): void;
    removePanel?(panel: unknown): void;
    hands?: Array<{ handedness?: string; index?: number }>;
    pointers?: { getBestPointerRay(): THREE.Ray | null };
    dispatcher?: { onDispatch: ((info: SelectionDispatchInfo) => void) | null };
  };
}

export interface AdaptiveAssistControllerOptions {
  engine: AdaptiveAssistEngineLike;
  eventBus: WorldEventBusLike | null;
  analystAnchor: THREE.Group;
  scene: THREE.Scene;
  analyzer: UXFrustrationAnalyzer;
  hudVisible?: boolean;
  hintAfterMisses?: number;
  hintWindowMs?: number;
  isAssistEnabled?: () => boolean;
}

const MISS_HINT_TEXT = 'PINCH TO SELECT';
const MISFIRE_HINT_TEXT = 'SMOOTH, DELIBERATE MOTION';

export class AdaptiveAssistController {
  private _engine: AdaptiveAssistEngineLike;
  private _eventBus: WorldEventBusLike | null;
  private _analystAnchor: THREE.Group;
  private _analyzer: UXFrustrationAnalyzer;

  frustrationResponse: FrustrationResponseManager;
  jitHints: JITGestureHintManager;
  confidenceHUD: GestureConfidenceHUD;

  private _hintAfterMisses: number;
  private _hintWindowMs: number;
  private _isAssistEnabled: () => boolean;
  private _recentMisses: number[] = [];
  private _prevOnDispatch: ((info: SelectionDispatchInfo) => void) | null = null;
  private _tappedDispatcher = false;
  private _dispatchTap: ((info: SelectionDispatchInfo) => void) | null = null;
  private _unsubs: Array<() => void> = [];
  private _updatable = { update: () => this.frustrationResponse.update() };

  constructor(options: AdaptiveAssistControllerOptions) {
    this._engine = options.engine;
    this._eventBus = options.eventBus ?? null;
    this._analystAnchor = options.analystAnchor;
    this._analyzer = options.analyzer;
    this._hintAfterMisses = options.hintAfterMisses ?? 2;
    this._hintWindowMs = options.hintWindowMs ?? 4000;
    this._isAssistEnabled = options.isAssistEnabled ?? (() => true);

    this.frustrationResponse = new FrustrationResponseManager(
      options.analystAnchor,
      options.analyzer
    );

    this.jitHints = new JITGestureHintManager({ enabled: true });
    this.jitHints.setScene(options.scene);

    this.confidenceHUD = new GestureConfidenceHUD(options.analystAnchor);
    if (options.hudVisible === false) this.confidenceHUD.mesh.visible = false;
    options.engine.input.addPanel(this.confidenceHUD);
    options.analystAnchor.add(this.confidenceHUD.mesh);

    const bus = this._eventBus;
    if (bus) {
      this._unsubs.push(
        bus.on(WorldTopics.GESTURE_RECOGNIZED, (payload) => {
          const p = payload as { name?: string; ctx?: Record<string, unknown> } | undefined;
          this._onGestureRecognized(p?.name ?? 'unknown', p?.ctx ?? {});
        })
      );
      this._unsubs.push(
        bus.on('userMode:applied', (payload) => {
          const mode = (payload as { mode?: string } | undefined)?.mode;
          if (mode === 'novice' || mode === 'intermediate' || mode === 'expert') {
            this.frustrationResponse.setUserMode(mode);
            this.jitHints.enabled = mode !== 'expert';
          }
        })
      );
    }

    const dispatcher = options.engine.input.dispatcher;
    if (dispatcher) {
      this._prevOnDispatch = dispatcher.onDispatch;
      this._dispatchTap = (info) => this._onSelectionDispatch(info);
      dispatcher.onDispatch = this._dispatchTap;
      this._tappedDispatcher = true;
    }

    options.engine.addUpdatable(this._updatable);
  }

  /** Record a panel visibility change so the analyzer can see thrash patterns. */
  recordPanelToggle(target: string, visible: boolean): void {
    if (!this._isAssistEnabled()) return;
    this._analyzer.recordUserAction(visible ? 'show' : 'hide', target);
  }

  private _onGestureRecognized(name: string, ctx: Record<string, unknown>): void {
    const confidence = typeof ctx.confidence === 'number' ? ctx.confidence : 0.85;
    const isMisfire = !!ctx.isMisfire;
    this.confidenceHUD.recordConfidence(name, confidence);
    if (isMisfire) {
      this._showPointerHint(name, MISFIRE_HINT_TEXT);
    }
  }

  private _onSelectionDispatch(info: SelectionDispatchInfo): void {
    try {
      this._prevOnDispatch?.(info);
    } catch {
      // A failing prior tap must not break the pipeline.
    }

    const hitNothing = !info.hudConsumed && !info.sceneMesh;
    if (!hitNothing) return;

    if (!this._isAssistEnabled()) return;
    this._analyzer.recordUserAction('miss', 'selection');
    const now = performance.now();
    this._recentMisses.push(now);
    this._recentMisses = this._recentMisses.filter((t) => now - t <= this._hintWindowMs);
    if (this._recentMisses.length >= this._hintAfterMisses) {
      this._showPointerHint('pinchTogether', MISS_HINT_TEXT);
      this._recentMisses = [];
    }
  }

  private _showPointerHint(gestureName: string, label: string): void {
    if (!this.jitHints.enabled) return;
    const ray = this._engine.input.pointers?.getBestPointerRay?.() ?? null;
    const position = ray
      ? ray.origin.clone().add(ray.direction.clone().normalize().multiplyScalar(1.2))
      : new THREE.Vector3(0, 1.4, -1.2);
    this.jitHints.showHint(gestureName, position, label);
  }

  dispose(): void {
    for (const unsub of this._unsubs) {
      try {
        unsub();
      } catch {
        // Ignore unsubscribe failures.
      }
    }
    this._unsubs = [];

    if (this._tappedDispatcher) {
      if (this._engine.input.dispatcher?.onDispatch === this._dispatchTap) {
        this._engine.input.dispatcher.onDispatch = this._prevOnDispatch;
      }
      this._tappedDispatcher = false;
    }

    try {
      this._engine.removeUpdatable(this._updatable);
    } catch {
      // Engine may already be gone during teardown.
    }

    this.jitHints.dispose();
    this.frustrationResponse.dispose();

    this.confidenceHUD.mesh.visible = false;
    this._engine.input.removePanel?.(this.confidenceHUD);
    this._analystAnchor.remove(this.confidenceHUD.mesh);
    this.confidenceHUD.mesh.geometry.dispose();
    const material = this.confidenceHUD.mesh.material;
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else material.dispose();
  }
}
