/**
 * @deprecated BUILT, NOT WIRED. This module is complete and tested but is NOT
 * instantiated by production code — export logic is implemented directly in
 * `TelemetryPanel.ts` instead. Tracked in `docs/ROADMAP.md` and
 * `docs/AUDIT_RECOMMENDATION.md`. Either wire this exporter into TelemetryPanel
 * or delete it; do not leave it half-alive.
 *
 * Spatial Analysis Storybook Exporter.
 *
 * Packages session state, dataset snapshot, camera pose, selected filters,
 * annotations, and tour checkpoints into a standalone downloadable JSON/HTML story bundle.
 */

import type { Dataset } from '../data/Dataset.ts';

export interface StorybookCheckpoint {
  id: string;
  title: string;
  description: string;
  cameraPose: { position: [number, number, number]; rotation: [number, number, number, number] };
  activeFilter?: string;
  timestamp: number;
}

export interface StorybookBundle {
  title: string;
  author: string;
  createdTimestamp: number;
  datasetName: string;
  datasetSnapshot: {
    columns: Array<{ name: string; type: string }>;
    rowCount: number;
  };
  checkpoints: StorybookCheckpoint[];
}

export class AnalysisStorybookExporter {
  /**
   * Export session state into a structured StorybookBundle.
   */
  static exportStorybook(
    dataset: Dataset,
    title = 'Analysis Storybook',
    author = 'Nemosyne Analyst',
    checkpoints: StorybookCheckpoint[] = []
  ): StorybookBundle {
    return {
      title,
      author,
      createdTimestamp: Date.now(),
      datasetName: dataset.name,
      datasetSnapshot: {
        columns: dataset.columns.map((c) => ({ name: c.name, type: String(c.type) })),
        rowCount: dataset.rowCount,
      },
      checkpoints: [...checkpoints],
    };
  }

  /**
   * Serialize bundle to a JSON string.
   */
  static serializeBundle(bundle: StorybookBundle): string {
    return JSON.stringify(bundle, null, 2);
  }

  /**
   * Trigger client-side browser file download of the Storybook bundle.
   */
  static downloadBundle(bundle: StorybookBundle, filename?: string): void {
    if (typeof window === 'undefined') return;
    const jsonStr = this.serializeBundle(bundle);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename ?? `${bundle.datasetName.toLowerCase().replace(/\s+/g, '_')}_storybook.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
