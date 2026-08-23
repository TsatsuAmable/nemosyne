import { VRTopologyTranslator } from '../moneta/VRTopologyTranslator.ts';
import { InstancedPointCloud } from './scalability/InstancedPointCloud.ts';
import { ChartPlane } from './artifacts/ChartPlane.ts';
import * as MetaphorActions from './interactions/MetaphorActions.ts';

let registered = false;

export function registerVRFactories(): void {
  if (registered) return;
  registered = true;

  VRTopologyTranslator.registerPointCloudFactory(
    (count, geom) => new InstancedPointCloud(count, geom)
  );

  VRTopologyTranslator.registerChartPlaneFactory(
    (facts, dataset, options) => ChartPlane.fromFacts(facts, dataset, options)
  );

  VRTopologyTranslator.registerMetaphorActions({
    applyResonancePulse: MetaphorActions.applyResonancePulse,
    applyForkPlane: MetaphorActions.applyForkPlane,
    applyChronoDial: MetaphorActions.applyChronoDial,
    applyConstellation: MetaphorActions.applyConstellation,
    applyBeacon: MetaphorActions.applyBeacon,
    applyAleph: MetaphorActions.applyAleph,
  });
}

// Auto-register on import
registerVRFactories();
