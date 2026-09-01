import type { InvestigatorTaskIntent } from './intents/InvestigatorTaskIntent.ts';
import { INVESTIGATOR_TASKS } from './intents/InvestigatorTaskIntent.ts';
import type { DesktopSelectionTaskRailHandle } from './DesktopSelectionTaskRail.ts';

export interface C3TaskButtonSnapshot {
  id: InvestigatorTaskIntent;
  label: string;
  disabled: boolean;
  reason: string | null;
  xrAvailable: boolean;
  xrReason: string | null;
}

export interface C3ProductEvidenceSnapshot {
  schemaVersion: 1;
  selectionContext: string | null;
  selectedPayloadId: string | null;
  contextualSurfaceVisible: boolean;
  inspectorVisible: boolean;
  observationCount: number;
  tasks: C3TaskButtonSnapshot[];
}

export interface C3ProductEvidenceHook {
  schemaVersion: 1;
  snapshot(): C3ProductEvidenceSnapshot;
  selectFirstDataObject(): C3ProductEvidenceSnapshot & { selectedId: string };
}

export interface C3EvidenceMesh {
  name?: string;
  userData?: { row?: Record<string, unknown> };
}

export interface C3ProductEvidencePort {
  getNodeMeshes(): readonly C3EvidenceMesh[];
  selectDataObject(mesh: C3EvidenceMesh): void;
  contextualSurface: {
    visible: boolean;
    activeData: Record<string, unknown> | null;
    taskAvailability(
      intent: InvestigatorTaskIntent,
      data?: Record<string, unknown> | null,
    ): { available: boolean; reason?: string };
  };
  getInspectorVisible(): boolean;
  getObservationCount(): number;
}

declare global {
  interface Window {
    __NEMOSYNE_C3_EVIDENCE__?: C3ProductEvidenceHook;
  }
}

function payloadId(data: Record<string, unknown> | null): string | null {
  if (!data) return null;
  const identity = data.id ?? data.name ?? data.label ?? null;
  return identity == null ? null : String(identity);
}

function snapshot(port: C3ProductEvidencePort): C3ProductEvidenceSnapshot {
  const surface = port.contextualSurface;
  const data = surface.activeData;
  const tasks = INVESTIGATOR_TASKS.map((task): C3TaskButtonSnapshot => {
    const element = document.getElementById(`desktop-task-${task.id}`);
    const availability = surface.taskAvailability(task.id, data);
    return {
      id: task.id,
      label: element?.textContent?.trim() ?? '',
      disabled: element?.hasAttribute('disabled') ?? true,
      reason: element?.getAttribute('title') ?? null,
      xrAvailable: availability.available,
      xrReason: availability.reason ?? null,
    };
  });

  return {
    schemaVersion: 1,
    selectionContext: document.getElementById('desktop-selection-context')?.textContent ?? null,
    selectedPayloadId: payloadId(data),
    contextualSurfaceVisible: surface.visible,
    inspectorVisible: port.getInspectorVisible(),
    observationCount: port.getObservationCount(),
    tasks,
  };
}

/** Diagnostics-gated real-product selection hook for C3 browser parity evidence. */
export function installC3ProductEvidenceHook(
  port: C3ProductEvidencePort,
  rail: DesktopSelectionTaskRailHandle,
): () => void {
  const hook: C3ProductEvidenceHook = {
    schemaVersion: 1,
    snapshot: () => snapshot(port),
    selectFirstDataObject: () => {
      const mesh = port.getNodeMeshes().find((candidate) => candidate.userData?.row);
      const row = mesh?.userData?.row;
      if (!mesh || !row) {
        throw new Error('C3 evidence requires a rendered data object with authoritative row payload.');
      }
      port.selectDataObject(mesh);
      rail.refresh();
      const selectedId = payloadId(row);
      if (!selectedId) {
        throw new Error('C3 evidence requires a stable selected payload identity.');
      }
      return { ...snapshot(port), selectedId };
    },
  };

  window.__NEMOSYNE_C3_EVIDENCE__ = hook;
  return () => {
    if (window.__NEMOSYNE_C3_EVIDENCE__ === hook) {
      delete window.__NEMOSYNE_C3_EVIDENCE__;
    }
  };
}
