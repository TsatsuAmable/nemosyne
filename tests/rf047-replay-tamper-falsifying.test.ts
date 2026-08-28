import { describe, expect, it } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset } from '../src/data/Dataset.ts';
import { InvestigationReplayRunner } from '../src/session/InvestigationReplayRunner.ts';
import { NemosynePackageManager } from '../src/session/NemosynePackage.ts';
import { NemosyneSession } from '../src/session/NemosyneSession.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';
import { strToU8, strFromU8 } from 'fflate';

const DATASET = Dataset.fromJSON({
  name: 'RF047-tamper',
  columns: [{ name: 'x', type: 'number' }],
  rows: [{ x: 1 }, { x: 2 }, { x: 3 }],
});

function makeAtlas(sessionId: string): AtlasCore {
  const atlas = new AtlasCore({ kernel: makeKernelMockBridge(), sessionId });
  atlas.loadDataset(DATASET.clone());
  return atlas;
}

async function exportPayload(atlas: AtlasCore) {
  const session = new NemosyneSession({ atlas, sessionId: atlas.sessionId });
  const archive = await session.exportPortablePackage({ userAgent: 'rf047-tamper-test' });
  return NemosynePackageManager.unpack(archive);
}

async function replayPayload(payload: any, bridge: any) {
  const runner = new InvestigationReplayRunner(bridge);
  return runner.replayPayload(payload);
}

describe('RF-047 Clean-Room Replay — falsifying tamper detection via investigation digest', () => {
  it('detects tampered remediation requirementPatch via investigation digest mismatch', async () => {
    const atlas = makeAtlas('rf047-tamper-patch');
    const fingerprint = atlas.datasetFingerprint ?? '';

    atlas.aggregate.recordRemediation({
      remediationId: 'remediation:1',
      kind: 'adjust-hardware-limit',
      constraintCode: 'hardware-element-budget',
      category: 'hardware',
      scientificPermissibility: 'permissible',
      deviceFeasibility: 'unverified',
      datasetFingerprint: fingerprint,
      oldRequirementsHash: 'requirements:old',
      newRequirementsHash: 'requirements:new',
      requirementPatch: { hardwareConstraints: { maxElements: 20000 } },
      resultingDecisionId: 'decision:2',
      timestamp: 1787826400100,
    });

    const payload = await exportPayload(atlas);
    const originalDigest = payload.manifest.investigationDigest;

    // Tamper: change the requirementPatch in the command log
    const commandLog = JSON.parse(strFromU8(payload.commandLogBytes));
    const remediationEvent = commandLog.find((e: any) => e.kind === 'remediation');
    remediationEvent.remediationEvent.requirementPatch = { hardwareConstraints: { maxElements: 99999 } };
    payload.commandLogBytes = strToU8(JSON.stringify(commandLog));

    const replay = await replayPayload(payload, makeKernelMockBridge());

    // The investigation digest should differ because the command log changed
    expect(replay.investigationDigest).not.toBe(originalDigest);
    // And the replay should fail because the computed digest doesn't match manifest
    expect(replay.success).toBe(false);
    expect(replay.discrepancies.some(d => d.includes('Investigation digest mismatch'))).toBe(true);
  });

  it('detects reordered remediation events via investigation digest mismatch', async () => {
    const atlas = makeAtlas('rf047-tamper-reorder');
    const fingerprint = atlas.datasetFingerprint ?? '';

    atlas.aggregate.recordRemediation({
      remediationId: 'remediation:1',
      kind: 'adjust-hardware-limit',
      constraintCode: 'hardware-element-budget',
      category: 'hardware',
      scientificPermissibility: 'permissible',
      deviceFeasibility: 'unverified',
      datasetFingerprint: fingerprint,
      oldRequirementsHash: 'requirements:old',
      newRequirementsHash: 'requirements:new',
      requirementPatch: { hardwareConstraints: { maxElements: 20000 } },
      resultingDecisionId: 'decision:2',
      timestamp: 1787826400100,
    });

    atlas.aggregate.recordRemediation({
      remediationId: 'remediation:2',
      kind: 'adjust-parameter',
      constraintCode: 'parameter-budget',
      category: 'parameter',
      scientificPermissibility: 'permissible',
      deviceFeasibility: 'unverified',
      datasetFingerprint: fingerprint,
      oldRequirementsHash: 'requirements:new',
      newRequirementsHash: 'requirements:newer',
      requirementPatch: { parameterBudget: 1000 },
      resultingDecisionId: 'decision:3',
      timestamp: 1787826400200,
    });

    const payload = await exportPayload(atlas);
    const originalDigest = payload.manifest.investigationDigest;

    // Tamper: reorder remediation events in command log
    const commandLog = JSON.parse(strFromU8(payload.commandLogBytes));
    const remediationEvents = commandLog.filter((e: any) => e.kind === 'remediation');
    const otherEvents = commandLog.filter((e: any) => e.kind !== 'remediation');
    remediationEvents.reverse();
    payload.commandLogBytes = strToU8(JSON.stringify([...otherEvents, ...remediationEvents]));

    const replay = await replayPayload(payload, makeKernelMockBridge());

    expect(replay.investigationDigest).not.toBe(originalDigest);
    expect(replay.success).toBe(false);
    expect(replay.discrepancies.some(d => d.includes('Investigation digest mismatch'))).toBe(true);
  });

  it('detects dropped preflight in refusal event via investigation digest mismatch', async () => {
    const atlas = makeAtlas('rf047-tamper-preflight');
    const fingerprint = atlas.datasetFingerprint ?? '';

    atlas.evidenceLedger.recordRefusal(
      {
        operation: 'persistence',
        parameters: { maxDimension: 3 },
        inputFingerprint: fingerprint,
        provenance: {
          kernel: 'nemosyne-wasm',
          kernelVersion: atlas.kernelVersion() ?? 'unknown',
          operation: 'persistence',
          parameters: { maxDimension: 3 },
          inputFingerprint: fingerprint,
          outputFingerprint: '',
          timestamp: 1787826400200,
          outcome: 'refused',
        },
        preflight: {
          sourceRows: 3,
          eligibleRows: 3,
          excludedRows: 0,
          dimensions: 1,
          missingDataPolicy: 'complete-case',
          eligibilityMode: 'complete_case_selected_features',
          estimate: {
            operation: 'persistence',
            rows: 3,
            dimensions: 1,
            complexity: 'exponential',
            estimatedWorkUnits: 10000,
            estimatedTransientBytes: 1000,
            decision: 'unsupported_at_scale',
            reasonCode: 'RF047_TEST',
          },
          refusal: 'rf047 test refusal',
        },
        timestamp: 1787826400200,
        datasetFingerprint: fingerprint,
        datasetVersion: atlas.datasetVersion,
      },
      atlas.sessionId,
      atlas.datasetVersion,
      fingerprint,
    );

    const payload = await exportPayload(atlas);
    const originalDigest = payload.manifest.investigationDigest;

    // Tamper: remove preflight from refusal event in command log
    const commandLog = JSON.parse(strFromU8(payload.commandLogBytes));
    const refusalEvent = commandLog.find((e: any) => e.kind === 'refusal');
    delete refusalEvent.refusalEvent.preflight;
    payload.commandLogBytes = strToU8(JSON.stringify(commandLog));

    const replay = await replayPayload(payload, makeKernelMockBridge());

    expect(replay.investigationDigest).not.toBe(originalDigest);
    expect(replay.success).toBe(false);
    expect(replay.discrepancies.some(d => d.includes('Investigation digest mismatch'))).toBe(true);
  });

  it('detects tampered refusal provenance operation via investigation digest mismatch', async () => {
    const atlas = makeAtlas('rf047-tamper-refusal-op');
    const fingerprint = atlas.datasetFingerprint ?? '';

    atlas.evidenceLedger.recordRefusal(
      {
        operation: 'persistence',
        parameters: { maxDimension: 3 },
        inputFingerprint: fingerprint,
        provenance: {
          kernel: 'nemosyne-wasm',
          kernelVersion: atlas.kernelVersion() ?? 'unknown',
          operation: 'persistence',
          parameters: { maxDimension: 3 },
          inputFingerprint: fingerprint,
          outputFingerprint: '',
          timestamp: 1787826400200,
          outcome: 'refused',
        },
        preflight: {
          sourceRows: 3,
          eligibleRows: 3,
          excludedRows: 0,
          dimensions: 1,
          missingDataPolicy: 'complete-case',
          eligibilityMode: 'complete_case_selected_features',
          estimate: {
            operation: 'persistence',
            rows: 3,
            dimensions: 1,
            complexity: 'exponential',
            estimatedWorkUnits: 10000,
            estimatedTransientBytes: 1000,
            decision: 'unsupported_at_scale',
            reasonCode: 'RF047_TEST',
          },
          refusal: 'rf047 test refusal',
        },
        timestamp: 1787826400200,
        datasetFingerprint: fingerprint,
        datasetVersion: atlas.datasetVersion,
      },
      atlas.sessionId,
      atlas.datasetVersion,
      fingerprint,
    );

    const payload = await exportPayload(atlas);
    const originalDigest = payload.manifest.investigationDigest;

    // Tamper: change the refusal operation
    const commandLog = JSON.parse(strFromU8(payload.commandLogBytes));
    const refusalEvent = commandLog.find((e: any) => e.kind === 'refusal');
    refusalEvent.refusalEvent.operation = 'mapper';
    refusalEvent.refusalEvent.provenance.operation = 'mapper';
    payload.commandLogBytes = strToU8(JSON.stringify(commandLog));

    const replay = await replayPayload(payload, makeKernelMockBridge());

    expect(replay.investigationDigest).not.toBe(originalDigest);
    expect(replay.success).toBe(false);
    expect(replay.discrepancies.some(d => d.includes('Investigation digest mismatch'))).toBe(true);
  });

  it('verifies remediationEventsVerified and refusalEventsVerified counts match original when untampered', async () => {
    const atlas = makeAtlas('rf047-verify-counts');
    const fingerprint = atlas.datasetFingerprint ?? '';

    atlas.aggregate.recordRemediation({
      remediationId: 'remediation:1',
      kind: 'adjust-hardware-limit',
      constraintCode: 'hardware-element-budget',
      category: 'hardware',
      scientificPermissibility: 'permissible',
      deviceFeasibility: 'unverified',
      datasetFingerprint: fingerprint,
      oldRequirementsHash: 'requirements:old',
      newRequirementsHash: 'requirements:new',
      requirementPatch: { hardwareConstraints: { maxElements: 20000 } },
      resultingDecisionId: 'decision:2',
      timestamp: 1787826400100,
    });

    atlas.evidenceLedger.recordRefusal(
      {
        operation: 'persistence',
        parameters: { maxDimension: 3 },
        inputFingerprint: fingerprint,
        provenance: {
          kernel: 'nemosyne-wasm',
          kernelVersion: atlas.kernelVersion() ?? 'unknown',
          operation: 'persistence',
          parameters: { maxDimension: 3 },
          inputFingerprint: fingerprint,
          outputFingerprint: '',
          timestamp: 1787826400200,
          outcome: 'refused',
        },
        preflight: {
          sourceRows: 3,
          eligibleRows: 3,
          excludedRows: 0,
          dimensions: 1,
          missingDataPolicy: 'complete-case',
          eligibilityMode: 'complete_case_selected_features',
          estimate: {
            operation: 'persistence',
            rows: 3,
            dimensions: 1,
            complexity: 'exponential',
            estimatedWorkUnits: 10000,
            estimatedTransientBytes: 1000,
            decision: 'unsupported_at_scale',
            reasonCode: 'RF047_TEST',
          },
          refusal: 'rf047 test refusal',
        },
        timestamp: 1787826400200,
        datasetFingerprint: fingerprint,
        datasetVersion: atlas.datasetVersion,
      },
      atlas.sessionId,
      atlas.datasetVersion,
      fingerprint,
    );

    const session = new NemosyneSession({ atlas, sessionId: atlas.sessionId });
    const archive = await session.exportPortablePackage({ userAgent: 'rf047-verify-test' });
    const replay = await new InvestigationReplayRunner(makeKernelMockBridge()).replayArchive(archive);

    expect(replay.success).toBe(true);
    expect(replay.remediationEventsVerified).toBe(1);
    expect(replay.refusalEventsVerified).toBe(1);
  });
});