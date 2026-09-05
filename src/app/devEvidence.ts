import type { Group } from 'three';
import type { DatasetLoadEntry, TelemetryCollectorLike, WorldEventBusLike } from '../vr/coordinators/types.ts';
import type { Engine } from '../vr/Engine.ts';
import type { WorldUIManager } from '../vr/coordinators/WorldUIManager.ts';
import {
  LoadTestDriver,
  QUEST_3S_QUALIFICATION_PROFILE,
  type LoadTestProfile,
  type LoadTestSummary,
} from '../vr/scalability/LoadTestDriver.ts';
import {
  QuestBoundaryProbe,
  type QuestBoundarySummary,
} from '../vr/scalability/QuestBoundaryProbe.ts';
import { LoadTestPanel } from '../vr/ui/LoadTestPanel.ts';
import { ValidationOperatorPanel } from '../vr/ui/ValidationOperatorPanel.ts';
import { applyPanelLayout, PANEL_LAYOUT } from '../vr/ui/panelLayout.ts';
import { bindDevEvidenceProjection } from '../vr/presentation/bindings/bindDevEvidenceProjection.ts';
import {
  VALIDATION_SESSION_ID_HEADER,
  VALIDATION_SESSION_LABEL_HEADER,
  readValidationSessionEnv,
} from '../validation/validation-session.ts';
import { readBrowserValidationContext } from '../validation/browser-validation-session.ts';
import {
  VALIDATION_RECEIPT_VERSION,
  VALIDATION_RECEIPT_VERSION_HEADER,
  VALIDATION_STATUS_ENDPOINT,
  VALIDATION_UX_ENDPOINT,
  isValidationDeliveryReceipt,
  type ValidationDeliveryReceipt,
  type ValidationServerStatus,
} from '../validation/validation-delivery.ts';
import type { GuidedUxSubmission } from '../validation/guided-ux-validation.ts';
import { downloadText } from '../utils/Download.ts';

interface ActiveSpecInfo {
  geometry?: string;
  layout?: string;
  renderedNodeCount?: number;
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

function validationHeaders(receipt = false): Record<string, string> {
  const session = readValidationSessionEnv(import.meta.env);
  if (!session) return {};
  return {
    [VALIDATION_SESSION_LABEL_HEADER]: session.label,
    [VALIDATION_SESSION_ID_HEADER]: session.id,
    ...(receipt
      ? { [VALIDATION_RECEIPT_VERSION_HEADER]: VALIDATION_RECEIPT_VERSION }
      : {}),
  };
}

function loadTestPostInit(body: unknown): RequestInit {
  const headers = validationHeaders(true);
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  };
}

async function postSummary(summary: unknown): Promise<ValidationDeliveryReceipt | null> {
  const session = readValidationSessionEnv(import.meta.env);
  try {
    const response = await fetch('/__loadtest-results', loadTestPostInit(summary));
    if (!response.ok) {
      throw new Error(`evidence sink returned HTTP ${response.status}`);
    }
    if (!session) return null;
    const payload = (await response.json()) as { receipt?: unknown };
    if (!isValidationDeliveryReceipt(payload.receipt)) {
      throw new Error('governed evidence sink did not return a validation receipt');
    }
    if (
      payload.receipt.sessionId !== session.id ||
      payload.receipt.sessionLabel !== session.label
    ) {
      throw new Error('validation receipt identity does not match the active browser session');
    }
    return payload.receipt;
  } catch (error) {
    if (!session) return null;
    throw error;
  }
}

async function fetchValidationStatus(): Promise<ValidationServerStatus> {
  const response = await fetch(VALIDATION_STATUS_ENDPOINT, {
    method: 'GET',
    headers: validationHeaders(false),
  });
  if (!response.ok) throw new Error(`validation status returned HTTP ${response.status}`);
  return (await response.json()) as ValidationServerStatus;
}

async function postGuidedUx(submission: GuidedUxSubmission): Promise<ValidationDeliveryReceipt> {
  const response = await fetch(VALIDATION_UX_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...validationHeaders(true),
    },
    body: JSON.stringify(submission),
  });
  if (!response.ok) throw new Error(`guided UX sink returned HTTP ${response.status}`);
  const payload = (await response.json()) as { receipt?: unknown };
  if (!isValidationDeliveryReceipt(payload.receipt)) {
    throw new Error('guided UX sink did not return a validation receipt');
  }
  return payload.receipt;
}

function usabilityDigest(telemetry: TelemetryCollectorLike): LoadTestSummary['usability'] {
  const digest = telemetry.frustrationAnalyzer.getCompactDigest();
  return {
    frictionLevel: digest.frictionLevel,
    dissatisfactionScore: digest.dissatisfactionScore,
    detectedPatterns: digest.detectedPatterns.map((pattern) => pattern.type),
    telemetryConsentEnabled: telemetry.enabled,
  };
}

/**
 * Explicitly installs the load-test/Quest evidence harness for dev and governed
 * research sessions. Production World composition has no dependency on this
 * module; bootstrap reaches it only through an import.meta.env.DEV branch.
 *
 * Governed validation sessions use ValidationOperatorPanel. The legacy
 * LoadTestPanel remains available for ordinary ad-hoc development, but it is
 * never mounted as the clickable start surface for a governed session.
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
  const loadTestDriver = new LoadTestDriver(
    { loadDataset, getActiveSpecInfo, eventBus },
    engine,
    { getWasmMemoryBytes }
  );
  const questBoundaryProbe = new QuestBoundaryProbe(engine, eventBus);
  const validationContext = readBrowserValidationContext(import.meta.env);
  engine.addUpdatable(loadTestDriver);
  engine.addUpdatable(questBoundaryProbe);
  uiManager.panelRolesManager.registerPanel(
    'loadTest',
    validationContext ? 'Device Validation' : 'Load Test Panel',
    'diagnostic'
  );

  let loadTestPanel: LoadTestPanel | null = null;
  let validationPanel: ValidationOperatorPanel | null = null;
  let lastLoadTestSummary: LoadTestSummary | null = null;
  let lastQuestBoundarySummary: QuestBoundarySummary | null = null;
  let telemetryConsentBeforeRun: boolean | null = null;
  let disposed = false;

  const restoreTelemetryConsent = () => {
    if (telemetryConsentBeforeRun === null) return;
    try {
      telemetryCollector.setEnabled?.(telemetryConsentBeforeRun);
    } catch {
      // Telemetry is best-effort and must not block harness cleanup.
    }
    telemetryConsentBeforeRun = null;
  };

  const reportDelivery = async (summary: unknown, label: string): Promise<void> => {
    if (validationPanel) validationPanel.setDeliverySending(`Delivering ${label} evidence…`);
    try {
      const receipt = await postSummary(summary);
      if (receipt && validationPanel) validationPanel.setDeliveryReceipt(receipt);
    } catch (error) {
      validationPanel?.setDeliveryFailure(
        `${label} delivery failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  const flushQuestBoundarySummary = (summary: QuestBoundarySummary) => {
    void reportDelivery(summary, '10M boundary');
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
    summary.usability = usabilityDigest(telemetryCollector);
    void reportDelivery(summary, 'performance');
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

  const refreshValidationStatus = async (): Promise<void> => {
    if (!validationContext || !validationPanel) return;
    const status = await fetchValidationStatus();
    if (
      status.sessionId !== validationContext.session.id ||
      status.sessionLabel !== validationContext.session.label ||
      status.manifest.sessionId !== validationContext.session.id ||
      status.manifest.sessionLabel !== validationContext.session.label
    ) {
      throw new Error('server validation status does not match the active browser session');
    }
    validationPanel.setServerStatus(status);
  };

  const downloadLastEvidence = async (): Promise<void> => {
    const summary = lastQuestBoundarySummary ?? lastLoadTestSummary;
    if (!summary) throw new Error('no completed evidence is available to download');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const prefix =
      summary.profileName === 'quest-3s-rust-boundary-10m'
        ? 'nemosyne-quest-boundary'
        : 'nemosyne-loadtest';
    await downloadText(
      JSON.stringify(summary, null, 2),
      `${prefix}-${ts}.json`,
      'application/json'
    );
  };

  const getOrCreateLoadTestPanel = (): LoadTestPanel => {
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

  const getOrCreateValidationPanel = (): ValidationOperatorPanel => {
    if (!validationContext) throw new Error('No governed validation context is active');
    if (disposed) throw new Error('Cannot create a panel for a disposed dev-evidence installer');
    if (validationPanel) return validationPanel;
    validationPanel = new ValidationOperatorPanel(uiManager.analystAnchor as Group, {
      context: validationContext,
      eventBus,
      onStartPerformance: () => handle.runLoadTest(QUEST_3S_QUALIFICATION_PROFILE),
      onStartBoundary: () => handle.runQuestBoundaryProbe(),
      onStop: () => handle.stop(),
      onFlush: () => handle.flush(),
      onDownload: downloadLastEvidence,
      onRefreshStatus: refreshValidationStatus,
      onSubmitUx: async (submission) => {
        validationPanel?.setDeliverySending('Delivering guided UX evidence…');
        const receipt = await postGuidedUx(submission);
        validationPanel?.setDeliveryReceipt(receipt);
        await refreshValidationStatus();
      },
    });
    uiManager.panelManager.register(validationPanel);
    applyPanelLayout(validationPanel, PANEL_LAYOUT.loadTestPanel);
    engine.input.addPanel(validationPanel);
    engine.addUpdatable(validationPanel);
    uiManager.panelManager.hidePanel(validationPanel);
    queueMicrotask(() => {
      void refreshValidationStatus().catch((error) => {
        validationPanel?.setDeliveryFailure(
          `Status confirmation failed: ${error instanceof Error ? error.message : String(error)}`
        );
      });
    });
    return validationPanel;
  };

  const getOperatorPanel = () =>
    validationContext ? getOrCreateValidationPanel() : getOrCreateLoadTestPanel();

  const previousCallbacks = {
    togglePanel: engine.onToggleLoadTestPanel,
    start: engine.onStartLoadTest,
    stop: engine.onStopLoadTest,
  };
  const installedCallbacks = {
    togglePanel: () => uiManager.panelManager.togglePanel(getOperatorPanel()),
    // Governed sessions must pass through the on-device confirmation UI rather
    // than allowing a hidden developer hotkey to bypass deliberate start.
    start: () => {
      if (validationContext) uiManager.showPanel(getOrCreateValidationPanel());
      else handle.runLoadTest();
    },
    stop: () => handle.stop(),
  };
  engine.onToggleLoadTestPanel = installedCallbacks.togglePanel;
  engine.onStartLoadTest = installedCallbacks.start;
  engine.onStopLoadTest = installedCallbacks.stop;

  const handle: DevEvidenceHandle = {
    runLoadTest(profile) {
      if (disposed || questBoundaryProbe.running) return;
      if (validationContext && validationContext.manifest.validationMode !== 'quest-perf') {
        validationPanel?.setDeliveryFailure(
          `Current validation lane '${validationContext.manifest.validationMode}' cannot start PERF-04/05 evidence.`
        );
        return;
      }
      lastQuestBoundarySummary = null;
      uiManager.showPanel(
        validationContext ? getOrCreateValidationPanel() : getOrCreateLoadTestPanel()
      );
      telemetryConsentBeforeRun = telemetryCollector.enabled;
      try {
        telemetryCollector.setEnabled?.(true);
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
      if (validationContext && validationContext.manifest.validationMode !== 'quest-10m') {
        validationPanel?.setDeliveryFailure(
          `Current validation lane '${validationContext.manifest.validationMode}' cannot start the 10M boundary.`
        );
        return;
      }
      lastLoadTestSummary = null;
      uiManager.showPanel(
        validationContext ? getOrCreateValidationPanel() : getOrCreateLoadTestPanel()
      );
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
      if (validationPanel) {
        engine.removeUpdatable(validationPanel);
        engine.input.removePanel(validationPanel);
        uiManager.panelManager.unregister?.(validationPanel);
        validationPanel.dispose();
        validationPanel = null;
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
