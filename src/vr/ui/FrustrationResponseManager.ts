import * as THREE from 'three';
import { UXFrustrationAnalyzer, type FrictionPattern } from '../../utils/UXFrustrationAnalyzer.ts';

export class FrustrationResponseManager {
  private _analyzer: UXFrustrationAnalyzer;
  private _cameraGroup: THREE.Group;
  private _hintMesh: THREE.Mesh | null = null;
  private _canvas: HTMLCanvasElement;
  private _ctx: CanvasRenderingContext2D;
  private _texture: THREE.CanvasTexture;
  private _lastShownAt = 0;
  private _cooldownMs = 10000;
  private _visibleDurationMs = 7000;
  private _dissatisfactionThreshold = 0.20;
  private _userMode: 'novice' | 'intermediate' | 'expert' = 'novice';

  constructor(cameraGroup: THREE.Group, analyzer: UXFrustrationAnalyzer) {
    this._cameraGroup = cameraGroup;
    this._analyzer = analyzer;

    this._canvas = document.createElement('canvas');
    this._canvas.width = 700;
    this._canvas.height = 300;
    this._ctx = this._canvas.getContext('2d')!;
    this._texture = new THREE.CanvasTexture(this._canvas);

    this._createHintMesh();
  }

  setUserMode(mode: 'novice' | 'intermediate' | 'expert'): void {
    this._userMode = mode;
    if (mode === 'expert') {
      this._dissatisfactionThreshold = 0.85; // High floor for experts
    } else if (mode === 'intermediate') {
      this._dissatisfactionThreshold = 0.55;
    } else {
      this._dissatisfactionThreshold = 0.35; // Sensitive for novices
    }
  }

  private _createHintMesh(): void {
    const geo = new THREE.PlaneGeometry(0.7, 0.3);
    const mat = new THREE.MeshBasicMaterial({
      map: this._texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthTest: false,
    });

    this._hintMesh = new THREE.Mesh(geo, mat);
    this._hintMesh.position.set(0, -0.2, -1.0); // Slightly below gaze
    this._hintMesh.visible = false;
    this._cameraGroup.add(this._hintMesh);
  }

  update(now = Date.now()): void {
    if (this._userMode === 'expert') {
      if (this._hintMesh) this._hintMesh.visible = false;
      return;
    }

    // Auto-hide after visibility duration
    if (this._hintMesh?.visible && now - this._lastShownAt > this._visibleDurationMs) {
      this._hintMesh.visible = false;
    }

    if (now - this._lastShownAt < this._cooldownMs) return;

    const score = this._analyzer.getDissatisfactionScore();
    if (score >= this._dissatisfactionThreshold) {
      const patterns = this._analyzer.analyzeFriction();
      if (patterns.length > 0) {
        this.showContextualHint(patterns[0], score, now);
      }
    }
  }

  showContextualHint(pattern: FrictionPattern, score: number, now = Date.now()): void {
    if (!this._hintMesh) return;

    this._renderHintCard(pattern, score);
    this._hintMesh.visible = true;
    this._lastShownAt = now;
  }

  private _renderHintCard(pattern: FrictionPattern, score: number): void {
    const ctx = this._ctx;
    const w = this._canvas.width;
    const h = this._canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Card background glow
    ctx.fillStyle = 'rgba(15, 25, 45, 0.92)';
    ctx.fillRect(0, 0, w, h);

    // Amber border strip
    ctx.strokeStyle = '#ffaa00';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, w - 6, h - 6);

    ctx.fillStyle = '#ffaa00';
    ctx.fillRect(3, 3, 14, h - 6);

    // Header
    ctx.font = 'bold 24px monospace';
    ctx.fillStyle = '#ffcc00';
    ctx.textAlign = 'left';
    ctx.fillText(`💡 ASSISTANT SUGGESTION (SCORE: ${(score * 100).toFixed(0)}%)`, 32, 42);

    // Friction type
    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`DETECTED: ${pattern.type.replace(/_/g, ' ')}`, 32, 85);

    // Description text line-wrap
    ctx.font = '18px monospace';
    ctx.fillStyle = '#aaddff';
    ctx.fillText(pattern.description, 32, 130, 630);

    // Actionable tip based on pattern type
    let tip = 'Try holding hands steady or resting wrist.';
    if (pattern.type === 'REPEATED_ACTION') tip = 'Double-check panel options or reset view in menu.';
    else if (pattern.type === 'AIR_CLICK_MISS') tip = 'Bring panel closer or use laser ray pointer.';
    else if (pattern.type === 'GESTURE_MISFIRE') tip = 'Perform deliberate, smooth hand movements.';

    ctx.fillStyle = '#00ffcc';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`TIP: ${tip}`, 32, 195, 630);

    ctx.fillStyle = '#888888';
    ctx.font = '14px monospace';
    ctx.fillText('Auto-hides in 7s', 32, 260);

    this._texture.needsUpdate = true;
  }
}
