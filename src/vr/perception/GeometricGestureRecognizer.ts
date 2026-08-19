/**
 * 1-Shot 3D Geometric Gesture Template Recognizer ($3D algorithm).
 *
 * Provides deterministic, low-latency, zero-dependency geometric trajectory
 * matching for custom hand/pointer gestures (e.g. circle, swipe, checkmark, loop).
 */

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface GestureTemplate {
  name: string;
  points: Point3D[];
}

export interface GestureMatchResult {
  templateName: string;
  score: number; // 0 (no match) to 1 (perfect match)
  distance: number;
}

const DEFAULT_SAMPLE_COUNT = 32;

export class GeometricGestureRecognizer {
  private readonly _templates: GestureTemplate[] = [];

  constructor(initialTemplates: GestureTemplate[] = []) {
    for (const t of initialTemplates) {
      this.addTemplate(t.name, t.points);
    }
  }

  get templateCount(): number {
    return this._templates.length;
  }

  addTemplate(name: string, rawPoints: Point3D[]): void {
    if (rawPoints.length < 2) return;
    const normalized = this._normalizePoints(rawPoints, DEFAULT_SAMPLE_COUNT);
    this._templates.push({ name, points: normalized });
  }

  /**
   * Classify an incoming 3D trajectory against registered gesture templates.
   */
  recognize(candidatePoints: Point3D[], minConfidence = 0.65): GestureMatchResult | null {
    if (candidatePoints.length < 2 || this._templates.length === 0) {
      return null;
    }

    const normalized = this._normalizePoints(candidatePoints, DEFAULT_SAMPLE_COUNT);
    let bestDist = Infinity;
    let bestTemplate: GestureTemplate | null = null;

    for (const template of this._templates) {
      const d = this._pathDistance(normalized, template.points);
      if (d < bestDist) {
        bestDist = d;
        bestTemplate = template;
      }
    }

    if (!bestTemplate) return null;

    // Convert average Euclidean distance per point to [0, 1] confidence score
    const avgDist = bestDist / DEFAULT_SAMPLE_COUNT;
    const score = Math.max(0, 1 - avgDist / 0.5);

    if (score < minConfidence) {
      return null;
    }

    return {
      templateName: bestTemplate.name,
      score,
      distance: avgDist,
    };
  }

  private _normalizePoints(points: Point3D[], targetCount: number): Point3D[] {
    const resampled = this._resample(points, targetCount);
    const translated = this._translateToCentroid(resampled);
    return this._scaleToUnitBox(translated);
  }

  private _resample(points: Point3D[], n: number): Point3D[] {
    const totalLength = this._pathLength(points);
    if (totalLength === 0) {
      return Array(n).fill({ ...points[0] });
    }

    const interval = totalLength / (n - 1);
    let currentD = 0;
    const newPoints: Point3D[] = [{ ...points[0] }];

    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1];
      const p2 = points[i];
      const d = this._dist(p1, p2);

      if (currentD + d >= interval) {
        const qx = p1.x + ((interval - currentD) / d) * (p2.x - p1.x);
        const qy = p1.y + ((interval - currentD) / d) * (p2.y - p1.y);
        const qz = p1.z + ((interval - currentD) / d) * (p2.z - p1.z);
        const q = { x: qx, y: qy, z: qz };
        newPoints.push(q);
        // Insert q into sequence to evaluate rest of segment
        points.splice(i, 0, q);
        currentD = 0;
      } else {
        currentD += d;
      }
    }

    while (newPoints.length < n) {
      newPoints.push({ ...points[points.length - 1] });
    }
    return newPoints.slice(0, n);
  }

  private _translateToCentroid(points: Point3D[]): Point3D[] {
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (const p of points) {
      cx += p.x;
      cy += p.y;
      cz += p.z;
    }
    cx /= points.length;
    cy /= points.length;
    cz /= points.length;

    return points.map((p) => ({
      x: p.x - cx,
      y: p.y - cy,
      z: p.z - cz,
    }));
  }

  private _scaleToUnitBox(points: Point3D[]): Point3D[] {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (const p of points) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    }

    const size = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 0.0001);
    return points.map((p) => ({
      x: p.x / size,
      y: p.y / size,
      z: p.z / size,
    }));
  }

  private _pathLength(points: Point3D[]): number {
    let d = 0;
    for (let i = 1; i < points.length; i++) {
      d += this._dist(points[i - 1], points[i]);
    }
    return d;
  }

  private _pathDistance(a: Point3D[], b: Point3D[]): number {
    let d = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      d += this._dist(a[i], b[i]);
    }
    return d;
  }

  private _dist(p1: Point3D, p2: Point3D): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = p1.z - p2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
}
