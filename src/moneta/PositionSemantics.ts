import type { VRLayout } from './types.ts';

export type PositionSemanticsType = 'SEMANTIC' | 'STRUCTURAL' | 'ALGORITHMIC_LAYOUT';

export interface PositionSemanticsDescriptor {
  type: PositionSemanticsType;
  layout: VRLayout;
  description: string;
  proximityMeaning: string;
  distanceWarning?: string;
  badgeLabel: string;
  badgeColor: string;
}

export class PositionSemanticsEngine {
  static inferSemantics(
    layout: VRLayout,
    _encodings?: Record<string, string>
  ): PositionSemanticsDescriptor {
    switch (layout) {
      case 'GEO_SURFACE':
        return {
          type: 'SEMANTIC',
          layout,
          badgeLabel: 'SEMANTIC [GEO]',
          badgeColor: '#00ffaa',
          description: '3D coordinates map geographic latitude, longitude, and elevation variables.',
          proximityMeaning: 'Physical / spatial proximity in geographic coordinates.',
        };

      case 'VECTOR_STREAMLINE':
        return {
          type: 'SEMANTIC',
          layout,
          badgeLabel: 'SEMANTIC [VECTOR]',
          badgeColor: '#00ccff',
          description: 'Positions encode vector flow magnitude and directional velocity components.',
          proximityMeaning: 'Trajectory alignment and flow streamline proximity.',
        };

      case 'TIME_RIBBON':
        return {
          type: 'SEMANTIC',
          layout,
          badgeLabel: 'SEMANTIC [TEMPORAL]',
          badgeColor: '#ffaa00',
          description: 'X-axis maps chronological timestamps while Y-axis maps metric magnitude.',
          proximityMeaning: 'Temporal co-occurrence and metric value similarity.',
        };

      case 'SPECTRAL_VOLUME':
        return {
          type: 'SEMANTIC',
          layout,
          badgeLabel: 'SEMANTIC [FREQUENCY]',
          badgeColor: '#00ffff',
          description: 'X-axis maps frequency bins, Y-axis maps spectral power, and Z-axis maps time window.',
          proximityMeaning: 'Harmonic spectral frequency co-occurrence and power density proximity.',
        };

      case 'FORCE_DIRECTED_3D':
        return {
          type: 'STRUCTURAL',
          layout,
          badgeLabel: 'STRUCTURAL [GRAPH]',
          badgeColor: '#bb88ff',
          description: 'Positions are calculated via spring-embedder force relaxation along graph edges.',
          proximityMeaning: 'Topological connectivity and path hop distance.',
          distanceWarning:
            'Proximity does NOT guarantee semantic attribute similarity without an explicit connecting edge.',
        };

      case 'RADIAL_ORBITAL':
        return {
          type: 'STRUCTURAL',
          layout,
          badgeLabel: 'STRUCTURAL [HIERARCHY]',
          badgeColor: '#ff66cc',
          description: 'Nodes are partitioned into concentric orbits by hierarchy level.',
          proximityMeaning: 'Cluster membership and partition hierarchy co-location.',
          distanceWarning: 'Relative distance between disparate orbits is non-metric.',
        };

      case 'GRID_3D':
      default:
        return {
          type: 'ALGORITHMIC_LAYOUT',
          layout,
          badgeLabel: 'LAYOUT [PROCEDURAL]',
          badgeColor: '#8899aa',
          description: 'Nodes are uniformly spaced across a regular 3D grid based on row index.',
          proximityMeaning: 'Sequential dataset row ordering.',
          distanceWarning:
            'Geometric distance carries NO semantic or topological meaning. Do not infer similarity from proximity.',
        };
    }
  }

  static formatHUDWarning(descriptor: PositionSemanticsDescriptor): string | null {
    if (descriptor.distanceWarning) {
      return `⚠️ [${descriptor.badgeLabel}] ${descriptor.distanceWarning}`;
    }
    return null;
  }
}
