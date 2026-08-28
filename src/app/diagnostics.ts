import type { World } from '../vr/World.ts';

export interface RuntimeDiagnosticSnapshot {
  schemaVersion: 1;
  bootState: string;
  atlas: {
    kernelReady: boolean;
    kernelVersion: string | null;
    capabilities: number;
    generation: number;
    datasetVersion: number;
    hasDataset: boolean;
    executionMode: 'worker' | 'inline' | 'none';
    resultCount: number;
    ledgerCount: number;
  };
  dataset: {
    rowCount: number;
    columnCount: number;
    edgesPresent: boolean;
  } | null;
  scene: {
    objectCount: number;
    visibleObjectCount: number;
    byType: Record<string, number>;
    renderedNodeMeshCount: number;
    dashboardPanelCount: number;
  };
  renderer: {
    memory: {
      geometries: number;
      textures: number;
    };
    render: {
      calls: number;
      triangles: number;
      points: number;
      lines: number;
    };
  };
}

declare global {
  interface Window {
    __NEMOSYNE_DIAGNOSTICS__?: () => RuntimeDiagnosticSnapshot;
  }
}

function buildRuntimeDiagnosticSnapshot(world: World): RuntimeDiagnosticSnapshot {
  const byType: Record<string, number> = {};
  let objectCount = 0;
  let visibleObjectCount = 0;

  world.engine.scene.traverse((object) => {
    objectCount += 1;
    if (object.visible) visibleObjectCount += 1;
    const type = object.type || 'Object3D';
    byType[type] = (byType[type] ?? 0) + 1;
  });

  const executionPort = world.atlas.executionPort;
  const dataset = world.atlas.hasDataset ? world.atlas.dataset : null;
  const rendererInfo = world.engine.renderer.info;

  return {
    schemaVersion: 1,
    bootState: world.bootState,
    atlas: {
      kernelReady: world.atlas.isReady(),
      kernelVersion: world.atlas.kernelVersion(),
      capabilities: world.atlas.capabilities,
      generation: world.atlas.generation,
      datasetVersion: world.atlas.datasetVersion,
      hasDataset: world.atlas.hasDataset,
      executionMode: executionPort ? (executionPort.isAsync ? 'worker' : 'inline') : 'none',
      resultCount: world.atlas.results.length,
      ledgerCount: world.atlas.ledger.length,
    },
    dataset: dataset
      ? {
          rowCount: dataset.rowCount,
          columnCount: dataset.columnCount,
          edgesPresent: dataset.edges !== undefined,
        }
      : null,
    scene: {
      objectCount,
      visibleObjectCount,
      byType,
      renderedNodeMeshCount: world.dracoNode?.artifact?.nodeMeshes?.length ?? 0,
      dashboardPanelCount: world.dashboardPanels?.length ?? 0,
    },
    renderer: {
      memory: {
        geometries: rendererInfo.memory.geometries,
        textures: rendererInfo.memory.textures,
      },
      render: {
        calls: rendererInfo.render.calls,
        triangles: rendererInfo.render.triangles,
        points: rendererInfo.render.points,
        lines: rendererInfo.render.lines,
      },
    },
  };
}

/**
 * Install the read-only Q3 diagnostic hook for explicitly instrumented builds.
 *
 * The hook intentionally exposes only bounded counts/status values. It does not
 * expose row values, column names, dataset fingerprints, collaboration tokens,
 * provenance payloads, annotations, findings, or other user-authored content.
 */
export function installRuntimeDiagnosticHook(world: World): () => void {
  const snapshot = () => buildRuntimeDiagnosticSnapshot(world);
  window.__NEMOSYNE_DIAGNOSTICS__ = snapshot;
  return () => {
    if (window.__NEMOSYNE_DIAGNOSTICS__ === snapshot) {
      delete window.__NEMOSYNE_DIAGNOSTICS__;
    }
  };
}
