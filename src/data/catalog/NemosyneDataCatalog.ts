export const NEMOSYNE_DATA_REPOSITORY = 'TsatsuAmable/nemosyne-data';
export const NEMOSYNE_DATA_PINNED_REVISION = '4c69c13dfc10da8d59d88ae5cae5a4d4dfa5779a';
export const NEMOSYNE_DATA_RAW_ORIGIN = 'https://raw.githubusercontent.com';
export const NEMOSYNE_DATA_CATALOG_PATH = 'manifests/catalog.json';

const MAX_CATALOG_BYTES = 1024 * 1024;
const DEFAULT_MAX_ARTIFACT_BYTES = 256 * 1024 * 1024;
const SHA256_RE = /^[0-9a-f]{64}$/;
const COMMIT_RE = /^[0-9a-f]{40}$/;

export type RemoteDatasetFormat = 'csv' | 'json';

export interface RemoteDatasetArtifact {
  tier: string;
  role: string;
  format: RemoteDatasetFormat;
  path: string;
  rows: number;
  bytes: number;
  sha256: string;
  compression: 'none';
}

export interface RemoteDatasetCatalogEntry {
  id: string;
  label: string;
  kind: string;
  description: string;
  topology?: string;
  plannedTiers: string[];
  artifacts: RemoteDatasetArtifact[];
}

export interface RemoteDatasetCatalog {
  schemaVersion: '1.0';
  corpusVersion: string;
  repository: string;
  tierRows: Record<string, number>;
  datasets: RemoteDatasetCatalogEntry[];
}

export interface RemoteDatasetProvenance {
  repository: string;
  revision: string;
  corpusVersion: string;
  datasetId: string;
  tier: string;
  artifactPath: string;
  artifactSha256: string;
  rows: number;
  bytes: number;
  format: RemoteDatasetFormat;
}

export interface LoadedRemoteDatasetArtifact {
  dataset: RemoteDatasetCatalogEntry;
  artifact: RemoteDatasetArtifact;
  bytes: Uint8Array;
  provenance: RemoteDatasetProvenance;
}

export interface NemosyneDataCatalogClientOptions {
  revision?: string;
  repository?: string;
  rawOrigin?: string;
  maxArtifactBytes?: number;
  fetchImpl?: typeof fetch;
  digestImpl?: (bytes: Uint8Array) => Promise<string>;
}

function assertSafePath(path: string): void {
  if (
    path.length === 0 ||
    path.startsWith('/') ||
    path.includes('\\') ||
    path.split('/').some((segment) => segment === '..' || segment === '.') ||
    /^[a-z][a-z0-9+.-]*:/i.test(path)
  ) {
    throw new Error(`Unsafe corpus artifact path: ${path}`);
  }
}

function assertSafeLabel(label: string): void {
  if (label.length === 0 || label.length > 128) throw new Error('Invalid corpus dataset label');
  for (const ch of label) {
    const code = ch.charCodeAt(0);
    if (code === 0 || code < 32 || code === 127) throw new Error('Invalid corpus dataset label');
  }
}

function assertArtifact(value: unknown): asserts value is RemoteDatasetArtifact {
  if (!value || typeof value !== 'object') throw new Error('Invalid corpus artifact');
  const artifact = value as Record<string, unknown>;
  if (typeof artifact.tier !== 'string' || artifact.tier.length === 0) throw new Error('Invalid corpus artifact tier');
  if (typeof artifact.role !== 'string' || artifact.role.length === 0) throw new Error('Invalid corpus artifact role');
  if (artifact.format !== 'csv' && artifact.format !== 'json') throw new Error('Unsupported corpus artifact format');
  if (typeof artifact.path !== 'string') throw new Error('Invalid corpus artifact path');
  assertSafePath(artifact.path);
  if (!Number.isSafeInteger(artifact.rows) || (artifact.rows as number) < 0) throw new Error('Invalid corpus artifact row count');
  if (!Number.isSafeInteger(artifact.bytes) || (artifact.bytes as number) <= 0) throw new Error('Invalid corpus artifact byte count');
  if (typeof artifact.sha256 !== 'string' || !SHA256_RE.test(artifact.sha256)) throw new Error('Invalid corpus artifact SHA-256');
  if (artifact.compression !== 'none') throw new Error('Unsupported corpus artifact compression');
}

function validateCatalog(value: unknown, expectedRepository: string): RemoteDatasetCatalog {
  if (!value || typeof value !== 'object') throw new Error('Invalid nemosyne-data catalog');
  const catalog = value as Record<string, unknown>;
  if (catalog.schemaVersion !== '1.0') throw new Error('Unsupported nemosyne-data catalog schema');
  if (catalog.repository !== expectedRepository) throw new Error('Unexpected nemosyne-data repository identity');
  if (typeof catalog.corpusVersion !== 'string' || catalog.corpusVersion.length === 0) throw new Error('Invalid nemosyne-data corpus version');
  if (!catalog.tierRows || typeof catalog.tierRows !== 'object') throw new Error('Invalid nemosyne-data tier map');
  if (!Array.isArray(catalog.datasets)) throw new Error('Invalid nemosyne-data dataset list');

  for (const value of catalog.datasets) {
    if (!value || typeof value !== 'object') throw new Error('Invalid corpus dataset entry');
    const dataset = value as Record<string, unknown>;
    if (typeof dataset.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(dataset.id)) throw new Error('Invalid corpus dataset id');
    if (typeof dataset.label !== 'string') throw new Error('Invalid corpus dataset label');
    assertSafeLabel(dataset.label);
    if (typeof dataset.kind !== 'string' || typeof dataset.description !== 'string') throw new Error('Invalid corpus dataset metadata');
    if (!Array.isArray(dataset.plannedTiers) || !dataset.plannedTiers.every((tier) => typeof tier === 'string')) throw new Error('Invalid corpus planned tiers');
    if (!Array.isArray(dataset.artifacts)) throw new Error('Invalid corpus artifact list');
    for (const artifact of dataset.artifacts) assertArtifact(artifact);
  }

  return catalog as unknown as RemoteDatasetCatalog;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('WebCrypto SHA-256 unavailable');
  const buffer = await subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export class NemosyneDataCatalogClient {
  readonly revision: string;
  readonly repository: string;
  readonly rawOrigin: string;
  readonly maxArtifactBytes: number;
  private readonly fetchImpl: typeof fetch;
  private readonly digestImpl: (bytes: Uint8Array) => Promise<string>;
  private catalogValue: RemoteDatasetCatalog | null = null;

  constructor(options: NemosyneDataCatalogClientOptions = {}) {
    this.revision = options.revision ?? NEMOSYNE_DATA_PINNED_REVISION;
    if (!COMMIT_RE.test(this.revision)) throw new Error('nemosyne-data revision must be an immutable 40-character commit SHA');
    this.repository = options.repository ?? NEMOSYNE_DATA_REPOSITORY;
    this.rawOrigin = (options.rawOrigin ?? NEMOSYNE_DATA_RAW_ORIGIN).replace(/\/$/, '');
    if (new URL(this.rawOrigin).protocol !== 'https:') throw new Error('nemosyne-data origin must use HTTPS');
    this.maxArtifactBytes = options.maxArtifactBytes ?? DEFAULT_MAX_ARTIFACT_BYTES;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.digestImpl = options.digestImpl ?? sha256Hex;
  }

  get catalogUrl(): string {
    return this.urlForPath(NEMOSYNE_DATA_CATALOG_PATH);
  }

  async loadCatalog(signal?: AbortSignal): Promise<RemoteDatasetCatalog> {
    if (this.catalogValue) return this.catalogValue;
    const response = await this.fetchImpl(this.catalogUrl, { signal, redirect: 'error' });
    this.assertResponse(response, this.catalogUrl, MAX_CATALOG_BYTES);
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_CATALOG_BYTES) throw new Error('nemosyne-data catalog exceeds size limit');
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('nemosyne-data catalog is not valid JSON');
    }
    this.catalogValue = validateCatalog(parsed, this.repository);
    return this.catalogValue;
  }

  async loadArtifact(datasetId: string, tier: string, signal?: AbortSignal): Promise<LoadedRemoteDatasetArtifact> {
    const catalog = await this.loadCatalog(signal);
    const dataset = catalog.datasets.find((entry) => entry.id === datasetId);
    if (!dataset) throw new Error(`Unknown nemosyne-data dataset: ${datasetId}`);
    const artifact = dataset.artifacts.find((candidate) => candidate.tier === tier && candidate.role === 'primary');
    if (!artifact) throw new Error(`Dataset tier is unavailable: ${datasetId}/${tier}`);
    if (artifact.bytes > this.maxArtifactBytes) throw new Error('Corpus artifact exceeds import byte limit');

    const url = this.urlForPath(artifact.path);
    const response = await this.fetchImpl(url, { signal, redirect: 'error' });
    this.assertResponse(response, url, Math.min(this.maxArtifactBytes, artifact.bytes));
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength !== artifact.bytes) throw new Error(`Corpus artifact byte-length mismatch: expected ${artifact.bytes}, got ${bytes.byteLength}`);
    const digest = await this.digestImpl(bytes);
    if (digest !== artifact.sha256) throw new Error('Corpus artifact SHA-256 mismatch');

    return {
      dataset,
      artifact,
      bytes,
      provenance: {
        repository: this.repository,
        revision: this.revision,
        corpusVersion: catalog.corpusVersion,
        datasetId: dataset.id,
        tier: artifact.tier,
        artifactPath: artifact.path,
        artifactSha256: artifact.sha256,
        rows: artifact.rows,
        bytes: artifact.bytes,
        format: artifact.format,
      },
    };
  }

  private urlForPath(path: string): string {
    assertSafePath(path);
    const url = new URL(`${this.rawOrigin}/${this.repository}/${this.revision}/${path}`);
    if (url.origin !== new URL(this.rawOrigin).origin) throw new Error('Corpus URL escaped allowlisted origin');
    return url.toString();
  }

  private assertResponse(response: Response, expectedUrl: string, limit: number): void {
    if (!response.ok) throw new Error(`nemosyne-data request failed (${response.status})`);
    if (response.url && response.url !== expectedUrl) throw new Error('nemosyne-data redirect refused');
    const contentLength = response.headers.get('content-length');
    if (contentLength !== null) {
      const bytes = Number(contentLength);
      if (!Number.isFinite(bytes) || bytes < 0 || bytes > limit) throw new Error('nemosyne-data response exceeds size limit');
    }
  }
}
