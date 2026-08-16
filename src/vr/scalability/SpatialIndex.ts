import * as THREE from 'three';
import type { SpatialEntry, SpatialIndexLike, SpatialQueryResult } from '../coordinators/types.ts';

/**
 * Simple uniform-grid spatial index for fast proximity and raycast queries.
 *
 * VR data palaces can contain thousands of points. A full CPU raycast against
 * every `Mesh` becomes slow, so this index partitions space into cells and only
 * tests objects in cells touched by a ray or near a point.
 *
 * The grid is rebuilt when the artefact changes. For incremental live updates,
 * items can be re-inserted.
 */
export class SpatialIndex implements SpatialIndexLike {
  cellSize: number;
  private cells: Map<string, SpatialEntry[]>;
  private _tempVec: THREE.Vector3;

  constructor(cellSize = 0.5) {
    this.cellSize = cellSize;
    this.cells = new Map();
    this._tempVec = new THREE.Vector3();
  }

  clear(): void {
    this.cells.clear();
  }

  /**
   * Insert a point with associated user data.
   */
  insert(position: THREE.Vector3, data: unknown): void {
    const key = this._keyFor(position);
    const list = this.cells.get(key);
    if (list) {
      list.push({ position, data });
    } else {
      this.cells.set(key, [{ position, data }]);
    }
  }

  /**
   * Insert many points at once.
   */
  insertAll(items: SpatialEntry[]): void {
    for (const item of items) {
      this.insert(item.position, item.data);
    }
  }

  /**
   * Find all items within radius of a point.
   */
  queryRadius(center: THREE.Vector3, radius: number): SpatialQueryResult[] {
    const results: SpatialQueryResult[] = [];
    const r2 = radius * radius;
    const cellRange = Math.ceil(radius / this.cellSize);

    const cx = this._cellCoord(center.x);
    const cy = this._cellCoord(center.y);
    const cz = this._cellCoord(center.z);

    for (let x = cx - cellRange; x <= cx + cellRange; x++) {
      for (let y = cy - cellRange; y <= cy + cellRange; y++) {
        for (let z = cz - cellRange; z <= cz + cellRange; z++) {
          const key = `${x},${y},${z}`;
          const list = this.cells.get(key);
          if (!list) continue;
          for (const item of list) {
            const d2 = center.distanceToSquared(item.position);
            if (d2 <= r2) {
              results.push({ ...item, distance: Math.sqrt(d2) });
            }
          }
        }
      }
    }

    return results.sort((a, b) => a.distance - b.distance);
  }

  /**
   * Raycast against the index, returning the nearest hit within maxDistance.
   * Uses a 3D DDA traversal of grid cells.
   */
  raycast(ray: THREE.Ray, maxDistance = 10, hitRadius = 0.05): SpatialQueryResult | null {
    // Step through cells along the ray and test points inside them.
    const origin = ray.origin;
    const dir = ray.direction.clone().normalize();
    const cell = this.cellSize;

    // Current cell coordinates.
    let cx = this._cellCoord(origin.x);
    let cy = this._cellCoord(origin.y);
    let cz = this._cellCoord(origin.z);

    const stepX = dir.x >= 0 ? 1 : -1;
    const stepY = dir.y >= 0 ? 1 : -1;
    const stepZ = dir.z >= 0 ? 1 : -1;

    const tDeltaX = Math.abs(cell / dir.x) || Infinity;
    const tDeltaY = Math.abs(cell / dir.y) || Infinity;
    const tDeltaZ = Math.abs(cell / dir.z) || Infinity;

    let tMaxX = this._firstBoundaryT(origin.x, dir.x, cell);
    let tMaxY = this._firstBoundaryT(origin.y, dir.y, cell);
    let tMaxZ = this._firstBoundaryT(origin.z, dir.z, cell);

    const endCellX = this._cellCoord(origin.x + dir.x * maxDistance);
    const endCellY = this._cellCoord(origin.y + dir.y * maxDistance);
    const endCellZ = this._cellCoord(origin.z + dir.z * maxDistance);

    let best: SpatialQueryResult | null = null;
    let bestDist = maxDistance;

    const testCell = () => {
      const key = `${cx},${cy},${cz}`;
      const list = this.cells.get(key);
      if (!list) return;
      for (const item of list) {
        // Distance from ray to point.
        const toPoint = this._tempVec.subVectors(item.position, origin);
        const t = toPoint.dot(dir);
        if (t < 0 || t > bestDist) continue;
        const closest = new THREE.Vector3().copy(origin).add(dir.clone().multiplyScalar(t));
        const perp = item.position.distanceTo(closest);
        if (perp <= hitRadius) {
          const dist = origin.distanceTo(item.position);
          if (dist < bestDist) {
            bestDist = dist;
            best = { position: item.position, data: item.data, distance: dist };
          }
        }
      }
    };

    // Guard against infinite loops.
    const maxSteps = 1000;
    let steps = 0;

    while (steps < maxSteps) {
      testCell();
      if (best && bestDist < this.cellSize) break;

      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        cx += stepX;
        if ((stepX > 0 && cx > endCellX) || (stepX < 0 && cx < endCellX)) break;
        tMaxX += tDeltaX;
      } else if (tMaxY < tMaxZ) {
        cy += stepY;
        if ((stepY > 0 && cy > endCellY) || (stepY < 0 && cy < endCellY)) break;
        tMaxY += tDeltaY;
      } else {
        cz += stepZ;
        if ((stepZ > 0 && cz > endCellZ) || (stepZ < 0 && cz < endCellZ)) break;
        tMaxZ += tDeltaZ;
      }
      steps++;
    }

    return best;
  }

  private _keyFor(position: THREE.Vector3): string {
    return `${this._cellCoord(position.x)},${this._cellCoord(position.y)},${this._cellCoord(position.z)}`;
  }

  private _cellCoord(v: number): number {
    return Math.floor(v / this.cellSize);
  }

  private _firstBoundaryT(origin: number, dir: number, cell: number): number {
    if (dir === 0) return Infinity;
    const nextBoundary =
      dir > 0 ? (Math.floor(origin / cell) + 1) * cell : Math.floor(origin / cell) * cell;
    return (nextBoundary - origin) / dir;
  }
}
