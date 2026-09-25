import { describe, expect, it } from 'vitest';
import { strFromU8, strToU8 } from 'fflate';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset } from '../src/data/Dataset.ts';
import { semanticEntityHash } from '../src/investigation/index.ts';
import type { RepresentationDecision } from '../src/moneta/representation/RepresentationDecision.ts';
import {
  createUnknownDatasetSignatureEpistemic,
  markDatasetSignatureFact,
} from '../src/moneta/representation/DatasetSignature.ts';
import {
  NemosynePackageManager,
  type NemosynePackagePayload,
} from '../src/session/NemosynePackage.ts';
import { NemosyneSession } from '../src/session/NemosyneSession.ts';
import { InvestigationReplayRunner } from '../src/session/InvestigationReplayRunner.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';

/**
 * RFC 0008 — the retired `clusterStructure.densityVariation` key inside
 * historical persisted representation decisions survives verbatim replay.
 *
 * The 2026-09-25 TEC2 slice removed the two-valued Rust cluster proxy
 * (`ClusterProfile.density_variation`: `0.25` iff heuristic cluster detection
 * succeeded, else `0`) from the live producer, transport, adapter, and
 * canonical signature reconstruction, and the live kernel boundary now
 * rejects the key in fresh kernel payloads. But
 * `DatasetSignature.clusterStructure.densityVariation` remains an optional
 * field and fact path precisely so pre-slice packages keep replaying: those
 * decisions were exported while the canonical signature still carried the
 * heuristic value with a `heuristic` epistemic fact. Replay restores
 * decisions verbatim (`parseRepresentationDecision` →
 * `RepresentationState.restoreDecision`, no signature-key validation), so any
 * future stripping or normalization of the historical key must fail closed
 * on the manifest `investigationDigest`.
 *
 * This file exists only because the verbatim
 * `rfc0008-historical-dataset-signature-replay.test.ts` suite (which pins the
 * same contract for `significantPairsCount`/`periodicityConfidence`) must stay
 * byte-identical to its pre-slice form; it deliberately mirrors that suite's
 * structure.
 */

const RETIRED_DENSITY_VARIATION = 0.25;

// Historical signature content as exported before the 2026-09-25 slice removed
// the value from the canonical signature reconstruction. Built with the real
// epistemic helpers so the fact path carries the same `heuristic` source the
// pre-slice canonical builder emitted for the cluster fact (its facts also
// carried evidenceId/method metadata that verbatim replay never rescores, so
// they are omitted here): the value was marked `heuristic` because it came
// from the retired proxy, not from a measured/derived density estimand.
// Must be built fresh per call: a shared constant would let one test's
// delete/mutation leak into the next test's exported manifest digest and
// silently no-op the counter-controls.
function historicalDensitySignature(): RepresentationDecision['datasetSignature'] {
  const epistemic = createUnknownDatasetSignatureEpistemic();
  markDatasetSignatureFact(epistemic, 'clusterStructure.densityVariation', 'heuristic', {
    note: 'Historical pre-slice signature: two-valued Rust cluster proxy',
  });
  return {
    clusterStructure: { densityVariation: RETIRED_DENSITY_VARIATION },
    epistemic,
  } as unknown as RepresentationDecision['datasetSignature'];
}

const DATASET = Dataset.fromJSON({
  name: 'RFC0008-historical-density-variation',
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
    datasetSignature: historicalDensitySignature(),
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
  const archive = await session.exportPortablePackage({
    platform: 'headless',
    webxrSupported: false,
  });
  return { archive, payload: NemosynePackageManager.unpack(archive) };
}

function tamperedRepresentationPayload(
  payload: NemosynePackagePayload,
  mutate: (decision: Record<string, any>) => void
): NemosynePackagePayload {
  const decision = JSON.parse(strFromU8(payload.representationDecisionBytes!)) as Record<
    string,
    any
  >;
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
  originalDigest: string | null | undefined
): void {
  expect(originalDigest).toBeTruthy();
  expect(replay.success).toBe(false);
  expect(replay.investigationDigest).not.toBe(originalDigest);
  expect(replay.representationProvenanceVerified).toBe(true);
  expect(replay.discrepancies.length).toBeGreaterThan(0);
  expect(
    replay.discrepancies.every((entry) => entry.includes('Investigation digest mismatch'))
  ).toBe(true);
}

describe('RFC 0008 — historical clusterStructure.densityVariation in v2 portable packages', () => {
  it('replays a historical decision carrying the retired densityVariation key verbatim with the manifest digest reproduced', async () => {
    const { archive, payload } = await exportHistoricalPackage('rfc0008-density-verbatim');

    // The retired pre-slice key is persisted verbatim inside
    // investigation/representation.json alongside its historical epistemic fact.
    const persisted = JSON.parse(strFromU8(payload.representationDecisionBytes!));
    expect(persisted.datasetSignature.clusterStructure.densityVariation).toBe(
      RETIRED_DENSITY_VARIATION
    );
    expect(
      persisted.datasetSignature.epistemic.facts['clusterStructure.densityVariation'].source
    ).toBe('heuristic');

    const replay = await new InvestigationReplayRunner(makeKernelMockBridge()).replayArchive(
      archive
    );

    expect(replay.success).toBe(true);
    expect(replay.discrepancies).toEqual([]);
    expect(replay.representationProvenanceVerified).toBe(true);
    expect(replay.investigationDigest).toBe(payload.manifest.investigationDigest);
  });

  it('commits the historical densityVariation key into representationStateHash (digest-bearing under semanticDigestValue)', () => {
    const withKey = historicalDecision();

    const withoutKey = historicalDecision() as unknown as Record<string, any>;
    delete withoutKey.datasetSignature.clusterStructure.densityVariation;

    const mutatedValue = historicalDecision() as unknown as Record<string, any>;
    mutatedValue.datasetSignature.clusterStructure.densityVariation = RETIRED_DENSITY_VARIATION + 1;

    const baseline = semanticEntityHash(withKey);
    expect(baseline).toMatch(/^[0-9a-f]{64}$/);
    // Value mutation and key deletion exercise different normalization paths
    // (absent keys are skipped as undefined); both must shift the hash.
    expect(semanticEntityHash(withoutKey)).not.toBe(baseline);
    expect(semanticEntityHash(mutatedValue)).not.toBe(baseline);
  });

  it('fails closed on the manifest digest when the historical densityVariation key is deleted', async () => {
    const { payload } = await exportHistoricalPackage('rfc0008-density-delete');
    const tampered = tamperedRepresentationPayload(payload, (decision) => {
      delete decision.datasetSignature.clusterStructure.densityVariation;
    });

    const replay = await new InvestigationReplayRunner(makeKernelMockBridge()).replayPayload(
      tampered
    );

    expectFailsClosedOnDigest(replay, payload.manifest.investigationDigest);
  });

  it('fails closed on the manifest digest when the historical densityVariation value is mutated', async () => {
    const { payload } = await exportHistoricalPackage('rfc0008-density-mutate');
    const tampered = tamperedRepresentationPayload(payload, (decision) => {
      decision.datasetSignature.clusterStructure.densityVariation = RETIRED_DENSITY_VARIATION + 1;
    });

    const replay = await new InvestigationReplayRunner(makeKernelMockBridge()).replayPayload(
      tampered
    );

    expectFailsClosedOnDigest(replay, payload.manifest.investigationDigest);
  });
});
