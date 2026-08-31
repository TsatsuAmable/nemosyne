import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const WORKFLOW = '.github/workflows/p1r-cluster-c4-evidence.yml';

/**
 * C5 stop-gate regression: the expensive browser evidence must wake up whenever
 * a file that owns R2D scientific authority, ranking, transport, Rust execution,
 * embodiment, progressive disclosure, or interaction semantics changes.
 */
describe('P1-R2D C5 cluster browser evidence trigger coverage', () => {
  it('covers the C1-C3 authority and production seams', () => {
    const workflow = readFileSync(WORKFLOW, 'utf8');
    const requiredPaths = [
      'src/app/dataset/LoadDatasetUseCase.ts',
      'src/app/dataset/SemanticEmbodimentLoader.ts',
      'src/app/dataset/SemanticDetailTransition.ts',
      'src/atlas/ports/analytical.worker.ts',
      'src/moneta/MonetaTopologyNode.ts',
      'src/moneta/VRTopologyTranslator.ts',
      'src/moneta/embodiment/ClusterSemanticEmbodiment.ts',
      'src/moneta/embodiment/SemanticEmbodimentStatus.ts',
      'src/moneta/representation/BootstrapFitnessModel.ts',
      'src/moneta/representation/ClusterEmbodimentPayload.ts',
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
      'wasm/src/moneta/cluster_embodiment.rs',
      'wasm/src/moneta/drill_down.rs',
      'wasm/src/moneta/embodiment.rs',
      'wasm/src/moneta/mod.rs',
    ];

    for (const path of requiredPaths) {
      expect(workflow, `missing C4 evidence trigger for ${path}`).toContain(`- '${path}'`);
    }
  });

  it('keeps the exact-head evidence harness itself in scope', () => {
    const workflow = readFileSync(WORKFLOW, 'utf8');
    for (const path of [
      WORKFLOW,
      'src/app/clusterEvidenceDiagnostics.ts',
      'src/app/resourceEnvelopeDiagnostics.ts',
      'tests/smoke/p1r-cluster-c4-evidence.spec.ts',
      'tests/p1r-r2d-c5-cluster-evidence-trigger-coverage.test.ts',
      'tests/stream-a-a3-bounded-observation-transition.test.ts',
    ]) {
      expect(workflow, `missing evidence-harness trigger for ${path}`).toContain(`- '${path}'`);
    }
  });
});
