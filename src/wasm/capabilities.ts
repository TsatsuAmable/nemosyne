/**
 * Authoritative TypeScript mirror of the Rust WASM capability flags defined in `wasm/src/lib.rs`.
 *
 * All bits are diagnostic / telemetry flags only (CLAUDE.md: "no production code
 * routes between analytical impls at runtime").
 */

export const CapabilityFlags = {
  DATASET_RUST: 1 << 0,
  PARSER_RUST: 1 << 1,
  OPERATIONS_RUST: 1 << 2,
  DRACO_RUST: 1 << 3,
  SCENE_RUST: 1 << 4,
  INPUT_RUST: 1 << 5,
  NETWORK_RUST: 1 << 6,
  COMMAND_BUFFER: 1 << 7,
  INSTANCING: 1 << 8,
  WASM_TELEMETRY: 1 << 9,
  TOPOLOGY_RUST: 1 << 10,
  TDA_RUST: 1 << 11,
  ENCODINGS_RUST: 1 << 12,
  STATS_RUST: 1 << 13,
} as const;

export type CapabilityName = keyof typeof CapabilityFlags;
