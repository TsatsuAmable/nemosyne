import * as THREE from 'three';
import type { Dataset } from '../../data/Dataset.ts';
import type { DracoDataInput, DracoFacts } from '../../moneta/types.ts';
import {
  buildTDASummaryGroup,
  type TDAComputationResult,
} from '../artifacts/TDAPlanes.ts';
import { ChartPlanePanel } from '../ui/ChartPlanePanel.ts';
import { DashboardManager } from '../ui/DashboardManager.ts';
import { TooltipManager } from '../ui/TooltipManager.ts';
import type { MonetaTopologyNode as DracoTopologyNode } from '../../moneta/MonetaTopologyNode.ts';
import type { AtlasCore } from '../../atlas/AtlasCore.ts';
import type { Engine } from '../Engine.ts';
import { disposeObject } from '../../utils/Dispose.ts';

export interface RendererLifecycleOptions {
  engine: Engine;
  dashboard: DashboardManager;
  tooltipManager: TooltipManager;
  getOriginalDataset: () => Dataset | null;
  getDracoNode: () => DracoTopologyNode | null;
  /** Wave 5/6: AtlasCore — the analytical authority (Draco facts + TDA). */
  getAtlas: () => AtlasCore | null;
}

/** Owns renderer-side dataset summaries and dashboard resource lifecycle. */
export class WorldRendererLifecycle {
  readonly engine: Engine;
  readonly dashboard: DashboardManager;
  readonly tooltipManager: TooltipManager;
  readonly getOriginalDataset: () => Dataset | null;
  readonly getDracoNode: () => DracoTopologyNode | null;
  readonly getAtlas: () => AtlasCore | null;

  dashboardPanels: { panel: ChartPlanePanel }[] = [];
  dashboardTooltipTargets: THREE.Mesh[] = [];
  tdaGroup: THREE.Group | null = null;
  tdaRecompute: (() => Promise<TDAComputationResult | null>) | null = null;

  constructor(options: RendererLifecycleOptions) {
    this.engine = options.engine;
    this.dashboard = options.dashboard;
    this.tooltipManager = options.tooltipManager;
    this.getOriginalDataset = options.getOriginalDataset;
    this.getDracoNode = options.getDracoNode;
    this.getAtlas = options.getAtlas;
  }

  attachTDASummary(): void {
    if (this.tdaGroup) {
      disposeObject(this.tdaGroup);
      this.tdaGroup = null;
      this.tdaRecompute = null;
    }

    const atlas = this.getAtlas();
    const dataset = atlas?.hasDataset ? atlas.dataset : this.getOriginalDataset();
    if (!dataset || dataset.numericColumns.length === 0) return;

    const numericNames = dataset.numericColumns.map((column) => column.name);
    const summary = buildTDASummaryGroup(
      dataset,
      numericNames.slice(0, 3),
      numericNames[0],
      atlas
    );
    this.tdaGroup = summary.group;
    this.tdaRecompute = summary.recompute;
    this.engine.scene.add(summary.group);
    void summary.recompute();
  }

  rebuildDashboard(): void {
    this.disposeDashboard();

    const dataset = this.getOriginalDataset();
    if (!dataset) return;

    // Wave 5: facts come from AtlasCore (kernel.statistics), not from Draco.
    // `extractFacts` was removed from ConstraintEngine; the dashboard only
    // reads column counts + hasTimeSeries, which are dataset-shape metadata
    // (not analytical) when the kernel is unavailable.
    const atlas = this.getAtlas();
    let facts: DracoFacts | null = null;
    if (atlas) {
      const input: DracoDataInput = { dataset };
      facts = atlas.dracoFacts(input) ?? null;
    }
    const numericColumnCount = facts?.numericColumns ?? dataset.numericColumns.length;
    const hasTimeSeries = facts?.hasTimeSeries ?? dataset.temporalColumns.length > 0;
    const panels: ChartPlanePanel[] = [];

    if (numericColumnCount > 1 || dataset.numericColumns.length > 1) {
      panels.push(
        new ChartPlanePanel(this.engine.cameraGroup, dataset, {
          title: 'Correlation Matrix',
          chartType: 'CORRELATION',
        })
      );
    }
    if (hasTimeSeries || dataset.temporalColumns.length > 0) {
      panels.push(
        new ChartPlanePanel(this.engine.cameraGroup, dataset, {
          title: 'Time Series',
          chartType: 'LINE',
        })
      );
    }
    if (panels.length === 0 && dataset.numericColumns.length > 0) {
      panels.push(
        new ChartPlanePanel(this.engine.cameraGroup, dataset, {
          title: `Distribution of ${dataset.numericColumns[0].name}`,
          chartType: 'HISTOGRAM',
          column: dataset.numericColumns[0].name,
        })
      );
    }

    for (const panel of panels) {
      panel.mesh.visible = false;
      this.engine.input.addPanel(panel);
      this.dashboard.registerPanel(panel);
      this.dashboardPanels.push({ panel });
      panel.mesh.userData.tooltipMeta = {
        title: panel.title,
        body: 'Drag to reposition; drop to snap',
      };
      this.tooltipManager.registerTarget(panel.mesh);
      this.dashboardTooltipTargets.push(panel.mesh);
    }
  }

  updateDashboardDatasets(dataset: Dataset | null | undefined): void {
    for (const { panel } of this.dashboardPanels) {
      if (dataset) {
        const columns = new Set(dataset.columns.map((column) => column.name));
        const numericColumns = dataset.numericColumns.map((column) => column.name);
        const isCompareSummary = columns.has('_difference') && columns.has('_measure');
        const compareGroupColumn = dataset.categoricalColumns.find(
          (column) => !['_measure', '_groupA', '_groupB'].includes(column.name)
        )?.name;

        if (isCompareSummary) {
          if (panel.chartPlane.chartType === 'HISTOGRAM' || panel.chartPlane.chartType === 'BAR') {
            panel.chartPlane.column = '_difference';
          } else if (panel.chartPlane.chartType === 'LINE') {
            panel.chartPlane.xColumn = compareGroupColumn ?? null;
            panel.chartPlane.yColumn = '_difference';
          }
        }
        if (panel.chartPlane.column && !columns.has(panel.chartPlane.column)) {
          panel.chartPlane.column = numericColumns[0] ?? null;
        }
        if (panel.chartPlane.xColumn && !columns.has(panel.chartPlane.xColumn)) {
          panel.chartPlane.xColumn = dataset.temporalColumns[0]?.name ?? null;
        }
        if (panel.chartPlane.yColumn && !columns.has(panel.chartPlane.yColumn)) {
          panel.chartPlane.yColumn = numericColumns[0] ?? null;
        }
      }
      panel.setDataset(dataset);
    }
  }

  disposeDashboard(): void {
    for (const mesh of this.dashboardTooltipTargets) {
      const index = this.tooltipManager.targets.indexOf(mesh);
      if (index >= 0) this.tooltipManager.targets.splice(index, 1);
    }
    this.dashboardTooltipTargets = [];

    for (const { panel } of this.dashboardPanels) {
      this.dashboard.unregisterPanel(panel);
      this.engine.input.panels = this.engine.input.panels.filter(
        (candidate) => candidate !== panel
      );
      panel.dispose();
    }
    this.dashboardPanels = [];
  }

  dispose(): void {
    this.disposeDashboard();
    if (this.tdaGroup) disposeObject(this.tdaGroup);
    this.tdaGroup = null;
    this.tdaRecompute = null;
  }
}
