import * as THREE from 'three';
import type { Dataset } from '../data/Dataset.ts';
import type { EncodingMapping } from '../data/SampleDatasets.ts';
import { buildClusterSemanticRegions } from './embodiment/ClusterSemanticEmbodiment.ts';
import { buildDensitySemanticField } from './embodiment/DensitySemanticEmbodiment.ts';
import { ScalableTopologyEmbodiment } from './embodiment/ScalableTopologyEmbodiment.ts';
import { TimeRibbonArtifactUpdater } from './embodiment/TimeRibbonArtifactUpdater.ts';
import { TopologyInteractionOwner } from './embodiment/TopologyInteractionOwner.ts';
import { TopologyLayoutEmbodiment } from './embodiment/TopologyLayoutEmbodiment.ts';
import type { ClusterEmbodimentEnvelopeV1 } from './representation/ClusterEmbodimentPayload.ts';
import type { SemanticEmbodimentEnvelopeV1 } from './representation/SemanticEmbodimentPayload.ts';
import type {
  Artifact,
  ChartPlaneFactory,
  InstancedPointCloudFactory,
  MetaphorActionHandlers,
  MonetaDataInput,
  SolverResult,
  VRGeometry,
  VRTranslatorOptions,
} from './types.ts';

type SemanticMonetaDataInput = MonetaDataInput & {
  semanticEmbodiment?: SemanticEmbodimentEnvelopeV1 | null;
};

type ClusterSemanticMonetaDataInput = MonetaDataInput & {
  semanticEmbodimentCandidateId?: 'CLUSTER_REGIONS';
  semanticEmbodiment?: ClusterEmbodimentEnvelopeV1 | null;
  semanticEmbodimentPromise?: Promise<ClusterEmbodimentEnvelopeV1 | null>;
};

export class VRTopologyTranslator {
  private static _colorblindMode: string | boolean = 'none';
  private static _pointCloudFactory: InstancedPointCloudFactory | null = null;
  private static _chartPlaneFactory: ChartPlaneFactory | null = null;
  private static _metaphorActions: MetaphorActionHandlers = {};
  private static readonly _timeRibbonUpdater = new TimeRibbonArtifactUpdater();

  static registerPointCloudFactory(factory: InstancedPointCloudFactory): void {
    this._pointCloudFactory = factory;
  }

  static registerChartPlaneFactory(factory: ChartPlaneFactory): void {
    this._chartPlaneFactory = factory;
  }

  static registerMetaphorActions(actions: MetaphorActionHandlers): void {
    this._metaphorActions = { ...this._metaphorActions, ...actions };
  }

  static synthesizeArtifact(
    monetaResult: SolverResult,
    dataInput: MonetaDataInput,
    options?: VRTranslatorOptions
  ): Artifact {
    this._colorblindMode = options?.colorblindMode ?? 'none';
    const { spec, facts } = monetaResult;
    const semanticInput = dataInput as SemanticMonetaDataInput;
    const clusterSemanticInput = dataInput as ClusterSemanticMonetaDataInput;
    const governedClusterRegions =
      spec.geometry === 'CLUSTER_VOLUME' &&
      clusterSemanticInput.semanticEmbodimentCandidateId === 'CLUSTER_REGIONS';
    const dataset = dataInput.dataset;
    const encodings = dataInput.encodings ?? {};
    const group = new THREE.Group();
    const nodeMeshes: THREE.Mesh[] = [];
    const edgeMeshes: THREE.Line[] = [];
    const behaviors: Array<(delta: number, time: number) => void> = [];
    const layouts = new TopologyLayoutEmbodiment(this._colorblindMode);
    const scalable = new ScalableTopologyEmbodiment(
      layouts,
      this._colorblindMode,
      this._pointCloudFactory
    );

    // Governed dataset-level semantic candidates consume only bounded
    // Rust-owned payloads. CLUSTER_VOLUME remains a presentation primitive;
    // only an explicit CLUSTER_REGIONS authority marker intercepts it before
    // source-row resolution. That governed path has deliberately no row-backed
    // grouping/sphere fallback when evidence is pending, refused or unavailable.
    let rows: Record<string, unknown>[] = [];
    let edges = dataInput.edges ?? [];
    if (spec.geometry === 'AGGREGATE_BARS') {
      scalable.buildAggregateBars(group, nodeMeshes, semanticInput.semanticEmbodiment);
      edges = [];
    } else if (spec.geometry === 'DISTRIBUTION_FIELD') {
      scalable.buildDistributionField(group, nodeMeshes, semanticInput.semanticEmbodiment);
      edges = [];
    } else if (spec.geometry === 'DENSITY_FIELD') {
      buildDensitySemanticField(group, nodeMeshes, semanticInput.semanticEmbodiment);
      edges = [];
    } else if (governedClusterRegions) {
      buildClusterSemanticRegions(group, nodeMeshes, clusterSemanticInput.semanticEmbodiment);
      edges = [];
    } else {
      rows = dataset?.rows ?? dataInput.rows ?? [];
      edges = dataInput.edges ?? dataset?.edges ?? [];
      if (spec.geometry === 'INSTANCED_POINT_CLOUD') {
        scalable.buildInstancedPointCloud(
          group,
          nodeMeshes,
          rows,
          dataset,
          encodings,
          spec,
          edges,
          options
        );
      } else if (spec.geometry === 'CLUSTER_VOLUME') {
        scalable.buildClusterVolume(group, nodeMeshes, rows, dataset, encodings, spec, edges);
      } else {
        switch (spec.layout) {
          case 'GRID_3D':
            layouts.buildGrid(group, nodeMeshes, rows, dataset, encodings);
            break;
          case 'FORCE_DIRECTED_3D':
            layouts.buildForceDirected(group, nodeMeshes, rows, dataset, encodings, edges);
            break;
          case 'RADIAL_ORBITAL':
            layouts.buildRadial(group, nodeMeshes, rows, dataset, encodings);
            break;
          case 'VECTOR_STREAMLINE':
            layouts.buildStreamlines(group, nodeMeshes, rows, dataset);
            break;
          case 'TIME_RIBBON':
            layouts.buildTimeRibbon(group, nodeMeshes, rows, dataset, encodings);
            break;
          case 'GEO_SURFACE':
            layouts.buildGeoSurface(group, nodeMeshes, rows, dataset, encodings);
            break;
          case 'SPECTRAL_VOLUME':
            layouts.buildSpectralVolume(group, nodeMeshes, rows, dataset, encodings);
            break;
        }
      }
    }

    if (spec.layout === 'FORCE_DIRECTED_3D' && edges.length > 0) {
      layouts.buildEdges(group, edgeMeshes, nodeMeshes, edges);
    }
    if (spec.layout === 'RADIAL_ORBITAL') {
      layouts.buildParentEdges(group, edgeMeshes, nodeMeshes);
    }

    switch (spec.behavior) {
      case 'PULSE_QUANTITATIVE':
        behaviors.push((_delta, time) => {
          nodeMeshes.forEach((mesh, index) => {
            const scale = 1 + Math.sin(time * 3 + index * 0.5) * 0.15;
            mesh.scale.setScalar(scale);
          });
        });
        break;
      case 'ORBITAL_SPIN':
        behaviors.push((delta) => {
          group.rotation.y += delta * 0.3;
        });
        break;
      case 'WAVE_OSCILLATION':
        behaviors.push((_delta, time) => {
          nodeMeshes.forEach((mesh, index) => {
            mesh.position.y += Math.sin(time * 2 + index * 0.4) * 0.003;
          });
        });
        break;
    }

    const artifact: Artifact = {
      group,
      nodeMeshes,
      edgeMeshes,
      behaviors,
      interactions: new TopologyInteractionOwner(this._metaphorActions).create(
        spec.interaction,
        group,
        nodeMeshes,
        edges,
        options
      ),
      update: (delta, time) => {
        behaviors.forEach((behavior) => behavior(delta, time));
      },
      spec,
    };

    const chartPlaneFactory = options?.chartPlaneFactory || this._chartPlaneFactory;
    if (
      spec.geometry !== 'AGGREGATE_BARS' &&
      spec.geometry !== 'DISTRIBUTION_FIELD' &&
      spec.geometry !== 'DENSITY_FIELD' &&
      !governedClusterRegions &&
      (facts.numericColumns > 1 || facts.hasTimeSeries) &&
      dataset &&
      chartPlaneFactory
    ) {
      const chart = chartPlaneFactory(facts, dataset, {
        title: facts.hasTimeSeries ? 'Time Series' : 'Correlation',
        colorblindMode: options?.colorblindMode,
      });
      chart.setDataset?.(dataset);
      chart.mesh.position.set(2.4, 1.6, -3.5);
      chart.mesh.lookAt(0, 1.6, -3.5);
      group.add(chart.mesh);
      artifact.chartPlane = chart;
    }
    return artifact;
  }

  static _makeNode(
    row: Record<string, unknown>,
    dataset: Dataset | undefined,
    encodings: EncodingMapping,
    geometry: VRGeometry | string = 'ICOSA_NODE'
  ): THREE.Mesh {
    return new TopologyLayoutEmbodiment(this._colorblindMode).makeNode(
      row,
      dataset,
      encodings,
      geometry
    );
  }

  static _buildParentEdges(
    group: THREE.Group,
    edgeMeshes: THREE.Line[],
    nodeMeshes: THREE.Mesh[]
  ): void {
    new TopologyLayoutEmbodiment(this._colorblindMode).buildParentEdges(
      group,
      edgeMeshes,
      nodeMeshes
    );
  }

  static appendRowsToArtifact(
    artifact: Artifact | undefined,
    newRows: Record<string, unknown>[],
    dataInput: MonetaDataInput
  ): boolean {
    return this._timeRibbonUpdater.append(artifact, newRows, dataInput);
  }
}
