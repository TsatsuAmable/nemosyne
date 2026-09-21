import * as THREE from 'three';

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
    workspaceSurfaces?: {
      ids(): string[];
      panels: Array<{ mesh?: THREE.Object3D; title?: string }>;
      idFor(panel: object): string | null;
      isVisible(id: string): boolean;
      recenterAll(): void;
    };
    handWheelMenu?: {
      _categories?: Array<{
        id: string;
        items: Array<{ id: string; callback(): void }>;
      }>;
    };
  };
  engine: {
    camera: THREE.Object3D;
    input: { panels: unknown[] };
  };
  representationSurface?: {
    currentNode?: {
      dataInput?: {
        semanticRepresentationId?: string;
        semanticIntentAbstractionLevel?: string;
        observationPresentationAuthority?: string;
      };
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
  resourceLifecycleGovernor?: {
    getSnapshot(): {
      policyVersion: string;
      declaredWorkingSetSize: number;
      counts: Record<string, number>;
      queuedCleanupCount: number;
      transitions: readonly unknown[];
      cumulative: { cooled: number; evicted: number; reconstructed: number; failed: number };
    };
  };
  _showDataCard(mesh: object): void;
  reconstructRequirementsAndReArbitrate(): void;
}

export interface Uv0RuntimeSnapshot {
  datasetName: string | null;
  telemetry: string;
  palaceNodeCount: number;
  semanticRepresentationId: string | null;
  semanticIntentAbstractionLevel: string | null;
  observationPresentationAuthority: string | null;
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
  /** Lifecycle governor snapshot for dev/verification only. */
  resourceLifecycle: {
    policyVersion: string;
    declaredWorkingSetSize: number;
    counts: Record<string, number>;
    queuedCleanupCount: number;
    cumulative: { cooled: number; evicted: number; reconstructed: number; failed: number };
  } | null;
}

export interface Uv0WorkspaceSurfaceSnapshot {
  id: string;
  visible: boolean;
  inputRegistered: boolean;
  distanceToViewer: number;
  viewDot: number;
}

export interface NemosyneUv0TestHandle {
  snapshot(): Uv0RuntimeSnapshot;
  workspaceSurface(id: string): Uv0WorkspaceSurfaceSnapshot | null;
  invokeWheelItem(categoryId: string, itemId: string): boolean;
  moveWorkspaceSurface(id: string, position: [number, number, number]): boolean;
  recenterWorkspaceSurfaces(): void;
  /** Select a palace node by index (default first) via the real `_showDataCard` path. */
  selectNode(index?: number): boolean;
  /** Dispatch the same `onInspect` callback the ContextualTaskSurface Inspect verb fires. */
  inspectSelected(): void;
  /** Exercise the production ledger→individual-inspection re-arbitration path. */
  requestObservationView(): void;
}

export const UV0_TEST_HANDLE_KEY = '__NEMOSYNE_UV0__';

declare global {
  interface Window {
    __NEMOSYNE_UV0__?: NemosyneUv0TestHandle;
  }
}

function visibleAssessmentKind(): 'decision' | 'nil' | 'pending' {
  // InvestigationShell replaced AnalystJourneyControls. Its modal content is
  // persistent light DOM projected through the shared Modal slot, so textContent
  // is a stable evidence seam even when Modal recreates its shadow tree.
  const assessment = document.querySelector<HTMLElement>(
    'nms-modal[title="Representation Assessment"]'
  );
  if (!assessment || !assessment.hasAttribute('open')) return 'pending';
  const text = assessment.textContent ?? '';
  if (text.includes('No feasible representation')) return 'nil';
  if (text.includes('Moneta selected')) return 'decision';
  return 'pending';
}

export function installUv0TestHandle(world: object): NemosyneUv0TestHandle {
  const runtime = world as Uv0RuntimePort;

  const resolveWorkspaceSurface = (id: string) => {
    const manager = runtime.uiManager?.workspaceSurfaces;
    if (!manager) return null;
    return manager.panels.find((panel) => manager.idFor(panel as object) === id) ?? null;
  };

  return {
    snapshot(): Uv0RuntimeSnapshot {
      const taskSurface = runtime.uiManager?.contextualTaskSurface;
      const currentNode = runtime.representationSurface?.currentNode;
      const palace = currentNode?.artifact;
      return {
        datasetName: runtime.currentEntry?.name ?? runtime.currentEntry?.label ?? null,
        telemetry: document.getElementById('telemetry')?.textContent ?? '',
        palaceNodeCount: palace?.nodeMeshes?.length ?? 0,
        semanticRepresentationId: currentNode?.dataInput?.semanticRepresentationId ?? null,
        semanticIntentAbstractionLevel:
          currentNode?.dataInput?.semanticIntentAbstractionLevel ?? null,
        observationPresentationAuthority:
          currentNode?.dataInput?.observationPresentationAuthority ?? null,
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
        resourceLifecycle: runtime.resourceLifecycleGovernor
          ? (() => {
              const s = runtime.resourceLifecycleGovernor.getSnapshot();
              return {
                policyVersion: s.policyVersion,
                declaredWorkingSetSize: s.declaredWorkingSetSize,
                counts: s.counts,
                queuedCleanupCount: s.queuedCleanupCount,
                cumulative: s.cumulative,
              };
            })()
          : null,
      };
    },
    workspaceSurface(id: string): Uv0WorkspaceSurfaceSnapshot | null {
      const manager = runtime.uiManager?.workspaceSurfaces;
      const panel = resolveWorkspaceSurface(id);
      const mesh = panel?.mesh;
      if (!manager || !panel || !mesh) return null;

      runtime.engine.camera.updateMatrixWorld(true);
      mesh.updateMatrixWorld(true);
      const viewer = new THREE.Vector3();
      const surface = new THREE.Vector3();
      const forward = new THREE.Vector3();
      runtime.engine.camera.getWorldPosition(viewer);
      runtime.engine.camera.getWorldDirection(forward);
      mesh.getWorldPosition(surface);
      const toSurface = surface.sub(viewer);
      const distance = toSurface.length();
      return {
        id,
        visible: manager.isVisible(id),
        inputRegistered: runtime.engine.input.panels.includes(panel),
        distanceToViewer: distance,
        viewDot: distance > 0 ? forward.dot(toSurface.normalize()) : -1,
      };
    },
    invokeWheelItem(categoryId: string, itemId: string): boolean {
      const category = runtime.uiManager?.handWheelMenu?._categories?.find(
        (candidate) => candidate.id === categoryId
      );
      const item = category?.items.find((candidate) => candidate.id === itemId);
      if (!item) return false;
      item.callback();
      return true;
    },
    moveWorkspaceSurface(id: string, position: [number, number, number]): boolean {
      const panel = resolveWorkspaceSurface(id);
      if (!panel?.mesh) return false;
      panel.mesh.position.set(position[0], position[1], position[2]);
      panel.mesh.updateMatrixWorld(true);
      return true;
    },
    recenterWorkspaceSurfaces(): void {
      runtime.uiManager?.workspaceSurfaces?.recenterAll();
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
    requestObservationView(): void {
      runtime.reconstructRequirementsAndReArbitrate();
    },
  };
}
