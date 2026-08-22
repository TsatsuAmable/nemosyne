import {
  assertDatasetEvidence,
  type AnalyticalEvidence,
  type DatasetEvidence,
  type JsonValue,
} from '../../data/evidence/DatasetEvidence.ts';
import type { AnalyticalIntent, RepresentationRequirements } from './RepresentationRequirements.ts';
import type { RepresentationDecision } from './RepresentationDecision.ts';
import type { DatasetSignature } from './DatasetSignature.ts';
import { MonetaHypothesisEngine } from './MonetaHypothesisEngine.ts';
import {
  DEFAULT_MONETA_COMPUTE_BUDGET,
  assertMonetaWithinComputeBudget,
  resolveMonetaComputeBudget,
  type MonetaComputeBudget,
} from './ScalabilityContract.ts';

const CORE_EVIDENCE_IDS = [
  'cardinality:dataset',
  'schema:dimensionality',
  'distribution:numeric',
  'density:global',
  'cluster:global',
  'anomaly:global',
  'dependency:correlations',
  'distribution:categorical',
] as const;

export interface EvidenceBoundRepresentationDecision {
  decision: RepresentationDecision;
  evidenceIds: readonly string[];
  datasetFingerprint: string;
  kernelVersion: string;
}

function objectValue(value: JsonValue): Record<string, JsonValue> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('DatasetEvidence value is not an object');
  }
  return value as Record<string, JsonValue>;
}

function finiteNumber(value: JsonValue | undefined, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`DatasetEvidence field '${label}' must be a finite number`);
  }
  return value;
}

function booleanValue(value: JsonValue | undefined, label: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`DatasetEvidence field '${label}' must be a boolean`);
  }
  return value;
}

function byId(evidence: DatasetEvidence): Map<string, AnalyticalEvidence> {
  return new Map(evidence.evidence.map((item) => [item.id, item]));
}

function requireItem(
  items: ReadonlyMap<string, AnalyticalEvidence>,
  id: string,
): AnalyticalEvidence {
  const item = items.get(id);
  if (!item) throw new Error(`DatasetEvidence missing required analytical fact: ${id}`);
  return item;
}

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    throw new Error(
      `DatasetEvidence / DatasetSignature mismatch for ${label}: evidence=${String(actual)}, signature=${String(expected)}`,
    );
  }
}

export function assertEvidenceBacksSignature(
  evidence: DatasetEvidence,
  signature: DatasetSignature,
): readonly string[] {
  assertDatasetEvidence(evidence);

  assertEqual(evidence.datasetFingerprint, signature.provenance.datasetFingerprint, 'dataset fingerprint');
  assertEqual(evidence.kernelVersion, signature.provenance.kernelVersion, 'kernel version');

  const items = byId(evidence);
  for (const id of CORE_EVIDENCE_IDS) requireItem(items, id);

  const cardinality = objectValue(requireItem(items, 'cardinality:dataset').value);
  assertEqual(
    finiteNumber(cardinality.rowCount, 'cardinality.rowCount'),
    signature.cardinality.rowCount,
    'row count',
  );
  assertEqual(
    finiteNumber(cardinality.columnCount, 'cardinality.columnCount'),
    signature.cardinality.columnCount,
    'column count',
  );

  const dimensionality = objectValue(requireItem(items, 'schema:dimensionality').value);
  assertEqual(
    finiteNumber(dimensionality.numericColumns, 'dimensionality.numericColumns'),
    signature.schema.numericCount,
    'numeric column count',
  );
  assertEqual(
    finiteNumber(dimensionality.categoricalColumns, 'dimensionality.categoricalColumns'),
    signature.schema.categoricalCount,
    'categorical column count',
  );
  assertEqual(
    finiteNumber(dimensionality.temporalColumns, 'dimensionality.temporalColumns'),
    signature.schema.temporalCount,
    'temporal column count',
  );

  if (signature.topologicalStructure.topology === 'GRAPH') {
    const graph = objectValue(requireItem(items, 'topology:graph').value);
    assertEqual(booleanValue(graph.isGraph, 'graph.isGraph'), true, 'graph topology');
    assertEqual(
      finiteNumber(graph.edgeCount, 'graph.edgeCount'),
      signature.cardinality.edgeCount,
      'graph edge count',
    );
  } else if (signature.topologicalStructure.topology === 'HIERARCHY') {
    const hierarchy = objectValue(requireItem(items, 'topology:hierarchy').value);
    assertEqual(booleanValue(hierarchy.isHierarchy, 'hierarchy.isHierarchy'), true, 'hierarchy topology');
    assertEqual(
      finiteNumber(hierarchy.depth, 'hierarchy.depth'),
      signature.cardinality.depth,
      'hierarchy depth',
    );
  } else if (signature.topologicalStructure.topology === 'TIME_SERIES') {
    const temporal = objectValue(requireItem(items, 'temporal:global').value);
    assertEqual(booleanValue(temporal.isTimeSeries, 'temporal.isTimeSeries'), true, 'time-series topology');
  } else if (signature.topologicalStructure.topology === 'GEO') {
    const spatial = objectValue(requireItem(items, 'scale:spatial').value);
    assertEqual(booleanValue(spatial.isGeospatial, 'spatial.isGeospatial'), true, 'geospatial topology');
  } else if (signature.topologicalStructure.topology === 'VECTOR_FIELD') {
    throw new Error(
      'DatasetEvidence cannot yet establish VECTOR_FIELD topology: the Rust structure-profile ABI lacks vector-field evidence',
    );
  }

  if (signature.temporalStructure.isTimeSeries) {
    const temporal = objectValue(requireItem(items, 'temporal:global').value);
    assertEqual(
      booleanValue(temporal.isTimeSeries, 'temporal.isTimeSeries'),
      signature.temporalStructure.isTimeSeries,
      'temporal structure',
    );
  }

  if (signature.spatialStructure.isGeospatial) {
    const spatial = objectValue(requireItem(items, 'scale:spatial').value);
    assertEqual(
      finiteNumber(spatial.coordinateDimensions, 'spatial.coordinateDimensions'),
      signature.spatialStructure.coordinateDimensions,
      'spatial coordinate dimensions',
    );
  }

  if (signature.spectralStructure) {
    const spectral = objectValue(requireItem(items, 'spectral:global').value);
    assertEqual(
      booleanValue(spectral.hasPeriodicity, 'spectral.hasPeriodicity'),
      signature.spectralStructure.hasPeriodicity,
      'spectral periodicity',
    );
  }

  return evidence.evidence.map((item) => item.id);
}

export class EvidenceBackedMoneta {
  private readonly computeBudget: Readonly<MonetaComputeBudget>;

  constructor(
    private readonly engine = new MonetaHypothesisEngine(),
    computeBudget: Partial<MonetaComputeBudget> = DEFAULT_MONETA_COMPUTE_BUDGET,
  ) {
    this.computeBudget = resolveMonetaComputeBudget(computeBudget);
  }

  arbitrate(
    evidence: DatasetEvidence,
    signature: DatasetSignature,
    requirements?: RepresentationRequirements,
    intent?: AnalyticalIntent,
  ): EvidenceBoundRepresentationDecision {
    const evidenceIds = assertEvidenceBacksSignature(evidence, signature);
    const decision = this.engine.arbitrate(signature, requirements, intent);

    assertMonetaWithinComputeBudget(
      {
        candidateCount: decision.rankedCandidates.length,
        sensitivityScenarioCount: decision.weightSensitivity.scenarioCount,
      },
      this.computeBudget,
    );

    return {
      decision,
      evidenceIds,
      datasetFingerprint: evidence.datasetFingerprint,
      kernelVersion: evidence.kernelVersion,
    };
  }
}