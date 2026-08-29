import type {
  MonetaSpec,
  VRBehavior,
  VRGeometry,
  VRInteraction,
  VRLayout,
} from '../types.ts';
import {
  assertRepresentationGraph,
  type RepresentationGraph,
  type RepresentationPrimitive,
} from './RepresentationGraph.ts';

const VALID_LAYOUTS = new Set<VRLayout>([
  'GRID_3D',
  'FORCE_DIRECTED_3D',
  'RADIAL_ORBITAL',
  'VECTOR_STREAMLINE',
  'TIME_RIBBON',
  'GEO_SURFACE',
  'SPECTRAL_VOLUME',
]);

const VALID_GEOMETRIES = new Set<VRGeometry>([
  'CUBE_MATRIX',
  'ICOSA_NODE',
  'CONICAL_TREE',
  'FLOW_RAY',
  'GEO_COLUMN',
  'CLUSTER_VOLUME',
  'INSTANCED_POINT_CLOUD',
  'AGGREGATE_BARS',
  'DENSITY_FIELD',
  'DISTRIBUTION_FIELD',
  'ORB',
  'COLUMN',
  'BEAM',
  'SPECTRAL_BAR',
  'SPECTRAL_SURFACE',
]);

const VALID_BEHAVIORS = new Set<VRBehavior>([
  'PULSE_QUANTITATIVE',
  'ORBITAL_SPIN',
  'WAVE_OSCILLATION',
  'STATIC',
]);

const VALID_INTERACTIONS = new Set<VRInteraction>([
  'INSPECT_CELL',
  'TRAVERSE_EDGE',
  'DRILL_DOWN',
  'HARVEST_STREAM',
  'CLUSTER_PROBE',
  'FILTER_BRUSH',
  'RESONANCE_PULSE',
  'FORK_PLANE',
  'CHRONO_DIAL',
  'CONSTELLATION',
  'BEACON',
  'ALEPH',
  'FREQUENCY_PROBE',
]);

export interface RepresentationGraphRuntimeSpec {
  primitiveId: string;
  spec: MonetaSpec;
  utilityScore: number;
}

function renderablePrimitive(graph: RepresentationGraph): RepresentationPrimitive {
  const renderable = graph.primitives.filter((primitive) =>
    typeof primitive.visualEncoding.geometry === 'string'
  );

  if (renderable.length !== 1) {
    throw new Error(
      `Spatial Runtime currently requires exactly one embodied representation primitive; received ${renderable.length}. ` +
        'Multi-primitive composition must be implemented explicitly rather than flattened.'
    );
  }

  return renderable[0];
}

function requireEnum<T extends string>(
  value: string | undefined,
  allowed: ReadonlySet<T>,
  label: string,
): T {
  if (!value || !allowed.has(value as T)) {
    throw new Error(`RepresentationGraph cannot be embodied: invalid ${label} '${value ?? ''}'`);
  }
  return value as T;
}

/**
 * Compile a validated RepresentationGraph into the current renderer contract.
 *
 * This adapter intentionally supports one embodied primitive only. Metadata-only
 * composition nodes such as DETAIL_EXPANSION may coexist, but genuinely
 * multi-primitive rendering fails closed until Spatial Runtime implements it.
 */
export function representationGraphToRuntimeSpec(
  graph: RepresentationGraph,
): RepresentationGraphRuntimeSpec {
  assertRepresentationGraph(graph);
  const primary = renderablePrimitive(graph);
  const encoding = primary.visualEncoding;

  const layout = requireEnum(graph.layoutPolicy, VALID_LAYOUTS, 'layout');
  if (encoding.layout && encoding.layout !== layout) {
    throw new Error(
      `RepresentationGraph cannot be embodied: primitive layout '${encoding.layout}' conflicts with graph layoutPolicy '${layout}'`
    );
  }

  const geometry = requireEnum(encoding.geometry, VALID_GEOMETRIES, 'geometry');
  const behavior = requireEnum(encoding.behavior, VALID_BEHAVIORS, 'behavior');
  const interaction = requireEnum(encoding.interaction, VALID_INTERACTIONS, 'interaction');
  const rawUtility = primary.parameters.utilityScore;
  const utilityScore = typeof rawUtility === 'number' && Number.isFinite(rawUtility) ? rawUtility : 0;

  return {
    primitiveId: primary.id,
    spec: { layout, geometry, behavior, interaction },
    utilityScore,
  };
}
