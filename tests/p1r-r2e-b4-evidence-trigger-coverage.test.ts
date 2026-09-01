import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const WORKFLOW = '.github/workflows/p1r-graph-b4-evidence.yml';

describe('P1-R2E B4 relationship graph evidence trigger coverage', () => {
  it('wakes for every governed graph authority and product seam', () => {
    const workflow = readFileSync(WORKFLOW, 'utf8');
    const requiredPaths = [
      'src/app/graphEvidenceDiagnostics.ts',
      'src/app/bootstrap.ts',
      'src/app/dataset/LoadDatasetUseCase.ts',
      'src/app/dataset/SemanticEmbodimentLoader.ts',
      'src/app/dataset/SemanticDetailTransition.ts',
      'src/atlas/ports/analytical.worker.ts',
      'src/data/Dataset.ts',
      'src/moneta/MonetaTopologyNode.ts',
      'src/moneta/VRTopologyTranslator.ts',
      'src/moneta/embodiment/GraphSemanticEmbodiment.ts',
      'src/moneta/embodiment/SemanticEmbodimentStatus.ts',
      'src/moneta/representation/GraphEmbodimentPayload.ts',
      'src/moneta/representation/MonetaHypothesisEngine.ts',
      'src/moneta/representation/RelationshipGraphAuthority.ts',
      'src/moneta/representation/RepresentationCandidate.ts',
      'src/moneta/representation/RepresentationRequirements.ts',
      'src/moneta/representation/SemanticDrillDown.ts',
      'src/vr/presentation/representation/RepresentationSurface.ts',
      'src/wasm/LayoutAuthorityBridge.ts',
      'src/wasm/runtime/SemanticEmbodimentBridge.ts',
      'wasm/src/moneta/graph_embodiment.rs',
      'wasm/src/moneta/drill_down.rs',
      'wasm/src/moneta/embodiment.rs',
      'tests/smoke/p1r-graph-b4-evidence.spec.ts',
      WORKFLOW,
    ];

    for (const path of requiredPaths) {
      expect(workflow, `missing B4 evidence trigger for ${path}`).toContain(`- '${path}'`);
    }
  });

  it('reruns when the STOP record or relationship-graph roadmap changes', () => {
    const workflow = readFileSync(WORKFLOW, 'utf8');
    for (const path of [
      'docs/roadmap/P1_R2E_RELATIONSHIP_GRAPH.md',
      'docs/ROADMAP.md',
      'docs/review/P1_R2E_B4_STOP_REVIEW_2026-09-01.md',
    ]) {
      expect(workflow, `missing B4 closure trigger for ${path}`).toContain(`- '${path}'`);
    }
  });
});
