import type { Group } from 'three';
import type { DatasetLoadEntry, TelemetryCollectorLike, WorldEventBusLike } from '../vr/coordinators/types.ts';
import type { Engine } from '../vr/Engine.ts';
import type { WorldUIManager } from '../vr/coordinators/WorldUIManager.ts';
import {
  LoadTestDriver,
  type LoadTestProfile,
  type LoadTestSummary,
} from '../vr/scalability/LoadTestDriver.ts';
import {
  QuestBoundaryProbe,
  type QuestBoundarySummary,
} from '../vr/scalability/QuestBoundaryProbe.ts';
import { LoadTestPanel } from '../vr/ui/LoadTestPanel.ts';
import { applyPanelLayout, PANEL_LAYOUT } from '../vr/ui/panelLayout.ts';
import { bindDevEvidenceProjection } from '../vr/presentation/bindings/bindDevEvidenceProjection.ts';
import {
  VALIDATION_SESSION_ID_HEADER,
  VALIDATION_SESSION_LABEL_HEADER,
  readValidationSessionEnv,
} from '../validation/validation-session.ts';

interface ActiveSpecInfo {
  geometry?: string;
  layout?: string;
  renderedNodeCount?: number;
}

interface DevEvidenceTelemetry extends TelemetryCollectorLike {
  enabled?: boolean;
  setEnabled?(enabled: boolean): void;
  frustrationAnalyzer?: { getCompactDigest?(): Record<string, unknown> };
}

export interface DevEvidenceInstallerDependencies {
  engine: Engine;
  eventBus: WorldEventBusLike;
  telemetryCollector: TelemetryCollectorLike;
  uiManager: Pick<
    WorldUIManager,
    'analystAnchor' | 'panelManager' | 'panelRolesManager' | 'showPanel'
  >;
  loadDataset(entry: DatasetLoadEntry): void;
  getActiveSpecInfo(): ActiveSpecInfo | null;
  getWasmMemoryBytes(): number | null;
}

export interface DevEvidenceHandle {
  runLoadTest(profile?: LoadTestProfile): void;
  runQuestBoundaryProbe(): void;
  stop(): void;
  flush(): void;
  dispose(): void;
}

function loadTestPostInit(body: unknown): RequestInit {
  const session = readValidationSessionEnv(import.meta.env);
  if (!session) {
    return {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    };
  }
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [VALIDATION_SESSION_LABEL_HEADER]: session.label,
      [VALIDATION_SESSION_ID_HEADER]: session.id,
    },
    body: JSON.stringify(body),
  };
}

function postSummary(summary: unknown): void {
  try {
    void fetch('/__loadtest-results', loadTestPostInit(summary)).catch(() => {});
  } catch {
    // The local dev-server endpoint and fetch are both optional.
  }
}

function usabilityDigest(telemetry: DevEvidenceTelemetry): LoadTestSummary['usability'] {
  const digest = telemetry.frustrationAnalyzer?.getCompactDigest?.();
  return {
    frictionLevel:
      typeof digest?.frictionLevel === 'string' ? digest.frictionLevel : 'unknown',
    dissatisfactionScore:
      typeof digest?.dissatisfactionScore === 'number' ? digest.dissatisfactionScore : 0,
    detectedPatterns: Array.isArray(digest?.detectedPatterns)
      ? (digest.detectedPatterns as Array<{ name?: string } | string>).map((pattern) =>
          typeof pattern === 'string' ? pattern : (pattern.name ?? 'pattern')
        )
      : [],
    telemetryConsentEnabled: !!telemetry.enabled,
  };
}

/**
 * Explicitly installs the load-test/Quest evidence harness for dev and governed
 * research sessions. Production World composition has no dependency on this
 * module; bootstrap reaches it only through an import.meta.env.DEV branch.
 */
export function installDevEvidence({
  engine,
  eventBus,
  telemetryCollector,
  uiManager,
  loadDataset,
  getActiveSpecInfo,
  getWasmMemoryBytes,
}: DevEvidenceInstallerDependencies): DevEvidenceHandle {
  const telemetry = telemetryCollector as DevEvidenceTelemetry;
  const loadTestDriver = new LoadTestDriver(
    { loadDataset, getActiveSpecInfo, eventBus },
    engine,
    { getWasmMemoryBytes }
  );
  const questBoundaryProbe = new QuestBoundaryProbe(engine, eventBus);
  engine.addUpdatable(loadTestDriver);
  engine.addUpdatable(questBoundaryProbe);
  uiManager.panelRolesManager.registerPanel('loadTest', 'Load Test Panel', 'diagnostic');

  let loadTestPanel: LoadTestPanel | null = null;
  let lastLoadTestSummary: LoadTestSummary | null = null;
  let lastQuestBoundarySummary: QuestBoundarySummary | null = null;
  let telemetryConsentBeforeRun: boolean | null = null;
  let disposed = false;

  const restoreTelemetryConsent = () => {
    if (telemetryConsentBeforeRun === null) return;
    try {
      telemetry.setEnabled?.(telemetryConsentBeforeRun);
    } catch {
      // Telemetry is best-effort and must not block harness cleanup.
    }
    telemetryConsentBeforeRun = null;
  };

  const flushQuestBoundarySummary = (summary: QuestBoundarySummary) => {
    postSummary(summary);
    try {
      // eslint-disable-next-line no-console
      console.log(
        `[QUEST 10M] status=${summary.outcome.status} | ` +
          `evidence=${summary.qualification.evidencePathAvailableAt10m} | ` +
          `maxGapMs=${summary.maximumFrameGapMs ?? 'unknown'} | ` +
          `auditGate=${summary.qualification.promotionBlockedByAudits}`
      );
    } catch {
      // Remote console reporting is best-effort.
    }
  };

  const enrichAndFlushLoadTestSummary = (summary: LoadTestSummary) => {
    summary.usability = usabilityDigest(telemetry);
    postSummary(summary);
    try {
      // eslint-disable-next-line no-console
      console.log(
        `[LOAD TEST] ${summary.profileName} | XR=${summary.xrActive} | ` +
          `sufficientTo=${summary.verdict.jsPathSufficientTo} ` +
          `warrantedAt=${summary.verdict.commandBufferWarrantedAt} | ` +
          summary.verdict.recommendation
      );
    } catch {
      // Remote console reporting is best-effort.
    }
  };

  const projectionDisposer = bindDevEvidenceProjection<LoadTestSummary, QuestBoundarySummary>({
    eventBus,
    onLoadTestComplete: (summary) => {
      lastLoadTestSummary = summary;
      enrichAndFlushLoadTestSummary(summary);
      restoreTelemetryConsent();
    },
    onQuestBoundaryComplete: (summary) => {
      lastQuestBoundarySummary = summary;
      flushQuestBoundarySummary(summary);
    },
  });

  const getOrCreatePanel = (): LoadTestPanel => {
    if (disposed) throw new Error('Cannot create a panel for a disposed dev-evidence installer');
    if (loadTestPanel) return loadTestPanel;
    loadTestPanel = new LoadTestPanel(uiManager.analystAnchor as Group, {
      driver: loadTestDriver,
      eventBus,
      onStart: (profile) => handle.runLoadTest(profile),
      onStartBoundary: () => handle.runQuestBoundaryProbe(),
      onStop: () => handle.stop(),
      onFlush: () => handle.flush(),
    });
    uiManager.panelManager.register(loadTestPanel);
    applyPanelLayout(loadTestPanel, PANEL_LAYOUT.loadTestPanel);
    engine.input.addPanel(loadTestPanel);
    engine.addUpdatable(loadTestPanel);
    uiManager.panelManager.hidePanel(loadTestPanel);
    return loadTestPanel;
  };

  const previousCallbacks = {
    togglePanel: engine.onToggleLoadTestPanel,
    start: engine.onStartLoadTest,
    stop: engine.onStopLoadTest,
  };
  const installedCallbacks = {
    togglePanel: () => uiManager.panelManager.togglePanel(getOrCreatePanel()),
    start: () => handle.runLoadTest(),
    stop: () => handle.stop(),
  };
  engine.onToggleLoadTestPanel = installedCallbacks.togglePanel;
  engine.onStartLoadTest = installedCallbacks.start;
  engine.onStopLoadTest = installedCallbacks.stop;

  const handle: DevEvidenceHandle = {
    runLoadTest(profile) {
      if (disposed || questBoundaryProbe.running) return;
      lastQuestBoundarySummary = null;
      uiManager.showPanel(getOrCreatePanel());
      telemetryConsentBeforeRun = !!telemetry.enabled;
      try {
        telemetry.setEnabled?.(true);
      } catch {
        // Telemetry is best-effort.
      }
      loadTestDriver.run(profile);
    },

    runQuestBoundaryProbe() {
      if (
        disposed ||
        (loadTestDriver.phase !== 'IDLE' && loadTestDriver.phase !== 'COMPLETE')
      ) {
        return;
      }
      lastLoadTestSummary = null;
      uiManager.showPanel(getOrCreatePanel());
      questBoundaryProbe.run();
    },

    stop() {
      if (disposed) return;
      loadTestDriver.stop();
      questBoundaryProbe.stop();
    },

    flush() {
      if (disposed) return;
      if (lastLoadTestSummary) enrichAndFlushLoadTestSummary(lastLoadTestSummary);
      if (lastQuestBoundarySummary) flushQuestBoundarySummary(lastQuestBoundarySummary);
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      projectionDisposer();
      restoreTelemetryConsent();
      if (engine.onToggleLoadTestPanel === installedCallbacks.togglePanel) {
        engine.onToggleLoadTestPanel = previousCallbacks.togglePanel;
      }
      if (engine.onStartLoadTest === installedCallbacks.start) {
        engine.onStartLoadTest = previousCallbacks.start;
      }
      if (engine.onStopLoadTest === installedCallbacks.stop) {
        engine.onStopLoadTest = previousCallbacks.stop;
      }
      if (loadTestPanel) {
        engine.removeUpdatable(loadTestPanel);
        engine.input.removePanel(loadTestPanel);
        uiManager.panelManager.unregister?.(loadTestPanel);
        loadTestPanel.dispose();
        loadTestPanel = null;
      }
      engine.removeUpdatable(loadTestDriver);
      engine.removeUpdatable(questBoundaryProbe);
      loadTestDriver.dispose();
      questBoundaryProbe.dispose();
      uiManager.panelRolesManager.unregisterPanel('loadTest');
    },
  };

  return handle;
}
