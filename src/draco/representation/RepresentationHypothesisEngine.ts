/**
 * RepresentationHypothesisEngine — Two-stage dataset-aware representation reasoning engine.
 *
 * Sits hierarchically above ConstraintArbiter:
 * 1. Stage A (Eligibility): Enforces hard analytical constraints per RepresentationFamily.
 * 2. Stage B (Utility): Evaluates multi-dimensional evidence-based utility functions.
 * 3. Delegation: Calls ConstraintArbiter for concrete spatial embodiment, returning
 *    a comprehensive RepresentationDecision wrapping the underlying SpatialStrategy.
 */

import type { DracoFacts } from '../types.ts';
import type { Facts } from '../../data/types.ts';
import type { RepresentationRequirements } from '../RepresentationRequirements.ts';
import { createDefaultRequirements } from '../RepresentationRequirements.ts';
import { ConstraintArbiter, type ArbiterOptions } from '../ConstraintArbiter.ts';
import type {
  RepresentationFamily,
} from './RepresentationFamily.ts';
import { ALL_REPRESENTATION_FAMILIES } from './RepresentationFamily.ts';
import type { DatasetSignature, SpectralFacts } from './DatasetSignature.ts';
import { buildDatasetSignature } from './SignatureBuilder.ts';
import type {
  RepresentationDecision,
  RepresentationEvidence,
  RejectedAlternative,
  ScalePolicy,
  ProgressiveDisclosurePolicy,
  RepresentationEmbodiment,
} from './RepresentationDecision.ts';
import { fnv1aHex } from '../../atlas/DatasetSpace.ts';

export interface HypothesisEngineOptions extends ArbiterOptions {
  spectralFacts?: SpectralFacts | null;
  signature?: DatasetSignature;
}

interface FamilyScoringResult {
  family: RepresentationFamily;
  eligible: boolean;
  ineligibleReason?: string;
  utility: number;
  evidence: RepresentationEvidence[];
}

export class RepresentationHypothesisEngine {
  private static readonly VERSION = '1.0.0';

  /**
   * Primary entry point for representation reasoning.
   */
  static reason(
    facts: DracoFacts,
    kernelFacts?: Facts | null,
    requirementsInput?: RepresentationRequirements,
    options: HypothesisEngineOptions = {}
  ): RepresentationDecision {
    const requirements = requirementsInput ?? createDefaultRequirements();
    const datasetFingerprint = options.datasetFingerprint ?? 'unknown-fp';
    const now = options.now ?? Date.now();

    // 1. Resolve DatasetSignature
    const signature =
      options.signature ??
      buildDatasetSignature(facts, kernelFacts, options.spectralFacts, datasetFingerprint, now);

    // 2. Evaluate all 9 families through Stage A (Eligibility) and Stage B (Utility)
    const evaluations: FamilyScoringResult[] = ALL_REPRESENTATION_FAMILIES.map((family) =>
      RepresentationHypothesisEngine._evaluateFamily(family, signature, requirements)
    );

    // 3. Separate eligible from ineligible
    const eligible = evaluations.filter((e) => e.eligible);
    const ineligible = evaluations.filter((e) => !e.eligible);

    // Sort eligible by utility descending
    eligible.sort((a, b) => b.utility - a.utility);

    const winner = eligible[0] ?? evaluations.find((e) => e.family === 'POINT')!;
    const second = eligible[1];

    // Compute confidence (margin over next best or normalized ratio)
    const confidence = second
      ? Math.min(0.99, Math.max(0.5, (winner.utility - second.utility) / Math.max(1, winner.utility) * 0.5 + 0.5))
      : 0.95;

    // 4. Delegate to ConstraintArbiter for spatial embodiment
    const spatialStrategy = ConstraintArbiter.arbitrate(facts, requirements, {
      datasetFingerprint,
      engineVersion: options.engineVersion ?? RepresentationHypothesisEngine.VERSION,
      now,
    });

    // 5. Construct rejected alternatives list
    const rejectedAlternatives: RejectedAlternative[] = [
      ...eligible.slice(1).map((e) => ({
        family: e.family,
        score: Number(e.utility.toFixed(3)),
        reason: `Suboptimal utility score (${e.utility.toFixed(2)} vs winner ${winner.utility.toFixed(2)})`,
        hardPassed: true,
      })),
      ...ineligible.map((e) => ({
        family: e.family,
        score: Number(e.utility.toFixed(3)),
        reason: e.ineligibleReason ?? 'Failed structural eligibility preconditions',
        hardPassed: false,
      })),
    ];

    // 6. Formulate progressive disclosure & scale policy
    const secondaryFamilies: RepresentationFamily[] = eligible.slice(1, 3).map((e) => e.family);
    const progressiveDisclosurePolicy: ProgressiveDisclosurePolicy = {
      primaryFamily: winner.family,
      secondaryFamilies,
      detailFamily: winner.family === 'CLUSTER' ? 'POINT' : winner.family === 'GRAPH' ? 'HIERARCHICAL' : undefined,
      defaultViewLevel: requirements.task === 'explore' ? 'OVERVIEW' : 'DISTRIBUTION',
    };

    const maxNodes = requirements.hardwareConstraints?.maxNodes ?? 50000;
    const scalePolicy: ScalePolicy = {
      maxRenderNodes: maxNodes,
      lodStrategy: signature.cardinality.rowCount > 10000 ? 'INSTANCED_LOD' : 'DIRECT',
      budgetTargetMs: requirements.hardwareConstraints?.deviceTier === 'quest3' ? 11.1 : 16.6,
    };

    const embodiment: RepresentationEmbodiment = {
      spatialStrategy,
      primaryLayout: spatialStrategy.macroLayout.layout,
      primaryGeometry: spatialStrategy.datumEncoding.geometry,
      primaryBehavior: spatialStrategy.datumEncoding.behavior,
      primaryInteraction: spatialStrategy.interactionStrategy.primaryInteraction,
    };

    const requirementsHash = fnv1aHex(JSON.stringify(requirements));

    return {
      id: `rep-dec-${fnv1aHex(`${datasetFingerprint}:${winner.family}:${requirementsHash}`)}`,
      representationFamily: winner.family,
      confidence: Number(confidence.toFixed(3)),
      utilityScore: Number(winner.utility.toFixed(3)),
      evidence: winner.evidence,
      rejectedAlternatives,
      embodiment,
      scalePolicy,
      progressiveDisclosurePolicy,
      datasetSignature: signature,
      provenance: {
        generatedAt: now,
        engine: 'RepresentationHypothesisEngine',
        version: RepresentationHypothesisEngine.VERSION,
        datasetFingerprint,
        requirementsHash,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Stage A (Eligibility) & Stage B (Utility) per Family
  // -------------------------------------------------------------------------

  private static _evaluateFamily(
    family: RepresentationFamily,
    sig: DatasetSignature,
    req: RepresentationRequirements
  ): FamilyScoringResult {
    switch (family) {
      case 'TEMPORAL': {
        const eligible = sig.temporalStructure.isTimeSeries || sig.schema.temporalCount > 0;
        if (!eligible) {
          return {
            family,
            eligible: false,
            ineligibleReason: 'Dataset contains no temporal dimensions or time-series ordering',
            utility: 0,
            evidence: [],
          };
        }
        const evidence: RepresentationEvidence[] = [
          {
            fact: `Temporal dimension detected (columns=${sig.schema.temporalCount})`,
            weight: 3.0,
            supports: true,
            source: 'kernel',
            explanation: 'Intrinsic temporal ordering enables timeline and ribbon visualization',
          },
        ];
        let utility = 5.0;
        if (req.task === 'temporal-trend') {
          utility += 4.0;
          evidence.push({
            fact: 'Analytical task specifically targets temporal trend discovery',
            weight: 4.0,
            supports: true,
            source: 'user-requirement',
          });
        }
        if (sig.temporalStructure.hasSeasonality) {
          utility += 2.0;
          evidence.push({
            fact: 'Cyclic seasonality detected in time series',
            weight: 2.0,
            supports: true,
            source: 'kernel',
          });
        }
        return { family, eligible: true, utility, evidence };
      }

      case 'FREQUENCY': {
        const eligible = sig.spectralStructure?.hasPeriodicity === true;
        if (!eligible) {
          return {
            family,
            eligible: false,
            ineligibleReason: 'No periodic spectral structure detected via FFT analysis',
            utility: 0,
            evidence: [],
          };
        }
        const evidence: RepresentationEvidence[] = [
          {
            fact: `Dominant spectral periodicity detected (confidence=${sig.spectralStructure?.periodicityConfidence.toFixed(2)})`,
            weight: 4.5,
            supports: true,
            source: 'kernel',
            explanation: 'Spectral peaks indicate harmonic frequency domains optimal for spectral volume projection',
          },
        ];
        const utility = 6.0 + (sig.spectralStructure?.periodicityConfidence ?? 0) * 3.0;
        return { family, eligible: true, utility, evidence };
      }

      case 'HIERARCHICAL': {
        const eligible =
          sig.topologicalStructure.topology === 'HIERARCHY' ||
          sig.cardinality.depth > 1;
        if (!eligible) {
          return {
            family,
            eligible: false,
            ineligibleReason: 'Dataset does not exhibit hierarchical parent-child relationships or depth > 1',
            utility: 0,
            evidence: [],
          };
        }
        const evidence: RepresentationEvidence[] = [
          {
            fact: `Hierarchical topology with depth ${sig.cardinality.depth}`,
            weight: 3.5,
            supports: true,
            source: 'kernel',
            explanation: 'Multi-level tree structure benefits from radial orbital concentric nesting',
          },
        ];
        let utility = 5.5;
        if (req.task === 'trace-lineage') {
          utility += 3.5;
          evidence.push({
            fact: 'Analytical task is trace-lineage',
            weight: 3.5,
            supports: true,
            source: 'user-requirement',
          });
        }
        return { family, eligible: true, utility, evidence };
      }

      case 'GRAPH': {
        const eligible =
          sig.topologicalStructure.topology === 'GRAPH' ||
          sig.topologicalStructure.topology === 'FLOW' ||
          sig.cardinality.edgeCount > 0;
        if (!eligible) {
          return {
            family,
            eligible: false,
            ineligibleReason: 'No relational graph edges or topological connectivity present',
            utility: 0,
            evidence: [],
          };
        }
        const evidence: RepresentationEvidence[] = [
          {
            fact: `Relational graph topology (nodes=${sig.cardinality.nodeCount}, edges=${sig.cardinality.edgeCount})`,
            weight: 4.0,
            supports: true,
            source: 'kernel',
            explanation: 'Explicit network connectivity requires force-directed spatial relaxation',
          },
        ];
        let utility = 6.0;
        if (sig.topologicalStructure.hasCycles) {
          utility += 1.5;
          evidence.push({
            fact: 'Graph contains cycles and complex connectivity',
            weight: 1.5,
            supports: true,
            source: 'heuristic',
          });
        }
        if (req.task === 'trace-lineage') utility += 2.0;
        return { family, eligible: true, utility, evidence };
      }

      case 'FIELD': {
        const eligible =
          sig.topologicalStructure.topology === 'VECTOR_FIELD' ||
          sig.spatialStructure.coordinateDimensions === 3;
        if (!eligible) {
          return {
            family,
            eligible: false,
            ineligibleReason: 'Dataset lacks vector field directions or continuous 3D field coordinates',
            utility: 0,
            evidence: [],
          };
        }
        const evidence: RepresentationEvidence[] = [
          {
            fact: 'Continuous vector field topology detected',
            weight: 4.0,
            supports: true,
            source: 'kernel',
          },
        ];
        const utility = 5.8;
        return { family, eligible: true, utility, evidence };
      }

      case 'TOPOLOGY': {
        const eligible =
          (sig.topologicalStructure.b0Count ?? 0) > 1 ||
          sig.clusterStructure.hasClusters ||
          sig.topologicalStructure.hasCycles === true;
        if (!eligible) {
          return {
            family,
            eligible: false,
            ineligibleReason: 'No multi-scale persistent topological features or manifold structures found',
            utility: 0,
            evidence: [],
          };
        }
        const evidence: RepresentationEvidence[] = [
          {
            fact: `Persistent homology features present (b0Count=${sig.topologicalStructure.b0Count})`,
            weight: 2.5,
            supports: true,
            source: 'kernel',
          },
        ];
        const utility = 3.5;
        return { family, eligible: true, utility, evidence };
      }

      case 'CLUSTER': {
        const eligible =
          sig.clusterStructure.estimatedCount > 1 ||
          sig.clusterStructure.hasClusters ||
          sig.dependence.significantPairsCount > 1;
        if (!eligible) {
          return {
            family,
            eligible: false,
            ineligibleReason: 'No separable clusters or multi-modal density concentrations detected',
            utility: 0,
            evidence: [],
          };
        }
        const evidence: RepresentationEvidence[] = [
          {
            fact: `Multi-cluster structure detected (estimatedCount=${sig.clusterStructure.estimatedCount})`,
            weight: 3.5,
            supports: true,
            source: 'kernel',
            explanation: 'Point clusters benefit from spatial partitioning and density hulls',
          },
        ];
        let utility = 5.0;
        if (req.task === 'compare-clusters') {
          utility += 3.5;
          evidence.push({
            fact: 'Analytical task is compare-clusters',
            weight: 3.5,
            supports: true,
            source: 'user-requirement',
          });
        }
        if (sig.dependence.maxCorrelation > 0.6) {
          utility += 1.5;
          evidence.push({
            fact: `High feature correlation (${sig.dependence.maxCorrelation.toFixed(2)}) drives natural grouping`,
            weight: 1.5,
            supports: true,
            source: 'kernel',
          });
        }
        return { family, eligible: true, utility, evidence };
      }

      case 'DISTRIBUTION': {
        const evidence: RepresentationEvidence[] = [
          {
            fact: `Distribution metrics (skewness=${sig.distribution.maxSkewness.toFixed(2)}, variance=${sig.distribution.highVariance})`,
            weight: 2.5,
            supports: true,
            source: 'kernel',
          },
        ];
        let utility = 4.0;
        if (req.task === 'identify-outliers' || sig.distribution.hasOutliers) {
          utility += 3.0;
          evidence.push({
            fact: 'Outliers present in distribution',
            weight: 3.0,
            supports: true,
            source: 'heuristic',
          });
        }
        return { family, eligible: true, utility, evidence };
      }

      case 'POINT':
      default: {
        const evidence: RepresentationEvidence[] = [
          {
            fact: `Discrete tabular instances (rowCount=${sig.cardinality.rowCount}, numericCols=${sig.schema.numericCount})`,
            weight: 2.0,
            supports: true,
            source: 'kernel',
            explanation: 'Base point cloud / grid encoding suitable for general instance inspection',
          },
        ];
        let utility = 3.8;
        if (sig.spatialStructure.isGeospatial) {
          utility += 2.5;
          evidence.push({
            fact: 'Geospatial coordinates map directly to spatial surface positions',
            weight: 2.5,
            supports: true,
            source: 'kernel',
          });
        }
        if (req.task === 'explore') utility += 1.0;
        return { family, eligible: true, utility, evidence };
      }
    }
  }
}
