# Analytics Guide — Stage Metrics and Threshold Sweeps

*Documentation for the simulator's analytic layer: `src/cli/analyze-stages.ts` and `src/cli/sweep-thresholds.ts`, which sit atop `run-sim.ts` and the stage-machine DSL. Covers the commands, what they output, what each number means, and — importantly — what these tools can and cannot tell you.*

---

## 1. Overview

The analytic layer answers session-level questions the per-roll simulator can't answer directly: *how often does a strategy reach each stage, how long does it take, where does the time go, what does each stage cost empirically, and how do sessions end?* It exists because a staged strategy's document-level math (per-bet edges, per-roll costs) says nothing about path-dependent properties — stage-reach probability, grind time, ruin rates — which turn out to drive both the player experience and the design decisions.

Two tools:

| Tool | Question it answers |
|---|---|
| `analyze-stages` | Per-stage and per-session metrics for one strategy at one configuration |
| `sweep-thresholds` | How those metrics respond to moving the CATS Stage 1→2 profit gate |

Both are strategy-aware but not CATS-specific: `analyze-stages` works for any registered staged strategy (the stage display ordering knows both the CATS ladder and the BATS/Dolly stages; unrecognized stages append in encounter order).

## 2. analyze-stages

### Running it

Two modes. **Internal mode** runs sessions itself:

```
npx ts-node src/cli/analyze-stages.ts --strategy CATS --rolls 300 \
    --bankroll 300 --seeds 2000 --stop-at-ruin --output text
```

**JSONL mode** consumes a directory of per-session files previously produced by `run-sim.ts --output json`:

```
npx ts-node src/cli/analyze-stages.ts --jsonl-dir ./sessions --output json
```

| Flag | Meaning | Default |
|---|---|---|
| `--strategy <name>` | Registered strategy to simulate (internal mode) | — (this or `--jsonl-dir` required) |
| `--jsonl-dir <path>` | Directory of run-sim JSONL session files (JSONL mode) | — |
| `--rolls <n>` | Roll cap per session | 1000 |
| `--bankroll <n>` | Buy-in per session | 300 |
| `--seeds <n>` | Number of sessions; seeds run 0..n−1 deterministically | 2000 |
| `--stop-at-ruin` | End a session when it can no longer fund its bets | off |
| `--output text\|json` | Human table or machine-readable report | text |

There is also a programmatic API: `analyzeWithFactory(...)` is exported and is how `sweep-thresholds` reuses the aggregation.

### What it outputs

**Per stage:**

| Field | Definition |
|---|---|
| Reach % | Fraction of sessions that *ever* enter the stage |
| Med / P90 entry | Median and p90 rolls to first entry — computed **among sessions that reach the stage** (see limitations) |
| Time % | Share of all simulated rolls attributed to the stage |
| E[loss]/100 | Empirical expected loss per 100 rolls while in the stage (see methodology; see limitations before quoting this for rarely-occupied stages) |

**Per session set:** P&L p10/p50/p90, % of sessions ending positive, % ending at ruin.

## 3. Methodology — how the numbers are computed

**Equity accounting.** Loss is measured as the per-roll change in *equity* — rack plus money on the felt — after each roll's payouts settle. Moving money onto the table is therefore not counted as loss, and the session P&L definition matches the strategy document's §3.7 profit accounting exactly. This is the correct convention for a staged strategy, where stepping up moves large sums from rack to felt without losing anything.

**Stage attribution.** Each roll is attributed to `stagePlayed` — the stage whose `board()` built the bets that actually rode that roll — falling back to `stageName` for older JSONL without the field. This matters at transitions: the roll where a stage change is *decided* is charged to the stage whose bets were at risk, not the incoming stage.

**Determinism.** Internal mode runs seeds 0..N−1. Repeat runs with the same flags reproduce exactly; two configurations run at the same `--seeds` share dice sequences, so differences between them reflect the configuration, not luck.

**Ruin.** With `--stop-at-ruin`, a session ends when the strategy cannot fund its desired board; the session is flagged ruined and its rolls stop accruing. Without the flag, sessions run to the roll cap regardless. For any question about *session outcomes*, use the flag — a "session" that keeps rolling after it cannot bet is a simulation artifact, not a session.

## 4. sweep-thresholds

```
npx ts-node src/cli/sweep-thresholds.ts --gates 40,55,70,85,100 \
    --rolls 1000 --bankroll 300 --seeds 2000
```

For each gate value, `CATS({ stage2Gate })` scales all higher ladder gates proportionally (`gate/70`, rounded to the dollar); the §3.4 hard-reset floor stays fixed at $20. Reports per gate: Stage-2 reach %, median rolls to Stage 2, session P&L p10/p50/p90, % positive, and ruin rate. Seeds are shared across gate values — column differences reflect the gate, not the dice. Defaults: gates `40,55,70,85,100`, 1000 rolls, $300, 2000 seeds, text output.

The committed baseline run lives in `docs/cats-threshold-sensitivity.md`. Its headline: the gate is not an EV knob; it trades *participation* (how often and how soon sessions reach the Molly stages) against *capitalization quality* once there, while the left tail stays pinned by sessions that never escape the Accumulator over long horizons.

## 5. What the metrics are for

| Question | Metric to use |
|---|---|
| "Does the engine match the strategy doc's math?" | E[loss]/100 for *well-occupied* stages vs. the theoretical values in `cats-strategy.md` §1.4 |
| "How much of a session is grind vs. Alpha play?" | Time % by stage — the session-experience metric |
| "How often does the ladder actually get climbed?" | Reach % per stage |
| "How long until the fun starts?" | Median entry to Little Molly (and beyond) |
| "What do sessions look like when they end?" | P&L percentiles, % positive, ruin rate — **always quoted with their roll cap and bankroll** |
| "Should a threshold move?" | The sweep — as *input* to a design decision, never as an automatic answer |

## 6. Limitations — read before quoting numbers

1. **Selection bias in per-stage E[loss] for rarely-occupied stages.** You only occupy high stages while winning, so their empirical cost is measured on lucky rolls. A stage holding <2–3% of total rolls can show absurd values (a negative "loss," i.e., apparent profit, of −$137/100 has been observed for `threePtMollyLoose` at 0.6% occupancy). For such stages, the theoretical figures in the strategy doc are the truth; the empirical column validates only well-occupied stages. Check `Time %` before believing `E[loss]/100`.
2. **Horizon sensitivity.** The strategy has no exit rules, so ruin is the only absorbing state and every outcome metric worsens monotonically with the roll cap (observed: 12.8% ruin at 300 rolls vs 53.8% at 1000 for CATS/$300). No P&L or ruin number is meaningful without its `--rolls` and `--bankroll` attached. Never compare runs across different caps.
3. **Censoring at the roll cap.** Sessions truncate at `--rolls`; entry-time p90s near the cap are censored (the true p90 may be "never within a session"), and reach % is reach-within-cap, not reach-ever.
4. **Survivorship in entry times.** Median/p90 rolls-to-entry are computed among sessions that reached the stage. "Median 122 rolls to Loose Molly" describes the 27% of sessions that got there, not a typical session.
5. **Model boundary.** The engine implements the strategy document's conventions (place/buy off on come-out, buy vig 5% of bet charged on win). It does not model: comps, tips, dealer pace variation, table changes mid-session, other players' effect on pace, or discretionary off-book bets. Simulated "hours" are rolls ÷ ~100/hr, a convention, not a measurement.
6. **Deterministic seeds cut both ways.** Reproducibility is exact, but a specific seed set is one draw of 2000 sessions; percentile estimates carry sampling error of roughly ±1–2 points at that N. Rerun at a different seed offset (or larger N) before treating a 1-point difference as real.

## 7. Reproducing the committed results

The strategy document's §4.1 figures: `analyze-stages --strategy CATS --rolls 1000 --bankroll 300 --seeds 2000 --stop-at-ruin`. The realistic-session comparison quoted in review discussions: same with `--rolls 300`. The threshold sensitivity table: the exact command at the top of `docs/cats-threshold-sensitivity.md`. All are deterministic and should reproduce to the dollar.
