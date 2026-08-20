import * as THREE from 'three';
import { SeededRandom } from '../utils/SeededRandom.ts';
import {
  categoricalColor,
  numericColor,
  normalize,
} from '../data/Encodings.ts';
import {
  GridLayout3D,
  ForceDirected3D,
  RadialTreeLayout,
  TimeSeriesRibbonLayout,
  StreamlineLayout,
  GeoSurfaceLayout,
  SpectralVolumeLayout,
} from './layouts/index.ts';
import type { Dataset, DatasetEdge } from '../data/Dataset.ts';
import type { EncodingMapping } from '../data/SampleDatasets.ts';
import type {
  Artifact,
  MonetaDataInput,
  MonetaSpec,
  GeoEntry,
  InteractionCallbacks,
  LayoutEntry,
  RadialEntry,
  SolverResult,
  StreamlineEntry,
  TimeSeriesEntry,
  VRGeometry,
  VRInteraction,
  IInstancedPointCloud,
  InstancedPointCloudFactory,
  ChartPlaneFactory,
  MetaphorActionHandlers,
  VRTranslatorOptions,
} from './types.ts';

export class VRTopologyTranslator {
  private static _colorblindMode: string | boolean = 'none';
  private static _pointCloudFactory: InstancedPointCloudFactory | null = null;
  private static _chartPlaneFactory: ChartPlaneFactory | null = null;
  private static _metaphorActions: MetaphorActionHandlers = {};

  static registerPointCloudFactory(factory: InstancedPointCloudFactory): void {
    this._pointCloudFactory = factory;
  }

  static registerChartPlaneFactory(factory: ChartPlaneFactory): void {
    this._chartPlaneFactory = factory;
  }

  static registerMetaphorActions(actions: MetaphorActionHandlers): void {
    this._metaphorActions = { ...this._metaphorActions, ...actions };
  }

  private static _createDefaultPointCloud(count: number, geometry?: THREE.BufferGeometry): IInstancedPointCloud {
    const geom = geometry || new THREE.BoxGeometry(0.06, 0.06, 0.06);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const mesh = new THREE.InstancedMesh(geom, mat, count);
    const dummy = new THREE.Object3D();
    const colors = new Float32Array(count * 3);

    return {
      mesh,
      setPoints(items: { position: number[] | THREE.Vector3; scale?: number; color?: number | string }[]) {
        items.forEach((item, i) => {
          const pos = Array.isArray(item.position) ? item.position : [item.position.x, item.position.y, item.position.z];
          dummy.position.set(pos[0], pos[1], pos[2]);
          dummy.scale.setScalar(item.scale ?? 1);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          const c = new THREE.Color(item.color ?? 0x00ffcc);
          colors[i * 3 + 0] = c.r;
          colors[i * 3 + 1] = c.g;
          colors[i * 3 + 2] = c.b;
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
      },
    };
  }

  static synthesizeArtifact(monetaResult: SolverResult, dataInput: MonetaDataInput, options?: VRTranslatorOptions): Artifact {
    this._colorblindMode = options?.colorblindMode ?? 'none';
    const { spec, facts } = monetaResult;
    const dataset = dataInput.dataset;
    const encodings = dataInput.encodings ?? {};
    const rng = new SeededRandom(dataset?.fingerprint ?? 1);
    const group = new THREE.Group();
    const nodeMeshes: THREE.Mesh[] = [];
    const edgeMeshes: THREE.Line[] = [];
    const behaviors: Array<(delta: number, time: number) => void> = [];

    const rows = dataset?.rows ?? dataInput.rows ?? [];
    const edges = dataInput.edges ?? dataset?.edges ?? [];

    if (spec.geometry === 'INSTANCED_POINT_CLOUD') {
      this._buildInstancedPointCloud(
        group,
        nodeMeshes,
        rows,
        dataset,
        encodings,
        spec,
        rng,
        edges,
        facts.depth
      );
    } else if (spec.geometry === 'CLUSTER_VOLUME') {
      this._buildClusterVolume(
        group,
        nodeMeshes,
        rows,
        dataset,
        encodings,
        spec,
        rng,
        edges,
        facts.depth
      );
    } else if (spec.geometry === 'AGGREGATE_BARS') {
      this._buildAggregateBars(
        group,
        nodeMeshes,
        rows,
        dataset,
        encodings,
        spec,
        rng,
        edges,
        facts.depth
      );
    } else {
      switch (spec.layout) {
        case 'GRID_3D':
          this._buildGrid(group, nodeMeshes, rows, dataset, encodings, rng);
          break;
        case 'FORCE_DIRECTED_3D':
          this._buildForceDirected(group, nodeMeshes, rows, dataset, encodings, rng, edges);
          break;
        case 'RADIAL_ORBITAL':
          this._buildRadial(group, nodeMeshes, rows, dataset, encodings, facts.depth);
          break;
        case 'VECTOR_STREAMLINE':
          this._buildStreamlines(group, nodeMeshes, rows, dataset, encodings, rng);
          break;
        case 'TIME_RIBBON':
          this._buildTimeRibbon(group, nodeMeshes, rows, dataset, encodings);
          break;
        case 'GEO_SURFACE':
          this._buildGeoSurface(group, nodeMeshes, rows, dataset, encodings, rng);
          break;
        case 'SPECTRAL_VOLUME':
          this._buildSpectralVolume(group, nodeMeshes, rows, dataset, encodings, rng);
          break;
      }
    }

    if (spec.layout === 'FORCE_DIRECTED_3D' && edges.length > 0) {
      this._buildEdges(group, edgeMeshes, nodeMeshes, edges);
    }

    if (spec.layout === 'RADIAL_ORBITAL') {
      this._buildParentEdges(group, edgeMeshes, nodeMeshes);
    }

    switch (spec.behavior) {
      case 'PULSE_QUANTITATIVE':
        behaviors.push((_delta, time) => {
          nodeMeshes.forEach((m, idx) => {
            const s = 1.0 + Math.sin(time * 3.0 + idx * 0.5) * 0.15;
            m.scale.setScalar(s);
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
          nodeMeshes.forEach((m, idx) => {
            m.position.y += Math.sin(time * 2.0 + idx * 0.4) * 0.003;
          });
        });
        break;
    }

    const artifact: Artifact = {
      group,
      nodeMeshes,
      edgeMeshes,
      behaviors,
      interactions: this._makeInteractions(
        spec.interaction,
        group,
        nodeMeshes,
        edgeMeshes,
        rows,
        edges,
        options
      ),
      update: (delta, time) => {
        behaviors.forEach((b) => b(delta, time));
      },
      spec,
    };

    const cpFactory = options?.chartPlaneFactory || this._chartPlaneFactory;
    if ((facts.numericColumns > 1 || facts.hasTimeSeries) && dataset && cpFactory) {
      const chart = cpFactory(facts, dataset, {
        title: facts.hasTimeSeries ? 'Time Series' : 'Correlation',
        colorblindMode: options?.colorblindMode,
      });
      if (chart.setDataset) {
        chart.setDataset(dataset);
      }
      chart.mesh.position.set(2.4, 1.6, -3.5);
      chart.mesh.lookAt(0, 1.6, -3.5);
      group.add(chart.mesh);
      artifact.chartPlane = chart;
    }

    return artifact;
  }

  static _makeInteractions(
    interactionType: VRInteraction,
    group: THREE.Group,
    nodeMeshes: THREE.Mesh[],
    _edgeMeshes: THREE.Line[],
    _rows: Record<string, unknown>[],
    edges: DatasetEdge[],
    options?: VRTranslatorOptions
  ): InteractionCallbacks {
    const actions = { ...this._metaphorActions, ...options?.metaphorActions };
    const base = {
      onHover: (mesh: THREE.Mesh) => {
        if ((mesh.material as THREE.MeshStandardMaterial | undefined)?.emissiveIntensity !== undefined) {
          (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 2.0;
        } else if ((mesh.userData as { instancedCloud?: unknown }).instancedCloud) {
          (mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(
            1,
            (mesh.material as THREE.MeshBasicMaterial).opacity + 0.25
          );
        } else if (mesh.material) {
          (mesh.userData as { _originalOpacity?: number })._originalOpacity = (
            mesh.material as THREE.Material
          ).opacity;
          (mesh.material as THREE.Material).opacity = Math.min(
            1,
            (mesh.material as THREE.Material).opacity + 0.4
          );
        }
      },
      onUnhover: (mesh: THREE.Mesh) => {
        if ((mesh.material as THREE.MeshStandardMaterial | undefined)?.emissiveIntensity !== undefined) {
          (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3;
        } else if (
          mesh.material &&
          (mesh.userData as { _originalOpacity?: number })._originalOpacity !== undefined
        ) {
          (mesh.material as THREE.Material).opacity = (mesh.userData as { _originalOpacity: number })._originalOpacity;
        }
      },
      onSelect: (mesh: THREE.Mesh) => {
        if ((mesh.material as THREE.MeshStandardMaterial | undefined)?.emissiveIntensity !== undefined) {
          (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 3.0;
        } else if (mesh.material) {
          (mesh.userData as { _originalOpacity?: number })._originalOpacity = (
            mesh.material as THREE.Material
          ).opacity;
          (mesh.material as THREE.Material).opacity = Math.min(
            1,
            (mesh.material as THREE.Material).opacity + 0.6
          );
        }
      },
    };

    const meshList = nodeMeshes.filter((m) => !(m instanceof THREE.InstancedMesh));
    const others = (target: THREE.Mesh) => meshList.filter((m) => m !== target);

    switch (interactionType) {
      case 'RESONANCE_PULSE':
        return {
          ...base,
          type: interactionType,
          onSelect: (mesh: THREE.Mesh) => {
            base.onSelect(mesh);
            const partners: THREE.Mesh[] = [];
            if (edges?.length && mesh.userData.row) {
              const row = mesh.userData.row as Record<string, unknown>;
              const id = (row.id ?? row.name) as string | number;
              for (const e of edges) {
                if (e.source === id) {
                  const partner = meshList.find(
                    (m) =>
                      ((m.userData.row as Record<string, unknown> | undefined)?.id ??
                        (m.userData.row as Record<string, unknown> | undefined)?.name) ===
                      e.target
                  );
                  if (partner) partners.push(partner);
                }
                if (e.target === id) {
                  const partner = meshList.find(
                    (m) =>
                      ((m.userData.row as Record<string, unknown> | undefined)?.id ??
                        (m.userData.row as Record<string, unknown> | undefined)?.name) ===
                      e.source
                  );
                  if (partner) partners.push(partner);
                }
              }
            }
            actions.applyResonancePulse?.(group, mesh, partners);
          },
        };
      case 'FORK_PLANE':
        return {
          ...base,
          type: interactionType,
          onSelect: (mesh: THREE.Mesh) => {
            base.onSelect(mesh);
            actions.applyForkPlane?.(group, mesh);
          },
        };
      case 'CHRONO_DIAL':
        return {
          ...base,
          type: interactionType,
          onSelect: (mesh: THREE.Mesh) => {
            base.onSelect(mesh);
            actions.applyChronoDial?.(group, mesh);
          },
        };
      case 'CONSTELLATION':
        return {
          ...base,
          type: interactionType,
          onSelect: (mesh: THREE.Mesh) => {
            base.onSelect(mesh);
            actions.applyConstellation?.(group, mesh, others(mesh).slice(0, 8));
          },
        };
      case 'BEACON':
        return {
          ...base,
          type: interactionType,
          onSelect: (mesh: THREE.Mesh) => {
            base.onSelect(mesh);
            actions.applyBeacon?.(group, mesh);
          },
        };
      case 'ALEPH':
        return {
          ...base,
          type: interactionType,
          onSelect: (mesh: THREE.Mesh) => {
            base.onSelect(mesh);
            actions.applyAleph?.(group, mesh, others(mesh));
          },
        };
      default:
        return { ...base, type: interactionType };
    }
  }

  static _makeNode(
    row: Record<string, unknown>,
    dataset: Dataset | undefined,
    encodings: EncodingMapping,
    geometry: VRGeometry | string = 'ICOSA_NODE'
  ): THREE.Mesh {
    let color = 0x00ffcc;
    let scale = 1;

    if (encodings.color && dataset) {
      const col = dataset.getColumn(encodings.color);
      const value = row[encodings.color];
      if (col?.type === 'CATEGORICAL') {
        const unique = [...new Set(dataset.getColumnValues(encodings.color))];
        color = categoricalColor(value, unique.indexOf(value), this._colorblindMode);
      } else if (col?.type === 'NUMERIC') {
        const range = dataset.rangeOf(encodings.color);
        color = numericColor(value as number, range.min, range.max, 0x00ffcc, 0xff0055);
      }
    }

    if (encodings.size && dataset) {
      const col = dataset.getColumn(encodings.size);
      if (col?.type === 'NUMERIC') {
        const range = dataset.rangeOf(encodings.size);
        scale = 0.6 + 0.8 * normalize(row[encodings.size] as number, range.min, range.max);
      }
    }

    let geom: THREE.BufferGeometry;
    switch (geometry) {
      case 'CUBE_MATRIX':
        geom = new THREE.BoxGeometry(0.45, 0.45, 0.45);
        break;
      case 'ORB':
        geom = new THREE.SphereGeometry(0.3, 16, 16);
        break;
      case 'CONICAL_TREE':
        geom = new THREE.ConeGeometry(0.25, 0.6, 8);
        break;
      case 'FLOW_RAY':
        geom = new THREE.ConeGeometry(0.12, 0.7, 8);
        break;
      case 'GEO_COLUMN':
        geom = new THREE.CylinderGeometry(0.06, 0.06, 1, 8);
        break;
      case 'COLUMN':
        geom = new THREE.CylinderGeometry(0.12, 0.12, 0.8, 16);
        break;
      case 'TOKEN':
        geom = new THREE.CylinderGeometry(0.22, 0.22, 0.05, 24);
        break;
      case 'PLINTH':
        geom = new THREE.BoxGeometry(0.6, 0.15, 0.6);
        break;
      case 'BEAM':
        geom = new THREE.BoxGeometry(0.06, 0.06, 1.2);
        break;
      case 'RING':
        geom = new THREE.TorusGeometry(0.3, 0.04, 12, 32);
        break;
      case 'FIELD':
        geom = new THREE.PlaneGeometry(1, 1, 8, 8);
        break;
      case 'ZONE':
        geom = new THREE.CylinderGeometry(0.5, 0.5, 0.02, 32, 1, true);
        break;
      case 'SPECTRAL_BAR':
        geom = new THREE.CylinderGeometry(0.08, 0.08, 0.7, 8);
        break;
      case 'SPECTRAL_SURFACE':
        geom = new THREE.PlaneGeometry(0.3, 0.3);
        break;
      default:
        geom = new THREE.IcosahedronGeometry(0.32, 1);
    }

    const mat = new THREE.MeshStandardMaterial({
      color,
      wireframe: true,
      emissive: color,
      emissiveIntensity: 0.3,
      roughness: 0.3,
      metalness: 0.7,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.userData = { row, dataset, encodings };
    mesh.scale.setScalar(scale);
    return mesh;
  }

  static _buildGrid(
    group: THREE.Group,
    nodeMeshes: THREE.Mesh[],
    rows: Record<string, unknown>[],
    dataset: Dataset | undefined,
    encodings: EncodingMapping,
    _rng: SeededRandom
  ): void {
    const sortKey = dataset?.numericColumns[0]?.name;
    const positions = GridLayout3D.compute(rows, { sortKey, yOffset: 1.2 });
    for (const p of positions) {
      const mesh = this._makeNode(p.row, dataset, encodings, 'CUBE_MATRIX');
      mesh.position.copy(p.position);
      group.add(mesh);
      nodeMeshes.push(mesh);
    }
  }

  static _buildForceDirected(
    group: THREE.Group,
    nodeMeshes: THREE.Mesh[],
    rows: Record<string, unknown>[],
    dataset: Dataset | undefined,
    encodings: EncodingMapping,
    _rng: SeededRandom,
    edges: DatasetEdge[] = []
  ): void {
    const positions = ForceDirected3D.compute(rows, {
      edges,
      seed: dataset?.fingerprint ?? 1,
      yOffset: 1.2,
    });
    for (const p of positions) {
      const mesh = this._makeNode(p.row, dataset, encodings, 'ICOSA_NODE');
      mesh.position.copy(p.position);
      group.add(mesh);
      nodeMeshes.push(mesh);
    }
  }

  static _buildRadial(
    group: THREE.Group,
    nodeMeshes: THREE.Mesh[],
    rows: Record<string, unknown>[],
    dataset: Dataset | undefined,
    encodings: EncodingMapping,
    _depth: number
  ): void {
    const positions = RadialTreeLayout.compute(rows, { yOffset: 1.2 }) as RadialEntry<Record<string, unknown>>[];
    for (const p of positions) {
      const mesh = this._makeNode(p.row, dataset, encodings, 'CONICAL_TREE');
      mesh.position.copy(p.position);
      if (p.parentIndex != null) {
        mesh.userData.parentIndex = p.parentIndex;
      }
      group.add(mesh);
      nodeMeshes.push(mesh);
    }
  }

  static _buildStreamlines(
    group: THREE.Group,
    nodeMeshes: THREE.Mesh[],
    rows: Record<string, unknown>[],
    dataset: Dataset | undefined,
    _encodings: EncodingMapping,
    _rng: SeededRandom
  ): void {
    const positions = StreamlineLayout.compute(rows, {
      count: Math.min(30, Math.max(8, rows.length)),
      seed: dataset?.fingerprint ?? 1,
    }) as StreamlineEntry<Record<string, unknown>>[];
    for (const p of positions) {
      const geom = new THREE.ConeGeometry(0.12, 0.7, 8);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        wireframe: true,
        transparent: true,
        opacity: 0.6,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.userData = { row: p.row };
      mesh.position.copy(p.position);
      group.add(mesh);
      nodeMeshes.push(mesh);
    }
  }

  static _buildTimeRibbon(
    group: THREE.Group,
    nodeMeshes: THREE.Mesh[],
    rows: Record<string, unknown>[],
    dataset: Dataset | undefined,
    encodings: EncodingMapping
  ): void {
    const timeField = encodings.time || dataset?.temporalColumns[0]?.name || 'time';
    const valueField = encodings.size || dataset?.numericColumns[0]?.name || 'value';
    const seriesField = dataset?.categoricalColumns[0]?.name || 'sensorId';
    const positions = TimeSeriesRibbonLayout.compute(rows, {
      timeKey: timeField,
      valueKey: valueField,
      seriesKey: seriesField,
      yOffset: 1.2,
    }) as TimeSeriesEntry<Record<string, unknown>>[];

    const bySeries: Record<string | number, TimeSeriesEntry<Record<string, unknown>>[]> = {};
    for (const p of positions) {
      if (!bySeries[p.seriesId]) bySeries[p.seriesId] = [];
      bySeries[p.seriesId].push(p);
    }

    Object.entries(bySeries).forEach(([id, pts], sIdx) => {
      const points = pts.map((p) => p.position.clone());
      if (points.length < 2) return;
      const curve = new THREE.CatmullRomCurve3(points);
      const geom = new THREE.TubeGeometry(curve, points.length * 3, 0.06, 8, false);
      const color = categoricalColor(id, sIdx, this._colorblindMode);
      const mat = new THREE.MeshBasicMaterial({
        color,
        wireframe: true,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.userData = { row: { series: id }, seriesIndex: sIdx };
      group.add(mesh);
      nodeMeshes.push(mesh);
    });
  }

  static _buildEdges(
    group: THREE.Group,
    edgeMeshes: THREE.Line[],
    nodeMeshes: THREE.Mesh[],
    edges: DatasetEdge[]
  ): void {
    const positions: number[] = [];
    for (const e of edges) {
      const src = nodeMeshes.find(
        (m) =>
          (m.userData.row as Record<string, unknown> | undefined)?.id === e.source ||
          (m.userData.row as Record<string, unknown> | undefined)?.name === e.source
      );
      const dst = nodeMeshes.find(
        (m) =>
          (m.userData.row as Record<string, unknown> | undefined)?.id === e.target ||
          (m.userData.row as Record<string, unknown> | undefined)?.name === e.target
      );
      if (!src || !dst) continue;
      positions.push(src.position.x, src.position.y, src.position.z);
      positions.push(dst.position.x, dst.position.y, dst.position.z);
    }
    if (positions.length === 0) return;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.35 });
    const lineSegments = new THREE.LineSegments(geo, mat);
    group.add(lineSegments);
    edgeMeshes.push(lineSegments);
  }

  static _buildParentEdges(
    group: THREE.Group,
    edgeMeshes: THREE.Line[],
    nodeMeshes: THREE.Mesh[]
  ): void {
    const positions: number[] = [];
    for (const mesh of nodeMeshes) {
      const parentIdx =
        (mesh.userData.row as Record<string, unknown> | undefined)?._parentIndex ??
        (mesh.userData.row as Record<string, unknown> | undefined)?.parentIndex;
      if (parentIdx == null) continue;
      const parent = nodeMeshes[parentIdx as number];
      if (!parent) continue;
      positions.push(parent.position.x, parent.position.y, parent.position.z);
      positions.push(mesh.position.x, mesh.position.y, mesh.position.z);
    }
    if (positions.length === 0) return;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xff88cc, transparent: true, opacity: 0.35 });
    const lineSegments = new THREE.LineSegments(geo, mat);
    group.add(lineSegments);
    edgeMeshes.push(lineSegments);
  }

  static _buildGeoSurface(
    group: THREE.Group,
    nodeMeshes: THREE.Mesh[],
    rows: Record<string, unknown>[],
    dataset: Dataset | undefined,
    encodings: EncodingMapping,
    _rng: SeededRandom
  ): void {
    const positions = GeoSurfaceLayout.compute(rows, {
      latKey: encodings.size ?? 'lat',
      lonKey: encodings.color ?? 'lon',
      valueKey: encodings.pulse ?? 'elevation',
      roomWidth: 6.0,
      roomDepth: 6.0,
      heightScale: 1.2,
      yOffset: 1.2,
    });
    for (const p of positions) {
      const mesh = this._makeNode(p.row, dataset, encodings, 'GEO_COLUMN');
      mesh.position.copy(p.position);
      group.add(mesh);
      nodeMeshes.push(mesh);
    }
  }

  static _buildSpectralVolume(
    group: THREE.Group,
    nodeMeshes: THREE.Mesh[],
    rows: Record<string, unknown>[],
    dataset: Dataset | undefined,
    encodings: EncodingMapping,
    _rng: SeededRandom
  ): void {
    const freqKey = encodings.time ?? dataset?.temporalColumns[0]?.name ?? dataset?.numericColumns[0]?.name;
    const powerKey = encodings.size ?? dataset?.numericColumns[0]?.name;
    const positions = SpectralVolumeLayout.compute(rows, {
      frequencyKey: freqKey,
      powerKey,
      yOffset: 1.2,
    });
    for (const p of positions) {
      const mesh = this._makeNode(p.row, dataset, encodings, 'SPECTRAL_BAR');
      mesh.position.copy(p.position);
      group.add(mesh);
      nodeMeshes.push(mesh);
    }
  }

  static _computeLayoutPositions(
    rows: Record<string, unknown>[],
    dataset: Dataset | undefined,
    encodings: EncodingMapping,
    spec: MonetaSpec,
    _rng: SeededRandom,
    edges: DatasetEdge[] = [],
    _depth = 1
  ): LayoutEntry<Record<string, unknown>>[] {
    switch (spec.layout) {
      case 'GRID_3D': {
        const sortKey = encodings.size || dataset?.numericColumns[0]?.name;
        return GridLayout3D.compute(rows, { sortKey, yOffset: 1.2 });
      }
      case 'FORCE_DIRECTED_3D': {
        return ForceDirected3D.compute(rows, {
          edges,
          seed: dataset?.fingerprint ?? 1,
          yOffset: 1.2,
        });
      }
      case 'RADIAL_ORBITAL': {
        return RadialTreeLayout.compute(rows, { yOffset: 1.2 });
      }
      case 'GEO_SURFACE': {
        const valueField = encodings.size || dataset?.numericColumns[0]?.name;
        return GeoSurfaceLayout.compute(rows, { valueKey: valueField, yOffset: 0.5 });
      }
      case 'TIME_RIBBON': {
        const timeField = encodings.time || dataset?.temporalColumns[0]?.name || 'time';
        const valueField = encodings.size || dataset?.numericColumns[0]?.name || 'temperature';
        return TimeSeriesRibbonLayout.compute(rows, {
          timeKey: timeField,
          valueKey: valueField,
          yOffset: 1.2,
        });
      }
      default:
        return [];
    }
  }

  static _buildInstancedPointCloud(
    group: THREE.Group,
    nodeMeshes: THREE.Mesh[],
    rows: Record<string, unknown>[],
    dataset: Dataset | undefined,
    encodings: EncodingMapping,
    spec: MonetaSpec,
    rng: SeededRandom,
    edges: DatasetEdge[] = [],
    depth = 1,
    options?: VRTranslatorOptions
  ): void {
    const positions = this._computeLayoutPositions(
      rows,
      dataset,
      encodings,
      spec,
      rng,
      edges,
      depth
    );
    if (positions.length === 0) return;

    const colorField =
      encodings.color || dataset?.categoricalColumns[0]?.name || dataset?.numericColumns[0]?.name;
    const sizeField = encodings.size || dataset?.numericColumns[0]?.name;
    if (!dataset) return;
    const colorCol = colorField ? dataset.getColumn(colorField) : null;
    const sizeCol = sizeField ? dataset.getColumn(sizeField) : null;
    const uniqueColors =
      colorField && colorCol?.type === 'CATEGORICAL'
        ? [...new Set(dataset.getColumnValues(colorField))]
        : [];
    const sizeRange =
      sizeField && sizeCol?.type === 'NUMERIC'
        ? dataset.rangeOf(sizeField)
        : { min: 0, max: 1 };

    const items = positions.map((p, idx) => {
      const row = p.row;
      let color = 0x00ffcc;
      let scale = 1;

      if (colorField && dataset) {
        const value = row[colorField];
        if (colorCol?.type === 'CATEGORICAL') {
          color = categoricalColor(value, uniqueColors.indexOf(value), this._colorblindMode);
        } else if (colorCol?.type === 'NUMERIC') {
          color = numericColor(value as number, sizeRange.min, sizeRange.max, 0x00ffcc, 0xff0055);
        }
      }

      if (sizeField && dataset && sizeCol?.type === 'NUMERIC') {
        scale = 0.6 + 0.8 * normalize(row[sizeField] as number, sizeRange.min, sizeRange.max);
      }

      return {
        position: [p.position.x, p.position.y, p.position.z],
        color,
        scale: Math.max(0.3, scale * 0.5),
        data: { row, index: idx },
      };
    });

    const pcFactory = options?.pointCloudFactory || this._pointCloudFactory || this._createDefaultPointCloud;
    const cloud = pcFactory(items.length, new THREE.BoxGeometry(0.06, 0.06, 0.06));
    cloud.setPoints(items);
    (cloud.mesh as THREE.Mesh).userData = { instancedCloud: cloud };
    group.add(cloud.mesh);
    nodeMeshes.push(cloud.mesh as THREE.Mesh);
  }

  static _buildClusterVolume(
    group: THREE.Group,
    nodeMeshes: THREE.Mesh[],
    rows: Record<string, unknown>[],
    dataset: Dataset | undefined,
    encodings: EncodingMapping,
    spec: MonetaSpec,
    rng: SeededRandom,
    edges: DatasetEdge[] = [],
    depth = 1
  ): void {
    const positions = this._computeLayoutPositions(
      rows,
      dataset,
      encodings,
      spec,
      rng,
      edges,
      depth
    );
    if (positions.length === 0) return;

    const colorField = encodings.color || dataset?.categoricalColumns[0]?.name;
    if (!colorField || !dataset) return;

    const clusters = new Map<unknown, THREE.Vector3[]>();
    for (const p of positions) {
      const key = p.row[colorField] ?? 'unknown';
      if (!clusters.has(key)) clusters.set(key, []);
      clusters.get(key)!.push(p.position);
    }

    let clusterIdx = 0;
    for (const [key, pts] of clusters) {
      if (pts.length === 0) continue;
      const center = new THREE.Vector3();
      for (const p of pts) center.add(p);
      center.divideScalar(pts.length);

      let radius = 0;
      for (const p of pts) {
        radius = Math.max(radius, p.distanceTo(center));
      }
      radius = Math.max(0.1, radius * 1.2);

      const color = categoricalColor(key, clusterIdx, this._colorblindMode);
      const geom = new THREE.SphereGeometry(radius, 24, 24);
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.15,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.copy(center);
      mesh.userData = { cluster: key, count: pts.length };
      group.add(mesh);
      nodeMeshes.push(mesh);
      clusterIdx++;
    }
  }

  static _buildAggregateBars(
    group: THREE.Group,
    nodeMeshes: THREE.Mesh[],
    rows: Record<string, unknown>[],
    dataset: Dataset | undefined,
    encodings: EncodingMapping,
    spec: MonetaSpec,
    rng: SeededRandom,
    edges: DatasetEdge[] = [],
    depth = 1
  ): void {
    if (spec.layout === 'GEO_SURFACE') {
      const catField = encodings.color || dataset?.categoricalColumns[0]?.name;
      const valueField = encodings.size || dataset?.numericColumns[0]?.name;
      if (!catField || !dataset) return;

      interface AggregateGroup {
        rows: Record<string, unknown>[];
      }
      const groups = new Map<unknown, AggregateGroup>();
      for (const row of rows) {
        const key = row[catField] ?? 'unknown';
        if (!groups.has(key)) groups.set(key, { rows: [] });
        groups.get(key)!.rows.push(row);
      }

      const geoPositions = GeoSurfaceLayout.compute(rows, { valueKey: valueField, yOffset: 0.5 }) as GeoEntry<Record<string, unknown>>[];
      const byRow = new Map<Record<string, unknown>, GeoEntry<Record<string, unknown>>>();
      for (const p of geoPositions) byRow.set(p.row, p);

      for (const [key, g] of groups) {
        const center = new THREE.Vector3();
        let valueSum = 0;
        let count = 0;
        for (const row of g.rows) {
          const p = byRow.get(row);
          if (!p) continue;
          center.add(p.position);
          valueSum += Number(p.value) || Number(row[valueField as string]) || 0;
          count++;
        }
        if (count === 0) continue;
        center.divideScalar(count);
        const avgValue = valueSum / count;

        const color = categoricalColor(key, [...groups.keys()].indexOf(key), this._colorblindMode);
        const height = Math.max(0.2, avgValue * 0.05);
        const geom = new THREE.CylinderGeometry(0.12, 0.12, height, 16);
        geom.translate(0, height / 2, 0);
        const mat = new THREE.MeshStandardMaterial({
          color,
          wireframe: true,
          emissive: color,
          emissiveIntensity: 0.3,
          roughness: 0.3,
          metalness: 0.7,
        });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.copy(center);
        mesh.userData = { category: key, aggregateValue: avgValue, count };
        group.add(mesh);
        nodeMeshes.push(mesh);
      }
      return;
    }

    this._buildInstancedPointCloud(
      group,
      nodeMeshes,
      rows,
      dataset,
      encodings,
      spec,
      rng,
      edges,
      depth
    );
  }

  static appendRowsToArtifact(
    artifact: Artifact | undefined,
    newRows: Record<string, unknown>[],
    dataInput: MonetaDataInput
  ): boolean {
    if (!artifact || !newRows?.length) return false;
    if (artifact.spec?.layout !== 'TIME_RIBBON') return false;

    const dataset = dataInput.dataset;
    const encodings = dataInput.encodings ?? {};
    const timeField = encodings.time || dataset?.temporalColumns[0]?.name || 'time';
    const valueField = encodings.size || dataset?.numericColumns[0]?.name || 'value';

    const bySeries: Record<string | number, Record<string, unknown>[]> = {};
    for (const row of newRows) {
      const id = (row.sensorId as string | number) || 'S';
      if (!bySeries[id]) bySeries[id] = [];
      bySeries[id].push(row);
    }

    for (const [id, sRows] of Object.entries(bySeries)) {
      const existingMesh = artifact.nodeMeshes.find(
        (m) => (m.userData.row as Record<string, unknown> | undefined)?.series === id
      );
      if (!existingMesh) continue;

      const existingPoints =
        ((existingMesh.geometry as THREE.TubeGeometry).parameters?.path as { points?: THREE.Vector3[] } | undefined)
          ?.points || [];
      const startIdx = existingPoints.length;
      const newPoints = sRows
        .slice()
        .sort(
          (a, b) =>
            new Date(a[timeField] as string | number | Date).getTime() -
            new Date(b[timeField] as string | number | Date).getTime()
        )
        .map((r, idx) => {
          const value = Number(r[valueField]) || 0;
          return new THREE.Vector3(
            (startIdx + idx) * 0.8 - 2,
            value * 0.2,
            ((existingMesh.userData.seriesIndex as number) || 0) * 1.5 - 2
          );
        });
      if (newPoints.length === 0) continue;

      const points = [...existingPoints, ...newPoints];
      if (points.length < 2) continue;
      const curve = new THREE.CatmullRomCurve3(points);
      existingMesh.geometry.dispose();
      existingMesh.geometry = new THREE.TubeGeometry(curve, points.length * 3, 0.06, 8, false);
    }

    return true;
  }
}
