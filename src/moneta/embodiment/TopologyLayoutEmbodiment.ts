import * as THREE from 'three';
import type { Dataset, DatasetEdge } from '../../data/Dataset.ts';
import { categoricalColor, normalize, numericColor } from '../../data/Encodings.ts';
import type { EncodingMapping } from '../../data/SampleDatasets.ts';
import {
  ForceDirected3D,
  GeoSurfaceLayout,
  GridLayout3D,
  RadialTreeLayout,
  SpectralVolumeLayout,
  StreamlineLayout,
  TimeSeriesRibbonLayout,
} from '../layouts/index.ts';
import type {
  LayoutEntry,
  MonetaSpec,
  RadialEntry,
  StreamlineEntry,
  TimeSeriesEntry,
  VRGeometry,
} from '../types.ts';

export class TopologyLayoutEmbodiment {
  constructor(private readonly _colorblindMode: string | boolean = 'none') {}

  makeNode(
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

  buildGrid(
    group: THREE.Group,
    nodeMeshes: THREE.Mesh[],
    rows: Record<string, unknown>[],
    dataset: Dataset | undefined,
    encodings: EncodingMapping
  ): void {
    const sortKey = dataset?.numericColumns[0]?.name;
    const positions = GridLayout3D.compute(rows, { sortKey, yOffset: 1.2 });
    for (const p of positions) {
      const mesh = this.makeNode(p.row, dataset, encodings, 'CUBE_MATRIX');
      mesh.position.copy(p.position);
      group.add(mesh);
      nodeMeshes.push(mesh);
    }
  }

  buildForceDirected(
    group: THREE.Group,
    nodeMeshes: THREE.Mesh[],
    rows: Record<string, unknown>[],
    dataset: Dataset | undefined,
    encodings: EncodingMapping,
    edges: DatasetEdge[] = []
  ): void {
    const positions = ForceDirected3D.compute(rows, {
      edges,
      seed: dataset?.fingerprint ?? 1,
      yOffset: 1.2,
    });
    for (const p of positions) {
      const mesh = this.makeNode(p.row, dataset, encodings, 'ICOSA_NODE');
      mesh.position.copy(p.position);
      group.add(mesh);
      nodeMeshes.push(mesh);
    }
  }

  buildRadial(
    group: THREE.Group,
    nodeMeshes: THREE.Mesh[],
    rows: Record<string, unknown>[],
    dataset: Dataset | undefined,
    encodings: EncodingMapping
  ): void {
    const positions = RadialTreeLayout.compute(rows, {
      yOffset: 1.2,
    }) as RadialEntry<Record<string, unknown>>[];
    for (const p of positions) {
      const mesh = this.makeNode(p.row, dataset, encodings, 'CONICAL_TREE');
      mesh.position.copy(p.position);
      if (p.parentIndex != null) mesh.userData.parentIndex = p.parentIndex;
      group.add(mesh);
      nodeMeshes.push(mesh);
    }
  }

  buildStreamlines(
    group: THREE.Group,
    nodeMeshes: THREE.Mesh[],
    rows: Record<string, unknown>[],
    dataset: Dataset | undefined
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

  buildTimeRibbon(
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
    Object.entries(bySeries).forEach(([id, pts], seriesIndex) => {
      const points = pts.map((p) => p.position.clone());
      if (points.length < 2) return;
      const curve = new THREE.CatmullRomCurve3(points);
      const geom = new THREE.TubeGeometry(curve, points.length * 3, 0.06, 8, false);
      const color = categoricalColor(id, seriesIndex, this._colorblindMode);
      const mat = new THREE.MeshBasicMaterial({
        color,
        wireframe: true,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.userData = { row: { series: id }, seriesIndex };
      group.add(mesh);
      nodeMeshes.push(mesh);
    });
  }

  buildEdges(
    group: THREE.Group,
    edgeMeshes: THREE.Line[],
    nodeMeshes: THREE.Mesh[],
    edges: DatasetEdge[]
  ): void {
    const positions: number[] = [];
    for (const edge of edges) {
      const source = nodeMeshes.find(
        (mesh) =>
          (mesh.userData.row as Record<string, unknown> | undefined)?.id === edge.source ||
          (mesh.userData.row as Record<string, unknown> | undefined)?.name === edge.source
      );
      const target = nodeMeshes.find(
        (mesh) =>
          (mesh.userData.row as Record<string, unknown> | undefined)?.id === edge.target ||
          (mesh.userData.row as Record<string, unknown> | undefined)?.name === edge.target
      );
      if (!source || !target) continue;
      positions.push(source.position.x, source.position.y, source.position.z);
      positions.push(target.position.x, target.position.y, target.position.z);
    }
    if (positions.length === 0) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.35,
    });
    const lines = new THREE.LineSegments(geometry, material);
    group.add(lines);
    edgeMeshes.push(lines);
  }

  buildParentEdges(group: THREE.Group, edgeMeshes: THREE.Line[], nodeMeshes: THREE.Mesh[]): void {
    const positions: number[] = [];
    for (const mesh of nodeMeshes) {
      const parentIndex =
        (mesh.userData as { parentIndex?: unknown }).parentIndex ??
        (mesh.userData.row as Record<string, unknown> | undefined)?._parentIndex ??
        (mesh.userData.row as Record<string, unknown> | undefined)?.parentIndex;
      if (parentIndex == null) continue;
      const parent = nodeMeshes[parentIndex as number];
      if (!parent) continue;
      positions.push(parent.position.x, parent.position.y, parent.position.z);
      positions.push(mesh.position.x, mesh.position.y, mesh.position.z);
    }
    if (positions.length === 0) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({
      color: 0xff88cc,
      transparent: true,
      opacity: 0.35,
    });
    const lines = new THREE.LineSegments(geometry, material);
    group.add(lines);
    edgeMeshes.push(lines);
  }

  buildGeoSurface(
    group: THREE.Group,
    nodeMeshes: THREE.Mesh[],
    rows: Record<string, unknown>[],
    dataset: Dataset | undefined,
    encodings: EncodingMapping
  ): void {
    const positions = GeoSurfaceLayout.compute(rows, {
      latKey: encodings.size ?? 'lat',
      lonKey: encodings.color ?? 'lon',
      valueKey: encodings.pulse ?? 'elevation',
      roomWidth: 6,
      roomDepth: 6,
      heightScale: 1.2,
      yOffset: 1.2,
    });
    for (const p of positions) {
      const mesh = this.makeNode(p.row, dataset, encodings, 'GEO_COLUMN');
      mesh.position.copy(p.position);
      group.add(mesh);
      nodeMeshes.push(mesh);
    }
  }

  buildSpectralVolume(
    group: THREE.Group,
    nodeMeshes: THREE.Mesh[],
    rows: Record<string, unknown>[],
    dataset: Dataset | undefined,
    encodings: EncodingMapping
  ): void {
    const frequencyKey =
      encodings.time ?? dataset?.temporalColumns[0]?.name ?? dataset?.numericColumns[0]?.name;
    const powerKey = encodings.size ?? dataset?.numericColumns[0]?.name;
    const positions = SpectralVolumeLayout.compute(rows, {
      frequencyKey,
      powerKey,
      yOffset: 1.2,
    });
    for (const p of positions) {
      const mesh = this.makeNode(p.row, dataset, encodings, 'SPECTRAL_BAR');
      mesh.position.copy(p.position);
      group.add(mesh);
      nodeMeshes.push(mesh);
    }
  }

  computeLayoutPositions(
    rows: Record<string, unknown>[],
    dataset: Dataset | undefined,
    encodings: EncodingMapping,
    spec: MonetaSpec,
    edges: DatasetEdge[] = []
  ): LayoutEntry<Record<string, unknown>>[] {
    switch (spec.layout) {
      case 'GRID_3D': {
        const sortKey = encodings.size || dataset?.numericColumns[0]?.name;
        return GridLayout3D.compute(rows, { sortKey, yOffset: 1.2 });
      }
      case 'FORCE_DIRECTED_3D':
        return ForceDirected3D.compute(rows, {
          edges,
          seed: dataset?.fingerprint ?? 1,
          yOffset: 1.2,
        });
      case 'RADIAL_ORBITAL':
        return RadialTreeLayout.compute(rows, { yOffset: 1.2 });
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
}
