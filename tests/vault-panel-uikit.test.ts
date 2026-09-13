import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { VaultPanel } from '../src/vr/ui/VaultPanel.ts';
import { SpatialPanel } from '../src/vr/ui-system/SpatialPanel.ts';

function archive(index: number) {
  return {
    archiveId: 'archive:' + index,
    label: 'Archive ' + index,
    datasetFingerprint: 'fp-' + index,
    datasetName: 'Dataset',
    investigationDigest: 'digest-' + index,
    eventCount: index,
    discoveryCount: index + 1,
    frozenAt: 1_700_000_000_000 + index,
  };
}

describe('VaultPanel UXR1 UIKit migration', () => {
  it('uses SpatialPanel while preserving archive selection and paging', () => {
    const panel = new VaultPanel(new THREE.Group());
    expect(panel).toBeInstanceOf(SpatialPanel);
    panel.setArchives([0, 1, 2, 3, 4].map(archive));
    expect(panel.currentPage).toBe(0);
    panel.nextPage();
    expect(panel.currentPage).toBe(1);
    panel.previousPage();
    expect(panel.currentPage).toBe(0);

    panel.selectArchive('archive:2');
    expect(panel.selectedArchiveId).toBe('archive:2');
  });

  it('requires explicit confirmation before destructive restore callback', () => {
    const onRestore = vi.fn();
    const panel = new VaultPanel(new THREE.Group(), { onRestore });
    panel.setArchives([archive(1)]);
    panel.selectArchive('archive:1');

    panel.requestRestore();
    expect(panel.showConfirmRestore).toBe(true);
    expect(onRestore).not.toHaveBeenCalled();

    panel.confirmRestore();
    expect(onRestore).toHaveBeenCalledWith('archive:1');
    expect(panel.showConfirmRestore).toBe(false);
  });

  it('can cancel restore without invoking archive authority', () => {
    const onRestore = vi.fn();
    const panel = new VaultPanel(new THREE.Group(), { onRestore });
    panel.setArchives([archive(1)]);
    panel.selectArchive('archive:1');
    panel.requestRestore();
    panel.cancelRestore();

    expect(panel.showConfirmRestore).toBe(false);
    expect(onRestore).not.toHaveBeenCalled();
  });

  it('forwards freeze/export/delete actions without owning archive persistence', () => {
    const onFreeze = vi.fn();
    const onExport = vi.fn();
    const onDelete = vi.fn();
    const panel = new VaultPanel(new THREE.Group(), { onFreeze, onExport, onDelete });
    panel.setArchives([archive(3)]);
    panel.selectArchive('archive:3');

    panel.onFreeze?.();
    panel.exportSelected();
    panel.deleteSelected();

    expect(onFreeze).toHaveBeenCalledTimes(1);
    expect(onExport).toHaveBeenCalledWith('archive:3');
    expect(onDelete).toHaveBeenCalledWith('archive:3');
  });

  it('clears stale selection when the selected archive disappears', () => {
    const panel = new VaultPanel(new THREE.Group());
    panel.setArchives([archive(1)]);
    panel.selectArchive('archive:1');
    panel.requestRestore();
    panel.setArchives([]);

    expect(panel.selectedArchiveId).toBeNull();
    expect(panel.showConfirmRestore).toBe(false);
  });
});
