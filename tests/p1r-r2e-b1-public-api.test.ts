import { describe, expect, it } from 'vitest';
import {
  SOURCE_RELATIONSHIP_GRAPH_AUTHORITY_KIND,
  createSourceRelationshipGraphAuthority,
} from '../src/moneta/index.ts';

describe('P1-R2E B1 public representation API', () => {
  it('exports the source relationship graph authority contract through the consumer facade', () => {
    expect(SOURCE_RELATIONSHIP_GRAPH_AUTHORITY_KIND).toBe('SOURCE_EDGES');
    expect(createSourceRelationshipGraphAuthority('DIRECTED')).toMatchObject({
      kind: 'SOURCE_EDGES',
      directionality: 'DIRECTED',
      nodeIdentity: 'DATASET_ROW',
    });
  });
});
