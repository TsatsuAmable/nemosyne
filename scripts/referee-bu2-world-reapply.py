from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / 'src/vr/World.ts'
text = PATH.read_text(encoding='utf-8')


def replace_once(old: str, new: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'World.ts expected one match, found {count}: {old[:120]!r}')
    text = text.replace(old, new, 1)


def sub_once(pattern: str, replacement: str) -> None:
    global text
    text, count = re.subn(pattern, replacement, text, count=1, flags=re.DOTALL)
    if count != 1:
        raise RuntimeError(f'World.ts expected one regex match, found {count}: {pattern[:120]!r}')


replace_once(
    "import { NemosyneSession } from '../session/NemosyneSession.ts';",
    "import { NemosyneSession, type NemosyneSessionJSON } from '../session/NemosyneSession.ts';",
)
replace_once(
    "import type { InvestigatorActionableOutcome } from '../moneta/representation/ActionableNil.ts';\n"
    "import { buildRemediationProvenance } from '../moneta/representation/ActionableNil.ts';",
    "import type { InvestigatorActionableOutcome } from '../moneta/representation/ActionableNil.ts';\n"
    "import {\n"
    "  applyRemediation,\n"
    "  buildRemediationProvenance,\n"
    "  hashRequirements,\n"
    "} from '../moneta/representation/ActionableNil.ts';",
)
replace_once(
    "  _previewedDecision: import('../moneta/representation/RepresentationDecision.ts').RepresentationDecision | null = null;\n",
    "  _previewedDecision: import('../moneta/representation/RepresentationDecision.ts').RepresentationDecision | null = null;\n"
    "  _previewedDatasetFingerprint: string | null = null;\n"
    "  _previewedDatasetVersion: number | null = null;\n"
    "  _previewedBaseRequirementsHash: string | null = null;\n",
)
replace_once(
    "      onCancelRemediationPreview: () => this._cancelRemediationPreview(),\n",
    "      onCancelRemediationPreview: () => this._cancelRemediationPreview(),\n"
    "      getPreviewDecision: () => this._getCurrentPreviewDecision(),\n",
)
# WorldUIManager no longer needs direct Moneta node access after the duplicate
# semantic-status notice is removed. Do not touch the renderer lifecycle callback.
replace_once(
    "      getDracoNode: () => this.dracoNode,\n      onFreezeInvestigation: () => this._freezeInvestigation(),",
    "      onFreezeInvestigation: () => this._freezeInvestigation(),",
)

sub_once(
    r"  _applyRemediation\(action: import\('../moneta/representation/ActionableNil\.ts'\)\.RemedialAction\): void \{.*?\n  reconstructRequirementsAndReArbitrate\(\): void \{",
    r'''  _applyRemediation(action: import('../moneta/representation/ActionableNil.ts').RemedialAction): void {
    const oldRequirements = this._activeRequirements;
    const newReq = applyRemediation(this._activeRequirements, action);

    const provenance = buildRemediationProvenance(
      action,
      oldRequirements,
      newReq,
      this.atlas.datasetFingerprint ?? '',
      Date.now()
    );

    this.atlas.recordRemediation(provenance);
    this._activeRequirements = newReq;

    if (this._lastLoadedEntry) {
      const savedSelectionName = this._lastSelectedMesh?.name ?? null;
      this._doLoadDataset(this._lastLoadedEntry, { preserveAnalyticalState: true });

      if (savedSelectionName && this.dracoNode?.artifact?.nodeMeshes) {
        const matchingMesh = this.dracoNode.artifact.nodeMeshes.find((m) => m.name === savedSelectionName);
        if (matchingMesh) {
          this._lastSelectedMesh = matchingMesh as THREE.Mesh;
        }
      }
    }
  }

  /** Preview a remediation without mutating canonical representation state or the ledger. */
  _previewRemediation(action: import('../moneta/representation/ActionableNil.ts').RemedialAction): boolean {
    try {
      if (!this.atlas.isReady()) throw new Error('analytical authority is not ready');
      const baseRequirementsHash = hashRequirements(this._activeRequirements);
      const newReq = applyRemediation(this._activeRequirements, action);
      const previewDecision = this.atlas.previewRepresentation(newReq);
      const expectedRequirementsHash = hashRequirements(newReq);
      const decisionRequirementsHash = previewDecision.provenance.requirementsHash;
      if (decisionRequirementsHash && decisionRequirementsHash !== expectedRequirementsHash) {
        throw new Error('preview decision provenance does not match preview requirements');
      }

      this._previewedRequirements = newReq;
      this._previewedRemediationAction = action;
      this._previewedDecision = previewDecision;
      this._previewedDatasetFingerprint = this.atlas.datasetFingerprint ?? null;
      this._previewedDatasetVersion = this.atlas.datasetVersion;
      this._previewedBaseRequirementsHash = baseRequirementsHash;
      this.uiManager.recommendationPanel?.markDirty?.();
      return true;
    } catch (error) {
      this._clearRemediationPreview();
      this.uiManager.vrConsole?.log?.('warn', [
        `Remediation preview unavailable: ${(error as Error).message}`,
      ]);
      this.uiManager.recommendationPanel?.markDirty?.();
      return false;
    }
  }

  /** Return a preview only while all authority/fingerprint fences still match. */
  _getCurrentPreviewDecision(): import('../moneta/representation/RepresentationDecision.ts').RepresentationDecision | null {
    if (
      !this._previewedDecision ||
      !this._previewedRemediationAction ||
      !this._previewedRequirements ||
      this._previewedDatasetFingerprint !== (this.atlas.datasetFingerprint ?? null) ||
      this._previewedDatasetVersion !== this.atlas.datasetVersion ||
      this._previewedBaseRequirementsHash !== hashRequirements(this._activeRequirements)
    ) {
      return null;
    }
    return this._previewedDecision;
  }

  /** Commit exactly the remediation that produced the currently displayed preview. */
  _commitRemediation(action: import('../moneta/representation/ActionableNil.ts').RemedialAction): void {
    const previewDecision = this._getCurrentPreviewDecision();
    const previewedAction = this._previewedRemediationAction;
    if (!previewDecision || !previewedAction || previewedAction.id !== action.id) {
      this.uiManager.vrConsole?.log?.('warn', [
        'Remediation preview is stale; preview the action again before applying it.',
      ]);
      this._clearRemediationPreview();
      this.uiManager.recommendationPanel?.markDirty?.();
      return;
    }

    try {
      this._applyRemediation(previewedAction);
    } catch (error) {
      this.uiManager.vrConsole?.log?.('warn', [
        `Remediation was not applied: ${(error as Error).message}`,
      ]);
    } finally {
      this._clearRemediationPreview();
      this.uiManager.recommendationPanel?.markDirty?.();
    }
  }

  private _clearRemediationPreview(): void {
    this._previewedRequirements = null;
    this._previewedRemediationAction = null;
    this._previewedDecision = null;
    this._previewedDatasetFingerprint = null;
    this._previewedDatasetVersion = null;
    this._previewedBaseRequirementsHash = null;
  }

  /** Cancel a remediation preview without applying. */
  _cancelRemediationPreview(): void {
    this._clearRemediationPreview();
    this.uiManager.recommendationPanel?.markDirty?.();
  }

  reconstructRequirementsAndReArbitrate(): void {''',
)

sub_once(
    r"  /\*\* Freeze the current investigation state as an immutable archive\. \*/\n  private async _freezeInvestigation\(\): Promise<void> \{.*?\n  /\*\* Delete an archive by ID\. \*/",
    r'''  /** Freeze the current investigation state as an immutable archive. */
  private async _freezeInvestigation(): Promise<void> {
    if (!this.uiManager?.vaultPanel || !this.sessionController?.archiveStore || !this.atlas.isReady()) return;

    const snapshot = this.sessionController.snapshotCurrentSession();
    if (!snapshot) {
      this.uiManager.vrConsole?.log?.('warn', ['Unable to freeze: current session is not snapshot-ready.']);
      return;
    }
    const label = `Archive ${new Date().toLocaleString()}`;

    const eventLedger = (snapshot.eventLedger as unknown[]) ?? [];
    const discoveryEpisodes = snapshot.discoveryEpisodes as
      | { episodes?: unknown[] }
      | undefined;
    const metadata = {
      datasetFingerprint: this.atlas.datasetFingerprint ?? '',
      datasetName: this._lastLoadedEntry?.label ?? this._lastLoadedEntry?.key ?? 'unknown',
      investigationDigest: null,
      eventCount: eventLedger.length,
      discoveryCount: discoveryEpisodes?.episodes?.length ?? 0,
    };

    const archiveId = await this.sessionController.archiveStore.freezeInvestigation(label, snapshot, metadata);
    const archives = await this.sessionController.archiveStore.listArchives?.() ?? [];
    this.uiManager.vaultPanel.setArchives(archives);
    this.uiManager.vaultPanel.show();
    this.uiManager.vrConsole?.log?.('log', [`Frozen investigation: ${archiveId}`]);
    this._logInteraction('Freeze investigation', { result: archiveId });
  }

  /** Restore an archived investigation and report success only after completion. */
  private async _restoreArchive(archiveId: string): Promise<void> {
    if (!this.uiManager?.vaultPanel || !this.sessionController?.archiveStore) return;
    const archive = await this.sessionController.archiveStore.loadArchive(archiveId);
    if (!archive) {
      this.uiManager.vrConsole?.log?.('warn', [`Archive not found: ${archiveId}`]);
      return;
    }
    const restored = await this.sessionController.loadSession(archiveId);
    if (!restored) {
      this.uiManager.vrConsole?.log?.('warn', [`Archive restore failed: ${archiveId}`]);
      return;
    }
    this.uiManager.vrConsole?.log?.('log', [`Restored archive: ${archiveId}`]);
    this._captureSession();
  }

  /** Export the selected immutable archive, never the mutable live session. */
  private async _exportArchive(archiveId: string): Promise<void> {
    if (!this.sessionController?.archiveStore) return;
    const archive = await this.sessionController.archiveStore.loadArchive(archiveId);
    if (!archive) {
      this.uiManager.vrConsole?.log?.('warn', [`Archive not found: ${archiveId}`]);
      return;
    }
    const packageBytes = await NemosyneSession.exportPortableSnapshot(
      archive as unknown as NemosyneSessionJSON
    );
    const blob = new Blob([packageBytes as unknown as BlobPart], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeArchiveId = archiveId.replace(/[^A-Za-z0-9._-]+/g, '-');
    a.download = `nemosyne-${safeArchiveId}.nemosyne`;
    a.click();
    URL.revokeObjectURL(url);
    this.uiManager.vrConsole?.log?.('log', [`Exported archive: ${archiveId}`]);
  }

  /** Delete an archive by ID. */''',
)

PATH.write_text(text, encoding='utf-8')
print('B-U2 World changes replayed onto current main World')
