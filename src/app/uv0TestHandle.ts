/**
 * P1-UV0 instrumented runtime handle.
 *
 * This module is only dynamically imported when the build-time
 * `VITE_NEMOSYNE_UV0_EVIDENCE=1` flag is present and the page also carries
 * `?nemosyne-uv0=1`. Ordinary production bundles must not contain this helper.
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
      getActiveNodeDistance?(): number | null;
      callbacks: {
        onInspect?: (target: null) => void;
      };
    };
    panelBudgetController?: {
      activeBudgetCount: number;
    };
    settingsPanel?: { visible?: boolean };
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
  analyticalRuntime: {
    isUnavailable: boolean;
  };
  session: {
    nilOutcomes: readonly unknown[];
  };
  _showDataCard(mesh: object): void;
}

export interface Uv0RuntimeSnapshot {
  datasetName: string | null;
  telemetry: string;
  palaceNodeCount: number;
  inspectorVisible: boolean;
  taskSurfaceVisible: boolean;
  /** World-space distance between the active context rail and selected node. */
  taskSurfaceDistanceToSelection: number | null;
  /** Active non-pinned SpatialPanel budget count. */
  activePanelBudgetCount: number;
  settingsPanelVisible: boolean;
  diagnosticVisible: boolean;
  selectedNodeName: string | null;
  evidenceCount: number;
  observationCount: number;
  nilCount: number;
  /** `decision` / `nil` when the visible assessment was produced, else `pending`. */
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

function visibleAssessmentKind(): 'decision' | 'nil' | 'pending' {
  // InvestigationShell replaced AnalystJourneyControls. Its modal content is
  // persistent light DOM projected through the shared Modal slot, so textContent
  // is a stable evidence seam even when Modal recreates its shadow tree.
  const assessment = document.querySelector<HTMLElement>(
    'nms-modal[title="Representation Assessment"]',
  );
  if (!assessment || !assessment.hasAttribute('open')) return 'pending';
  const text = assessment.textContent ?? '';
  if (text.includes('No feasible representation')) return 'nil';
  if (text.includes('Moneta selected')) return 'decision';
  return 'pending';
}

export function installUv0TestHandle(world: object): NemosyneUv0TestHandle {
  const runtime = world as Uv0RuntimePort;

  return {
    snapshot(): Uv0RuntimeSnapshot {
      const taskSurface = runtime.uiManager?.contextualTaskSurface;
      const palace = runtime.representationSurface?.currentNode?.artifact;
      return {
        datasetName: runtime.currentEntry?.name ?? runtime.currentEntry?.label ?? null,
        telemetry: document.getElementById('telemetry')?.textContent ?? '',
        palaceNodeCount: palace?.nodeMeshes?.length ?? 0,
        inspectorVisible: !!runtime.inspector?.visible,
        taskSurfaceVisible: !!taskSurface?.visible,
        taskSurfaceDistanceToSelection: taskSurface?.getActiveNodeDistance?.() ?? null,
        activePanelBudgetCount: runtime.uiManager?.panelBudgetController?.activeBudgetCount ?? 0,
        settingsPanelVisible: !!runtime.uiManager?.settingsPanel?.visible,
        diagnosticVisible: !!runtime.diagnostic?.mesh?.visible,
        selectedNodeName: runtime._lastSelectedMesh?.name ?? null,
        evidenceCount: runtime.atlas.results.length,
        observationCount: runtime.atlas.observations.length,
        nilCount: runtime.session.nilOutcomes.length,
        outcomeKind: visibleAssessmentKind(),
        kernelAvailable: !runtime.analyticalRuntime.isUnavailable && runtime.atlas.isReady(),
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
