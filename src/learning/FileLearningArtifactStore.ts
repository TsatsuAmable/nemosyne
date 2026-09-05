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
 * Blobs are content-addressed by SHA-256 while logical id/version aliases are
 * stored separately. Identical bytes can therefore be reused by multiple
 * legitimate logical artifacts, while one id/version may never be rebound to
 * different content. This is replaceable repository infrastructure, not a
 * production object-storage claim.
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
    mkdirSync(join(this.rootDirectory, 'refs'), { recursive: true });
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
    const dataPath = this.dataPath(digest);
    const metadataPath = this.metadataPath(input.id, input.version);
    mkdirSync(join(this.rootDirectory, 'sha256', digest.slice(0, 2)), { recursive: true });

    if (existsSync(dataPath)) {
      this.verifyBytes(dataPath, descriptor);
    } else {
      try {
        writeFileSync(dataPath, input.bytes, { flag: 'wx' });
      } catch (error) {
        if (!existsSync(dataPath)) {
          throw new LearningArtifactStoreError('CORRUPT_STORE', `failed to commit immutable blob ${digest}: ${String(error)}`);
        }
        this.verifyBytes(dataPath, descriptor);
      }
    }

    if (existsSync(metadataPath)) {
      const existingDescriptor = this.readDescriptor(metadataPath);
      if (!descriptorEqual(existingDescriptor, descriptor)) {
        throw new LearningArtifactStoreError(
          'IDENTITY_COLLISION',
          `${input.id}@${input.version} is already bound to ${existingDescriptor.digest.value}`,
        );
      }
      return descriptor;
    }

    try {
      writeFileSync(metadataPath, `${JSON.stringify(descriptor)}\n`, { encoding: 'utf8', flag: 'wx' });
    } catch (error) {
      if (existsSync(metadataPath)) {
        const existingDescriptor = this.readDescriptor(metadataPath);
        if (descriptorEqual(existingDescriptor, descriptor)) return descriptor;
      }
      throw new LearningArtifactStoreError('CORRUPT_STORE', `failed to commit immutable artifact alias: ${String(error)}`);
    }
    return descriptor;
  }

  get(descriptor: LearningArtifactDescriptorV1): Uint8Array {
    if (!validateDescriptor(descriptor)) {
      throw new LearningArtifactStoreError('INVALID_ARTIFACT', 'artifact descriptor is invalid');
    }
    const metadataPath = this.metadataPath(descriptor.id, descriptor.version);
    if (!existsSync(metadataPath)) {
      throw new LearningArtifactStoreError('NOT_FOUND', `${descriptor.id}@${descriptor.version} is not registered`);
    }
    const storedDescriptor = this.readDescriptor(metadataPath);
    if (!descriptorEqual(storedDescriptor, descriptor)) {
      throw new LearningArtifactStoreError('IDENTITY_COLLISION', 'requested logical identity does not match stored artifact metadata');
    }
    const dataPath = this.dataPath(descriptor.digest.value);
    if (!existsSync(dataPath)) {
      throw new LearningArtifactStoreError('CORRUPT_STORE', `artifact blob ${descriptor.digest.value} is missing`);
    }
    const bytes = this.verifyBytes(dataPath, storedDescriptor);
    return new Uint8Array(bytes);
  }

  private dataPath(digest: string): string {
    return join(this.rootDirectory, 'sha256', digest.slice(0, 2), `${digest}.bin`);
  }

  private metadataPath(id: string, version: string): string {
    const aliasDigest = sha256Hex(`pt7-learning-artifact-alias-v1\n${id}\n${version}`);
    return join(this.rootDirectory, 'refs', `${aliasDigest}.json`);
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
