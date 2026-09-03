export const NEMOSYNE_DATA_REPOSITORY = 'TsatsuAmable/nemosyne-data';
export const NEMOSYNE_DATA_PINNED_REVISION = '8e6b2dfc74ea1c60283790668cc93030c61423f8';
export const NEMOSYNE_DATA_RAW_ORIGIN = 'https://raw.githubusercontent.com';
export const NEMOSYNE_DATA_CATALOG_PATH = 'manifests/catalog.json';
export const NEMOSYNE_DATA_CATALOG_SCHEMA_VERSION = '2.2' as const;

const MAX_CATALOG_BYTES = 1024 * 1024;
const DEFAULT_MAX_ARTIFACT_BYTES = 256 * 1024 * 1024;
const SHA256_RE = /^[0-9a-f]{64}$/;
const COMMIT_RE = /^[0-9a-f]{40}$/;
const DATASET_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export type RemoteDatasetFormat = 'csv' | 'json';
export type RemoteDatasetGovernanceState = 'governed' | 'pending' | 'rejected';

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

export interface RemoteMeasurementField {
  name: string;
  storageType: string;
  measurementScale: string;
  semanticType: string;
  nullable: boolean;
  unit?: string;
}

export interface RemoteMeasurementSchema {
  status: string;
  fields: RemoteMeasurementField[];
}

export interface RemoteDatasetCatalogEntry {
  id: string;
  datasetVersion: string;
  label: string;
  kind: string;
  description: string;
  topology: string;
  governanceState: RemoteDatasetGovernanceState;
  contentDigest?: string;
  privacy: string;
  license: Record<string, unknown>;
  provenance: Record<string, unknown>;
  intendedUses: string[];
  measurementSchema: RemoteMeasurementSchema;
  plannedTiers: string[];
  artifacts: RemoteDatasetArtifact[];
  [key: string]: unknown;
}

export interface RemoteDatasetCatalog {
  schemaVersion: typeof NEMOSYNE_DATA_CATALOG_SCHEMA_VERSION;
  corpusVersion: string;
  repository: string;
  tierRows: Record<string, number>;
  datasets: RemoteDatasetCatalogEntry[];
}

export interface RemoteDatasetProvenance {
  repository: string;
  revision: string;
  schemaVersion: typeof NEMOSYNE_DATA_CATALOG_SCHEMA_VERSION;
  corpusVersion: string;
  datasetId: string;
  datasetVersion: string;
  tier: string;
  artifactPath: string;
  artifactSha256: string;
  rows: number;
  bytes: number;
  format: RemoteDatasetFormat;
  governanceState: 'governed';
}

export interface LoadedRemoteDatasetArtifact {
  dataset: RemoteDatasetCatalogEntry & { governanceState: 'governed' };
  artifact: RemoteDatasetArtifact;
  bytes: Uint8Array;
  provenance: RemoteDatasetProvenance;
}

export interface NemosyneDataCatalogClientOptions {
  revision?: string;
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

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`Invalid ${label}`);
}

function assertArtifact(value: unknown): asserts value is RemoteDatasetArtifact {
  if (!value || typeof value !== 'object') throw new Error('Invalid corpus artifact');
  const artifact = value as Record<string, unknown>;
  assertNonEmptyString(artifact.tier, 'corpus artifact tier');
  assertNonEmptyString(artifact.role, 'corpus artifact role');
  if (artifact.format !== 'csv' && artifact.format !== 'json') throw new Error('Unsupported corpus artifact format');
  if (typeof artifact.path !== 'string') throw new Error('Invalid corpus artifact path');
  assertSafePath(artifact.path);
  if (!Number.isSafeInteger(artifact.rows) || (artifact.rows as number) < 0) throw new Error('Invalid corpus artifact row count');
  if (!Number.isSafeInteger(artifact.bytes) || (artifact.bytes as number) <= 0) throw new Error('Invalid corpus artifact byte count');
  if (typeof artifact.sha256 !== 'string' || !SHA256_RE.test(artifact.sha256)) throw new Error('Invalid corpus artifact SHA-256');
  if (artifact.compression !== 'none') throw new Error('Unsupported corpus artifact compression');
}

function assertMeasurementSchema(value: unknown): asserts value is RemoteMeasurementSchema {
  if (!value || typeof value !== 'object') throw new Error('Invalid corpus measurement schema');
  const schema = value as Record<string, unknown>;
  assertNonEmptyString(schema.status, 'corpus measurement schema status');
  if (!Array.isArray(schema.fields)) throw new Error('Invalid corpus measurement fields');
  const names = new Set<string>();
  for (const rawField of schema.fields) {
    if (!rawField || typeof rawField !== 'object') throw new Error('Invalid corpus measurement field');
    const field = rawField as Record<string, unknown>;
    assertNonEmptyString(field.name, 'corpus measurement field name');
    if (names.has(field.name)) throw new Error(`Duplicate corpus measurement field: ${field.name}`);
    names.add(field.name);
    assertNonEmptyString(field.storageType, 'corpus measurement storage type');
    assertNonEmptyString(field.measurementScale, 'corpus measurement scale');
    assertNonEmptyString(field.semanticType, 'corpus semantic type');
    if (typeof field.nullable !== 'boolean') throw new Error('Invalid corpus measurement nullability');
    if (field.unit !== undefined && typeof field.unit !== 'string') throw new Error('Invalid corpus measurement unit');
  }
}

function validateCatalog(value: unknown): RemoteDatasetCatalog {
  if (!value || typeof value !== 'object') throw new Error('Invalid nemosyne-data catalog');
  const catalog = value as Record<string, unknown>;
  if (catalog.schemaVersion !== NEMOSYNE_DATA_CATALOG_SCHEMA_VERSION) {
    throw new Error(`Unsupported nemosyne-data catalog schema: ${String(catalog.schemaVersion)}`);
  }
  if (catalog.repository !== NEMOSYNE_DATA_REPOSITORY) throw new Error('Unexpected nemosyne-data repository identity');
  assertNonEmptyString(catalog.corpusVersion, 'nemosyne-data corpus version');
  if (!catalog.tierRows || typeof catalog.tierRows !== 'object' || Array.isArray(catalog.tierRows)) {
    throw new Error('Invalid nemosyne-data tier map');
  }
  for (const [tier, rows] of Object.entries(catalog.tierRows as Record<string, unknown>)) {
    if (!tier || !Number.isSafeInteger(rows) || (rows as number) < 0) throw new Error('Invalid nemosyne-data tier map');
  }
  if (!Array.isArray(catalog.datasets)) throw new Error('Invalid nemosyne-data dataset list');

  const ids = new Set<string>();
  for (const value of catalog.datasets) {
    if (!value || typeof value !== 'object') throw new Error('Invalid corpus dataset entry');
    const dataset = value as Record<string, unknown>;
    if (typeof dataset.id !== 'string' || !DATASET_ID_RE.test(dataset.id)) throw new Error('Invalid corpus dataset id');
    if (ids.has(dataset.id)) throw new Error(`Duplicate corpus dataset id: ${dataset.id}`);
    ids.add(dataset.id);
    assertNonEmptyString(dataset.datasetVersion, 'corpus dataset version');
    if (typeof dataset.label !== 'string') throw new Error('Invalid corpus dataset label');
    assertSafeLabel(dataset.label);
    assertNonEmptyString(dataset.kind, 'corpus dataset kind');
    if (typeof dataset.description !== 'string') throw new Error('Invalid corpus dataset description');
    assertNonEmptyString(dataset.topology, 'corpus dataset topology');
    if (dataset.governanceState !== 'governed' && dataset.governanceState !== 'pending' && dataset.governanceState !== 'rejected') {
      throw new Error('Invalid corpus governance state');
    }
    assertNonEmptyString(dataset.privacy, 'corpus privacy declaration');
    if (!dataset.license || typeof dataset.license !== 'object' || Array.isArray(dataset.license)) throw new Error('Invalid corpus license declaration');
    if (!dataset.provenance || typeof dataset.provenance !== 'object' || Array.isArray(dataset.provenance)) throw new Error('Invalid corpus provenance declaration');
    if (!Array.isArray(dataset.intendedUses) || !dataset.intendedUses.every((item) => typeof item === 'string' && item.length > 0)) {
      throw new Error('Invalid corpus intended uses');
    }
    assertMeasurementSchema(dataset.measurementSchema);
    if (!Array.isArray(dataset.plannedTiers) || !dataset.plannedTiers.every((tier) => typeof tier === 'string' && tier.length > 0)) {
      throw new Error('Invalid corpus planned tiers');
    }
    if (!Array.isArray(dataset.artifacts)) throw new Error('Invalid corpus artifact list');
    for (const artifact of dataset.artifacts) assertArtifact(artifact);
  }

  return catalog as unknown as RemoteDatasetCatalog;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('WebCrypto SHA-256 unavailable');
  const owned = Uint8Array.from(bytes);
  const buffer = await subtle.digest('SHA-256', owned.buffer);
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export class NemosyneDataCatalogClient {
  readonly revision: string;
  readonly repository = NEMOSYNE_DATA_REPOSITORY;
  readonly rawOrigin = NEMOSYNE_DATA_RAW_ORIGIN;
  readonly maxArtifactBytes: number;
  private readonly fetchImpl: typeof fetch;
  private readonly digestImpl: (bytes: Uint8Array) => Promise<string>;
  private catalogValue: RemoteDatasetCatalog | null = null;

  constructor(options: NemosyneDataCatalogClientOptions = {}) {
    this.revision = options.revision ?? NEMOSYNE_DATA_PINNED_REVISION;
    if (!COMMIT_RE.test(this.revision)) throw new Error('nemosyne-data revision must be an immutable 40-character commit SHA');
    this.maxArtifactBytes = options.maxArtifactBytes ?? DEFAULT_MAX_ARTIFACT_BYTES;
    if (!Number.isSafeInteger(this.maxArtifactBytes) || this.maxArtifactBytes <= 0) {
      throw new Error('maxArtifactBytes must be a positive safe integer');
    }
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
    this.catalogValue = validateCatalog(parsed);
    return this.catalogValue;
  }

  async loadArtifact(datasetId: string, tier: string, signal?: AbortSignal): Promise<LoadedRemoteDatasetArtifact> {
    const catalog = await this.loadCatalog(signal);
    const dataset = catalog.datasets.find((entry) => entry.id === datasetId);
    if (!dataset) throw new Error(`Unknown nemosyne-data dataset: ${datasetId}`);
    if (dataset.governanceState !== 'governed') {
      throw new Error(`Dataset is not governed for product loading: ${datasetId} (${dataset.governanceState})`);
    }
    const artifact = dataset.artifacts.find((candidate) => candidate.tier === tier && candidate.role === 'primary');
    if (!artifact) throw new Error(`Dataset tier is unavailable: ${datasetId}/${tier}`);
    if (!dataset.plannedTiers.includes(tier)) throw new Error(`Dataset artifact tier is not declared: ${datasetId}/${tier}`);
    if (artifact.bytes > this.maxArtifactBytes) throw new Error('Corpus artifact exceeds import byte limit');

    const url = this.urlForPath(artifact.path);
    const response = await this.fetchImpl(url, { signal, redirect: 'error' });
    this.assertResponse(response, url, Math.min(this.maxArtifactBytes, artifact.bytes));
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength !== artifact.bytes) throw new Error(`Corpus artifact byte-length mismatch: expected ${artifact.bytes}, got ${bytes.byteLength}`);
    const digest = await this.digestImpl(bytes);
    if (digest !== artifact.sha256) throw new Error('Corpus artifact SHA-256 mismatch');

    const governedDataset = dataset as RemoteDatasetCatalogEntry & { governanceState: 'governed' };
    return {
      dataset: governedDataset,
      artifact,
      bytes,
      provenance: {
        repository: NEMOSYNE_DATA_REPOSITORY,
        revision: this.revision,
        schemaVersion: catalog.schemaVersion,
        corpusVersion: catalog.corpusVersion,
        datasetId: dataset.id,
        datasetVersion: dataset.datasetVersion,
        tier: artifact.tier,
        artifactPath: artifact.path,
        artifactSha256: artifact.sha256,
        rows: artifact.rows,
        bytes: artifact.bytes,
        format: artifact.format,
        governanceState: 'governed',
      },
    };
  }

  private urlForPath(path: string): string {
    assertSafePath(path);
    const url = new URL(`${NEMOSYNE_DATA_RAW_ORIGIN}/${NEMOSYNE_DATA_REPOSITORY}/${this.revision}/${path}`);
    if (url.origin !== NEMOSYNE_DATA_RAW_ORIGIN) throw new Error('Corpus URL escaped allowlisted origin');
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
