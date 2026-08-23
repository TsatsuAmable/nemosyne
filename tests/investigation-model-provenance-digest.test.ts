import { describe, expect, it } from 'vitest';
import { InvestigationAggregate } from '../src/atlas/domain/InvestigationAggregate.ts';
import type { RepresentationDecision } from '../src/moneta/representation/RepresentationDecision.ts';

function decisionWithArtifact(artifactHash: string): RepresentationDecision {
  return {
    chosenCandidateId: 'scatter' as RepresentationDecision['chosenCandidateId'],
    chosenFamily: 'POINT_CLOUD' as RepresentationDecision['chosenFamily'],
    chosenLayout: 'grid' as RepresentationDecision['chosenLayout'],
    utilityScore: 0.82,
    fitnessModelVersion: 'learned-v7',
    fitnessModelArtifactHash: artifactHash,
    representationFamily: 'POINT_CLOUD' as RepresentationDecision['representationFamily'],
    embodiment: {
      primaryLayout: 'grid' as RepresentationDecision['embodiment']['primaryLayout'],
      primaryGeometry: 'sphere' as RepresentationDecision['embodiment']['primaryGeometry'],
      primaryBehavior: 'static' as RepresentationDecision['embodiment']['primaryBehavior'],
      primaryInteraction: 'inspect' as RepresentationDecision['embodiment']['primaryInteraction'],
      spatialStrategy: {
        id: 'strategy_scatter',
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
      fitnessModelArtifactHash: artifactHash,
    },
    datasetSignature: {} as RepresentationDecision['datasetSignature'],
  };
}

async function digestForArtifact(artifactHash: string): Promise<string> {
  const aggregate = new InvestigationAggregate({ sessionId: 'digest-test' });
  aggregate.representation.restoreDecision(decisionWithArtifact(artifactHash));
  return aggregate.computeDigest('kernel-v1');
}

describe('investigation learned-model provenance digest', () => {
  it('is deterministic for the same exact learned model artifact', async () => {
    await expect(digestForArtifact('sha256:model-a')).resolves.toBe(
      await digestForArtifact('sha256:model-a')
    );
  });

  it('changes when only the immutable learned model artifact changes', async () => {
    const first = await digestForArtifact('sha256:model-a');
    const second = await digestForArtifact('sha256:model-b');

    expect(second).not.toBe(first);
  });
});
