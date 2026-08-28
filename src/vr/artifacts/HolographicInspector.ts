import * as THREE from 'three';
import { Container, Text } from '@pmndrs/uikit';
import { SpatialPanel } from '../ui-system/SpatialPanel.ts';
import { PanelChrome } from '../ui-system/components/PanelChrome.ts';
import { SegmentedControl } from '../ui-system/components/SegmentedControl.ts';
import { Button } from '../ui-system/components/Button.ts';
import { COLOR_TOKENS, TYPOGRAPHY_TOKENS } from '../ui-system/tokens.ts';
import type { PanelBudgetController } from '../ui-system/PanelBudgetController.ts';
import type { EngineLike, PointerLike } from '../coordinators/types.ts';

export interface HolographicInspectorOptions {
  worldSize?: [number, number];
}

/** One session-level provenance row derived from the evidence ledger. */
export interface ProvenanceEntry {
  id: string;
  operation: string;
  datasetVersion: number;
  timestamp: number;
}

/** One session-level evidence row (observation / finding / annotation). */
export interface EvidenceEntry {
  id: string;
  kind: 'observation' | 'finding' | 'annotation';
  title: string;
  timestamp: number;
}

/**
 * Provenance/evidence provider injected post-construction by the composition
 * root (World), sourced from the authoritative `AtlasCore.evidenceLedger`.
 * Returns session-level entries; node-scoped provenance is a P1-U3 residual
 * (the ledger references structure-IDs, the inspector receives a raw row).
 */
export interface ProvenanceProvider {
  getProvenance(): ProvenanceEntry[];
  getEvidence(): EvidenceEntry[];
}

type InspectorTab = 'Values' | 'Evidence' | 'Provenance';
const TAB_OPTIONS: InspectorTab[] = ['Values', 'Evidence', 'Provenance'];

export class HolographicInspector extends SpatialPanel {
  engine: EngineLike;
  active: boolean = false;
  data: Record<string, unknown> | null = null;
  title: string = '';
  pointer: PointerLike | null = null;
  /**
   * Workspace budget controller. Set by the composition root (World) after
   * construction so the inspector registers in the `inspector` role on
   * `showAtNode` and untracks on `hide`; null leaves behaviour unchanged.
   */
  budgetController: PanelBudgetController | null = null;
  /**
   * Session-level provenance/evidence provider. Set by World after
   * construction, sourced from `atlas.evidenceLedger`. When null the
   * Provenance/Evidence tabs show an "unavailable" notice.
   */
  provenanceProvider: ProvenanceProvider | null = null;

  // UI Sub-components
  private _chrome: PanelChrome;
  private _categoryText: Text;
  private _tabControl: SegmentedControl;
  private _contentContainer: Container;

  // Tabs State
  private _activeTab: InspectorTab = 'Values';

  constructor(engine: EngineLike, options: HolographicInspectorOptions = {}) {
    super({
      width: 512,
      height: 384,
      flexDirection: 'column',
      padding: 16,
      gap: 12,
    });
    this.engine = engine;
    this.name = 'holographic-inspector';
    this.visible = false;

    // Default world size to [0.6, 0.45] roughly
    const scale = options.worldSize ? options.worldSize[0] / 512 : 0.6 / 512;
    this.scale.setScalar(scale);

    // --- Chrome (standardised title + pin + close, P1-U3 / P1-U8) ---
    this._chrome = new PanelChrome({
      title: 'DATA NODE',
      onPinToggle: () => this._togglePin(),
      onClose: () => this.hide(),
    });
    this.add(this._chrome);

    // --- Category badge (optional, beneath the chrome) ---
    this._categoryText = new Text({
      text: '',
      fontSize: TYPOGRAPHY_TOKENS.scale.label,
      color: COLOR_TOKENS.surface.base,
      backgroundColor: COLOR_TOKENS.danger.destructive,
      paddingX: 8,
      paddingY: 4,
      borderRadius: 4,
    });
    this.add(this._categoryText);

    // --- Tab Switcher (shared SegmentedControl; fixes the pre-existing
    // setTab hover-state bug where tabs mutated Button bg directly) ---
    this._tabControl = new SegmentedControl({
      options: TAB_OPTIONS,
      value: this._activeTab,
      onChange: (next) => this.setTab(next as InspectorTab),
    });
    this.add(this._tabControl);

    // --- Content Area ---
    this._contentContainer = new Container({
      flexDirection: 'column',
      flexGrow: 1,
      overflow: 'scroll',
      gap: 8,
      padding: 8,
      backgroundColor: COLOR_TOKENS.surface.base,
      borderRadius: 4,
      borderColor: COLOR_TOKENS.surface.border,
      borderWidth: 1,
    });
    this.add(this._contentContainer);

    // --- Action Footer ---
    const footerContainer = new Container({
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'flex-start',
    });
    footerContainer.add(new Button({ label: 'Compare', variant: 'secondary' }));
    footerContainer.add(new Button({ label: 'Challenge', variant: 'danger' }));
    footerContainer.add(new Button({ label: 'Annotate', variant: 'secondary' }));
    footerContainer.add(new Container({ flexGrow: 1 }));
    footerContainer.add(new Button({ label: 'Close', variant: 'secondary', onClick: () => this.hide() }));
    this.add(footerContainer);
  }

  private _togglePin(): void {
    if (!this.budgetController) return;
    if (this._chrome.isPinned) this.budgetController.pin(this);
    else this.budgetController.unpin(this);
  }

  mount(scene: { add(object: THREE.Object3D): void }): void {
    scene.add(this);
    // Add grab rail mesh to scene for raycasting
    const grabRail = this.getGrabRailMesh();
    if (grabRail) scene.add(grabRail);
  }

  showAtNode(
    nodeMesh: THREE.Object3D | null,
    data: Record<string, unknown> | null,
    pointer: PointerLike | null = null,
    title = 'DATA NODE'
  ): void {
    this.data = data;
    this.title = title;
    this.active = true;
    this.visible = true;
    this.pointer = pointer;
    // Register in the workspace budget as the inspector/context surface.
    this.budgetController?.open(this, 'inspector');

    this._chrome.title = title;
    const category = data?.category ?? data?.type ?? '';
    this._categoryText.setProperties({ text: String(category) });

    if (nodeMesh) {
      const pos = new THREE.Vector3();
      nodeMesh.getWorldPosition(pos);
      // Place near the node but offset
      this.position.copy(pos).add(new THREE.Vector3(0, 0.2, 0.15));
      if (this.engine.camera) {
        this.lookAt(this.engine.camera.position);
      }
    }

    // Show grab rail affordance
    this.setGrabRailVisible(true);

    this.setTab('Values');
    this._playOpenFeedback(nodeMesh);
  }

  hide(): void {
    if (!this.active) return;
    this.active = false;
    this.visible = false;
    this.pointer = null;
    this.budgetController?.close(this);
    // Hide grab rail affordance
    this.setGrabRailVisible(false);
    this._playCloseFeedback();
  }

  setTab(tab: InspectorTab): void {
    this._activeTab = tab;
    // Keep the shared SegmentedControl visual in sync when setTab is called
    // programmatically (e.g. on open). `value` is a silent set — it does not
    // fire onChange, so there is no feedback loop.
    this._tabControl.value = tab;
    this._renderContent();
  }

  private _renderContent(): void {
    this._contentContainer.clear();
    if (this._activeTab === 'Values') {
      this._renderValues();
    } else if (this._activeTab === 'Evidence') {
      this._renderEvidence();
    } else {
      this._renderProvenance();
    }
  }

  private _renderValues(): void {
    const entries = Object.entries(this.data ?? {});
    if (entries.length === 0) {
      this._contentContainer.add(
        new Text({ text: 'No values for this node.', color: COLOR_TOKENS.text.muted, fontSize: 16 }),
      );
      return;
    }
    for (const [key, value] of entries) {
      if (key === 'category' || key === 'type') continue;
      const row = new Container({ flexDirection: 'row', justifyContent: 'space-between', width: '100%' });
      row.add(new Text({ text: key, color: COLOR_TOKENS.interaction.focus, fontSize: 16 }));
      row.add(new Text({ text: String(value).slice(0, 40), color: COLOR_TOKENS.text.primary, fontSize: 16 }));
      this._contentContainer.add(row);
    }
  }

  private _renderEvidence(): void {
    const entries = this.provenanceProvider?.getEvidence() ?? [];
    this._contentContainer.add(
      new Text({
        text: '// SESSION EVIDENCE',
        fontSize: TYPOGRAPHY_TOKENS.scale.label,
        color: COLOR_TOKENS.interaction.focus,
        fontWeight: 'bold',
      }),
    );
    if (entries.length === 0) {
      this._contentContainer.add(
        new Text({
          text: 'No session evidence recorded yet.',
          color: COLOR_TOKENS.text.muted,
          fontSize: 16,
        }),
      );
      return;
    }
    for (const entry of entries) {
      const row = new Container({ flexDirection: 'column', gap: 2, width: '100%' });
      row.add(
        new Text({
          text: `[${entry.kind.toUpperCase()}] ${entry.title}`,
          color: COLOR_TOKENS.text.primary,
          fontSize: 16,
        }),
      );
      row.add(
        new Text({
          text: new Date(entry.timestamp).toISOString(),
          color: COLOR_TOKENS.text.muted,
          fontSize: 12,
        }),
      );
      this._contentContainer.add(row);
    }
  }

  private _renderProvenance(): void {
    const entries = this.provenanceProvider?.getProvenance() ?? [];
    this._contentContainer.add(
      new Text({
        text: '// SESSION PROVENANCE',
        fontSize: TYPOGRAPHY_TOKENS.scale.label,
        color: COLOR_TOKENS.interaction.focus,
        fontWeight: 'bold',
      }),
    );
    if (entries.length === 0) {
      this._contentContainer.add(
        new Text({
          text: 'No session provenance recorded yet.',
          color: COLOR_TOKENS.text.muted,
          fontSize: 16,
        }),
      );
      return;
    }
    for (const entry of entries) {
      const row = new Container({ flexDirection: 'column', gap: 2, width: '100%' });
      row.add(
        new Text({
          text: entry.operation,
          color: COLOR_TOKENS.text.primary,
          fontSize: 16,
        }),
      );
      row.add(
        new Text({
          text: `v${entry.datasetVersion} · ${new Date(entry.timestamp).toISOString()}`,
          color: COLOR_TOKENS.text.muted,
          fontSize: 12,
        }),
      );
      this._contentContainer.add(row);
    }
  }

  update(delta: number, _time?: number): void {
    if (!this.active) return;
    super.update(delta); // Updates SpatialPanel internals

    // Face the user's head smoothly if we want
    if (this.engine.camera) {
      const camPos = new THREE.Vector3();
      this.engine.camera.getWorldPosition(camPos);
      this.lookAt(camPos);
    }
  }

  private _playOpenFeedback(nodeMesh: THREE.Object3D | null): void {
    const fb = this.engine?.input?.feedback;
    if (!fb) return;
    const volume = fb.volume ?? 0.15;
    fb.playTone?.({ frequency: 990, duration: 0.06, shape: 'sine', volume });
    setTimeout(() => fb.playTone?.({ frequency: 1320, duration: 0.08, shape: 'sine', volume }), 50);
    if (nodeMesh) {
      const pos = new THREE.Vector3();
      fb.showHitMarker?.(
        this.engine.scene as unknown as THREE.Scene,
        nodeMesh.getWorldPosition(pos),
        0x00ffcc,
        220
      );
    }
  }

  private _playCloseFeedback(): void {
    const fb = this.engine?.input?.feedback;
    if (!fb) return;
    const volume = fb.volume ?? 0.15;
    fb.playTone?.({ frequency: 660, duration: 0.08, shape: 'sine', volume: volume * 0.7 });
  }
}