import * as THREE from 'three';
import type { Dataset, DatasetEdge } from '../../data/Dataset.ts';
import { categoricalColor, normalize, numericColor } from '../../data/Encodings.ts';
import type { EncodingMapping } from '../../data/SampleDatasets.ts';
import type {
  IInstancedPointCloud,
  InstancedPointCloudFactory,
  MonetaSpec,
  VRTranslatorOptions,
} from '../types.ts';
import type { SemanticEmbodimentEnvelopeV1 } from '../representation/SemanticEmbodimentPayload.ts';
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

function distributionPosition(value: number, min: number, max: number): number {
  if (min === max) return 0.5;
  const scale = Math.max(Math.abs(min), Math.abs(max), 1);
  const scaledMin = min / scale;
  return Math.max(0, Math.min(1, (value / scale - scaledMin) / (max / scale - scaledMin)));
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
      const key =
        (colorField ? position.row[colorField] : undefined) ?? position.row.cluster ?? 'cluster_0';
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
    const BINS = 6;
    const voxelCounts = new Map<string, { count: number; x: number; y: number; z: number }>();
    let maxDensity = 0;
    for (const pos of positions) {
      const bx = Math.min(
        BINS - 1,
        Math.max(0, Math.floor(((pos.position.x - min.x) / size.x) * BINS))
      );
      const by = Math.min(
        BINS - 1,
        Math.max(0, Math.floor(((pos.position.y - min.y) / size.y) * BINS))
      );
      const bz = Math.min(
        BINS - 1,
        Math.max(0, Math.floor(((pos.position.z - min.z) / size.z) * BINS))
      );
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

  /**
   * A4 thin presentation adapter. Rust has already grouped the dataset and
   * computed every aggregate value. This method is allowed to map the bounded
   * semantic elements to positions, colours and visual heights only.
   */
  buildAggregateBars(
    group: THREE.Group,
    nodeMeshes: THREE.Mesh[],
    envelope: SemanticEmbodimentEnvelopeV1 | null | undefined
  ): void {
    if (!envelope) {
      group.userData.semanticEmbodimentStatus = 'PENDING';
      return;
    }
    if (envelope.result.status === 'REFUSED') {
      group.userData.semanticEmbodimentStatus = 'REFUSED';
      group.userData.semanticEmbodimentRefusal = envelope.result.refusal;
      return;
    }
    if (
      envelope.candidateId !== 'AGGREGATE_VOLUME' ||
      envelope.representationFamily !== 'AGGREGATE' ||
      envelope.result.payload.kind !== 'AGGREGATE_VOLUME'
    ) {
      group.userData.semanticEmbodimentStatus = 'INVALID';
      return;
    }

    const groups = envelope.result.payload.data.groups;
    if (groups.length === 0) {
      group.userData.semanticEmbodimentStatus = 'READY';
      return;
    }
    const finiteValues = groups
      .map((entry) => entry.aggregateValue)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    const minValue = finiteValues.length > 0 ? Math.min(...finiteValues) : 0;
    const maxValue = finiteValues.length > 0 ? Math.max(...finiteValues) : 1;
    const cols = Math.ceil(Math.sqrt(groups.length));
    const spacing = 1.2;
    const startX = -((cols - 1) * spacing) / 2;
    const startZ = -((Math.ceil(groups.length / cols) - 1) * spacing) / 2;

    groups.forEach((entry, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const posX = startX + col * spacing;
      const posZ = startZ + row * spacing;
      const color = categoricalColor(entry.key, index, this._colorblindMode);
      const fraction =
        typeof entry.aggregateValue === 'number' && Number.isFinite(entry.aggregateValue)
          ? normalize(entry.aggregateValue, minValue, maxValue)
          : 0;
      const height = 0.3 + 3.2 * fraction;
      const geometry = new THREE.BoxGeometry(0.5, height, 0.5);
      geometry.translate(0, height / 2, 0);
      const material = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.2,
        roughness: 0.3,
        metalness: 0.5,
        transparent: entry.aggregateValue === undefined,
        opacity: entry.aggregateValue === undefined ? 0.35 : 1,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(posX, 0, posZ);
      mesh.userData = {
        semanticId: entry.semanticId,
        category: entry.key,
        aggregateValue: entry.aggregateValue ?? null,
        count: entry.count,
        representationKind: 'AGGREGATE_VOLUME',
        analyticalMethod: envelope.analyticalMethod,
        approximation: envelope.approximation,
        informationContract: envelope.informationContract,
        provenance: envelope.provenance,
      };
      group.add(mesh);
      nodeMeshes.push(mesh);
    });
    group.userData.semanticEmbodimentStatus = 'READY';
    group.userData.semanticEmbodiment = {
      candidateId: envelope.candidateId,
      resource: envelope.resource,
      provenance: envelope.provenance,
    };
  }

  /**
   * M3 thin empirical-distribution adapter. Rust owns bins, counts, ECDF knots,
   * quantiles and provenance; this method only maps bounded semantic elements
   * to visual positions and carries their stable identities into the artifact.
   */
  buildDistributionField(
    group: THREE.Group,
    nodeMeshes: THREE.Mesh[],
    envelope: SemanticEmbodimentEnvelopeV1 | null | undefined
  ): void {
    if (!envelope) {
      group.userData.semanticEmbodimentStatus = 'PENDING';
      return;
    }
    if (envelope.result.status === 'REFUSED') {
      group.userData.semanticEmbodimentStatus = 'REFUSED';
      group.userData.semanticEmbodimentRefusal = envelope.result.refusal;
      return;
    }
    if (
      envelope.candidateId !== 'DISTRIBUTION_FIELD' ||
      envelope.representationFamily !== 'DISTRIBUTION' ||
      envelope.result.payload.kind !== 'EMPIRICAL_DISTRIBUTION'
    ) {
      group.userData.semanticEmbodimentStatus = 'INVALID';
      return;
    }

    const distribution = envelope.result.payload.data;
    const { min, max } = distribution.domain;
    const artifactId = [
      'semantic-embodiment',
      envelope.datasetFingerprint,
      envelope.candidateId,
      envelope.provenance.algorithmVersion,
      envelope.provenance.decisionId ?? 'unbound-decision',
    ].join(':');
    const commonMetadata = {
      representationKind: 'DISTRIBUTION_FIELD',
      payloadKind: 'EMPIRICAL_DISTRIBUTION',
      artifactId,
      datasetFingerprint: envelope.datasetFingerprint,
      measureField: distribution.measureField,
      analyticalMethod: envelope.analyticalMethod,
      approximation: envelope.approximation,
      informationContract: envelope.informationContract,
      provenance: envelope.provenance,
    };

    const bins = distribution.histogram;
    const maxBinCount = Math.max(1, ...bins.map((bin) => bin.count));
    const binStep = 4 / bins.length;
    bins.forEach((bin, index) => {
      const height = 0.15 + 2.35 * (bin.count / maxBinCount);
      const geometry = new THREE.BoxGeometry(Math.max(0.02, binStep * 0.82), height, 0.32);
      geometry.translate(0, height / 2, 0);
      const material = new THREE.MeshStandardMaterial({
        color: numericColor(bin.count, 0, maxBinCount, 0x0072b2, 0xe69f00),
        emissive: 0x003344,
        emissiveIntensity: 0.3,
        roughness: 0.35,
        metalness: 0.2,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = bin.semanticId;
      mesh.position.set(-2 + (index + 0.5) * binStep, 0, 0);
      mesh.userData = {
        ...commonMetadata,
        semanticId: bin.semanticId,
        distributionElementKind: 'HISTOGRAM_BIN',
        lowerBound: bin.lowerBound,
        upperBound: bin.upperBound,
        upperInclusive: bin.upperInclusive,
        count: bin.count,
      };
      group.add(mesh);
      nodeMeshes.push(mesh);
    });

    distribution.ecdf.forEach((knot) => {
      const geometry = new THREE.SphereGeometry(0.055, 8, 8);
      const material = new THREE.MeshStandardMaterial({
        color: 0x00ffcc,
        emissive: 0x005544,
        emissiveIntensity: 0.3,
        roughness: 0.25,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = knot.semanticId;
      mesh.position.set(
        -2 + 4 * distributionPosition(knot.value, min, max),
        2.5 * knot.cumulativeProbability,
        0.42
      );
      mesh.userData = {
        ...commonMetadata,
        semanticId: knot.semanticId,
        distributionElementKind: 'ECDF_KNOT',
        value: knot.value,
        cumulativeCount: knot.cumulativeCount,
        cumulativeProbability: knot.cumulativeProbability,
      };
      group.add(mesh);
      nodeMeshes.push(mesh);
    });

    distribution.quantiles.forEach((quantile) => {
      const geometry = new THREE.CylinderGeometry(0.035, 0.035, 0.5, 8);
      const color = numericColor(quantile.probability, 0, 1, 0x56b4e9, 0xd55e00);
      const material = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.3,
        roughness: 0.3,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = quantile.semanticId;
      mesh.position.set(-2 + 4 * distributionPosition(quantile.value, min, max), 0.25, -0.42);
      mesh.userData = {
        ...commonMetadata,
        semanticId: quantile.semanticId,
        distributionElementKind: 'QUANTILE',
        probability: quantile.probability,
        value: quantile.value,
      };
      group.add(mesh);
      nodeMeshes.push(mesh);
    });

    group.userData.semanticEmbodimentStatus = 'READY';
    group.userData.semanticEmbodiment = {
      artifactId,
      datasetFingerprint: envelope.datasetFingerprint,
      candidateId: envelope.candidateId,
      payloadKind: envelope.result.payload.kind,
      resource: envelope.resource,
      provenance: envelope.provenance,
    };
  }
}
