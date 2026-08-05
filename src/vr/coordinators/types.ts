/**
 * Shared TypeScript types for the VR coordinator layer.
 *
 * These interfaces describe the shape of coordinator options, callbacks, and
 * the lightweight object references they exchange with `World.js`, panels, and
 * the data layer. They are intentionally permissive for three.js/JS class
 * boundaries that have not yet been typed.
 */

import type { Group, Mesh, Object3D } from 'three';
import type { Dataset } from '../../data/Dataset.ts';
import type { LiveUpdate } from '../../data/connectors/DataConnector.ts';
import type { OperationSpec } from '../../data/types.ts';

export type UserMode = 'novice' | 'intermediate' | 'expert';

/** Permissive options bag for bridging to not-yet-typed JS panel/adapter classes. */
export type LooseOptions = Record<string, unknown>;

export type VisualOperation =
  | 'filter'
  | 'sort'
  | 'aggregate'
  | 'cluster'
  | 'hierarchical'
  | 'density'
  | 'anomaly'
  | 'timeSlice';

export interface ArtifactRef {
  nodeMeshes: Mesh[];
  group: Group;
}

export interface OperationStrategy {
  (dataset: Dataset, originalDataset: Dataset): Dataset;
}

export interface VisualApplier {
  (artifact: ArtifactRef, dataset: Dataset, originalDataset?: Dataset): void;
}

export interface WasmRuntimeBridge {
  isReady(): boolean;
  capabilities(): number;
  executeOperation(datasetJSON: unknown, spec: OperationSpec): unknown;
  loadSample(key: string): number;
  getDatasetJson(handle: number): unknown;
  destroyDataset(handle: number): void;
  initRuntime(url: string): Promise<void>;
}

export interface DataOperationControllerOptions {
  eventBus?: WorldEventBusLike;
  getArtifact?: () => ArtifactRef | null;
  maxHistoryFrames?: number;
}

export interface HistoryEntry {
  operation: string;
  dataset: Dataset;
  parameters: Record<string, unknown>;
}

export interface WorldUIManagerCallbacks {
  onLoadDataset?: (entry: unknown) => void;
  onTogglePortals?: (enabled: boolean) => void;
  onConnectStream?: () => void;
  onDisconnectStream?: () => void;
  onSelectLiveSource?: (sourceKey: string) => void;
  onFilter?: () => void;
  onSort?: () => void;
  onAggregate?: () => void;
  onCluster?: () => void;
  onHierarchicalCluster?: () => void;
  onDensityCluster?: () => void;
  onAnomaly?: () => void;
  onTimeSlice?: () => void;
  onReset?: () => void;
  onPanelChange?: () => void;
  onSettingChanged?: (key: string, value: unknown) => void;
  onSeekHistory?: (index: number) => void;
  getNodeMeshes?: () => Mesh[];
  getPeers?: () => unknown[];
  getLocalPeerId?: () => string | null;
  getSetting?: (key: string) => unknown;
  telemetryCollector?: unknown;
  analysisHistory?: unknown;
}

export interface AccessibilityOptions {
  textScale: number;
  highContrast: boolean;
  colorblindMode: string | boolean;
  reduceMotion?: boolean;
  dwellEnabled?: boolean;
  dwellDelayMs?: number;
  [key: string]: unknown;
}

export const DEFAULT_ACCESSIBILITY: AccessibilityOptions = {
  textScale: 1,
  highContrast: false,
  colorblindMode: 'none',
};

export interface PanelLike {
  mesh?: { visible: boolean } | null;
  applyAccessibility?(options: AccessibilityOptions): void;
}

export interface PanelManagerLike {
  panels: PanelLike[];
  register(panel: PanelLike): void;
  showPanel(panel: PanelLike): void;
  hidePanel(panel: PanelLike): void;
  togglePanel(panel: PanelLike): void;
  recenter(): void;
  toggleLauncher(): void;
  isLauncherVisible(): boolean;
}

export interface DashboardLike {
  wallGroup: Group;
  registerPanel(panel: PanelLike): void;
  unregisterPanel(panel: PanelLike): void;
  scrollBySlots(delta: number): void;
  resetDashboard(): void;
}

export interface HandWheelMenuLike {
  group: Group;
  isVisible(): boolean;
  setMenu(categories: WheelMenuCategory[]): void;
  applyAccessibility?(options: AccessibilityOptions): void;
}

export interface WheelMenuAction {
  id: string;
  label: string;
  icon?: string;
  callback: () => void;
  onHover?: () => void;
  onLeave?: () => void;
}

export interface WheelMenuCategory {
  id: string;
  label: string;
  icon?: string;
  items: WheelMenuAction[];
}

export interface EngineLike {
  cameraGroup: Group;
  scene: { add(object: Object3D): void; remove(object: Object3D): void };
  addUpdatable(obj: Updatable | (() => void)): void;
  input: InputRouterLike;
  locomotion: LocomotionLike;
  setVignetteEnabled?(enabled: boolean, intensity?: number): void;
}

export interface Updatable {
  update(delta: number, time: number): void;
}

export interface InputRouterLike {
  hands: HandLike[];
  feedback: FeedbackLike;
  panels: PanelLike[];
  setPanelManager(manager: PanelManagerLike): void;
  addPanel(panel: PanelLike): void;
  setHandWheelMenu(menu: HandWheelMenuLike): void;
  setSuppressSceneSelection?(enabled: boolean): void;
  raycaster: {
    ray: {
      origin: { set(x: number, y: number, z: number): void };
      direction: { set(x: number, y: number, z: number): void };
    };
  };
}

export interface HandLike {
  handedness?: string;
  rayOrigin?: { copy(v: unknown): void };
  rayDirection?: { copy(v: unknown): void };
  getHandTransform?(
    position: { set(x: number, y: number, z: number): void },
    quaternion: { set(x: number, y: number, z: number, w: number): void }
  ): void;
  isPinched?(): boolean;
  pinched?: boolean;
}

export interface FeedbackLike {
  playGestureTone?(name: string): void;
  playHaptic?(intensity: number, durationMs: number): void;
}

export interface LocomotionLike {
  flightMode: boolean;
  enabled?: boolean;
  ascend(): void;
  descend(): void;
  teleportToAnchor(name: string): boolean;
  setEnabled?(enabled: boolean): void;
  setSnapTurnEnabled?(enabled: boolean): void;
  setSnapAngle?(radians: number): void;
  setReducedMotion?(enabled: boolean): void;
  setSeatedHeightOffset?(offset: number): void;
}

export interface WorldEventBusLike {
  emit(topic: string, payload?: unknown): void;
  on(topic: string, handler: (payload: unknown) => void): () => void;
}

export interface WorldInputOptions {
  getSetting?: (key: string) => unknown;
  getDracoGroup?: () => Object3D | null;
  getArtifact?: () => ArtifactRef | null;
  getHandWheelMenu?: () => HandWheelMenuLike | null;
  callbacks?: InputCallbacks;
}

export interface InputCallbacks {
  onApplyOperation?: (op: string) => void;
  onCycleDataset?: (delta: number) => void;
  onResetData?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onToggleStatisticalLens?: () => void;
  onToggleSettingsPanel?: () => void;
  onTogglePanels?: () => void;
  onToggleMiniOverview?: () => void;
  onTogglePeerPresence?: () => void;
  onToggleDesktopPreview?: () => void;
  onLoadTemplate?: (id: string) => void;
  onLog?: (msg: string) => void;
  onCaptureSession?: () => void;
}

export interface GestureContext {
  source?: 'hand' | 'controller' | string;
  button?: string;
  input?: string;
  openHands?: boolean;
  [key: string]: unknown;
}

export interface WorldSceneComposerCallbacks {
  onWarp?: (zone: string, pos: number[], operation: string | null) => void;
}

export interface UserModeControllerOptions {
  getUserMode: () => UserMode | string;
  getTourState: () => { isActive: boolean; isFinished: boolean };
  startTour: () => void;
  skipTour: () => void;
  setCoachMode: (mode: UserMode | string) => void;
  setTourMode: (mode: UserMode | string) => void;
  setTooltipEnabled: (enabled: boolean) => void;
  hideCoachPanel: () => void;
}

export interface ComfortSettings {
  snapTurn?: boolean;
  snapTurnAngle?: number;
  reducedMotion?: boolean;
  seatedHeightOffset?: number;
  vignette?: boolean;
  vignetteIntensity?: number;
  defaultPanelDistance?: number;
}

export interface LiveStreamOptions {
  topology?: string;
  mode?: 'window' | 'replace' | string;
  windowSize?: number;
}

export interface DracoTopologyNodeLike {
  artifact?: ArtifactRef | null;
  appendRows(rows: Record<string, unknown>[], options: { mode: string; limit: number }): boolean;
}

export interface LiveConnectorLike {
  topology?: string;
  windowSize?: number;
  isConnected(): boolean;
  connect(): void;
  disconnect(): void;
  onUpdate(fn: (update: LiveUpdate) => void): () => void;
  onStatus(fn: (status: string, detail?: string) => void): () => void;
}

export interface WorldFacadeForLiveStream {
  dracoNode?: DracoTopologyNodeLike | null;
  currentEntry?: { name?: string; [key: string]: unknown } | null;
  loadDataset(entry: unknown): void;
  vrMenu?: { setLiveConnected?(connected: boolean): void };
  vrConsole?: { log?(level: string, args: unknown[]): void; warn?(level: string, args: unknown[]): void };
}

export interface WorldFacadeForCollaboration {
  settingsPanel?: { getAllSettings(): Record<string, unknown> };
  networkPanel?: { setStatus(status: Record<string, unknown>): void };
  vrConsole?: { log?(level: string, args: unknown[]): void };
  telemetryCollector?: { recordOperation?(name: string): void };
  _logInteraction(action: string, details?: Record<string, unknown>): void;
  _buildWheelMenu(): void;
}

export interface NetworkEvent {
  type: string;
  peerId?: string;
  name?: string;
  detail?: Record<string, unknown>;
  data?: unknown;
  [key: string]: unknown;
}

export interface NetworkManagerLike {
  isConnected: boolean;
  roomId: string;
  room: { getPeers(): unknown[] };
  peerId: string;
  addEventListener(type: string, handler: (event: NetworkEvent) => void): void;
  connect(roomId?: string): Promise<void>;
  disconnect(): void;
  setLocalState(state: Record<string, unknown>): void;
}
