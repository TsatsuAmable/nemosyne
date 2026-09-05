/**
 * Shared TypeScript types for the VR coordinator layer.
 *
 * These interfaces describe the shape of coordinator options, callbacks, and
 * the lightweight object references they exchange with `World.js`, panels, and
 * the data layer. They are intentionally permissive for three.js/JS class
 * boundaries that have not yet been typed.
 */

import type {
  BufferGeometry,
  Camera,
  Clock,
  Color,
  Group,
  Mesh,
  Object3D,
  Ray,
  Raycaster,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { Dataset } from '../../data/Dataset.ts';
import type { AnalysisHistory } from '../../data/AnalysisHistory.ts';
import type { EncodingMapping, TopologyType } from '../../data/types.ts';
import type { UXFrustrationAnalyzer } from '../../utils/UXFrustrationAnalyzer.ts';
import type { NemosyneEventMap } from '../../utils/EventBus.ts';

/** Entry describing a dataset to be loaded into the World. Shared with WorldSessionController. */
export interface DatasetLoadEntry {
  [key: string]: unknown;
  key?: string;
  name?: string;
  label?: string;
  topology: string;
  dataset: Dataset;
  maxDepth?: number;
  encodings?: EncodingMapping;
}

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
  | 'timeSlice'
  | 'compare';

export type LensMode = 'off' | 'statistical' | 'anomaly';

export interface ArtifactRef {
  nodeMeshes: Mesh[];
  group: Group;
}

/** Material shape commonly assumed by data-operation visual transforms. */
export interface NodeMaterialLike {
  opacity?: number;
  transparent?: boolean;
  color?: Color;
  emissive?: Color;
}

export interface AudioToneOptions {
  frequency?: number;
  duration?: number;
  shape?: 'sine' | 'square' | 'triangle' | 'sawtooth';
  attack?: number;
  release?: number;
  volume?: number;
}

export type FarcasterWarpCallback = (
  zone: string,
  position: number[],
  operation: string | null
) => void;

export interface OperationStrategy {
  (dataset: Dataset, originalDataset: Dataset): Dataset;
}

export interface VisualApplier {
  (artifact: ArtifactRef, dataset: Dataset, originalDataset?: Dataset): void;
}

export interface AccessibilityOptions {
  textScale: number;
  highContrast: boolean;
  colorblindMode: string | boolean;
  reduceMotion?: boolean;
  dwellSelection?: boolean;
  dwellTimeMs?: number;
  [key: string]: unknown;
}

export const DEFAULT_ACCESSIBILITY: AccessibilityOptions = {
  textScale: 1,
  highContrast: false,
  colorblindMode: 'none',
};

export interface MovablePanelOptions {
  title?: string;
  width?: number;
  height?: number;
  position?: [number, number, number];
  worldSize?: [number, number];
  titleBarHeight?: number;
  contentPadding?: number;
  tilt?: number;
  minDistance?: number;
  maxDistance?: number;
  parentGroup?: Group | null;
  textScale?: number;
  highContrast?: boolean;
  colorblindMode?: string | boolean;
}

export interface DragState {
  active: boolean;
  pointer: PointerLike | null;
  distance: number;
  offset: Vector3;
  lastTarget: Vector3;
}

export interface PanelButton {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  callback: () => void;
}

export interface PanelLike {
  mesh?: Object3D | null;
  title?: string;
  isMinimized?: boolean;
  defaultPosition?: Vector3;
  tilt?: number;
  parentGroup?: Group | null;
  drag?: DragState;
  applyAccessibility?(options: AccessibilityOptions): void;
  hide?(): void;
  render?(): void;
  // Panels registered as Engine updatables are ticked via `update`.
  update?(delta?: number, time?: number): void;
  getSetting?(key: string): unknown;
  handlePointerDown?(raycaster: Raycaster, pointer: PointerLike): string | null | undefined;
  handlePointerMove?(raycaster: Raycaster, pointer: PointerLike): void;
  handlePointerUp?(raycaster: Raycaster, pointer: PointerLike): void;
  onHide?: (() => void) | null;
  onDragDelta?: ((delta: Vector3) => void) | null;
  onDragEnd?: (() => void) | null;
  dispose?(): void;
}

export interface PanelManagerLike {
  panels: PanelLike[];
  register(panel: PanelLike): void;
  unregister?(panel: PanelLike): void;
  showPanel(panel: PanelLike): void;
  hidePanel(panel: PanelLike): void;
  togglePanel(panel: PanelLike): void;
  recenter(): void;
  toggleLauncher(): void;
  isLauncherVisible(): boolean;
  handleLauncherHit?(raycaster: Raycaster): PanelLike | null;
  getPanelPositions?(): { title?: string; position?: number[]; visible?: boolean }[];
  setPanelPositions?(positions: { title?: string; position?: number[]; visible?: boolean }[]): void;
  dispose?(): void;
}

export interface DashboardCell {
  index: number;
  col: number;
  row: number;
  x: number;
  y: number;
  z: number;
  angle: number;
  width: number;
  height: number;
  visible: boolean;
}

export interface DashboardPanelEntry {
  panel: PanelLike;
  zoneIndex: number | null;
}

export interface DashboardLike {
  wallGroup: Group;
  panels: DashboardPanelEntry[];
  zones: DashboardCell[];
  registerPanel(panel: PanelLike, zoneIndex?: number | null): void;
  unregisterPanel(panel: PanelLike): void;
  scrollBySlots(delta: number): void;
  resetDashboard(): void;
  getPanelCount(): number;
  dispose(): void;
}

export interface HandWheelMenuLike {
  group: Group;
  hand?: HandLike | null;
  isVisible(): boolean;
  setMenu(categories: WheelMenuCategory[]): void;
  toggle(): void;
  handlePointerClick?(raycaster: Raycaster): boolean | undefined;
  applyAccessibility?(options: AccessibilityOptions): void;
  // Registered as an Engine updatable; ticked via `update`.
  update?(delta?: number, time?: number): void;
  onVisibility?: ((visible: boolean, via: 'toggle' | 'show' | 'hide') => void) | null;
  dispose?(): void;
}

export interface WorldUIManagerLike {
  panelManager?: PanelManagerLike;
  dashboard?: DashboardLike;
  handWheelMenu?: HandWheelMenuLike;
  vrMenu?: (PanelLike & { setLiveConnected?(connected: boolean): void }) | null;
  vrConsole?: VRConsoleLike | null;
  telemetryPanel?: PanelLike | null;
  settingsPanel?: (SettingsPanelLike & PanelLike) | null;
  operationLogPanel?:
    (PanelLike & { setEntries?(entries: unknown[]): void; log?(msg: unknown): void }) | null;
  metricsPanel?: PanelLike | null;
  performancePanel?: PanelLike | null;
  networkPanel?: (PanelLike & { setStatus?(status: Record<string, unknown>): void }) | null;
  interactionCoach?: (PanelLike & { setUserMode?(mode: string): void }) | null;
  narrativeStrip?: NarrativeStripLike | null;
  miniOverview?: (PanelLike & { mesh?: Object3D; setEnabled?(enabled: boolean): void }) | null;
  peerPresenceHUD?: PanelLike | null;
  recommendationPanel?: (PanelLike & { markDirty?(): void }) | null;
  dracoExplainerPanel?: PanelLike | null;
  dispose?(): void;
  /** Lazy accessors for panels deferred from boot. Construct + register on first call. */
  getOrCreateOperationLogPanel?(): PanelLike | null;
  getOrCreateInteractionCoach?(): PanelLike | null;
  getOrCreateNarrativeStrip?(): NarrativeStripLike | null;
  /** Superuser / Dev Lab panel accessors (DEVELOPER mode only). */
  getOrCreateSchemaMappingPanel?(): PanelLike | null;
  /** Toggle the schema-mapping SpatialPanel (lifecycle mirrors settings). */
  toggleSchemaMappingPanel?(): void;
  getOrCreateGestureConfidenceHUD?(): PanelLike | null;
  /** Superuser service-class toggles (not PanelLike — construct + log for review). */
  toggleRepresentationCarousel?(): void;
  toggleTransientContextCards?(): void;
  toggleProgressiveDisclosure?(): void;
  toggleFrustrationResponseManager?(): void;
  toggleJITGestureHintManager?(): void;
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

/** Callbacks supplied to {@link VRMenu} for in-world dataset/operation actions. */
export interface VRMenuCallbacks {
  onLoadDataset?: (entry: {
    name: string;
    topology: TopologyType;
    dataset: Dataset;
    maxDepth?: number;
    encodings: EncodingMapping;
  }) => void;
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
  onCompare?: () => void;
  onReset?: () => void;
}

/** Typed shape of {@link SettingsPanel}.DEFAULTS. */
export interface SettingsMap {
  [key: string]: unknown;
  lensTDA: boolean;
  lensCorrelation: boolean;
  feedbackAudio: boolean;
  feedbackHaptic: boolean;
  feedbackVisual: boolean;
  gesturesEnabled: boolean;
  telemetryEnabled: boolean;
  /**
   * Production UX-trace recording (UXTraceRecorder outside dev builds).
   * Default false. When on, records buffer locally in memory only; export
   * is user-initiated download. Never transmits automatically.
   */
  prodTraceEnabled: boolean;
  colorblindMode: string;
  highContrast: boolean;
  textScale: number;
  dwellSelection: boolean;
  dwellTimeMs?: number;
  strictBudget: boolean;
  collabEnabled: boolean;
  collabRoom: string;
  collabName: string;
  userMode: string;
  snapTurn: boolean;
  snapTurnAngle: number;
  vignette: boolean;
  vignetteIntensity: number;
  seatedHeightOffset: number;
  defaultPanelDistance: number;
  reducedMotion: boolean;
  miniOverview: boolean;
  peerPresence: boolean;
}

/** Palette values for a {@link WorldTheme} preset. */
export interface WorldThemePalette {
  fogColor: number;
  fogDensity: number;
  ambientColor: number;
  ambientIntensity: number;
  pointColor: number;
  pointIntensity: number;
  gridColor1: number;
  gridColor2: number;
}

/** Alias for the full set of world-theme color values. */
export type WorldThemeColors = WorldThemePalette;

/** Minimal facade of the world theme used by coordinator types. */
export interface WorldThemeLike {
  currentPreset: string;
  applyPreset(name: string): boolean;
  cyclePreset(): string;
  dispose(): void;
}

/** Lightweight facade of desktop fallback controls. */
export interface DesktopControlsLike {
  enabled: boolean;
  enable(): void;
  disable(): void;
  dispose(): void;
}

/** Optional constructor bag for the core Engine. */
export interface EngineOptions {
  budgets?: Partial<PerformanceBudgets>;
  telemetry?: TelemetryCollectorLike;
}

/** Extended engine facade used by {@link World} and input coordinators. */
export interface EngineLike {
  camera?: Camera;
  cameraGroup: Group;
  scene: { add(object: Object3D): void; remove(object: Object3D): void };
  addUpdatable(obj: unknown): void;
  input: InputRouterLike;
  locomotion: LocomotionLike;
  renderer?: { xr: { getSession(): XRSession | null; isPresenting?: boolean } };
  setVignetteEnabled?(enabled: boolean, intensity?: number): void;

  theme?: WorldThemeLike;
  desktop?: DesktopControlsLike;
  clock?: Clock;
  performanceBudget?: PerformanceBudgetLike;
  telemetry?: TelemetryCollectorLike | null;
  headWorldPos?: Vector3;
  xrFrame?: XRFrame | null;
  xrRefSpace?: XRReferenceSpace | null;
  xrSession?: XRSession | null;
  onUndo?: (() => void) | null;
  onRedo?: (() => void) | null;
}

export interface Updatable {
  update(delta: number, time: number): void;
}

export interface InputRouterLike {
  hands: HandLike[];
  controllers: PointerLike[];
  feedback: FeedbackLike;
  panels: PanelLike[];
  removePanel?(panel: PanelLike): void;
  setPanelManager(manager: PanelManagerLike | null): void;
  addPanel(panel: PanelLike): void;
  setHandWheelMenu(menu: HandWheelMenuLike | null): void;
  setSuppressSceneSelection?(enabled: boolean): void;
  raycaster: { ray: Ray };
  raycastPanels?(): { panel: PanelLike; distance: number } | null;
}

export interface HandLike {
  index?: number;
  group?: Group;
  handedness?: string;
  pinchDistance?: number;
  rayOrigin?: { copy(v: unknown): void };
  rayDirection?: { copy(v: unknown): void };
  getHandTransform?(
    position: { set(x: number, y: number, z: number): void },
    quaternion: { set(x: number, y: number, z: number, w: number): void }
  ): void;
  getWorldPosition?(target: Vector3): Vector3;
  getRay?(target: Ray): Ray;
  isPinched?(): boolean;
  pinched?: boolean;
  jointsValid?: boolean;
  ray?: { visible: boolean };
}

/** Pointer abstraction shared by controllers and hand-tracking wrappers. */
export interface PointerLike extends HandLike {
  getRay(target: Ray): Ray;
  getWorldPosition?(target: Vector3): Vector3;
  setRayLength?(length: number): void;
  setRayVisible?(visible: boolean): void;
  onSelect?: ((pointer: PointerLike) => void) | null;
  onPinchStart?: ((pointer: PointerLike) => void) | null;
  onPinchEnd?: ((pointer: PointerLike) => void) | null;
  dispose?(): void;
  isPoseValid?(): boolean;
  update?(
    frame: XRFrame | null,
    referenceSpace: XRReferenceSpace | null,
    session: XRSession | null
  ): void;
}

export interface FeedbackLike {
  volume?: number;
  playGestureTone?(name: string): void;
  playHaptic?(intensity: number, durationMs: number): void;
  playHover?(): void;
  playSelect?(): void;
  playTone?(options: AudioToneOptions): void;
  playCoreTone?(mode: string): void;
  playPortalTone?(zone: string, operation?: string | null): void;
  setToggles?(toggles: { audio?: boolean; haptic?: boolean; visual?: boolean }): void;
  showHitMarker?(scene: Scene, position: Vector3, color: number, durationMs: number): void;
  flashPointer?(pointer: PointerLike): void;
  dispose?(): void;
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

/** Options bag accepted by a Locomotion-style controller. */
export interface LocomotionOptions {
  moveSpeed?: number;
  verticalSpeed?: number;
  flightSpeed?: number;
  snapAngle?: number;
  deadZone?: number;
  teleportMaxDistance?: number;
}

export type LocomotionMode = 'ground' | 'flight' | 'teleport';

/** Options bag accepted by desktop fallback controls. */
export interface DesktopControlsOptions {
  sensitivity?: number;
}

/** Options bag for creating a VR entry button. */
export interface VRButtonCreateOptions {
  renderer: WebGLRenderer;
}

/** Alias for VRButton configuration objects. */
export type VRButtonOptions = VRButtonCreateOptions;

export type PrivacyLevel = 'telemetry-only' | 'metadata' | 'full-session';

export interface TelemetryErrorSnapshot {
  message: string;
  time: number;
  isWarning?: boolean;
}

export interface TelemetryFrames {
  count: number;
  dropped: number;
  averageMs: number;
  lastMs: number;
  histogram: {
    under16: number;
    under33: number;
    under50: number;
    under100: number;
    over100: number;
  };
}

export interface TelemetrySession {
  durationSeconds: number;
  datasetName: string;
  datasetTopology: string;
}

export interface TelemetryReport {
  version: number;
  timestamp: number;
  enabled: boolean;
  session: TelemetrySession;
  frames: TelemetryFrames;
  operations: Record<string, number>;
  gestures: Record<string, number>;
  errors: {
    count: number;
    warnings: number;
    unhandledRejections: number;
    last: TelemetryErrorSnapshot | null;
  };
}

/**
 * Typed handler interface for panel content click/interaction delegation.
 * Replaces dynamic reflection / duck-typing in MovablePanel subclasses.
 */
export interface IPanelContentHandler {
  handleContentClick?(worldRaycaster: Raycaster): void;
  onPointerDown?(worldRaycaster: Raycaster, pointer: PointerLike): void;
  onPointerMove?(worldRaycaster: Raycaster, pointer: PointerLike): void;
  onPointerUp?(worldRaycaster: Raycaster, pointer: PointerLike): void;
  renderContent?(ctx: CanvasRenderingContext2D, width: number, height: number): void;
}

export interface TelemetryCollectorLike {
  enabled: boolean;
  frustrationAnalyzer: UXFrustrationAnalyzer;
  getReport(): TelemetryReport;
  loadConsent?(): void;
  saveConsent?(enabled: boolean): void;
  recordFrame?(deltaMs: number): void;
  recordDataset?(name: string, topology: string): void;
  recordOperation?(operation: string): void;
  recordGesture?(name: string): void;
  recordGestureConfidence?(name: string, confidence: number, isMisfire: boolean): void;
  recordPanelAction?(title: string, action: string): void;
  recordMenuAction?(name: string): void;
  recordDwell?(target: string, duration: number, completed: boolean): void;
  recordError?(err: unknown, isWarning?: boolean): void;
  setEnabled?(value: boolean): void;
}

export interface PerformanceViolation {
  id: string;
  severity: 'critical' | 'warning';
  message: string;
  value: number;
  budget: number;
  time?: number;
}

export interface PerformanceBudgets {
  frameMs?: number;
  droppedFramesPer10s?: number;
  drawCalls?: number;
  triangles?: number;
  points?: number;
  interactables?: number;
  updatables?: number;
  panels?: number;
  handTrackingMs?: number;
}

export interface PerformanceBudgetLike {
  budgets?: PerformanceBudgets;
  getViolations(): PerformanceViolation[];
  getBudgets(): PerformanceBudgets;
  check(snapshot: Record<string, unknown>): PerformanceViolation[];
  setBudgets?(budgets: Partial<PerformanceBudgets>): void;
  reset?(): void;
}

export interface WorldEventBusLike<TEvents extends object = NemosyneEventMap> {
  emit<K extends keyof TEvents & string>(topic: K, payload?: TEvents[K]): void;
  emitDynamic(topic: string, payload?: unknown): void;
  on<K extends keyof TEvents & string>(
    topic: K,
    handler: (payload: TEvents[K]) => void
  ): () => void;
  onDynamic(topic: string, handler: (payload: unknown) => void): () => void;
}

export interface GestureContext {
  source?: 'hand' | 'controller' | string;
  button?: string;
  input?: string;
  openHands?: boolean;
  [key: string]: unknown;
}

/** Minimal facade for controller gesture mappers used by {@link ControllerGestureBridge}. */
export interface ControllerGestureMapperLike {
  update(controllers: PointerLike[], session: XRSession | null, time: number): void;
}

/** Numeric LOD level returned by {@link LODManager.levelFor}. */
export type LODLevel = 0 | 1 | 2;

/** Candidate passed to LOD decisions (position + optional semantic data). */
export interface LODCandidate {
  position: Vector3;
  data?: unknown;
}

/** Options for constructing an {@link InstancedPointCloud}. */
export interface InstancedPointCloudOptions {
  maxCount?: number;
  geometry?: BufferGeometry | null;
}

/** Item passed to {@link InstancedPointCloud.setPoints}. */
export interface InstancedPointCloudItem {
  position: [number, number, number] | Vector3;
  color?: number | string;
  scale?: number;
  data?: unknown;
}

/** Update payload for {@link InstancedPointCloud.updateInstances}. */
export interface InstancedPointCloudUpdate {
  index: number;
  color?: number | string;
  scale?: number;
}

/** Hit result returned by {@link InstancedPointCloud.intersect}. */
export interface InstancedPointCloudHit {
  index: number;
  data: unknown;
  distance: number;
}

/** Minimal facade for a deterministic seedable RNG. */
export interface SeededRandomLike {
  seed: number;
  next(): number;
  range(min: number, max: number): number;
  rangeInt(min: number, max: number): number;
  pick<T>(array: T[]): T;
}

/** Options accepted by {@link downloadText}. */
export interface DownloadTextOptions {
  text: string;
  filename: string;
  mime?: string;
}

/** Options accepted by {@link downloadDataUrl}. */
export interface DownloadDataUrlOptions {
  dataUrl: string;
  filename: string;
}

/** Column schema snippet used in review-bundle metadata. */
export interface ReviewBundleColumnSchema {
  name: string;
  type: string;
}

/** Metadata block of an {@link AnalysisReviewBundle}. */
export interface ReviewBundleMetadata {
  datasetName: string;
  datasetTopology: string;
  rowCount: number;
  columnSchema: ReviewBundleColumnSchema[];
  sessionDurationSeconds: number;
  operations: Record<string, number>;
  gestures: Record<string, number>;
}

/** Analysis Review Bundle exported by {@link buildReviewBundle}. */
export interface AnalysisReviewBundle {
  version: number;
  generatedAt: number;
  appVersion: string;
  privacyLevel: PrivacyLevel;
  telemetry: TelemetryReport;
  performance: PerformanceViolation[];
  metadata?: ReviewBundleMetadata;
  session?: Record<string, unknown>;
  userNotes?: string;
}

/** Options accepted by {@link buildReviewBundle}. */
export interface ReviewBundleOptions {
  telemetryCollector: { getReport(): TelemetryReport };
  performanceBudget: { getViolations(): PerformanceViolation[] };
  appVersion?: string;
  privacyLevel?: PrivacyLevel;
  userNotes?: string;
  dataset?: unknown;
  datasetTopology?: string;
  sessionDurationSeconds?: number;
  sessionSnapshot?: unknown;
}

/** World-space console facade used for log/warn calls. */
export interface VRConsoleLike {
  log?(level: string, args: unknown[]): void;
  warn?(level: string, args: unknown[]): void;
}

/** Logging callback for analytics interactions. */
export type LogInteraction = (action: string, meta?: Record<string, unknown>) => void;

/** Locomotion surface accessed by the wheel-menu "views" category. */
export interface WorldLocomotionLike {
  toggleTeleport(): void;
  toggleFlight(): void;
  dropToFloor(): void;
  teleportToAnchor(name: string): boolean;
}

/** Haptic/audio feedback surface accessed by the landmark controller. */
export interface WorldFeedbackLike {
  playCoreTone?(mode: string): void;
  playHaptic?(intensity: number, durationMs: number): void;
}

/** Callbacks passed to `Engine.addInteractable`. */
export interface InteractableCallbacks {
  onEnter?(): void;
  onLeave?(): void;
  onSelect?(): void;
}

/** Engine slice accessed by the coordinators (camera, theme, locomotion, input, renderer). */
export interface WorldEngineLike {
  cameraGroup: {
    position: { toArray(): number[]; fromArray(array: number[]): void };
    rotation: { y: number };
  };
  theme?: { currentPreset: string; applyPreset?(name: string): boolean | void };
  locomotion: WorldLocomotionLike;
  input: { feedback?: WorldFeedbackLike };
  renderer?: { domElement?: { toDataURL(type: string): string } };
  onToggleLoadTestPanel?: (() => void) | null;
  onStartLoadTest?: (() => void) | null;
  onStopLoadTest?: (() => void) | null;
  addInteractable(object: Object3D, handlers?: Record<string, unknown>): void;
  exitVR?(): Promise<boolean> | void;
  isInVR?(): boolean;
}

/** Settings panel facade (getAllSettings is required; setSetting is optional). */
export interface SettingsPanelLike {
  mesh?: Object3D | null;
  getAllSettings(): SettingsMap;
  setSetting?(key: string, value: unknown): void;
}

/** Narrative strip extends a panel with history binding. */
export interface NarrativeStripLike extends PanelLike {
  setHistory?(history: AnalysisHistory): void;
}

/** Compatibility re-export; persistence contracts live in the neutral data/session layer. */
export type { SessionStoreLike } from '../../data/SessionStore.ts';

/** TechnoCore landmark facade. */
export interface CoreNodeLike {
  group?: Object3D;
  nextLensMode(): string;
}

/** Tooltip registration facade. */
export interface TooltipManagerLike {
  registerTarget(object: Object3D): void;
}

/** Portal landmark facade. */
export interface PortalLike {
  group?: Object3D;
}

/** Datum plane facade. */
export interface DatumLike {
  mesh?: Object3D;
}

/** Draco topology node facade (group + artefact node meshes). */
export interface DracoNodeFacadeLike {
  group?: Object3D;
  artifact?: { nodeMeshes?: Object3D[] } | null;
}

/** Data-operation controller facade (history length check). */
export interface DataOperationControllerLike {
  analysisHistory?: { length: number };
}

/** Guided-tour controls used by the tour coordinator. */
export interface GuidedTourLike {
  start?(): boolean;
  stop?(): void;
}

/** Collaboration coordinator facade. */
export interface CollaborationCoordinatorLike {
  isConnected(): boolean;
  update?(): void;
  peerAvatarManager?: unknown;
}

/** Comfort-settings controller facade. */
export interface ComfortSettingsControllerLike {
  apply(settings: SettingsMap): void;
  applyPanelDistance(distance: number): void;
}

/** User-mode controller facade. */
export interface UserModeControllerLike {
  apply(): void;
}

/** Saved panel position entry. */
export interface PanelPosition {
  title?: string;
  position?: number[];
  visible?: boolean;
}

/** Panel manager slice extended with session-restore panel positioning. */
export type WorldPanelManagerLike = PanelManagerLike & {
  getPanelPositions?(): PanelPosition[];
  setPanelPositions?(positions: PanelPosition[]): void;
};
