import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const WORKFLOW = '.github/workflows/stream-a-a5-product-evidence.yml';

describe('Stream A A5 finite product-evidence contract', () => {
  it('runs all four verified dataset-level family browser proofs on one exact-head bundle', () => {
    const workflow = readFileSync(WORKFLOW, 'utf8');
    expect(workflow).toContain('Checkout exact evidence head');
    expect(workflow).toContain('Verify exact checkout identity');
    expect(workflow).toContain('Pin production artifact identities');
    for (const spec of [
      'tests/smoke/stream-a-a5-aggregate-evidence.spec.ts',
      'tests/smoke/stream-m-m4-distribution-evidence.spec.ts',
      'tests/smoke/p1r-density-m4-evidence.spec.ts',
      'tests/smoke/p1r-cluster-c4-evidence.spec.ts',
    ]) {
      expect(workflow).toContain(spec);
    }
    expect(workflow).toContain('--workers=1 --retries=0');
  });

  it('keeps unopened aggregate structure row-free at the detail layer', () => {
    const aggregate = readFileSync('src/app/aggregateEvidenceDiagnostics.ts', 'utf8');
    expect(aggregate).toContain('semanticDetailExecutionsBeforeOpen');
    expect(aggregate).toContain("entry.operation === 'semanticDetail'");
    expect(aggregate).toContain("envelope.representationFamily !== 'AGGREGATE'");
    expect(aggregate).toContain("envelope.result.payload.kind !== 'AGGREGATE_VOLUME'");
  });

  it('keeps bounded detail as an overlay with an explicit reverse step and no row-registration fallback', () => {
    const transition = readFileSync('src/app/dataset/SemanticDetailTransition.ts', 'utf8');
    const returnControl = readFileSync('src/app/dataset/SemanticDetailReturnControl.ts', 'utf8');
    expect(transition).toContain("operation: 'semanticDetail'");
    expect(transition).toContain('hasRegisteredDataset');
    expect(transition).not.toContain('registerDataset(');
    expect(transition).not.toContain('dataset.toJSON');
    expect(returnControl).toContain('Back to structure');
    expect(returnControl).toContain('transition.clear()');
  });

  it('keeps exact datum inspection bounded and does not introduce a whole-dataset cache', () => {
    const inspector = readFileSync('src/app/dataset/SemanticDatumInspector.ts', 'utf8');
    expect(inspector).toContain('transition.inspectObservation(observationId)');
    expect(inspector).not.toContain('dataset.toJSON');
    expect(inspector).not.toContain('registerDataset');
    expect(inspector).not.toContain('.rows');
  });
});
