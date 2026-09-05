import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ImmutableReferenceV1 } from '../governance/GovernedEventContracts.ts';
import { sha256Hex } from '../security/CryptoHash.ts';
import {
  LEARNING_SAFE_ID,
  LEARNING_STABLE_VERSION,
  exactObjectKeys,
  isImmutableReferenceV1,
  sameImmutableReferenceV1,
} from './LearningContractPrimitives.ts';

export interface LearningArtifactDescriptorV1 extends ImmutableReferenceV1 {
  readonly mediaType: string;
  readonly byteLength: number;
}

export interface PutLearningArtifactV1 {
  readonly id: string;
  readonly version: string;
  readonly mediaType: string;
  readonly bytes: Uint8Array;
}

export class LearningArtifactStoreError extends Error {
  constructor(
    readonly code: 'INVALID_ARTIFACT' | 'ARTIFACT_TOO_LARGE' | 'IDENTITY_COLLISION' | 'CORRUPT_STORE' | 'NOT_FOUND',
    message: string,
  ) {
    super(message);
    this.name = 'LearningArtifactStoreError';
  }
}

const MEDIA_TYPE = /^[A-Za-z0-9][A-Za-z0-9.+-]{0,63}\/[A-Za-z0-9][A-Za-z0-9.+-]{0,63}$/;
const DEFAULT_MAX_ARTIFACT_BYTES = 64 * 1024 * 1024;

function descriptorEqual(left: LearningArtifactDescriptorV1, right: LearningArtifactDescriptorV1): boolean {
  return sameImmutableReferenceV1(left, right) &&
    left.mediaType === right.mediaType &&
    left.byteLength === right.byteLength;
}

function validateDescriptor(value: unknown): value is LearningArtifactDescriptorV1 {
  if (!isImmutableReferenceV1(value) || !exactObjectKeys(value, [
    'schemaVersion', 'id', 'version', 'digest', 'mediaType', 'byteLength',
  ])) return false;
  const descriptor = value as LearningArtifactDescriptorV1;
  return MEDIA_TYPE.test(descriptor.mediaType) &&
    Number.isSafeInteger(descriptor.byteLength) &&
    descriptor.byteLength >= 0;
}

/**
 * Repository-runnable durable artifact store for the PT7 learning plane.
 *
 * Storage is content-addressed by SHA-256. Logical id/version metadata is bound
 * to the digest and may not be rebound to different bytes. This is deliberately
 * a replaceable filesystem adapter, not a production object-storage claim.
 */
export class FileLearningArtifactStoreV1 {
  private readonly rootDirectory: string;
  private readonly maxArtifactBytes: number;

  constructor(options: Readonly<{ rootDirectory: string; maxArtifactBytes?: number }>) {
    if (!options.rootDirectory) throw new LearningArtifactStoreError('INVALID_ARTIFACT', 'rootDirectory is required');
    const max = options.maxArtifactBytes ?? DEFAULT_MAX_ARTIFACT_BYTES;
    if (!Number.isSafeInteger(max) || max < 1) {
      throw new LearningArtifactStoreError('INVALID_ARTIFACT', 'maxArtifactBytes must be a positive safe integer');
    }
    this.rootDirectory = options.rootDirectory;
    this.maxArtifactBytes = max;
    mkdirSync(join(this.rootDirectory, 'sha256'), { recursive: true });
  }

  put(input: PutLearningArtifactV1): LearningArtifactDescriptorV1 {
    if (
      !LEARNING_SAFE_ID.test(input.id) ||
      !LEARNING_STABLE_VERSION.test(input.version) ||
      !MEDIA_TYPE.test(input.mediaType) ||
      !(input.bytes instanceof Uint8Array)
    ) {
      throw new LearningArtifactStoreError('INVALID_ARTIFACT', 'artifact id/version/mediaType/bytes are invalid');
    }
    if (input.bytes.byteLength > this.maxArtifactBytes) {
      throw new LearningArtifactStoreError('ARTIFACT_TOO_LARGE', `artifact exceeds ${this.maxArtifactBytes} bytes`);
    }

    const digest = sha256Hex(input.bytes);
    const descriptor: LearningArtifactDescriptorV1 = Object.freeze({
      schemaVersion: '1',
      id: input.id,
      version: input.version,
      digest: Object.freeze({ algorithm: 'SHA256' as const, value: digest }),
      mediaType: input.mediaType,
      byteLength: input.bytes.byteLength,
    });
    const { dataPath, metadataPath } = this.paths(digest);
    mkdirSync(join(this.rootDirectory, 'sha256', digest.slice(0, 2)), { recursive: true });

    if (existsSync(dataPath) || existsSync(metadataPath)) {
      if (!existsSync(dataPath) || !existsSync(metadataPath)) {
        throw new LearningArtifactStoreError('CORRUPT_STORE', `partial content-addressed artifact ${digest}`);
      }
      const existingDescriptor = this.readDescriptor(metadataPath);
      if (!descriptorEqual(existingDescriptor, descriptor)) {
        throw new LearningArtifactStoreError(
          'IDENTITY_COLLISION',
          `digest ${digest} is already bound to ${existingDescriptor.id}@${existingDescriptor.version}`,
        );
      }
      this.verifyBytes(dataPath, existingDescriptor);
      return descriptor;
    }

    try {
      writeFileSync(dataPath, input.bytes, { flag: 'wx' });
      writeFileSync(metadataPath, `${JSON.stringify(descriptor)}\n`, { encoding: 'utf8', flag: 'wx' });
    } catch (error) {
      if (existsSync(dataPath) && existsSync(metadataPath)) {
        const existingDescriptor = this.readDescriptor(metadataPath);
        if (descriptorEqual(existingDescriptor, descriptor)) {
          this.verifyBytes(dataPath, existingDescriptor);
          return descriptor;
        }
      }
      throw new LearningArtifactStoreError('CORRUPT_STORE', `failed to commit immutable artifact ${digest}: ${String(error)}`);
    }
    return descriptor;
  }

  get(descriptor: LearningArtifactDescriptorV1): Uint8Array {
    if (!validateDescriptor(descriptor)) {
      throw new LearningArtifactStoreError('INVALID_ARTIFACT', 'artifact descriptor is invalid');
    }
    const { dataPath, metadataPath } = this.paths(descriptor.digest.value);
    if (!existsSync(dataPath) || !existsSync(metadataPath)) {
      throw new LearningArtifactStoreError('NOT_FOUND', `artifact ${descriptor.digest.value} is not present`);
    }
    const storedDescriptor = this.readDescriptor(metadataPath);
    if (!descriptorEqual(storedDescriptor, descriptor)) {
      throw new LearningArtifactStoreError('IDENTITY_COLLISION', 'requested logical identity does not match stored artifact metadata');
    }
    const bytes = this.verifyBytes(dataPath, storedDescriptor);
    return new Uint8Array(bytes);
  }

  private paths(digest: string): Readonly<{ dataPath: string; metadataPath: string }> {
    const directory = join(this.rootDirectory, 'sha256', digest.slice(0, 2));
    return {
      dataPath: join(directory, `${digest}.bin`),
      metadataPath: join(directory, `${digest}.json`),
    };
  }

  private readDescriptor(metadataPath: string): LearningArtifactDescriptorV1 {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(metadataPath, 'utf8'));
    } catch (error) {
      throw new LearningArtifactStoreError('CORRUPT_STORE', `artifact metadata is unreadable: ${String(error)}`);
    }
    if (!validateDescriptor(parsed)) {
      throw new LearningArtifactStoreError('CORRUPT_STORE', 'artifact metadata violates the closed PT7 descriptor contract');
    }
    return parsed;
  }

  private verifyBytes(dataPath: string, descriptor: LearningArtifactDescriptorV1): Uint8Array {
    const bytes = readFileSync(dataPath);
    if (bytes.byteLength !== descriptor.byteLength || sha256Hex(bytes) !== descriptor.digest.value) {
      throw new LearningArtifactStoreError('CORRUPT_STORE', `artifact bytes do not match ${descriptor.digest.value}`);
    }
    return bytes;
  }
}
