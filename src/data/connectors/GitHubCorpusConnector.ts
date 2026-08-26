import type { AnalyticalKernelPort } from '../../atlas/adapters/AnalyticalKernelPort.ts';

export type CorpusTier = 'smoke' | 'small' | 'medium' | 'large' | 'xlarge';
export type CorpusFormat = 'csv' | 'json' | 'ntc1';

export interface CorpusArtifact {
  tier: CorpusTier;
  role: string;
  format: CorpusFormat;
  path?: string;
  url?: string;
  rows?: number;
  bytes?: number;
  sha256: string;
  compression?: 'none' | 'gzip';
}

export interface CorpusDatasetManifest {
  id: string;
  label: string;
  kind: 'synthetic' | 'real';
  description: string;
  topology: string;
  plannedTiers: CorpusTier[];
  artifacts: CorpusArtifact[];
  [key: string]: unknown;
}

export interface CorpusCatalog {
  schemaVersion: '1.0';
  corpusVersion: string;
  repository: string;
  datasets: CorpusDatasetManifest[];
  [key: string]: unknown;
}

export interface GitHubCorpusConnectorOptions {
  owner?: string;
  repo?: string;
  ref?: string;
  catalogPath?: string;
  /** Optional immutable release catalog URL. When present it replaces the raw-GitHub catalog path. */
  catalogUrl?: string;
  /** Hard safety ceiling for a single downloaded artifact. Defaults to 512 MiB. */
  maxArtifactBytes?: number;
  fetchImpl?: typeof fetch;
}

export interface CorpusLoadRequest {
  datasetId: string;
  tier: CorpusTier;
  role?: string;
  signal?: AbortSignal;
  /** Optional name supplied to NTC1 typed-column ingest. */
  name?: string;
}

export interface CorpusArtifactSelection {
  dataset: CorpusDatasetManifest;
  artifact: CorpusArtifact;
  url: string;
}

const DEFAULT_OWNER = 'TsatsuAmable';
const DEFAULT_REPO = 'nemosyne-data';
const DEFAULT_REF = 'main';
const DEFAULT_CATALOG_PATH = 'manifests/catalog.json';
const DEFAULT_MAX_ARTIFACT_BYTES = 512 * 1024 * 1024;
const MAX_CATALOG_BYTES = 2 * 1024 * 1024;
const SHA256_RE = /^[0-9a-f]{64}$/;

function assertSafeRef(ref: string): void {
  if (!ref || ref.includes('..') || ref.includes('\\') || ref.startsWith('/')) {
    throw new Error(`Unsafe corpus ref: ${ref}`);
  }
}

function assertSafeRepositoryPath(path: string): void {
  if (!path || path.startsWith('/') || path.includes('\\') || path.split('/').includes('..')) {
    throw new Error(`Unsafe corpus path: ${path}`);
  }
}

function encodePath(path: string): string {
  return path
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('SHA-256 verification requires Web Crypto');
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return bytesToHex(new Uint8Array(digest));
}

function assertAllowedManifestUrl(url: URL, owner: string, repo: string): void {
  if (url.protocol !== 'https:') throw new Error('Corpus URLs must use HTTPS');
  const prefix = `/${owner}/${repo}/`;
  if (url.hostname === 'raw.githubusercontent.com') {
    if (!url.pathname.startsWith(prefix)) throw new Error('Raw corpus URL points outside configured repository');
    return;
  }
  if (url.hostname === 'github.com') {
    if (!url.pathname.startsWith(`${prefix}releases/download/`)) {
      throw new Error('GitHub corpus URL is not a release asset in the configured repository');
    }
    return;
  }
  throw new Error(`Disallowed corpus host: ${url.hostname}`);
}

function assertAllowedFinalResponseUrl(urlText: string, owner: string, repo: string): void {
  if (!urlText) return;
  const url = new URL(urlText);
  if (url.hostname === 'objects.githubusercontent.com') return; // signed redirect from a validated GitHub release URL
  assertAllowedManifestUrl(url, owner, repo);
}

function parseCatalog(value: unknown, expectedRepository: string): CorpusCatalog {
  if (!value || typeof value !== 'object') throw new Error('Corpus catalog must be an object');
  const doc = value as Partial<CorpusCatalog>;
  if (doc.schemaVersion !== '1.0') throw new Error(`Unsupported corpus catalog schema: ${String(doc.schemaVersion)}`);
  if (doc.repository !== expectedRepository) {
    throw new Error(`Corpus catalog repository mismatch: ${String(doc.repository)}`);
  }
  if (typeof doc.corpusVersion !== 'string' || !doc.corpusVersion) throw new Error('Corpus catalog is missing corpusVersion');
  if (!Array.isArray(doc.datasets)) throw new Error('Corpus catalog is missing datasets');

  const ids = new Set<string>();
  for (const rawDataset of doc.datasets) {
    if (!rawDataset || typeof rawDataset !== 'object') throw new Error('Malformed corpus dataset entry');
    const dataset = rawDataset as CorpusDatasetManifest;
    if (typeof dataset.id !== 'string' || !dataset.id) throw new Error('Corpus dataset is missing id');
    if (ids.has(dataset.id)) throw new Error(`Duplicate corpus dataset id: ${dataset.id}`);
    ids.add(dataset.id);
    if (!Array.isArray(dataset.artifacts)) throw new Error(`Corpus dataset ${dataset.id} is missing artifacts`);
    for (const artifact of dataset.artifacts) {
      if (!artifact || typeof artifact !== 'object') throw new Error(`Malformed artifact for ${dataset.id}`);
      if (!SHA256_RE.test(artifact.sha256)) throw new Error(`Malformed SHA-256 for ${dataset.id}`);
      if ((artifact.path ? 1 : 0) + (artifact.url ? 1 : 0) !== 1) {
        throw new Error(`Artifact for ${dataset.id} must define exactly one of path or url`);
      }
      if (artifact.compression && artifact.compression !== 'none') {
        throw new Error(`Compressed artifact ${dataset.id}/${artifact.tier}/${artifact.role} is not directly ingestible`);
      }
    }
  }
  return doc as CorpusCatalog;
}

async function responseBytes(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = response.headers.get('content-length');
  if (declared) {
    const parsed = Number(declared);
    if (Number.isFinite(parsed) && parsed > maxBytes) {
      throw new Error(`Corpus artifact exceeds byte limit (${parsed} > ${maxBytes})`);
    }
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > maxBytes) {
    throw new Error(`Corpus artifact exceeds byte limit (${bytes.byteLength} > ${maxBytes})`);
  }
  return bytes;
}

/**
 * Read-only acquisition connector for the public nemosyne-data qualification corpus.
 *
 * This class intentionally does not extend DataConnector: qualification artifacts are
 * static, potentially very large inputs rather than row-normalized live updates. It
 * validates catalog and artifact identity, then hands raw bytes straight to the
 * existing Rust/WASM analytical loaders.
 */
export class GitHubCorpusConnector {
  readonly owner: string;
  readonly repo: string;
  readonly ref: string;
  readonly catalogPath: string;
  readonly catalogOverrideUrl: string | null;
  readonly maxArtifactBytes: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: GitHubCorpusConnectorOptions = {}) {
    this.owner = options.owner ?? DEFAULT_OWNER;
    this.repo = options.repo ?? DEFAULT_REPO;
    this.ref = options.ref ?? DEFAULT_REF;
    this.catalogPath = options.catalogPath ?? DEFAULT_CATALOG_PATH;
    this.catalogOverrideUrl = options.catalogUrl ?? null;
    this.maxArtifactBytes = options.maxArtifactBytes ?? DEFAULT_MAX_ARTIFACT_BYTES;
    this.fetchImpl = options.fetchImpl ?? fetch;
    if (!Number.isSafeInteger(this.maxArtifactBytes) || this.maxArtifactBytes <= 0) {
      throw new Error('maxArtifactBytes must be a positive safe integer');
    }
    assertSafeRef(this.ref);
    assertSafeRepositoryPath(this.catalogPath);
    if (this.catalogOverrideUrl) {
      assertAllowedManifestUrl(new URL(this.catalogOverrideUrl), this.owner, this.repo);
    }
  }

  get repository(): string {
    return `${this.owner}/${this.repo}`;
  }

  catalogUrl(): string {
    if (this.catalogOverrideUrl) return this.catalogOverrideUrl;
    return `https://raw.githubusercontent.com/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}/${encodePath(this.ref)}/${encodePath(this.catalogPath)}`;
  }

  async fetchCatalog(signal?: AbortSignal): Promise<CorpusCatalog> {
    const url = this.catalogUrl();
    const response = await this.fetchImpl(url, { signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Corpus catalog fetch failed: HTTP ${response.status}`);
    assertAllowedFinalResponseUrl(response.url, this.owner, this.repo);
    const bytes = await responseBytes(response, MAX_CATALOG_BYTES);
    let parsed: unknown;
    try {
      parsed = JSON.parse(new TextDecoder().decode(bytes));
    } catch (error) {
      throw new Error(`Corpus catalog JSON is invalid: ${error instanceof Error ? error.message : String(error)}`);
    }
    return parseCatalog(parsed, this.repository);
  }

  findDataset(catalog: CorpusCatalog, datasetId: string): CorpusDatasetManifest {
    const dataset = catalog.datasets.find((item) => item.id === datasetId);
    if (!dataset) throw new Error(`Unknown corpus dataset: ${datasetId}`);
    return dataset;
  }

  selectArtifact(
    catalog: CorpusCatalog,
    datasetId: string,
    tier: CorpusTier,
    role = 'primary',
  ): CorpusArtifactSelection {
    const dataset = this.findDataset(catalog, datasetId);
    const artifact = dataset.artifacts.find((item) => item.tier === tier && item.role === role);
    if (!artifact) {
      const planned = dataset.plannedTiers?.includes(tier) ? ' (tier is planned but not materialized)' : '';
      throw new Error(`No corpus artifact for ${datasetId}/${tier}/${role}${planned}`);
    }
    return { dataset, artifact, url: this.resolveArtifactUrl(artifact) };
  }

  resolveArtifactUrl(artifact: CorpusArtifact): string {
    if (artifact.path) {
      assertSafeRepositoryPath(artifact.path);
      return `https://raw.githubusercontent.com/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}/${encodePath(this.ref)}/${encodePath(artifact.path)}`;
    }
    if (!artifact.url) throw new Error('Corpus artifact has no location');
    const url = new URL(artifact.url);
    assertAllowedManifestUrl(url, this.owner, this.repo);
    return url.toString();
  }

  async fetchArtifactBytes(selection: CorpusArtifactSelection, signal?: AbortSignal): Promise<Uint8Array> {
    if (selection.artifact.bytes != null && selection.artifact.bytes > this.maxArtifactBytes) {
      throw new Error(`Corpus artifact exceeds byte limit (${selection.artifact.bytes} > ${this.maxArtifactBytes})`);
    }
    const response = await this.fetchImpl(selection.url, { signal });
    if (!response.ok) throw new Error(`Corpus artifact fetch failed: HTTP ${response.status}`);
    assertAllowedFinalResponseUrl(response.url, this.owner, this.repo);
    const bytes = await responseBytes(response, this.maxArtifactBytes);
    if (selection.artifact.bytes != null && bytes.byteLength !== selection.artifact.bytes) {
      throw new Error(`Corpus artifact byte-count mismatch (${bytes.byteLength} != ${selection.artifact.bytes})`);
    }
    const actualHash = await sha256Hex(bytes);
    if (actualHash !== selection.artifact.sha256) {
      throw new Error(`Corpus artifact SHA-256 mismatch for ${selection.dataset.id}/${selection.artifact.tier}/${selection.artifact.role}`);
    }
    return bytes;
  }

  async loadIntoKernel(kernel: AnalyticalKernelPort, request: CorpusLoadRequest): Promise<number> {
    const catalog = await this.fetchCatalog(request.signal);
    const selection = this.selectArtifact(catalog, request.datasetId, request.tier, request.role ?? 'primary');
    const bytes = await this.fetchArtifactBytes(selection, request.signal);
    switch (selection.artifact.format) {
      case 'csv':
        return kernel.loadCsv(bytes);
      case 'json':
        return kernel.loadJson(bytes);
      case 'ntc1': {
        if (!kernel.loadTypedColumns || kernel.supportsTypedColumnIngest?.() === false) {
          throw new Error('Kernel does not support NTC1 typed-column corpus ingest');
        }
        return kernel.loadTypedColumns(bytes, request.name ?? selection.dataset.label);
      }
      default: {
        const neverFormat: never = selection.artifact.format;
        throw new Error(`Unsupported corpus format: ${String(neverFormat)}`);
      }
    }
  }
}
