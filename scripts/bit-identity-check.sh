#!/usr/bin/env bash
# Bit-identity gate: byte-compare run-sim CATS JSONL between the working
# tree and a git ref (default HEAD~1).
#
#   scripts/bit-identity-check.sh [ref] [seeds] [rolls] [bankroll]
#
# Runs `run-sim --strategy CATS --rolls <rolls> --bankroll <bankroll>
# --seed <s> --output json` for seeds 0..seeds-1 on both versions and diffs
# byte-for-byte. Exits 0 and prints IDENTICAL only if every seed matches.
#
# The single normalization applied before comparing: the summary line's
# `timestamp` field (wall-clock time of the run, not simulation output) is
# stripped. Every roll record is compared without any normalization.
set -euo pipefail

normalize() {
  sed 's/"timestamp":"[^"]*"/"timestamp":"X"/'
}

REF="${1:-HEAD~1}"
SEEDS="${2:-100}"
ROLLS="${3:-300}"
BANKROLL="${4:-300}"

ROOT="$(git rev-parse --show-toplevel)"
WORK="$(mktemp -d)"
trap 'git -C "$ROOT" worktree remove --force "$WORK/ref" 2>/dev/null || true; rm -rf "$WORK"' EXIT

echo "Comparing working tree vs $REF (seeds 0-$((SEEDS-1)), $ROLLS rolls, \$$BANKROLL)"
git -C "$ROOT" worktree add --detach "$WORK/ref" "$REF" >/dev/null
ln -s "$ROOT/node_modules" "$WORK/ref/node_modules"

mkdir -p "$WORK/a" "$WORK/b"
for ((s=0; s<SEEDS; s++)); do
  (cd "$ROOT"      && npx ts-node src/cli/run-sim.ts --strategy CATS --rolls "$ROLLS" --bankroll "$BANKROLL" --seed "$s" --output json) | normalize > "$WORK/a/$s.jsonl"
  (cd "$WORK/ref"  && npx ts-node src/cli/run-sim.ts --strategy CATS --rolls "$ROLLS" --bankroll "$BANKROLL" --seed "$s" --output json) | normalize > "$WORK/b/$s.jsonl"
  if ! cmp -s "$WORK/a/$s.jsonl" "$WORK/b/$s.jsonl"; then
    echo "DIFFERS at seed $s:"
    diff <(head -c 2000 "$WORK/a/$s.jsonl") <(head -c 2000 "$WORK/b/$s.jsonl") | head -20 || true
    exit 1
  fi
done

echo "IDENTICAL across $SEEDS seeds"
