import { describe, expect, it } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset } from '../src/data/Dataset.ts';
import {
  DISCOVERY_EPISODE_SCHEMA_VERSION,
  type DiscoveryEpisode,
} from '../src/investigation/index.ts';
import { NemosyneSession } from '../src/session/NemosyneSession.ts';
import { InvestigationReplayRunner } from '../src/session/InvestigationReplayRunner.ts';
import {
  createMonetaKernelFixture,
  createMonetaStructureProfile,
} from './helpers/moneta-kernel-fixture.ts';

function sourceDataset(): Dataset {
  return Dataset.fromJSON({
    name: 'migration-exit-authority',
    columns: [
      { name: 'x', type: 'numeric' },
      { name: 'y', type: 'numeric' },
      { name: 'group', type: 'categorical' },
    ],
    rows: Array.from({ length: 128 }, (_, index) => ({
      x: index,
      y: index * 2,
      group: index % 2 === 0 ? 'A' : 'B',
    })),
  });
}

describe('Moneta migration exit end-to-end authority', () => {
  it('flows Rust evidence through Moneta, portable Investigation, and clean-room replay', async () => {
    const source = sourceDataset();
    const fingerprint = String(source.fingerprint);
    const profile = createMonetaStructureProfile({
      datasetName: source.name,
      rowCount: 128,
      columnCount: 3,
      numericColumns: 2,
      categoricalColumns: 1,
      fingerprint,
      clusterCount: 4,
      hasClusters: true,
      separationScore: 0.84,
      densityVariation: 0.57,
    });
    const atlas = new AtlasCore({
      sessionId: 'migration-exit-session',
      kernel: createMonetaKernelFixture(profile),
    });
    atlas.loadDataset(source);

    const decision = atlas.arbitrateRepresentation();
    const strategy = decision.embodiment.spatialStrategy;

    atlas.applyAnalysis({
      datasetFingerprint: fingerprint,
      datasetVersion: atlas.datasetVersion,
      operation: { op: 'sort', column: 'x', ascending: true },
      algorithmVersion: profile.provenance.kernelVersion,
      label: 'sort',
    });

    expect(decision.datasetFingerprint).toBe(fingerprint);
    expect(decision.datasetSignature.clusterStructure).toMatchObject({
      estimatedCount: 4,
      hasClusters: true,
      separationScore: 0.84,
      densityVariation: 0.57,
    });
    expect(strategy.provenance.datasetFingerprint).toBe(fingerprint);
    expect(strategy.score).toBe(decision.utilityScore);
    expect('confidence' in strategy).toBe(false);

    const discovery: DiscoveryEpisode = {
      schemaVersion: DISCOVERY_EPISODE_SCHEMA_VERSION,
      discoveryId: 'migration-exit-discovery',
      investigationId: 'migration-exit-session',
      notice: 'The authoritative profile exposes separated structure.',
      hypothesis: 'The separation is stable enough to investigate.',
      explorationPath: ['representation', 'inspect'],
      analyticalTests: [
        {
          id: 'cluster-separation-check',
          method: 'cluster-separation',
          evidenceIds: ['cluster:global'],
          outcome: 'SUPPORTS',
        },
      ],
      evidenceIds: ['cluster:global'],
      conclusion: 'Rust-derived cluster evidence survives the investigation boundary.',
      validationStatus: 'SUPPORTED',
      representationContext: {
        representationDecisionId: decision.id,
        fitnessModelVersion: decision.fitnessModelVersion,
        fitnessModelArtifactHash: decision.fitnessModelArtifactHash ?? null,
        decisionDatasetFingerprint: decision.datasetFingerprint,
      },
      provenance: {
        datasetFingerprint: fingerprint,
        datasetVersion: 1,
        kernelVersion: decision.kernelVersion ?? profile.provenance.kernelVersion,
        investigationVersion: '1',
        randomSeeds: {},
      },
    };
    atlas.aggregate.discoveries.record(discovery);

    const session = new NemosyneSession({
      atlas,
      sessionId: 'migration-exit-session',
    });
    const archive = await session.exportPortablePackage({
      platform: 'headless',
      webxrSupported: false,
    });

    const replay = await new InvestigationReplayRunner(
      createMonetaKernelFixture(profile),
    ).replayArchive(archive);

    expect(replay.success, replay.discrepancies.join('\n')).toBe(true);
    expect(replay.representationProvenanceVerified).toBe(true);
    expect(replay.discoveryProvenanceVerified).toBe(1);
    expect(replay.provenanceEventsVerified).toBeGreaterThan(0);
  });
});
