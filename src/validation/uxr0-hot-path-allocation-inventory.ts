/**
 * UXR0 steady-state allocation inventory.
 *
 * This is an engineering evidence inventory, not a runtime profiler and not an
 * analytical authority. Entries are restricted to production paths inspected
 * against the UXR0 resource-efficiency contract. A `fixed` entry has a source
 * guard in `tests/uxr0-hot-path-allocation.test.ts`; residual entries stay
 * explicit until their own tranche can preserve interaction semantics safely.
 */
export type Uxr0AllocationDisposition =
  'fixed-c1' | 'fixed-c2' | 'fixed-c3' | 'residual-high-risk' | 'residual-follow-up';

export interface Uxr0HotPathAllocationEntry {
  readonly id: string;
  readonly source: string;
  readonly hotPath: string;
  readonly disposition: Uxr0AllocationDisposition;
  readonly finding: string;
  readonly nextAction: string | null;
}

export const UXR0_HOT_PATH_ALLOCATION_INVENTORY: readonly Uxr0HotPathAllocationEntry[] = [
  {
    id: 'contextual-task-anchor',
    source: 'src/vr/ui/ContextualTaskSurface.ts',
    hotPath: 'ContextualTaskSurface.update -> _updateAnchorTransform',
    disposition: 'fixed-c1',
    finding: 'Visible-frame anchoring allocated multiple Vector3/clone temporaries.',
    nextAction: null,
  },
  {
    id: 'holographic-inspector-facing',
    source: 'src/vr/artifacts/HolographicInspector.ts',
    hotPath: 'HolographicInspector.update',
    disposition: 'fixed-c1',
    finding: 'Active-frame camera facing allocated one Vector3 per frame.',
    nextAction: null,
  },
  {
    id: 'pointer-ray-filter',
    source: 'src/vr/input/PointerRayFilter.ts',
    hotPath: 'PointerRayFilter.filter',
    disposition: 'fixed-c2',
    finding:
      'Adaptive smoothing now writes through owned scratch vectors into caller-owned Ray storage.',
    nextAction: null,
  },
  {
    id: 'pointer-registry-rays',
    source: 'src/vr/input/PointerRegistry.ts',
    hotPath: 'getBestPointerRay/getBestHand/getActivePointerObject',
    disposition: 'fixed-c2',
    finding:
      'Pointer authority now reuses instance-owned probe/result Rays without changing hand/controller precedence.',
    nextAction: null,
  },
  {
    id: 'input-router-frame-state',
    source: 'src/vr/InputRouter.ts',
    hotPath: 'InputRouter.update/_resolveSceneHit/_pollSelection',
    disposition: 'fixed-c2',
    finding:
      'Frame-local pointer lists and gaze vectors are reused, and XR input sources are consumed array-like without materialisation.',
    nextAction: null,
  },
  {
    id: 'near-field-raycast-containers',
    source: 'src/vr/interactions/near/NearFieldInteractor.ts',
    hotPath: 'NearFieldInteractor.update',
    disposition: 'fixed-c2',
    finding:
      'Direct-touch updates now reuse Nemosyne-owned Ray and result-array containers; Three.js may still allocate Intersection records internally.',
    nextAction: null,
  },
  {
    id: 'semantic-target-ranking',
    source: 'src/vr/input/SemanticTargetResolver.ts',
    hotPath: 'SemanticTargetResolver.rank',
    disposition: 'fixed-c3',
    finding:
      'Semantic ranking now uses a stable O(n) extrema pass, owned gaze/world-position scratch vectors, and lazy winner materialisation instead of score arrays plus sort/filter intermediates.',
    nextAction: null,
  },
  {
    id: 'desktop-cursor-update',
    source: 'src/vr/DesktopControls.ts',
    hotPath: 'DesktopControls.update',
    disposition: 'residual-follow-up',
    finding:
      'Desktop cursor placement creates vector and panel-list temporaries each non-XR frame.',
    nextAction:
      'Follow-up: reuse cursor/panel/raycast scratch while preserving desktop semantic parity.',
  },
] as const;
