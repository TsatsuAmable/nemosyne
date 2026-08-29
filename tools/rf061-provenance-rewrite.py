from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)


path = Path('src/vr/artifacts/TDAPlanes.ts')
text = path.read_text()
text = replace_once(
    text,
    '  PersistenceInterval as KernelPersistenceInterval,\n  TdaMapperGraph,\n',
    '  PersistenceInterval as KernelPersistenceInterval,\n  Provenance,\n  TdaMapperGraph,\n',
    'TDA provenance import',
)
text = replace_once(
    text,
    '  betti0: KernelBettiPoint[];\n  persistenceParams: Record<string, unknown>;\n',
    '  betti0: KernelBettiPoint[];\n  persistenceProvenance: Provenance | null;\n  mapperProvenance: Provenance | null;\n  bettiProvenance: Provenance | null;\n  persistenceParams: Record<string, unknown>;\n',
    'TDA result provenance fields',
)
start_marker = '  async function compute(): Promise<TDAComputationResult | null> {\n'
end_marker = '  function apply(result: TDAComputationResult): boolean {\n'
start = text.find(start_marker)
end = text.find(end_marker, start)
if start < 0 or end < 0 or text.find(start_marker, start + 1) >= 0:
    raise SystemExit('TDA compute block markers are not unique')
new_compute = '''  async function compute(): Promise<TDAComputationResult | null> {
    if (!atlas || !atlas.isReady()) return null;
    const datasetVersion = atlas.datasetVersion;
    const datasetFingerprint = atlas.datasetFingerprint;
    if (!datasetFingerprint) return null;

    let pIntervals: KernelPersistenceInterval[] | null;
    let g: TdaMapperGraph | null;
    let bettiPoints: KernelBettiPoint[] | null;
    let persistenceProvenance: Provenance | null = null;
    let mapperProvenance: Provenance | null = null;
    let bettiProvenance: Provenance | null = null;

    if (atlas.executionPort?.isAsync) {
      // Complete the first request (and therefore its resident-registration
      // fence) before launching the remaining pair. Each response carries its
      // own provenance so concurrent Mapper/Betti execution cannot race through
      // a mutable "last provenance" slot.
      const persistenceEvidence = await atlas.computePersistenceEvidenceAsync(persistenceParams);
      if (!persistenceEvidence || !isCurrent(datasetVersion, datasetFingerprint)) return null;
      const [mapperEvidence, bettiEvidence] = await Promise.all([
        atlas.computeMapperEvidenceAsync(mapperParams),
        atlas.computeBetti0EvidenceAsync(bettiParams),
      ]);
      if (!mapperEvidence || !bettiEvidence) return null;
      pIntervals = persistenceEvidence.value;
      g = mapperEvidence.value;
      bettiPoints = bettiEvidence.value;
      persistenceProvenance = persistenceEvidence.provenance;
      mapperProvenance = mapperEvidence.provenance;
      bettiProvenance = bettiEvidence.provenance;
    } else {
      pIntervals = atlas.computePersistenceIntervalsForCurrent(persistenceParams);
      persistenceProvenance = atlas.lastProvenance();
      g = atlas.computeMapperGraphForCurrent(mapperParams);
      mapperProvenance = atlas.lastProvenance();
      bettiPoints = atlas.computeBetti0CurveForCurrent(bettiParams);
      bettiProvenance = atlas.lastProvenance();
    }

    if (
      !pIntervals ||
      !g ||
      !bettiPoints ||
      !isCurrent(datasetVersion, datasetFingerprint)
    ) {
      return null;
    }

    return {
      datasetVersion,
      datasetFingerprint,
      persistence: pIntervals,
      mapper: g,
      betti0: bettiPoints,
      persistenceProvenance,
      mapperProvenance,
      bettiProvenance,
      persistenceParams,
      mapperParams,
      bettiParams,
    };
  }

'''
text = text[:start] + new_compute + text[end:]
path.write_text(text)

pipeline_path = Path('src/vr/coordinators/DerivedAnalysisPipeline.ts')
pipeline = pipeline_path.read_text()
pipeline = replace_once(
    pipeline,
    '          result.tda.mapperParams,\n          null\n',
    '          result.tda.mapperParams,\n          result.tda.mapperProvenance\n',
    'Mapper provenance mapping',
)
pipeline = replace_once(
    pipeline,
    '          result.tda.persistenceParams,\n          null\n',
    '          result.tda.persistenceParams,\n          result.tda.persistenceProvenance\n',
    'Persistence provenance mapping',
)
pipeline_path.write_text(pipeline)

test_path = Path('tests/derived-analysis-pipeline.test.ts')
test = test_path.read_text()
test = replace_once(
    test,
    '    betti0: [{ radius: 0.5, betti0: 2 }],\n    persistenceParams:',
    '    betti0: [{ radius: 0.5, betti0: 2 }],\n    persistenceProvenance: null,\n    mapperProvenance: null,\n    bettiProvenance: null,\n    persistenceParams:',
    'TDA fixture provenance',
)
test_path.write_text(test)
