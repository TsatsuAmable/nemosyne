/**
 * Memory Palace Epistemic Object System — P1-U7
 *
 * Public API for the Memory Palace epistemic object contracts consumed by
 * the deterministic InvestigationAggregate projection
 * (MemoryPalaceWorldView). The dormant MemoryPalaceGraph store was retired
 * per ADR-0012 and must not be reintroduced as an authority.
 */

export * from './EpistemicObject.ts';

export { EPISTEMIC_COLORS, EPISTEMIC_CUES } from './EpistemicObject.ts';
