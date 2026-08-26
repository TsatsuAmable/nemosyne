import * as THREE from 'three';
import { Container, Text } from '@pmndrs/uikit';
import { SpatialPanel } from '../ui-system/SpatialPanel.ts';
import { Button } from '../ui-system/components/Button.ts';
import { COLOR_TOKENS } from '../ui-system/tokens.ts';
import type { PanelBudgetController } from '../ui-system/PanelBudgetController.ts';
import type { EngineLike, PointerLike } from '../coordinators/types.ts';

export interface HolographicInspectorOptions {
  worldSize?: [number, number];
}

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
  
  // UI Sub-components
  private _titleText: Text;
  private _categoryText: Text;
  private _contentContainer: Container;
  
  // Tabs State
  private _activeTab: 'Values' | 'Evidence' | 'Provenance' = 'Values';
  private _tabButtons: Record<string, Button> = {};

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

    // --- Header ---
    const headerContainer = new Container({
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      height: 48,
      backgroundColor: COLOR_TOKENS.surface.border,
      borderRadius: 4,
      paddingX: 12,
    });
    this._titleText = new Text({
      text: '// DATA NODE',
      fontSize: 22,
      color: COLOR_TOKENS.interaction.focus,
      fontWeight: 'bold',
    });
    this._categoryText = new Text({
      text: '',
      fontSize: 16,
      color: COLOR_TOKENS.surface.base,
      backgroundColor: COLOR_TOKENS.danger.destructive,
      paddingX: 8,
      paddingY: 4,
      borderRadius: 4,
    });
    headerContainer.add(this._titleText);
    headerContainer.add(this._categoryText);
    this.add(headerContainer);

    // --- Tab Switcher ---
    const tabsContainer = new Container({
      flexDirection: 'row',
      gap: 8,
    });
    
    for (const tabName of ['Values', 'Evidence', 'Provenance'] as const) {
      const btn = new Button({
        label: tabName,
        variant: 'secondary',
        onClick: () => this.setTab(tabName),
      });
      tabsContainer.add(btn);
      this._tabButtons[tabName] = btn;
    }
    this.add(tabsContainer);

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

  mount(scene: { add(object: THREE.Object3D): void }): void {
    scene.add(this);
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

    this._titleText.setProperties({ text: `// ${title}` });
    const category = data?.category ?? data?.type ?? '';
    this._categoryText.setProperties({ text: String(category), display: category ? 'flex' : 'none' });

    if (nodeMesh) {
      const pos = new THREE.Vector3();
      nodeMesh.getWorldPosition(pos);
      // Place near the node but offset
      this.position.copy(pos).add(new THREE.Vector3(0, 0.2, 0.15));
      if (this.engine.camera) {
        this.lookAt(this.engine.camera.position);
      }
    }

    this.setTab('Values');
    this._playOpenFeedback(nodeMesh);
  }

  hide(): void {
    if (!this.active) return;
    this.active = false;
    this.visible = false;
    this.pointer = null;
    this.budgetController?.close(this);
    this._playCloseFeedback();
  }

  setTab(tab: 'Values' | 'Evidence' | 'Provenance') {
    this._activeTab = tab;
    // Update button visuals
    for (const [name, btn] of Object.entries(this._tabButtons)) {
      btn.setProperties({
        backgroundColor: name === tab ? COLOR_TOKENS.interaction.focus : COLOR_TOKENS.surface.raised,
      });
    }
    this._renderContent();
  }

  private _renderContent() {
    this._contentContainer.clear();
    if (this._activeTab === 'Values') {
      const entries = Object.entries(this.data ?? {});
      for (const [key, value] of entries) {
        if (key === 'category' || key === 'type') continue;
        const row = new Container({ flexDirection: 'row', justifyContent: 'space-between', width: '100%' });
        row.add(new Text({ text: key, color: COLOR_TOKENS.interaction.focus, fontSize: 16 }));
        row.add(new Text({ text: String(value).slice(0, 40), color: COLOR_TOKENS.text.primary, fontSize: 16 }));
        this._contentContainer.add(row);
      }
    } else if (this._activeTab === 'Evidence') {
      this._contentContainer.add(new Text({ text: 'Evidence summary not populated.', color: COLOR_TOKENS.text.muted, fontSize: 16 }));
    } else if (this._activeTab === 'Provenance') {
      this._contentContainer.add(new Text({ text: 'Provenance graph not populated.', color: COLOR_TOKENS.text.muted, fontSize: 16 }));
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
