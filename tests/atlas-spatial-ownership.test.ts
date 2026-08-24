import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string): string =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('Atlas and spatial embodiment ownership', () => {
  it('keeps raw kernel access in the Rust analytical evidence adapter', () => {
    const atlas = read('src/atlas/AtlasCore.ts');
    const adapter = read('src/atlas/adapters/RustAnalyticalEvidenceAdapter.ts');
    expect(atlas).toContain('RustAnalyticalEvidenceAdapter');
    expect(atlas).not.toMatch(/\b_kernel\b/);
    expect(adapter).toContain("from './AnalyticalKernelPort.ts'");
    expect(adapter).not.toMatch(/from ['"].*(?:domain|moneta|three)/);
    expect(adapter).not.toContain('InvestigationAggregate');
  });

  it('keeps the topology facade free of layout, encoding, and mutation implementations', () => {
    const facade = read('src/moneta/VRTopologyTranslator.ts');
    expect(facade).toContain('TopologyLayoutEmbodiment');
    expect(facade).toContain('ScalableTopologyEmbodiment');
    expect(facade).toContain('TopologyInteractionOwner');
    expect(facade).toContain('TimeRibbonArtifactUpdater');
    expect(facade).not.toMatch(/new THREE\.(?:Box|Sphere|Tube|Cylinder|Cone|Torus|Plane)/);
    expect(facade).not.toMatch(/(?:Grid|ForceDirected|RadialTree|GeoSurface)Layout/);
    expect(facade.split('\n').length).toBeLessThan(260);
  });

  it('prevents spatial embodiment owners from becoming analytical authorities', () => {
    const owners = [
      'src/moneta/embodiment/TopologyLayoutEmbodiment.ts',
      'src/moneta/embodiment/ScalableTopologyEmbodiment.ts',
      'src/moneta/embodiment/TopologyInteractionOwner.ts',
      'src/moneta/embodiment/TimeRibbonArtifactUpdater.ts',
    ].map(read);
    for (const owner of owners) {
      expect(owner).not.toMatch(/from ['"].*(?:atlas|wasm)/);
      expect(owner).not.toMatch(/(?:statistics|inferTopology|inferEncodings|runOperation)\s*\(/);
    }
  });
});
