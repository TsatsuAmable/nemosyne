/**
 * Binary Camera Pose Serializer & Vector Clock State Merger.
 *
 * Replaces high-frequency 20Hz JSON text strings with compact 32-byte binary Float32Array buffers.
 * Format: [sequence (uint32), pos.x, pos.y, pos.z, rot.x, rot.y, rot.z, rot.w]
 */

export interface CameraPose {
  sequence: number;
  position: [number, number, number];
  rotation: [number, number, number, number];
}

export class BinaryPoseSerializer {
  /**
   * Serialize CameraPose into a compact 32-byte ArrayBuffer.
   */
  static serialize(pose: CameraPose): ArrayBuffer {
    const buffer = new ArrayBuffer(32);
    const view = new DataView(buffer);

    view.setUint32(0, pose.sequence, true);

    const floatView = new Float32Array(buffer, 4, 7);
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
   * Deserialize 32-byte ArrayBuffer back into a CameraPose object.
   */
  static deserialize(buffer: ArrayBuffer): CameraPose | null {
    if (buffer.byteLength < 32) return null;
    const view = new DataView(buffer);
    const sequence = view.getUint32(0, true);

    const floatView = new Float32Array(buffer, 4, 7);
    return {
      sequence,
      position: [floatView[0], floatView[1], floatView[2]],
      rotation: [floatView[3], floatView[4], floatView[5], floatView[6]],
    };
  }
}
