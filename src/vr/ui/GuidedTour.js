import * as THREE from 'three';

/**
 * Step-by-step spatial onboarding tour for Nemosyne.
 *
 * Tours are authored as JSON:
 *   {
 *     id: 'first-dataset',
 *     steps: [
 *       { target: 'node', text: 'Point at a data node...', actionHint: 'pinch' },
 *       { target: 'wheel-menu', text: 'Open the wheel menu...' },
 *       ...
 *     ]
 *   }
 *
 * Each step can highlight a named UI element or scene role, display a
 * camera-rig-attended instruction card, and emit audio narration. The tour
 * advances automatically when a step's condition is met, or manually via
 * next()/previous(). Callers provide a resolver that maps `target` names to
 * world-space positions / objects so the tour stays decoupled from World
 * internals.
 */
export class GuidedTour {
  constructor(engine, options = {}) {
    this.engine = engine;
    this.cameraGroup = engine?.cameraGroup;
    this.feedback = options.feedback ?? engine?.input?.feedback ?? null;
    this.onComplete = options.onComplete ?? (() => {});
    this.onStep = options.onStep ?? (() => {});

    this.tour = options.tour ?? null;
    this._stepIndex = 0;
    this._active = false;
    this._finished = false;

    this._cardGroup = new THREE.Group();
    this._cardGroup.visible = false;
    if (this.cameraGroup) this.cameraGroup.add(this._cardGroup);

    this._cardCanvas = document.createElement('canvas');
    this._cardCanvas.width = 1024;
    this._cardCanvas.height = 384;
    this._cardCtx = this._cardCanvas.getContext('2d') || this._createMockContext();

    this._cardTexture = new THREE.CanvasTexture(this._cardCanvas);
    this._cardTexture.minFilter = THREE.LinearFilter;
    this._cardTexture.magFilter = THREE.LinearFilter;

    const geom = new THREE.PlaneGeometry(0.9, 0.34);
    const mat = new THREE.MeshBasicMaterial({
      map: this._cardTexture,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });
    this._cardMesh = new THREE.Mesh(geom, mat);
    this._cardMesh.position.set(0, -0.25, -0.8);
    this._cardGroup.add(this._cardMesh);

    this._arrow = this._createArrow();
    this._cardGroup.add(this._arrow);

    this._highlightMesh = this._createHighlightRing();
    this._cardGroup.add(this._highlightMesh);

    this._resolveTarget = options.resolveTarget ?? (() => null);
    this._checkCondition = options.checkCondition ?? (() => false);

    this.userMode = options.userMode ?? 'novice';

    this._tempVec = new THREE.Vector3();
  }

  setUserMode(mode) {
    this.userMode = ['novice', 'intermediate', 'expert'].includes(mode) ? mode : 'novice';
  }

  _createArrow() {
    const geom = new THREE.ConeGeometry(0.025, 0.12, 16);
    geom.translate(0, 0.06, 0);
    geom.rotateZ(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffcc00,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });
    return new THREE.Mesh(geom, mat);
  }

  _createHighlightRing() {
    const geom = new THREE.RingGeometry(0.08, 0.1, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00ffcc,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });
    return new THREE.Mesh(geom, mat);
  }

  loadTour(tour) {
    this.tour = tour;
    this._stepIndex = 0;
    this._active = false;
    this._finished = false;
  }

  start() {
    if (!this.tour?.steps?.length) {
      console.warn('[GuidedTour] no tour loaded');
      return false;
    }
    if (this.userMode === 'expert') {
      this.skip();
      return false;
    }
    this._active = true;
    this._finished = false;
    this._stepIndex = 0;
    this._cardGroup.visible = true;
    this._renderStep();
    this._playNarration();
    return true;
  }

  stop() {
    this._active = false;
    this._cardGroup.visible = false;
  }

  skip() {
    this._finished = true;
    this.stop();
    this.onComplete();
  }

  restart() {
    if (!this.tour) return false;
    this._stepIndex = 0;
    this._finished = false;
    this._active = true;
    this._cardGroup.visible = true;
    this._renderStep();
    this._playNarration();
    return true;
  }

  next() {
    if (!this._active || !this.tour) return;
    if (this._stepIndex < this.tour.steps.length - 1) {
      this._stepIndex++;
      this._renderStep();
      this._playNarration();
    } else {
      this._finished = true;
      this.stop();
      this.onComplete();
    }
  }

  previous() {
    if (!this._active || !this.tour || this._stepIndex <= 0) return;
    this._stepIndex--;
    this._renderStep();
    this._playNarration();
  }

  get currentStep() {
    return this.tour?.steps?.[this._stepIndex] ?? null;
  }

  get isActive() {
    return this._active;
  }

  get isFinished() {
    return this._finished;
  }

  update(delta, time) {
    if (!this._active) return;

    const step = this.currentStep;
    if (!step) return;

    // Auto-advance if the step condition is satisfied.
    if (this._checkCondition(step, this._stepIndex)) {
      this.next();
      return;
    }

    // Keep the card facing the user.
    this._cardGroup.position.set(0, 0, 0);
    this._cardGroup.rotation.set(0, 0, 0);

    // Pulse the highlight ring.
    const pulse = 1 + Math.sin((time ?? 0) * 6) * 0.15;
    this._highlightMesh.scale.setScalar(pulse);

    // Position arrow and highlight around the resolved target.
    const target = this._resolveTarget(step.target);
    if (target?.position) {
      const worldPos = this._tempVec.copy(target.position);
      if (target.object?.parent) {
        target.object.getWorldPosition(worldPos);
      }
      this._highlightMesh.position.copy(worldPos);
      this._highlightMesh.lookAt(this.cameraGroup.position);

      // Point the arrow from the card toward the target.
      const cardWorld = new THREE.Vector3();
      this._cardMesh.getWorldPosition(cardWorld);
      const dir = new THREE.Vector3().subVectors(worldPos, cardWorld).normalize();
      this._arrow.position.copy(cardWorld).add(dir.clone().multiplyScalar(0.55));
      this._arrow.lookAt(worldPos);
      this._arrow.visible = true;
    } else {
      this._highlightMesh.visible = false;
      this._arrow.visible = false;
    }
  }

  _renderStep() {
    const step = this.currentStep;
    if (!step) return;

    const ctx = this._cardCtx;
    const w = this._cardCanvas.width;
    const h = this._cardCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Background.
    ctx.fillStyle = 'rgba(10, 24, 40, 0.96)';
    ctx.fillRect(0, 0, w, h);

    // Border.
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, w - 8, h - 8);

    // Title / progress.
    ctx.fillStyle = '#00ffff';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`// TOUR  ${this._stepIndex + 1}/${this.tour.steps.length}`, 28, 24);

    // Body text.
    ctx.fillStyle = '#ccffff';
    ctx.font = '26px monospace';
    this._wrapText(ctx, step.text, 28, 78, w - 56, 38);

    // Action hint.
    if (step.actionHint) {
      ctx.fillStyle = '#ffcc00';
      ctx.font = 'bold 22px monospace';
      ctx.fillText(`> ${step.actionHint}`, 28, h - 46);
    }

    this._cardTexture.needsUpdate = true;
    this._highlightMesh.visible = true;
    this.onStep(step, this._stepIndex);
  }

  _wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = String(text ?? '').split(' ');
    let line = '';
    let cy = y;
    for (const word of words) {
      const test = line + word + ' ';
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, cy);
        line = word + ' ';
        cy += lineHeight;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, x, cy);
  }

  _playNarration() {
    const step = this.currentStep;
    if (!step?.audio || !this.feedback?.playTone) return;
    this.feedback.playTone({ frequency: 660, duration: 0.08, shape: 'sine', volume: 0.12 });
  }

  _createMockContext() {
    const noOp = () => {};
    return {
      clearRect: noOp,
      fillRect: noOp,
      strokeRect: noOp,
      fillText: noOp,
      measureText: () => ({ width: 0 }),
      set fillStyle(_) {},
      set strokeStyle(_) {},
      set lineWidth(_) {},
      set font(_) {},
      set textAlign(_) {},
      set textBaseline(_) {},
    };
  }

  dispose() {
    this.stop();
    if (this._cardMesh.parent) this._cardMesh.parent.remove(this._cardMesh);
    this._cardMesh.geometry.dispose();
    this._cardMesh.material.dispose();
    this._cardTexture.dispose();
    this._arrow.geometry.dispose();
    this._arrow.material.dispose();
    this._highlightMesh.geometry.dispose();
    this._highlightMesh.material.dispose();
  }
}
