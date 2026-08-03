import { Dataset, ColumnType } from './Dataset.js';

/**
 * Utilities for generating deterministic synthetic datasets for demos and tests.
 */

export function makeSalesTable(rows = 60) {
  const regions = ['North', 'South', 'East', 'West'];
  const products = ['Widget', 'Gadget', 'Thingama', 'Doohickey'];
  const rows_ = [];
  for (let i = 0; i < rows; i++) {
    const region = regions[i % regions.length];
    const product = products[i % products.length];
    const units = Math.floor(20 + Math.random() * 480);
    const price = 10 + (i % 5) * 5;
    const revenue = units * price;
    const discount = Math.random() > 0.8 ? 0.2 : 0;
    rows_.push({ id: `S${i + 1}`, region, product, units, price, revenue, discount });
  }
  return new Dataset(
    'Sales Performance',
    [
      { name: 'id', type: ColumnType.CATEGORICAL },
      { name: 'region', type: ColumnType.CATEGORICAL },
      { name: 'product', type: ColumnType.CATEGORICAL },
      { name: 'units', type: ColumnType.NUMERIC },
      { name: 'price', type: ColumnType.NUMERIC },
      { name: 'revenue', type: ColumnType.NUMERIC },
      { name: 'discount', type: ColumnType.NUMERIC },
    ],
    rows_
  );
}

export function makeOrgChart(depth = 3, branching = [1, 3, 4, 2]) {
  const rows = [];
  let idCounter = 1;
  function addNode(name, level, parent) {
    const id = idCounter++;
    const employees = Math.floor(5 + Math.random() * 95);
    const budget = employees * (10000 + Math.random() * 50000);
    rows.push({ id, name, level, parent, employees, budget });
    return id;
  }

  const rootId = addNode('CEO', 0, null);
  const level1Ids = [];
  for (let i = 0; i < (branching[1] ?? 3); i++) {
    level1Ids.push(addNode(`VP-${String.fromCharCode(65 + i)}`, 1, rootId));
  }
  const level2Ids = [];
  for (const parent of level1Ids) {
    for (let i = 0; i < (branching[2] ?? 3); i++) {
      level2Ids.push(addNode(`Dir-${parent}-${i + 1}`, 2, parent));
    }
  }
  for (const parent of level2Ids) {
    for (let i = 0; i < (branching[3] ?? 3); i++) {
      addNode(`Team-${parent}-${i + 1}`, 3, parent);
    }
  }

  return new Dataset(
    'Organization Chart',
    [
      { name: 'id', type: ColumnType.NUMERIC },
      { name: 'name', type: ColumnType.CATEGORICAL },
      { name: 'level', type: ColumnType.NUMERIC },
      { name: 'parent', type: ColumnType.NUMERIC },
      { name: 'employees', type: ColumnType.NUMERIC },
      { name: 'budget', type: ColumnType.NUMERIC },
    ],
    rows
  );
}

export function makeWindField(count = 40) {
  const rows = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      id: `V${i}`,
      x: Math.random() * 10 - 5,
      y: Math.random() * 4,
      z: Math.random() * -10,
      u: Math.random() * 2 - 1,
      v: Math.random() * 0.5 - 0.25,
      w: Math.random() * 2 - 1,
      magnitude: 0,
    });
  }
  for (const r of rows) {
    r.magnitude = Math.sqrt(r.u * r.u + r.v * r.v + r.w * r.w);
  }
  return new Dataset(
    'Wind Vector Field',
    [
      { name: 'id', type: ColumnType.CATEGORICAL },
      { name: 'x', type: ColumnType.NUMERIC },
      { name: 'y', type: ColumnType.NUMERIC },
      { name: 'z', type: ColumnType.NUMERIC },
      { name: 'u', type: ColumnType.NUMERIC },
      { name: 'v', type: ColumnType.NUMERIC },
      { name: 'w', type: ColumnType.NUMERIC },
      { name: 'magnitude', type: ColumnType.NUMERIC },
    ],
    rows
  );
}

export function makeSocialGraph(nodes = 24) {
  const rows = [];
  const groups = ['A', 'B', 'C', 'D'];
  for (let i = 0; i < nodes; i++) {
    rows.push({
      id: `N${i}`,
      group: groups[i % groups.length],
      influence: Math.floor(10 + Math.random() * 990),
    });
  }
  const edges = [];
  for (let i = 0; i < nodes; i++) {
    const connections = 1 + Math.floor(Math.random() * 3);
    for (let j = 0; j < connections; j++) {
      const target = Math.floor(Math.random() * nodes);
      if (target !== i) {
        edges.push({ source: `N${i}`, target: `N${target}`, weight: Math.random() });
      }
    }
  }
  const ds = new Dataset(
    'Social Influence Graph',
    [
      { name: 'id', type: ColumnType.CATEGORICAL },
      { name: 'group', type: ColumnType.CATEGORICAL },
      { name: 'influence', type: ColumnType.NUMERIC },
    ],
    rows
  );
  ds.edges = edges;
  return ds;
}

/**
 * Generate a financial candle-like time-series: open/high/low/close per tick.
 */
export function makeFinancialSeries(ticks = 48, symbol = 'MEMO') {
  const rows = [];
  let price = 100 + Math.random() * 50;
  for (let i = 0; i < ticks; i++) {
    const open = price;
    const change = (Math.random() - 0.48) * 4;
    const close = Math.max(10, open + change);
    const high = Math.max(open, close) + Math.random() * 2;
    const low = Math.min(open, close) - Math.random() * 2;
    const volume = Math.floor(1000 + Math.random() * 9000);
    rows.push({
      time: `2026-07-28T${String(i).padStart(2, '0')}:00:00`,
      symbol,
      open,
      high,
      low,
      close,
      volume,
    });
    price = close;
  }
  return new Dataset(
    'Financial Series',
    [
      { name: 'time', type: ColumnType.TEMPORAL },
      { name: 'symbol', type: ColumnType.CATEGORICAL },
      { name: 'open', type: ColumnType.NUMERIC },
      { name: 'high', type: ColumnType.NUMERIC },
      { name: 'low', type: ColumnType.NUMERIC },
      { name: 'close', type: ColumnType.NUMERIC },
      { name: 'volume', type: ColumnType.NUMERIC },
    ],
    rows
  );
}

/**
 * Generate global city geospatial data with lat/lon and a numeric value.
 */
export function makeGeoCities(count = 20) {
  const cities = [
    { name: 'New York', lat: 40.7, lon: -74.0 },
    { name: 'London', lat: 51.5, lon: -0.1 },
    { name: 'Tokyo', lat: 35.7, lon: 139.7 },
    { name: 'Singapore', lat: 1.3, lon: 103.8 },
    { name: 'Sydney', lat: -33.9, lon: 151.2 },
    { name: 'Berlin', lat: 52.5, lon: 13.4 },
    { name: 'Sao Paulo', lat: -23.5, lon: -46.6 },
    { name: 'Mumbai', lat: 19.1, lon: 72.9 },
    { name: 'Lagos', lat: 6.5, lon: 3.4 },
    { name: 'Cairo', lat: 30.0, lon: 31.2 },
    { name: 'Mexico City', lat: 19.4, lon: -99.1 },
    { name: 'Bangkok', lat: 13.7, lon: 100.5 },
    { name: 'Istanbul', lat: 41.0, lon: 28.9 },
    { name: 'Seoul', lat: 37.6, lon: 127.0 },
    { name: 'Paris', lat: 48.9, lon: 2.3 },
    { name: 'Toronto', lat: 43.7, lon: -79.4 },
    { name: 'Dubai', lat: 25.2, lon: 55.3 },
    { name: 'Buenos Aires', lat: -34.6, lon: -58.4 },
    { name: 'Cape Town', lat: -33.9, lon: 18.4 },
    { name: 'Moscow', lat: 55.8, lon: 37.6 },
  ];
  const rows = cities.slice(0, count).map((c) => ({
    ...c,
    population: Math.floor(2 + Math.random() * 18),
    gdp: Math.floor(50 + Math.random() * 450),
  }));
  return new Dataset(
    'Global Cities',
    [
      { name: 'name', type: ColumnType.CATEGORICAL },
      { name: 'lat', type: ColumnType.NUMERIC },
      { name: 'lon', type: ColumnType.NUMERIC },
      { name: 'population', type: ColumnType.NUMERIC },
      { name: 'gdp', type: ColumnType.NUMERIC },
    ],
    rows
  );
}

/**
 * Generate a process-flow / supply-chain graph with weighted edges.
 */
export function makeFlowProcess(stages = 6) {
  const rows = [];
  for (let i = 0; i < stages; i++) {
    rows.push({
      id: `S${i}`,
      stage: i,
      label: `Stage ${i + 1}`,
      throughput: Math.floor(50 + Math.random() * 950),
      latency: Math.floor(10 + Math.random() * 200),
    });
  }
  const edges = [];
  for (let i = 0; i < stages - 1; i++) {
    edges.push({ source: `S${i}`, target: `S${i + 1}`, weight: 1 + Math.random() * 2 });
    if (Math.random() > 0.6) {
      const skip = Math.min(stages - 1, i + 2);
      edges.push({ source: `S${i}`, target: `S${skip}`, weight: Math.random() });
    }
  }
  const ds = new Dataset(
    'Process Flow',
    [
      { name: 'id', type: ColumnType.CATEGORICAL },
      { name: 'stage', type: ColumnType.NUMERIC },
      { name: 'label', type: ColumnType.CATEGORICAL },
      { name: 'throughput', type: ColumnType.NUMERIC },
      { name: 'latency', type: ColumnType.NUMERIC },
    ],
    rows
  );
  ds.edges = edges;
  return ds;
}
