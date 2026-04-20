# BATS: Simulator Implementation Notes

**Status:** Implemented — all five stages live in `src/dsl/strategies-staged.ts`.  
**Companion strategy doc:** `strategy/bats-strategy.md`

---

## What Was Built

BATS is a five-stage darkside strategy implemented using the same `stageMachine()` builder as CATS.
All engine changes were minimal additions; no existing behavior was modified.

### Files Changed

| File | Change |
|---|---|
| `src/dsl/stage-machine-types.ts` | Added `consecutiveComeOutLosses`, `pointRepeaterStreak` to `SessionState`; added `dontCoverage`, `dontComeBetsInTransit` to `TableReadView` |
| `src/dsl/stage-machine-state.ts` | Extended `MutableSessionState`; added increment/reset logic in `postRoll()`; extended `buildTableReadView()` for don't-side coverage; added `lay: () => {}` to `NOOP_BET_RECONCILER` |
| `src/dsl/bet-reconciler.ts` | Added `lay(point, amount)` to `BetReconciler` interface and `SimpleBetReconciler` |
| `src/engine/shared-table.ts` | Added `case 'lay'` to `createBet()` and imported `LayBet` |
| `src/dsl/strategies-staged.ts` | Added `layAmountToWin()` helper and `BATS()` five-stage function |
| `src/cli/strategy-registry.ts` | Registered `BATS` |
| `web/src/pages/StrategiesPage.tsx` | Added BATS section |
| `spec/dsl/bats-strategy-spec.ts` | Unit + integration tests |

---

## Engine Changes Explained

### `consecutiveComeOutLosses` and `pointRepeaterStreak`

Both are tracked entirely in `postRoll()` in `stage-machine-state.ts`.

- **`consecutiveComeOutLosses`**: Increments when `pointBefore == null && rollValue ∈ {7, 11}` (natural win = loss for don't side). Resets when `pointBefore == null && rollValue ∉ {7, 11}` (craps or point established). Not affected by point-phase rolls.
- **`pointRepeaterStreak`**: Increments when `pointBefore != null && pointBefore === rollValue` (shooter made their point). Resets when `pointBefore != null && rollValue === 7` (seven-out).

### `dontCoverage` and `dontComeBetsInTransit`

Added to `TableReadView` alongside the existing `coverage`/`comeBetsInTransit` fields. `buildTableReadView()` in `stage-machine-state.ts` now loops over `DontComeBet` and `DontPassBet` instances in the same pass that handles `ComeBet` and `PassLineBet`.

### `bets.lay(point, amount)`

Added to `BetReconciler` interface and `SimpleBetReconciler`. The `LayBet` class was already fully implemented (`src/bets/lay-bet.ts`) — this change wires it into the reconciler and the engine's `createBet()` switch.

---

## The `layAmountToWin` Helper

```typescript
function layAmountToWin(point: number, targetWin: number): number {
  const ratios: Record<number, number> = {
    4: 2.0, 10: 2.0,   // lay 2:1 — risk $2 to win $1
    5: 1.5,  9: 1.5,   // lay 3:2 — risk $3 to win $2
    6: 1.2,  8: 1.2,   // lay 6:5 — risk $6 to win $5
  };
  return Math.ceil(targetWin * ratios[point]);
}
```

In `withOdds(layAmount)`, the amount is the lay at risk, not the win. To target a `$50` win on point 4:
`layAmountToWin(4, 50) = ceil(50 * 2.0) = 100`. So `bets.dontPass(10).withOdds(100)`.

---

## Stage Structure

| Stage | Entry | Bets | Step-down trigger |
|---|---|---|---|
| bearishAccumulator | start | DP $10 + 1× lay odds | — |
| littleDolly | profit ≥ $120 | DP + 1 DC + 2× lay odds | `consecutiveComeOutLosses ≥ 2` or profit < $120 |
| threePtDolly | profit ≥ $225 | DP + 2 DC + 5× lay odds | `pointRepeaterStreak ≥ 2` or profit < $225 |
| expandedDarkAlpha | profit ≥ $350 | Dolly + Lay 4/10 (Swap Rule) | profit < $350 |
| maxDarkAlpha | profit ≥ $500 | Dolly + Lay 4/5/9/10 (Swap Rule) | profit < $500 |

### The Swap Rule

Stages 4 and 5 check `table.dontCoverage` before placing each Lay bet. If a Don't Come bet has already traveled to that number, no Lay is placed — the DC bet provides equivalent coverage with better odds (no vig). The reconciler handles removal of any existing Lay bet when the DC establishes coverage, since the Lay will no longer appear in the desired set.

```typescript
// In expandedDarkAlpha board():
if (!table.dontCoverage.has(4))  bets.lay(4, 40);
if (!table.dontCoverage.has(10)) bets.lay(10, 40);
```

---

## What Was Removed From the Original Spec

The original document proposed two items that are **not needed**:

### `dontComeTravel` event — Removed

The Swap Rule is fully expressed by checking `table.dontCoverage.has(n)` in `board()`. When a DC travels to a number, the next `board()` call sees it in `dontCoverage` and stops placing the Lay there. The reconciler removes the Lay bet automatically. No event handler needed.

### `pointMade` event — Removed

`pointMade` is already computed in `postRoll()` as `pointBefore != null && pointBefore === rollValue`. The `pointRepeaterStreak` counter is maintained there directly — no event handler involvement required.

---

## Known Limitation: Multi-DC Deduplication

The reconciler's `diffBets` keys bets by `type:point`. Don't Come bets in transit share the key `dontCome:` (no point yet), so two DC declarations in `board()` deduplicate to one entry in the desired map.

**Practical effect**: ThreePtDolly and higher stages effectively cycle one DC through numbers rather than holding two simultaneously. The reconciler removes an established DC before each roll and places a fresh one in transit. This is the same limitation as CATS's Three-Point Molly.

This is a reconciler-level limitation, not a BATS-specific issue. Fixing it would require tracking desired bet counts rather than just presence — a non-trivial change to `diffBets`. Left for a future iteration.

---

## Original Doc Errors

The original `docs/bats-implementation.md` had one critical bug in the code example:

```typescript
// WRONG — this is a Place bet, not a Lay bet (opposite outcomes)
if (!table.dontCoverage.has(4))  bets.place(4, 20);  // Lay 4

// CORRECT — use bets.lay() after adding lay() to BetReconciler
if (!table.dontCoverage.has(4))  bets.lay(4, 40);
```

A Place 4 bet wins when 4 rolls (house edge 6.67%). A Lay 4 wins when 7 rolls first (house edge 1.67%). These are opposite bets with very different expected values.
