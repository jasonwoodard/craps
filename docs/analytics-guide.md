# Analytics Guide — I/O Contracts and Evaluator Usage

This guide documents the data contracts between the simulator's producers
(`run-sim`) and consumers (`analyze-stages`, the stopping-rule evaluator,
comparison mode, and the server), plus how to use the analysis tools and
what their limitations are. Schemas here are versioned by the manifest's
`schemaVersion` (currently **1**).

## 1. JSONL per-roll record (produced by `run-sim --output json`)

One JSON object per line. Three record types; consumers must skip lines
whose `type` they do not recognize.

```jsonc
// First line of a run:
{ "type": "manifest", "manifest": { /* see §4 */ } }

// One per roll:
{
  "type": "roll",
  "roll": { "number": 1, "die1": 3, "die2": 4, "sum": 7 },
  "gameState": { "pointBefore": null, "pointAfter": null },
  "players": [{
    "id": "player1",
    "strategy": "CATS@entry=littleMolly",       // canonical spec
    "stageName": "littleMolly",                  // stage AFTER the roll's events settle
    "stagePlayed": "littleMolly",                // stage whose board PLAYED the roll — use for attribution
    "bankroll": { "before": 300, "after": 264, "change": -36 },
    "tableLoad": { "before": 36, "after": 36, "betCount": 2 },
    "activeBets": [{ "type": "place", "point": 6, "amount": 18, "odds": 0 }],
    "outcomes": [{ "type": "place", "point": 6, "result": "win", "payout": 39 }]
  }]
}

// Last line:
{ "type": "summary", "meta": { /* strategy, seed, timestamp… */ }, /* bankroll, activity, diceDistribution */ }
```

The aggregator consumes exactly these fields per roll:

| Field | Used for |
|---|---|
| `players[0].stagePlayed` (fallback `stageName`) | per-stage attribution, fall-below-stage rule |
| `players[0].bankroll.after + tableLoad.after` | **equityAfter** — the per-roll equity trajectory |
| `players[0].activeBets.length` + `tableLoad.before` | ruin detection (a roll beginning with an empty felt ends a ruined session) |

Notes: `stageName` is captured after post-roll events, so a stage's
exit-winning roll is credited to the *next* stage under `stageName`;
`stagePlayed` is the attribution-correct field. `tableLoad.after` is a
post-settlement snapshot (winning bets already taken down).

## 2. Analyze report (JSON) — `analyze-stages --output json`

```jsonc
{
  "sessions": 2000,
  "rollsPerSession": 300,
  "bankroll": 300,
  "totalRolls": 412345,
  "stages": [{
    "stage": "littleMolly",
    "reachProbability": 0.72,          // fraction of sessions that ever enter
    "medianRollsToFirstEntry": 81,     // among sessions that reach it
    "p90RollsToFirstEntry": 421,
    "timeInStagePct": 6.1,             // % of all rolls played on this stage's board
    "lossPer100Rolls": 7.58,           // per-roll EQUITY change attributed by stagePlayed
    "rollsObserved": 88933
  }],
  "pnl": { "p10": -297, "p50": -289, "p90": 90 },
  "pctSessionsPositive": 17.9,
  "pctSessionsRuined": 53.8,
  "stopping": { /* see §3 */ },
  "manifest": { /* see §4 */ }
}
```

Comparison mode (`--strategy A --strategy B …`) emits an **array** of
`{ "spec": "<canonical>", "report": <analyze report> }`, one entry per spec,
all run on the identical seed range (0..seeds−1 — same dice per seed).

## 3. Stopping-rule report — `report.stopping`

Computed in one pass while sessions play fully out. The rules never stop the
simulation; each banks the equity of the roll on which it fires.

```jsonc
{
  "rules": [{
    "rule": "target-2x",               // none | target-{2,3,6}x | trail | below-stage | cap-{100,200,300}
    "params": { "k": 2 },              // trail: {drop}; below-stage: {slug}; caps: {rolls}
    "triggerRate": 0.18,               // fired before session end
    "ruinRate": 0.15,                  // session ruined before the rule fired
    "censoredRate": 0.67,              // horizon reached without firing — banked = final P&L
    "banked": { "p10": -293, "p50": -61, "p90": 319 },
    "pctPositive": 35.0,
    "peakCapture": 0.41                // Σ(exit P&L) ÷ Σ(peak P&L) over peak-positive paths
  }],
  "hitting": [{ "k": 2, "pHitBeforeRuin": 0.18, "censoredFraction": 0.67 }],
  "peakPnl": { "p10": 12, "p25": 39, "p50": 77, "p75": 208, "p90": 515, "p99": 1346 }
}
```

Rule semantics:

- **none** — never fires; banked = final P&L. Reproduces the session P&L
  metrics to the dollar (pinned by spec).
- **target-kx** — fires when equity ≥ k·B; banks the crossing roll's equity.
- **trail** — fires when equity ≤ running peak − d (d = B/3 default,
  `--trail-drop` to configure). The starting bankroll seeds the peak, so a
  straight decline fires at −d (a stop-loss is the degenerate trailing floor).
- **below-stage** — arms once the session's `stagePlayed` reaches the
  configured slug's ladder level, fires on the first roll below it
  (`--exit-below-stage <slug>`; default = the ladder's first gated stage).
- **cap-N** — fires at roll N; banks that roll's equity.

**Limitations.** *Censoring:* a censored session (horizon reached, rule
unfired) contributes its final P&L to the rule's banked distribution — for
slow rules at short horizons the banked numbers are dominated by censoring,
which is why censoredRate is always reported alongside; hitting
probabilities state their censored fraction for the same reason.
*Peak-capture* is a ratio of sums (mean-of-ratios explodes when peaks are
near zero) and is only over peak-positive paths. *Fall-below-stage* needs a
ladder: it is omitted for non-staged strategies and for `--jsonl-dir` runs
without a `--strategy` spec to resolve the ladder against.

**Dual-path validation.** The streaming evaluator (incremental per-roll
state) is validated against an independent post-hoc implementation that
truncates archived JSONL trajectories; `scripts/dual-path-check.ts` asserts
exact equality on 500 seeds, and the spec suite re-runs the equality on
smaller slices plus hand-built trajectories. If you add a rule, extend both
implementations and the check.

## 4. Run manifest (embedded in every output mode)

```jsonc
{
  "schemaVersion": 1,
  "strategySpec": "CATS@entry=threePtMollyLoose",  // canonical; "jsonl:<dir>" for re-analysis
  "tableMin": 10,
  "bankroll": 300,
  "rolls": 300,
  "seeds": { "count": 1000 },                       // or { "seed": 7 } / { "seed": null }
  "engineVersion": "8f3bee4",                       // git short sha (ENGINE_VERSION fallback)
  "generatedAt": "2026-08-12T15:38:49.740Z"         // wall-clock; EXCLUDED from identity
}
```

Determinism makes the manifest the archive: a run is fully reproducible from
the identity fields. The server memoizes aggregates keyed by
`manifestHash(manifest)` — a sha256 of the recursively key-sorted manifest
minus `generatedAt`. Byte-for-byte comparisons of JSONL across runs must
normalize `generatedAt` (and the summary line's `timestamp`); everything
else is deterministic per seed.

## 5. Usage

```bash
# Single spec, stage metrics + stopping menu:
npx ts-node src/cli/analyze-stages.ts --strategy CATS --rolls 1000 --bankroll 300 \
    --seeds 2000 --stop-at-ruin [--trail-drop 100] [--exit-below-stage littleMolly]

# Funded entry and table minimum via canonical specs:
npx ts-node src/cli/analyze-stages.ts --strategy CATS@entry=threePtMollyLoose,tableMin=15 ...

# Side-by-side comparison on shared seeds (the v4 target workflow):
npx ts-node src/cli/analyze-stages.ts \
    --strategy CATS@entry=accumulator --strategy CATS@entry=threePtMollyLoose \
    --rolls 300 --bankroll 300 --seeds 1000 --stop-at-ruin [--output json]

# Post-hoc re-analysis of archived trajectories:
npx ts-node src/cli/analyze-stages.ts --jsonl-dir ./sessions [--strategy CATS]  # spec resolves the ladder

# Validation gates:
scripts/bit-identity-check.sh [ref]        # byte-identical JSONL vs a git ref
npx ts-node scripts/dual-path-check.ts     # streaming === post-hoc, 500 seeds
```
