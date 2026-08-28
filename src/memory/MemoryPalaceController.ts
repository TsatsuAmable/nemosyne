/**
 * MemoryPalaceController — P1-U7
 *
 * Integrates MemoryPalaceGraph with P1-F semantic targeting/focus-context
 * and branch/replay behavior. Bridges the spatial reasoning graph with
 * the existing P1-F focus/context system.
 */

import * as THREE from 'three';
import { FocusContextController } from '../vr/interactions/FocusContextController.ts';
import type { EngineLike } from '../vr/coordinators/types.ts';
import { MemoryPalaceGraph } from './MemoryPalaceGraph.ts';
import type { SemanticTargetResolver } from '../vr/input/SemanticTargetResolver.ts';

export interface MemoryPalaceControllerOptions {
  engine: any;
  palaceGraph: any;
  focusContext: any;
  semanticResolver: any;
  onEpistemicObjectCreated?: (object: any) => void;
  onEpistemicObjectSelected?: (object: any) => void;
  onThreadFocused?: (thread: any) => void;
}

export class MemoryPalaceController {
  private readonly _palaceGraph: any;
  private readonly _focusContext: any;
  private readonly _options: Required<Pick<MemoryPalaceControllerOptions, 'onEpistemicObjectCreated' | 'onEpistemicObjectSelected' | 'onThreadFocused'>>;
  private _activeSelection: string | null = null;

  constructor(
    _engine: any,
    palaceGraph: any,
    focusContext: any,
    _semanticResolver: any,
    options: Partial<MemoryPalaceControllerOptions> = {}
  ) {
    this._palaceGraph = palaceGraph;
    this._focusContext = focusContext;
    this._options = {
      onEpistemicObjectCreated: options.onEpistemicObjectCreated ?? (() => {}),
      onEpistemicObjectSelected: options.onEpistemicObjectSelected ?? (() => {}),
      onThreadFocused: options.onThreadFocused ?? (() => {}),
    };
  }

  // ---- Creation Helpers ----

  createNotice(
    title: string,
    description: string,
    spatialAnchor?: any,
    provenance?: any
  ): string {
    const object = {
      id: `notice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      kind: 'notice',
      title,
      description,
      status: 'untested',
      provenance: provenance ?? this._defaultProvenance(),
      spatialAnchor,
      tags: [],
      confidence: 0.5,
      relevance: 0.5,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };
    this._palaceGraph.addObject(object);
    this._options.onEpistemicObjectCreated(object);
    return object.id;
  }

  createQuestion(
    title: string,
    description: string,
    provenance?: any,
    parentNoticeId?: string
  ): string {
    const object = {
      id: `question_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      kind: 'question',
      title,
      description,
      status: 'untested',
      provenance: provenance ?? this._defaultProvenance(),
      tags: [],
      confidence: 0.5,
      relevance: 0.5,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };
    this._palaceGraph.addObject(object);

    if (parentNoticeId) {
      this._palaceGraph.addRelationship({
        id: `rel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        sourceId: parentNoticeId,
        targetId: object.id,
        type: 'extends',
        strength: 0.8,
        provenance: this._defaultProvenance(),
        createdAt: Date.now(),
      });
    }

    this._options.onEpistemicObjectCreated(object);
    return object.id;
  }

  createHypothesis(
    title: string,
    description: string,
    provenance?: any,
    parentQuestionId?: string
  ): string {
    const object = {
      id: `hypothesis_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      kind: 'hypothesis',
      title,
      description,
      status: 'untested',
      provenance: provenance ?? this._defaultProvenance(),
      tags: [],
      confidence: 0.5,
      relevance: 0.5,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };
    this._palaceGraph.addObject(object);

    if (parentQuestionId) {
      this._palaceGraph.addRelationship({
        id: `rel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        sourceId: parentQuestionId,
        targetId: object.id,
        type: 'extends',
        strength: 0.8,
        provenance: this._defaultProvenance(),
        createdAt: Date.now(),
      });
    }

    this._options.onEpistemicObjectCreated(object);
    return object.id;
  }

  createTest(
    title: string,
    method: string,
    _evidenceIds: readonly string[],
    provenance?: any,
    parentHypothesisId?: string
  ): string {
    const object = {
      id: `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      kind: 'test',
      title,
      description: method,
      status: 'under_investigation',
      provenance: provenance ?? this._defaultProvenance(),
      tags: [],
      confidence: 0.5,
      relevance: 0.5,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };
    this._palaceGraph.addObject(object);

    if (parentHypothesisId) {
      this._palaceGraph.addRelationship({
        id: `rel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        sourceId: parentHypothesisId,
        targetId: object.id,
        type: 'depends_on',
        strength: 0.9,
        provenance: this._defaultProvenance(),
        createdAt: Date.now(),
      });
    }

    this._options.onEpistemicObjectCreated(object);
    return object.id;
  }

  createFinding(
    title: string,
    description: string,
    evidenceIds: readonly string[],
    provenance?: any,
    _status: any = 'supported'
  ): string {
    const object = {
      id: `finding_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      kind: 'finding',
      title,
      description,
      status,
      provenance: provenance ?? this._defaultProvenance(),
      tags: [],
      confidence: 0.8,
      relevance: 0.8,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };
    this._palaceGraph.addObject(object);

    for (const evidenceId of evidenceIds) {
      this._palaceGraph.addRelationship({
        id: `rel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        sourceId: object.id,
        targetId: evidenceId,
        type: 'supports',
        strength: 0.9,
        evidenceIds: [evidenceId],
        provenance: this._defaultProvenance(),
        createdAt: Date.now(),
      });
    }

    this._options.onEpistemicObjectCreated(object);
    return object.id;
  }

  createContradiction(
    title: string,
    description: string,
    refutedObjectId: string,
    _evidenceIds: readonly string[],
    provenance?: any
  ): string {
    const object = {
      id: `contradiction_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      kind: 'contradiction',
      title,
      description,
      status: 'refuted',
      provenance: provenance ?? this._defaultProvenance(),
      tags: [],
      confidence: 0.8,
      relevance: 0.8,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };
    this._palaceGraph.addObject(object);

    this._palaceGraph.addRelationship({
      id: `rel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      sourceId: object.id,
      targetId: refutedObjectId,
      type: 'refutes',
      strength: 0.95,
      evidenceIds: [],
      provenance: this._defaultProvenance(),
      createdAt: Date.now(),
    });

    this._options.onEpistemicObjectCreated(object);
    return object.id;
  }

  createBranchPoint(
    name: string,
    parentEpistemicId: string,
    childEpistemicIds: readonly string[],
    condition?: string
  ): string {
    const branch = {
      id: `branch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      description: '',
      parentEpistemicId,
      childEpistemicIds,
      condition,
      isActive: true,
      createdAt: Date.now(),
    };
    this._palaceGraph.addBranchPoint(branch);
    return branch.id;
  }

  // ---- Beacon Management ----

  createBeacon(
    epistemicObjectId: string,
    label: string,
    spatialAnchor: any,
    options: { intensity?: number; pulseRate?: number; visibility?: 'always' | 'on_focus' | 'on_proximity' } = {}
  ): string {
    const beacon = {
      id: `beacon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      epistemicObjectId,
      label,
      intensity: options.intensity ?? 0.7,
      pulseRate: options.pulseRate ?? 1.5,
      spatialAnchor,
      visibility: options.visibility ?? 'on_focus',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this._palaceGraph.addBeacon(beacon);
    return beacon.id;
  }

  // ---- Thread Management ----

  createThread(
    name: string,
    objectIds: readonly string[],
    _focusLevel: string = 'structure'
  ): string {
    const thread = {
      id: `thread_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      description: '',
      objectIds,
      relationshipIds: [],
      focusLevel: objectIds.length > 1 ? 'structure' : 'observation',
      isCollapsed: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this._palaceGraph.addThread(thread);
    return thread.id;
  }

  addToThread(threadId: string, objectId: string): boolean {
    const thread = this._palaceGraph.getThread?.(threadId);
    if (!thread) return false;
    if (!thread.objectIds.includes(objectId)) {
      const updated = { ...thread, objectIds: [...thread.objectIds, objectId], updatedAt: Date.now() };
      this._palaceGraph.updateThread?.(threadId, { objectIds: updated.objectIds });
      return true;
    }
    return false;
  }

  focusThread(threadId: string): void {
    const thread = this._palaceGraph.getThread?.(threadId);
    if (!thread) return;
    this._palaceGraph.setFocus(undefined, threadId);
    this._options.onThreadFocused(thread);
  }

  // ---- Selection/Interaction ----

  selectObject(objectId: string): void {
    this._activeSelection = objectId;
    this._palaceGraph.setFocus(objectId);
    const object = this._palaceGraph.getObject?.(objectId);
    if (object) this._options.onEpistemicObjectSelected(object);
  }

  clearSelection(): void {
    this._activeSelection = null;
    this._palaceGraph.setFocus(undefined);
  }

  getActiveSelection(): string | null {
    return this._activeSelection;
  }

  // ---- Raycast Integration (P1-F Semantic Targeting) ----

  handleRaycast(_raycaster: THREE.Raycaster, _pointer: unknown): unknown | null {
    // Check for epistemic objects in the scene
    // This would integrate with the semantic target resolver
    return null;
  }

  // ---- Update Loop ----

  update(_deltaSeconds: number): void {
    // Update beacon pulses, thread animations, etc.
  }

  // ---- Serialization ----

  toSnapshot(): unknown {
    return this._palaceGraph.toSnapshot();
  }

  static fromSnapshot(snapshot: any): MemoryPalaceController {
    const graph = MemoryPalaceGraph.fromSnapshot(snapshot);
    return new MemoryPalaceController(
      {} as Record<string, unknown>,
      graph,
      {} as Record<string, unknown>,
      {} as Record<string, unknown>
    );
  }

  // ---- Private Helpers ----

  private _defaultProvenance(): Record<string, unknown> {
    return {
      datasetFingerprint: 'unknown',
      kernelVersion: 'unknown',
      investigationVersion: '1.0',
      timestamp: Date.now(),
    };
  }

  private _onFocusChange(state: any): void {
    // Sync palace graph focus with P1-F focus context
    if (state?.focusedStructureId) {
      this._palaceGraph.setFocus(state.focusedStructureId);
    } else {
      this._palaceGraph.setFocus(undefined);
    }
  }
}

export interface MemoryPalaceControllerOptions {
  engine: any;
  palaceGraph: any;
  focusContext: any;
  semanticResolver: any;
  onEpistemicObjectCreated?: (object: any) => void;
  onEpistemicObjectSelected?: (object: any) => void;
  onThreadFocused?: (thread: any) => void;
}