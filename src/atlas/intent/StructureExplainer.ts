/**
 * StructureExplainer for Nemosyne Atlas 7.
 *
 * Generates deterministic, verifiable narrative explanations from AnalysisResults,
 * StructureSets, and Provenance envelopes, ensuring all statements are strictly
 * grounded in verified kernel data facts.
 */

import type { AnalysisResult } from '../types.ts';
import type { StructureSet } from '../structures.ts';
import type { GroundedExplanation } from './types.ts';

export class StructureExplainer {
  /**
   * Explains an analytical transformation result.
   */
  explainAnalysisResult(result: AnalysisResult): GroundedExplanation {
    const op = result.spec.operation;
    const rowCount = result.dataset.rows.length;
    const colCount = result.dataset.columns.length;
    const kernelVer = result.implementationVersion;

    const metrics: Record<string, unknown> = {
      operation: op.op,
      rowCount,
      columnCount: colCount,
      outputHash: result.outputHash,
      kernelVersion: kernelVer,
      evidenceStatus: result.evidenceStatus,
    };

    let title = `Analysis: ${op.op.toUpperCase()}`;
    const keyFindings: string[] = [];
    let summary = `Transformation '${op.op}' executed via analytical kernel v${kernelVer}, resulting in ${rowCount} rows across ${colCount} columns.`;

    if (op.op === 'filter') {
      title = 'Filtered Subspace Analysis';
      summary = `Applied deterministic filter predicate. Subspace contains ${rowCount} matching data points.`;
      keyFindings.push(`Dataset reduced to ${rowCount} rows matching predicate.`);
    } else if (op.op === 'anomaly_zscore' || op.op === 'anomaly_iqr') {
      const col = (op as { column?: string }).column ?? 'unknown';
      title = `Anomaly Detection on '${col}'`;
      summary = `Identified ${rowCount} statistical outlier nodes on feature '${col}'.`;
      keyFindings.push(`${rowCount} data points exceeded the ${op.op === 'anomaly_zscore' ? 'Z-score threshold' : 'IQR boundary'}.`);
    } else if (op.op === 'aggregate') {
      title = 'Aggregated Summary View';
      summary = `Aggregated dataset into ${rowCount} summary groups.`;
      keyFindings.push(`Grouped by '${(op as { group_by?: string }).group_by ?? 'dimensions'}'.`);
    }

    if (result.metrics?.numeric) {
      metrics.numericStats = result.metrics.numeric;
    }

    return {
      title,
      summary,
      keyFindings,
      groundedMetrics: metrics,
      provenanceHash: result.provenance?.outputFingerprint,
      sourceDatasetFingerprint: result.datasetFingerprint,
    };
  }

  /**
   * Explains a set of discovered topological structures.
   */
  explainStructures(structureSet: StructureSet): GroundedExplanation {
    const structures = structureSet.structures;
    const clusterCount = structures.filter((s) => s.kind === 'cluster').length;
    const persistentCount = structures.filter((s) => s.kind === 'persistent-component').length;
    const mapperCount = structures.filter((s) => s.kind === 'mapper-node').length;

    const metrics: Record<string, unknown> = {
      totalStructures: structures.length,
      clusterCount,
      persistentComponentCount: persistentCount,
      mapperNodeCount: mapperCount,
      algorithmVersion: structureSet.algorithmVersion,
    };

    const keyFindings: string[] = [];
    if (clusterCount > 0) keyFindings.push(`Identified ${clusterCount} discrete data clusters.`);
    if (persistentCount > 0) keyFindings.push(`Computed ${persistentCount} topological persistence structures.`);
    if (mapperCount > 0) keyFindings.push(`Mapped ${mapperCount} topological mapper nodes.`);

    const summary = `Discovered ${structures.length} analytical structures (${clusterCount} clusters, ${persistentCount} persistent components) across dataset space.`;

    return {
      title: 'Topological Structure Summary',
      summary,
      keyFindings,
      groundedMetrics: metrics,
      sourceDatasetFingerprint: structureSet.datasetFingerprint,
      provenanceHash: structureSet.provenance?.outputFingerprint,
    };
  }
}
