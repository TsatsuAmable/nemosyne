import * as THREE from 'three';
import { MovablePanel } from './MovablePanel.ts';
import { COLOR_TOKENS, cssHex } from '../ui-system/tokens.ts';

export interface GestureConfidenceEntry {
  gestureName: string;
  confidence: number;
  lastDetectedMs: number;
}

export class GestureConfidenceHUD extends MovablePanel {
  private _confidenceMap: Map<string, GestureConfidenceEntry> = new Map();

  constructor(
    cameraGroup: THREE.Group,
    position: [number, number, number] = [0.8, 1.5, -1.2]
  ) {
    super(cameraGroup, {
      title: 'GESTURE CONFIDENCE RADAR',
      width: 700,
      height: 550,
      position,
      worldSize: [0.85, 0.65],
      titleBarHeight: 45,
      contentPadding: 16,
    });

    this._initializeDefaultEntries();
    this.render();
  }

  private _initializeDefaultEntries(): void {
    const gestures = ['pinchTogether', 'pinchApart', 'swipeLeft', 'swipeRight', 'scoopUp', 'pushForward'];
    for (const g of gestures) {
      this._confidenceMap.set(g, { gestureName: g, confidence: 0.0, lastDetectedMs: 0 });
    }
  }

  recordConfidence(gestureName: string, confidence: number, time = Date.now()): void {
    const existing = this._confidenceMap.get(gestureName) ?? {
      gestureName,
      confidence: 0.0,
      lastDetectedMs: 0,
    };

    existing.confidence = Math.max(0.0, Math.min(1.0, confidence));
    existing.lastDetectedMs = time;
    this._confidenceMap.set(gestureName, existing);
    this.render();
  }

  renderContent(ctx: CanvasRenderingContext2D, w: number, contentH: number): void {
    const entries = Array.from(this._confidenceMap.values());
    this.totalContentHeight = 100 + entries.length * 60;

    ctx.fillStyle = cssHex(COLOR_TOKENS.surface.base) + 'CC';
    ctx.fillRect(10, 10, w - 20, contentH - 20);

    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = cssHex(COLOR_TOKENS.text.secondary);
    ctx.fillText('GESTURE NAME', 30, 40);
    ctx.fillText('CONFIDENCE', 380, 40);

    let y = 80;
    for (const entry of entries) {
      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = cssHex(COLOR_TOKENS.interaction.focus);
      ctx.textAlign = 'left';
      ctx.fillText(entry.gestureName.toUpperCase(), 30, y + 18);

      // Confidence Bar Outer
      ctx.strokeStyle = cssHex(COLOR_TOKENS.interaction.focus);
      ctx.lineWidth = 2;
      ctx.strokeRect(300, y, 260, 24);

      // Confidence Bar Fill
      ctx.fillStyle = cssHex(COLOR_TOKENS.interaction.focus) + '26';
      ctx.fillRect(302, y + 2, 256, 20);

      const fillW = entry.confidence * 256;
      ctx.fillStyle = entry.confidence >= 0.75 ? cssHex(COLOR_TOKENS.status.verified) : entry.confidence >= 0.5 ? cssHex(COLOR_TOKENS.epistemic.uncertain) : cssHex(COLOR_TOKENS.danger.destructive);
      ctx.fillRect(302, y + 2, fillW, 20);

      // Confidence Percentage Text
      ctx.font = 'bold 16px monospace';
      ctx.fillStyle = cssHex(COLOR_TOKENS.text.primary);
      ctx.fillText(`${(entry.confidence * 100).toFixed(0)}%`, 580, y + 18);

      y += 60;
    }
  }
}
