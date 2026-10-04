/**
 * RepresentationGenomeHandoff — MCR7 governed external genome handoff adapter for FM7.
 *
 * Imports external laboratory candidate genomes (from evolutionary/adversarial search
 * in TsatsuAmable/nemosyne-data) into production RepresentationGraph candidates.
 *
 * Mandatory safety invariants:
 * 1. Rejects any attempt to specify, override, or mutate analytical facts, dataset
 *    fingerprints, or evidence receipts.
 * 2. Materialized graphs must strictly satisfy the production RepresentationGraphGrammar.
 * 3. Fails closed with OUT_OF_GRAMMAR or ABSTAIN if genome is invalid or evidence-incompatible.
 */

import {
  type RepresentationGraph,
  type RepresentationPrimitive,
  type RepresentationCompositionEdge,
  REPRESENTATION_GRAPH_SCHEMA_VERSION,
} from '../representation/RepresentationGraph.ts';
import { validateGraphAgainstGrammar } from './RepresentationGraphGrammar.ts';
import type { DatasetSignature } from '../representation/DatasetSignature.ts';

export const GENOME_HANDOFF_SCHEMA_VERSION = '1.0.0' as const;

export interface ExternalRepresentationGene {
  geneId: string;
  kind: string;
  encodings: Record<string, string>;
  affordances?: string[];
  parameters?: Record<string, string | number | boolean | null>;
}

export interface ExternalCompositionGene {
  fromGeneId: string;
  toGeneId: string;
  relation: string;
}

export interface RepresentationGenomeV1 {
  schemaVersion: typeof GENOME_HANDOFF_SCHEMA_VERSION;
  genomeId: string;
  lineage: {
    generation: number;
    parentGenomeIds: string[];
    laboratoryEngineVersion: string;
  };
  primitiveGenes: ExternalRepresentationGene[];
  compositionGenes: ExternalCompositionGene[];
  // Forbidden fields: genomes must NEVER include dataset fingerprints, analytical facts, or evidence claims
  datasetFingerprint?: never;
  analyticalFacts?: never;
  evidenceReceipts?: never;
}

export type GenomeHandoffDisposition =
  | { status: 'ADMITTED'; graph: RepresentationGraph }
  | { status: 'OUT_OF_GRAMMAR'; reason: string; violations: string[] }
  | { status: 'ABSTAIN'; reason: string };

export class RepresentationGenomeHandoff {
  /**
   * Materializes an external genome into a production RepresentationGraph candidate.
   * Enforces analytical authority boundaries: datasetFingerprint is injected solely
   * from the verified runtime DatasetSignature, never from the untrusted genome.
   */
  public static materializeGenome(
    genome: RepresentationGenomeV1,
    signature: DatasetSignature
  ): GenomeHandoffDisposition {
    // 1. Guard against forbidden analytical overrides
    const rawAny = genome as unknown as Record<string, unknown>;
    if (rawAny.datasetFingerprint !== undefined) {
      return {
        status: 'ABSTAIN',
        reason: 'Genome attempted to supply forbidden datasetFingerprint. Analytical identity is runtime-only.',
      };
    }
    if (rawAny.analyticalFacts !== undefined || rawAny.evidenceReceipts !== undefined) {
      return {
        status: 'ABSTAIN',
        reason: 'Genome attempted to override canonical analytical facts or evidence receipts.',
      };
    }

    // 2. Validate genome schema version
    if (genome.schemaVersion !== GENOME_HANDOFF_SCHEMA_VERSION) {
      return {
        status: 'OUT_OF_GRAMMAR',
        reason: `Unsupported genome schema version: ${genome.schemaVersion}`,
        violations: [`schemaVersion must be ${GENOME_HANDOFF_SCHEMA_VERSION}`],
      };
    }

    // 3. Map genes to RepresentationPrimitives
    const primitives: RepresentationPrimitive[] = [];
    for (const gene of genome.primitiveGenes) {
      primitives.push({
        id: gene.geneId,
        kind: gene.kind as RepresentationPrimitive['kind'],
        semanticInputs: Object.keys(gene.encodings),
        visualEncoding: gene.encodings,
        interactionAffordances: gene.affordances ?? ['select', 'inspect'],
        analyticalDependencies: [],
        parameters: gene.parameters ?? {},
        limitations: [],
      });
    }

    // 4. Map composition genes to RepresentationCompositionEdges
    const edges: RepresentationCompositionEdge[] = [];
    for (const comp of genome.compositionGenes) {
      edges.push({
        from: comp.fromGeneId,
        to: comp.toGeneId,
        relation: comp.relation as RepresentationCompositionEdge['relation'],
      });
    }

    // 5. Construct candidate graph with verified runtime dataset fingerprint
    const candidateGraph: RepresentationGraph = {
      schemaVersion: REPRESENTATION_GRAPH_SCHEMA_VERSION,
      graphId: `synth-genome-${genome.genomeId}`,
      primitives,
      edges,
      semanticMappings: {},
      layoutPolicy: 'SYNTHESIZED_GENOME',
      scalePolicy: 'NORMALIZED_BOUNDING_BOX',
      interactionPolicy: 'DIRECT_MANIPULATION',
      detailPolicy: 'PROGRESSIVE_DISCLOSURE',
      constraints: ['evidence_protocol_v1'],
      provenance: {
        ontologyVersion: '2.0.0',
        fitnessModelVersion: `GenomeHandoff-${genome.lineage.laboratoryEngineVersion}`,
        datasetFingerprint: signature.provenance.datasetFingerprint,
        evidenceSchemaVersion: '1.0.0',
        generatedBy: 'moneta',
      },
    };

    // 6. Validate constructed candidate graph against production grammar
    const validation = validateGraphAgainstGrammar(candidateGraph);
    if (!validation.valid) {
      return {
        status: 'OUT_OF_GRAMMAR',
        reason: 'Materialized candidate violates production RepresentationGraphGrammar.',
        violations: validation.violations,
      };
    }

    return {
      status: 'ADMITTED',
      graph: candidateGraph,
    };
  }
}
