/**
 * P1-UV0 test-only runtime handle.
 *
 * Installed in `src/app/bootstrap.ts` ONLY when the page loads with
 * `?nemosyne-uv0=1`. It exposes a bounded read/summon surface over the live
 * `World` so the production-build smoke spec can (a) assert real runtime state
 * (inspector/task-surface visibility, ledger counts, dataset identity) and
 * (b) drive the REAL node-selection call path deterministically — the same
 * `_showDataCard` method the production ray-select dispatches, and the same
 * `onInspect` callback the ContextualTaskSurface Inspect verb invokes.
 *
 * This file is test-only helper code (Stream B, `docs/ROADMAP.md:186` permits
 * `src/app/bootstrap.ts` composition). It mutates nothing at install and has no
 * effect on the visible product when the query parameter is absent.
 */

import type { World } from '../vr/World.ts';

export interface Uv0RuntimeSnapshot {
  datasetName: string | null;
  telemetry: string;
  palaceNodeCount: number;
  inspectorVisible: boolean;
  taskSurfaceVisible: boolean;
  diagnosticVisible: boolean;
  selectedNodeName: string | null;
  evidenceCount: number;
  observationCount: number;
  nilCount: number;
  /** `decision` / `nil` when the DOM outcome was assessed, else `pending`. */
  outcomeKind: string;
  /** True when the analytical kernel is live (WASM present + atlas ready). */
  kernelAvailable: boolean;
}

export interface NemosyneUv0TestHandle {
  snapshot(): Uv0RuntimeSnapshot;
  /** Select a palace node by index (default first) via the real `_showDataCard` path. */
  selectNode(index?: number): boolean;
  /** Dispatch the same `onInspect` callback the ContextualTaskSurface Inspect verb fires. */
  inspectSelected(): void;
}

export const UV0_TEST_HANDLE_KEY = '__NEMOSYNE_UV0__';

declare global {
  interface Window {
    '__NEMOSYNE_UV0__'?: NemosyneUv0TestHandle;
  }
}

export function installUv0TestHandle(world: World): NemosyneUv0TestHandle {
  return {
    snapshot(): Uv0RuntimeSnapshot {
      const taskSurface = world.uiManager?.contextualTaskSurface;
      const palace = world.representationSurface?.currentNode?.artifact;
      const outcome = document.getElementById(
        'analyst-representation-outcome'
      ) as HTMLElement | null;
      return {
        datasetName: world.currentEntry?.name ?? world.currentEntry?.label ?? null,
        telemetry: document.getElementById('telemetry')?.textContent ?? '',
        palaceNodeCount: palace?.nodeMeshes?.length ?? 0,
        inspectorVisible: !!world.inspector?.visible,
        taskSurfaceVisible: !!taskSurface?.visible,
        diagnosticVisible: !!world.diagnostic?.mesh?.visible,
        selectedNodeName: world._lastSelectedMesh?.name ?? null,
        evidenceCount: world.atlas.results.length,
        observationCount: world.atlas.observations.length,
        nilCount: world.session.nilOutcomes.length,
        outcomeKind: outcome?.dataset.state ?? 'pending',
        kernelAvailable: !world._wasmUnavailable && world.atlas.isReady(),
      };
    },
    selectNode(index = 0): boolean {
      const mesh = world.representationSurface?.currentNode?.artifact?.nodeMeshes?.[index];
      if (!mesh) return false;
      world.representationSurface.setSelectedMesh(mesh);
      world._showDataCard(mesh);
      return true;
    },
    inspectSelected(): void {
      world.uiManager.contextualTaskSurface.callbacks.onInspect?.(null);
    },
  };
}