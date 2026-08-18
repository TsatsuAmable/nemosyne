/**
 * Progressive Disclosure as Architecture (Sprint 24.6).
 *
 * Implements 4 structural UI profiles:
 * - NOVICE: Load, Explore, Analyse, Explain, Undo, Help
 * - ANALYST: Analysis operators, views, history, evidence, study tools
 * - RESEARCHER: Provenance, experiment controls, observation, annotation, counterbalancing, export
 * - DEVELOPER: Performance HUD, VRConsole, network, load-test, WASM telemetry
 *
 * Also structures Experience settings into Comfort | Interaction | Accessibility | Collaboration.
 */

export type UserProfile = 'NOVICE' | 'ANALYST' | 'RESEARCHER' | 'DEVELOPER';

export interface ProfilePermissions {
  allowedWheelCategories: readonly string[];
  diagnosticSurfacesAllowed: boolean;
  developerHUDsAllowed: boolean;
  provenanceInspectionAllowed: boolean;
  studyLedgerControlsAllowed: boolean;
}

export const PROFILE_CONFIGS: Record<UserProfile, ProfilePermissions> = {
  NOVICE: {
    allowedWheelCategories: ['DATA', 'VIEW', 'SYSTEM'],
    diagnosticSurfacesAllowed: false,
    developerHUDsAllowed: false,
    provenanceInspectionAllowed: false,
    studyLedgerControlsAllowed: false,
  },
  ANALYST: {
    allowedWheelCategories: ['DATA', 'ANALYSE', 'VIEW', 'STUDY', 'COLLABORATE', 'SYSTEM'],
    diagnosticSurfacesAllowed: false,
    developerHUDsAllowed: false,
    provenanceInspectionAllowed: true,
    studyLedgerControlsAllowed: true,
  },
  RESEARCHER: {
    allowedWheelCategories: ['DATA', 'ANALYSE', 'VIEW', 'STUDY', 'COLLABORATE', 'SYSTEM'],
    diagnosticSurfacesAllowed: false,
    developerHUDsAllowed: false,
    provenanceInspectionAllowed: true,
    studyLedgerControlsAllowed: true,
  },
  DEVELOPER: {
    allowedWheelCategories: ['DATA', 'ANALYSE', 'VIEW', 'STUDY', 'COLLABORATE', 'SYSTEM'],
    diagnosticSurfacesAllowed: true,
    developerHUDsAllowed: true,
    provenanceInspectionAllowed: true,
    studyLedgerControlsAllowed: true,
  },
};

export interface ExperienceSettings {
  comfort: {
    vignette: boolean;
    snapTurnAngle: number;
    seatedMode: boolean;
    panelDistanceMeters: number;
  };
  interaction: {
    gazeConfirmEnabled: boolean;
    dwellThresholdMs: number;
    dominantHand: 'left' | 'right';
  };
  accessibility: {
    colorblindPreset: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
    highContrastText: boolean;
    hapticFeedbackGain: number;
  };
  collaboration: {
    presenceVisible: boolean;
    sharePortals: boolean;
  };
}

export const DEFAULT_EXPERIENCE_SETTINGS: ExperienceSettings = {
  comfort: {
    vignette: true,
    snapTurnAngle: 45,
    seatedMode: false,
    panelDistanceMeters: 1.2,
  },
  interaction: {
    gazeConfirmEnabled: true,
    dwellThresholdMs: 150,
    dominantHand: 'right',
  },
  accessibility: {
    colorblindPreset: 'none',
    highContrastText: false,
    hapticFeedbackGain: 1.0,
  },
  collaboration: {
    presenceVisible: true,
    sharePortals: true,
  },
};

export class ProgressiveDisclosureController {
  private _profile: UserProfile = 'ANALYST';
  private _settings: ExperienceSettings = { ...DEFAULT_EXPERIENCE_SETTINGS };

  constructor(initialProfile: UserProfile = 'ANALYST') {
    this._profile = initialProfile;
  }

  get profile(): UserProfile {
    return this._profile;
  }

  get settings(): ExperienceSettings {
    return this._settings;
  }

  setProfile(profile: UserProfile): void {
    this._profile = profile;
  }

  isCategoryVisible(category: string): boolean {
    const config = PROFILE_CONFIGS[this._profile];
    return config.allowedWheelCategories.includes(category);
  }

  isDiagnosticAllowed(): boolean {
    return PROFILE_CONFIGS[this._profile].diagnosticSurfacesAllowed;
  }

  updateSettings<K extends keyof ExperienceSettings>(section: K, patch: Partial<ExperienceSettings[K]>): void {
    this._settings[section] = {
      ...this._settings[section],
      ...patch,
    };
  }
}
