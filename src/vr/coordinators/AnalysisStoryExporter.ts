import { downloadDataUrl, downloadText } from '../../utils/Download.ts';
import type { AnalysisHistory, HistoryFrame } from '../../data/AnalysisHistory.ts';
import type { Dataset } from '../../data/Dataset.ts';
import type {
  DatasetLoadEntry,
  LogInteraction,
  TelemetryCollectorLike,
  VRConsoleLike,
  WorldEngineLike,
} from './types.ts';

export interface AnalysisStoryHost {
  atlas?: {
    analysisHistory: Pick<AnalysisHistory, 'frames'>;
    originalDataset: Pick<Dataset, 'name' | 'rowCount'> | null;
    dataset: Pick<Dataset, 'rowCount'> | null;
  };
  currentEntry?: Pick<DatasetLoadEntry, 'name' | 'topology'> | null;
  engine?: Pick<WorldEngineLike, 'cameraGroup' | 'theme'>;
  telemetryCollector?: Pick<TelemetryCollectorLike, 'getReport'>;
  uiManager?: { vrConsole?: VRConsoleLike | null };
  _logInteraction?: LogInteraction;
}

export class AnalysisStoryExporter {
  static exportScreenshot(
    engine?: WorldEngineLike,
    vrConsole?: VRConsoleLike,
    logInteraction?: LogInteraction,
    format: string = 'png'
  ): void {
    try {
      const renderer = engine?.renderer;
      if (!renderer?.domElement?.toDataURL) {
        vrConsole?.log?.('warn', ['Screenshot not available']);
        return;
      }
      const isJpeg = format === 'jpeg' || format === 'jpg';
      const mime = isJpeg ? 'image/jpeg' : 'image/png';
      const ext = isJpeg ? 'jpg' : 'png';
      const dataUrl = renderer.domElement.toDataURL(mime);
      const filename = `nemosyne-${Date.now()}.${ext}`;
      downloadDataUrl(dataUrl, filename);
      vrConsole?.log?.('log', [`Screenshot exported: ${filename}`]);
      logInteraction?.('Export screenshot', { result: filename });
    } catch (err) {
      console.warn('[World] screenshot export failed:', err);
      vrConsole?.log?.('warn', [`Screenshot export failed: ${(err as Error).message}`]);
    }
  }

  static buildAnalysisStory(world: AnalysisStoryHost): Record<string, unknown> {
    const frames = world.atlas?.analysisHistory.frames() ?? [];
    const originalDataset = world.atlas?.originalDataset ?? null;
    const transformedDataset = world.atlas?.dataset ?? null;
    return {
      version: 1,
      timestamp: Date.now(),
      savedAt: new Date().toISOString(),
      dataset: {
        name: world.currentEntry?.name ?? originalDataset?.name ?? 'dataset',
        topology: world.currentEntry?.topology ?? 'TABULAR',
        rowCount: transformedDataset?.rowCount ?? originalDataset?.rowCount ?? 0,
      },
      camera: world.engine?.cameraGroup?.position?.toArray?.() ?? [],
      theme: world.engine?.theme?.currentPreset ?? 'neonMidnight',
      operations: frames.map((f: HistoryFrame) => ({
        operation: f.operation,
        rowCountAfter: f.rowCountAfter ?? f.datasetAfter?.rowCount,
        parameters: f.parameters,
        timestamp: f.timestamp,
      })),
      telemetry: world.telemetryCollector?.getReport?.(),
    };
  }

  static exportAnalysisStory(world: AnalysisStoryHost): Record<string, unknown> {
    const story = this.buildAnalysisStory(world);
    this.downloadAnalysisStory(world, story);
    world._logInteraction?.('Export story', { result: `nemosyne-story-${story.timestamp}.json` });
    return story;
  }

  static downloadAnalysisStory(
    world: AnalysisStoryHost,
    story: Record<string, unknown> | null = null
  ): void {
    const data = story ?? this.buildAnalysisStory(world);
    const text = JSON.stringify(data, null, 2);
    const filename = `nemosyne-story-${data.timestamp}.json`;
    downloadText(text, filename, 'application/json');
    world.uiManager?.vrConsole?.log?.('log', [`Analysis story exported: ${filename}`]);
  }
}