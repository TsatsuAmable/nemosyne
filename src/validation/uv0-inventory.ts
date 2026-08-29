/**
 * P1-UV0 canonical visible-product baseline inventory.
 *
 * This module is the machine-readable authority for every persistent visible
 * surface/object in normal analyst mode at the B3 checkpoint. B4/B5 and later
 * P1-UV tranches diff against it to prove the visible product actually changed
 * (or that they must not claim it did).
 *
 * Dependency-free (no Node, no DOM) so it can be imported by the smoke spec,
 * the fast node test, and any future tooling.
 *
 * Classification basis: `docs/Nemosyne_VR_UI_Design_System_and_Agent_Spec.md`
 * §16 panel-role table + what is actually visible in the built production app
 * at boot/state (verified against constructor defaults at authoring time).
 * See `docs/roadmap/P1_UV0_BASELINE_INVENTORY.md` for the human-readable
 * equivalent and the fresh-start path.
 */

export const UV0_CLASSIFICATIONS = [
  'KEEP',
  'CONVERGE',
  'DEMOTE',
  'REPLACE',
  'REMOVE',
] as const;
export type Uv0Classification = (typeof UV0_CLASSIFICATIONS)[number];

export const UV0_REFERENCE_FRAMES = [
  'WORLD_LOCKED',
  'BODY_LOCKED',
  'HAND_ATTACHED',
  'DOM_FIXED',
] as const;
export type Uv0ReferenceFrame = (typeof UV0_REFERENCE_FRAMES)[number];

export interface Uv0SurfaceEntry {
  /** Stable machine id used by B4/B5 to diff against this baseline. */
  id: string;
  /** Participant-facing name. */
  name: string;
  /** Primary source location (`file:line`). */
  source: string;
  /** What the investigator sees/uses it for today. */
  purpose: string;
  /** Anchor frame the object lives in. */
  referenceFrame: Uv0ReferenceFrame;
  /** How it appears and how it is dismissed. */
  summonDismiss: string;
  /** Owning semantic state it presents. */
  owningState: string;
  /** KEEP / CONVERGE / DEMOTE / REPLACE / REMOVE. */
  classification: Uv0Classification;
  /** One-line rationale grounded in design-spec §16 + what is visible today. */
  rationale: string;
  /** True when the object is visible in the unmodified fresh-boot analyst scene. */
  visibleAtBoot: boolean;
}

export const UV0_INVENTORY: readonly Uv0SurfaceEntry[] = [
  {
    id: 'datum-plane',
    name: 'DatumPlane',
    source: 'src/vr/coordinators/WorldSceneComposer.ts:58',
    purpose: 'Ground reference plane anchoring the data palace in world space.',
    referenceFrame: 'WORLD_LOCKED',
    summonDismiss: 'Always present at boot; not dismissible.',
    owningState: 'World origin / datum reference (spatial orientation).',
    classification: 'KEEP',
    rationale: 'Neutral datum ground is spatial orientation, not chrome; data stays the protagonist.',
    visibleAtBoot: true,
  },
  {
    id: 'techno-core',
    name: 'TechnoCoreNode',
    source: 'src/vr/coordinators/WorldSceneComposer.ts:63',
    purpose: 'Lens hub landmark; cycles the representation lens on select.',
    referenceFrame: 'WORLD_LOCKED',
    summonDismiss: 'Always present at boot; select to cycle lens.',
    owningState: 'Representation decision / lens context.',
    classification: 'CONVERGE',
    rationale: '§16/P1-UV3: today a decorative hub; must expose representation-decision state + remediation to earn its volume.',
    visibleAtBoot: true,
  },
  {
    id: 'ice-vault',
    name: 'IceVaultNode',
    source: 'src/vr/coordinators/WorldSceneComposer.ts:68',
    purpose: 'Cold-storage / evidence-vault landmark object.',
    referenceFrame: 'WORLD_LOCKED',
    summonDismiss: 'Always present at boot; VaultPanel summoned via hand wheel / launcher.',
    owningState: 'Evidence archive / freeze-restore context.',
    classification: 'CONVERGE',
    rationale: '§16/P1-UV3: remove/demote unless archive-recovery is production-usable; today a non-functional landmark.',
    visibleAtBoot: true,
  },
  {
    id: 'farcaster-portal-a',
    name: 'FarcasterPortal A (DEEP_NET)',
    source: 'src/vr/coordinators/WorldSceneComposer.ts:91',
    purpose: 'Semantic travel portal to the DEEP_NET zone.',
    referenceFrame: 'WORLD_LOCKED',
    summonDismiss: 'Always present; walk through to warp.',
    owningState: 'Semantic destination / overview context.',
    classification: 'CONVERGE',
    rationale: '§16/P1-UV3: reserve for semantic travel; today an unlabelled walk-through teleport to a zone.',
    visibleAtBoot: true,
  },
  {
    id: 'farcaster-portal-b',
    name: 'FarcasterPortal B (LOCAL_MATRIX / saved-investigation)',
    source: 'src/vr/coordinators/WorldSceneComposer.ts:102',
    purpose: 'Semantic travel portal to LOCAL_MATRIX / saved-investigation restore.',
    referenceFrame: 'WORLD_LOCKED',
    summonDismiss: 'Always present; walk through to warp or restore latest archive.',
    owningState: 'Saved-investigation / return context.',
    classification: 'CONVERGE',
    rationale: '§16/P1-UV3: portal destination/return semantics must be visible before traversal.',
    visibleAtBoot: true,
  },
  {
    id: 'moneta-palace',
    name: 'MonetaTopologyNode (data palace)',
    source: 'src/vr/World.ts:998',
    purpose: 'Embodied representation of the active dataset — the data itself.',
    referenceFrame: 'WORLD_LOCKED',
    summonDismiss: 'Built per dataset load; always present in analyst mode.',
    owningState: 'Active representation decision + dataset identity.',
    classification: 'KEEP',
    rationale: 'The palace IS the analytical surface; data is the visual protagonist.',
    visibleAtBoot: true,
  },
  {
    id: 'moneta-diagnostic-hud',
    name: 'MonetaDiagnosticHUD (alias DracoDiagnosticHUD)',
    source: 'src/vr/presentation/representation/RepresentationSurface.ts:78',
    purpose: 'Moneta constraint-solver candidate/cost diagnostic panel.',
    referenceFrame: 'BODY_LOCKED',
    summonDismiss: 'Built per palace at boot; toggled via superuser Dev Lab (world._toggleDracoDiagnostic).',
    owningState: 'Moneta solver candidate/cost state.',
    classification: 'DEMOTE',
    rationale: '§16: developer/research diagnostic — but it IS visible at boot in normal analyst mode today (finding).',
    visibleAtBoot: true,
  },
  {
    id: 'input-telemetry',
    name: 'InputTelemetry panel',
    source: 'src/vr/coordinators/WorldUIManager.ts:226',
    purpose: 'Live WebXR input / hand-state debug panel.',
    referenceFrame: 'BODY_LOCKED',
    summonDismiss: 'Visible at boot in far tier; launcher ring / panel manager toggle.',
    owningState: 'Input subsystem debug state.',
    classification: 'DEMOTE',
    rationale: '§16: developer-only diagnostic; visible at boot in analyst mode today.',
    visibleAtBoot: true,
  },
  {
    id: 'vr-console',
    name: 'VRConsole',
    source: 'src/vr/coordinators/WorldUIManager.ts:231',
    purpose: 'In-VR console/log mirror.',
    referenceFrame: 'BODY_LOCKED',
    summonDismiss: 'Visible at boot; launcher ring / panel manager toggle.',
    owningState: 'Runtime log stream.',
    classification: 'DEMOTE',
    rationale: '§16: developer-only diagnostic; visible at boot in analyst mode today.',
    visibleAtBoot: true,
  },
  {
    id: 'mini-overview',
    name: 'MiniOverview',
    source: 'src/vr/coordinators/WorldUIManager.ts:277',
    purpose: 'Mini-map of palace + camera frustum.',
    referenceFrame: 'BODY_LOCKED',
    summonDismiss: 'Visible at boot (enabled by default); setting toggle.',
    owningState: 'Spatial orientation / navigation state.',
    classification: 'KEEP',
    rationale: '§16: optional orientation instrument, subdued — retained but must stay subdued.',
    visibleAtBoot: true,
  },
  {
    id: 'peer-presence-hud',
    name: 'PeerPresenceHUD',
    source: 'src/vr/coordinators/WorldUIManager.ts:290',
    purpose: 'Remote collaborator presence dots/names.',
    referenceFrame: 'BODY_LOCKED',
    summonDismiss: 'Visible at boot (enabled by default); setting toggle.',
    owningState: 'Collaboration peer presence.',
    classification: 'DEMOTE',
    rationale: '§16: optional collaboration ornament, not the analyst data surface — demote to opt-in.',
    visibleAtBoot: true,
  },
  {
    id: 'dashboard-wall',
    name: 'DashboardManager (semicircle panel wall)',
    source: 'src/vr/coordinators/WorldUIManager.ts:303',
    purpose: 'Curved multi-panel dashboard wall behind the user.',
    referenceFrame: 'BODY_LOCKED',
    summonDismiss: 'Visible at boot; launcher ring toggle.',
    owningState: 'Aggregate/dashboard reference state.',
    classification: 'REMOVE',
    rationale: '§16: remove as default "panel wall" — reconstructs a floating desktop behind the data.',
    visibleAtBoot: true,
  },
  {
    id: 'chart-plane',
    name: 'ChartPlanePanel (correlation / time-series / distribution)',
    source: 'src/vr/coordinators/WorldRendererLifecycle.ts:100',
    purpose: '2D analytical chart planes mounted in the dashboard wall.',
    referenceFrame: 'BODY_LOCKED',
    summonDismiss: 'Visible at boot inside the dashboard wall; hidden when the statistical lens is off.',
    owningState: 'Derived analytical summaries (correlation / time-series / distribution).',
    classification: 'CONVERGE',
    rationale: 'Analytical content is valuable but must live at the locus of work, not a behind-user wall.',
    visibleAtBoot: true,
  },
  {
    id: 'tda-planes',
    name: 'TDAPlanes (statistical lens)',
    source: 'src/vr/coordinators/WorldRendererLifecycle.ts:51',
    purpose: 'Statistical-lens TDA planes overlaid on the palace.',
    referenceFrame: 'WORLD_LOCKED',
    summonDismiss: 'Hidden at boot; toggled by the statistical-lens intent/setting.',
    owningState: 'Statistical-lens visibility state.',
    classification: 'KEEP',
    rationale: 'Data-derived analytical overlay gated behind a lens — the correct P1-UV pattern.',
    visibleAtBoot: false,
  },
  {
    id: 'holographic-inspector',
    name: 'HolographicInspector',
    source: 'src/vr/coordinators/WorldSceneComposer.ts:78',
    purpose: 'Precision inspector for the selected data node (provenance/evidence tabs).',
    referenceFrame: 'BODY_LOCKED',
    summonDismiss: 'Hidden at boot; shown on node select → Inspect verb.',
    owningState: 'Selection + node-inspection state.',
    classification: 'KEEP',
    rationale: '§16: inspector/context panel is canonical within the ≤3-surface budget.',
    visibleAtBoot: false,
  },
  {
    id: 'contextual-task-surface',
    name: 'ContextualTaskSurface',
    source: 'src/vr/coordinators/WorldUIManager.ts:204',
    purpose: 'Node-attached contextual verb surface (Inspect/Compare/Challenge/Record/Navigate/More).',
    referenceFrame: 'BODY_LOCKED',
    summonDismiss: 'Hidden at boot; shown at the selected node (showAtNode).',
    owningState: 'Selection context / task intents (P1-U4).',
    classification: 'KEEP',
    rationale: 'P1-UV2 canonical contextual locus-of-work surface.',
    visibleAtBoot: false,
  },
  {
    id: 'hand-wheel-menu',
    name: 'HandWheelMenu (intent wheel)',
    source: 'src/vr/coordinators/WorldUIManager.ts:326',
    purpose: 'Hand-attached radial intent wheel (command surface v1).',
    referenceFrame: 'HAND_ATTACHED',
    summonDismiss: 'Hidden at boot; hand pinch / M key / launcher toggle.',
    owningState: 'Intent/category navigation.',
    classification: 'CONVERGE',
    rationale: '§16/frozen command surface = intent wheel v1; keep but converge vocabulary to investigator verbs.',
    visibleAtBoot: false,
  },
  {
    id: 'legacy-vr-menu',
    name: 'VRMenu (legacy main menu)',
    source: 'src/vr/coordinators/WorldUIManager.ts:238',
    purpose: 'Legacy operation/dataset main menu.',
    referenceFrame: 'BODY_LOCKED',
    summonDismiss: 'Hidden at boot (retired per P1-U8); superuser launcher ring.',
    owningState: 'Legacy subsystem navigation.',
    classification: 'REMOVE',
    rationale: '§16: retire as primary navigation; actions migrated to the contextual surface + wheel.',
    visibleAtBoot: false,
  },
  {
    id: 'analyst-journey-controls',
    name: 'AnalystJourneyControls (#analyst-journey-controls)',
    source: 'src/app/AnalystJourneyControls.ts:41',
    purpose: 'Desktop DOM control panel for the investigation journey (load/assess/run/mark/export/replay).',
    referenceFrame: 'DOM_FIXED',
    summonDismiss: 'Always mounted at boot; fixed bottom-right.',
    owningState: 'Investigation-journey status/outcome.',
    classification: 'REPLACE',
    rationale: 'P1-UV6: raw engineering controls are the primary desktop experience today; must become a deliberate counterpart.',
    visibleAtBoot: true,
  },
  {
    id: 'dom-telemetry',
    name: '#telemetry (DOM status line)',
    source: 'src/vr/World.ts:565',
    purpose: 'Legacy 2D per-frame telemetry status line.',
    referenceFrame: 'DOM_FIXED',
    summonDismiss: 'Always present at boot; not dismissible.',
    owningState: 'Runtime/kernel readiness + render-loop state.',
    classification: 'DEMOTE',
    rationale: 'P1-UV1: readiness must be legible without a telemetry line; diagnostics belong in an advanced route.',
    visibleAtBoot: true,
  },
  {
    id: 'boot-overlay',
    name: '#overlay (NEMOSYNE // SPATIAL DATA SUITE)',
    source: 'index.html:76',
    purpose: 'Static boot title overlay.',
    referenceFrame: 'DOM_FIXED',
    summonDismiss: 'Always present; never hidden after boot.',
    owningState: 'Boot identity.',
    classification: 'DEMOTE',
    rationale: 'Static splash heading stays over the live scene; it must yield to the data after boot (finding).',
    visibleAtBoot: true,
  },
  {
    id: 'nemosyne-loader',
    name: '#nemosyne-loader (FileLoaderUI)',
    source: 'src/ui/FileLoader.ts:63',
    purpose: 'Dataset import / schema-mapping loader UI container.',
    referenceFrame: 'DOM_FIXED',
    summonDismiss: 'Created at boot top-right; sample select / file input / schema panel.',
    owningState: 'Dataset import + schema mapping.',
    classification: 'CONVERGE',
    rationale: 'Dataset load is a first-class task; the loader must be task-first, not a raw debug dropdown (finding).',
    visibleAtBoot: true,
  },
  {
    id: 'nemosyne-vr-button',
    name: '#nemosyne-vr-button (NemosyneVRButton)',
    source: 'src/vr/VRButton.ts:14',
    purpose: 'VR session entry affordance.',
    referenceFrame: 'DOM_FIXED',
    summonDismiss: 'Always present at boot.',
    owningState: 'XR session availability.',
    classification: 'KEEP',
    rationale: 'Essential VR entry affordance; headless shows a disabled "VR NOT SUPPORTED" state.',
    visibleAtBoot: true,
  },
];

/**
 * Hardcoded completeness contract for drift detection: B4/B5 must keep this
 * exact id set in sync when the visible product actually changes.
 */
export const UV0_EXPECTED_ENTRY_IDS: readonly string[] = UV0_INVENTORY.map(
  (entry) => entry.id
);

export const UV0_EXPECTED_ENTRY_COUNT = UV0_INVENTORY.length;

export function isUv0Classification(value: unknown): value is Uv0Classification {
  return typeof value === 'string' && (UV0_CLASSIFICATIONS as readonly string[]).includes(value);
}

export function isUv0ReferenceFrame(value: unknown): value is Uv0ReferenceFrame {
  return typeof value === 'string' && (UV0_REFERENCE_FRAMES as readonly string[]).includes(value);
}

export interface Uv0InventoryValidation {
  ok: boolean;
  errors: string[];
}

/** Schema-validate every inventory entry (classification + frame + required fields). */
export function validateUv0Inventory(
  entries: readonly Uv0SurfaceEntry[]
): Uv0InventoryValidation {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (!entry.id || typeof entry.id !== 'string') {
      errors.push('entry missing string id');
      continue;
    }
    if (seen.has(entry.id)) errors.push(`duplicate id: ${entry.id}`);
    seen.add(entry.id);
    if (!isUv0Classification(entry.classification)) {
      errors.push(`${entry.id}: invalid classification ${String(entry.classification)}`);
    }
    if (!isUv0ReferenceFrame(entry.referenceFrame)) {
      errors.push(`${entry.id}: invalid reference frame ${String(entry.referenceFrame)}`);
    }
    for (const field of ['name', 'source', 'purpose', 'summonDismiss', 'owningState', 'rationale']) {
      const value = (entry as unknown as Record<string, unknown>)[field];
      if (typeof value !== 'string' || value === '') {
        errors.push(`${entry.id}: missing ${field}`);
      }
    }
    if (typeof entry.visibleAtBoot !== 'boolean') {
      errors.push(`${entry.id}: visibleAtBoot must be boolean`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/** Emit a shallow copy of the canonical inventory. */
export function getUv0Inventory(): Uv0SurfaceEntry[] {
  return UV0_INVENTORY.map((entry) => ({ ...entry }));
}