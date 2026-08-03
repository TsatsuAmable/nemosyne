import { Dataset, ColumnType } from './Dataset.js';
import {
  makeSalesTable,
  makeOrgChart,
  makeWindField,
  makeSocialGraph,
  makeFinancialSeries,
  makeGeoCities,
  makeFlowProcess,
} from './SyntheticData.js';

export const supplyChainHierarchy = new Dataset(
  'Global Supply Chain',
  [
    { name: 'name', type: ColumnType.CATEGORICAL },
    { name: 'level', type: ColumnType.NUMERIC },
    { name: 'region', type: ColumnType.CATEGORICAL },
    { name: 'inventory', type: ColumnType.NUMERIC },
    { name: 'riskScore', type: ColumnType.NUMERIC },
  ],
  [
    { name: 'North America Hub', level: 0, region: 'Americas', inventory: 12000, riskScore: 0.2 },
    { name: 'EU Hub', level: 0, region: 'Europe', inventory: 9800, riskScore: 0.35 },
    { name: 'Asia Hub', level: 0, region: 'Asia', inventory: 15400, riskScore: 0.15 },
    { name: 'NYC Warehouse', level: 1, region: 'Americas', inventory: 3400, riskScore: 0.4 },
    { name: 'LA Warehouse', level: 1, region: 'Americas', inventory: 2800, riskScore: 0.3 },
    { name: 'Berlin Warehouse', level: 1, region: 'Europe', inventory: 4100, riskScore: 0.25 },
    { name: 'Paris Warehouse', level: 1, region: 'Europe', inventory: 2900, riskScore: 0.5 },
    { name: 'Tokyo Warehouse', level: 1, region: 'Asia', inventory: 5200, riskScore: 0.18 },
    { name: 'Singapore Warehouse', level: 1, region: 'Asia', inventory: 4700, riskScore: 0.22 },
    { name: 'Seoul DC', level: 2, region: 'Asia', inventory: 1500, riskScore: 0.6 },
    { name: 'Miami DC', level: 2, region: 'Americas', inventory: 1100, riskScore: 0.45 },
    { name: 'Munich DC', level: 2, region: 'Europe', inventory: 1300, riskScore: 0.28 },
  ]
);

export const fraudGraph = new Dataset(
  'Transaction Fraud Graph',
  [
    { name: 'id', type: ColumnType.CATEGORICAL },
    { name: 'amount', type: ColumnType.NUMERIC },
    { name: 'isFraud', type: ColumnType.CATEGORICAL },
    { name: 'hour', type: ColumnType.NUMERIC },
  ],
  [
    { id: 'A', amount: 120, isFraud: false, hour: 9 },
    { id: 'B', amount: 8500, isFraud: true, hour: 2 },
    { id: 'C', amount: 300, isFraud: false, hour: 14 },
    { id: 'D', amount: 9200, isFraud: true, hour: 3 },
    { id: 'E', amount: 150, isFraud: false, hour: 11 },
    { id: 'F', amount: 7800, isFraud: true, hour: 4 },
    { id: 'G', amount: 200, isFraud: false, hour: 16 },
    { id: 'H', amount: 11000, isFraud: true, hour: 1 },
  ]
);

fraudGraph.edges = [
  { source: 'A', target: 'B', weight: 0.8 },
  { source: 'B', target: 'D', weight: 0.9 },
  { source: 'C', target: 'E', weight: 0.3 },
  { source: 'D', target: 'F', weight: 0.7 },
  { source: 'E', target: 'G', weight: 0.2 },
  { source: 'F', target: 'H', weight: 0.6 },
  { source: 'A', target: 'C', weight: 0.1 },
];

export const sensorTimeSeries = new Dataset(
  'IoT Sensor Stream',
  [
    { name: 'time', type: ColumnType.TEMPORAL },
    { name: 'sensorId', type: ColumnType.CATEGORICAL },
    { name: 'temperature', type: ColumnType.NUMERIC },
    { name: 'vibration', type: ColumnType.NUMERIC },
  ],
  [
    { time: '2026-07-28T00:00:00', sensorId: 'S1', temperature: 22.1, vibration: 0.04 },
    { time: '2026-07-28T01:00:00', sensorId: 'S1', temperature: 22.4, vibration: 0.05 },
    { time: '2026-07-28T02:00:00', sensorId: 'S1', temperature: 23.0, vibration: 0.08 },
    { time: '2026-07-28T03:00:00', sensorId: 'S1', temperature: 24.2, vibration: 0.12 },
    { time: '2026-07-28T00:00:00', sensorId: 'S2', temperature: 19.5, vibration: 0.02 },
    { time: '2026-07-28T01:00:00', sensorId: 'S2', temperature: 19.8, vibration: 0.03 },
    { time: '2026-07-28T02:00:00', sensorId: 'S2', temperature: 20.2, vibration: 0.06 },
    { time: '2026-07-28T03:00:00', sensorId: 'S2', temperature: 21.0, vibration: 0.09 },
  ]
);

// Additional synthetic sample datasets.
export const salesTable = makeSalesTable(48);
export const orgChart = makeOrgChart(3);
export const windField = makeWindField(32);
export const socialGraph = makeSocialGraph(20);
export const financialSeries = makeFinancialSeries(48, 'MEMO');
export const geoCities = makeGeoCities(20);
export const flowProcess = makeFlowProcess(6);

export const allSampleDatasets = [
  {
    key: 'supply-chain',
    label: 'Supply Chain Hierarchy',
    dataset: supplyChainHierarchy,
    topology: 'HIERARCHY',
    depth: 3,
  },
  { key: 'fraud-graph', label: 'Fraud Transaction Graph', dataset: fraudGraph, topology: 'GRAPH' },
  {
    key: 'sensor-stream',
    label: 'IoT Sensor Stream',
    dataset: sensorTimeSeries,
    topology: 'TIME_SERIES',
  },
  {
    key: 'sales-table',
    label: 'Sales Performance Table',
    dataset: salesTable,
    topology: 'TABULAR',
  },
  {
    key: 'org-chart',
    label: 'Organization Chart',
    dataset: orgChart,
    topology: 'HIERARCHY',
    depth: 3,
  },
  { key: 'wind-field', label: 'Wind Vector Field', dataset: windField, topology: 'VECTOR_FIELD' },
  { key: 'social-graph', label: 'Social Influence Graph', dataset: socialGraph, topology: 'GRAPH' },
  {
    key: 'financial-series',
    label: 'Financial Candle Series',
    dataset: financialSeries,
    topology: 'TIME_SERIES',
  },
  { key: 'geo-cities', label: 'Global Cities Geospatial', dataset: geoCities, topology: 'GEO' },
  { key: 'flow-process', label: 'Process Flow Graph', dataset: flowProcess, topology: 'GRAPH' },
];

/** Find a sample dataset entry by its key. */
export function getSampleDataset(key) {
  return allSampleDatasets.find((d) => d.key === key);
}

/** Infer default encodings for a sample entry. */
export function getDefaultEncodings(entry) {
  const ds = entry.dataset;
  switch (entry.topology) {
    case 'HIERARCHY':
      return {
        color: ds.categoricalColumns[0]?.name,
        size: ds.numericColumns[0]?.name,
        pulse: ds.numericColumns[1]?.name,
      };
    case 'GRAPH':
      return { color: ds.categoricalColumns[0]?.name, size: ds.numericColumns[0]?.name };
    case 'TIME_SERIES':
      return {
        color: ds.categoricalColumns[0]?.name,
        size: ds.numericColumns[0]?.name,
        time: ds.temporalColumns[0]?.name,
        pulse: ds.numericColumns[1]?.name,
      };
    case 'VECTOR_FIELD':
      return { color: 'magnitude', size: 'magnitude' };
    case 'GEO':
      return {
        color: ds.categoricalColumns[0]?.name,
        size: ds.numericColumns[0]?.name,
        label: ds.categoricalColumns[0]?.name,
      };
    case 'TABULAR':
    default:
      return { color: ds.categoricalColumns[0]?.name, size: ds.numericColumns[0]?.name };
  }
}
