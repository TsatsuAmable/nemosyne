import { describe, it, expect } from 'vitest';
import { inferTopology, inferEncodingsForTopology } from '../../../src/data/TopologyInference.js';
import { CSVDataParser } from '../../../src/data/CSVDataParser.js';
import { generateTabularCSV, generateGraphCSV, generateHierarchyCSV, generateGeoCSV } from '../harness/dataset_fixtures.js';

describe('Feature 1: Data -> Draco Reverse Import Decoupling', () => {
  it('F1-TC1: inferTopology correctly resolves TABULAR dataset without importing from src/draco', () => {
    const csv = generateTabularCSV(10, 4);
    const ds = CSVDataParser.parseToDataset('TabularDS', csv);
    const topology = inferTopology(ds);
    expect(topology).toBe('TABULAR');
  });

  it('F1-TC2: inferTopology correctly infers GRAPH topology when dataset contains source and target columns', () => {
    const csv = generateGraphCSV(10);
    const ds = CSVDataParser.parseToDataset('GraphDS', csv);
    const topology = inferTopology(ds);
    expect(topology).toBe('GRAPH');
  });

  it('F1-TC3: inferTopology correctly infers HIERARCHY topology when dataset contains parent and child columns', () => {
    const csv = generateHierarchyCSV(10);
    const ds = CSVDataParser.parseToDataset('HierarchyDS', csv);
    const topology = inferTopology(ds);
    expect(topology).toBe('HIERARCHY');
  });

  it('F1-TC4: inferTopology correctly infers GEO topology when dataset contains lat and lng columns', () => {
    const csv = generateGeoCSV(10);
    const ds = CSVDataParser.parseToDataset('GeoDS', csv);
    const topology = inferTopology(ds);
    expect(topology).toBe('GEO');
  });

  it('F1-TC5: inferEncodingsForTopology returns encoding object using shared topology types without circular dependency', () => {
    const csv = generateTabularCSV(10, 4);
    const ds = CSVDataParser.parseToDataset('TabularDS2', csv);
    const encodings = inferEncodingsForTopology(ds, 'TABULAR');
    expect(encodings).toBeDefined();
    expect(typeof encodings).toBe('object');
    expect(Object.keys(encodings).length).toBeGreaterThan(0);
  });
});
