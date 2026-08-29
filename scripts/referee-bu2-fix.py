from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def write(rel: str, text: str) -> None:
    (ROOT / rel).write_text(text, encoding="utf-8")


def replace_once(rel: str, old: str, new: str) -> None:
    text = read(rel)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{rel}: expected one exact match, found {count}: {old[:120]!r}")
    write(rel, text.replace(old, new, 1))


def sub_once(rel: str, pattern: str, replacement: str, flags: int = 0) -> None:
    text = read(rel)
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{rel}: expected one regex match, found {count}: {pattern[:120]!r}")
    write(rel, updated)


# ---------------------------------------------------------------------------
# World: preview/commit fencing + truthful archive freeze/restore/export.
# ---------------------------------------------------------------------------
replace_once(
    "src/vr/World.ts",
    "import { NemosyneSession } from '../session/NemosyneSession.ts';",
    "import { NemosyneSession, type NemosyneSessionJSON } from '../session/NemosyneSession.ts';",
)
replace_once(
    "src/vr/World.ts",
    "import { buildRemediationProvenance } from '../moneta/representation/ActionableNil.ts';",
    "import {\n  applyRemediation,\n  buildRemediationProvenance,\n  hashRequirements,\n} from '../moneta/representation/ActionableNil.ts';",
)
replace_once(
    "src/vr/World.ts",
    "  _previewedDecision: import('../moneta/representation/RepresentationDecision.ts').RepresentationDecision | null = null;\n",
    "  _previewedDecision: import('../moneta/representation/RepresentationDecision.ts').RepresentationDecision | null = null;\n"
    "  _previewedDatasetFingerprint: string | null = null;\n"
    "  _previewedDatasetVersion: number | null = null;\n"
    "  _previewedBaseRequirementsHash: string | null = null;\n",
)
replace_once(
    "src/vr/World.ts",
    "      onCancelRemediationPreview: () => this._cancelRemediationPreview(),\n",
    "      onCancelRemediationPreview: () => this._cancelRemediationPreview(),\n"
    "      getPreviewDecision: () => this._getCurrentPreviewDecision(),\n",
)
# The duplicate embodiment notice is removed in this fix; its getDracoNode callback becomes dead.
world_text = read("src/vr/World.ts")
world_text = world_text.replace("      getDracoNode: () => this.dracoNode,\n", "")
write("src/vr/World.ts", world_text)

remediation_block = r"  _applyRemediation\(action: import\('../moneta/representation/ActionableNil\.ts'\)\.RemedialAction\): void \{.*?\n  reconstructRequirementsAndReArbitrate\(\): void \{"
remediation_replacement = r'''  _applyRemediation(action: import('../moneta/representation/ActionableNil.ts').RemedialAction): void {
    const oldRequirements = this._activeRequirements;
    // Use the canonical remediation helper so scientific-info-loss constraints
    // cannot be silently "applied" by a UI path that bypasses its safety rule.
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

  /** Preview a remediation without mutating the ledger or active requirements. */
  _previewRemediation(action: import('../moneta/representation/ActionableNil.ts').RemedialAction): boolean {
    try {
      if (!this.atlas.isReady()) {
        throw new Error('analytical authority is not ready');
      }
      const baseRequirementsHash = hashRequirements(this._activeRequirements);
      const newReq = applyRemediation(this._activeRequirements, action);
      const previewDecision = this.atlas.arbitrateRepresentation(newReq);
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

  /** Return a preview only while every authority/fingerprint fence still matches. */
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

  reconstructRequirementsAndReArbitrate(): void {'''
sub_once("src/vr/World.ts", remediation_block, remediation_replacement, re.DOTALL)

archive_block = r"  /\*\* Freeze the current investigation state as an immutable archive\. \*/\n  private async _freezeInvestigation\(\): Promise<void> \{.*?\n  /\*\* Delete an archive by ID\. \*/"
archive_replacement = r'''  /** Freeze the current investigation state as an immutable archive. */
  private async _freezeInvestigation(): Promise<void> {
    if (!this.uiManager?.vaultPanel || !this.sessionController?.archiveStore || !this.atlas.isReady()) return;

    // Refresh presentation state immediately before freezing. `session.serialize()`
    // alone can lag behind the live camera/settings/focus state between autosaves.
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

  /** Restore an archived investigation by ID and report success only after restore completes. */
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

  /** Delete an archive by ID. */'''
sub_once("src/vr/World.ts", archive_block, archive_replacement, re.DOTALL)


# ---------------------------------------------------------------------------
# Session controller: one canonical way to refresh + serialize live presentation.
# ---------------------------------------------------------------------------
session_controller_pattern = r"  async saveSession\(id: string = 'autosave'\): Promise<void> \{\n    const w = this\._world;\n    const generation = this\._generation;\n    if \(!this\._isCurrent\(generation\) \|\| !w\.currentEntry\?\.dataset \|\| !w\.dracoNode\) return;\n\n    // Refresh the session presentation from the live world state\.\n    w\.session\.setPresentation\(\{.*?\n    const snapshot = w\.session\.serialize\(\);"
session_controller_replacement = r'''  /** Refresh live presentation state and return a self-contained current-session snapshot. */
  snapshotCurrentSession(): Record<string, unknown> | null {
    const w = this._world;
    if (this._disposed || !w.currentEntry?.dataset || !w.dracoNode) return null;

    w.session.setPresentation({
      camera: {
        position: w.engine.cameraGroup.position.toArray() as [number, number, number],
        rotationY: w.engine.cameraGroup.rotation.y,
      },
      settings: w.uiManager?.settingsPanel?.getAllSettings?.() ?? {},
      tour: {
        stepIndex: w.guidedTour?._stepIndex ?? 0,
        finished: w.guidedTour?._finished ?? true,
      },
      theme: w.engine.theme?.currentPreset ?? 'neonMidnight',
      panelPositions: w.uiManager?.panelManager?.getPanelPositions?.() ?? [],
      entry: {
        name: w.currentEntry.name ?? w._originalDataset?.name ?? w.currentEntry.label ?? 'dataset',
        topology: w.currentEntry.topology,
        encodings: w.currentEntry.encodings,
        maxDepth: w.currentEntry.maxDepth,
      },
      focus: w.focusContext?.exportState() ?? undefined,
    });

    return w.session.serialize() as unknown as Record<string, unknown>;
  }

  async saveSession(id: string = 'autosave'): Promise<void> {
    const w = this._world;
    const generation = this._generation;
    if (!this._isCurrent(generation)) return;
    const snapshot = this.snapshotCurrentSession();
    if (!snapshot) return;'''
sub_once(
    "src/vr/coordinators/WorldSessionController.ts",
    session_controller_pattern,
    session_controller_replacement,
    re.DOTALL,
)


# ---------------------------------------------------------------------------
# Portable package: export an immutable persisted snapshot without touching live state.
# ---------------------------------------------------------------------------
replace_once(
    "src/session/NemosyneSession.ts",
    "  async exportPortablePackage(environment: PortablePackageEnvironment = {}): Promise<Uint8Array> {",
    "  async exportPortablePackage(\n"
    "    environment: PortablePackageEnvironment = {},\n"
    "    kernelVersionOverride?: string\n"
    "  ): Promise<Uint8Array> {",
)
replace_once(
    "src/session/NemosyneSession.ts",
    "    const kernelVersion = this._atlas.kernelVersion() ?? 'unknown';",
    "    const kernelVersion = kernelVersionOverride ?? this._atlas.kernelVersion() ?? 'unknown';",
)
replace_once(
    "src/session/NemosyneSession.ts",
    "  loadFromJSON(json: NemosyneSessionJSON): void {",
    "  /** Export a persisted snapshot in isolation from the mutable live Atlas/session. */\n"
    "  static async exportPortableSnapshot(\n"
    "    json: NemosyneSessionJSON,\n"
    "    environment: PortablePackageEnvironment = {}\n"
    "  ): Promise<Uint8Array> {\n"
    "    const atlas = new AtlasCore({ kernel: null });\n"
    "    const session = NemosyneSession.deserialize(json, atlas);\n"
    "    const lastImplementationVersion = [...json.analysisResults]\n"
    "      .reverse()\n"
    "      .find((result) => typeof result.implementationVersion === 'string')\n"
    "      ?.implementationVersion;\n"
    "    const archivedKernelVersion =\n"
    "      json.representationDecision?.kernelVersion ?? lastImplementationVersion ?? 'unknown';\n"
    "    return session.exportPortablePackage(environment, archivedKernelVersion);\n"
    "  }\n\n"
    "  loadFromJSON(json: NemosyneSessionJSON): void {",
)


# ---------------------------------------------------------------------------
# Recommendation UI: display the actual preview decision and refuse stale commits.
# ---------------------------------------------------------------------------
replace_once(
    "src/vr/ui/RecommendationPanel.ts",
    "import type { InvestigatorActionableOutcome, RemedialAction } from '../../moneta/representation/ActionableNil.ts';",
    "import type { InvestigatorActionableOutcome, RemedialAction } from '../../moneta/representation/ActionableNil.ts';\n"
    "import type { RepresentationDecision } from '../../moneta/representation/RepresentationDecision.ts';",
)
replace_once(
    "src/vr/ui/RecommendationPanel.ts",
    "  onPreviewRemediation?: (action: RemedialAction) => void;\n",
    "  onPreviewRemediation?: (action: RemedialAction) => boolean;\n"
    "  getPreviewDecision?: () => RepresentationDecision | null;\n",
)
replace_once(
    "src/vr/ui/RecommendationPanel.ts",
    "  private readonly _onPreviewRemediation?: (action: RemedialAction) => void;\n",
    "  private readonly _onPreviewRemediation?: (action: RemedialAction) => boolean;\n"
    "  private readonly _getPreviewDecision?: () => RepresentationDecision | null;\n",
)
replace_once(
    "src/vr/ui/RecommendationPanel.ts",
    "    this._onPreviewRemediation = options.onPreviewRemediation;\n",
    "    this._onPreviewRemediation = options.onPreviewRemediation;\n"
    "    this._getPreviewDecision = options.getPreviewDecision;\n",
)

preview_render_pattern = r"        if \(isPreviewed\) \{\n          ctx\.fillStyle = '#ffcc00';.*?        \} else \{\n          this\._drawButton\(ctx, `remedi-preview-\$\{action\.id\}`, 'Preview', pad \+ 16, y, btnW, btnH, '#0088cc'\);\n        \}"
preview_render_replacement = r'''        if (isPreviewed) {
          const previewDecision = this._getPreviewDecision?.() ?? null;
          if (previewDecision) {
            const candidate = previewDecision.chosenCandidateId ?? previewDecision.representationFamily;
            const layout = previewDecision.chosenLayout ?? previewDecision.embodiment.primaryLayout;
            const status = previewDecision.decisionStatus ?? 'DECISIVE';
            ctx.fillStyle = '#ffcc00';
            ctx.font = this._scaleFont('bold 12px monospace');
            ctx.fillText(`PREVIEW: ${candidate} · ${layout}`, pad + 16, y + 12);
            ctx.font = this._scaleFont('11px monospace');
            ctx.fillStyle = '#ddddaa';
            ctx.fillText(`Utility ${previewDecision.utilityScore.toFixed(3)} · ${status}`, pad + 16, y + 30);
            y += 40;
            this._drawButton(ctx, `remedi-commit-${action.id}`, 'Apply', pad + 16, y, btnW, btnH, '#00aa44');
            this._drawButton(ctx, `remedi-cancel-${action.id}`, 'Revert', pad + 16 + btnW + gap, y, btnW, btnH, '#aa3333');
          } else {
            ctx.fillStyle = '#ff9966';
            ctx.font = this._scaleFont('bold 12px monospace');
            ctx.fillText('PREVIEW STALE — run preview again', pad + 16, y + 12);
            y += 20;
            this._drawButton(ctx, `remedi-preview-${action.id}`, 'Re-preview', pad + 16, y, btnW, btnH, '#0088cc');
            this._drawButton(ctx, `remedi-cancel-${action.id}`, 'Revert', pad + 16 + btnW + gap, y, btnW, btnH, '#aa3333');
          }
        } else {
          this._drawButton(ctx, `remedi-preview-${action.id}`, 'Preview', pad + 16, y, btnW, btnH, '#0088cc');
        }'''
sub_once(
    "src/vr/ui/RecommendationPanel.ts",
    preview_render_pattern,
    preview_render_replacement,
    re.DOTALL,
)
replace_once(
    "src/vr/ui/RecommendationPanel.ts",
    "      if (action) {\n        this._previewedRemediationId = actionId;\n        this._onPreviewRemediation?.(action);\n      }",
    "      if (action) {\n"
    "        const accepted = this._onPreviewRemediation?.(action) ?? false;\n"
    "        if (accepted) this._previewedRemediationId = actionId;\n"
    "      }",
)


# ---------------------------------------------------------------------------
# UI manager: wire preview decision; remove duplicate semantic-status panel.
# ---------------------------------------------------------------------------
world_ui = read("src/vr/coordinators/WorldUIManager.ts")
world_ui = world_ui.replace("import { EmbodimentStatusNotice } from '../ui/EmbodimentStatusNotice.ts';\n", "")
world_ui = world_ui.replace(
    "  onPreviewRemediation?: (action: import('../../moneta/representation/ActionableNil.ts').RemedialAction) => void;\n",
    "  onPreviewRemediation?: (action: import('../../moneta/representation/ActionableNil.ts').RemedialAction) => boolean;\n"
    "  getPreviewDecision?: () => import('../../moneta/representation/RepresentationDecision.ts').RepresentationDecision | null;\n",
)
world_ui = world_ui.replace("  getDracoNode?: () => import('../../moneta/MonetaTopologyNode.ts').DracoTopologyNode | null;\n", "")
world_ui = world_ui.replace("  embodimentStatusNotice: EmbodimentStatusNotice;\n", "")
world_ui = re.sub(
    r"\n    // In-world notice for refused/invalid/pending semantic embodiment states\.\n    this\.embodimentStatusNotice = new EmbodimentStatusNotice\(.*?\n    this\.engine\.addUpdatable\(this\.embodimentStatusNotice\);\n",
    "\n",
    world_ui,
    count=1,
    flags=re.DOTALL,
)
world_ui = world_ui.replace(
    "      onPreviewRemediation: callbacks.onPreviewRemediation,\n",
    "      onPreviewRemediation: callbacks.onPreviewRemediation,\n"
    "      getPreviewDecision: callbacks.getPreviewDecision,\n",
)
world_ui = world_ui.replace("    this.embodimentStatusNotice.dispose?.();\n", "")
if "EmbodimentStatusNotice" in world_ui or "embodimentStatusNotice" in world_ui:
    raise RuntimeError("WorldUIManager.ts: duplicate embodiment-status notice references remain")
write("src/vr/coordinators/WorldUIManager.ts", world_ui)

# Delete the duplicate surface. SemanticEmbodimentStatus.ts remains the single presentation owner.
notice = ROOT / "src/vr/ui/EmbodimentStatusNotice.ts"
if notice.exists():
    notice.unlink()

replace_once(
    "tests/uv0-baseline-inventory.test.ts",
    "  embodimentStatusNotice: 'excluded: conditional notice for refused/invalid embodiment states',\n",
    "",
)


# ---------------------------------------------------------------------------
# Focused regression tests. They deliberately attack production-path source
# wiring as well as the snapshot exporter helper.
# ---------------------------------------------------------------------------
(ROOT / "tests/bu2-post-merge-truthfulness.test.ts").write_text(r'''import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { Dataset } from '../src/data/Dataset.ts';
import { NemosyneSession, type NemosyneSessionJSON } from '../src/session/NemosyneSession.ts';
import { NemosynePackageManager } from '../src/session/NemosynePackage.ts';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('B-U2 post-merge truthfulness', () => {
  it('fences preview commit to the same dataset/version/requirements and renders the actual decision', () => {
    const world = source('src/vr/World.ts');
    const panel = source('src/vr/ui/RecommendationPanel.ts');

    expect(world).toContain('_previewedDatasetFingerprint');
    expect(world).toContain('_previewedDatasetVersion');
    expect(world).toContain('_previewedBaseRequirementsHash');
    expect(world).toContain('this._previewedDatasetVersion !== this.atlas.datasetVersion');
    expect(world).toContain("this._previewedBaseRequirementsHash !== hashRequirements(this._activeRequirements)");
    expect(world).toContain('previewedAction.id !== action.id');
    expect(world).toContain('applyRemediation(this._activeRequirements, action)');
    expect(panel).toContain('PREVIEW: ${candidate} · ${layout}');
    expect(panel).toContain('PREVIEW STALE — run preview again');
  });

  it('uses fresh presentation state for freeze and awaits restore completion', () => {
    const world = source('src/vr/World.ts');
    const controller = source('src/vr/coordinators/WorldSessionController.ts');

    expect(controller).toContain('snapshotCurrentSession(): Record<string, unknown> | null');
    expect(world).toContain('const snapshot = this.sessionController.snapshotCurrentSession();');
    expect(world).toContain('const restored = await this.sessionController.loadSession(archiveId);');
    expect(world).not.toContain('this.sessionController.loadSession(archiveId);\n    this.uiManager.vrConsole');
    expect(world).toContain('discoveryEpisodes?.episodes?.length ?? 0');
  });

  it('exports the selected archived snapshot rather than the mutable live session', async () => {
    const atlas = new AtlasCore();
    const dataset = new Dataset(
      'archive-a',
      [{ name: 'value', type: 'number' }],
      [{ value: 1 }, { value: 2 }]
    );
    atlas.loadDataset(dataset);
    const session = new NemosyneSession({ atlas, sessionId: 'archive-a-session' });
    session.setPresentation({ entry: { name: 'archive-a' } });
    const snapshot = session.serialize() as NemosyneSessionJSON;

    // Mutate the live Atlas after taking the archive snapshot. A correct archive
    // exporter must remain pinned to archive-a rather than following this live state.
    atlas.loadDataset(new Dataset(
      'live-b',
      [{ name: 'value', type: 'number' }],
      [{ value: 99 }]
    ));

    const bytes = await NemosyneSession.exportPortableSnapshot(snapshot);
    const unpacked = await NemosynePackageManager.unpack(bytes);
    const archivedDataset = JSON.parse(new TextDecoder().decode(unpacked.datasetBytes));
    expect(archivedDataset.name).toBe('archive-a');
    expect(archivedDataset.rows).toHaveLength(2);
  });

  it('keeps semantic embodiment status presentation single-owned', () => {
    const manager = source('src/vr/coordinators/WorldUIManager.ts');
    expect(manager).not.toContain('EmbodimentStatusNotice');
    expect(manager).not.toContain('embodimentStatusNotice');
    expect(source('src/moneta/embodiment/SemanticEmbodimentStatus.ts')).toContain(
      'setSemanticEmbodimentPresentationStatus'
    );
  });
});
''', encoding="utf-8")

print("B-U2 referee patch applied")
