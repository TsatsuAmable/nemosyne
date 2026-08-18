import type { AtlasCore } from '../../atlas/AtlasCore.ts';
import type { DiscoveredStructure } from '../../atlas/structures.ts';
import type { VRCommand } from '../../atlas/types.ts';

export interface VRCommandExecutorOptions {
  atlas: AtlasCore;
  onIsolate?: (rowIndices: number[]) => void;
  onNavigate?: (rowIndices: number[]) => void;
  onInspect?: (rowIndices: number[], structure: DiscoveredStructure) => void;
  onCompare?: (rowIndicesA: number[], rowIndicesB: number[]) => void;
  onReset?: () => void;
}

export class VRCommandExecutor {
  private readonly _atlas: AtlasCore;
  private readonly _onIsolate?: (rowIndices: number[]) => void;
  private readonly _onNavigate?: (rowIndices: number[]) => void;
  private readonly _onInspect?: (rowIndices: number[], structure: DiscoveredStructure) => void;
  private readonly _onCompare?: (rowIndicesA: number[], rowIndicesB: number[]) => void;
  private readonly _onReset?: () => void;
  private _isolatedRowIndices: number[] | null = null;

  constructor(options: VRCommandExecutorOptions) {
    this._atlas = options.atlas;
    this._onIsolate = options.onIsolate;
    this._onNavigate = options.onNavigate;
    this._onInspect = options.onInspect;
    this._onCompare = options.onCompare;
    this._onReset = options.onReset;
  }

  get isolatedRowIndices(): number[] | null {
    return this._isolatedRowIndices;
  }

  execute(command: VRCommand): boolean {
    const structures = this._resolveTargets(command.targetIds);
    if (structures.length === 0) return false;

    switch (command.action) {
      case 'inspect-cluster':
        return this._executeIsolate(structures, command);
      case 'inspect-boundary':
        return this._executeInspect(structures, command);
      case 'explore-region':
        return this._executeNavigate(structures, command);
      case 'compare-regions':
        return this._executeCompare(structures, command);
      case 'investigate-anomaly':
        return this._executeIsolate(structures, command);
      default:
        return false;
    }
  }

  reset(): void {
    this._isolatedRowIndices = null;
    this._onReset?.();
    this._atlas.recordEmbodimentCommand({
      action: 'explore-region',
      targetIds: [],
      embodiment: 'reset',
    });
  }

  sliceByStructure(structureId: string): boolean {
    const structures = this._resolveTargets([structureId]);
    if (structures.length === 0) return false;
    const rowIndices = structures[0].rowIndices;
    this._onIsolate?.(rowIndices);
    this._atlas.recordEmbodimentCommand({
      action: 'inspect-cluster',
      targetIds: [structureId],
      embodiment: 'slice',
    });
    return true;
  }

  executeFromRecommendation(): boolean {
    const rec = this._atlas.activeRecommendation;
    if (!rec || rec.decision !== 'accepted') return false;
    const command: VRCommand = {
      action: rec.action,
      targetIds: rec.targetIds,
      embodiment: rec.suggestedEmbodiment ?? 'default',
      sourceRecommendationId: rec.targetIds.join(','),
      provenance: rec.provenance,
    };
    return this.execute(command);
  }

  private _executeIsolate(
    structures: DiscoveredStructure[],
    command: VRCommand,
  ): boolean {
    const rowIndices = this._mergeRowIndices(structures);
    this._isolatedRowIndices = rowIndices;
    this._onIsolate?.(rowIndices);
    this._atlas.recordEmbodimentCommand(command);
    return true;
  }

  private _executeNavigate(
    structures: DiscoveredStructure[],
    command: VRCommand,
  ): boolean {
    const rowIndices = this._mergeRowIndices(structures);
    this._onNavigate?.(rowIndices);
    this._atlas.recordEmbodimentCommand(command);
    return true;
  }

  private _executeInspect(
    structures: DiscoveredStructure[],
    command: VRCommand,
  ): boolean {
    const structure = structures[0];
    const rowIndices = structure.rowIndices;
    this._onInspect?.(rowIndices, structure);
    this._atlas.recordEmbodimentCommand(command);
    return true;
  }

  private _executeCompare(
    structures: DiscoveredStructure[],
    command: VRCommand,
  ): boolean {
    if (structures.length < 2) return false;
    this._onCompare?.(structures[0].rowIndices, structures[1].rowIndices);
    this._atlas.recordEmbodimentCommand(command);
    return true;
  }

  private _resolveTargets(targetIds: string[]): DiscoveredStructure[] {
    const idSet = new Set(targetIds);
    const found: DiscoveredStructure[] = [];
    for (const set of this._atlas.structures) {
      for (const structure of set.structures) {
        if (idSet.has(structure.id)) {
          found.push(structure);
        }
      }
    }
    return found;
  }

  private _mergeRowIndices(structures: DiscoveredStructure[]): number[] {
    const all = new Set<number>();
    for (const s of structures) {
      for (const idx of s.rowIndices) {
        all.add(idx);
      }
    }
    return [...all].sort((a, b) => a - b);
  }
}