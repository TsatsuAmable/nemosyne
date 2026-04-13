/**
 * Core type definitions for Nemosyne
 * Data-native VR visualization framework
 */

// ============================================================================
// Data Packet Types
// ============================================================================

export interface NemosynePacketData {
  id: string;
  value: unknown;
  semantics?: PacketSemantics;
  relations?: PacketRelations;
  context?: PacketContext;
}

export interface PacketSemantics {
  type: DataType;
  structure: DataStructure;
  dimensions: number;
  scale: ScaleType;
  domain?: string;
  importance?: number;
  confidence?: number;
}

export interface PacketRelations {
  parent?: string;
  children?: string[];
  links?: Array<{ to: string; weight?: number; type?: string }>;
}

export interface PacketContext {
  timestamp?: number;
  importance?: number;
  confidence?: number;
  source?: string;
  tags?: string[];
}

export type DataType = 'quantitative' | 'categorical' | 'temporal' | 'spatial' | 'ordinal';
export type DataStructure = 'point' | 'tree' | 'graph' | 'grid' | 'cluster' | 'timeseries';
export type ScaleType = 'continuous' | 'discrete' | 'ordinal' | 'nominal';

// ============================================================================
// Topology Types
// ============================================================================

export interface TopologyProfile {
  structure: DataStructure;
  types: Record<DataType, number>;
  coordinateSpaces: Record<string, number>;
  scales: Record<ScaleType, number>;
  hasHierarchy: boolean;
  hasGraphLinks: boolean;
  averageLinksPerNode: number;
  hasTimestamps: boolean;
  timestampRange: number;
  isSequential: boolean;
  hasEmbeddings: boolean;
  averageDimensions: number;
  domains: Record<string, number>;
  hasGeoData: boolean;
  packetCount: number;
}

// ============================================================================
// Visual Types
// ============================================================================

export interface VisualProperties {
  geometry: GeometrySpec;
  material: MaterialSpec;
  color: string;
  emissive?: string;
  emissiveIntensity?: number;
  opacity: number;
  metalness?: number;
  roughness?: number;
  scale: Vector3;
  position?: Vector3;
  rotation?: Vector3;
}

export interface GeometrySpec {
  primitive: string;
  width?: number;
  height?: number;
  depth?: number;
  radius?: number;
}

export interface MaterialSpec {
  color: string;
  emissive?: string;
  emissiveIntensity?: number;
  opacity: number;
  metalness?: number;
  roughness?: number;
  shader?: string;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Vector2 {
  x: number;
  y: number;
}

// ============================================================================
// Animation Types
// ============================================================================

export interface AnimationConfig {
  property: string;
  from: string;
  to: string;
  dur: number;
  easing: EasingFunction;
  dir?: 'alternate' | 'normal';
  loop?: boolean | number;
  delay?: number;
}

export type EasingFunction = 
  | 'linear'
  | 'easeInQuad'
  | 'easeOutQuad'
  | 'easeInOutQuad'
  | 'easeInCubic'
  | 'easeOutCubic'
  | 'easeInOutCubic'
  | 'easeInElastic'
  | 'easeOutElastic'
  | 'easeInOutElastic';

export interface AnimatorOptions {
  duration?: number;
  easing?: EasingFunction;
}

// ============================================================================
// Gesture Types
// ============================================================================

export interface GestureEvent {
  type: GestureType;
  hand: HandData;
  target?: Entity | null;
  ray?: Vector3;
  position?: Vector3;
  direction?: Vector3;
  scale?: number;
  velocity?: number;
  confidence?: number;
}

export type GestureType = 'grab' | 'pinch' | 'swipe' | 'point' | 'release' | 'hover';

export interface HandData {
  id: string;
  position: Vector3;
  rotation: Vector3;
  fingers: FingerData[];
  pointingVector?: Vector3;
  gesture?: GestureType;
}

export interface FingerData {
  id: string;
  position: Vector3;
  extended: boolean;
  curl: number;
}

export interface GestureControllerOptions {
  enabled?: boolean;
  interactionRadius?: number;
  gestureThreshold?: number;
}

// ============================================================================
// Telemetry Types
// ============================================================================

export interface TelemetryData {
  gaze?: GazeData;
  head?: HeadData;
  hands?: HandData[];
  controllers?: ControllerData[];
  timestamp: number;
}

export interface GazeData {
  point: Vector3;
  direction: Vector3;
  fixation?: FixationData;
  confidence: number;
}

export interface FixationData {
  point: Vector3;
  duration: number;
  entity?: Entity | null;
}

export interface HeadData {
  position: Vector3;
  rotation: Vector3;
  velocity: number;
  acceleration: number;
}

export interface ControllerData {
  id: string;
  position: Vector3;
  rotation: Vector3;
  buttons: Record<string, boolean>;
  axes: number[];
}

export interface TelemetryAnalyzerOptions {
  fixationThreshold?: number;
  historyLength?: number;
  velocityThreshold?: number;
}

// ============================================================================
// Engine Types
// ============================================================================

export interface DataNativeEngineOptions {
  scene?: Entity | null;
  layout?: LayoutConfig;
  autoUpdate?: boolean;
  gestureEnabled?: boolean;
  telemetryEnabled?: boolean;
  debug?: boolean;
}

export interface LayoutConfig {
  type?: string;
  dimensions?: number;
  spacing?: number;
  bounds?: BoundingBox;
}

export interface BoundingBox {
  min: Vector3;
  max: Vector3;
}

// ============================================================================
// DOM/Entity Types (A-Frame/WebXR)
// ============================================================================

export interface Entity {
  id?: string;
  classList: DOMTokenList;
  dataset: Record<string, string>;
  parentNode: Entity | null;
  nemosyneData?: NemosynePacketData;
  
  getAttribute(name: string): unknown;
  setAttribute(name: string, value: unknown): void;
  removeAttribute(name: string): void;
  
  appendChild(child: Entity): void;
  removeChild(child: Entity): void;
  
  emit(eventName: string, detail?: unknown): void;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
}

// Augment global Document for A-Frame
declare global {
  interface Document {
    querySelector(selectors: 'a-scene'): Entity | null;
    createElement(tagName: string): Entity;
    dispatchEvent(event: Event): boolean;
  }
  
  interface CustomEvent<T = unknown> extends Event {
    detail: T;
  }
  
  class CustomEvent<T = unknown> extends Event {
    constructor(type: string, eventInitDict?: { detail?: T });
  }
}

// ============================================================================
// Event Types
// ============================================================================

export type EngineEventType = 
  | 'data-ingested'
  | 'data-updated'
  | 'data-removed'
  | 'data-cleared'
  | 'data-loaded'
  | 'selection-changed'
  | 'gesture-handled'
  | 'fixation-detected'
  | 'rapid-movement';

export interface EngineEvent<T = unknown> {
  type: EngineEventType;
  detail: T;
}

// ============================================================================
// Query Types
// ============================================================================

export interface QueryConditions {
  [key: string]: unknown | QueryOperator;
}

export interface QueryOperator {
  $gt?: number;
  $lt?: number;
  $gte?: number;
  $lte?: number;
  $in?: unknown[];
  $exists?: boolean;
}

// ============================================================================
// Export Types
// ============================================================================

export interface ExportData {
  dataPackets: Array<{ id: string; data: NemosynePacketData }>;
  metadata?: ExportMetadata;
}

export interface ExportMetadata {
  version: string;
  timestamp: number;
  packetCount: number;
  topology?: TopologyProfile;
}

export interface PerformanceMetrics {
  packetCount: number;
  artefactCount: number;
  timestamp: number;
  renderTime?: number;
  memoryUsage?: number;
}

export interface EngineState {
  dataPackets: Array<[string, NemosynePacketData]>;
  artefacts: string[];
  selection: string[];
  layout: string;
}
