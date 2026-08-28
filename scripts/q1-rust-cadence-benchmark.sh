#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-}"
RESULT_DIR="${Q1_RESULT_DIR:-q1-rust-cadence-results}"
MANIFEST="wasm/Cargo.toml"
TIME_BIN="/usr/bin/time"
mkdir -p "$RESULT_DIR"

measure() {
  local label="$1"
  shift
  "$TIME_BIN" -f "${label}|%e|%M|%U|%S" -o "$RESULT_DIR/timings.txt" -a "$@"
}

clean_target() {
  cargo clean --manifest-path "$MANIFEST" >/dev/null
}

run_cargo_pair() {
  clean_target
  measure cargo-test-cold cargo test --manifest-path "$MANIFEST"
  measure cargo-test-warm cargo test --manifest-path "$MANIFEST"
}

run_nextest_pair() {
  clean_target
  measure nextest-cold cargo nextest run --manifest-path "$MANIFEST"
  measure nextest-warm cargo nextest run --manifest-path "$MANIFEST"
}

record_inventory() {
  cargo test --manifest-path "$MANIFEST" -- --list >"$RESULT_DIR/cargo-test-list.txt" 2>&1
  cargo nextest list --manifest-path "$MANIFEST" >"$RESULT_DIR/nextest-list.txt" 2>&1
  grep -c ': test$' "$RESULT_DIR/cargo-test-list.txt" >"$RESULT_DIR/cargo-test-count.txt" || true
}

run_failure_fixture() {
  local fixture
  fixture="$(mktemp -d)"
  trap 'rm -rf "$fixture"' RETURN
  cat >"$fixture/Cargo.toml" <<'TOML'
[package]
name = "q1-failure-fixture"
version = "0.0.0"
edition = "2021"
TOML
  mkdir -p "$fixture/src"
  cat >"$fixture/src/lib.rs" <<'RUST'
#[cfg(test)]
mod tests {
    #[test]
    fn passing_control() {
        assert_eq!(2 + 2, 4);
    }

    #[test]
    fn deliberate_failure() {
        assert_eq!("expected", "deliberate-failure");
    }
}
RUST

  set +e
  cargo test --manifest-path "$fixture/Cargo.toml" >"$RESULT_DIR/cargo-test-failure.txt" 2>&1
  local cargo_status=$?
  cargo nextest run --manifest-path "$fixture/Cargo.toml" >"$RESULT_DIR/nextest-failure.txt" 2>&1
  local nextest_status=$?
  set -e

  if [[ $cargo_status -eq 0 || $nextest_status -eq 0 ]]; then
    echo "Expected both runners to fail the deliberate failure fixture" >&2
    exit 1
  fi
  printf 'cargo-test=%s\nnextest=%s\n' "$cargo_status" "$nextest_status" >"$RESULT_DIR/failure-exit-codes.txt"
}

case "$MODE" in
  runner)
    : "${Q1_RUNNER_ORDER:?Q1_RUNNER_ORDER is required for runner mode}"
    printf 'runner_order=%s\n' "$Q1_RUNNER_ORDER" >"$RESULT_DIR/environment.txt"
    rustc --version >>"$RESULT_DIR/environment.txt"
    cargo --version >>"$RESULT_DIR/environment.txt"
    cargo nextest --version >>"$RESULT_DIR/environment.txt"
    case "$Q1_RUNNER_ORDER" in
      cargo-first)
        run_cargo_pair
        run_nextest_pair
        ;;
      nextest-first)
        run_nextest_pair
        run_cargo_pair
        ;;
      *)
        echo "Unsupported Q1_RUNNER_ORDER: $Q1_RUNNER_ORDER" >&2
        exit 2
        ;;
    esac
    record_inventory
    run_failure_fixture
    ;;

  sccache)
    printf 'mode=sccache\n' >"$RESULT_DIR/environment.txt"
    rustc --version >>"$RESULT_DIR/environment.txt"
    cargo --version >>"$RESULT_DIR/environment.txt"
    sccache --version >>"$RESULT_DIR/environment.txt"

    export CARGO_INCREMENTAL=0
    clean_target
    measure cargo-test-no-sccache-cold cargo test --manifest-path "$MANIFEST"

    clean_target
    export SCCACHE_DIR="${SCCACHE_DIR:-$RUNNER_TEMP/nemosyne-q1-sccache}"
    rm -rf "$SCCACHE_DIR"
    mkdir -p "$SCCACHE_DIR"
    sccache --stop-server >/dev/null 2>&1 || true
    sccache --zero-stats >/dev/null
    export RUSTC_WRAPPER=sccache
    measure cargo-test-sccache-cold cargo test --manifest-path "$MANIFEST"

    clean_target
    measure cargo-test-sccache-rebuild cargo test --manifest-path "$MANIFEST"
    sccache --show-stats >"$RESULT_DIR/sccache-stats.txt"
    ;;

  *)
    echo "Usage: $0 {runner|sccache}" >&2
    exit 2
    ;;
esac

cat "$RESULT_DIR/timings.txt"
