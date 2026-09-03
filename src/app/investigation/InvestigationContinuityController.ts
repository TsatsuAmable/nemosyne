import { strFromU8, strToU8 } from 'fflate';
import { AtlasCore } from '../../atlas/AtlasCore.ts';
import { canonicalDatasetIdentityHex } from '../../data/DatasetIdentity.ts';
import { canonicalJsonStringify } from '../../investigation/index.ts';
import type { ReplayVerificationResult } from '../../session/InvestigationReplayRunner.ts';
import { NemosynePackageManager, type NemosynePackageManifest } from '../../session/NemosynePackage.ts';
import {
  NemosyneSession,
  type NemosyneSessionJSON,
  type PortablePackageEnvironment,
} from '../../session/NemosyneSession.ts';
import type { ArchiveEntry, VaultArchiveStore } from '../../session/VaultArchiveStore.ts';

const CONTINUITY_SNAPSHOT_PATH = 'continuity/session-v2.json';
const MANUAL_SAVE_ID = 'manual';
const AUTOSAVE_ID = 'autosave';

export interface ContinuitySessionController {
  snapshotCurrentSession(): Record<string, unknown> | null;
  saveSession(id?: string): Promise<void>;
  saveSessionChecked?(id?: string): Promise<boolean>;
  hasSession?(id: string): Promise<boolean>;
  restoreSnapshot(snapshot: NemosyneSessionJSON): Promise<boolean>;
  restoreAutoSave(): Promise<unknown>;
  archiveStore: Pick<
    VaultArchiveStore,
    'freezeInvestigation' | 'listArchives' | 'loadArchive' | 'deleteArchive'
  >;
}

export interface InvestigationContinuityControllerOptions {
  sessionController: ContinuitySessionController;
  verifyPortableInvestigation(bytes: Uint8Array): Promise<ReplayVerificationResult>;
  environment?(): PortablePackageEnvironment;
}

export interface PortableOpenResult {
  verification: ReplayVerificationResult;
  reopened: boolean;
  resumable: boolean;
  message: string;
}

export interface ContinuitySummary {
  checkpointCount: number;
  latestCheckpoint: ArchiveEntry | null;
  canRecoverAutosave: boolean | null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asSnapshot(value: unknown): NemosyneSessionJSON {
  if (!isObject(value) || value.schemaVersion !== 2) {
    throw new Error('The resumable investigation snapshot is not a supported session-v2 document.');
  }
  if (!isObject(value.originalDataset)) {
    throw new Error('The resumable investigation snapshot has no original dataset.');
  }
  if (!Array.isArray(value.eventLedger)) {
    throw new Error('The resumable investigation snapshot has no valid evidence event ledger.');
  }
  if (!Array.isArray(value.analysisResults)) {
    throw new Error('The resumable investigation snapshot has no valid analysis-result history.');
  }
  return value as unknown as NemosyneSessionJSON;
}

function snapshotKernelVersion(snapshot: NemosyneSessionJSON): string {
  const decisionVersion = snapshot.representationDecision?.kernelVersion;
  if (typeof decisionVersion === 'string' && decisionVersion.length > 0) return decisionVersion;
  const lastImplementationVersion = [...snapshot.analysisResults]
    .reverse()
    .find((result) => typeof result.implementationVersion === 'string')
    ?.implementationVersion;
  return lastImplementationVersion ?? 'unknown';
}

function discoveryCount(snapshot: NemosyneSessionJSON): number {
  const store = snapshot.discoveryEpisodes as unknown;
  if (!isObject(store) || !Array.isArray(store.episodes)) return 0;
  return store.episodes.length;
}

function datasetName(snapshot: NemosyneSessionJSON): string {
  const original = snapshot.originalDataset as unknown;
  if (isObject(original) && typeof original.name === 'string' && original.name.trim()) {
    return original.name.trim();
  }
  return snapshot.entry?.name?.trim() || 'Investigation dataset';
}

async function investigationDigestForSnapshot(snapshot: NemosyneSessionJSON): Promise<string> {
  const atlas = new AtlasCore({ kernel: null, sessionId: snapshot.sessionId });
  const session = NemosyneSession.deserialize(snapshot, atlas);
  return atlas.aggregate.computeDigest(snapshotKernelVersion(snapshot), {
    nilOutcomes: [...session.nilOutcomes],
    researchContext: session.researchContext,
  });
}

function researchContextMatches(
  snapshot: NemosyneSessionJSON,
  manifest: NemosynePackageManifest,
): boolean {
  if (!manifest.researchContext) return true;
  return canonicalJsonStringify(snapshot.researchContext ?? {}) ===
    canonicalJsonStringify(manifest.researchContext);
}

/**
 * PT5D application authority for local investigation continuity.
 *
 * It coordinates existing persistence/replay authorities; it does not own
 * analytical truth, package format semantics or a second storage backend.
 */
export class InvestigationContinuityController {
  private readonly sessions: ContinuitySessionController;
  private readonly verifyPortableInvestigation: InvestigationContinuityControllerOptions['verifyPortableInvestigation'];
  private readonly environment: () => PortablePackageEnvironment;

  constructor(options: InvestigationContinuityControllerOptions) {
    this.sessions = options.sessionController;
    this.verifyPortableInvestigation = options.verifyPortableInvestigation;
    this.environment = options.environment ?? (() => ({}));
  }

  captureCurrent(): NemosyneSessionJSON {
    const snapshot = this.sessions.snapshotCurrentSession();
    if (!snapshot) throw new Error('There is no active investigation to save.');
    return asSnapshot(snapshot);
  }

  async saveNow(): Promise<void> {
    if (this.sessions.saveSessionChecked) {
      const saved = await this.sessions.saveSessionChecked(MANUAL_SAVE_ID);
      if (!saved) throw new Error('The current investigation could not be saved.');
      return;
    }
    await this.sessions.saveSession(MANUAL_SAVE_ID);
  }

  async summary(): Promise<ContinuitySummary> {
    const archives = await this.sessions.archiveStore.listArchives();
    const canRecoverAutosave = this.sessions.hasSession
      ? await this.sessions.hasSession(AUTOSAVE_ID)
      : null;
    return {
      checkpointCount: archives.length,
      latestCheckpoint: archives.at(-1) ?? null,
      canRecoverAutosave,
    };
  }

  async createCheckpoint(label = 'Investigation checkpoint'): Promise<ArchiveEntry> {
    const snapshot = this.captureCurrent();
    const digest = await investigationDigestForSnapshot(snapshot);
    const archiveId = await this.sessions.archiveStore.freezeInvestigation(
      label,
      snapshot as unknown as Record<string, unknown>,
      {
        datasetFingerprint: canonicalDatasetIdentityHex(snapshot.originalDataset!),
        datasetName: datasetName(snapshot),
        investigationDigest: digest,
        eventCount: snapshot.eventLedger.length,
        discoveryCount: discoveryCount(snapshot),
      },
    );
    const archives = await this.sessions.archiveStore.listArchives();
    const created = archives.find((entry) => entry.archiveId === archiveId);
    if (!created) throw new Error('The checkpoint was saved but its Vault index entry is unavailable.');
    return created;
  }

  async restoreLatestCheckpoint(): Promise<ArchiveEntry> {
    const archives = await this.sessions.archiveStore.listArchives();
    const latest = archives.at(-1);
    if (!latest) throw new Error('No saved checkpoint is available to restore.');
    const raw = await this.sessions.archiveStore.loadArchive(latest.archiveId);
    if (!raw) throw new Error('The latest checkpoint is missing from local storage.');
    await this.restoreWithRollback(asSnapshot(raw), 'checkpoint');
    return latest;
  }

  async recoverAutosave(): Promise<boolean> {
    if (this.sessions.hasSession && !(await this.sessions.hasSession(AUTOSAVE_ID))) return false;
    const previous = this.safeCaptureCurrent();
    const restored = await this.sessions.restoreAutoSave();
    if (restored === true) return true;
    if (previous) {
      await this.sessions.restoreSnapshot(previous).catch(() => false);
    }
    return false;
  }

  async exportCurrent(): Promise<Uint8Array> {
    return this.exportSnapshot(this.captureCurrent());
  }

  async exportCheckpoint(archiveId: string): Promise<Uint8Array> {
    const raw = await this.sessions.archiveStore.loadArchive(archiveId);
    if (!raw) throw new Error('The selected checkpoint is no longer available.');
    return this.exportSnapshot(asSnapshot(raw));
  }

  async openPortable(bytes: Uint8Array): Promise<PortableOpenResult> {
    // Clean-room replay is deliberately first. No current product state has
    // been mutated when this returns a refusal or throws on malformed input.
    const verification = await this.verifyPortableInvestigation(bytes);
    if (!verification.success) {
      return {
        verification,
        reopened: false,
        resumable: false,
        message: `Verification failed: ${verification.discrepancies.join('; ') || 'investigation evidence did not replay exactly'}`,
      };
    }

    const payload = NemosynePackageManager.unpack(bytes);
    const snapshotBytes = payload.extraFiles?.[CONTINUITY_SNAPSHOT_PATH];
    if (!snapshotBytes) {
      return {
        verification,
        reopened: false,
        resumable: false,
        message: 'Investigation verified. This older package can be replayed but does not contain resumable workspace state.',
      };
    }

    const verifiedSnapshot = await this.verifyEmbeddedSnapshot(snapshotBytes, payload.manifest);
    // A portable investigation may come from another researcher/device. Local
    // settings include privacy, comfort and runtime preferences, so the file
    // must not silently overwrite them. Investigation-local camera/theme/focus
    // still travel; device-local settings stay with the recipient runtime.
    const snapshot = this.withCurrentDeviceSettings(verifiedSnapshot);
    await this.restoreWithRollback(snapshot, '.nemosyne package');
    return {
      verification,
      reopened: true,
      resumable: true,
      message: `Investigation opened and verified (${verification.eventsMatched} evidence events).`,
    };
  }

  private async exportSnapshot(snapshot: NemosyneSessionJSON): Promise<Uint8Array> {
    const baseArchive = await NemosyneSession.exportPortableSnapshot(snapshot, this.environment());
    const payload = NemosynePackageManager.unpack(baseArchive);
    payload.extraFiles = {
      ...(payload.extraFiles ?? {}),
      [CONTINUITY_SNAPSHOT_PATH]: strToU8(JSON.stringify(snapshot)),
    };
    return NemosynePackageManager.pack(payload);
  }

  private async verifyEmbeddedSnapshot(
    bytes: Uint8Array,
    manifest: NemosynePackageManifest,
  ): Promise<NemosyneSessionJSON> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(strFromU8(bytes));
    } catch {
      throw new Error('The resumable workspace entry is not valid JSON.');
    }
    const snapshot = asSnapshot(parsed);

    if (snapshot.sessionId && snapshot.sessionId !== manifest.sessionId) {
      throw new Error('The resumable workspace belongs to a different investigation session.');
    }
    const identity = canonicalDatasetIdentityHex(snapshot.originalDataset!);
    if (identity !== manifest.datasetFingerprint) {
      throw new Error('The resumable workspace dataset does not match the verified package dataset.');
    }
    if (snapshot.eventLedger.length !== manifest.commandCount) {
      throw new Error('The resumable workspace evidence ledger does not match the verified package command count.');
    }
    if (discoveryCount(snapshot) !== (manifest.discoveryCount ?? 0)) {
      throw new Error('The resumable workspace discovery count does not match the verified package.');
    }
    if (!researchContextMatches(snapshot, manifest)) {
      throw new Error('The resumable workspace research context does not match the verified package.');
    }
    if (manifest.investigationDigest) {
      const digest = await investigationDigestForSnapshot(snapshot);
      if (digest !== manifest.investigationDigest) {
        throw new Error('The resumable workspace investigation digest does not match the verified package.');
      }
    }
    return snapshot;
  }

  private withCurrentDeviceSettings(snapshot: NemosyneSessionJSON): NemosyneSessionJSON {
    const current = this.safeCaptureCurrent();
    if (!current) return snapshot;
    return {
      ...snapshot,
      presentation: {
        ...snapshot.presentation,
        settings: structuredClone(current.presentation.settings),
      },
    };
  }

  private safeCaptureCurrent(): NemosyneSessionJSON | null {
    try {
      return this.captureCurrent();
    } catch {
      return null;
    }
  }

  private async restoreWithRollback(
    target: NemosyneSessionJSON,
    sourceLabel: string,
  ): Promise<void> {
    const previous = this.safeCaptureCurrent();
    try {
      const restored = await this.sessions.restoreSnapshot(target);
      if (!restored) throw new Error(`The ${sourceLabel} could not be restored.`);
    } catch (error) {
      if (previous) {
        try {
          const rolledBack = await this.sessions.restoreSnapshot(previous);
          if (!rolledBack) {
            throw new Error('rollback returned false', { cause: error });
          }
        } catch (rollbackError) {
          throw new Error(
            `The ${sourceLabel} restore failed (${String(error)}) and the previous investigation could not be recovered: ${String(rollbackError)}`,
            { cause: rollbackError },
          );
        }
      }
      throw error;
    }
  }
}
