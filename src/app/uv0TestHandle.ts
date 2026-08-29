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
 *
 * Keep this helper structurally typed rather than importing `World`: RF-062
 * makes `World` a composition root, so only the bootstrap seam may depend on it.
 */

interface Uv0RuntimePort {
  currentEntry?: {
    name?: string | null;
    label?: string | null;
  } | null;
  uiManager?: {
    contextualTaskSurface?: {
      visible?: boolean;
      callbacks: {
        onInspect?: (target: null) => void;
      };
    };
  };
  representationSurface?: {
    currentNode?: {
      artifact?: {
        nodeMeshes?: object[];
      };
    } | null;
    setSelectedMesh(mesh: object): void;
  };
  inspector?: { visible?: boolean };
  diagnostic?: { mesh?: { visible?: boolean } };
  _lastSelectedMesh?: { name?: string } | null;
  atlas: {
    results: readonly unknown[];
    observations: readonly unknown[];
    isReady(): boolean;
  };
  session: {
    nilOutcomes: readonly unknown[];
  };
  _wasmUnavailable: boolean;
  _showDataCard(mesh: object): void;
}

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

export function installUv0TestHandle(world: object): NemosyneUv0TestHandle {
  const runtime = world as Uv0RuntimePort;

  return {
    snapshot(): Uv0RuntimeSnapshot {
      const taskSurface = runtime.uiManager?.contextualTaskSurface;
      const palace = runtime.representationSurface?.currentNode?.artifact;
      const outcome = document.getElementById(
        'analyst-representation-outcome'
      ) as HTMLElement | null;
      return {
        datasetName: runtime.currentEntry?.name ?? runtime.currentEntry?.label ?? null,
        telemetry: document.getElementById('telemetry')?.textContent ?? '',
        palaceNodeCount: palace?.nodeMeshes?.length ?? 0,
        inspectorVisible: !!runtime.inspector?.visible,
        taskSurfaceVisible: !!taskSurface?.visible,
        diagnosticVisible: !!runtime.diagnostic?.mesh?.visible,
        selectedNodeName: runtime._lastSelectedMesh?.name ?? null,
        evidenceCount: runtime.atlas.results.length,
        observationCount: runtime.atlas.observations.length,
        nilCount: runtime.session.nilOutcomes.length,
        outcomeKind: outcome?.dataset.state ?? 'pending',
        kernelAvailable: !runtime._wasmUnavailable && runtime.atlas.isReady(),
      };
    },
    selectNode(index = 0): boolean {
      const mesh = runtime.representationSurface?.currentNode?.artifact?.nodeMeshes?.[index];
      if (!mesh || !runtime.representationSurface) return false;
      runtime.representationSurface.setSelectedMesh(mesh);
      runtime._showDataCard(mesh);
      return true;
    },
    inspectSelected(): void {
      runtime.uiManager?.contextualTaskSurface?.callbacks.onInspect?.(null);
    },
  };
}