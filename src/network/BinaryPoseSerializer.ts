/**
 * Binary Camera Pose Serializer & Strict Frame Codec.
 *
 * Replaces high-frequency 20Hz JSON text strings with compact 40-byte binary buffers.
 * Format (exactly 40 bytes):
 *   Bytes 0–3:   peerId    (uint32, little-endian) — non-authoritative wire metadata
 *   Bytes 4–7:   sequence  (uint32, little-endian)
 *   Bytes 8–39:  7× float32 — pos.x, pos.y, pos.z, rot.x, rot.y, rot.z, rot.w
 *
 * This class is a strict codec, never an identity or sequence authority. Monotonic
 * sequence state belongs to the connection/peer lifecycle that calls `acceptsSequence`
 * and owns the state map (see NetworkManager). The static global counter map that
 * previously made the payload numeric ID a second authority is removed.
 */

export interface CameraPose {
  peerId: number;
  sequence: number;
  position: [number, number, number];
  rotation: [number, number, number, number];
}

const POSE_FRAME_BYTES = 40;
/** Position vector magnitude bound (meters); generous room-scale ceiling. */
const MAX_POSE_POSITION_MAGNITUDE = 1e6;
/** Quaternion magnitude bounds: unit-quaternion with tolerance, rejecting degenerate/absurd frames. */
const MIN_QUATERNION_MAGNITUDE = 0.5;
const MAX_QUATERNION_MAGNITUDE = 1.5;

export class BinaryPoseSerializer {
  /**
   * Serialize CameraPose into a compact 40-byte ArrayBuffer.
   * Layout: [peerId uint32][sequence uint32][7× float32]
   */
  static serialize(pose: CameraPose): ArrayBuffer {
    const buffer = new ArrayBuffer(40);
    const view = new DataView(buffer);

    view.setUint32(0, pose.peerId, true);
    view.setUint32(4, pose.sequence, true);

    const floatView = new Float32Array(buffer, 8, 7);
    floatView[0] = pose.position[0];
    floatView[1] = pose.position[1];
    floatView[2] = pose.position[2];

    floatView[3] = pose.rotation[0];
    floatView[4] = pose.rotation[1];
    floatView[5] = pose.rotation[2];
    floatView[6] = pose.rotation[3];

    return buffer;
  }

  /**
   * Strictly deserialize an exactly-40-byte ArrayBuffer back into a CameraPose.
   * Returns null for any violation of the wire contract:
   *   - buffer length is not exactly 40 bytes;
   *   - any of the 7 float components is NaN/Infinity;
   *   - position vector magnitude exceeds the bounded ceiling;
   *   - any quaternion component exceeds unit magnitude, or the quaternion
   *     magnitude falls outside the unit-with-tolerance bounds.
   */
  static deserialize(buffer: ArrayBuffer): CameraPose | null {
    if (buffer.byteLength !== POSE_FRAME_BYTES) return null;
    const view = new DataView(buffer);

    const peerId = view.getUint32(0, true);
    const sequence = view.getUint32(4, true);

    const floatView = new Float32Array(buffer, 8, 7);
    const position: [number, number, number] = [floatView[0], floatView[1], floatView[2]];
    const rotation: [number, number, number, number] = [floatView[3], floatView[4], floatView[5], floatView[6]];

    if (!isFiniteArray(position) || Math.hypot(...position) > MAX_POSE_POSITION_MAGNITUDE) return null;
    if (!isBoundedQuaternion(rotation)) return null;

    return { peerId, sequence, position, rotation };
  }

  /**
   * Pure monotonic sequence predicate. The caller owns the state map and the key;
   * this helper never retains mutable module state.
   * Returns true (and records the sequence) only when `incomingSeq` is strictly
   * greater than the last accepted sequence for `peerKey`.
   */
  static acceptsSequence(state: Map<string, number>, peerKey: string, incomingSeq: number): boolean {
    const last = state.get(peerKey) ?? -1;
    if (incomingSeq <= last) return false;
    state.set(peerKey, incomingSeq);
    return true;
  }
}

function isFiniteArray(values: readonly number[]): boolean {
  for (const value of values) {
    if (!Number.isFinite(value)) return false;
  }
  return true;
}

function isBoundedQuaternion(rotation: readonly number[]): boolean {
  for (const value of rotation) {
    if (!Number.isFinite(value) || Math.abs(value) > 1) return false;
  }
  const magnitude = Math.hypot(...rotation);
  return magnitude >= MIN_QUATERNION_MAGNITUDE && magnitude <= MAX_QUATERNION_MAGNITUDE;
}