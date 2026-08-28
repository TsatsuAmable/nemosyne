/**
 * MemoryPalaceGraph — P1-U7
 *
 * Authoritative spatial reasoning graph for the Memory Palace.
 * Manages epistemic objects, relationships, beacons, threads, and branch points
 * with lifecycle/state management and focus/reveal behavior.
 */

import type {
  EpistemicObject,
  EpistemicRelationship,
  Beacon,
  ReasoningThread,
  BranchPoint,
  MemoryPalaceSnapshot,
  EpistemicObjectKind,
  EpistemicValidationStatus,
  EPISTEMIC_COLORS,
  EPISTEMIC_CUES,
} from './EpistemicObject.ts';

export interface MemoryPalaceGraphOptions {
  onObjectAdded?: (object: EpistemicObject) => void;
  onObjectRemoved?: (objectId: string) => void;
  onObjectUpdated?: (object: EpistemicObject) => void;
  onRelationshipAdded?: (relationship: unknown) => void;
  onRelationshipRemoved?: (relationshipId: string) => void;
  onBeaconAdded?: (beacon: unknown) => void;
  onThreadAdded?: (thread: unknown) => void;
  onThreadUpdated?: (thread: unknown) => void;
  onBranchPointAdded?: (branch: unknown) => void;
  onFocusChanged?: (focusContext: unknown) => void;
}

function cloneObject<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export class MemoryPalaceGraph {
  private _objects = new Map<string, any>();
  private _relationships = new Map<string, any>();
  private _beacons = new Map<string, any>();
  private _threads = new Map<string, any>();
  private _branchPoints = new Map<string, any>();

  private _focusContext = {
    activeThreadId: undefined as string | undefined,
    focusedObjectId: undefined as string | undefined,
    zoomLevel: 1,
  } as { activeThreadId: string | undefined; focusedObjectId: string | undefined; zoomLevel: number };

  private _version = 1;
  private _updatedAt = Date.now();
  private _options: Required<MemoryPalaceGraphOptions>;

  constructor(options: MemoryPalaceGraphOptions = {}) {
    this._options = {
      onObjectAdded: options.onObjectAdded ?? (() => {}),
      onObjectRemoved: options.onObjectRemoved ?? (() => {}),
      onObjectUpdated: options.onObjectUpdated ?? (() => {}),
      onRelationshipAdded: options.onRelationshipAdded ?? (() => {}),
      onRelationshipRemoved: options.onRelationshipRemoved ?? (() => {}),
      onBeaconAdded: options.onBeaconAdded ?? (() => {}),
      onThreadAdded: options.onThreadAdded ?? (() => {}),
      onThreadUpdated: options.onThreadUpdated ?? (() => {}),
      onBranchPointAdded: options.onBranchPointAdded ?? (() => {}),
      onFocusChanged: options.onFocusChanged ?? (() => {}),
    };
  }

  get objects(): Map<string, any> {
    return this._objects;
  }

  get relationships(): Map<string, any> {
    return this._relationships;
  }

  get beacons(): Map<string, any> {
    return this._beacons;
  }

  get threads(): Map<string, any> {
    return this._threads;
  }

  get branchPoints(): Map<string, any> {
    return this._branchPoints;
  }

  get focusContext(): Readonly<typeof this._focusContext> {
    return this._focusContext;
  }

  get version(): number {
    return this._version;
  }

  get updatedAt(): number {
    return this._updatedAt;
  }

  // ---- Object Management ----

  addObject(object: EpistemicObject): void {
    if (this._objects.has(object.id)) {
      throw new Error(`EpistemicObject already exists: ${object.id}`);
    }
    this._objects.set(object.id, object);
    this._incrementVersion();
    this._options.onObjectAdded(object);
  }

  removeObject(objectId: string): boolean {
    const object = this._objects.get(objectId);
    if (!object) return false;

    // Remove related relationships
    for (const [relId, rel] of this._relationships) {
      if (rel.sourceId === objectId || rel.targetId === objectId) {
        this._relationships.delete(relId);
      }
    }

    // Remove related beacons
    for (const [beaconId, beacon] of this._beacons) {
      if (beacon.epistemicObjectId === objectId) {
        this._beacons.delete(beaconId);
      }
    }

    // Remove from threads
    for (const thread of this._threads.values()) {
      const idx = thread.objectIds.indexOf(objectId);
      if (idx >= 0) {
        const newObjectIds = thread.objectIds.filter((id: string) => id !== objectId);
        this.updateThread(thread.id, { objectIds: newObjectIds });
      }
    }

    // Remove branch points referencing this object
    for (const [bpId, bp] of this._branchPoints) {
      if (bp.parentEpistemicId === objectId || bp.childEpistemicIds.includes(objectId)) {
        this._branchPoints.delete(bpId);
      }
    }

    this._objects.delete(objectId);
    this._incrementVersion();
    this._options.onObjectRemoved(objectId);
    return true;
  }

  getObject(objectId: string): EpistemicObject | null {
    const obj = this._objects.get(objectId);
    return obj ? { ...obj } : null;
  }

  updateObject(objectId: string, updates: Partial<EpistemicObject>): boolean {
    const object = this._objects.get(objectId);
    if (!object) return false;

    const updated = { ...object, ...updates, updatedAt: Date.now(), version: object.version + 1 };
    this._objects.set(objectId, updated);
    this._incrementVersion();
    this._options.onObjectUpdated(updated);
    return true;
  }

  // ---- Relationship Management ----

  addRelationship(relationship: EpistemicRelationship): void {
    if (this._relationships.has(relationship.id)) {
      throw new Error(`EpistemicRelationship already exists: ${relationship.id}`);
    }
    this._relationships.set(relationship.id, relationship);
    this._incrementVersion();
    this._options.onRelationshipAdded(relationship);
  }

  removeRelationship(relationshipId: string): boolean {
    return this._relationships.delete(relationshipId);
  }

  getRelationship(relationshipId: string): EpistemicRelationship | null {
    const rel = this._relationships.get(relationshipId);
    return rel ? { ...rel } : null;
  }

  getRelationshipsForObject(objectId: string): EpistemicRelationship[] {
    const result: EpistemicRelationship[] = [];
    for (const rel of this._relationships.values()) {
      if (rel.sourceId === objectId || rel.targetId === objectId) {
        result.push({ ...rel });
      }
    }
    return result;
  }

  // ---- Beacon Management ----

  addBeacon(beacon: Beacon): void {
    if (this._beacons.has(beacon.id)) {
      throw new Error(`Beacon already exists: ${beacon.id}`);
    }
    this._beacons.set(beacon.id, beacon);
    this._incrementVersion();
    this._options.onBeaconAdded(beacon);
  }

  removeBeacon(beaconId: string): boolean {
    return this._beacons.delete(beaconId);
  }

  getBeacon(beaconId: string): Beacon | null {
    const beacon = this._beacons.get(beaconId);
    return beacon ? { ...beacon } : null;
  }

  getBeaconsForObject(objectId: string): Beacon[] {
    const result: Beacon[] = [];
    for (const beacon of this._beacons.values()) {
      if (beacon.epistemicObjectId === objectId) {
        result.push({ ...beacon });
      }
    }
    return result;
  }

  updateBeacon(beaconId: string, updates: Partial<Beacon>): boolean {
    const beacon = this._beacons.get(beaconId);
    if (!beacon) return false;
    this._beacons.set(beaconId, { ...beacon, ...updates, updatedAt: Date.now() });
    this._incrementVersion();
    return true;
  }

  // ---- Thread Management ----

  addThread(thread: ReasoningThread): void {
    if (this._threads.has(thread.id)) {
      throw new Error(`ReasoningThread already exists: ${thread.id}`);
    }
    this._threads.set(thread.id, thread);
    this._incrementVersion();
    this._options.onThreadAdded(thread);
  }

  removeThread(threadId: string): boolean {
    return this._threads.delete(threadId);
  }

  getThread(threadId: string): ReasoningThread | null {
    const thread = this._threads.get(threadId);
    return thread ? { ...thread } : null;
  }

  updateThread(threadId: string, updates: Partial<ReasoningThread>): boolean {
    const thread = this._threads.get(threadId);
    if (!thread) return false;
    const updated = { ...thread, ...updates, updatedAt: Date.now() };
    this._threads.set(threadId, updated);
    this._incrementVersion();
    this._options.onThreadUpdated(updated);
    return true;
  }

  getThreadsForObject(objectId: string): ReasoningThread[] {
    const result: ReasoningThread[] = [];
    for (const thread of this._threads.values()) {
      if (thread.objectIds.includes(objectId)) {
        result.push({ ...thread });
      }
    }
    return result;
  }

  // ---- Branch Point Management ----

  addBranchPoint(branch: BranchPoint): void {
    if (this._branchPoints.has(branch.id)) {
      throw new Error(`BranchPoint already exists: ${branch.id}`);
    }
    this._branchPoints.set(branch.id, branch);
    this._incrementVersion();
    this._options.onBranchPointAdded(branch);
  }

  removeBranchPoint(branchId: string): boolean {
    return this._branchPoints.delete(branchId);
  }

  getBranchPoint(branchId: string): BranchPoint | null {
    const bp = this._branchPoints.get(branchId);
    return bp ? { ...bp } : null;
  }

  getBranchPointsForObject(objectId: string): BranchPoint[] {
    const result: BranchPoint[] = [];
    for (const bp of this._branchPoints.values()) {
      if (bp.parentEpistemicId === objectId || bp.childEpistemicIds.includes(objectId)) {
        result.push({ ...bp });
      }
    }
    return result;
  }

  // ---- Focus/Context Management ----

  setFocus(focusedObjectId?: string, activeThreadId?: string): void {
    this._focusContext.focusedObjectId = focusedObjectId;
    this._focusContext.activeThreadId = activeThreadId;
    this._incrementVersion();
    this._options.onFocusChanged(this._focusContext);
  }

  setZoomLevel(zoomLevel: number): void {
    this._focusContext.zoomLevel = Math.max(0.1, Math.min(10, zoomLevel));
    this._incrementVersion();
  }

  // ---- Query Helpers ----

  getObjectsByKind(kind: EpistemicObjectKind): EpistemicObject[] {
    const result: EpistemicObject[] = [];
    for (const obj of this._objects.values()) {
      if (obj.kind === kind) result.push({ ...obj });
    }
    return result;
  }

  getObjectsByStatus(status: EpistemicValidationStatus): EpistemicObject[] {
    const result: EpistemicObject[] = [];
    for (const obj of this._objects.values()) {
      if (obj.status === status) result.push({ ...obj });
    }
    return result;
  }

  getObjectsByTag(tag: string): EpistemicObject[] {
    const result: EpistemicObject[] = [];
    for (const obj of this._objects.values()) {
      if (obj.tags?.includes(tag)) result.push({ ...obj });
    }
    return result;
  }

  // ---- Validation ----

  validate(): string[] {
    const issues: string[] = [];

    // Check relationship integrity
    for (const rel of this._relationships.values()) {
      if (!this._objects.has(rel.sourceId)) {
        issues.push(`Relationship ${rel.id} references missing source: ${rel.sourceId}`);
      }
      if (!this._objects.has(rel.targetId)) {
        issues.push(`Relationship ${rel.id} references missing target: ${rel.targetId}`);
      }
    }

    // Check beacon integrity
    for (const beacon of this._beacons.values()) {
      if (!this._objects.has(beacon.epistemicObjectId)) {
        issues.push(`Beacon ${beacon.id} references missing object: ${beacon.epistemicObjectId}`);
      }
    }

    // Check thread integrity
    for (const thread of this._threads.values()) {
      for (const objId of thread.objectIds) {
        if (!this._objects.has(objId)) {
          issues.push(`Thread ${thread.id} references missing object: ${objId}`);
        }
      }
      for (const relId of thread.relationshipIds) {
        if (!this._relationships.has(relId)) {
          issues.push(`Thread ${thread.id} references missing relationship: ${relId}`);
        }
      }
    }

    // Check branch point integrity
    for (const bp of this._branchPoints.values()) {
      if (!this._objects.has(bp.parentEpistemicId)) {
        issues.push(`BranchPoint ${bp.id} references missing parent: ${bp.parentEpistemicId}`);
      }
      for (const childId of bp.childEpistemicIds) {
        if (!this._objects.has(childId)) {
          issues.push(`BranchPoint ${bp.id} references missing child: ${childId}`);
        }
      }
    }

    return issues;
  }

  // ---- Serialization ----

  toSnapshot(): MemoryPalaceSnapshot {
    return {
      schemaVersion: '1.0.0',
      timestamp: Date.now(),
      objects: Array.from(this._objects.values()).map(cloneObject) as EpistemicObject[],
      relationships: Array.from(this._relationships.values()).map(cloneObject) as EpistemicRelationship[],
      beacons: Array.from(this._beacons.values()).map(cloneObject) as Beacon[],
      threads: Array.from(this._threads.values()).map(cloneObject) as ReasoningThread[],
      branchPoints: Array.from(this._branchPoints.values()).map(cloneObject) as BranchPoint[],
      focusContext: { ...this._focusContext },
    };
  }

  static fromSnapshot(snapshot: MemoryPalaceSnapshot): MemoryPalaceGraph {
    const graph = new MemoryPalaceGraph();
    for (const obj of snapshot.objects) graph._objects.set(obj.id, obj);
    for (const rel of snapshot.relationships) graph._relationships.set(rel.id, rel);
    for (const beacon of snapshot.beacons) graph._beacons.set(beacon.id, beacon);
    for (const thread of snapshot.threads) graph._threads.set(thread.id, thread);
    for (const bp of snapshot.branchPoints) graph._branchPoints.set(bp.id, bp);
    graph._focusContext = {
      activeThreadId: snapshot.focusContext.activeThreadId ?? undefined,
      focusedObjectId: snapshot.focusContext.focusedObjectId ?? undefined,
      zoomLevel: snapshot.focusContext.zoomLevel ?? 1,
    };
    graph._version = 1;
    graph._updatedAt = snapshot.timestamp;
    return graph;
  }

  toJSON(): MemoryPalaceSnapshot {
    return this.toSnapshot();
  }

  static fromJSON(json: MemoryPalaceSnapshot): MemoryPalaceGraph {
    return MemoryPalaceGraph.fromSnapshot(json);
  }

  // ---- Private Helpers ----

  private _incrementVersion(): void {
    this._version++;
    this._updatedAt = Date.now();
  }
}

export { EPISTEMIC_COLORS, EPISTEMIC_CUES };
export type {
  EpistemicObjectKind,
  EpistemicValidationStatus,
  EpistemicObjectProvenance,
  EpistemicObjectSpatialAnchor,
  EpistemicObject,
  EpistemicRelationship,
  Beacon,
  ReasoningThread,
  BranchPoint,
  MemoryPalaceSnapshot,
  FocusLevel,
} from './EpistemicObject.ts';