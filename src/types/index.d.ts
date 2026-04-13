/**
 * TypeScript Definitions for Nemosyne
 * Version: 1.1.0
 */

export interface NemosyneDataPacketOptions {
  id: string;
  value?: number;
  label?: string;
  category?: string;
  timestamp?: string | Date;
  position?: { x: number; y: number; z: number };
  relations?: {
    links?: Array<{ to: string; weight?: number }>;
  };
  metadata?: Record<string, any>;
  [key: string]: any;
}

export interface DataNativeEngineOptions {
  container?: HTMLElement | string;
  renderer?: 'aframe' | 'three';
  websocket?: {
    url: string;
    reconnect?: boolean;
    reconnectInterval?: number;
  };
  enableTelemetry?: boolean;
  debug?: boolean;
}

export interface LayoutEngineOptions {
  dimensions?: 2 | 3;
  bounds?: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
  constraints?: LayoutConstraint[];
}

export interface LayoutConstraint {
  type: 'attraction' | 'repulsion' | 'alignment';
  target: string | string[];
  strength?: number;
}

export interface TopologyDetectorOptions {
  confidenceThreshold?: number;
  preferForceLayout?: boolean;
}

export interface PropertyMapperOptions {
  colorScale?: string;
  sizeRange?: [number, number];
  defaultColor?: string;
}

export interface ResearchTelemetryOptions {
  enabled?: boolean;
  sessionId?: string;
  exportFormat?: 'json' | 'csv';
  anonymize?: boolean;
}

export interface QueryCriteria {
  [key: string]: any;
  $gt?: number;
  $lt?: number;
  $gte?: number;
  $lte?: number;
  $eq?: any;
  $ne?: any;
  $in?: any[];
  $nin?: any[];
  $exists?: boolean;
}

export type LayoutType = 
  | 'nemosyne-graph-force'
  | 'nemosyne-tree'
  | 'nemosyne-timeline-linear'
  | 'nemosyne-timeline-spiral'
  | 'nemosyne-scatter'
  | 'nemosyne-globe'
  | 'nemosyne-categorical-grid'
  | 'nemosyne-matrix';

export declare class NemosyneDataPacket {
  constructor(options: NemosyneDataPacketOptions);
  id: string;
  value?: number;
  position: { x: number; y: number; z: number };
  getBounds(): { min: number; max: number };
  clone(): NemosyneDataPacket;
}

export declare class DataNativeEngine {
  constructor(options?: DataNativeEngineOptions);
  
  // Data ingestion
  ingest(packet: NemosyneDataPacket): void;
  ingestBatch(packets: NemosyneDataPacket[]): void;
  
  // Layout
  layout(type: LayoutType, options?: Record<string, any>): Record<string, { x: number; y: number; z: number }>;
  setLayout(type: LayoutType): void;
  
  // Selection
  select(id: string): void;
  addToSelection(id: string): void;
  removeFromSelection(id: string): void;
  toggleSelection(id: string): void;
  clearSelection(): void;
  getSelection(): string[];
  
  // Query
  query(criteria: QueryCriteria): NemosyneDataPacket[];
  findOne(criteria: QueryCriteria): NemosyneDataPacket | undefined;
  
  // Visualization
  highlight(id: string): void;
  unhighlight(id: string): void;
  focus(id: string): void;
  resetView(): void;
  
  // Export
  toJSON(): string;
  toCSV(): string;
  fromJSON(json: string): void;
  
  // WebSocket
  connectWebSocket(): void;
  disconnectWebSocket(): void;
  
  // Events
  on(event: string, callback: (...args: any[]) => void): void;
  off(event: string, callback: (...args: any[]) => void): void;
  emit(event: string, ...args: any[]): void;
}

export declare class LayoutEngine {
  constructor(options?: LayoutEngineOptions);
  calculatePositions(packets: NemosyneDataPacket[], topology: LayoutType): Record<string, { x: number; y: number; z: number }>;
  forceDirectedLayout(packets: NemosyneDataPacket[], iterations?: number): Record<string, { x: number; y: number; z: number }>;
  treeLayout(packets: NemosyneDataPacket[]): Record<string, { x: number; y: number; z: number }>;
  timelineLayout(packets: NemosyneDataPacket[], type: 'linear' | 'spiral'): Record<string, { x: number; y: number; z: number }>;
}

export declare class TopologyDetector {
  constructor(options?: TopologyDetectorOptions);
  detect(packets: NemosyneDataPacket[]): LayoutType;
  validateTopology(topology: string): boolean;
  getConfidenceScores(packets: NemosyneDataPacket[]): Record<string, number>;
}

export declare class PropertyMapper {
  constructor(options?: PropertyMapperOptions);
  map(packet: NemosyneDataPacket): Record<string, any>;
  mapBatch(packets: NemosyneDataPacket[]): Record<string, any>[];
}

export declare class ResearchTelemetry {
  constructor(options?: ResearchTelemetryOptions);
  logInteraction(type: string, targetId: string, details?: Record<string, any>): void;
  logTaskCompletion(taskId: string, success: boolean, timeToComplete: number): void;
  trackNavigation(camera: any): void;
  exportData(format?: 'json' | 'csv'): string;
  generateSummary(): Record<string, any>;
}
