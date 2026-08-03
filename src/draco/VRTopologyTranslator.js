import * as THREE from 'three';
import { SeededRandom } from '../utils/SeededRandom.js';
import { categoricalColor, numericColor, normalize, inferEncodings } from '../data/Encodings.js';
import { InstancedPointCloud, SpatialIndex, LODManager } from '../vr/scalability/index.js';
import {
  applyResonancePulse,
  applyForkPlane,
  applyChronoDial,
  applyConstellation,
  applyBeacon,
  applyAleph,
} from '../vr/interactions/MetaphorActions.js';
import {
  GridLayout3D,
  ForceDirected3D,
  RadialTreeLayout,
  TimeSeriesRibbonLayout,
  StreamlineLayout,
  GeoSurfaceLayout,
} from './layouts/index.js';
import { ChartPlane } from '../vr/artifacts/ChartPlane.js';

/**
 * Translates a Draco-style spec into a functional Three.js artifact,
 * binding real dataset values to visual channels where possible.
 */
export class VRTopologyTranslator {
  static synthesizeArtifact(dracoResult, dataInput) {
    const { spec, facts } = dracoResult;
    const dataset = dataInput.dataset;
    const encodings = dataInput.encodings || inferEncodings(dataset);
    const rng = new SeededRandom(dataset?.fingerprint ?? 1);
    const group = new THREE.Group();
    const nodeMeshes = [];
    const edgeMeshes = [];
    const behaviors = [];

    const rows = dataset?.rows ?? dataInput.rows ?? [];
    const edges = dataInput.edges ?? dataset?.edges ?? [];

    // Phase 7 scalable geometry paths.
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
      }
    }

    if (spec.layout === 'FORCE_DIRECTED_3D' && edges.length > 0) {
      this._buildEdges(group, edgeMeshes, nodeMeshes, edges);
    }

    // Hierarchy edges: connect radial-tree parents to children.
    if (spec.layout === 'RADIAL_ORBITAL') {
      this._buildParentEdges(group, edgeMeshes, nodeMeshes);
    }

    switch (spec.behavior) {
      case 'PULSE_QUANTITATIVE':
        behaviors.push((delta, time) => {
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
        behaviors.push((delta, time) => {
          nodeMeshes.forEach((m, idx) => {
            m.position.y += Math.sin(time * 2.0 + idx * 0.4) * 0.003;
          });
        });
        break;
    }

    const artifact = {
      group,
      nodeMeshes,
      edgeMeshes,
      interactions: this._makeInteractions(
        spec.interaction,
        group,
        nodeMeshes,
        edgeMeshes,
        rows,
        edges
      ),
      update: (delta, time) => {
        behaviors.forEach((b) => b(delta, time));
      },
      spec,
    };

    // Attach a companion ChartPlane for rich numeric or temporal datasets.
    if (facts.numericColumns > 1 || facts.hasTimeSeries) {
      const chart = ChartPlane.fromFacts(facts, dataset, {
        title: facts.hasTimeSeries ? 'Time Series' : 'Correlation',
      });
      chart.setDataset(dataset);
      chart.mesh.position.set(2.4, 1.6, -3.5);
      chart.mesh.lookAt(0, 1.6, -3.5);
      group.add(chart.mesh);
      artifact.chartPlane = chart;
    }

    return artifact;
  }

  static _makeNode(row, dataset, encodings, geometry = 'ICOSA_NODE') {
    let color = 0x00ffcc;
    let scale = 1;

    if (encodings.color && dataset) {
      const col = dataset.getColumn(encodings.color);
      const value = row[encodings.color];
      if (col?.type === 'CATEGORICAL') {
        const idx = dataset.categoricalColumns.find((c) => c.name === encodings.color);
        const unique = [...new Set(dataset.getColumnValues(encodings.color))];
        color = categoricalColor(value, unique.indexOf(value));
      } else if (col?.type === 'NUMERIC') {
        const range = dataset.rangeOf(encodings.color);
        color = numericColor(value, range.min, range.max, 0x00ffcc, 0xff0055);
      }
    }

    if (encodings.size && dataset) {
      const col = dataset.getColumn(encodings.size);
      if (col?.type === 'NUMERIC') {
        const range = dataset.rangeOf(encodings.size);
        scale = 0.6 + 0.8 * normalize(row[encodings.size], range.min, range.max);
      }
    }

    let geom;
    switch (geometry) {
      case 'CUBE_MATRIX':
        geom = new THREE.BoxGeometry(0.45, 0.45, 0.45);
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
      case 'ORB':
        geom = new THREE.SphereGeometry(0.28, 24, 24);
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
      case 'ICOSA_NODE':
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
    mesh.userData = { row };
    mesh.scale.setScalar(scale);
    return mesh;
  }

  static _buildGrid(group, nodeMeshes, rows, dataset, encodings, rng) {
    const sortKey = dataset?.numericColumns[0]?.name;
    const positions = GridLayout3D.compute(rows, { sortKey, yOffset: 1.2 });
    for (const p of positions) {
      const mesh = this._makeNode(p.row, dataset, encodings, 'CUBE_MATRIX');
      mesh.position.copy(p.position);
      group.add(mesh);
      nodeMeshes.push(mesh);
    }
  }

  static _buildForceDirected(group, nodeMeshes, rows, dataset, encodings, rng, edges = []) {
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

  static _buildRadial(group, nodeMeshes, rows, dataset, encodings, depth) {
    const positions = RadialTreeLayout.compute(rows, { yOffset: 1.2 });
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

  static _buildStreamlines(group, nodeMeshes, rows, dataset, encodings, rng) {
    const positions = StreamlineLayout.compute(rows, {
      count: Math.min(30, Math.max(8, rows.length)),
      seed: dataset?.fingerprint ?? 1,
    });
    for (const p of positions) {
      const curve = new THREE.CatmullRomCurve3(p.points);
      const geom = new THREE.TubeGeometry(curve, 20, 0.04, 8, false);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        wireframe: true,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.userData = { row: p.row };
      mesh.position.copy(p.position);
      group.add(mesh);
      nodeMeshes.push(mesh);
    }
  }

  static _buildTimeRibbon(group, nodeMeshes, rows, dataset, encodings) {
    if (!rows.length) return;
    const timeField = encodings.time || dataset?.temporalColumns[0]?.name || 'time';
    const valueField = encodings.size || dataset?.numericColumns[0]?.name || 'temperature';
    const positions = TimeSeriesRibbonLayout.compute(rows, {
      timeKey: timeField,
      valueKey: valueField,
      yOffset: 1.2,
    });

    // Group positions by seriesId so each series becomes one ribbon tube.
    const bySeries = {};
    for (const p of positions) {
      if (!bySeries[p.seriesId]) bySeries[p.seriesId] = [];
      bySeries[p.seriesId].push(p);
    }

    Object.entries(bySeries).forEach(([id, pts], sIdx) => {
      const sorted = pts.slice().sort((a, b) => a.pointIndex - b.pointIndex);
      const points = sorted.map((p) => p.position.clone());
      if (points.length < 2) return;
      const curve = new THREE.CatmullRomCurve3(points);
      const geom = new THREE.TubeGeometry(curve, points.length * 3, 0.06, 8, false);
      const color = categoricalColor(id, sIdx);
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

  static _buildEdges(group, edgeMeshes, nodeMeshes, edges) {
    const mat = new THREE.LineBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.35 });
    for (const e of edges) {
      const src = nodeMeshes.find(
        (m) => m.userData.row?.id === e.source || m.userData.row?.name === e.source
      );
      const dst = nodeMeshes.find(
        (m) => m.userData.row?.id === e.target || m.userData.row?.name === e.target
      );
      if (!src || !dst) continue;
      const geo = new THREE.BufferGeometry().setFromPoints([
        src.position.clone(),
        dst.position.clone(),
      ]);
      const line = new THREE.Line(geo, mat);
      group.add(line);
      edgeMeshes.push(line);
    }
  }

  static _buildParentEdges(group, edgeMeshes, nodeMeshes) {
    const mat = new THREE.LineBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.35 });
    for (const mesh of nodeMeshes) {
      const parentIdx = mesh.userData.row?._parentIndex ?? mesh.userData.row?.parentIndex;
      if (parentIdx == null) continue;
      const parent = nodeMeshes[parentIdx];
      if (!parent) continue;
      const geo = new THREE.BufferGeometry().setFromPoints([
        parent.position.clone(),
        mesh.position.clone(),
      ]);
      const line = new THREE.Line(geo, mat);
      group.add(line);
      edgeMeshes.push(line);
    }
  }

  static _buildGeoSurface(group, nodeMeshes, rows, dataset, encodings, rng) {
    const valueField = encodings.size || dataset?.numericColumns[0]?.name;
    const positions = GeoSurfaceLayout.compute(rows, {
      valueKey: valueField,
      yOffset: 0.5,
    });

    for (const p of positions) {
      const mesh = this._makeNode(p.row, dataset, encodings, 'GEO_COLUMN');
      mesh.position.copy(p.position);
      // Scale the column so its height matches the value; keep radius fixed.
      mesh.scale.y = Math.max(0.1, p.value * 0.05);
      group.add(mesh);
      nodeMeshes.push(mesh);
    }
  }

  /**
   * Compute world-space positions for the supported scalable layouts.
   * Returns an array of { row, position } objects.
   */
  static _computeLayoutPositions(rows, dataset, encodings, spec, rng, edges = [], depth = 1) {
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
    group,
    nodeMeshes,
    rows,
    dataset,
    encodings,
    spec,
    rng,
    edges = [],
    depth = 1
  ) {
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
    const colorCol = colorField ? dataset?.getColumn(colorField) : null;
    const sizeCol = sizeField ? dataset?.getColumn(sizeField) : null;
    const uniqueColors =
      colorCol?.type === 'CATEGORICAL' ? [...new Set(dataset.getColumnValues(colorField))] : [];
    const sizeRange = sizeCol?.type === 'NUMERIC' ? dataset.rangeOf(sizeField) : { min: 0, max: 1 };

    const items = positions.map((p, idx) => {
      const row = p.row;
      let color = 0x00ffcc;
      let scale = 1;

      if (colorField && dataset) {
        const value = row[colorField];
        if (colorCol?.type === 'CATEGORICAL') {
          color = categoricalColor(value, uniqueColors.indexOf(value));
        } else if (colorCol?.type === 'NUMERIC') {
          color = numericColor(value, sizeRange.min, sizeRange.max, 0x00ffcc, 0xff0055);
        }
      }

      if (sizeField && dataset && sizeCol?.type === 'NUMERIC') {
        scale = 0.6 + 0.8 * normalize(row[sizeField], sizeRange.min, sizeRange.max);
      }

      return {
        position: [p.position.x, p.position.y, p.position.z],
        color,
        scale: Math.max(0.3, scale * 0.5),
        data: { row, index: idx },
      };
    });

    const cloud = new InstancedPointCloud(items.length, new THREE.BoxGeometry(0.06, 0.06, 0.06));
    cloud.setPoints(items);
    cloud.mesh.userData = { instancedCloud: cloud };
    group.add(cloud.mesh);
    nodeMeshes.push(cloud.mesh);
  }

  static _buildClusterVolume(
    group,
    nodeMeshes,
    rows,
    dataset,
    encodings,
    spec,
    rng,
    edges = [],
    depth = 1
  ) {
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

    const clusters = new Map();
    for (const p of positions) {
      const key = p.row[colorField] ?? 'unknown';
      if (!clusters.has(key)) clusters.set(key, []);
      clusters.get(key).push(p.position);
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

      const color = categoricalColor(key, clusterIdx);
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
    group,
    nodeMeshes,
    rows,
    dataset,
    encodings,
    spec,
    rng,
    edges = [],
    depth = 1
  ) {
    if (spec.layout === 'GEO_SURFACE') {
      const catField = encodings.color || dataset?.categoricalColumns[0]?.name;
      const valueField = encodings.size || dataset?.numericColumns[0]?.name;
      if (!catField || !dataset) return;

      const groups = new Map();
      for (const row of rows) {
        const key = row[catField] ?? 'unknown';
        if (!groups.has(key)) groups.set(key, { rows: [], positions: [], values: [] });
        const g = groups.get(key);
        g.rows.push(row);
      }

      // Compute per-group geo positions and aggregate values.
      const geoPositions = GeoSurfaceLayout.compute(rows, { valueKey: valueField, yOffset: 0.5 });
      const byRow = new Map();
      for (const p of geoPositions) byRow.set(p.row, p);

      for (const [key, g] of groups) {
        const center = new THREE.Vector3();
        let valueSum = 0;
        let count = 0;
        for (const row of g.rows) {
          const p = byRow.get(row);
          if (!p) continue;
          center.add(p.position);
          valueSum += Number(p.value) || Number(row[valueField]) || 0;
          count++;
        }
        if (count === 0) continue;
        center.divideScalar(count);
        const avgValue = valueSum / count;

        const color = categoricalColor(key, [...groups.keys()].indexOf(key));
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

    // Fallback for unsupported layouts: render as instanced point cloud.
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

  /**
   * Incrementally append new rows to an existing artifact when possible.
   * Currently optimized for TIME_RIBBON: rebuilds only the affected series
   * ribbons instead of the whole palace. For other layouts it falls back to
   * a full re-solve signal (returns false).
   * @returns {boolean} true if incremental update succeeded
   */
  static appendRowsToArtifact(artifact, newRows, dataInput) {
    if (!artifact || !newRows?.length) return false;
    if (artifact.spec?.layout !== 'TIME_RIBBON') return false;

    const dataset = dataInput.dataset;
    const encodings = dataInput.encodings || inferEncodings(dataset);
    const timeField = encodings.time || dataset?.temporalColumns[0]?.name || 'time';
    const valueField = encodings.size || dataset?.numericColumns[0]?.name || 'temperature';

    const group = artifact.group;
    const bySeries = {};
    for (const row of newRows) {
      const id = row.sensorId || 'S';
      if (!bySeries[id]) bySeries[id] = [];
      bySeries[id].push(row);
    }

    for (const [id, sRows] of Object.entries(bySeries)) {
      const existingMesh = artifact.nodeMeshes.find((m) => m.userData.row?.series === id);
      if (!existingMesh) continue;

      const existingPoints = existingMesh.geometry.parameters?.path?.points || [];
      const startIdx = existingPoints.length;
      const newPoints = sRows
        .slice()
        .sort((a, b) => new Date(a[timeField]) - new Date(b[timeField]))
        .map((r, idx) => {
          const value = Number(r[valueField]) || 0;
          return new THREE.Vector3(
            (startIdx + idx) * 0.8 - 2,
            value * 0.2,
            (existingMesh.userData.seriesIndex || 0) * 1.5 - 2
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

  static _makeInteractions(interactionType, group, nodeMeshes, edgeMeshes, rows, edges) {
    const base = {
      onHover: (mesh) => {
        if (mesh.material?.emissiveIntensity !== undefined) {
          mesh.material.emissiveIntensity = 2.0;
        } else if (mesh.userData?.instancedCloud) {
          mesh.material.opacity = Math.min(1, mesh.material.opacity + 0.25);
        } else if (mesh.material) {
          mesh.userData._originalOpacity = mesh.material.opacity;
          mesh.material.opacity = Math.min(1, mesh.material.opacity + 0.4);
        }
      },
      onUnhover: (mesh) => {
        if (mesh.material?.emissiveIntensity !== undefined) {
          mesh.material.emissiveIntensity = 0.3;
        } else if (mesh.userData?._originalOpacity !== undefined && mesh.material) {
          mesh.material.opacity = mesh.userData._originalOpacity;
        }
      },
      onSelect: (mesh) => {
        if (mesh.material?.emissiveIntensity !== undefined) {
          mesh.material.emissiveIntensity = 3.0;
        } else if (mesh.material) {
          mesh.userData._originalOpacity = mesh.material.opacity;
          mesh.material.opacity = Math.min(1, mesh.material.opacity + 0.6);
        }
      },
    };

    const meshList = nodeMeshes.filter((m) => !(m instanceof THREE.InstancedMesh));
    const others = (target) => meshList.filter((m) => m !== target);

    switch (interactionType) {
      case 'RESONANCE_PULSE':
        return {
          ...base,
          type: interactionType,
          onSelect: (mesh) => {
            base.onSelect(mesh);
            // Pulse to connected edge partners if available.
            const partners = [];
            if (edges?.length && mesh.userData.row) {
              const row = mesh.userData.row;
              const id = row.id ?? row.name;
              for (const e of edges) {
                if (e.source === id)
                  partners.push(
                    meshList.find((m) => (m.userData.row?.id ?? m.userData.row?.name) === e.target)
                  );
                if (e.target === id)
                  partners.push(
                    meshList.find((m) => (m.userData.row?.id ?? m.userData.row?.name) === e.source)
                  );
              }
            }
            applyResonancePulse(group, mesh, partners.filter(Boolean));
          },
        };
      case 'FORK_PLANE':
        return {
          ...base,
          type: interactionType,
          onSelect: (mesh) => {
            base.onSelect(mesh);
            applyForkPlane(group, mesh);
          },
        };
      case 'CHRONO_DIAL':
        return {
          ...base,
          type: interactionType,
          onSelect: (mesh) => {
            base.onSelect(mesh);
            applyChronoDial(group, mesh);
          },
        };
      case 'CONSTELLATION':
        return {
          ...base,
          type: interactionType,
          onSelect: (mesh) => {
            base.onSelect(mesh);
            applyConstellation(group, mesh, others(mesh).slice(0, 8));
          },
        };
      case 'BEACON':
        return {
          ...base,
          type: interactionType,
          onSelect: (mesh) => {
            base.onSelect(mesh);
            applyBeacon(group, mesh);
          },
        };
      case 'ALEPH':
        return {
          ...base,
          type: interactionType,
          onSelect: (mesh) => {
            base.onSelect(mesh);
            applyAleph(group, mesh, others(mesh));
          },
        };
      default:
        return { ...base, type: interactionType };
    }
  }
}
