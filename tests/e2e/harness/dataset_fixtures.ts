/**
 * Dataset Fixtures Harness for E2E Tests.
 * Generates valid, edge-case, and malicious payloads for tabular, graph, hierarchy, geo, and binary data.
 */

export interface DatasetRow {
  [key: string]: any;
}

export function generateTabularCSV(rows = 10, cols = 4): string {
  const headers = Array.from({ length: cols }, (_, i) => `dim_${i + 1}`);
  const lines = [headers.join(',')];
  for (let r = 0; r < rows; r++) {
    const values = Array.from({ length: cols }, (_, c) => (Math.sin(r + c) * 100).toFixed(2));
    lines.push(values.join(','));
  }
  return lines.join('\n');
}

export function generateGraphCSV(rows = 10): string {
  const lines = ['source,target,weight,latency'];
  for (let r = 0; r < rows; r++) {
    const src = `node_${r}`;
    const tgt = `node_${(r + 1) % rows}`;
    const weight = (Math.random() * 10).toFixed(2);
    const latency = (Math.random() * 50 + 5).toFixed(1);
    lines.push(`${src},${tgt},${weight},${latency}`);
  }
  return lines.join('\n');
}

export function generateHierarchyCSV(rows = 10): string {
  const lines = ['parent,child,value'];
  lines.push('root,node_0,100');
  for (let r = 1; r < rows; r++) {
    const parent = `node_${Math.floor((r - 1) / 2)}`;
    const child = `node_${r}`;
    lines.push(`${parent},${child},${100 - r}`);
  }
  return lines.join('\n');
}

export function generateGeoCSV(rows = 10): string {
  const lines = ['lat,lng,elevation,city'];
  for (let r = 0; r < rows; r++) {
    const lat = (37.7749 + (r - rows / 2) * 0.01).toFixed(4);
    const lng = (-122.4194 + (r - rows / 2) * 0.01).toFixed(4);
    const elev = (10 + r * 5).toFixed(1);
    lines.push(`${lat},${lng},${elev},City_${r}`);
  }
  return lines.join('\n');
}

export function generatePollutedCSV(): string {
  return [
    '__proto__,constructor,prototype,valid_col',
    'polluted_value,polluted_func,polluted_proto,safe_val_1',
    'polluted_value2,polluted_func2,polluted_proto2,safe_val_2',
  ].join('\n');
}

export function generatePollutedJSON(): string {
  return JSON.stringify({
    name: 'Polluted Test Dataset',
    __proto__: { pollutedAdmin: true, role: 'root' },
    constructor: { prototype: { injected: true } },
    schema: {
      fields: [
        { name: 'id', type: 'number' },
        { name: '__proto__', type: 'string' },
      ],
    },
    data: [
      { id: 1, val: 42, __proto__: { payload: 'attack' } },
      { id: 2, val: 99 },
    ],
  });
}

export function generateCorruptedBinaryArrow(): ArrayBuffer {
  // Returns buffer with invalid Arrow magic bytes or truncated length
  const buf = new Uint8Array(32);
  buf.set([0x41, 0x52, 0x52, 0x4f, 0x57, 0x31], 0); // "ARROW1" header
  // Corrupt offset buffer length
  const view = new DataView(buf.buffer);
  view.setInt32(8, 0x7fffffff, true); // Extremely large length overflow
  return buf.buffer;
}

export function generateCorruptedFlatBuffers(): ArrayBuffer {
  // Returns truncated buffer missing root table offset
  const buf = new Uint8Array(8);
  const view = new DataView(buf.buffer);
  view.setUint32(0, 100, true); // Root table offset past end of buffer
  view.setUint32(4, 0x464c4154, true); // Identifier
  return buf.buffer;
}
