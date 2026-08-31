import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const WORKFLOW = '.github/workflows/p1r-density-m4-evidence.yml';

/**
 * Density evidence stop-gate regression: the expensive browser evidence must
 * wake up whenever a file that owns R2C scientific authority, ranking,
 * transport, Rust execution, embodiment, progressive disclosure, or interaction
 * semantics changes. Otherwise ordinary unit CI can stay green while the
 * product-level density path silently loses exact-head evidence.
 */
describe('P1-R2C M4 density browser evidence trigger coverage', () => {
  it('covers the density authority and production seams', () => {
    const workflow = readFileSync(WORKFLOW, 'utf8');
    const requiredPaths = [
      'src/app/dataset/LoadDatasetUseCase.ts',
      'src/app/dataset/SemanticEmbodimentLoader.ts',
      'src/app/dataset/SemanticDetailTransition.ts',
      'src/atlas/ports/analytical.worker.ts',
      'src/moneta/MonetaTopologyNode.ts',
      'src/moneta/VRTopologyTranslator.ts',
      'src/moneta/embodiment/DensitySemanticEmbodiment.ts',
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
      'wasm/src/data/columnar.rs',
      'wasm/src/moneta/density_embodiment.rs',
      'wasm/src/moneta/drill_down.rs',
      'wasm/src/moneta/embodiment.rs',
      'wasm/src/moneta/mod.rs',
    ];

    for (const path of requiredPaths) {
      expect(workflow, `missing M4 evidence trigger for ${path}`).toContain(`- '${path}'`);
    }
  });

  it('keeps the exact-head evidence harness itself in scope', () => {
    const workflow = readFileSync(WORKFLOW, 'utf8');
    for (const path of [
      WORKFLOW,
      'src/app/densityEvidenceDiagnostics.ts',
      'src/app/resourceEnvelopeDiagnostics.ts',
      'tests/smoke/p1r-density-m4-evidence.spec.ts',
      'tests/p1r-r2c-m4-density-evidence-trigger-coverage.test.ts',
      'tests/stream-a-a3-bounded-observation-transition.test.ts',
    ]) {
      expect(workflow, `missing evidence-harness trigger for ${path}`).toContain(`- '${path}'`);
    }
  });
});
