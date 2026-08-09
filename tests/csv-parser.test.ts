import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CSVDataParser } from '../src/data/CSVDataParser.ts';
import { ColumnType } from '../src/data/Dataset.ts';
import { SchemaMappingPanel } from '../src/vr/ui/SchemaMappingPanel.ts';

describe('Sprint 13.1: CSV Data Parser & Schema Field Mapping Suite', () => {
  const sampleCSV = `region,revenue,margin,date
"North",120.5,15.2,2026-01-01
"South",250.0,22.8,2026-01-02
"East",180.2,18.5,2026-01-03`;

  it('parses raw CSV rows correctly with quotes and delimiters', () => {
    const rawRows = CSVDataParser.parseRawRows(sampleCSV);
    expect(rawRows.length).toBe(4);
    expect(rawRows[0]).toEqual(['region', 'revenue', 'margin', 'date']);
    expect(rawRows[1][0]).toBe('North');
  });

  it('infers column types accurately (NUMERIC, CATEGORICAL, TEMPORAL)', () => {
    const ds = CSVDataParser.parseToDataset('TestSales', sampleCSV);

    expect(ds.name).toBe('TestSales');
    expect(ds.columns.length).toBe(4);

    const regionCol = ds.columns.find((c) => c.name === 'region');
    const revenueCol = ds.columns.find((c) => c.name === 'revenue');
    const dateCol = ds.columns.find((c) => c.name === 'date');

    expect(regionCol?.type).toBe(ColumnType.CATEGORICAL);
    expect(revenueCol?.type).toBe(ColumnType.NUMERIC);
    expect(dateCol?.type).toBe(ColumnType.TEMPORAL);
  });

  it('casts numeric fields into JavaScript number values', () => {
    const ds = CSVDataParser.parseToDataset('TestSales', sampleCSV);
    expect(typeof ds.rows[0].revenue).toBe('number');
    expect(ds.rows[0].revenue).toBe(120.5);
  });

  it('allows analysts to cycle column types via SchemaMappingPanel', () => {
    const cameraGroup = new THREE.Group();
    const ds = CSVDataParser.parseToDataset('TestSales', sampleCSV);
    const panel = new SchemaMappingPanel(cameraGroup, { dataset: ds });

    expect(panel.workingColumns[1].type).toBe(ColumnType.NUMERIC);
    panel.toggleColumnType('revenue');
    expect(panel.workingColumns[1].type).toBe(ColumnType.CATEGORICAL);

    const updated = panel.applyMapping();
    expect(updated.columns[1].type).toBe(ColumnType.CATEGORICAL);
  });
});
