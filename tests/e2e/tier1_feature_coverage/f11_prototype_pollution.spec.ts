import { describe, it, expect } from 'vitest';
import { Dataset } from '../../../src/data/Dataset.js';
import { CSVDataParser } from '../../../src/data/CSVDataParser.js';
import { Room } from '../../../src/network/Room.js';
import { generatePollutedCSV, generatePollutedJSON } from '../harness/dataset_fixtures.js';

describe('Feature 11: Prototype Pollution Hardening', () => {
  it('F11-TC1: CSV parsing with __proto__ header does not pollute Object prototype', () => {
    const csv = generatePollutedCSV();
    const ds = CSVDataParser.parseToDataset('PollutedCSV', csv);

    expect(ds).toBeDefined();
    // Verify Object prototype is unpolluted
    expect((Object.prototype as any).pollutedAdmin).toBeUndefined();
    expect((Object.prototype as any).polluted_value).toBeUndefined();
  });

  it('F11-TC2: Dataset.fromJSON ignores __proto__ and constructor keys during reconstruction', () => {
    const json = generatePollutedJSON();
    const parsedObj = JSON.parse(json);
    const ds = Dataset.fromJSON({
      name: 'PollutedJSON',
      columns: [{ name: 'val', type: 'NUMERIC' }],
      rows: parsedObj.data,
    });

    expect(ds).toBeDefined();
    expect((Object.prototype as any).pollutedAdmin).toBeUndefined();
    expect((Object.prototype as any).injected).toBeUndefined();
  });

  it('F11-TC3: Ingesting malicious row objects with __proto__ keys filters keys out safely', () => {
    const rowWithProto = JSON.parse('{ "id": 1, "__proto__": { "isAdmin": true } }');
    const ds = new Dataset('TestDS', [{ name: 'id', type: 'NUMERIC' }], [rowWithProto]);

    expect(ds.rows.length).toBe(1);
    expect((Object.prototype as any).isAdmin).toBeUndefined();
  });

  it('F11-TC4: Property lookups on plain object prototypes return undefined for attack keys', () => {
    const csv = generatePollutedCSV();
    CSVDataParser.parseToDataset('AttackCheck', csv);

    const testObj: any = {};
    expect(testObj.polluted_proto).toBeUndefined();
    expect(testObj.pollutedAdmin).toBeUndefined();
  });

  it('F11-TC5: Object.freeze protected structures remain secure during dataset transformations', () => {
    const frozenProto = Object.freeze({ secure: true });
    const csv = generatePollutedCSV();
    CSVDataParser.parseToDataset('FrozenCheck', csv);

    expect((frozenProto as any).pollutedAdmin).toBeUndefined();
    expect((frozenProto as any).polluted_value).toBeUndefined();
  });

  it('F11-TC6: Dataset.fromJSON strips __proto__ row keys and leaves no reachable isAdmin on rows', () => {
    const payload = JSON.parse(
      '{"name":"X","columns":[{"name":"v","type":"NUMERIC"}],"rows":[{"v":1,"__proto__":{"isAdmin":true}}]}'
    );
    const ds = Dataset.fromJSON(payload);

    expect(ds.rows.length).toBe(1);
    // The dangerous key must not survive as an own property of the row.
    expect(Object.prototype.hasOwnProperty.call(ds.rows[0], '__proto__')).toBe(false);
    // No row should expose the injected privilege.
    expect((ds.rows[0] as any).isAdmin).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(ds.rows[0], 'isAdmin')).toBe(false);
    // And the global prototype must remain clean.
    expect((Object.prototype as any).isAdmin).toBeUndefined();
  });

  it('F11-TC7: Dataset constructor strips constructor and prototype row keys along with __proto__', () => {
    const rows = [
      JSON.parse('{ "id": 1, "__proto__": { "a": 1 }, "constructor": { "b": 2 }, "prototype": { "c": 3 }, "keep": 4 }'),
    ];
    const ds = new Dataset('Hardening', [{ name: 'id', type: 'NUMERIC' }], rows);

    expect(ds.rows.length).toBe(1);
    const row = ds.rows[0] as any;
    expect(Object.prototype.hasOwnProperty.call(row, '__proto__')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(row, 'constructor')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(row, 'prototype')).toBe(false);
    expect(row.keep).toBe(4);
    expect((Object.prototype as any).a).toBeUndefined();
    expect((Object.prototype as any).b).toBeUndefined();
    expect((Object.prototype as any).c).toBeUndefined();
  });

  it('F11-TC8: Dataset.updateRows sanitizes live-streamed rows carrying __proto__', () => {
    const ds = new Dataset('Live', [{ name: 'v', type: 'NUMERIC' }], [{ v: 0 }]);
    const maliciousRow = JSON.parse('{ "v": 1, "__proto__": { "isAdmin": true } }');

    ds.updateRows([maliciousRow], 'append');

    expect(ds.rows.length).toBe(2);
    expect(Object.prototype.hasOwnProperty.call(ds.rows[1], '__proto__')).toBe(false);
    expect((ds.rows[1] as any).isAdmin).toBeUndefined();
    expect((Object.prototype as any).isAdmin).toBeUndefined();
  });

  it('F11-TC9: Room.updatePeerState strips __proto__/constructor/prototype from remote peer state', () => {
    const room = new Room('room-sec', 'localPeer', 'Alice');
    room.addPeer('remotePeer', 'Mallory');

    const maliciousState = JSON.parse(
      '{ "position": [1, 2, 3], "__proto__": { "isAdmin": true }, "constructor": { "x": 1 }, "prototype": { "y": 2 } }'
    );
    const ok = room.updatePeerState('remotePeer', maliciousState);

    expect(ok).toBe(true);
    const state = room.peers.get('remotePeer')!.state as any;
    expect(state.position).toEqual([1, 2, 3]);
    expect(Object.prototype.hasOwnProperty.call(state, '__proto__')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(state, 'constructor')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(state, 'prototype')).toBe(false);
    expect(({} as any).isAdmin).toBeUndefined();
    expect((Object.prototype as any).isAdmin).toBeUndefined();
  });

  it('F11-TC10: Room.setLocalState strips __proto__ from local state merge', () => {
    const room = new Room('room-sec2', 'localPeer', 'Alice');
    const maliciousState = JSON.parse('{ "camera": [0, 0, 0], "__proto__": { "isAdmin": true } }');

    room.setLocalState(maliciousState);

    const state = room.localState as any;
    expect(state.camera).toEqual([0, 0, 0]);
    expect(Object.prototype.hasOwnProperty.call(state, '__proto__')).toBe(false);
    expect(({} as any).isAdmin).toBeUndefined();
    expect((Object.prototype as any).isAdmin).toBeUndefined();
  });
});
