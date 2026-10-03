import { canonicalSha256Hex } from '../../security/CryptoHash.js';

export const KB0_MANIFEST_SCHEMA_VERSION = 1 as const;

export interface KB0TransformRecord {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly digest: string;
}

export interface KB0ManifestV1 {
  readonly schemaVersion: typeof KB0_MANIFEST_SCHEMA_VERSION;
  readonly manifestId: string;
  readonly body: {
    readonly transforms: readonly KB0TransformRecord[];
    readonly channels: readonly string[];
    readonly recipes: readonly string[];
  };
}

export function createKB0Manifest(): KB0ManifestV1 {
  const body = {
    transforms: [
      {
        id: 'transform-spatial-3d',
        name: 'Spatial 3D Coordinate Mapping',
        category: 'GEOMETRY',
        digest: canonicalSha256Hex({ name: 'Spatial 3D Coordinate Mapping' }),
      },
      {
        id: 'transform-color-density',
        name: 'Continuous Density Color Scale',
        category: 'COLOR',
        digest: canonicalSha256Hex({ name: 'Continuous Density Color Scale' }),
      },
    ],
    channels: ['spatial_x', 'spatial_y', 'spatial_z', 'color_hue', 'scale_volume'],
    recipes: ['recipe-aggregate-grid-v1', 'recipe-density-field-v1'],
  };

  const manifestId = `kb0-manifest-v1:${canonicalSha256Hex(body)}`;
  return {
    schemaVersion: KB0_MANIFEST_SCHEMA_VERSION,
    manifestId,
    body,
  };
}
