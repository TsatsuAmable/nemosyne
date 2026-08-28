/**
 * Memory Palace Epistemic Object System — P1-U7
 *
 * First-class epistemic objects for the Memory Palace spatial reasoning graph.
 * Objects carry explicit lifecycle/state with non-color cues and restrained semantic color.
 */

import type { FocusLevel } from '../vr/interactions/FocusContextController.ts';

/**
 * Semantic colors for epistemic states — restrained palette, never pure primary.
 * Color is supplementary; non-color cues (shape, border, texture, animation) are primary.
 */
export const EPISTEMIC_COLORS = {
  // Lifecycle states
  notice: 0x88aaff,       // Muted blue — initial observation
  question: 0xffaa66,     // Muted orange — open question
  hypothesis: 0x66ccaa,   // Muted teal — testable hypothesis
  test: 0xaaaaff,         // Muted purple — analytical test in progress
  finding: 0x66ff88,      // Muted green — validated finding
  contradiction: 0xff6666, // Muted red — contradiction/refutation
  branch: 0xcc88ff,       // Muted violet — branch point

  // Validation states
  untested: 0x888888,
  under_investigation: 0xaaaaff,
  supported: 0x66ff88,
  refuted: 0xff6666,
  inconclusive: 0xffaa66,
  externally_validated: 0x88ffcc,

  // Relationship types
  supports: 0x66ff88,
  refutes: 0xff6666,
  extends: 0xaaaaff,
  contradicts: 0xff6666,
  branches_from: 0xcc88ff,
  depends_on: 0x88aaff,
} as const;

/**
 * Non-color visual cues for epistemic states (primary communication channel).
 * Color is supplementary per UX-03.
 */
export const EPISTEMIC_CUES = {
  notice: { shape: 'circle', border: 'solid', pulse: 'slow', texture: 'none' },
  question: { shape: 'hexagon', border: 'dashed', pulse: 'medium', texture: 'dots' },
  hypothesis: { shape: 'triangle', border: 'solid', pulse: 'fast', texture: 'lines' },
  test: { shape: 'square', border: 'dotted', pulse: 'steady', texture: 'grid' },
  finding: { shape: 'diamond', border: 'double', pulse: 'slow', texture: 'none' },
  contradiction: { shape: 'x', border: 'solid', pulse: 'fast', texture: 'crosshatch' },
  branch: { shape: 'pentagon', border: 'dashed', pulse: 'medium', texture: 'chevron' },
} as const;

export type EpistemicObjectKind =
  | 'notice'
  | 'question'
  | 'hypothesis'
  | 'test'
  | 'finding'
  | 'contradiction'
  | 'branch_point';

export type EpistemicValidationStatus =
  | 'untested'
  | 'under_investigation'
  | 'supported'
  | 'refuted'
  | 'inconclusive'
  | 'externally_validated';

export interface EpistemicObjectProvenance {
  datasetFingerprint: string;
  datasetVersion?: number;
  kernelVersion: string;
  investigationVersion: string;
  interactionLanguageVersion?: string;
  timestamp: number;
  authorId?: string;
}

export interface EpistemicObjectSpatialAnchor {
  position: readonly [number, number, number];
  referenceFrame: 'body_locked' | 'world_locked';
  datumIds?: readonly string[];
  structureIds?: readonly string[];
}

export interface EpistemicObject {
  id: string;
  kind: EpistemicObjectKind;
  title: string;
  description?: string;
  status: EpistemicValidationStatus;
  provenance: EpistemicObjectProvenance;
  spatialAnchor?: EpistemicObjectSpatialAnchor;
  tags?: readonly string[];
  confidence?: number; // 0-1, researcher judgement
  relevance?: number;  // 0-1, researcher judgement
  createdAt: number;
  updatedAt: number;
  version: number;
}

export interface EpistemicRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: 'supports' | 'refutes' | 'extends' | 'contradicts' | 'branches_from' | 'depends_on';
  strength: number; // 0-1
  evidenceIds?: readonly string[];
  note?: string;
  createdAt: number;
  provenance: EpistemicObjectProvenance;
}

export interface Beacon {
  id: string;
  epistemicObjectId: string;
  label: string;
  description?: string;
  intensity: number; // 0-1, visual prominence
  pulseRate: number; // Hz
  spatialAnchor: EpistemicObjectSpatialAnchor;
  visibility: 'always' | 'on_focus' | 'on_proximity';
  createdAt: number;
  updatedAt: number;
}

export interface ReasoningThread {
  id: string;
  name: string;
  description?: string;
  objectIds: readonly string[]; // Ordered sequence
  relationshipIds: readonly string[];
  focusLevel: FocusLevel;
  isCollapsed: boolean;
  color?: number; // Optional thread color for grouping
  createdAt: number;
  updatedAt: number;
}

export interface BranchPoint {
  id: string;
  name: string;
  description?: string;
  parentEpistemicId: string;
  childEpistemicIds: readonly string[];
  condition?: string; // Human-readable branching condition
  isActive: boolean;
  createdAt: number;
}

export interface MemoryPalaceGraphState {
  objects: Map<string, EpistemicObject>;
  relationships: Map<string, EpistemicRelationship>;
  beacons: Map<string, Beacon>;
  threads: Map<string, ReasoningThread>;
  branchPoints: Map<string, BranchPoint>;
  focusContext: {
    activeThreadId?: string;
    focusedObjectId?: string;
    zoomLevel: number;
  };
  version: number;
  updatedAt: number;
}

export interface MemoryPalaceSnapshot {
  schemaVersion: string;
  timestamp: number;
  objects: EpistemicObject[];
  relationships: EpistemicRelationship[];
  beacons: Beacon[];
  threads: ReasoningThread[];
  branchPoints: BranchPoint[];
  focusContext: MemoryPalaceGraphState['focusContext'];
}

export const EPISTEMIC_OBJECT_SCHEMA_VERSION = '1.0.0' as const;

export type { FocusLevel } from '../vr/interactions/FocusContextController.ts';