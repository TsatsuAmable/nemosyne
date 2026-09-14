import * as THREE from 'three';
import { Container, Text } from '@pmndrs/uikit';
import {
  allSampleDatasets,
  getDefaultEncodings,
  type SampleDatasetEntry,
} from '../../data/SampleDatasets.ts';
import { OPEN_DATA_SOURCES } from '../../data/connectors/OpenDataSources.ts';
import {
  xrDatasetLibraryBridge,
  type XRDatasetLibraryEntry,
} from '../../data/catalog/XRDatasetLibraryBridge.ts';
import { SpatialPanel } from '../ui-system/SpatialPanel.ts';
import { Button } from '../ui-system/components/Button.ts';
import { SPACING_TOKENS } from '../ui-system/tokens.ts';
import { getTheme } from '../ui-system/theme.ts';
import type { AccessibilityOptions, MovablePanelOptions } from '../coordinators/types.ts';

interface DataSourcePanelOptions extends MovablePanelOptions {
  onLoadDataset?: (entry: {
    name: string;
    topology: SampleDatasetEntry['topology'];
    dataset: SampleDatasetEntry['dataset'];
    maxDepth?: number;
    encodings: ReturnType<typeof getDefaultEncodings>;
  }) => void;
  onConnectStream?: () => void;
  onDisconnectStream?: () => void;
  onSelectLiveSource?: (sourceKey: string) => void;
}

const PANEL_WIDTH = 820;
const PANEL_HEIGHT = 1280;

/**
 * Focused data-acquisition surface replacing the retired kitchen-sink VRMenu.
 *
 * Analytical operations, portals, reset and other task commands live in the
 * contextual/hand-wheel surfaces. This panel retains only capabilities that
 * previously had no equivalent: curated live-source selection, direct sample
 * loading and the governed XR dataset-library bridge.
 */
export class DataSourcePanel extends SpatialPanel {
  readonly title = 'DATA SOURCES';
  readonly defaultPosition: THREE.Vector3;
  readonly tilt = 0.22;
  isMinimized = false;
  onHide: (() => void) | null = null;
  onDragDelta: ((delta: THREE.Vector3) => void) | null = null;
  onDragEnd: (() => void) | null = null;

  liveConnected = false;
  libraryEntries: XRDatasetLibraryEntry[] = [];
  libraryStatus = 'Refresh to browse approved datasets';

  private readonly _onLoadDataset?: DataSourcePanelOptions['onLoadDataset'];
  private readonly _onConnectStream?: () => void;
  private readonly _onDisconnectStream?: () => void;
  private readonly _onSelectLiveSource?: (sourceKey: string) => void;

  private readonly _status: Text;
  private readonly _actions: Container;
  private _controls: Array<Button | Text> = [];
  private _libraryBusy = false;
  private _libraryPage = 0;
  private static readonly LIBRARY_PAGE_SIZE = 6;
  private _textScale = 1;
  private _highContrast = false;

  constructor(analystAnchor: THREE.Object3D, options: DataSourcePanelOptions = {}) {
    const highContrast = options.highContrast ?? false;
    const theme = getTheme(highContrast);
    super(
      {
        width: PANEL_WIDTH,
        height: PANEL_HEIGHT,
        flexDirection: 'column',
        gap: SPACING_TOKENS.grid.x8,
        padding: SPACING_TOKENS.grid.x12,
        backgroundColor: Number(theme.backgroundColor),
        borderColor: Number(theme.borderColor),
        borderWidth: 2,
        borderRadius: 8,
      },
      options.parentGroup ?? analystAnchor,
      null
    );

    this.name = 'data-source-panel';
    this._onLoadDataset = options.onLoadDataset;
    this._onConnectStream = options.onConnectStream;
    this._onDisconnectStream = options.onDisconnectStream;
    this._onSelectLiveSource = options.onSelectLiveSource;
    this._textScale = options.textScale ?? 1;
    this._highContrast = highContrast;

    const worldWidth = options.worldSize?.[0] ?? 0.95;
    this.scale.setScalar(worldWidth / PANEL_WIDTH);
    this.defaultPosition = new THREE.Vector3(...(options.position ?? [0.9, 1.5, -1.1]));
    this.position.copy(this.defaultPosition);

    this._status = new Text({
      text: '',
      fontSize: 16 * this._textScale,
      color: Number(theme.textPrimary),
    });
    this._actions = new Container({
      flexDirection: 'column',
      gap: SPACING_TOKENS.grid.x4,
    });
    this.add(this._status, this._actions);
    this.render();
  }

  setLiveConnected(connected: boolean): void {
    if (this.liveConnected === connected) return;
    this.liveConnected = connected;
    this.render();
  }

  loadSample(entry: SampleDatasetEntry): void {
    this._onLoadDataset?.({
      name: entry.label,
      topology: entry.topology,
      dataset: entry.dataset,
      maxDepth: entry.depth,
      encodings: getDefaultEncodings(entry),
    });
  }

  selectLiveSource(sourceKey: string): boolean {
    const source = OPEN_DATA_SOURCES.find((candidate) => candidate.key === sourceKey);
    if (!source) return false;
    this._onSelectLiveSource?.(source.key);
    return true;
  }

  async refreshDatasetLibrary(): Promise<void> {
    if (this._libraryBusy) return;
    this._libraryBusy = true;
    this.libraryStatus = 'Refreshing dataset library…';
    this.render();
    try {
      this.libraryEntries = await xrDatasetLibraryBridge.listDatasets();
      this._libraryPage = 0;
      this.libraryStatus = this.libraryEntries.length
        ? this.libraryEntries.length +
          ' approved dataset' +
          (this.libraryEntries.length === 1 ? '' : 's') +
          ' available'
        : 'No approved datasets are currently available';
    } catch (error: unknown) {
      this.libraryEntries = [];
      this.libraryStatus = error instanceof Error ? error.message : String(error);
    } finally {
      this._libraryBusy = false;
      this.render();
    }
  }

  async openLibraryDataset(datasetId: string, tierId: string): Promise<void> {
    if (this._libraryBusy) return;
    this._libraryBusy = true;
    this.libraryStatus = 'Checking and opening dataset…';
    this.render();
    try {
      await xrDatasetLibraryBridge.openDataset(datasetId, tierId);
      const entry = this.libraryEntries.find((candidate) => candidate.id === datasetId);
      this.libraryStatus = entry ? 'Opened ' + entry.label : 'Dataset opened';
    } catch (error: unknown) {
      this.libraryStatus =
        'Could not open dataset: ' + (error instanceof Error ? error.message : String(error));
    } finally {
      this._libraryBusy = false;
      this.render();
    }
  }

  applyAccessibility(options: AccessibilityOptions): void {
    this._textScale = options.textScale;
    this._highContrast = options.highContrast;
    const theme = getTheme(this._highContrast);
    this.setProperties({
      backgroundColor: Number(theme.backgroundColor),
      borderColor: Number(theme.borderColor),
    });
    this.render();
  }

  show(): void {
    this.visible = true;
    this.isMinimized = false;
  }

  hide(): void {
    const changed = this.visible;
    this.visible = false;
    if (changed) this.onHide?.();
  }

  render(): void {
    const theme = getTheme(this._highContrast);
    this._status.setProperties({
      text:
        'LIVE DATA · ' +
        (this.liveConnected ? 'CONNECTED' : 'OFFLINE') +
        '\nApproved library · ' +
        this.libraryStatus,
      fontSize: 16 * this._textScale,
      color: Number(theme.textPrimary),
    });

    for (const control of this._controls) {
      this._actions.remove(control);
      control.dispose();
    }
    this._controls = [];

    this._addHeading('Live connection');
    this._addButton(
      this.liveConnected ? 'Disconnect live data' : 'Connect live data',
      this.liveConnected ? 'danger' : 'primary',
      () => (this.liveConnected ? this._onDisconnectStream?.() : this._onConnectStream?.())
    );

    this._addHeading('Curated live sources');
    for (const source of OPEN_DATA_SOURCES) {
      this._addButton(source.label, 'secondary', () => {
        this.selectLiveSource(source.key);
      });
    }

    this._addHeading('Built-in examples');
    for (const entry of allSampleDatasets) {
      this._addButton(entry.label, 'secondary', () => this.loadSample(entry));
    }

    this._addHeading('Approved dataset library');
    this._addButton(
      this._libraryBusy ? 'Refreshing…' : 'Refresh approved datasets',
      'primary',
      () => {
        void this.refreshDatasetLibrary();
      },
      this._libraryBusy
    );

    const libraryRows = this.libraryEntries.flatMap((entry) =>
      entry.tiers.map((tier) => ({ entry, tier }))
    );
    const pageSize = DataSourcePanel.LIBRARY_PAGE_SIZE;
    const pageCount = Math.max(1, Math.ceil(libraryRows.length / pageSize));
    if (this._libraryPage >= pageCount) this._libraryPage = pageCount - 1;
    const start = this._libraryPage * pageSize;
    for (const { entry, tier } of libraryRows.slice(start, start + pageSize)) {
      this._addButton(
        entry.label +
          ' · v' +
          entry.version +
          ' · ' +
          tier.label +
          ' · ' +
          tier.rows.toLocaleString() +
          ' rows',
        'secondary',
        () => {
          void this.openLibraryDataset(entry.id, tier.id);
        },
        this._libraryBusy
      );
    }
    if (pageCount > 1) {
      this._addButton(
        'Previous library page',
        'secondary',
        () => {
          this._libraryPage = Math.max(0, this._libraryPage - 1);
          this.render();
        },
        this._libraryPage === 0 || this._libraryBusy
      );
      this._addButton(
        'Next library page · ' + (this._libraryPage + 1) + '/' + pageCount,
        'secondary',
        () => {
          this._libraryPage = Math.min(pageCount - 1, this._libraryPage + 1);
          this.render();
        },
        this._libraryPage >= pageCount - 1 || this._libraryBusy
      );
    }
  }

  private _addHeading(label: string): void {
    const heading = new Text({
      text: label,
      fontSize: 18 * this._textScale,
      fontWeight: 'bold',
    });
    this._controls.push(heading);
    this._actions.add(heading);
  }

  private _addButton(
    label: string,
    variant: 'primary' | 'secondary' | 'danger',
    onClick: () => void,
    disabled = false
  ): void {
    const button = new Button({ label, variant, disabled, onClick });
    this._controls.push(button);
    this._actions.add(button);
  }
}
