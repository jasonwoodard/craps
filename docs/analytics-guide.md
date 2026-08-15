# Analytics Guide — Stage Metrics, Stopping Rules, and I/O Contracts

*Documentation for the simulator's analytic layer: `src/cli/analyze-stages.ts` (stage metrics, the stopping-rule menu, multi-spec comparison) and `src/cli/sweep-thresholds.ts`, which sit atop `run-sim.ts` and the stage-machine DSL. Covers the commands, what they output, what each number means, the data contracts between producers and consumers, and — importantly — what these tools can and cannot tell you.*

---

## 1. Overview

The analytic layer answers session-level questions the per-roll simulator can't answer directly: *how often does a strategy reach each stage, how long does it take, where does the time go, what does each stage cost empirically, how do sessions end — and how would they have ended under a disciplined exit rule?* It exists because a staged strategy's document-level math (per-bet edges, per-roll costs) says nothing about path-dependent properties — stage-reach probability, grind time, ruin rates, peak capture — which turn out to drive both the player experience and the design decisions.

| Tool | Question it answers |
|---|---|
| `analyze-stages` | Per-stage and per-session metrics for one strategy spec; the stopping-rule menu; side-by-side comparison of multiple specs on shared dice |
| `sweep-thresholds` | How the metrics respond to moving the CATS Stage 1→2 profit gate |

Both are strategy-aware but not CATS-specific: `analyze-stages` works for any registered staged strategy (the stage display ordering knows both the CATS ladder and the BATS/Dolly stages; unrecognized stages append in encounter order), and funded entry, spec parsing, and the fall-below-stage rule all resolve through each strategy's own exported stage metadata.

Every output mode embeds a versioned **run manifest** (§8): determinism makes the manifest the archive — a run is fully reproducible from a few hundred bytes, which is also how the server memoizes aggregates.

## 2. analyze-stages — running it

Three modes. **Internal mode** runs sessions itself:

```
npx ts-node src/cli/analyze-stages.ts --strategy CATS --rolls 300 \
    --bankroll 300 --seeds 2000 --stop-at-ruin --output text
```

**Comparison mode** repeats `--strategy`; every spec runs on the identical seed range (same dice per seed), and output renders side-by-side (this is the v4 target workflow):

```
npx ts-node src/cli/analyze-stages.ts \
    --strategy CATS@entry=accumulator --strategy CATS@entry=threePtMollyLoose \
    --rolls 300 --bankroll 300 --seeds 1000 --stop-at-ruin
```

**JSONL mode** consumes a directory of per-session files previously produced by `run-sim.ts --output json`:

```
npx ts-node src/cli/analyze-stages.ts --jsonl-dir ./sessions [--strategy CATS] --output json
```

| Flag | Meaning | Default |
|---|---|---|
| `--strategy <spec>` | Strategy spec `NAME[@key=value,...]` — keys `entry` (funded-entry stage slug) and `tableMin`. Repeatable for comparison mode. | — (this or `--jsonl-dir` required) |
| `--jsonl-dir <path>` | Directory of run-sim JSONL session files (add `--strategy` to resolve the ladder for the fall-below-stage rule) | — |
| `--rolls <n>` | Roll cap per session | 1000 |
| `--bankroll <n>` | Buy-in per session | 300 |
| `--seeds <n>` | Number of sessions; seeds run 0..n−1 deterministically | 2000 |
| `--stop-at-ruin` | End a session when it can no longer fund its bets | off |
| `--trail-drop <n>` | Trailing-floor stopping rule's drop d, in dollars | bankroll ÷ 3 |
| `--exit-below-stage <slug>` | Fall-below-stage stopping rule's slug | ladder's first gated stage |
| `--output text\|json` | Human table or machine-readable report | text |

There is also a programmatic API: `analyzeWithFactory(...)`, `runComparison(...)`, and the stopping evaluator are exported; `sweep-thresholds` reuses the aggregation this way.

## 3. What it outputs

**Per stage:**

| Field | Definition |
|---|---|
| Reach % | Fraction of sessions that *ever* enter the stage |
| Med / P90 entry | Median and p90 rolls to first entry — computed **among sessions that reach the stage** (see limitations) |
| Time % | Share of all simulated rolls attributed to the stage |
| E[loss]/100 | Empirical expected loss per 100 rolls while in the stage (see methodology; see limitations before quoting this for rarely-occupied stages) |

**Per session set:** P&L p10/p50/p90, % of sessions ending positive, % ending at ruin.

**Stopping-rule menu:** per rule, trigger/ruin/censored rates, banked P&L percentiles, % positive, peak-capture ratio; plus hitting probabilities P(k·B before ruin) and the peak-P&L distribution (§5).

Comparison mode renders columns = specs, rows = the above; JSON mode emits an array of `{ "spec": "<canonical>", "report": ... }`.

## 4. Methodology — how the numbers are computed

**Equity accounting.** Loss is measured as the per-roll change in *equity* — rack plus money on the felt — after each roll's payouts settle. Moving money onto the table is therefore not counted as loss, and the session P&L definition matches the strategy document's §3.7 profit accounting exactly. This is the correct convention for a staged strategy, where stepping up moves large sums from rack to felt without losing anything.

**Stage attribution.** Each roll is attributed to `stagePlayed` — the stage whose `board()` built the bets that actually rode that roll — falling back to `stageName` for older JSONL without the field. This matters at transitions: the roll where a stage change is *decided* is charged to the stage whose bets were at risk, not the incoming stage.

**Determinism.** Internal mode runs seeds 0..N−1. Repeat runs with the same flags reproduce exactly; two configurations run at the same `--seeds` share dice sequences, so differences between them reflect the configuration, not luck. (The manifest's `generatedAt` and the summary line's `timestamp` are the only wall-clock fields — normalize them for byte comparisons.)

**Ruin.** With `--stop-at-ruin`, a session ends when the strategy cannot fund its desired board; the session is flagged ruined and its rolls stop accruing. Without the flag, sessions run to the roll cap regardless. For any question about *session outcomes*, use the flag — a "session" that keeps rolling after it cannot bet is a simulation artifact, not a session.

**Funded entry.** A spec like `CATS@entry=threePtMollyLoose` starts sessions in that stage with `origin = bankroll − gate(entry)`, so profit begins exactly at the stage's entry gate. The seven-out counter starts at zero for every entry. Any bankroll runs, including one below the entry gate (negative origin) — that is a documented experimental configuration, not an error.

## 5. The stopping-rule menu

Computed in one pass while sessions play fully out — the rules never stop the simulation; each banks the equity of the roll on which it fires, and the session continues for the remaining rules and the played-fully-out baseline.

Rule semantics:

- **none** — never fires; banked = final P&L. Reproduces the session P&L metrics to the dollar (pinned by spec).
- **target-kx** (k ∈ {2, 3, 6}) — fires when equity ≥ k·B; banks the crossing roll's equity.
- **trail** — fires when equity ≤ running peak − d (d = B/3 default, `--trail-drop` to configure). The starting bankroll seeds the peak, so a straight decline fires at −d (a stop-loss is the degenerate trailing floor).
- **below-stage** — arms once the session's `stagePlayed` reaches the configured slug's ladder level, fires on the first roll below it (`--exit-below-stage <slug>`; default = the ladder's first gated stage).
- **cap-N** (N ∈ {100, 200, 300}) — fires at roll N; banks that roll's equity.

Per-rule outcomes are three-way: **triggered** (banked = exit equity − B), **ruin** (session ruined before the rule fired; banked = final P&L), **censored** (horizon reached without firing; banked = final P&L). Alongside the rules, the report carries **hitting probabilities** — P(equity reached k·B before ruin), with the censored fraction stated — and the **peak-P&L distribution** (p10/p25/p50/p75/p90/p99) as a first-class output.

**Dual-path validation.** The streaming evaluator (incremental per-roll state) is validated against an independent post-hoc implementation that truncates archived JSONL trajectories; `scripts/dual-path-check.ts` asserts exact equality on 500 seeds, and the spec suite re-runs the equality on smaller slices plus hand-built trajectories. If you add a rule, extend both implementations and the check.

## 6. sweep-thresholds

```
npx ts-node src/cli/sweep-thresholds.ts --gates 40,55,70,85,100 \
    --rolls 1000 --bankroll 300 --seeds 2000
```

For each gate value, `CATS({ stage2Gate })` scales all higher ladder gates proportionally (`gate/70`, rounded to the dollar). Reports per gate: Stage-2 reach %, median rolls to Stage 2, session P&L p10/p50/p90, % positive, and ruin rate. Seeds are shared across gate values — column differences reflect the gate, not the dice. Defaults: gates `40,55,70,85,100`, 1000 rolls, $300, 2000 seeds, text output.

The committed baseline run lives in `docs/cats-threshold-sensitivity.md`. Its headline: the gate is not an EV knob; it trades *participation* (how often and how soon sessions reach the Molly stages) against *capitalization quality* once there, while the left tail stays pinned by sessions that never escape the Accumulator over long horizons. (The baseline table predates the hard-reset retirement; descent is now handled entirely by the chained retreat floors, which land in the same place — rerun the sweep before quoting its numbers against current code.)

## 7. What the metrics are for

| Question | Metric to use |
|---|---|
| "Does the engine match the strategy doc's math?" | E[loss]/100 for *well-occupied* stages vs. the theoretical values in `cats-strategy.md` §1.4 |
| "How much of a session is grind vs. Alpha play?" | Time % by stage — the session-experience metric |
| "How often does the ladder actually get climbed?" | Reach % per stage |
| "How long until the fun starts?" | Median entry to Little Molly (and beyond) |
| "What do sessions look like when they end?" | P&L percentiles, % positive, ruin rate — **always quoted with their roll cap and bankroll** |
| "When should a session walk?" | The stopping menu — trigger vs. censored rates, banked P&L, peak capture — as *analysis of exits*, not an in-strategy rule |
| "Is funded entry worth it?" | Comparison mode on shared seeds: classic vs. `@entry=` specs |
| "Should a threshold move?" | The sweep — as *input* to a design decision, never as an automatic answer |

## 8. I/O contracts

Schemas are versioned by the manifest's `schemaVersion` (currently **1**).

### 8.1 JSONL per-roll record (produced by `run-sim --output json`)

One JSON object per line. Three record types; consumers must skip lines whose `type` they do not recognize.

```jsonc
// First line of a run:
{ "type": "manifest", "manifest": { /* see §8.4 */ } }

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

Notes: `stageName` is captured after post-roll events, so a stage's exit-winning roll is credited to the *next* stage under `stageName`; `stagePlayed` is the attribution-correct field. `tableLoad.after` is a post-settlement snapshot (winning bets already taken down).

### 8.2 Analyze report (JSON) — `analyze-stages --output json`

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
  "stopping": { /* see §8.3 */ },
  "manifest": { /* see §8.4 */ }
}
```

Comparison mode emits an **array** of `{ "spec": "<canonical>", "report": <analyze report> }`, one entry per spec.

### 8.3 Stopping-rule report — `report.stopping`

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

### 8.4 Run manifest (embedded in every output mode)

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

Determinism makes the manifest the archive: a run is fully reproducible from the identity fields. The server memoizes aggregates keyed by `manifestHash(manifest)` — a sha256 of the recursively key-sorted manifest minus `generatedAt`. The server never persists trajectories; JSONL archives are a local/CLI workflow for retroactive rule analysis.

## 9. Limitations — read before quoting numbers

1. **Selection bias in per-stage E[loss] for rarely-occupied stages.** You only occupy high stages while winning, so their empirical cost is measured on lucky rolls. A stage holding <2–3% of total rolls can show absurd values (a negative "loss," i.e., apparent profit, of −$137/100 has been observed for `threePtMollyLoose` at 0.6% occupancy). For such stages, the theoretical figures in the strategy doc are the truth; the empirical column validates only well-occupied stages. Check `Time %` before believing `E[loss]/100`.
2. **Horizon sensitivity.** The strategy has no in-strategy exit rules, so ruin is the only absorbing state and every outcome metric worsens monotonically with the roll cap (observed: 12.8% ruin at 300 rolls vs 53.8% at 1000 for CATS/$300). No P&L or ruin number is meaningful without its `--rolls` and `--bankroll` attached. Never compare runs across different caps. (The stopping menu *analyzes* exits; it does not add them to the strategy.)
3. **Censoring — everywhere the horizon bites.** Sessions truncate at `--rolls`: entry-time p90s near the cap are censored (the true p90 may be "never within a session"), reach % is reach-within-cap, and a censored session contributes its final P&L to every unfired stopping rule's banked distribution — for slow rules at short horizons the banked numbers are dominated by censoring. That is why `censoredRate` sits beside every rule and hitting probabilities state their censored fraction.
4. **Survivorship in entry times.** Median/p90 rolls-to-entry are computed among sessions that reached the stage. "Median 122 rolls to Loose Molly" describes the 27% of sessions that got there, not a typical session.
5. **Peak-capture is a ratio of sums** (Σ exit ÷ Σ peak over peak-positive paths) — mean-of-ratios explodes when peaks are near zero. It is not defined when no session peaked positive.
6. **Fall-below-stage needs a ladder.** The rule is omitted for non-staged strategies and for `--jsonl-dir` runs without a `--strategy` spec to resolve the ladder against.
7. **Model boundary.** The engine implements the strategy document's conventions (place/buy off on come-out, buy vig 5% of bet charged on win). It does not model: comps, tips, dealer pace variation, table changes mid-session, other players' effect on pace, or discretionary off-book bets. Simulated "hours" are rolls ÷ ~100/hr, a convention, not a measurement.
8. **Deterministic seeds cut both ways.** Reproducibility is exact, but a specific seed set is one draw of 2000 sessions; percentile estimates carry sampling error of roughly ±1–2 points at that N. Rerun at a different seed offset (or larger N) before treating a 1-point difference as real.

## 10. Reproducing the committed results

The strategy document's §4.1 figures: `analyze-stages --strategy CATS --rolls 1000 --bankroll 300 --seeds 2000 --stop-at-ruin`. The realistic-session comparison quoted in review discussions: same with `--rolls 300`. The funded-entry teaser in PR #103: the comparison-mode command in §2 at 1000 seeds. The threshold sensitivity table: the exact command at the top of `docs/cats-threshold-sensitivity.md`. All are deterministic and should reproduce to the dollar.

Validation gates, runnable anytime:

```bash
scripts/bit-identity-check.sh [ref]        # byte-identical JSONL vs a git ref (timestamp-normalized)
npx ts-node scripts/dual-path-check.ts     # streaming === post-hoc stopping menu, 500 seeds
```
