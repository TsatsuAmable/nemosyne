import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  SpectralVolumeLayout,
  VRTopologyTranslator,
  PositionSemanticsEngine,
  VRChannels,
  RepresentationHypothesisEngine,
  type SolverResult,
  type DracoDataInput,
  type SpectralFacts,
  type DracoFacts,
} from '../src/draco/index.ts';

describe('Phase 6: FrequencyField Representation and Renderer', () => {
  it('computes valid 3D positions via SpectralVolumeLayout', () => {
    const rows = [
      { freq: 0.1, power: 5.0, time: 0 },
      { freq: 0.2, power: 8.5, time: 0 },
      { freq: 0.3, power: 2.1, time: 1 },
      { freq: 0.4, power: 1.0, time: 1 },
    ];

    const entries = SpectralVolumeLayout.compute(rows, {
      frequencyKey: 'freq',
      powerKey: 'power',
      timeKey: 'time',
      powerScale: 1.5,
      yOffset: 1.0,
    });

    expect(entries).toHaveLength(4);
    for (const entry of entries) {
      expect(entry.position).toBeInstanceOf(THREE.Vector3);
      expect(typeof entry.position.x).toBe('number');
      expect(typeof entry.position.y).toBe('number');
      expect(typeof entry.position.z).toBe('number');
      expect(entry.position.y).toBeGreaterThan(1.0);
    }
  });

  it('synthesizes Three.js artifact for SPECTRAL_VOLUME spec', () => {
    const solverResult: SolverResult = {
      spec: {
        layout: 'SPECTRAL_VOLUME',
        geometry: 'SPECTRAL_BAR',
        behavior: 'STATIC',
        interaction: 'FREQUENCY_PROBE',
      },
      facts: {
        topology: 'TIME_SERIES',
        rowCount: 8,
        nodeCount: 8,
        edgeCount: 0,
        depth: 1,
        numericColumns: 2,
        categoricalColumns: 0,
        temporalColumns: 1,
        hasTimeSeries: true,
        hasContinuousValues: true,
        density: 0.1,
        estimatedDensity: 0.1,
        outlierCount: 0,
        cardinalityOfColor: 0,
        hasHighCardinality: false,
        isLargeDataset: false,
        clusterCount: 1,
        columnStats: {},
        correlationMatrix: {},
        categoryDistribution: {},
        trendDirection: 'flat',
        seasonalityHint: true,
        hasOutliers: false,
        hasHighVariance: false,
        numericSkew: 0,
        topCategory: null,
      },
      cost: 4.5,
    };

    const dataInput: DracoDataInput = {
      topology: 'TIME_SERIES',
      rows: Array.from({ length: 8 }, (_, i) => ({ freq: i * 0.1, power: Math.sin(i) + 2 })),
      encodings: { time: 'freq', size: 'power' },
    };

    const artifact = VRTopologyTranslator.synthesizeArtifact(solverResult, dataInput);
    expect(artifact).toBeDefined();
    expect(artifact.group).toBeInstanceOf(THREE.Group);
    expect(artifact.nodeMeshes).toHaveLength(8);
  });

  it('returns SEMANTIC position semantics for SPECTRAL_VOLUME', () => {
    const semantics = PositionSemanticsEngine.inferSemantics('SPECTRAL_VOLUME');
    expect(semantics.type).toBe('SEMANTIC');
    expect(semantics.badgeLabel).toContain('FREQUENCY');
    expect(semantics.description).toContain('frequency bins');
  });

  it('includes spectral variants in VRChannels', () => {
    expect(VRChannels.LAYOUT).toContain('SPECTRAL_VOLUME');
    expect(VRChannels.GEOMETRY).toContain('SPECTRAL_BAR');
    expect(VRChannels.GEOMETRY).toContain('SPECTRAL_SURFACE');
    expect(VRChannels.INTERACTION).toContain('FREQUENCY_PROBE');
  });

  it('hypothesis engine selects FREQUENCY when spectral facts show periodicity', () => {
    const mockFacts: DracoFacts = {
      topology: 'TIME_SERIES',
      rowCount: 64,
      nodeCount: 64,
      edgeCount: 0,
      depth: 1,
      numericColumns: 1,
      categoricalColumns: 0,
      temporalColumns: 1,
      hasTimeSeries: true,
      hasContinuousValues: true,
      density: 0.1,
      estimatedDensity: 0.1,
      outlierCount: 0,
      cardinalityOfColor: 0,
      hasHighCardinality: false,
      isLargeDataset: false,
      clusterCount: 1,
      columnStats: {},
      correlationMatrix: {},
      categoryDistribution: {},
      trendDirection: 'flat',
      seasonalityHint: true,
      hasOutliers: false,
      hasHighVariance: false,
      numericSkew: 0,
      topCategory: null,
    };

    const mockSpectral: SpectralFacts = {
      dominantFrequencies: [0.0625],
      spectralEntropy: 0.20,
      powerSpectrumPeak: 0.82,
      directionalAnisotropy: 0.0,
      characteristicScale: 16.0,
      hasPeriodicity: true,
      periodicityConfidence: 0.90,
    };

    const decision = RepresentationHypothesisEngine.reason(mockFacts, null, undefined, {
      spectralFacts: mockSpectral,
    });

    expect(decision.representationFamily).toBe('FREQUENCY');
    expect(decision.evidence.some((e) => e.fact.includes('spectral periodicity'))).toBe(true);
  });
});
