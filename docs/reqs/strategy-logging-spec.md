# Strategy Logging Specification

This document defines the schema for simulation output logs. The goal is to capture enough information per roll to answer questions like:

- **How did my bankroll change over time?** (trajectory, drawdown)
- **How much was I risking on each roll?** (table load = dollars at risk)
- **What was the upside potential vs. what I had at risk?** (payout / table load ratio)
- **Is the dice RNG showing any skew?** (observed vs. expected distribution)
- **How do two strategies compare head-to-head?** (same seed, different strategies)

---

## Format: JSONL

Each roll is a single JSON object on its own line (newline-delimited JSON, `.jsonl`). This format:

- Streams well for large simulations (no need to hold the entire run in memory)
- Imports directly into Python/pandas, Excel Power Query, or any notebook
- Can be diffed between strategy runs line-by-line
- Appended to incrementally (no need to rewrite the file)

A session ends with a **summary record** — a single JSON object with `"type": "summary"` — appended as the last line.

---

## Per-Roll Entry Schema

```json
{
  "type": "roll",
  "roll": {
    "number": 42,
    "die1": 3,
    "die2": 5,
    "sum": 8
  },
  "gameState": {
    "pointBefore": 6,
    "pointAfter": 6
  },
  "players": [
    {
      "id": "alice",
      "strategy": "ThreePointMolly",
      "bankroll": {
        "before": 487,
        "after": 501,
        "change": 14
      },
      "tableLoad": {
        "before": 130,
        "after": 116,
        "betCount": 3
      },
      "activeBets": [
        { "type": "passLine", "point": 6,  "amount": 10, "odds": 20 },
        { "type": "come",     "point": 8,  "amount": 10, "odds": 20 },
        { "type": "come",     "point": 5,  "amount": 10, "odds": 20 }
      ],
      "outcomes": [
        { "type": "come", "point": 8, "result": "win", "payout": 34 }
      ]
    }
  ]
}
```

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"roll"` | Identifies this as a roll entry (vs. summary) |
| `roll.number` | integer | Sequential roll number within the session, starting at 1 |
| `roll.die1` | 1–6 | First die value — needed for skew/distribution analysis |
| `roll.die2` | 1–6 | Second die value |
| `roll.sum` | 2–12 | Sum of both dice |
| `gameState.pointBefore` | number \| null | The table point **before** this roll. `null` = come-out |
| `gameState.pointAfter` | number \| null | The table point **after** this roll resolved |
| `players[].id` | string | Player identifier |
| `players[].strategy` | string | Strategy name |
| `players[].bankroll.before` | number | Bankroll before this roll's resolution |
| `players[].bankroll.after` | number | Bankroll after payouts and losses collected |
| `players[].bankroll.change` | number | Net change (positive = win, negative = loss, 0 = no action) |
| `players[].tableLoad.before` | number | Total dollars at risk **before** dice rolled (risk metric) |
| `players[].tableLoad.after` | number | Total dollars at risk **after** resolution and new bets placed |
| `players[].tableLoad.betCount` | integer | Number of distinct bets active before roll |
| `players[].activeBets[]` | array | Snapshot of all active bets **before** the roll |
| `activeBets[].type` | string | `"passLine"`, `"come"`, `"place"`, `"field"`, `"hardways"` |
| `activeBets[].point` | number \| null | The number this bet is on (null for come bets in transit) |
| `activeBets[].amount` | number | Base bet amount |
| `activeBets[].odds` | number | Odds backing (0 if none) |
| `players[].outcomes[]` | array | Bets that resolved on this roll (wins and losses) |
| `outcomes[].type` | string | Bet type |
| `outcomes[].point` | number \| null | Bet point |
| `outcomes[].result` | `"win"` \| `"loss"` \| `"push"` | Outcome |
| `outcomes[].payout` | number | Dollars returned to player (0 for losses) |

> **tableLoad.before** is the core **risk** metric. **outcomes[].payout** is the **upside** metric. Plotting payout/tableLoad gives you the reward-to-risk ratio per roll.

---

## Session Summary Schema

Appended as the final line of the `.jsonl` file.

```json
{
  "type": "summary",
  "meta": {
    "strategy": "ThreePointMolly",
    "startBankroll": 500,
    "totalRolls": 10000,
    "seed": 12345,
    "timestamp": "2026-03-11T14:22:00Z"
  },
  "bankroll": {
    "final": 483,
    "peak": 621,
    "trough": 312,
    "maxDrawdown": 309,
    "netChange": -17
  },
  "tableLoad": {
    "avg": 128.4,
    "max": 200,
    "min": 0,
    "avgWhenActive": 142.1
  },
  "activity": {
    "rollsWithWin": 1843,
    "rollsWithLoss": 2104,
    "rollsNoAction": 6053,
    "winRate": 0.1843,
    "lossRate": 0.2104
  },
  "diceDistribution": {
    "bySum": {
      "2":  278, "3":  556, "4":  833,
      "5": 1111, "6": 1388, "7": 1666,
      "8": 1388, "9": 1111, "10": 833,
      "11": 556, "12": 278
    },
    "byDieFace": {
      "1": 9998, "2": 10001, "3": 10003,
      "4":  9997, "5":  9999, "6": 10002
    }
  }
}
```

### Summary Field Descriptions

| Field | Description |
|-------|-------------|
| `meta.seed` | RNG seed — run two strategies with the same seed to control for dice |
| `bankroll.maxDrawdown` | Largest peak-to-trough decline; key measure of strategy risk |
| `tableLoad.avgWhenActive` | Average load on rolls where at least one bet is active (excludes idle rolls) |
| `activity.rollsNoAction` | Rolls where no bet resolved — useful for measuring strategy "coverage" |
| `diceDistribution.bySum` | Observed frequency of each sum (2–12). Compare to theoretical for skew detection |
| `diceDistribution.byDieFace` | Observed frequency of each die face (1–6). Should be ~n/6 each |

---

## Theoretical Distribution for Skew Detection

Expected probabilities for 2d6:

| Sum | Combinations | Probability | Expected in 10,000 rolls |
|-----|-------------|-------------|--------------------------|
| 2   | 1/36        | 2.78%       | 278 |
| 3   | 2/36        | 5.56%       | 556 |
| 4   | 3/36        | 8.33%       | 833 |
| 5   | 4/36        | 11.11%      | 1,111 |
| 6   | 5/36        | 13.89%      | 1,389 |
| 7   | 6/36        | 16.67%      | 1,667 |
| 8   | 5/36        | 13.89%      | 1,389 |
| 9   | 4/36        | 11.11%      | 1,111 |
| 10  | 3/36        | 8.33%       | 833 |
| 11  | 2/36        | 5.56%       | 556 |
| 12  | 1/36        | 2.78%       | 278 |

Expected per-face frequency: exactly `totalRolls * 2 / 6` (each die face should appear in ~33.3% of dice, or ~16.67% of all dice rolled).

A simple chi-squared test on `diceDistribution.bySum` against these expected values will reveal any significant RNG bias.

---

## Side-by-Side Strategy Comparison

Run two or more sessions with **identical seeds** to isolate the effect of strategy from RNG luck:

```
session-ThreePointMolly-seed42.jsonl
session-Place6And8-seed42.jsonl
session-PassLineOnly-seed42.jsonl
```

Because the same seed produces identical dice rolls, any difference in outcomes is purely due to betting strategy. You can then:

1. **Plot bankroll curves** — graph `bankroll.after` over `roll.number` for each file on the same chart.
2. **Compare tableLoad** — which strategy commits more money per roll?
3. **Compute payout/load ratio** — for each winning roll, `outcomes[].payout / tableLoad.before`.
4. **Compare maxDrawdown** — which strategy survives bad runs better?

---

## File Naming Convention

```
logs/<strategy-name>-seed<seed>-<n>rolls.jsonl
```

Examples:
```
logs/ThreePointMolly-seed42-10000rolls.jsonl
logs/Place6And8-seed42-10000rolls.jsonl
```

---

## Implementation Notes

### Per-roll capture points

The logger should hook into the game loop at these points:

1. **Before `placeBets()`** — capture `bankroll.before`, `activeBets`, `tableLoad.before`
2. **After `rollDice()`** — capture `roll.die1`, `roll.die2`, `roll.sum`, `gameState`
3. **After bet resolution** — capture `outcomes[]`
4. **After `resolveHand()`** — capture `bankroll.after`, `tableLoad.after`

### die1 and die2

The current `LiveDice` rolls two d6 and returns only the sum. To log individual die values, `doRoll()` should store them alongside the sum. This is required for `diceDistribution.byDieFace` and for future loaded-dice detection.

### tableLoad calculation

```
tableLoad = sum of (bet.amount + bet.oddsAmount) for all active bets
```

Note that odds on come bets in transit (not yet on a number) are not yet placed, so they do not contribute to tableLoad until the come bet travels.

### Partial sessions

If a session is interrupted, the `.jsonl` file is still valid up to the last complete line (no summary). Partial files can be analyzed with the same tools — just note the absence of a summary record.
