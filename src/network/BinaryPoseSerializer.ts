/**
 * Binary Camera Pose Serializer & Vector Clock State Merger.
 *
 * Replaces high-frequency 20Hz JSON text strings with compact 40-byte binary buffers.
 * Format (40 bytes):
 *   Bytes 0–3:   peerId    (uint32, little-endian)
 *   Bytes 4–7:   sequence  (uint32, little-endian)
 *   Bytes 8–39:  7× float32 — pos.x, pos.y, pos.z, rot.x, rot.y, rot.z, rot.w
 */

export interface CameraPose {
  peerId: number;
  sequence: number;
  position: [number, number, number];
  rotation: [number, number, number, number];
}

export class BinaryPoseSerializer {
  /**
   * Per-peer monotonic sequence counters for drop protection.
   * Key: peerId (uint32), Value: last accepted sequence number.
   */
  static _sequenceCounters: Map<number, number> = new Map();

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
   * Deserialize 40-byte ArrayBuffer back into a CameraPose object.
   * Returns null if buffer is too short.
   */
  static deserialize(buffer: ArrayBuffer): CameraPose | null {
    if (buffer.byteLength < 40) return null;
    const view = new DataView(buffer);

    const peerId = view.getUint32(0, true);
    const sequence = view.getUint32(4, true);

    const floatView = new Float32Array(buffer, 8, 7);
    return {
      peerId,
      sequence,
      position: [floatView[0], floatView[1], floatView[2]],
      rotation: [floatView[3], floatView[4], floatView[5], floatView[6]],
    };
  }

  /**
   * Validate incoming sequence number for a given peer.
   * Returns true (and updates the counter) if incomingSeq is strictly greater
   * than the last seen sequence for that peer — i.e., the packet is new.
   * Returns false for duplicate or out-of-order packets so callers can drop them.
   */
  static validateSequence(peerId: number, incomingSeq: number): boolean {
    const last = BinaryPoseSerializer._sequenceCounters.get(peerId) ?? -1;
    if (incomingSeq > last) {
      BinaryPoseSerializer._sequenceCounters.set(peerId, incomingSeq);
      return true;
    }
    return false;
  }

  /**
   * Reset all per-peer sequence counters.
   * Intended for test cleanup between test cases.
   */
  static resetCounters(): void {
    BinaryPoseSerializer._sequenceCounters.clear();
  }
}
