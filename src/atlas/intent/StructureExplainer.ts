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

    if (result.metrics?.summaryStats) {
      metrics.statistics = result.metrics.summaryStats;
    }

    return {
      title,
      summary,
      keyFindings,
      groundedMetrics: metrics,
      provenanceHash: result.provenance?.fingerprint,
      sourceDatasetFingerprint: result.datasetFingerprint,
    };
  }

  /**
   * Explains a set of discovered topological structures.
   */
  explainStructures(structures: StructureSet, datasetFingerprint: string): GroundedExplanation {
    const clusterCount = structures.clusters.length;
    const boundaryCount = structures.boundaries.length;
    const regions = structures.mapperRegions?.length ?? 0;

    const metrics: Record<string, unknown> = {
      clusterCount,
      boundaryCount,
      mapperRegionCount: regions,
    };

    const keyFindings: string[] = [
      `Identified ${clusterCount} discrete data clusters.`,
      `Computed ${boundaryCount} topological persistence boundaries.`,
    ];

    if (regions > 0) {
      keyFindings.push(`Mapped ${regions} topological feature regions.`);
    }

    const summary = `Discovered ${clusterCount} analytical clusters and ${boundaryCount} persistence structures across the dataset space.`;

    return {
      title: 'Topological Structure Summary',
      summary,
      keyFindings,
      groundedMetrics: metrics,
      sourceDatasetFingerprint: datasetFingerprint,
    };
  }
}
