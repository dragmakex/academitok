#!/usr/bin/env bash
# Two-phase validation: light checks parallel, heavy checks sequential.
set -uo pipefail

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

fail=0

# Phase 1: lightweight checks in parallel (~4s wall instead of ~8s)
bun run --silent typecheck       > "$tmp/typecheck.out"       2>&1 &
bun run --silent lint            > "$tmp/lint.out"            2>&1 &
bun run --silent lint:design-system > "$tmp/lint-ds.out"      2>&1 &
bun run --silent format:check    > "$tmp/format.out"          2>&1 &
bun run --silent docs:check      > "$tmp/docs.out"            2>&1 &

for pid in $(jobs -p); do
  wait "$pid" || fail=1
done

# Phase 2: heavy checks sequential (~45s, but fits in 4GB)
bun run --silent test:coverage   > "$tmp/test-cov.out"   2>&1 || fail=1
bun run --silent test:component  > "$tmp/test-comp.out"  2>&1 || fail=1
bun run --silent perf:check      > "$tmp/perf.out"       2>&1 || fail=1

# Report
for f in "$tmp"/*.out; do
  name=$(basename "$f" .out)
  if [ -s "$f" ] && grep -qiE 'error|fail|not formatted' "$f"; then
    echo "  ❌ $name"
  else
    echo "  ✅ $name"
  fi
done

if [ "$fail" -ne 0 ]; then
  echo ""
  for f in "$tmp"/*.out; do
    name=$(basename "$f" .out)
    if grep -qiE 'error|fail|not formatted' "$f"; then
      echo "── $name ──"
      cat "$f"
      echo ""
    fi
  done
  echo "❌ Validation failed."
  exit 1
fi

echo ""
echo "✅ All checks passed."
