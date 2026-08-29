from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)


atlas_path = Path('src/atlas/AtlasCore.ts')
atlas = atlas_path.read_text()
start_marker = '  async computePersistenceIntervalsAsync(\n'
end_marker = '  computeSpectralFacts('
start = atlas.find(start_marker)
end = atlas.find(end_marker, start)
if start < 0 or end < 0 or atlas.find(start_marker, start + 1) >= 0:
    raise SystemExit('Atlas async TDA block markers are not unique')
new_tda = '''  private async _computeTdaEvidenceAsync<T>(
    operation: 'tda.persistence' | 'tda.mapper' | 'tda.betti0',
    params: Record<string, unknown>,
  ): Promise<{ value: T; provenance: Provenance | null; datasetVersion: number; datasetFingerprint: string } | null> {
    const fp = this.datasetFingerprint ?? '';
    if (!fp) return null;
    const version = this.datasetVersion;
    const generation = this._generation;
    if (!(await this._registerCurrentDatasetInWorker(fp, version))) return null;
    const reqId = `areq-${++this._requestSeq}`;

    const res = await this._executionPort!.execute<T>({
      requestId: reqId,
      operation,
      dataset: { fingerprint: fp, version },
      generation,
      params,
    });

    if (
      generation !== this._generation ||
      res.datasetVersion !== this.datasetVersion ||
      res.datasetFingerprint !== fp ||
      fp !== (this.datasetFingerprint ?? '') ||
      res.value == null
    ) {
      return null;
    }
    return {
      value: res.value,
      provenance: res.provenance ?? null,
      datasetVersion: version,
      datasetFingerprint: fp,
    };
  }

  async computePersistenceEvidenceAsync(
    params: Record<string, unknown>
  ): Promise<{ value: PersistenceInterval[]; provenance: Provenance | null; datasetVersion: number; datasetFingerprint: string } | null> {
    if (!this._executionPort?.isAsync) {
      const value = this.computePersistenceIntervalsForCurrent(params);
      return value ? {
        value,
        provenance: this.lastProvenance(),
        datasetVersion: this.datasetVersion,
        datasetFingerprint: this.datasetFingerprint ?? '',
      } : null;
    }
    return this._computeTdaEvidenceAsync<PersistenceInterval[]>('tda.persistence', params);
  }

  async computeMapperEvidenceAsync(
    params: Record<string, unknown>
  ): Promise<{ value: TdaMapperGraph; provenance: Provenance | null; datasetVersion: number; datasetFingerprint: string } | null> {
    if (!this._executionPort?.isAsync) {
      const value = this.computeMapperGraphForCurrent(params);
      return value ? {
        value,
        provenance: this.lastProvenance(),
        datasetVersion: this.datasetVersion,
        datasetFingerprint: this.datasetFingerprint ?? '',
      } : null;
    }
    return this._computeTdaEvidenceAsync<TdaMapperGraph>('tda.mapper', params);
  }

  async computeBetti0EvidenceAsync(
    params: Record<string, unknown>
  ): Promise<{ value: BettiPoint[]; provenance: Provenance | null; datasetVersion: number; datasetFingerprint: string } | null> {
    if (!this._executionPort?.isAsync) {
      const value = this.computeBetti0CurveForCurrent(params);
      return value ? {
        value,
        provenance: this.lastProvenance(),
        datasetVersion: this.datasetVersion,
        datasetFingerprint: this.datasetFingerprint ?? '',
      } : null;
    }
    return this._computeTdaEvidenceAsync<BettiPoint[]>('tda.betti0', params);
  }

  async computePersistenceIntervalsAsync(
    params: Record<string, unknown>
  ): Promise<PersistenceInterval[] | null> {
    return (await this.computePersistenceEvidenceAsync(params))?.value ?? null;
  }

  async computeMapperGraphAsync(
    params: Record<string, unknown>
  ): Promise<TdaMapperGraph | null> {
    return (await this.computeMapperEvidenceAsync(params))?.value ?? null;
  }

  async computeBetti0CurveAsync(
    params: Record<string, unknown>
  ): Promise<BettiPoint[] | null> {
    return (await this.computeBetti0EvidenceAsync(params))?.value ?? null;
  }

'''
atlas = atlas[:start] + new_tda + atlas[end:]
atlas_path.write_text(atlas)

world_path = Path('src/vr/World.ts')
world = world_path.read_text()
world = replace_once(
    world,
    "import { WorldRendererLifecycle } from './coordinators/WorldRendererLifecycle.ts';\n",
    "import { WorldRendererLifecycle } from './coordinators/WorldRendererLifecycle.ts';\nimport { DerivedAnalysisPipeline } from './coordinators/DerivedAnalysisPipeline.ts';\n",
    'World import',
)
world = replace_once(
    world,
    '  rendererLifecycle: WorldRendererLifecycle;\n  lifecycle: WorldLifecycleOwner;\n',
    '  rendererLifecycle: WorldRendererLifecycle;\n  derivedAnalysisPipeline: DerivedAnalysisPipeline;\n  lifecycle: WorldLifecycleOwner;\n',
    'World field',
)
world = replace_once(
    world,
    '  tdaRecompute!: (() => void) | null;\n',
    "  tdaRecompute!: (() => Promise<import('./artifacts/TDAPlanes.ts').TDAComputationResult | null>) | null;\n",
    'World tda type',
)
marker = '    // Live preview of data operations before they are committed.\n'
pipeline_init = '''    this.derivedAnalysisPipeline = new DerivedAnalysisPipeline({
      atlas: this.atlas,
      rendererLifecycle: this.rendererLifecycle,
      markRecommendationDirty: () => this.uiManager.recommendationPanel?.markDirty?.(),
      publishStructureHandles: () => {
        if (this.dracoNode && this.atlas.structures.length > 0) {
          this.inPlaceHandles.buildFromStructures(this.dracoNode, this.atlas.structures as never);
          this.inPlaceHandles.registerInteractables(this.engine.input as never);
        }
      },
      onError: (error, request) => {
        console.warn(
          `[RF-061] derived analysis failed for v${request.datasetVersion} ${request.operation}:`,
          error
        );
      },
    });

'''
world = replace_once(world, marker, pipeline_init + marker, 'World pipeline init')
old_restore = '''    this._updateDashboardDatasets(transformedDataset);
    if (this.tdaRecompute && operation !== 'anomaly') {
      this.tdaRecompute();
    }
'''
world = replace_once(world, old_restore, '    this._updateDashboardDatasets(transformedDataset);\n', 'World restore TDA')
old_operation = '''      this._updateDashboardDatasets(this._transformedDataset);
      if (this.tdaRecompute && operation !== 'anomaly') this.tdaRecompute();
      this._discoverStructuresAndRecommend(operation);
      this._updateOperationLog();
'''
new_operation = '''      this._updateDashboardDatasets(this._transformedDataset);
      this.derivedAnalysisPipeline.schedule(operation);
      this._updateOperationLog();
'''
world = replace_once(world, old_operation, new_operation, 'World operation listener')
old_history = '''      this._restoreDataset(dataset, operation);
      this._updateNarrativeStrip();
'''
new_history = '''      this._restoreDataset(dataset, operation);
      if (this.tdaRecompute && operation !== 'anomaly') void this.tdaRecompute();
      this._updateNarrativeStrip();
'''
world = replace_once(world, old_history, new_history, 'World history listener')
world = replace_once(
    world,
    '    await run(() => this.rendererLifecycle?.dispose());\n',
    '    await run(() => this.derivedAnalysisPipeline?.dispose());\n    await run(() => this.rendererLifecycle?.dispose());\n',
    'World teardown',
)
world_path.write_text(world)
