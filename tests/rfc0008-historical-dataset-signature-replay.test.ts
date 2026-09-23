import { describe, expect, it } from 'vitest';
import { strFromU8, strToU8 } from 'fflate';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset } from '../src/data/Dataset.ts';
import {
  INVESTIGATION_DIGEST_ALGORITHM,
  semanticEntityHash,
} from '../src/investigation/index.ts';
import type { RepresentationDecision } from '../src/moneta/representation/RepresentationDecision.ts';
import {
  NEMOSYNE_PACKAGE_FORMAT_VERSION,
  NemosynePackageManager,
  type NemosynePackagePayload,
} from '../src/session/NemosynePackage.ts';
import { NemosyneSession } from '../src/session/NemosyneSession.ts';
import { InvestigationReplayRunner } from '../src/session/InvestigationReplayRunner.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';

/**
 * RFC 0008 — historical DatasetSignature keys inside persisted representation
 * decisions survive verbatim replay and remain digest-bearing.
 *
 * The TEC2 heuristic-terminology slice deleted two pre-TEC2 TypeScript
 * DatasetSignature keys (`dependence.significantPairsCount` and
 * `spectralStructure.periodicityConfidence`) from the live type and fact
 * paths. Those keys can still exist as historical content inside
 * `investigation/representation.json` of v2 `.nemosyne` packages exported
 * before the slice. Replay restores the decision verbatim
 * (`parseRepresentationDecision` → `RepresentationState.restoreDecision`, no
 * signature-key validation) and the full decision is committed into the v2
 * digest through `representationStateHash`, so historical packages must
 * replay unchanged while any deletion of a retired key fails closed on the
 * manifest `investigationDigest`.
 */

const RETIRED_SIGNIFICANT_PAIRS = 3;
const RETIRED_PERIODICITY_CONFIDENCE = 0.42;

// Historical signature content as exported before TEC2 deleted the two keys
// from the live DatasetSignature type. The shape is intentionally minimal but
// plausible: nested under `dependence` / `spectralStructure`, neither under a
// `provenance` parent, so the governed strip rules in
// `InvestigationDigest.ts` cannot touch them. Must be built fresh per call:
// a shared constant would let one test's delete/mutation leak into the next
// test's exported manifest digest and silently no-op the counter-controls.
function historicalSignature(): RepresentationDecision['datasetSignature'] {
  return {
    dependence: { significantPairsCount: RETIRED_SIGNIFICANT_PAIRS },
    spectralStructure: { periodicityConfidence: RETIRED_PERIODICITY_CONFIDENCE },
  } as unknown as RepresentationDecision['datasetSignature'];
}

const DATASET = Dataset.fromJSON({
  name: 'RFC0008-historical-signature',
  columns: [{ name: 'x', type: 'number' }],
  rows: [{ x: 1 }, { x: 2 }, { x: 3 }],
});

function historicalDecision(): RepresentationDecision {
  return {
    chosenCandidateId: 'scatter' as RepresentationDecision['chosenCandidateId'],
    chosenFamily: 'POINT_CLOUD' as RepresentationDecision['chosenFamily'],
    chosenLayout: 'grid' as RepresentationDecision['chosenLayout'],
    utilityScore: 0.82,
    fitnessModelVersion: 'learned-v7',
    fitnessModelArtifactHash: 'sha256:model-a',
    representationFamily: 'POINT_CLOUD' as RepresentationDecision['representationFamily'],
    embodiment: {
      primaryLayout: 'grid' as RepresentationDecision['embodiment']['primaryLayout'],
      primaryGeometry: 'sphere' as RepresentationDecision['embodiment']['primaryGeometry'],
      primaryBehavior: 'static' as RepresentationDecision['embodiment']['primaryBehavior'],
      primaryInteraction: 'inspect' as RepresentationDecision['embodiment']['primaryInteraction'],
      spatialStrategy: {
        id: 'strategy_scatter',
        provenance: {
          generatedAt: 1,
          engine: 'moneta',
          version: 'v3',
          datasetFingerprint: 'dataset-fp',
          requirementsHash: 'requirements-hash',
          fitnessModelVersion: 'learned-v7',
          fitnessModelArtifactHash: 'sha256:model-a',
        },
      } as RepresentationDecision['embodiment']['spatialStrategy'],
    },
    evidence: [],
    rejectedAlternatives: [],
    provenance: {
      generatedAt: 1,
      engine: 'moneta',
      version: 'v3',
      datasetFingerprint: 'dataset-fp',
      fitnessModelVersion: 'learned-v7',
      fitnessModelArtifactHash: 'sha256:model-a',
    },
    datasetSignature: historicalSignature(),
  };
}

async function exportHistoricalPackage(sessionId: string): Promise<{
  archive: Uint8Array;
  payload: NemosynePackagePayload;
}> {
  // Both sides of the round trip must carry the mock bridge so the exported
  // manifest.kernelVersion matches the replay kernel exactly (the runner
  // fails hard on a version drift before digest verification).
  const atlas = new AtlasCore({ kernel: makeKernelMockBridge(), sessionId });
  atlas.loadDataset(DATASET.clone());
  atlas.aggregate.representation.restoreDecision(historicalDecision());
  const session = new NemosyneSession({ atlas, sessionId: atlas.sessionId });
  const archive = await session.exportPortablePackage({ platform: 'headless', webxrSupported: false });
  return { archive, payload: NemosynePackageManager.unpack(archive) };
}

function tamperedRepresentationPayload(
  payload: NemosynePackagePayload,
  mutate: (decision: Record<string, any>) => void,
): NemosynePackagePayload {
  const decision = JSON.parse(strFromU8(payload.representationDecisionBytes!)) as Record<string, any>;
  mutate(decision);
  return {
    ...payload,
    representationDecisionBytes: strToU8(JSON.stringify(decision)),
  };
}

/**
 * Every deletion/mutation counter-control must fail closed exclusively on the
 * investigation digest: signature keys are not provenance fields, so the
 * fitness-model provenance comparison must still verify. This pins the
 * failure class to the digest and rejects a coincidental `success === false`
 * caused by an unrelated replay regression.
 */
function expectFailsClosedOnDigest(
  replay: Awaited<ReturnType<InvestigationReplayRunner['replayPayload']>>,
  originalDigest: string | null | undefined,
): void {
  expect(originalDigest).toBeTruthy();
  expect(replay.success).toBe(false);
  expect(replay.investigationDigest).not.toBe(originalDigest);
  expect(replay.representationProvenanceVerified).toBe(true);
  expect(replay.discrepancies.length).toBeGreaterThan(0);
  expect(
    replay.discrepancies.every((entry) => entry.includes('Investigation digest mismatch')),
  ).toBe(true);
}

describe('RFC 0008 — historical DatasetSignature keys in v2 portable packages', () => {
  it('replays a historical decision carrying retired signature keys verbatim with the manifest digest reproduced', async () => {
    const { archive, payload } = await exportHistoricalPackage('rfc0008-verbatim');

    // Real export evidence: v2 format, digest-bearing manifest, algorithm label.
    expect(payload.manifest.formatVersion).toBe(2);
    expect(NEMOSYNE_PACKAGE_FORMAT_VERSION).toBe(2);
    expect(payload.manifest.investigationDigestAlgorithm).toBe(INVESTIGATION_DIGEST_ALGORITHM);
    expect(payload.manifest.investigationDigest).toMatch(/^[0-9a-f]{64}$/);

    // The retired pre-TEC2 keys are persisted verbatim inside
    // investigation/representation.json.
    const persisted = JSON.parse(strFromU8(payload.representationDecisionBytes!));
    expect(persisted.datasetSignature.dependence.significantPairsCount).toBe(
      RETIRED_SIGNIFICANT_PAIRS,
    );
    expect(persisted.datasetSignature.spectralStructure.periodicityConfidence).toBe(
      RETIRED_PERIODICITY_CONFIDENCE,
    );

    const replay = await new InvestigationReplayRunner(makeKernelMockBridge()).replayArchive(archive);

    expect(replay.success).toBe(true);
    expect(replay.discrepancies).toEqual([]);
    expect(replay.representationProvenanceVerified).toBe(true);
    expect(replay.investigationDigest).toBe(payload.manifest.investigationDigest);
  });

  it('commits retired signature keys into representationStateHash (digest-bearing under semanticDigestValue)', () => {
    const withKeys = historicalDecision();

    const withoutPairs = historicalDecision() as unknown as Record<string, any>;
    delete withoutPairs.datasetSignature.dependence.significantPairsCount;

    const withoutPeriodicity = historicalDecision() as unknown as Record<string, any>;
    delete withoutPeriodicity.datasetSignature.spectralStructure.periodicityConfidence;

    const mutatedPairs = historicalDecision() as unknown as Record<string, any>;
    mutatedPairs.datasetSignature.dependence.significantPairsCount =
      RETIRED_SIGNIFICANT_PAIRS + 1;

    const baseline = semanticEntityHash(withKeys);
    expect(baseline).toMatch(/^[0-9a-f]{64}$/);
    expect(semanticEntityHash(withoutPairs)).not.toBe(baseline);
    expect(semanticEntityHash(withoutPeriodicity)).not.toBe(baseline);
    // Value mutation and key deletion exercise different normalization paths
    // (absent keys are skipped as undefined); both must shift the hash.
    expect(semanticEntityHash(mutatedPairs)).not.toBe(baseline);
  });

  it('fails closed on the manifest digest when the historical significantPairsCount key is deleted', async () => {
    const { payload } = await exportHistoricalPackage('rfc0008-delete-pairs');
    const tampered = tamperedRepresentationPayload(payload, (decision) => {
      delete decision.datasetSignature.dependence.significantPairsCount;
    });

    const replay = await new InvestigationReplayRunner(makeKernelMockBridge()).replayPayload(tampered);

    expectFailsClosedOnDigest(replay, payload.manifest.investigationDigest);
  });

  it('fails closed on the manifest digest when the historical periodicityConfidence key is deleted', async () => {
    const { payload } = await exportHistoricalPackage('rfc0008-delete-periodicity');
    const tampered = tamperedRepresentationPayload(payload, (decision) => {
      delete decision.datasetSignature.spectralStructure.periodicityConfidence;
    });

    const replay = await new InvestigationReplayRunner(makeKernelMockBridge()).replayPayload(tampered);

    expectFailsClosedOnDigest(replay, payload.manifest.investigationDigest);
  });

  it('fails closed on the manifest digest when a retired key value is mutated', async () => {
    const { payload } = await exportHistoricalPackage('rfc0008-mutate-pairs');
    const tampered = tamperedRepresentationPayload(payload, (decision) => {
      decision.datasetSignature.dependence.significantPairsCount =
        RETIRED_SIGNIFICANT_PAIRS + 1;
    });

    const replay = await new InvestigationReplayRunner(makeKernelMockBridge()).replayPayload(tampered);

    expectFailsClosedOnDigest(replay, payload.manifest.investigationDigest);
  });

  it('fails closed when the manifest investigationDigest is corrupted', async () => {
    const { payload } = await exportHistoricalPackage('rfc0008-corrupt-manifest');
    const original = payload.manifest.investigationDigest!;
    const corrupted = `${original.slice(1)}${original.startsWith('0') ? '1' : '0'}`;
    const tampered: NemosynePackagePayload = {
      ...payload,
      manifest: { ...payload.manifest, investigationDigest: corrupted },
    };
    expect(corrupted).not.toBe(original);

    const replay = await new InvestigationReplayRunner(makeKernelMockBridge()).replayPayload(tampered);

    // The replayed investigation is untampered, so the replayed digest is the
    // original one; the comparison against the corrupted manifest fails.
    expect(replay.success).toBe(false);
    expect(replay.investigationDigest).toBe(original);
    expect(replay.representationProvenanceVerified).toBe(true);
    expect(
      replay.discrepancies.every((entry) => entry.includes('Investigation digest mismatch')),
    ).toBe(true);
    expect(replay.discrepancies.length).toBeGreaterThan(0);
  });
});
