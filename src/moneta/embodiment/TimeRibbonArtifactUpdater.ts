import * as THREE from 'three';
import type { Artifact, MonetaDataInput } from '../types.ts';

export class TimeRibbonArtifactUpdater {
  append(
    artifact: Artifact | undefined,
    newRows: Record<string, unknown>[],
    dataInput: MonetaDataInput
  ): boolean {
    if (!artifact || !newRows.length || artifact.spec?.layout !== 'TIME_RIBBON') return false;
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
    for (const [id, seriesRows] of Object.entries(bySeries)) {
      const existingMesh = artifact.nodeMeshes.find(
        (mesh) => (mesh.userData.row as Record<string, unknown> | undefined)?.series === id
      );
      if (!existingMesh) continue;
      const existingPoints =
        (
          (existingMesh.geometry as THREE.TubeGeometry).parameters?.path as
            { points?: THREE.Vector3[] } | undefined
        )?.points ?? [];
      const startIndex = existingPoints.length;
      const newPoints = seriesRows
        .slice()
        .sort(
          (a, b) =>
            new Date(a[timeField] as string | number | Date).getTime() -
            new Date(b[timeField] as string | number | Date).getTime()
        )
        .map((row, index) => {
          const value = Number(row[valueField]) || 0;
          return new THREE.Vector3(
            (startIndex + index) * 0.8 - 2,
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
