import { describe, expect, it } from 'vitest';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { InvestigationAggregate } from '../src/atlas/domain/InvestigationAggregate.ts';
import { Dataset } from '../src/data/Dataset.ts';
import type { AnalysisResult, AnalysisSpec } from '../src/atlas/types.ts';
import type { RepresentationDecision } from '../src/moneta/representation/RepresentationDecision.ts';
import type { NemosyneSession } from '../src/session/NemosyneSession.ts';
import { makeKernelMockBridge } from './helpers/kernelMock.ts';

const DATASET = {
  name: 'RF046-tamper',
  columns: [{ name: 'x', type: 'number' as const }],
  rows: [{ x: 1 }, { x: 2 }, { x: 3 }],
};

function makeAtlas(sessionId = 'rf046-session'): AtlasCore {
  const atlas = new AtlasCore({ kernel: makeKernelMockBridge(), sessionId });
  atlas.loadDataset(Dataset.fromJSON(DATASET));
  return atlas;
}

function analysisSpec(atlas: AtlasCore, min: number): AnalysisSpec {
  return {
    datasetFingerprint: atlas.datasetFingerprint!,
    datasetVersion: atlas.datasetVersion,
    operation: { op: 'filter', column: 'x', min },
    algorithmVersion: 'rf046-kernel-v1',
    label: 'filter-x',
  };
}

function analysisResult(atlas: AtlasCore, outputHash: string): AnalysisResult {
  return {
    resultId: `${atlas.datasetFingerprint}:result:1`,
    datasetFingerprint: atlas.datasetFingerprint!,
    datasetVersion: atlas.datasetVersion,
    spec: analysisSpec(atlas, 1),
    dataset: atlas.dataset.toJSON(),
    metrics: null,
    diagnostics: ['authoritative diagnostic'],
    warnings: [],
    provenance: null,
    implementationVersion: 'rf046-kernel-v1',
    outputHash,
    evidenceStatus: 'validated',
  };
}

describe('RF-046 Semantic Investigation Digest — falsifying mutation/tamper tests', () => {
  it('digest changes when observation targetIds change (governed field)', async () => {
    const first = makeAtlas('rf046-obs-target');
    const second = makeAtlas('rf046-obs-target');
    first.recordObservation({ notes: 'same note', targetIds: ['node-a'], tags: ['candidate'] });
    second.recordObservation({ notes: 'same note', targetIds: ['node-b'], tags: ['candidate'] });
    expect(await second.computeDigest()).not.toBe(await first.computeDigest());
  });

  it('digest changes when observation tags change (governed field)', async () => {
    const first = makeAtlas('rf046-obs-tags');
    const second = makeAtlas('rf046-obs-tags');
    first.recordObservation({ notes: 'same note', targetIds: ['node-a'], tags: ['candidate'] });
    second.recordObservation({ notes: 'same note', targetIds: ['node-a'], tags: ['rejected'] });
    expect(await second.computeDigest()).not.toBe(await first.computeDigest());
  });

  it('digest changes when finding description changes (governed field)', async () => {
    const first = makeAtlas('rf046-finding-desc');
    const second = makeAtlas('rf046-finding-desc');
    first.recordFinding({
      title: 'same title',
      description: 'supported by A',
      confidence: 'validated',
      observationIds: ['obs-a'],
      resultIds: ['result-a'],
    });
    second.recordFinding({
      title: 'same title',
      description: 'supported by B',
      confidence: 'validated',
      observationIds: ['obs-a'],
      resultIds: ['result-a'],
    });
    expect(await second.computeDigest()).not.toBe(await first.computeDigest());
  });

  it('digest changes when finding observationIds change (governed field)', async () => {
    const first = makeAtlas('rf046-finding-obs');
    const second = makeAtlas('rf046-finding-obs');
    first.recordFinding({
      title: 'same title',
      description: 'same desc',
      confidence: 'validated',
      observationIds: ['obs-a'],
      resultIds: ['result-a'],
    });
    second.recordFinding({
      title: 'same title',
      description: 'same desc',
      confidence: 'validated',
      observationIds: ['obs-b'],
      resultIds: ['result-a'],
    });
    expect(await second.computeDigest()).not.toBe(await first.computeDigest());
  });

  it('digest changes when annotation text changes (governed field)', async () => {
    const first = makeAtlas('rf046-annot-text');
    const second = makeAtlas('rf046-annot-text');
    first.recordAnnotation({ text: 'annotation A', position: [1, 2, 3], targetId: 'node-a' });
    second.recordAnnotation({ text: 'annotation B', position: [1, 2, 3], targetId: 'node-a' });
    expect(await second.computeDigest()).not.toBe(await first.computeDigest());
  });

  it('digest changes when annotation targetId changes (governed field)', async () => {
    const first = makeAtlas('rf046-annot-target');
    const second = makeAtlas('rf046-annot-target');
    first.recordAnnotation({ text: 'same text', position: [1, 2, 3], targetId: 'node-a' });
    second.recordAnnotation({ text: 'same text', position: [1, 2, 3], targetId: 'node-b' });
    expect(await second.computeDigest()).not.toBe(await first.computeDigest());
  });

  it('digest changes when representation decision evidence changes (governed field)', async () => {
    const first = new InvestigationAggregate({ sessionId: 'rf046-rep-evid' });
    const second = new InvestigationAggregate({ sessionId: 'rf046-rep-evid' });
    first.representation.restoreDecision({
      chosenCandidateId: 'scatter',
      chosenFamily: 'POINT_CLOUD',
      chosenLayout: 'grid',
      utilityScore: 0.82,
      representationFamily: 'POINT_CLOUD',
      embodiment: {
        primaryLayout: 'grid',
        primaryGeometry: 'sphere',
        primaryBehavior: 'static',
        primaryInteraction: 'inspect',
        spatialStrategy: { id: 'strategy_scatter' },
      },
      evidence: [{ fact: 'measured-density-a', weight: 1, supports: true, source: 'kernel:test' }],
      rejectedAlternatives: [{ family: 'DISTRIBUTION', score: 0.2, reason: 'less faithful', hardPassed: true }],
      provenance: {
        generatedAt: 1000,
        engine: 'moneta',
        version: 'v3',
        datasetFingerprint: 'dataset-fp',
        fitnessModelVersion: 'bootstrap-v1',
      },
      datasetSignature: {},
    } as unknown as RepresentationDecision);
    second.representation.restoreDecision({
      ...first.representation.activeDecision!,
      evidence: [{ fact: 'measured-density-b', weight: 1, supports: true, source: 'kernel:test' }],
    });
    expect(await second.computeDigest('rf046-kernel-v1')).not.toBe(await first.computeDigest('rf046-kernel-v1'));
  });

  it('digest does NOT change when presentation camera position changes (presentation-only)', async () => {
    const { NemosyneSession } = await import('../src/session/NemosyneSession.ts');
    const first = new NemosyneSession({ atlas: makeAtlas('rf046-pres-cam'), sessionId: 'rf046-pres-cam' });
    const second = new NemosyneSession({ atlas: makeAtlas('rf046-pres-cam'), sessionId: 'rf046-pres-cam' });
    second.setPresentation({
      camera: { position: [12, 4, -8], rotationY: 1.5 },
      theme: 'highContrast',
      panelPositions: [{ id: 'panel', x: 9 }],
    });
    const { NemosynePackageManager } = await import('../src/session/NemosynePackage.ts');
    async function exportedDigest(session: NemosyneSession) {
      const payload = NemosynePackageManager.unpack(await session.exportPortablePackage());
      return payload.manifest.investigationDigest ?? '';
    }
    expect(await exportedDigest(second)).toBe(await exportedDigest(first));
  });

  it('digest does NOT change when presentation theme changes (presentation-only)', async () => {
    const { NemosyneSession } = await import('../src/session/NemosyneSession.ts');
    const first = new NemosyneSession({ atlas: makeAtlas('rf046-pres-theme'), sessionId: 'rf046-pres-theme' });
    const second = new NemosyneSession({ atlas: makeAtlas('rf046-pres-theme'), sessionId: 'rf046-pres-theme' });
    second.setPresentation({ theme: 'highContrast' });
    const { NemosynePackageManager } = await import('../src/session/NemosynePackage.ts');
    async function exportedDigest(session: NemosyneSession) {
      const payload = NemosynePackageManager.unpack(await session.exportPortablePackage());
      return payload.manifest.investigationDigest ?? '';
    }
    expect(await exportedDigest(second)).toBe(await exportedDigest(first));
  });

  it('digest does NOT change when lineage-only rowIds differ in analysis results', async () => {
    const first = new InvestigationAggregate({ sessionId: 'rf046-rowids' });
    const second = new InvestigationAggregate({ sessionId: 'rf046-rowids' });
    const atlas = makeAtlas('rf046-rowids-atlas');
    const base = analysisResult(atlas, 'same-output');
    first.ledger.addResult({
      ...base,
      dataset: { ...base.dataset, rowIds: ['lineage-a', 'lineage-b', 'lineage-c'] },
    });
    second.ledger.addResult({
      ...base,
      dataset: { ...base.dataset, rowIds: ['other-a', 'other-b', 'other-c'] },
    });
    expect(await second.computeDigest('rf046-kernel-v1')).toBe(await first.computeDigest('rf046-kernel-v1'));
  });

  it('digest changes when result scientific content changes even if outputHash same', async () => {
    const first = new InvestigationAggregate({ sessionId: 'rf046-result-content' });
    const second = new InvestigationAggregate({ sessionId: 'rf046-result-content' });
    const atlas = makeAtlas('rf046-result-content-atlas');
    const base = analysisResult(atlas, 'same-output');
    first.ledger.addResult(base);
    second.ledger.addResult({
      ...base,
      dataset: { ...base.dataset, rows: [{ x: 1 }, { x: 2 }, { x: 999 }] },
    });
    expect(await second.computeDigest('rf046-kernel-v1')).not.toBe(await first.computeDigest('rf046-kernel-v1'));
  });
});