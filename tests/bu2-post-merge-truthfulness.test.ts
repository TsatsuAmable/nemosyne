import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { ColumnType, Dataset } from '../src/data/Dataset.ts';
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
    expect(world).toContain('this.atlas.previewRepresentation(newReq)');
    expect(world).not.toContain('const previewDecision = this.atlas.arbitrateRepresentation(newReq)');
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
      [{ name: 'value', type: ColumnType.NUMERIC }],
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
      [{ name: 'value', type: ColumnType.NUMERIC }],
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
