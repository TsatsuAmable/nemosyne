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
  | 'fixed-c1'
  | 'residual-high-risk'
  | 'residual-follow-up';

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
    disposition: 'residual-high-risk',
    finding: 'Adaptive smoothing clones/allocates vectors and a Ray during active-pointer frames.',
    nextAction: 'UXR0C2: add allocation-free filterInto path with numerical/interaction equivalence falsifiers.',
  },
  {
    id: 'pointer-registry-rays',
    source: 'src/vr/input/PointerRegistry.ts',
    hotPath: 'getBestPointerRay/getBestHand/getActivePointerObject',
    disposition: 'residual-high-risk',
    finding: 'Active pointer selection creates temporary Ray objects while determining pointer authority.',
    nextAction: 'UXR0C2: reuse caller-owned scratch Rays without changing hand/controller precedence.',
  },
  {
    id: 'input-router-frame-state',
    source: 'src/vr/InputRouter.ts',
    hotPath: 'InputRouter.update/_resolveSceneHit/_pollSelection',
    disposition: 'residual-high-risk',
    finding: 'Per-frame active-pointer arrays, gaze scratch, and input-source materialisation remain.',
    nextAction: 'UXR0C2: remove allocations only under same-frame semantic-input parity tests.',
  },
  {
    id: 'desktop-cursor-update',
    source: 'src/vr/DesktopControls.ts',
    hotPath: 'DesktopControls.update',
    disposition: 'residual-follow-up',
    finding: 'Desktop cursor placement creates vector and panel-list temporaries each non-XR frame.',
    nextAction: 'Follow-up: reuse cursor/panel/raycast scratch while preserving desktop semantic parity.',
  },
] as const;
