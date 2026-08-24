// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { PositionSemanticsEngine } from '../src/moneta/PositionSemantics.ts';

describe('Position Semantics Discipline & Disambiguation (Sprint 26.1)', () => {
  it('correctly classifies SEMANTIC spatial layouts (GeoSurface, Streamline, TimeRibbon)', () => {
    const geo = PositionSemanticsEngine.inferSemantics('GEO_SURFACE');
    expect(geo.type).toBe('SEMANTIC');
    expect(geo.badgeLabel).toBe('SEMANTIC [GEO]');
    expect(geo.distanceWarning).toBeUndefined();

    const stream = PositionSemanticsEngine.inferSemantics('VECTOR_STREAMLINE');
    expect(stream.type).toBe('SEMANTIC');
    expect(stream.badgeLabel).toBe('SEMANTIC [VECTOR]');

    const ribbon = PositionSemanticsEngine.inferSemantics('TIME_RIBBON');
    expect(ribbon.type).toBe('SEMANTIC');
    expect(ribbon.badgeLabel).toBe('SEMANTIC [TEMPORAL]');
  });

  it('correctly classifies STRUCTURAL topological layouts with cautionary proximity warnings', () => {
    const graph = PositionSemanticsEngine.inferSemantics('FORCE_DIRECTED_3D');
    expect(graph.type).toBe('STRUCTURAL');
    expect(graph.badgeLabel).toBe('STRUCTURAL [GRAPH]');
    expect(graph.distanceWarning).toBeDefined();
    expect(graph.distanceWarning).toContain('Proximity does NOT guarantee semantic attribute similarity');

    const warning = PositionSemanticsEngine.formatHUDWarning(graph);
    expect(warning).toContain('⚠️ [STRUCTURAL [GRAPH]]');
  });

  it('correctly classifies ALGORITHMIC_LAYOUT and warns against false inference on 3D grid', () => {
    const grid = PositionSemanticsEngine.inferSemantics('GRID_3D');
    expect(grid.type).toBe('ALGORITHMIC_LAYOUT');
    expect(grid.badgeLabel).toBe('LAYOUT [PROCEDURAL]');
    expect(grid.distanceWarning).toContain('Geometric distance carries NO semantic or topological meaning');

    const warning = PositionSemanticsEngine.formatHUDWarning(grid);
    expect(warning).toContain('⚠️ [LAYOUT [PROCEDURAL]]');
  });
});
