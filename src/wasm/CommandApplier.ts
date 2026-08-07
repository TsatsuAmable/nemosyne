import * as THREE from 'three';

export const COMMAND_MAGIC = 0x4e454d4f; // 'NEMO' ASCII in LE
export const COMMAND_VERSION = 1;

export const OP_CREATE_NODE = 0x01;
export const OP_UPDATE_TRANSFORM = 0x02;
export const OP_DESTROY_NODE = 0x03;
export const OP_SET_COLOR = 0x04;
export const OP_UPDATE_INSTANCES = 0x05;

export interface ParsedCommand {
  op: number;
  entity: number;
  data?: Record<string, unknown>;
}

export class CommandApplier {
  private entities: Map<number, THREE.Object3D> = new Map();
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public registerEntity(handle: number, object: THREE.Object3D): void {
    this.entities.set(handle, object);
  }

  public unregisterEntity(handle: number): void {
    const object = this.entities.get(handle);
    if (object) {
      if (object.parent) {
        object.parent.remove(object);
      }
      this.entities.delete(handle);
    }
  }

  public getEntity(handle: number): THREE.Object3D | undefined {
    return this.entities.get(handle);
  }

  public applyCommandBuffer(buffer: ArrayBuffer, byteOffset: number, byteLength: number): ParsedCommand[] {
    if (byteLength < 8) return [];

    const view = new DataView(buffer, byteOffset, byteLength);
    const magic = view.getUint32(0, true);
    const version = view.getUint16(4, true);
    const commandCount = view.getUint16(6, true);

    if (magic !== COMMAND_MAGIC || version !== COMMAND_VERSION) {
      return [];
    }

    let offset = 8;
    const parsedCommands: ParsedCommand[] = [];

    for (let i = 0; i < commandCount && offset < byteLength; i++) {
      const op = view.getUint8(offset);
      offset += 1;

      switch (op) {
        case OP_CREATE_NODE: {
          const entity = view.getUint32(offset, true);
          const geometryType = view.getUint8(offset + 4);
          const materialType = view.getUint8(offset + 5);
          const flags = view.getUint16(offset + 6, true);
          offset += 8;

          parsedCommands.push({
            op,
            entity,
            data: { geometryType, materialType, flags },
          });
          break;
        }

        case OP_UPDATE_TRANSFORM: {
          const entity = view.getUint32(offset, true);
          const px = view.getFloat32(offset + 4, true);
          const py = view.getFloat32(offset + 8, true);
          const pz = view.getFloat32(offset + 12, true);
          const rx = view.getFloat32(offset + 16, true);
          const ry = view.getFloat32(offset + 20, true);
          const rz = view.getFloat32(offset + 24, true);
          const rw = view.getFloat32(offset + 28, true);
          const sx = view.getFloat32(offset + 32, true);
          const sy = view.getFloat32(offset + 36, true);
          const sz = view.getFloat32(offset + 40, true);
          offset += 44;

          const target = this.entities.get(entity);
          if (target) {
            target.position.set(px, py, pz);
            target.quaternion.set(rx, ry, rz, rw);
            target.scale.set(sx, sy, sz);
          }

          parsedCommands.push({
            op,
            entity,
            data: {
              position: [px, py, pz],
              quaternion: [rx, ry, rz, rw],
              scale: [sx, sy, sz],
            },
          });
          break;
        }

        case OP_DESTROY_NODE: {
          const entity = view.getUint32(offset, true);
          offset += 4;
          this.unregisterEntity(entity);
          parsedCommands.push({ op, entity });
          break;
        }

        case OP_SET_COLOR: {
          const entity = view.getUint32(offset, true);
          const r = view.getFloat32(offset + 4, true);
          const g = view.getFloat32(offset + 8, true);
          const b = view.getFloat32(offset + 12, true);
          const a = view.getFloat32(offset + 16, true);
          offset += 20;

          const target = this.entities.get(entity) as THREE.Mesh;
          if (target && target.material) {
            const mat = target.material as THREE.MeshStandardMaterial;
            if (mat.color) mat.color.setRGB(r, g, b);
            if (mat.opacity !== undefined) mat.opacity = a;
          }

          parsedCommands.push({ op, entity, data: { color: [r, g, b, a] } });
          break;
        }

        case OP_UPDATE_INSTANCES: {
          const entity = view.getUint32(offset, true);
          const instanceCount = view.getUint32(offset + 4, true);
          const dataOffset = view.getUint32(offset + 8, true);
          offset += 12;

          parsedCommands.push({
            op,
            entity,
            data: { instanceCount, dataOffset },
          });
          break;
        }

        default:
          // Unknown opcode, break parsing to avoid buffer desync
          return parsedCommands;
      }
    }

    return parsedCommands;
  }
}
