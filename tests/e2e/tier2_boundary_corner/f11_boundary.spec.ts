import { describe, it, expect } from 'vitest';
import { parseJSON, parseCSV } from '../../../src/data/Parsers.ts';
import { CSVDataParser } from '../../../src/data/CSVDataParser.ts';
import { Dataset } from '../../../src/data/Dataset.ts';
import { messagePackToDataset, datasetToMessagePack } from '../../../src/data/serializers/MessagePackSerializer.ts';
import { Room } from '../../../src/network/Room.ts';

describe('Tier 2 — Feature 11: Prototype Pollution Hardening (Boundary Cases)', () => {
  it('F11-BC1: parseJSON strips __proto__, constructor, and prototype from column names and row objects', () => {
    const maliciousJSON = JSON.stringify([
      {
        id: 1,
        name: 'test',
        __proto__: { polluted: true },
        constructor: { polluted: true },
        prototype: { polluted: true },
      },
    ]);

    const dataset = parseJSON(maliciousJSON);
    expect(dataset).toBeDefined();

    // Check that Object.prototype is not polluted
    const testObj: any = {};
    expect(testObj.polluted).toBeUndefined();

    // Check column names do not include prototype pollution keys
    const colNames = dataset.columns.map((c) => c.name);
    expect(colNames.includes('__proto__')).toBe(false);
    expect(colNames.includes('constructor')).toBe(false);
    expect(colNames.includes('prototype')).toBe(false);
  });

  it('F11-BC2: parseCSV with malicious header containing __proto__ does not pollute global prototype', () => {
    const maliciousCSV = `id,name,__proto__\n1,Alice,polluted_val`;

    const dataset = parseCSV(maliciousCSV);
    const testObj: any = {};
    expect(testObj.polluted_val).toBeUndefined();
    expect(testObj.polluted).toBeUndefined();
    expect(dataset.rows.length).toBe(1);
  });

  it('F11-BC3: Dataset.fromJSON rejects or strips __proto__ payload properties safely', () => {
    const rawObj = JSON.parse(`{
      "name": "MaliciousDataset",
      "columns": [{"name": "col1", "type": "NUMERIC"}],
      "rows": [{"col1": 10}],
      "__proto__": {"injected": "YES"}
    }`);

    const dataset = Dataset.fromJSON(rawObj);
    const check: any = {};
    expect(check.injected).toBeUndefined();
    expect(dataset.name).toBe('MaliciousDataset');
  });

  it('F11-BC4: MessagePack serializer deserializes without polluting Object.prototype', () => {
    const ds = new Dataset('MsgPackDS', [{ name: 'val', type: 'NUMERIC' }], [{ val: 123 }]);
    const bytes = datasetToMessagePack(ds);
    const restored = messagePackToDataset(bytes);

    const testObj: any = {};
    expect(testObj.val).toBeUndefined();
    expect(restored.name).toBe('MsgPackDS');
    expect(restored.rows.length).toBe(1);
  });

  it('F11-BC5: CSVDataParser.parseToDataset handles malicious quoted headers without prototype pollution', () => {
    const csv = `"id","__proto__","name"\n"1","{"polluted": true}","Bob"`;
    const dataset = CSVDataParser.parseToDataset('TestDS', csv);

    const testObj: any = {};
    expect(testObj.polluted).toBeUndefined();
    expect(dataset.rows.length).toBe(1);
  });

  it('F11-BC6: Dataset.fromJSON with __proto__ row data has no reachable injected property on rows', () => {
    const payload = JSON.parse(
      '{"name":"X","columns":[{"name":"v","type":"NUMERIC"}],"rows":[{"v":1,"__proto__":{"isAdmin":true}}]}'
    );
    const ds = Dataset.fromJSON(payload);

    expect(ds.rows.length).toBe(1);
    expect(Object.prototype.hasOwnProperty.call(ds.rows[0], '__proto__')).toBe(false);
    expect((ds.rows[0] as any).isAdmin).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(ds.rows[0], 'isAdmin')).toBe(false);
    expect((Object.prototype as any).isAdmin).toBeUndefined();
  });

  it('F11-BC7: Room.updatePeerState merges remote state without carrying dangerous keys or polluting Object.prototype', () => {
    const room = new Room('room-bc', 'localPeer', 'Alice');
    room.addPeer('remotePeer', 'Mallory');

    const maliciousState = JSON.parse(
      '{ "position": [1, 2, 3], "__proto__": { "isAdmin": true }, "constructor": { "polluted": true }, "prototype": { "polluted2": true } }'
    );
    room.updatePeerState('remotePeer', maliciousState);

    const state = room.peers.get('remotePeer')!.state as any;
    expect(state.position).toEqual([1, 2, 3]);
    expect(Object.prototype.hasOwnProperty.call(state, '__proto__')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(state, 'constructor')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(state, 'prototype')).toBe(false);
    expect(({} as any).isAdmin).toBeUndefined();
    expect((Object.prototype as any).polluted).toBeUndefined();
    expect((Object.prototype as any).polluted2).toBeUndefined();
  });
});
