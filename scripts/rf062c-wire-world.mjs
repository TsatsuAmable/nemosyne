import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/vr/World.ts';
let source = readFileSync(path, 'utf8');

function replaceOnce(oldText, newText, label) {
  const first = source.indexOf(oldText);
  if (first < 0) throw new Error(`RF-062C codemod: missing ${label}`);
  if (source.indexOf(oldText, first + oldText.length) >= 0) {
    throw new Error(`RF-062C codemod: ${label} is not unique`);
  }
  source = source.slice(0, first) + newText + source.slice(first + oldText.length);
}

function replaceBetween(startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`RF-062C codemod: missing ${label} start`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error(`RF-062C codemod: missing ${label} end`);
  source = source.slice(0, start) + replacement + source.slice(end);
}

if (source.includes("import { LoadDatasetUseCase } from '../app/dataset/LoadDatasetUseCase.ts';")) {
  console.log('RF-062C World wiring already applied; no changes.');
  process.exit(0);
}

replaceOnce(
  "import { Engine } from './Engine.ts';\n",
  "import { Engine } from './Engine.ts';\nimport { LoadDatasetUseCase } from '../app/dataset/LoadDatasetUseCase.ts';\nimport { RepresentationSurface } from './presentation/representation/RepresentationSurface.ts';\n",
  'application/presentation imports',
);
replaceOnce("import { PANEL_LAYOUT } from './ui/panelLayout.ts';\n", '', 'PANEL_LAYOUT import');
replaceOnce("import { disposeObject } from '../utils/Dispose.ts';\n", '', 'disposeObject import');
replaceOnce(
  "import type { RepresentationDecision } from '../moneta/representation/RepresentationDecision.ts';\n",
  '',
  'RepresentationDecision import',
);
replaceOnce(
  "import { diagnoseInvestigatorOutcome, buildRemediationProvenance } from '../moneta/representation/ActionableNil.ts';\nimport { NoFeasibleRepresentationError } from '../moneta/representation/NoFeasibleRepresentationError.ts';\n",
  "import { buildRemediationProvenance } from '../moneta/representation/ActionableNil.ts';\n",
  'ActionableNil imports',
);

replaceOnce(
  "  dataOperationController: DataOperationController;\n",
  "  dataOperationController: DataOperationController;\n  loadDatasetUseCase: LoadDatasetUseCase;\n  representationSurface!: RepresentationSurface;\n",
  'World owner fields',
);

replaceOnce(
  "    // Data-operation controller owns dataset mutation, analysis history, and\n",
  "    this.loadDatasetUseCase = new LoadDatasetUseCase(this.atlas);\n\n    // Data-operation controller owns dataset mutation, analysis history, and\n",
  'LoadDatasetUseCase construction',
);

const handlesAnchor = `    this.engine.addUpdatable({\n      update: (delta: number, time: number) =>\n        this.inPlaceHandles.update(delta, time, this.engine.input.raycaster.ray),\n    });\n\n`;
replaceOnce(
  handlesAnchor,
  `${handlesAnchor}    this.representationSurface = new RepresentationSurface({\n      scene: this.engine.scene,\n      cameraGroup: this.engine.cameraGroup,\n      analystAnchor: this.analystAnchor,\n      getColorblindMode: () =>\n        this.uiManager.settingsPanel?.getSetting?.('colorblindMode') ?? 'none',\n      getFactProvider: () => this.atlas.asFactProvider(),\n      addUpdatable: (node) => this.engine.addUpdatable(node),\n      removeUpdatable: (node) => this.engine.removeUpdatable(node),\n      addInteractable: (mesh, options) => this.engine.addInteractable(mesh, options as never),\n      removeInteractable: (mesh) => this.engine.removeInteractable(mesh),\n      addDiagnosticPanel: (panel) => this.engine.input.addPanel(panel),\n      removeDiagnosticPanel: (panel) => this.engine.input.removePanel(panel),\n      setTooltipTargets: (meshes) => this.tooltipManager.setTargets(meshes),\n      clearStructureHandles: () => {\n        this.inPlaceHandles.unregisterInteractables(this.engine.input);\n        this.inPlaceHandles.clear();\n      },\n      rebuildStructureHandles: (node) => this._rebuildStructureHandles(node),\n      onSelectNode: (mesh) => this._showDataCard(mesh),\n    });\n\n`,
  'RepresentationSurface construction',
);

const loadStart = '  /** Internal implementation called after the current frame yields. */\n  _doLoadDataset(';
const rebuildMarker = '  /**\n   * Wave 5: once the analytical kernel is ready, rebuild the current palace so\n';
const newLoadMethod = `  /** Internal implementation called after the current frame yields. */\n  _doLoadDataset(\n    entry: DatasetLoadEntry,\n    {\n      preserveAnalyticalState = false,\n      preserveAuxiliaryPresentation = false,\n    }: {\n      preserveAnalyticalState?: boolean;\n      preserveAuxiliaryPresentation?: boolean;\n    } = {}\n  ): void {\n    this._lastLoadedEntry = entry;\n    const presetName = entry.key && DATASET_THEME_MAP[entry.key];\n    const preset = presetName ? WorldTheme.PRESETS[presetName] : null;\n    const activity =\n      entry.topology === 'TIME_SERIES' || entry.topology === 'ANOMALY' ? 0.75 : 0.35;\n\n    const result = this.loadDatasetUseCase.execute(entry, {\n      preserveAnalyticalState,\n      requirements: this._activeRequirements,\n    });\n    this._activeRequirements = result.requirements;\n    this._activeOutcome = result.outcome;\n    this.uiManager?.recommendationPanel?.markDirty();\n\n    this.dracoNode = this.representationSurface.replace(\n      result.dataInput,\n      result.representationDecision\n    );\n    this.diagnostic = this.representationSurface.diagnostic;\n    this._lastSelectedMesh = this.representationSurface.selectedMesh;\n\n    if (presetName) this.engine.theme.applyPreset(presetName);\n    if (preset) {\n      this.portalA?.setColor?.(preset.pointColor);\n      this.portalB?.setColor?.(preset.pointColor);\n    }\n    this.portalA?.setDataActivity?.(activity);\n    this.portalB?.setDataActivity?.(activity);\n\n    const datasetLabel = entry.label ?? entry.name ?? entry.key ?? 'Dataset';\n    const rowCount = result.embodiedDataset?.rows?.length ?? 0;\n    this.uiManager.statusStrip.setDatasetContext(datasetLabel, String(entry.topology), rowCount);\n    if (entry.topology) {\n      this.uiManager.contextualTaskSurface.setTopology(entry.topology as never);\n    }\n\n    if (!preserveAnalyticalState) {\n      this.currentEntry = entry;\n      this.telemetryCollector?.recordDataset?.(\n        entry.name ?? entry.label ?? 'dataset',\n        entry.topology\n      );\n    }\n\n    if (!preserveAuxiliaryPresentation) {\n      this._attachTDASummary();\n      this._buildDashboard();\n    } else {\n      this._updateDashboardDatasets(result.embodiedDataset);\n    }\n\n    this._setStatisticalLensVisible(this._statisticalLensEnabled);\n  }\n\n`;
replaceBetween(loadStart, rebuildMarker, newLoadMethod, '_doLoadDataset');

replaceBetween(
  '  _wireArtifactInteraction(dracoNode: DracoTopologyNode): void {\n',
  '  private _rebuildStructureHandles(',
  '  private _rebuildStructureHandles(',
  '_wireArtifactInteraction',
);

const teardownStart = '    await run(() => this.livePreview?.clear());\n';
const teardownEnd = '    await run(() => this.adaptiveAssist?.dispose());\n';
const teardownReplacement = `    await run(() => this.livePreview?.clear());\n    await run(() => this.representationSurface?.dispose());\n    this.dracoNode = null;\n    this.diagnostic = null;\n    this._lastSelectedMesh = null;\n    await run(() => this.adaptiveAssist?.dispose());\n`;
replaceBetween(teardownStart, teardownEnd, teardownReplacement, 'representation teardown');

writeFileSync(path, source);
console.log('RF-062C World wiring applied.');
