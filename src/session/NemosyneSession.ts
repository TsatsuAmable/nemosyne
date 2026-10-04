/**
 * NemosyneSession — the authoritative logical session.
 *
 * Wave 4: snapshot authority moves here from WorldSessionController. The
 * schemaVersion-2 JSON persists the AtlasCore state plus presentation state.
 */

import type { EncodingMapping } from '../data/types.ts';
import {
  CANONICAL_DATASET_IDENTITY_ALGORITHM,
  canonicalDatasetIdentityHex,
} from '../data/DatasetIdentity.ts';
import { AtlasCore } from '../atlas/AtlasCore.ts';
import type { AnalysisSpec, AtlasCoreState, ResearchContext } from '../atlas/types.ts';
import {
  GOVERNED_INVESTIGATION_DIGEST_ALGORITHM,
  INVESTIGATION_DIGEST_ALGORITHM,
  NoFeasibleRepresentationStore,
  type NoFeasibleRepresentationRecord,
  type NoFeasibleRepresentationStoreSnapshot,
} from '../investigation/index.ts';
import {
  NEMOSYNE_PACKAGE_FORMAT_VERSION,
  GOVERNED_NEMOSYNE_PACKAGE_FORMAT_VERSION,
  FORMA_PACKAGE_FORMAT_VERSION,
  NemosynePackageManager,
  type NemosynePackageManifest,
} from './NemosynePackage.ts';
import { sha256Hex } from '../security/CryptoHash.ts';
import {
  parsePersistedEvidenceReceiptsV1,
  type PersistedEvidenceReceiptsV1,
} from '../data/evidence/PersistedEvidenceReceipts.ts';
import { bindConsumerUsesV1, governedConsumerPolicyV1 } from '../data/evidence/index.ts';
import { strToU8 } from 'fflate';

export interface PresentationState {
  camera: { position: [number, number, number]; rotationY: number };
  settings: Record<string, unknown>;
  tour: { stepIndex: number; finished: boolean };
  theme: string;
  uiTreatmentVersion?: string;
  panelPositions: Array<unknown>;
  entry: { name: string; topology?: string; encodings?: EncodingMapping; maxDepth?: number };
  /**
   * RF-025: durable focus/context snapshot for the Memory Palace. Camera pose
   * is intentionally excluded (presentation state, not investigation state);
   * only the semantic level + focused structure identity are portable.
   */
  focus?: { currentLevel: string; focusedStructureId: string | null };
}

export interface PortablePackageEnvironment {
  userAgent?: string | null;
  platform?: string | null;
  webxrSupported?: boolean | null;
  /**
   * Ordinary product exports omit browser identity because userAgent/platform
   * are privacy-sensitive fingerprinting surfaces. Study/diagnostic workflows
   * may opt in only when their consent/provenance contract explicitly requires it.
   */
  includePrivacySensitiveBrowserIdentity?: boolean;
}

export interface NemosyneSessionJSON extends AtlasCoreState {
  schemaVersion: 2;
  savedAt: number;
  /**
   * Stable logical investigation/session identity. Optional only for backward
   * compatibility with schema-v2 snapshots written before identity was included.
   */
  sessionId?: string;
  entry: PresentationState['entry'];
  analysisSpecs: AnalysisSpec[];
  presentation: PresentationState;
  nilOutcomes?: NoFeasibleRepresentationStoreSnapshot;
  /**
   * RFC 0009 tranche 2: base64 of the exact closed persisted evidence-receipt
   * envelope bytes captured from the Rust kernel for the analytical dataset
   * this snapshot commits. Optional and additive; presence alone establishes
   * preservation, not consumer-policy enforcement, and malformed carriers are
   * rejected at load instead of silently dropped.
   */
  evidenceReceiptSnapshot?: string;
  /**
   * DM-4 / FMA-09: base64 of the exact closed investigation/forma.json entry bytes.
   */
  formaInvestigationSnapshot?: string;
}

export interface GovernedPortableExportOptions {
  /**
   * RFC 0009 tranche 2: when true, the export must produce a governed V3
   * package from a Rust-issued receipt bundle, or throw. Identity incoherence
   * never silently downgrades to V2.
   */
  governedEvidence?: boolean;
  /**
   * DM-4 / FMA-09: when true or when formaInvestigationBytes are provided,
   * export a V4 package containing investigation/forma.json.
   */
  formaPreservation?: boolean;
  formaInvestigationBytes?: Uint8Array;
}

function base64Encode(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function base64Decode(encoded: string): Uint8Array {
  if (typeof encoded !== 'string') {
    throw new Error('[NemosyneSession] evidence receipt snapshot must be a base64 string');
  }
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/** Decodes and structurally validates a persisted evidence-receipt carrier. */
function decodePersistedEvidenceReceiptSnapshot(encoded: string): {
  bytes: Uint8Array;
  datasetFingerprint: string;
} {
  const bytes = base64Decode(encoded);
  const envelope = parsePersistedEvidenceReceiptsV1(
    JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  );
  // The identity the carrier attests travels with its bytes: serialization must
  // be able to tell whether it still describes the committed dataset without
  // re-parsing the envelope on every save.
  return { bytes, datasetFingerprint: envelope.bundle.datasetFingerprint };
}

export class NemosyneSession {
  private _atlas: AtlasCore;
  private _sessionId: string;
  private _presentation: PresentationState;
  private _researchContext: ResearchContext;
  private _nilOutcomes = new NoFeasibleRepresentationStore();
  private _evidenceReceiptBytes: Uint8Array | null = null;
  /**
   * The analytical dataset identity the carrier above attests, or null when
   * there is no carrier. Kept beside the bytes so {@link serialize} can decide
   * whether they still describe the state it is about to commit without parsing
   * the envelope on every save.
   */
  private _evidenceReceiptIdentity: string | null = null;
  private _formaInvestigationBytes: Uint8Array | null = null;

  constructor({ atlas, sessionId }: { atlas: AtlasCore; sessionId?: string }) {
    this._atlas = atlas;
    this._sessionId = sessionId ?? atlas.sessionId;
    this._presentation = {
      camera: { position: [0, 0, 0], rotationY: 0 },
      settings: {},
      tour: { stepIndex: 0, finished: true },
      theme: 'neonMidnight',
      panelPositions: [],
      entry: { name: 'dataset' },
    };
    this._researchContext = {};
  }

  get atlas(): AtlasCore { return this._atlas; }
  get sessionId(): string { return this._sessionId; }
  get presentation(): PresentationState { return this._presentation; }
  get researchContext(): ResearchContext { return this._researchContext; }
  get nilOutcomes(): readonly NoFeasibleRepresentationRecord[] { return this._nilOutcomes.all(); }

  setResearchContext(ctx: Partial<ResearchContext>): void {
    this._researchContext = { ...this._researchContext, ...ctx };
  }

  recordNoFeasibleRepresentation(record: NoFeasibleRepresentationRecord): void {
    this._nilOutcomes.record(record);
  }

  recordObservation(observation: string): void { this._atlas.recordObservation(observation); }
  recordIntervention(intervention: string): void { this._atlas.recordIntervention(intervention); }

  setPresentation(partial: Partial<PresentationState>): void {
    if (partial.camera) this._presentation.camera = partial.camera as PresentationState['camera'];
    if (partial.settings) this._presentation.settings = partial.settings;
    if (partial.tour) this._presentation.tour = partial.tour as PresentationState['tour'];
    if (partial.theme) this._presentation.theme = partial.theme;
    if (partial.uiTreatmentVersion) this._presentation.uiTreatmentVersion = partial.uiTreatmentVersion;
    if (partial.panelPositions) this._presentation.panelPositions = partial.panelPositions;
    if (partial.entry) this._presentation.entry = partial.entry as PresentationState['entry'];
    if (partial.focus) this._presentation.focus = partial.focus;
  }

  get formaInvestigationBytes(): Uint8Array | null { return this._formaInvestigationBytes; }
  setFormaInvestigationBytes(bytes: Uint8Array | null): void { this._formaInvestigationBytes = bytes; }

  private _formaInvestigationSnapshotBase64(): string | undefined {
    return this._formaInvestigationBytes ? base64Encode(this._formaInvestigationBytes) : undefined;
  }

  private _restoreFormaInvestigationSnapshot(json: NemosyneSessionJSON): void {
    this._formaInvestigationBytes = json.formaInvestigationSnapshot
      ? base64Decode(json.formaInvestigationSnapshot)
      : null;
  }

  serialize(): NemosyneSessionJSON {
    const core = this._atlas.toState();
    // The same analytical identity the governed export validates a carrier
    // against, so serialization and export cannot disagree about which dataset
    // the carrier describes.
    const committedAnalyticalFingerprint =
      core.datasetFingerprint ??
      (core.originalDataset ? canonicalDatasetIdentityHex(core.originalDataset) : null);
    const evidenceReceiptSnapshot = this._governedEvidenceSnapshotBase64(
      committedAnalyticalFingerprint
    );
    const formaInvestigationSnapshot = this._formaInvestigationSnapshotBase64();
    return {
      schemaVersion: 2,
      savedAt: (typeof Date !== 'undefined' && Date.now) ? Date.now() : 0,
      sessionId: this._sessionId,
      datasetVersion: core.datasetVersion,
      datasetFingerprint: core.datasetFingerprint,
      originalDataset: core.originalDataset,
      currentDataset: core.currentDataset,
      entry: this._presentation.entry,
      datasetSpace: core.datasetSpace,
      analysisHistory: core.analysisHistory,
      analysisSpecs: core.analysisResults.map((r) => r.spec),
      analysisResults: core.analysisResults,
      eventLedger: core.eventLedger,
      activeRecommendation: core.activeRecommendation,
      decisionHistory: core.decisionHistory,
      structures: core.structures,
      observations: core.observations,
      findings: core.findings,
      annotations: core.annotations,
      investigationGraph: core.investigationGraph,
      representationDecision: core.representationDecision,
      discoveryEpisodes: core.discoveryEpisodes,
      nilOutcomes: this._nilOutcomes.toJSON(),
      researchContext: this._researchContext,
      presentation: this._presentation,
      ...(evidenceReceiptSnapshot === null
        ? {}
        : { evidenceReceiptSnapshot }),
      ...(formaInvestigationSnapshot === undefined
        ? {}
        : { formaInvestigationSnapshot }),
    };
  }

  /**
   * Serialize the receipt carrier this session already holds: one restored from
   * a persisted snapshot, or one acquired by a governed export on this session
   * (see {@link exportPortablePackage}).
   *
   * Issue #834, record item (4) in `docs/ROADMAP.md`: serialization is a pure
   * snapshot operation. It performs no analytical work and acquires nothing — it never
   * reaches a kernel, a port, or a module-global bridge. Acquisition is
   * asynchronous and happens in exactly one place, the governed export, so
   * there is no second authority that could attest a state this session is not
   * in. A session that has neither restored nor captured a carrier serializes
   * without one, and a governed export of it fails closed rather than
   * manufacturing evidence.
   *
   * `committedFingerprint` is the analytical identity the snapshot is about to
   * commit. A carrier captured for some *other* dataset is omitted rather than
   * persisted beside a fingerprint it does not describe: a capture is only ever
   * adopted for the state that validated it, but the dataset can move on
   * afterwards, and a snapshot that pairs evidence for dataset A with the
   * identity of dataset B corrupts the artifact for the replay loader that will
   * read it (RFC 0009 tranche 3). This is an identity comparison over bytes the
   * session already holds — no parse of a foreign source, no acquisition.
   */
  private _governedEvidenceSnapshotBase64(committedFingerprint: string | null): string | null {
    const bytes = this._evidenceReceiptBytes;
    if (bytes === null || this._evidenceReceiptIdentity !== committedFingerprint) {
      return null;
    }
    return base64Encode(bytes);
  }

  private _restoreEvidenceReceiptSnapshot(json: NemosyneSessionJSON): void {
    const encoded = json.evidenceReceiptSnapshot;
    if (encoded === undefined) {
      this._evidenceReceiptBytes = null;
      this._evidenceReceiptIdentity = null;
      return;
    }
    const restored = decodePersistedEvidenceReceiptSnapshot(encoded);
    this._evidenceReceiptBytes = restored.bytes;
    this._evidenceReceiptIdentity = restored.datasetFingerprint;
  }

  /**
   * RFC 0009 tranche 3 slice 2: an export may commit `uses` only when they
   * bind under the authority-owned policy against this very bundle. This is
   * literally the same test the replay loader applies at its binding step —
   * `bindConsumerUsesV1` over the live authority policy, with the loader's
   * wider-than-"not BOUND" predicate: identity agreement alone does not
   * suffice, the receipt must also resolve under its recorded profile. Running
   * the binder here (rather than a hand-rolled subset) is what keeps a carrier
   * restored from foreign bytes from being re-exported as a package this
   * build's own loader would refuse. It is not duplication-without-purport:
   * the loader test runs over committed package bytes; this one runs over
   * bytes we are about to commit. Consumers that the current policy governs
   * but that no use names are refused for the same reason ("emptiness cannot
   * bypass policy").
   */
  private _validateGovernedUseRecords(envelope: PersistedEvidenceReceiptsV1): void {
    const bindings = bindConsumerUsesV1({
      envelope,
      requiredConsumers: governedConsumerPolicyV1(),
    });
    for (const binding of bindings) {
      if (binding.status === 'BOUND' && binding.resolution.status === 'RESOLVED') {
        continue;
      }
      if (binding.status === 'MISSING_USE') {
        throw new Error(
          'Governed evidence export refuses an envelope that leaves a governed consumer without any consumer-use assertion'
        );
      }
      throw new Error(
        'Governed evidence export refuses consumer-use assertions that fail to bind under the authority-owned policy (an ungoverned consumer, a profile disagreement, an unresolvable profile, a receipt absent from the bundle, or a receipt that does not resolve under the recorded profile)'
      );
    }
  }

  async exportPortablePackage(
    environment: PortablePackageEnvironment = {},
    kernelVersionOverride?: string,
    governedOptions?: GovernedPortableExportOptions,
  ): Promise<Uint8Array> {
    const core = this._atlas.toState();
    if (!core.originalDataset) {
      throw new Error('Cannot export portable investigation without an original dataset');
    }

    const originalDataset = this._atlas.originalDataset;
    const originalDatasetFingerprint = canonicalDatasetIdentityHex(core.originalDataset);
    const representationDecision = core.representationDecision;
    const discoveryEpisodes = core.discoveryEpisodes;
    const nilOutcomes = this._nilOutcomes.toJSON();
    const nilProvenance = nilOutcomes.outcomes[0]?.provenance;
    const fitnessModelVersion =
      representationDecision?.fitnessModelVersion ??
      representationDecision?.provenance.fitnessModelVersion;
    const kernelVersion = kernelVersionOverride ?? this._atlas.kernelVersion() ?? 'unknown';

    // RFC 0009 tranche 2: governed export is fail-closed. The declared
    // analytical identity is the captured Rust bundle identity, and the
    // receipt bytes must be coherent with the semantic state this package
    // commits; any mismatch refuses instead of silently downgrading to V2.
    let evidenceReceiptBytes: Uint8Array | undefined;
    let governedBundleIdentity: { datasetFingerprint: string; kernelVersion: string } | null = null;
    if (
      governedOptions !== undefined &&
      governedOptions.governedEvidence !== undefined &&
      typeof governedOptions.governedEvidence !== 'boolean'
    ) {
      // A truthy non-boolean must not silently downgrade the export to V2.
      throw new Error('Governed evidence export requires a boolean governedEvidence option');
    }
    if (governedOptions?.governedEvidence === true) {
      const acquisition = await this._requireGovernedEvidenceBytes();
      evidenceReceiptBytes = acquisition.bytes;
      const envelope = parsePersistedEvidenceReceiptsV1(
        JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(evidenceReceiptBytes))
      );
      // RFC 0009 tranche 3 slice 2: the producer-side refusal lifts together
      // with the producer. A live capture mints its uses in envelope
      // composition, from the kernel-issued governed-consumer attestation and
      // the authority-owned policy; a restored carrier carries the uses its
      // own capture minted. Either way, the uses the export is about to
      // commit must bind under the current authority policy against this
      // bundle — otherwise the export would write a package its own replay
      // loader refuses (unknown consumer, wrong profile, dangling receipt, or
      // a governed consumer left unnamed), so an envelope that cannot be
      // exported on governing terms fails closed here.
      this._validateGovernedUseRecords(envelope);
      if (
        kernelVersionOverride !== undefined &&
        kernelVersionOverride !== envelope.bundle.kernelVersion
      ) {
        throw new Error(
          'Governed evidence export refuses a kernel-version override that differs from the captured receipt bundle identity'
        );
      }
      const currentAnalyticalFingerprint =
        core.datasetFingerprint ?? canonicalDatasetIdentityHex(core.originalDataset);
      if (envelope.bundle.datasetFingerprint !== currentAnalyticalFingerprint) {
        throw new Error(
          'Governed evidence export refuses a receipt bundle captured from a different analytical dataset state'
        );
      }
      governedBundleIdentity = {
        datasetFingerprint: envelope.bundle.datasetFingerprint,
        kernelVersion: envelope.bundle.kernelVersion,
      };
      if (acquisition.live) {
        // The identity checks above accepted this live capture for this
        // package's committed state, so it is now this session's carrier:
        // ordinary serialization carries it later without acquiring anything
        // itself (#834 record item (4)). Its attested identity is recorded with
        // it, so a later serialization after the dataset moves on omits it
        // rather than committing evidence that describes a superseded state.
        this._evidenceReceiptBytes = acquisition.bytes;
        this._evidenceReceiptIdentity = governedBundleIdentity.datasetFingerprint;
      }
    }

    const investigationDigest = await this._atlas.aggregate.computeDigest(
      governedBundleIdentity ? governedBundleIdentity.kernelVersion : kernelVersion,
      {
        nilOutcomes: nilOutcomes.outcomes,
        researchContext: this._researchContext,
        ...(evidenceReceiptBytes === undefined
          ? {}
          : { evidenceReceiptBytes }),
      },
    );
    const includeBrowserIdentity = environment.includePrivacySensitiveBrowserIdentity === true;
    const portableEnvironment: NemosynePackageManifest['environment'] = {
      userAgent: includeBrowserIdentity ? environment.userAgent ?? null : null,
      platform: includeBrowserIdentity ? environment.platform ?? null : null,
      webxrSupported: environment.webxrSupported ?? null,
    };

    let formaInvestigationBytes: Uint8Array | undefined;
    if (governedOptions?.formaPreservation === true || governedOptions?.formaInvestigationBytes !== undefined) {
      formaInvestigationBytes = governedOptions.formaInvestigationBytes ?? this._formaInvestigationBytes ?? undefined;
      if (!formaInvestigationBytes) {
        throw new Error('Forma preservation export requires formaInvestigationBytes; none is available for this session');
      }
    }

    const isV4 = formaInvestigationBytes !== undefined;
    const formatVersion = isV4
      ? FORMA_PACKAGE_FORMAT_VERSION
      : (governedBundleIdentity
        ? GOVERNED_NEMOSYNE_PACKAGE_FORMAT_VERSION
        : NEMOSYNE_PACKAGE_FORMAT_VERSION);

    const manifest: NemosynePackageManifest = {
      formatVersion,
      sessionId: this._sessionId,
      datasetFingerprint: originalDatasetFingerprint,
      datasetIdentityAlgorithm: CANONICAL_DATASET_IDENTITY_ALGORITHM,
      analyticalDatasetFingerprint: (governedBundleIdentity || isV4)
        ? (governedBundleIdentity?.datasetFingerprint ?? originalDatasetFingerprint)
        : (representationDecision?.datasetFingerprint ??
          nilProvenance?.datasetFingerprint ??
          core.datasetFingerprint ??
          originalDatasetFingerprint),
      datasetName: originalDataset.name,
      kernelVersion,
      analyticalKernelVersion: (governedBundleIdentity || isV4)
        ? (governedBundleIdentity?.kernelVersion ?? kernelVersion)
        : (representationDecision?.kernelVersion ?? nilProvenance?.kernelVersion),
      createdAt: typeof Date !== 'undefined' && Date.now ? Date.now() : 0,
      commandCount: core.eventLedger.length,
      discoveryCount: discoveryEpisodes?.episodes.length ?? 0,
      nilOutcomeCount: nilOutcomes.outcomes.length,
      investigationDigest,
      investigationDigestAlgorithm: (governedBundleIdentity || isV4)
        ? GOVERNED_INVESTIGATION_DIGEST_ALGORITHM
        : INVESTIGATION_DIGEST_ALGORITHM,
      ...(evidenceReceiptBytes !== undefined
        ? { evidenceReceiptDigest: sha256Hex(evidenceReceiptBytes) }
        : {}),
      ...(formaInvestigationBytes !== undefined
        ? { formaDigest: sha256Hex(formaInvestigationBytes) }
        : {}),
      researchContext: this._researchContext,
      representationModel:
        representationDecision && fitnessModelVersion
          ? {
              fitnessModelVersion,
              fitnessModelArtifactHash:
                representationDecision.fitnessModelArtifactHash ??
                representationDecision.provenance.fitnessModelArtifactHash ??
                null,
            }
          : undefined,
      evidenceSummary: {
        observationsCount: core.observations?.length ?? 0,
        findingsCount: core.findings?.length ?? 0,
        annotationsCount: core.annotations?.length ?? 0,
      },
      environment: portableEnvironment,
    };

    return NemosynePackageManager.pack({
      manifest,
      datasetBytes: strToU8(JSON.stringify(core.originalDataset)),
      commandLogBytes: strToU8(JSON.stringify(core.eventLedger)),
      representationDecisionBytes: representationDecision
        ? strToU8(JSON.stringify(representationDecision))
        : undefined,
      discoveryEpisodesBytes:
        discoveryEpisodes && discoveryEpisodes.episodes.length > 0
          ? strToU8(JSON.stringify(discoveryEpisodes))
          : undefined,
      nilOutcomesBytes:
        nilOutcomes.outcomes.length > 0 ? strToU8(JSON.stringify(nilOutcomes)) : undefined,
      ...(evidenceReceiptBytes === undefined
        ? {}
        : { evidenceReceiptBytes }),
      ...(formaInvestigationBytes === undefined
        ? {}
        : { formaInvestigationBytes }),
    });
  }

  /**
   * Governed export requires Rust-issued receipt bytes, acquired by awaiting
   * the analytical execution port (issue #834). A restored carrier may still
   * satisfy the request when no port can attest evidence for this state — the
   * clean-room replay case, where no live kernel holds the archived dataset —
   * and the resolved bytes are always re-validated against the committed
   * analytical state by the caller, so a carrier that disagrees with this
   * package's dataset refuses instead of exporting.
   *
   * `live` reports whether these bytes came from the port rather than from a
   * restored carrier. The caller adopts a live capture as this session's
   * carrier, but only after the coherence checks pass — a capture the export
   * rejects must not be remembered, or a later serialization would carry
   * evidence for a state this session is not in.
   */
  private async _requireGovernedEvidenceBytes(): Promise<{ bytes: Uint8Array; live: boolean }> {
    let bytes: Uint8Array | null = null;
    try {
      bytes = (await this._atlas.captureGovernedEvidenceReceipt())?.bytes ?? null;
    } catch {
      // A drifted live capture does not silently satisfy the governed request
      // with unvalidated bytes: the identity coherence checks below reject any
      // carrier (restored or captured) that disagrees with the committed state.
      //
      // This catch is deliberately wider than drift. A port that *throws*
      // (disposed, saturated, transport failure, identity mismatch) is a real
      // fault, and swallowing it here means a governed export falls back to a
      // restored carrier instead of surfacing the fault. That is accepted
      // because #834 record item (5) sanctions exactly this fallback, and the
      // fallback is still fully validated below — so the failure mode is a
      // quieter signal, not a weaker admission rule. If acquisition faults ever
      // need to be observable, record them here rather than narrowing the catch.
    }
    const resolved = bytes ?? this._evidenceReceiptBytes;
    if (!resolved) {
      throw new Error(
        'Governed evidence export requires a Rust-issued statistics evidence receipt bundle; none is available for this session'
      );
    }
    return { bytes: resolved, live: bytes !== null };
  }

  /** Export a persisted snapshot in isolation from the mutable live Atlas/session. */
  static async exportPortableSnapshot(
    json: NemosyneSessionJSON,
    environment: PortablePackageEnvironment = {},
    replayKernelVersionOverride?: string,
    governedOptions?: GovernedPortableExportOptions,
  ): Promise<Uint8Array> {
    const atlas = new AtlasCore({ kernel: null });
    const session = NemosyneSession.deserialize(json, atlas);
    const lastImplementationVersion = [...json.analysisResults]
      .reverse()
      .find((result) => typeof result.implementationVersion === 'string')
      ?.implementationVersion;
    const archivedKernelVersion =
      json.representationDecision?.kernelVersion ?? lastImplementationVersion ?? 'unknown';
    return session.exportPortablePackage(
      environment,
      replayKernelVersionOverride ?? archivedKernelVersion,
      governedOptions,
    );
  }

  loadFromJSON(json: NemosyneSessionJSON): void {
    this._restoreEvidenceReceiptSnapshot(json);
    this._restoreFormaInvestigationSnapshot(json);
    this._atlas.restoreState(json);
    if (typeof json.sessionId === 'string' && json.sessionId.length > 0) {
      this._sessionId = json.sessionId;
    }
    this._nilOutcomes.reset();
    if (json.nilOutcomes) this._nilOutcomes.restore(json.nilOutcomes);
    this._presentation = {
      camera: json.presentation?.camera ?? { position: [0, 0, 0], rotationY: 0 },
      settings: json.presentation?.settings ?? {},
      tour: json.presentation?.tour ?? { stepIndex: 0, finished: true },
      theme: json.presentation?.theme ?? 'neonMidnight',
      uiTreatmentVersion: json.presentation?.uiTreatmentVersion,
      panelPositions: json.presentation?.panelPositions ?? [],
      entry: json.entry ?? json.presentation?.entry ?? { name: 'dataset' },
      focus: json.presentation?.focus,
    };
    this._researchContext = json.researchContext ?? {};
  }

  static deserialize(json: NemosyneSessionJSON, atlas: AtlasCore): NemosyneSession {
    atlas.restoreState(json);
    const sessionId = typeof json.sessionId === 'string' && json.sessionId.length > 0
      ? json.sessionId
      : undefined;
    const session = new NemosyneSession({ atlas, sessionId });
    session._restoreEvidenceReceiptSnapshot(json);
    session._restoreFormaInvestigationSnapshot(json);
    if (json.nilOutcomes) session._nilOutcomes.restore(json.nilOutcomes);
    session._presentation = {
      camera: json.presentation?.camera ?? { position: [0, 0, 0], rotationY: 0 },
      settings: json.presentation?.settings ?? {},
      tour: json.presentation?.tour ?? { stepIndex: 0, finished: true },
      theme: json.presentation?.theme ?? 'neonMidnight',
      uiTreatmentVersion: json.presentation?.uiTreatmentVersion,
      panelPositions: json.presentation?.panelPositions ?? [],
      entry: json.entry ?? json.presentation?.entry ?? { name: 'dataset' },
      focus: json.presentation?.focus,
    };
    session._researchContext = json.researchContext ?? {};
    return session;
  }
}
