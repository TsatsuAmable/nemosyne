import { describe, expect, it } from 'vitest';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { NemosynePackageManager, type NemosynePackagePayload } from '../src/session/NemosynePackage.ts';
import { CANONICAL_DATASET_IDENTITY_ALGORITHM } from '../src/data/DatasetIdentity.ts';
import { sha256Hex } from '../src/security/CryptoHash.ts';

import { parsePersistedEvidenceReceiptsV1 } from '../src/data/evidence/PersistedEvidenceReceipts.ts';
import { buildCanonicalInvestigationInputV3, computeGovernedInvestigationDigest, type SemanticInvestigationState } from '../src/investigation/InvestigationDigest.ts';
import { InvestigationReplayRunner } from '../src/session/InvestigationReplayRunner.ts';
import type { WasmRuntimeBridgeFull } from '../src/atlas/AtlasCore.ts';

const entry = 'investigation/evidence-receipts.json';
function fixture(): NemosynePackagePayload {
  const evidenceReceiptBytes = strToU8(JSON.stringify({ schemaVersion: '1', bundle: {
    schemaVersion: '1', datasetFingerprint: 'a'.repeat(64), kernelVersion: 'test-kernel', receipts: [],
  }, uses: [] }));
  return {
    manifest: { formatVersion: 3, sessionId: 'test', datasetFingerprint: 'b'.repeat(64),
      datasetIdentityAlgorithm: CANONICAL_DATASET_IDENTITY_ALGORITHM,
      analyticalDatasetFingerprint: 'a'.repeat(64), analyticalKernelVersion: 'test-kernel',
      kernelVersion: 'test-kernel', datasetName: 'test', createdAt: 1, commandCount: 0,
      investigationDigestAlgorithm: 'sha256-canonical-investigation-v3', investigationDigest: 'c'.repeat(64),
      evidenceReceiptDigest: sha256Hex(evidenceReceiptBytes), environment: {} },
    evidenceReceiptBytes, datasetBytes: strToU8('{}'), commandLogBytes: strToU8('[]'),
  };
}

describe('RFC0009 opt-in V3 package boundary', () => {
  it('round trips exact receipt bytes without changing the portable dataset identity', () => {
    const payload = fixture();
    const restored = NemosynePackageManager.unpack(NemosynePackageManager.pack(payload));
    expect(Array.from(restored.evidenceReceiptBytes!)).toEqual(Array.from(payload.evidenceReceiptBytes!));
    expect(restored.manifest).toEqual(payload.manifest);
  });
  it('rejects stripped and byte-mutated V3; legacy ignores receipt metadata without exposing it', () => {
    const files = unzipSync(NemosynePackageManager.pack(fixture()));
    const stripped = { ...files }; delete stripped[entry];
    expect(() => NemosynePackageManager.unpack(zipSync(stripped))).toThrow(/evidence/i);
    expect(() => NemosynePackageManager.unpack(zipSync({ ...files, [entry]: strToU8('{}') }))).toThrow(/digest/i);
    const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']));
    manifest.formatVersion = 2;
    manifest.investigationDigestAlgorithm = 'sha256-canonical-investigation-v2';
    delete manifest.evidenceReceiptDigest;
    manifest.evidenceReceiptDigest = { historicallyUnknown: true };
    const legacy = NemosynePackageManager.unpack(zipSync({ ...files, 'manifest.json': strToU8(JSON.stringify(manifest)) }));
    expect(legacy.evidenceReceiptBytes).toBeUndefined();
    expect(legacy.manifest.evidenceReceiptDigest).toBeUndefined();
  });
});

function envelope() {
  return { schemaVersion: '1', bundle: {
    schemaVersion: '1', datasetFingerprint: 'a'.repeat(64), kernelVersion: 'test-kernel', receipts: [{
      receiptId: 'descriptive:x', claimId: 'descriptive:x', estimand: 'summary',
      measurementContext: { status: 'NOT_ESTABLISHED' }, geometry: null,
      assumptions: [{ assumption: 'finite', status: 'satisfied', detail: 'finite values' }],
      sampleSupport: { totalRows: 2, rowsUsed: 2, rowsExcluded: 0, columns: ['x'], policy: 'pairwiseComplete', exclusionReasons: [] },
      uncertainty: null, stability: null, sensitivity: [], limitations: ['descriptive only'],
      methodProvenance: { method: 'summary', methodVersion: 'v1', kernelVersion: 'test-kernel',
        datasetFingerprint: 'a'.repeat(64), parameters: [['timestamp', 'historical-parameter']] },
    }],
  }, uses: [{ consumerId: 'semantic-node:1', receiptId: 'descriptive:x', requirementProfileId: 'historical-profile/v1' }] };
}
function withEnvelope(value: unknown): NemosynePackagePayload {
  const payload = fixture();
  payload.evidenceReceiptBytes = strToU8(JSON.stringify(value));
  payload.manifest.evidenceReceiptDigest = sha256Hex(payload.evidenceReceiptBytes);
  return payload;
}
function state(): SemanticInvestigationState {
  return { datasetFingerprint: 'b'.repeat(64), immutableDatasetFingerprint: 'b'.repeat(64), kernelVersion: 'test-kernel',
    analyticalState: { datasetVersion: 1, datasetFingerprint: 'a'.repeat(64) },
    eventLedger: [], analysisResults: [], observations: [], findings: [], annotations: [] };
}

describe('V3 closed data and digest commitment', () => {
  it('snapshots/freeze preserves raw receipt values, order and unknown historical profile IDs', () => {
    const original = envelope();
    const parsed = parsePersistedEvidenceReceiptsV1(original);
    expect(parsed).toEqual(original);
    original.uses[0].receiptId = 'changed';
    original.bundle.receipts[0].limitations.push('changed');
    expect(parsed.uses[0].receiptId).toBe('descriptive:x');
    expect(parsed.bundle.receipts[0].limitations).toEqual(['descriptive only']);
    expect(Object.isFrozen(parsed.uses[0])).toBe(true);
    expect(Object.isFrozen(parsed.bundle.receipts[0].methodProvenance.parameters)).toBe(true);
  });

  const malformed: Array<[string, (value: ReturnType<typeof envelope>) => void]> = [
    ['extra envelope field', (value) => Object.assign(value, { authority: true })],
    ['extra use field', (value) => Object.assign(value.uses[0], { trusted: true })],
    ['duplicate use', (value) => value.uses.push({ ...value.uses[0] })],
    ['duplicate receipt', (value) => value.bundle.receipts.push({ ...value.bundle.receipts[0] })],
    ['empty consumer', (value) => { value.uses[0].consumerId = ''; }],
    ['boxed profile', (value) => Object.assign(value.uses[0], { requirementProfileId: { value: 'v1' } })],
    ['missing receipt reference', (value) => { delete (value.uses[0] as Partial<typeof value.uses[0]>).receiptId; }],
    ['wrong dataset', (value) => { value.bundle.datasetFingerprint = 'f'.repeat(64); }],
    ['wrong kernel', (value) => { value.bundle.kernelVersion = 'wrong'; }],
    ['wrong schema', (value) => { value.schemaVersion = '2'; }],
  ];
  it.each(malformed)('refuses %s in both pack and independently authored ZIP', (_name, mutate) => {
    const value = envelope(); mutate(value);
    const payload = withEnvelope(value);
    expect(() => NemosynePackageManager.pack(payload)).toThrow();
    const files = unzipSync(NemosynePackageManager.pack(fixture()));
    files[entry] = new Uint8Array(payload.evidenceReceiptBytes!);
    files['manifest.json'] = strToU8(JSON.stringify(payload.manifest));
    expect(() => NemosynePackageManager.unpack(zipSync(files))).toThrow();
  });

  it.each(['analyticalDatasetFingerprint', 'analyticalKernelVersion', 'evidenceReceiptDigest', 'investigationDigest', 'investigationDigestAlgorithm'] as const)(
    'requires V3 declaration %s', (key) => {
      const payload = fixture(); delete payload.manifest[key];
      expect(() => NemosynePackageManager.pack(payload)).toThrow();
    });

  it('accounts for receipt entry in each archive budget before parsing', () => {
    const payload = withEnvelope(envelope());
    const archive = NemosynePackageManager.pack(payload);
    const files = unzipSync(archive);
    const total = Object.values(files).reduce((sum, bytes) => sum + bytes.length, 0);
    expect(() => NemosynePackageManager.unpack(archive, { totalUncompressedBytes: total - 1 })).toThrow(/budget/);
    expect(() => NemosynePackageManager.unpack(archive, { singleEntryBytes: payload.evidenceReceiptBytes!.length - 1 })).toThrow(/single entry/);
    expect(() => NemosynePackageManager.unpack(archive, { entryCount: 3 })).toThrow(/too many/);
    expect(() => NemosynePackageManager.unpack(archive, { archiveBytes: archive.length - 1 })).toThrow(/maximum/);
  });

  it('commits raw semantics, uses/profile identity and exact member bytes', async () => {
    const value = envelope();
    const bytes = strToU8(JSON.stringify(value));
    const root = buildCanonicalInvestigationInputV3(state(), bytes);
    expect(root.governedEvidence.envelope).toEqual(value);
    expect(root.governedEvidence.memberDigest).toBe(sha256Hex(bytes));
    expect(root.schemaVersion).toBe(3);
    const digest = await computeGovernedInvestigationDigest(state(), bytes);
    const mutations = [
      (v: ReturnType<typeof envelope>) => { v.uses[0].consumerId = 'other'; },
      (v: ReturnType<typeof envelope>) => { v.uses[0].receiptId = 'other'; },
      (v: ReturnType<typeof envelope>) => { v.uses[0].requirementProfileId = 'other'; },
      (v: ReturnType<typeof envelope>) => { v.uses = []; },
      (v: ReturnType<typeof envelope>) => { v.bundle.receipts[0].estimand = 'other'; },
      (v: ReturnType<typeof envelope>) => { v.bundle.receipts[0].assumptions[0].status = 'violated'; },
      (v: ReturnType<typeof envelope>) => { v.bundle.receipts[0].limitations.push('other'); },
      (v: ReturnType<typeof envelope>) => { v.bundle.receipts[0].methodProvenance.parameters[0][1] = 'other'; },
      (v: ReturnType<typeof envelope>) => { v.bundle.receipts[0].sampleSupport.columns = ['y']; },
      (v: ReturnType<typeof envelope>) => { Object.assign(v.bundle.receipts[0], { uncertainty: { method: 'test', lower: 0, upper: 1, standardError: null } }); },
      (v: ReturnType<typeof envelope>) => { Object.assign(v.bundle.receipts[0], { stability: { method: 'test', score: 0.5, repetitions: 2 } }); },
      (v: ReturnType<typeof envelope>) => { Object.assign(v.bundle.receipts[0], { sensitivity: [{ factor: 'test', testedValues: ['a'], materiallyChanged: true }] }); },
      (v: ReturnType<typeof envelope>) => { Object.assign(v.bundle.receipts[0], { geometry: { columns: ['x'], metric: 'euclidean', transformations: [], missingnessPolicy: 'preserve' } }); },
    ];
    for (const mutate of mutations) {
      const changed = envelope(); mutate(changed);
      const payload = withEnvelope(changed);
      const restored = NemosynePackageManager.unpack(NemosynePackageManager.pack(payload));
      expect(await computeGovernedInvestigationDigest(state(), restored.evidenceReceiptBytes!)).not.toBe(digest);
    }
    expect(await computeGovernedInvestigationDigest(state(), strToU8(JSON.stringify(value, null, 2)))).not.toBe(digest);
    expect(() => buildCanonicalInvestigationInputV3({ ...state(), kernelVersion: 'wrong' }, bytes)).toThrow(/identity/);
    expect(() => buildCanonicalInvestigationInputV3({ ...state(), analyticalState: { datasetVersion: 1, datasetFingerprint: 'wrong' } }, bytes)).toThrow(/identity/);
  });

  it('refuses both V3 production replay entries before any bridge access, even with coherent hashes', async () => {
    let touched = false;
    const bridge = new Proxy({}, { get() { touched = true; throw new Error('bridge must remain untouched'); } }) as WasmRuntimeBridgeFull;
    const runner = new InvestigationReplayRunner(bridge);
    const payload = withEnvelope(envelope());
    payload.manifest.investigationDigest = await computeGovernedInvestigationDigest(state(), payload.evidenceReceiptBytes!);
    for (const result of [await runner.replayPayload(payload), await runner.replayArchive(NemosynePackageManager.pack(payload))]) {
      expect(result.success).toBe(false);
      expect(result.commandsReplayed).toBe(0);
      expect(result.discrepancies.join(' ')).toMatch(/governed V3 replay is not yet available/);
    }
    expect(touched).toBe(false);
    payload.manifest.formatVersion = 2;
    payload.manifest.investigationDigestAlgorithm = 'unknown';
    expect((await runner.replayPayload(payload)).success).toBe(false);
    expect(touched).toBe(false);
  });
});


describe('V3 additional adversarial controls', () => {
  it('packs one owned receipt snapshot despite changing payload getters', () => {
    const payload = withEnvelope(envelope());
    const original = payload.evidenceReceiptBytes!;
    const expected = new Uint8Array(original);
    let reads = 0;
    Object.defineProperty(payload, 'evidenceReceiptBytes', {
      get() { return ++reads === 1 ? original : strToU8('{}'); },
    });
    Object.defineProperty(payload, 'extraFiles', {
      get() { original.fill(32); return {}; },
    });
    const restored = NemosynePackageManager.unpack(NemosynePackageManager.pack(payload));
    expect(reads).toBe(1);
    expect(restored.evidenceReceiptBytes).toEqual(expected);
  });

  it('commits the same owned receipt snapshot when semantic state access mutates input', () => {
    const value = envelope();
    const bytes = strToU8(JSON.stringify(value));
    const expectedDigest = sha256Hex(bytes);
    const semanticState = state();
    Object.defineProperty(semanticState, 'kernelVersion', {
      get() { bytes.fill(32); return 'test-kernel'; },
    });
    const root = buildCanonicalInvestigationInputV3(semanticState, bytes);
    expect(root.governedEvidence.envelope).toEqual(value);
    expect(root.governedEvidence.memberDigest).toBe(expectedDigest);
  });

  it('rejects malformed UTF-8 even when its member hash is correct', () => {
    const payload = fixture();
    const text = new TextEncoder().encode(JSON.stringify(envelope()));
    const offset = text.indexOf('s'.charCodeAt(0));
    text[offset] = 0xff;
    payload.evidenceReceiptBytes = text;
    payload.manifest.evidenceReceiptDigest = sha256Hex(text);
    expect(() => NemosynePackageManager.pack(payload)).toThrow();
    expect(() => buildCanonicalInvestigationInputV3(state(), text)).toThrow();
    const files = unzipSync(NemosynePackageManager.pack(fixture()));
    files[entry] = text;
    files['manifest.json'] = strToU8(JSON.stringify(payload.manifest));
    expect(() => NemosynePackageManager.unpack(zipSync(files))).toThrow();
  });

  it('commits use order and coherent analytical identity changes', async () => {
    const value = envelope();
    value.uses.push({ ...value.uses[0], consumerId: 'semantic-node:2' });
    const original = await computeGovernedInvestigationDigest(state(), strToU8(JSON.stringify(value)));
    value.uses.reverse();
    expect(await computeGovernedInvestigationDigest(state(), strToU8(JSON.stringify(value)))).not.toBe(original);
    const changed = envelope();
    changed.bundle.datasetFingerprint = 'f'.repeat(64);
    changed.bundle.receipts[0].methodProvenance.datasetFingerprint = 'f'.repeat(64);
    const changedState = { ...state(), analyticalState: { datasetVersion: 1, datasetFingerprint: 'f'.repeat(64) } };
    const baseline = await computeGovernedInvestigationDigest(state(), strToU8(JSON.stringify(envelope())));
    expect(await computeGovernedInvestigationDigest(changedState, strToU8(JSON.stringify(changed)))).not.toBe(baseline);
  });

  it.each([1, 2])('preserves format %s unknown metadata behavior and does not export receipt data', (formatVersion) => {
    const payload = fixture();
    payload.manifest.formatVersion = formatVersion;
    payload.manifest.investigationDigestAlgorithm = formatVersion === 1 ? undefined : 'sha256-canonical-investigation-v2';
    Object.assign(payload.manifest, { evidenceReceiptDigest: ['historically unknown'], unrelatedFutureField: true });
    const restored = NemosynePackageManager.unpack(NemosynePackageManager.pack(payload));
    expect(restored.manifest.evidenceReceiptDigest).toBeUndefined();
    expect(restored.evidenceReceiptBytes).toBeUndefined();
  });
});
