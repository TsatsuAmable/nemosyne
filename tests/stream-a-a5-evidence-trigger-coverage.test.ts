import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const WORKFLOW = '.github/workflows/stream-a-a5-product-evidence.yml';

describe('Stream A A5 cross-family evidence trigger coverage', () => {
  it('wakes for generic progressive-disclosure authority and product seams', () => {
    const workflow = readFileSync(WORKFLOW, 'utf8');
    const requiredPaths = [
      'src/app/dataset/LoadDatasetUseCase.ts',
      'src/app/dataset/SemanticEmbodimentLoader.ts',
      'src/app/dataset/SemanticDetailTransition.ts',
      'src/app/dataset/SemanticDetailReturnControl.ts',
      'src/app/dataset/SemanticDatumInspector.ts',
      'src/atlas/ports/analytical.worker.ts',
      'src/moneta/MonetaTopologyNode.ts',
      'src/moneta/VRTopologyTranslator.ts',
      'src/moneta/embodiment/SemanticEmbodimentStatus.ts',
      'src/moneta/representation/BootstrapFitnessModel.ts',
      'src/moneta/representation/DatasetSignature.ts',
      'src/moneta/representation/FitnessModel.ts',
      'src/moneta/representation/HardConstraintCode.ts',
      'src/moneta/representation/MonetaHypothesisEngine.ts',
      'src/moneta/representation/RepresentationCandidate.ts',
      'src/moneta/representation/RepresentationDecision.ts',
      'src/moneta/representation/RepresentationFamily.ts',
      'src/moneta/representation/RepresentationRequirements.ts',
      'src/moneta/representation/SemanticDrillDown.ts',
      'src/moneta/representation/SemanticEmbodimentPayload.ts',
      'src/vr/presentation/representation/RepresentationSurface.ts',
      'src/vr/presentation/representation/SemanticDetailObservationOverlay.ts',
      'src/wasm/runtime/SemanticEmbodimentBridge.ts',
      'wasm/src/moneta/drill_down.rs',
      'wasm/src/moneta/embodiment.rs',
      'wasm/src/moneta/mod.rs',
    ];

    for (const path of requiredPaths) {
      expect(workflow, `missing A5 evidence trigger for ${path}`).toContain(`- '${path}'`);
    }
  });

  it('wakes for every verified family authority and evidence harness', () => {
    const workflow = readFileSync(WORKFLOW, 'utf8');
    const requiredPaths = [
      'src/app/aggregateEvidenceDiagnostics.ts',
      'src/app/distributionEvidenceDiagnostics.ts',
      'src/app/densityEvidenceDiagnostics.ts',
      'src/app/clusterEvidenceDiagnostics.ts',
      'src/moneta/representation/ClusterEmbodimentPayload.ts',
      'wasm/src/moneta/aggregate_embodiment.rs',
      'wasm/src/moneta/distribution_embodiment.rs',
      'wasm/src/moneta/density_embodiment.rs',
      'wasm/src/moneta/cluster_embodiment.rs',
      'tests/smoke/stream-a-a5-aggregate-evidence.spec.ts',
      'tests/smoke/stream-m-m4-distribution-evidence.spec.ts',
      'tests/smoke/p1r-density-m4-evidence.spec.ts',
      'tests/smoke/p1r-cluster-c4-evidence.spec.ts',
      WORKFLOW,
    ];

    for (const path of requiredPaths) {
      expect(workflow, `missing A5 family/harness trigger for ${path}`).toContain(`- '${path}'`);
    }
  });
});
