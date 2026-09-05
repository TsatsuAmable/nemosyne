import * as THREE from 'three';

/**
 * Shared pointer-ray admission predicate.
 *
 * A usable pointer ray must have six finite vector components and a direction
 * with meaningful magnitude. Keep this as the single authority for hover,
 * active-pointer selection and UX-trace ray-validity classification so those
 * paths cannot disagree about tracking loss.
 */
const MIN_DIRECTION_LENGTH_SQ = 1e-12;

export function isUsablePointerRay(ray: THREE.Ray | null | undefined): ray is THREE.Ray {
  if (!ray) return false;

  const { origin, direction } = ray;
  if (
    !Number.isFinite(origin.x) ||
    !Number.isFinite(origin.y) ||
    !Number.isFinite(origin.z) ||
    !Number.isFinite(direction.x) ||
    !Number.isFinite(direction.y) ||
    !Number.isFinite(direction.z)
  ) {
    return false;
  }

  const directionLengthSq = direction.lengthSq();
  return Number.isFinite(directionLengthSq) && directionLengthSq > MIN_DIRECTION_LENGTH_SQ;
}
