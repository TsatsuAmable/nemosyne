import * as THREE from 'three';
import { remapColor } from '../utils/Accessibility.ts';
import type { WorldThemePalette } from './coordinators/types.ts';
import { COLOR_TOKENS } from './ui-system/tokens.ts';

/** Cyberspace atmosphere: fog, ambient light, point light, background. */
export class WorldTheme {
  static PRESETS: Record<string, WorldThemePalette> = {
    neonMidnight: {
      fogColor: COLOR_TOKENS.space.void,
      fogDensity: 0.035,
      ambientColor: 0x0a192f,
      ambientIntensity: 1.2,
      pointColor: COLOR_TOKENS.interaction.focus,
      pointIntensity: 2.5,
      gridColor1: COLOR_TOKENS.surface.border,
      gridColor2: COLOR_TOKENS.space.void,
    },
    daylightGlobe: {
      fogColor: 0xe8f4ff,
      fogDensity: 0.018,
      ambientColor: 0x6688aa,
      ambientIntensity: 1.6,
      pointColor: 0xffddaa,
      pointIntensity: 2.2,
      gridColor1: 0x0066aa,
      gridColor2: 0xaaccff,
    },
    coolDepth: {
      fogColor: 0x001122,
      fogDensity: 0.045,
      ambientColor: 0x051830,
      ambientIntensity: 1.0,
      pointColor: 0x00ccff,
      pointIntensity: 3.0,
      gridColor1: 0x00ccff,
      gridColor2: 0x002244,
    },
    warmAnomaly: {
      fogColor: 0x1a0505,
      fogDensity: 0.04,
      ambientColor: 0x331010,
      ambientIntensity: 1.3,
      pointColor: 0xff5500,
      pointIntensity: 3.2,
      gridColor1: 0xff5500,
      gridColor2: 0x441111,
    },
    deepNet: {
      fogColor: 0x1a0033,
      fogDensity: 0.05,
      ambientColor: 0x220044,
      ambientIntensity: 0.9,
      pointColor: 0xff00ff,
      pointIntensity: 3.0,
      gridColor1: 0xff00ff,
      gridColor2: 0x330066,
    },
    lowStrain: {
      fogColor: 0x12161a,
      fogDensity: 0.03,
      ambientColor: 0x1a202c,
      ambientIntensity: 1.0,
      pointColor: 0x4aa6a0,
      pointIntensity: 1.4,
      gridColor1: 0x2a3a44,
      gridColor2: 0x12161a,
    },
    mutedProfessional: {
      fogColor: 0x1a202c,
      fogDensity: 0.032,
      ambientColor: 0x223040,
      ambientIntensity: 1.1,
      pointColor: 0x00aa88,
      pointIntensity: 1.8,
      gridColor1: 0x334444,
      gridColor2: 0x1a202c,
    },
  };

  scene: THREE.Scene;
  currentPreset: string;
  fogColor: THREE.Color;
  gridHelper: THREE.GridHelper;
  ambient: THREE.AmbientLight;
  pointLight: THREE.PointLight;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.currentPreset = 'neonMidnight';
    const initial = WorldTheme.PRESETS[this.currentPreset];

    this.fogColor = new THREE.Color(initial.fogColor);
    this.scene.fog = new THREE.FogExp2(this.fogColor, initial.fogDensity);
    this.scene.background = this.fogColor;

    // A visible floor grid so there is always *something* to render even when
    // the data palace is out of view or failing. This also helps judge motion.
    this.gridHelper = new THREE.GridHelper(40, 40, initial.gridColor1, initial.gridColor2);
    this.gridHelper.position.y = 0;
    scene.add(this.gridHelper);

    this.ambient = new THREE.AmbientLight(initial.ambientColor, initial.ambientIntensity);
    this.scene.add(this.ambient);

    this.pointLight = new THREE.PointLight(initial.pointColor, initial.pointIntensity, 40);
    this.pointLight.position.set(0, 6, 0);
    this.scene.add(this.pointLight);
  }

  applyPreset(name: string): boolean {
    const preset = WorldTheme.PRESETS[name];
    if (!preset) {
      console.warn('[WorldTheme] unknown preset:', name);
      return false;
    }
    this.currentPreset = name;
    this.setFogColor(preset.fogColor, preset.fogDensity);
    this.ambient.color.setHex(preset.ambientColor);
    this.ambient.intensity = preset.ambientIntensity;
    this.setLightColor(preset.pointColor);
    this.pointLight.intensity = preset.pointIntensity;
    this._setGridColors(preset.gridColor1, preset.gridColor2);
    return true;
  }

  cyclePreset(): string {
    const keys = Object.keys(WorldTheme.PRESETS);
    const idx = keys.indexOf(this.currentPreset);
    const next = keys[(idx + 1) % keys.length];
    this.applyPreset(next);
    return next;
  }

  applyColorblindMode(mode: string | boolean): void {
    const preset = WorldTheme.PRESETS[this.currentPreset];
    if (!preset) return;
    this.setFogColor(remapColor(preset.fogColor, mode) as number, preset.fogDensity);
    this.ambient.color.setHex(remapColor(preset.ambientColor, mode) as number);
    this.setLightColor(remapColor(preset.pointColor, mode) as number);
    this._setGridColors(remapColor(preset.gridColor1, mode) as number, remapColor(preset.gridColor2, mode) as number);
  }

  getCurrentPreset(): string {
    return this.currentPreset;
  }

  /** No-op update (particles removed per B-V1). */
  update(_delta: number, _time: number, _activity = 0): void {
    // Intentionally empty — no particle animation
  }

  setFogColor(hex: number, density = 0.035): void {
    this.fogColor.setHex(hex);
    (this.scene.fog as THREE.FogExp2).color.copy(this.fogColor);
    (this.scene.background as THREE.Color).copy(this.fogColor);
    (this.scene.fog as THREE.FogExp2).density = density;
  }

  setLightColor(hex: number): void {
    this.pointLight.color.setHex(hex);
  }

  _setGridColors(color1: number, color2: number): void {
    // GridHelper stores line colors in vertex colors. Rebuild to change both
    // main and secondary line colors.
    this.scene.remove(this.gridHelper);
    this.gridHelper.geometry.dispose();
    this.gridHelper = new THREE.GridHelper(40, 40, color1, color2);
    this.gridHelper.position.y = 0;
    this.scene.add(this.gridHelper);
  }

  dispose(): void {
    this.scene.remove(this.ambient);
    this.scene.remove(this.pointLight);
    this.scene.remove(this.gridHelper);
    this.ambient.dispose();
    this.pointLight.dispose();
    this.gridHelper.geometry.dispose();
  }
}
