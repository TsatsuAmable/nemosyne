import * as THREE from 'three';
import type { Dataset, DatasetEdge } from '../../data/Dataset.ts';
import { categoricalColor, normalize, numericColor } from '../../data/Encodings.ts';
import type { EncodingMapping } from '../../data/SampleDatasets.ts';
import { GeoSurfaceLayout } from '../layouts/GeoSurfaceLayout.ts';
import type {
  GeoEntry,
  IInstancedPointCloud,
  InstancedPointCloudFactory,
  MonetaSpec,
  VRTranslatorOptions,
} from '../types.ts';
import { TopologyLayoutEmbodiment } from './TopologyLayoutEmbodiment.ts';

function createDefaultPointCloud(
  count: number,
  geometry?: THREE.BufferGeometry
): IInstancedPointCloud {
  const geom = geometry || new THREE.BoxGeometry(0.06, 0.06, 0.06);
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const mesh = new THREE.InstancedMesh(geom, material, count);
  const object = new THREE.Object3D();
  const colors = new Float32Array(count * 3);
  return {
    mesh,
    setPoints(items) {
      items.forEach((item, index) => {
        const position = Array.isArray(item.position)
          ? item.position
          : [item.position.x, item.position.y, item.position.z];
        object.position.set(position[0], position[1], position[2]);
        object.scale.setScalar(item.scale ?? 1);
        object.updateMatrix();
        mesh.setMatrixAt(index, object.matrix);
        const color = new THREE.Color(item.color ?? 0x00ffcc);
        colors[index * 3] = color.r;
        colors[index * 3 + 1] = color.g;
        colors[index * 3 + 2] = color.b;
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    },
  };
}

export class ScalableTopologyEmbodiment {
  constructor(
    private readonly _layouts: TopologyLayoutEmbodiment,
    private readonly _colorblindMode: string | boolean,
    private readonly _pointCloudFactory: InstancedPointCloudFactory | null
  ) {}

  buildInstancedPointCloud(
    group: THREE.Group,
    nodeMeshes: THREE.Mesh[],
    rows: Record<string, unknown>[],
    dataset: Dataset | undefined,
    encodings: EncodingMapping,
    spec: MonetaSpec,
    edges: DatasetEdge[] = [],
    options?: VRTranslatorOptions
  ): void {
    const positions = this._layouts.computeLayoutPositions(rows, dataset, encodings, spec, edges);
    if (positions.length === 0) return;
    const colorField =
      encodings.color || dataset?.categoricalColumns[0]?.name || dataset?.numericColumns[0]?.name;
    const sizeField = encodings.size || dataset?.numericColumns[0]?.name;
    if (!dataset) return;
    const colorColumn = colorField ? dataset.getColumn(colorField) : null;
    const sizeColumn = sizeField ? dataset.getColumn(sizeField) : null;
    const uniqueColors =
      colorField && colorColumn?.type === 'CATEGORICAL'
        ? [...new Set(dataset.getColumnValues(colorField))]
        : [];
    const sizeRange =
      sizeField && sizeColumn?.type === 'NUMERIC' ? dataset.rangeOf(sizeField) : { min: 0, max: 1 };
    const items = positions.map((position, index) => {
      const row = position.row;
      let color = 0x00ffcc;
      let scale = 1;
      if (colorField) {
        const value = row[colorField];
        if (colorColumn?.type === 'CATEGORICAL') {
          color = categoricalColor(value, uniqueColors.indexOf(value), this._colorblindMode);
        } else if (colorColumn?.type === 'NUMERIC') {
          color = numericColor(value as number, sizeRange.min, sizeRange.max, 0x00ffcc, 0xff0055);
        }
      }
      if (sizeField && sizeColumn?.type === 'NUMERIC') {
        scale = 0.6 + 0.8 * normalize(row[sizeField] as number, sizeRange.min, sizeRange.max);
      }
      return {
        position: [position.position.x, position.position.y, position.position.z],
        color,
        scale: Math.max(0.3, scale * 0.5),
        data: { row, index },
      };
    });
    const factory =
      options?.pointCloudFactory || this._pointCloudFactory || createDefaultPointCloud;
    const cloud = factory(items.length, new THREE.BoxGeometry(0.06, 0.06, 0.06));
    cloud.setPoints(items);
    (cloud.mesh as THREE.Mesh).userData = { instancedCloud: cloud };
    group.add(cloud.mesh);
    nodeMeshes.push(cloud.mesh as THREE.Mesh);
  }

  buildClusterVolume(
    group: THREE.Group,
    nodeMeshes: THREE.Mesh[],
    rows: Record<string, unknown>[],
    dataset: Dataset | undefined,
    encodings: EncodingMapping,
    spec: MonetaSpec,
    edges: DatasetEdge[] = []
  ): void {
    const positions = this._layouts.computeLayoutPositions(rows, dataset, encodings, spec, edges);
    if (positions.length === 0) return;
    const colorField =
      encodings.color ||
      dataset?.categoricalColumns[0]?.name ||
      (rows[0] && 'cluster' in rows[0] ? 'cluster' : undefined);
    const clusters = new Map<unknown, THREE.Vector3[]>();
    for (const position of positions) {
      const key = (colorField ? position.row[colorField] : undefined) ?? position.row.cluster ?? 'cluster_0';
      if (!clusters.has(key)) clusters.set(key, []);
      clusters.get(key)!.push(position.position);
    }
    let clusterIndex = 0;
    for (const [key, points] of clusters) {
      if (points.length === 0) continue;
      const center = new THREE.Vector3();
      for (const point of points) center.add(point);
      center.divideScalar(points.length);
      let radius = 0;
      for (const point of points) radius = Math.max(radius, point.distanceTo(center));
      radius = Math.max(0.15, radius * 1.15);
      const color = categoricalColor(key, clusterIndex, this._colorblindMode);
      
      // Translucent volumetric boundary hull
      const hullGeometry = new THREE.SphereGeometry(radius, 24, 24);
      const hullMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.2,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
      });
      const hullMesh = new THREE.Mesh(hullGeometry, hullMaterial);
      hullMesh.position.copy(center);
      hullMesh.userData = {
        cluster: key,
        count: points.length,
        radius,
        representationKind: 'CLUSTER_REGIONS',
      };
      group.add(hullMesh);
      nodeMeshes.push(hullMesh);

      clusterIndex++;
    }
  }

  buildDensityField(
    group: THREE.Group,
    nodeMeshes: THREE.Mesh[],
    rows: Record<string, unknown>[],
    dataset: Dataset | undefined,
    encodings: EncodingMapping,
    spec: MonetaSpec,
    edges: DatasetEdge[] = []
  ): void {
    const positions = this._layouts.computeLayoutPositions(rows, dataset, encodings, spec, edges);
    if (positions.length === 0) return;

    // Find bounding box of positions
    const min = new THREE.Vector3(Infinity, Infinity, Infinity);
    const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    for (const pos of positions) {
      min.min(pos.position);
      max.max(pos.position);
    }
    const size = new THREE.Vector3().subVectors(max, min);
    if (size.x < 0.1) size.x = 1;
    if (size.y < 0.1) size.y = 1;
    if (size.z < 0.1) size.z = 1;

    // Partition space into B x B x B voxels (e.g. 6x6x6 = 216 max bins)
    const BINS = 6;
    const voxelCounts = new Map<string, { count: number; x: number; y: number; z: number }>();
    let maxDensity = 0;

    for (const pos of positions) {
      const bx = Math.min(BINS - 1, Math.max(0, Math.floor(((pos.position.x - min.x) / size.x) * BINS)));
      const by = Math.min(BINS - 1, Math.max(0, Math.floor(((pos.position.y - min.y) / size.y) * BINS)));
      const bz = Math.min(BINS - 1, Math.max(0, Math.floor(((pos.position.z - min.z) / size.z) * BINS)));
      const key = `${bx},${by},${bz}`;
      const current = voxelCounts.get(key) ?? { count: 0, x: bx, y: by, z: bz };
      current.count++;
      voxelCounts.set(key, current);
      if (current.count > maxDensity) maxDensity = current.count;
    }

    const stepX = size.x / BINS;
    const stepY = size.y / BINS;
    const stepZ = size.z / BINS;
    const voxelGeom = new THREE.BoxGeometry(stepX * 0.9, stepY * 0.9, stepZ * 0.9);

    for (const voxel of voxelCounts.values()) {
      const densityFraction = maxDensity > 0 ? voxel.count / maxDensity : 0;
      if (densityFraction <= 0) continue;

      const posX = min.x + (voxel.x + 0.5) * stepX;
      const posY = min.y + (voxel.y + 0.5) * stepY;
      const posZ = min.z + (voxel.z + 0.5) * stepZ;

      const color = numericColor(densityFraction, 0, 1, 0x0088ff, 0xff0055);
      const material = new THREE.MeshStandardMaterial({
        color,
        transparent: true,
        opacity: Math.min(0.85, 0.15 + densityFraction * 0.7),
        roughness: 0.4,
        metalness: 0.2,
      });
      const mesh = new THREE.Mesh(voxelGeom, material);
      mesh.position.set(posX, posY, posZ);
      mesh.userData = {
        density: voxel.count,
        densityFraction,
        voxelCoord: [voxel.x, voxel.y, voxel.z],
        representationKind: 'DENSITY_FIELD',
      };
      group.add(mesh);
      nodeMeshes.push(mesh);
    }
  }

  buildAggregateBars(
    group: THREE.Group,
    nodeMeshes: THREE.Mesh[],
    rows: Record<string, unknown>[],
    dataset: Dataset | undefined,
    encodings: EncodingMapping,
    spec: MonetaSpec,
    _edges: DatasetEdge[] = [],
    _options?: VRTranslatorOptions
  ): void {
    const categoryField = encodings.color || dataset?.categoricalColumns[0]?.name;
    const valueField = encodings.size || dataset?.numericColumns[0]?.name;
    
    // Group rows by categorical key or binning
    const groups = new Map<unknown, Record<string, unknown>[]>();
    for (const row of rows) {
      const key = (categoryField ? row[categoryField] : undefined) ?? 'group_0';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }
    const groupKeys = [...groups.keys()];

    if (spec.layout === 'GEO_SURFACE') {
      const geoPositions = GeoSurfaceLayout.compute(rows, {
        valueKey: valueField,
        yOffset: 0.5,
      }) as GeoEntry<Record<string, unknown>>[];
      const byRow = new Map<Record<string, unknown>, GeoEntry<Record<string, unknown>>>();
      for (const position of geoPositions) byRow.set(position.row, position);

      for (const [key, groupRows] of groups) {
        const center = new THREE.Vector3();
        let valueSum = 0;
        let count = 0;
        for (const row of groupRows) {
          const position = byRow.get(row);
          if (!position) continue;
          center.add(position.position);
          valueSum += Number(position.value) || (valueField ? Number(row[valueField]) : 0) || 0;
          count++;
        }
        if (count === 0) continue;
        center.divideScalar(count);
        const averageValue = valueSum / count;
        const color = categoricalColor(key, groupKeys.indexOf(key), this._colorblindMode);
        const height = Math.max(0.2, averageValue * 0.05);
        const geometry = new THREE.CylinderGeometry(0.12, 0.12, height, 16);
        geometry.translate(0, height / 2, 0);
        const material = new THREE.MeshStandardMaterial({
          color,
          wireframe: true,
          emissive: color,
          emissiveIntensity: 0.3,
          roughness: 0.3,
          metalness: 0.7,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(center);
        mesh.userData = {
          category: key,
          aggregateValue: averageValue,
          count,
          representationKind: 'AGGREGATE_VOLUME',
        };
        group.add(mesh);
        nodeMeshes.push(mesh);
      }
    } else {
      // First-class 3D grid aggregate pillars (bounded by number of groups, NO point fallback)
      const numGroups = groupKeys.length;
      const cols = Math.ceil(Math.sqrt(numGroups));
      const spacing = 1.2;
      const startX = -((cols - 1) * spacing) / 2;
      const startZ = -((Math.ceil(numGroups / cols) - 1) * spacing) / 2;

      let idx = 0;
      for (const [key, groupRows] of groups) {
        let valueSum = 0;
        for (const row of groupRows) {
          valueSum += (valueField ? Number(row[valueField]) : 0) || 1;
        }
        const count = groupRows.length;
        const averageValue = count > 0 ? valueSum / count : 0;
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const posX = startX + col * spacing;
        const posZ = startZ + row * spacing;

        const color = categoricalColor(key, idx, this._colorblindMode);
        const height = Math.max(0.3, Math.min(3.5, averageValue * 0.1 + 0.3));
        const geometry = new THREE.BoxGeometry(0.5, height, 0.5);
        geometry.translate(0, height / 2, 0);

        const material = new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.2,
          roughness: 0.3,
          metalness: 0.5,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(posX, 0, posZ);
        mesh.userData = {
          category: key,
          aggregateValue: averageValue,
          count,
          representationKind: 'AGGREGATE_VOLUME',
        };
        group.add(mesh);
        nodeMeshes.push(mesh);
        idx++;
      }
    }
  }
}
