# Craps Strategy DSL Specification

This document describes the TypeScript DSL used to define betting strategies for the craps simulator. Strategies are plain functions — they declare what bets _should_ exist, and the engine reconciles that against what is currently on the table.

---

## Overview

Each strategy is a `StrategyDefinition` — a function called once per roll, before dice are thrown. It uses a `BetReconciler` (`bets`) to declare desired bets, and an optional `track()` helper for stateful logic across rolls.

The reconciler diffs the desired state against the current table state and generates the minimal set of place/remove/update operations needed.

---

## Type Signatures

```typescript
// A strategy is a plain function taking a context object.
export type StrategyDefinition = (ctx: StrategyContext) => void;

export interface StrategyContext {
  bets: BetReconciler;          // Declare desired bets
  track: <T>(key: string, initial?: T) => T;  // Read persistent state
}

export interface BetReconciler {
  passLine(amount: number): BetWithOdds;
  come(amount: number): BetWithOdds;
  place(point: number, amount: number): void;
  field(amount: number): void;
  hardways(point: number, amount: number): void;
  remove(type: string, point?: number): void;
}

export interface BetWithOdds {
  withOdds(amount: number): void;
  withMaxOdds(): void;           // Uses table maximum odds multiplier
}
```

---

## BetReconciler API

### `bets.passLine(amount)`

Declares a pass line bet. Returns a `BetWithOdds` so you can chain `.withOdds(n)`.

- Can only be placed during come-out (point OFF). The engine will skip placement if point is ON.
- Odds are placed/updated automatically when the point is established.

```typescript
bets.passLine(10);
bets.passLine(10).withOdds(20);
bets.passLine(10).withMaxOdds();
```

### `bets.come(amount)`

Declares a come bet. Returns `BetWithOdds`.

- Can only be placed when point is ON. The engine skips placement during come-out.
- The come bet "travels" to the number rolled on the next roll. Odds follow it.
- Declaring `come(10)` twice means you want two separate come bets in play.

```typescript
bets.come(10).withOdds(20);
```

### `bets.place(point, amount)`

Declares a place bet on a specific number (4, 5, 6, 8, 9, or 10).

- Place bets are **off** (no action) during the come-out roll by default.
- Win when the number is rolled; lose on 7-out.
- Payouts: 9:5 on 4/10, 7:5 on 5/9, 7:6 on 6/8.

```typescript
bets.place(6, 12);
bets.place(8, 12);
```

### `bets.remove(type, point?)`

Removes a specific bet from the table. Use this for progressive strategies that scale or remove bets after wins/losses.

```typescript
bets.remove('place', 6);
bets.remove('passLine');
```

### `bets.field(amount)`

Declares a field bet (one-roll bet on 2, 3, 4, 9, 10, 11, 12).

```typescript
bets.field(5);
```

### `bets.hardways(point, amount)`

Declares a hardways bet on 4, 6, 8, or 10 (both dice showing the same value).

```typescript
bets.hardways(8, 1);
```

---

## Tracking State: `track()`

`track(key, initial)` reads a persistent value that survives across rolls. It is **read-only** within the strategy function — updates must be applied via game event callbacks (see implementation notes below).

```typescript
const wins = track<number>('wins', 0);  // returns current win count
```

Common uses:
- Count wins on a specific bet to drive progression
- Track consecutive losses for a martingale stop
- Remember whether you're in a "press" or "regress" phase

> **Note:** The write path for `track()` is managed by the engine. Strategies only read the value — the engine increments it based on resolved outcomes.

---

## Strategy Examples

### 1. Pass Line Only

Bare minimum. One pass line bet, no odds.

```typescript
export const PassLineOnly: StrategyDefinition = ({ bets }) => {
  bets.passLine(10);
};
```

### 2. Pass Line with Odds

```typescript
export const PassLineWithOdds: StrategyDefinition = ({ bets }) => {
  bets.passLine(10).withOdds(20);  // 2x odds
};
```

### 3. Pass Line with Max Odds

```typescript
export const PassLineMaxOdds: StrategyDefinition = ({ bets }) => {
  bets.passLine(10).withMaxOdds();
};
```

### 4. Come Bet (single)

Places one come bet each time the point is ON (travels to next number rolled).

```typescript
export const PassLineAndCome: StrategyDefinition = ({ bets }) => {
  bets.passLine(10).withOdds(20);
  bets.come(10).withOdds(20);
};
```

### 5. Pass Line + 2 Come Bets with Odds

Always tries to keep three numbers covered: the pass line point plus two come bet destinations.

```typescript
export const PassLineAnd2Comes: StrategyDefinition = ({ bets }) => {
  bets.passLine(10).withOdds(20);
  bets.come(10).withOdds(20);
  bets.come(10).withOdds(20);
};
```

> Declaring `come()` twice means "I want two come bets in play." The engine will only place a new come bet if fewer than two are currently active.

### 6. Place 6 and 8

A pure place strategy — no pass line required. Good action on the two most likely numbers.

```typescript
export const Place6And8: StrategyDefinition = ({ bets }) => {
  bets.place(6, 12);   // $12 unit: 7:6 pays $14 profit
  bets.place(8, 12);
};
```

### 7. Place the Inside (5, 6, 8, 9)

Covers the four most likely non-seven numbers.

```typescript
export const PlaceInside: StrategyDefinition = ({ bets }) => {
  bets.place(5, 10);
  bets.place(6, 12);
  bets.place(8, 12);
  bets.place(9, 10);
};
```

### 8. Place All (4, 5, 6, 8, 9, 10)

Maximum place coverage — all six point numbers.

```typescript
export const PlaceAll: StrategyDefinition = ({ bets }) => {
  bets.place(4,  10);
  bets.place(5,  10);
  bets.place(6,  12);
  bets.place(8,  12);
  bets.place(9,  10);
  bets.place(10, 10);
};
```

### 9. 3-Point Molly

The classic "always have three numbers working" strategy. The pass line covers the come-out number; two come bets fill out the other two numbers. Once all three spots are filled, no new come bets are placed — existing bets ride with odds.

The key insight: the pass line + come bets always move with the shooter, so if a number is hit and a come bet wins, the strategy will re-fill that slot on the next roll.

```typescript
export const ThreePointMolly: StrategyDefinition = ({ bets, track }) => {
  // Always maintain a pass line bet with odds.
  bets.passLine(10).withOdds(20);

  // We want exactly 2 come bets in play (plus the pass line = 3 numbers covered).
  // Declaring come() twice signals "maintain up to 2 active come bets."
  // The engine will not place a new come bet if 2 are already working.
  bets.come(10).withOdds(20);
  bets.come(10).withOdds(20);
};
```

**Why it works:** During come-out, only the pass line is placed. Once a point is established, the engine places the first come bet. After it travels to a number, a second come bet is placed. Now three numbers are covered. When any come bet wins (its number is hit), that slot reopens and the strategy re-fills it next roll.

**Bankroll consideration:** With $10 pass + $20 pass odds + $10 come × 2 + $20 come odds × 2, table load is $90 when fully loaded.

### 10. SixIn8 Progressive (using `track()`)

Press (double up) on Place 6 after the first win, then return to base unit.

```typescript
export const Place6And8Progressive: StrategyDefinition = ({ bets, track }) => {
  const wins = track<number>('wins', 0);

  if (wins === 0) {
    // Base unit: $12 on Place 6 and 8
    bets.place(6, 12);
    bets.place(8, 12);
  } else if (wins === 1) {
    // After first win: press to $24
    bets.remove('place', 6);
    bets.place(6, 24);
    bets.remove('place', 8);
    bets.place(8, 24);
  } else {
    // After second win: take profit, return to base
    bets.remove('place', 6);
    bets.place(6, 12);
    bets.remove('place', 8);
    bets.place(8, 12);
  }
};
```

---

## Come-Out Roll Behavior

| Bet Type  | Come-Out Behavior |
|-----------|-------------------|
| Pass Line | Active — wins on 7/11, loses on 2/3/12 |
| Come      | Cannot be placed (point must be ON) |
| Place     | **Off** (no action) by default |
| Field     | Active (one-roll bet, always resolves) |
| Hardways  | Off by default |

Place bets surviving a 7-out (come-out 7) are not lost — they are simply inactive during come-out and remain on the table for the next point cycle.

---

## Side-by-Side Simulation

To compare strategies, run each with the same RNG seed:

```typescript
import { CrapsGame } from './craps-game';
import { ThreePointMolly, Place6And8 } from './dsl/strategies';

const game1 = new CrapsGame({ strategy: ThreePointMolly, bankroll: 500, seed: 42 });
const game2 = new CrapsGame({ strategy: Place6And8,     bankroll: 500, seed: 42 });

game1.run(10000);
game2.run(10000);
// Compare game1.log vs game2.log
```

Same seed means identical dice — the only variable is strategy decision-making.

---

## Implementation Notes

- Strategies are **idempotent**: calling `bets.place(6, 12)` when a $12 place-6 already exists is a no-op.
- The reconciler generates `BetCommand[]` (place / remove / updateOdds), which the engine applies before each roll.
- `track()` read path is live; write path is managed by the engine post-roll resolution. Strategies should not try to write to tracked values directly.
- The engine skips any bet placement that violates table rules (e.g., pass line during point-on), so strategies do not need to guard for game state in most cases.
