# BATS: Simulator Implementation Notes

**For:** Coding agent implementing BATS in the TypeScript craps simulator  
**Companion to:** BATS: Bearish Alpha-Transition Strategy  
**Assumes:** Familiarity with the CATS implementation and engine architecture

---

# Appendix A: Simulator Implementation Notes

This appendix is written for the coding agent implementing BATS in the existing
TypeScript simulator. It assumes familiarity with the engine's architecture as
established by the CATS implementation.

**What is already built and working:**
- `DontPassBet` and `DontComeBet` with full come-out and point-phase resolution
- Bar-12 push on come-out (confirmed in `dont-pass-bet-spec.ts`)
- `computeLayOddsPayout` static method on `DontPassBet` — point-specific ratios already implemented
- `bets.dontPass(amount).withOdds(layAmount)` and `bets.dontCome(amount).withOdds(layAmount)` DSL
- `stageMachine()` builder — the correct implementation pattern
- `SessionState`: `profit`, `stage`, `consecutiveSevenOuts`, `handsPlayed`
- Events: `numberHit`, `sevenOut`, `pointEstablished`, `comeOut`, `naturalWin`, `comeTravel`

---

## A.1 What BATS Needs That CATS Does Not

Three things need to be added or extended before BATS can be implemented:

### A.1.1 Two New SessionState Fields

`consecutiveSevenOuts` tracks 7-outs — the CATS step-down trigger. BATS needs
two analogous counters that track opposite conditions:

```typescript
// Extend SessionState with:
consecutiveComeOutLosses: number  // increments on come-out 7 or 11, resets on any other come-out outcome
pointRepeaterStreak: number       // increments when shooter makes their point, resets on 7-out
```

**Reset logic:**
- `consecutiveComeOutLosses` resets to 0 on: come-out 2, 3, 12 (win or push), or point established
- `pointRepeaterStreak` resets to 0 on: any 7-out (`sevenOut` event)
- Neither counter resets the other — they are independent

These map directly to the two BATS step-down triggers:
- Stage 2 Little Dolly: `consecutiveComeOutLosses >= 2` → step down to Bearish Accumulator
- Stage 3 Dolly: `pointRepeaterStreak >= 2` → step down to Little Dolly

### A.1.2 `dontCoverage` in TableReadView

`table.coverage` currently tracks which numbers have active pass/come bets — used by CATS
for the tier odds rule (`table.hasSixOrEight`). BATS needs the equivalent for don't side:

```typescript
// Extend TableReadView with:
dontCoverage: Set<number>        // numbers with active DC bets (established, not in transit)
dontComeBetsInTransit: number    // DC bets placed but not yet traveled to a point
```

This enables the Swap Rule implementation (§A.4) and the tier-load awareness in §A.2.

### A.1.3 `dontComeTravel` Event

`comeTravel` fires when a Come bet travels to its point. BATS needs the equivalent:

```typescript
// Add to CrapsEventHandlers:
dontComeTravel: (payload: { number: number }, ctx: StageEventContext) => void
```

This event is the trigger for the Swap Rule — when a DC travels to a number that
already has a Lay bet, the Lay bet should be removed automatically.

---

## A.2 Lay Odds Amount Calculation in the Strategy DSL

The engine's `withOdds(amount)` takes a **dollar amount**, not a multiplier. The
strategy is responsible for computing the correct lay amount for the current point.

`DontPassBet.computeLayOddsPayout` already encodes the ratio logic. Use the inverse
to compute the lay amount from a target win:

```typescript
// Helper — compute lay amount to win targetWin on a given point
function layAmountToWin(point: number, targetWin: number): number {
  const ratios: Record<number, number> = {
    4: 2.0, 10: 2.0,   // lay 2:1 — risk $2 to win $1
    5: 1.5,  9: 1.5,   // lay 3:2 — risk $3 to win $2
    6: 1.2,  8: 1.2,   // lay 6:5 — risk $6 to win $5
  };
  return Math.ceil(targetWin * ratios[point]);
}

// In the stage board() — 5x lay odds means win 5 * flatBet in odds:
board: ({ bets, table }) => {
  const flatBet = 10;
  const oddsMultiple = 5;
  const targetWin = flatBet * oddsMultiple;   // $50

  if (table.point) {
    const layAmount = layAmountToWin(table.point, targetWin);
    bets.dontPass(flatBet).withOdds(layAmount);
    // For point 4: withOdds(100) → lay $100 to win $50
    // For point 6: withOdds(60)  → lay $60  to win $50
  }
}
```

For 2× odds (Little Dolly): `targetWin = flatBet * 2` ($20). Same formula, smaller amounts.

**Important:** the lay amount varies by point, so `withOdds()` is called with different
values each time depending on `table.point`. This is different from CATS where
`withOdds(50)` is the same for every point.

---

## A.3 Stage Machine Structure for BATS

BATS follows the same `stageMachine()` builder pattern as CATS. Stage names should
follow the established naming convention:

```typescript
export function BATS() {
  return stageMachine('BATS')
    .startingAt('bearishAccumulator')

    .stage('bearishAccumulator', {
      board: ({ bets, table, session, advanceTo }) => {
        // Don't Pass only — no DC in accumulator
        // Lay odds to win exactly 1 unit
        if (!table.point) {
          bets.dontPass(10);
        } else {
          const layAmount = layAmountToWin(table.point, 10); // win $10
          bets.dontPass(10).withOdds(layAmount);
        }
        if (session.profit >= 120) advanceTo('littleDolly');
      },
      canAdvanceTo: (_target, session) => session.profit >= 120,
    })

    .stage('littleDolly', {
      board: ({ bets, table }) => {
        if (!table.point) {
          bets.dontPass(10);
          // Place DC only when point is ON — handled by isOkayToPlace
        } else {
          const layAmount = layAmountToWin(table.point, 20); // 2x odds
          bets.dontPass(10).withOdds(layAmount);
          bets.dontCome(10).withOdds(layAmount); // DC with same 2x
        }
      },
      canAdvanceTo: (_target, session) => session.profit >= 225,
      mustRetreatTo: (session) => {
        if (session.consecutiveComeOutLosses >= 2) return 'bearishAccumulator';
        if (session.profit < 120) return 'bearishAccumulator';
        return undefined;
      },
      on: {
        advanceTo: (_payload, { advanceTo, session }) => {
          if (session.profit >= 225) advanceTo('threePtDolly');
        },
      },
    })

    .stage('threePtDolly', {
      board: ({ bets, table }) => {
        // Full Dolly: DP + 2 DC, max lay odds
        if (!table.point) {
          bets.dontPass(10);
        } else {
          const layAmount = layAmountToWin(table.point, 50); // 5x = win $50
          bets.dontPass(10).withOdds(layAmount);
          bets.dontCome(10).withOdds(layAmount);
          bets.dontCome(10).withOdds(layAmount);
        }
      },
      canAdvanceTo: (_target, session) => session.profit >= 350,
      mustRetreatTo: (session) => {
        if (session.pointRepeaterStreak >= 2) return 'littleDolly';
        if (session.profit < 225) return 'littleDolly';
        return undefined;
      },
    })

    // ... expandedDarkAlpha, maxDarkAlpha follow same pattern
    .build();
}
```

---

## A.4 The Swap Rule Implementation

When a DC bet travels to a number that has an active Lay bet, the Lay bet should
be removed. Use the `dontComeTravel` event:

```typescript
.stage('expandedDarkAlpha', {
  board: ({ bets, table }) => {
    // Full Dolly + Lay 4 and Lay 10 (if not covered by DC)
    // ... dolly bets ...
    if (!table.dontCoverage.has(4))  bets.place(4, 20);  // Lay 4
    if (!table.dontCoverage.has(10)) bets.place(10, 20); // Lay 10
  },
  on: {
    dontComeTravel: ({ number }, { }) => {
      // DC traveled to a number — remove Lay bet on that number if present
      // The board() will handle this on next reconcile via dontCoverage check above
      // No explicit action needed if board() checks dontCoverage before placing Lay bets
    },
  },
})
```

The cleaner approach: board() checks `table.dontCoverage` before placing each Lay bet.
If a DC is already covering that number, don't place the Lay. This is idempotent and
requires no event handler — the reconciler handles removal automatically when the
Lay bet disappears from the desired set.

```typescript
// In expandedDarkAlpha board():
if (!table.dontCoverage.has(4) && !table.dontCoverage.has(10)) {
  bets.dontPass /* ... */; // already there
  if (!table.dontCoverage.has(4))  { /* lay 4 */ }
  if (!table.dontCoverage.has(10)) { /* lay 10 */ }
}
```

---

## A.5 SessionState Counter Increment Logic

Where to increment the new counters — map to existing event handlers:

| Counter | Increment on | Reset on |
|---|---|---|
| `consecutiveComeOutLosses` | `comeOut` event where prior roll was 7 or 11 on come-out | Any non-loss come-out outcome |
| `pointRepeaterStreak` | `pointEstablished` → point is later made (need `handsPlayed` delta or explicit event) | `sevenOut` event |

**Simpler approach for `pointRepeaterStreak`:** track via the existing `sevenOut` event
(resets) and a new `pointMade` event. If `pointMade` is not yet an event, it can be
inferred: `handsPlayed` increments on both point-made and seven-out. Track previous
`handsPlayed` in stage `track()` and compare — if it incremented without a `sevenOut`
firing, a point was made.

```typescript
on: {
  sevenOut: (_payload, ctx) => {
    // pointRepeaterStreak resets — handled by SessionState machinery
  },
  pointEstablished: (_payload, ctx) => {
    // New point set — if previous hand ended in point-made, streak increments
    // Implementation: check if handsPlayed increased without sevenOut
  },
}
```

The cleanest solution: add `pointMade` to `CrapsEventHandlers` alongside `sevenOut`.
Both events already increment `handsPlayed` — making them distinct events costs one
additional event dispatch in the engine.

---

## A.6 Implementation Checklist for the Coding Agent

In priority order:

1. **Extend `SessionState`** — add `consecutiveComeOutLosses` and `pointRepeaterStreak`
2. **Extend `TableReadView`** — add `dontCoverage: Set<number>` and `dontComeBetsInTransit`
3. **Add `dontComeTravel` event** to `CrapsEventHandlers` and dispatch it from engine
4. **Add `pointMade` event** (optional but cleaner than inferring from `handsPlayed`)
5. **Implement `layAmountToWin()` helper** in strategies file — shared by all BATS stages
6. **Implement BATS stages** using `stageMachine()` builder
7. **Register BATS** in `strategy-registry.ts` alongside CATS
8. **Write specs** following `cats-strategy-spec.ts` as the template — one spec per stage,
   RiggedDice sequences for deterministic transition testing

**Spec pattern for BATS:**
```typescript
// Test come-out loss streak trigger
it('retreats to bearishAccumulator on 2 consecutive come-out losses', () => {
  const strategy = BATS();
  const runtime = getRuntime(strategy);
  const config = runtime.stageConfigs.get('littleDolly');
  const result = config.mustRetreatTo({
    profit: 150,
    consecutiveComeOutLosses: 2,
    pointRepeaterStreak: 0,
    handsPlayed: 5,
    stage: 'littleDolly'
  });
  expect(result).toBe('bearishAccumulator');
});

// Test point repeater trigger
it('retreats to littleDolly on 2 consecutive point makes', () => {
  const strategy = BATS();
  const runtime = getRuntime(strategy);
  const config = runtime.stageConfigs.get('threePtDolly');
  const result = config.mustRetreatTo({
    profit: 300,
    consecutiveComeOutLosses: 0,
    pointRepeaterStreak: 2,
    handsPlayed: 10,
    stage: 'threePtDolly'
  });
  expect(result).toBe('littleDolly');
});
```

---

*— End of Appendix A —*

---

*— End of implementation notes —*
