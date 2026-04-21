# Strategy Author's Guide

This guide is for players who know craps and want to define their own betting strategies for the simulator. You don't need deep TypeScript experience — the DSL (domain-specific language) is intentionally simple. If you can follow along with the examples in this guide, you can build any strategy the system supports.

---

## How Strategies Work

A strategy is a small function that runs **once per roll, before the dice are thrown**. It declares what bets you *want* on the table. The engine compares that declaration against what's actually there and makes the minimum changes: placing bets you declared but don't have, removing bets you stopped declaring, and adjusting amounts that changed.

This is called reconciliation. The practical upshot is:

- **Declaring a bet you already have is a no-op** — the bet isn't removed and re-placed; nothing changes.
- **You don't manage placement timing yourself.** If you declare a pass line bet during a point-on roll, the engine skips it — it knows that's illegal. You don't have to guard for it.
- **The function runs every roll** — so each roll your strategy gets a clean look at the table and re-declares its desired state.

---

## Your First Strategy File

Here is the simplest possible strategy — a flat pass line bet, no odds:

```typescript
import { StrategyDefinition } from '../types/strategy-types';

export const PassLineOnly: StrategyDefinition = ({ bets }) => {
  bets.passLine(10);
};
```

A few things to notice:

- `StrategyDefinition` is the type — it tells the system "this is a strategy." Think of it as a label.
- `({ bets })` is how the strategy receives its toolkit. `bets` is the object you use to declare what you want on the table.
- `bets.passLine(10)` says: "I want a $10 pass line bet." If one already exists, nothing happens. If not, the engine places it.
- The function doesn't return anything — it just makes declarations.

Save this as a `.ts` file in the `strategy/` folder, export it, and register it by name in the strategy registry. After that, you can run it by name from the CLI or the web UI.

---

## Adding Odds

Odds are chained directly onto the bet they belong to:

```typescript
export const PassLineWithOdds: StrategyDefinition = ({ bets }) => {
  bets.passLine(10).withOdds(30);  // $10 flat, $30 odds = 3x
};
```

`withOdds(amount)` takes a dollar amount, not a multiplier. If the table maximum allows it, you can also use `withMaxOdds()` to always put up the most the house allows:

```typescript
bets.passLine(10).withMaxOdds();
```

Come bets work the same way:

```typescript
bets.come(10).withOdds(20);
```

---

## Available Bets

### Pass Line — `bets.passLine(amount)`

The bread-and-butter bet. Wins on 7 or 11 during the come-out; loses on 2, 3, or 12. If a point is established, wins if the point repeats before a 7, loses on a 7-out.

- **Only placed during the come-out** (point OFF). The engine ignores this declaration during a point-on roll.
- Supports `.withOdds(amount)` and `.withMaxOdds()`.

```typescript
bets.passLine(10);
bets.passLine(10).withOdds(20);
```

### Come Bet — `bets.come(amount)`

A pass line equivalent that starts its own little journey from wherever the game is. The first roll after a come bet is placed becomes *that come bet's* point. Then it travels to the number box and wins if the number repeats, loses on 7.

- **Only placed when point is ON** (come-out phase: skipped automatically).
- The come bet travels to its number on the next roll; odds travel with it.
- **Declaring `come()` twice means "I want two come bets in play."** The engine tracks how many you currently have working, and only places a new one when you're below your declared target.

```typescript
bets.come(10).withOdds(20);
bets.come(10).withOdds(20);  // want two come bets in play simultaneously
```

### Place Bet — `bets.place(number, amount)`

A direct bet on a specific number (4, 5, 6, 8, 9, or 10). Wins when the number rolls; loses on 7. Unlike come bets, place bets don't travel — they stay on the number you put them on.

- **Off (no action) during the come-out roll by default.** A 7 during the come-out does not remove place bets.
- Correct unit sizes: $12 on 6 or 8 (pays 7:6), $10 on 5 or 9 (pays 7:5), $10 on 4 or 10 (pays 9:5).

```typescript
bets.place(6, 12);
bets.place(8, 12);
bets.place(5, 10);
```

### Field Bet — `bets.field(amount)`

A one-roll bet. Wins on 2, 3, 4, 9, 10, 11, or 12; loses on 5, 6, 7, or 8. Pays even money, except 2 pays 2:1 and 12 pays 2:1 (sometimes 3:1 on 12, depending on house rules).

- Resolves every single roll — the engine places it fresh each time it's declared.

```typescript
bets.field(5);
```

### Hardways — `bets.hardways(number, amount)`

A bet that the number (4, 6, 8, or 10) rolls as doubles before it rolls the "easy way" or before a 7. Hard 6 = 3-3 before a 7 or before 2-4/4-2/1-5/5-1. Pays 9:1 on hard 6/8, 7:1 on hard 4/10.

```typescript
bets.hardways(6, 1);   // $1 hard 6
bets.hardways(8, 1);   // $1 hard 8
```

### Removing a Bet — `bets.remove(type, number?)`

Explicitly removes a bet from the table. Required for progressive strategies where you want to change the amount on a bet — you remove the old one and place the new one.

```typescript
bets.remove('place', 6);      // take down the place 6
bets.remove('passLine');      // remove the pass line
bets.remove('come', 8);       // remove a come bet that has traveled to the 8
```

Valid type strings: `'passLine'`, `'come'`, `'place'`, `'field'`, `'hardways'`, `'dontPass'`, `'dontCome'`.

---

## Come-Out Behavior Summary

| Bet | During Come-Out |
|-----|----------------|
| Pass Line | Active — placed, wins on 7/11, loses on craps |
| Come | Skipped — engine won't place it |
| Place | Off — no action, not lost on come-out 7 |
| Field | Active — resolves every roll |
| Hardways | Off — no action |

You don't have to code around this. Just declare what you want every roll, and the engine handles the phase rules automatically.

---

## Classic Strategies

### Place 6 and 8

The two most likely non-seven numbers. $12 units are standard because the 7:6 payout only pays out cleanly in multiples of $6.

```typescript
export const Place6And8: StrategyDefinition = ({ bets }) => {
  bets.place(6, 12);
  bets.place(8, 12);
};
```

### Place the Inside (5, 6, 8, 9)

Four numbers covered — everything except the outside numbers 4 and 10.

```typescript
export const PlaceInside: StrategyDefinition = ({ bets }) => {
  bets.place(5, 10);
  bets.place(6, 12);
  bets.place(8, 12);
  bets.place(9, 10);
};
```

### Place All Numbers

Maximum place coverage. Six numbers, max exposure.

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

### Three-Point Molly

Always keep three numbers covered: the pass line point plus two come bets. Declaring `come()` twice tells the engine "maintain up to two working come bets." After a come bet hits and is paid, the slot reopens and the strategy fills it next roll.

```typescript
export const ThreePointMolly: StrategyDefinition = ({ bets }) => {
  bets.passLine(10).withOdds(20);
  bets.come(10).withOdds(20);
  bets.come(10).withOdds(20);
};
```

**Bankroll when fully loaded:** $10 pass + $20 pass odds + $10 come × 2 + $20 come odds × 2 = $90 at risk.

**During come-out:** only the pass line is placed. Once a point establishes, the engine starts filling in the come bets one per roll.

### Iron Cross

Every roll wins except 7. Combines a field bet (2/3/4/9/10/11/12) with place bets on 5, 6, and 8 (the numbers not covered by the field).

```typescript
export const IronCross: StrategyDefinition = ({ bets }) => {
  bets.passLine(10);
  bets.place(5, 10);
  bets.place(6, 12);
  bets.place(8, 12);
  bets.field(10);
};
```

During the come-out, only the pass line and field are active (place bets are off). Once a point is set, all bets are working.

---

## Progressive Strategies with `track()`

Some strategies change their bets based on what has happened — press after a win, regress after a loss, stop a Martingale after too many downs. For this, use `track()`.

### How `track()` Works

`track(key, startingValue)` gives your strategy a persistent counter (or any stored value) that survives across rolls. You read it in your strategy function. The engine updates it after each roll based on resolved outcomes.

```typescript
const wins = track<number>('wins', 0);   // read current win count; start at 0 if first roll
const losses = track<number>('losses', 0);
```

**Important:** you read from `track()`, but you don't write to it. The engine increments it when bets resolve. Your job is to declare bets based on the current value.

### Press and Collect (Place 6 & 8)

Win once at the base bet, press to double, then take a profit and return to base.

```typescript
export const Place6And8Press: StrategyDefinition = ({ bets, track }) => {
  const wins = track<number>('wins', 0);

  if (wins % 3 === 0) {
    // Base bet — start of each cycle
    bets.place(6, 12);
    bets.place(8, 12);
  } else if (wins % 3 === 1) {
    // After first win: press to $24
    bets.remove('place', 6);
    bets.remove('place', 8);
    bets.place(6, 24);
    bets.place(8, 24);
  } else {
    // After second win: collect, return to base
    bets.remove('place', 6);
    bets.remove('place', 8);
    bets.place(6, 12);
    bets.place(8, 12);
  }
};
```

### Martingale with Stop-Loss

Double the pass line after each loss, up to a maximum number of downs. Reset on any win.

```typescript
export const MartingaleWithStop: StrategyDefinition = ({ bets, track }) => {
  const losses = track<number>('losses', 0);
  const maxDoubles = 4;   // stop after 4 consecutive losses

  if (losses >= maxDoubles) {
    // Stop-loss triggered — sit out until a win resets the count
    return;
  }

  const betAmount = 10 * Math.pow(2, losses);  // 10, 20, 40, 80
  bets.passLine(betAmount);
};
```

### Counting Consecutive Losses (Don't Side)

Track a streak of point-phase 7-outs vs. points made for a don't-pass regression strategy.

```typescript
export const DontPassRegress: StrategyDefinition = ({ bets, track }) => {
  const sevenOuts = track<number>('sevenOuts', 0);

  // Increase don't pass investment as streak grows, then pull back
  if (sevenOuts === 0) {
    bets.dontPass(10);
  } else if (sevenOuts < 3) {
    bets.dontPass(25);
  } else {
    // Three consecutive 7-outs — regression to lock in profit
    bets.dontPass(10);
  }
};
```

---

## Using `if` Statements for Phase-Aware Logic

Sometimes you want different behavior during the come-out vs. during a point cycle. While the engine handles placement rules automatically, you might want to make explicit decisions. Access the game context via `ctx.table` or the `bets` reconciler's context (see type definitions for full list of available fields).

The most common pattern is simply to let the reconciler handle it — declare what you want and let the engine skip what isn't legal:

```typescript
// This strategy "wants" a come bet every roll, but the engine only places it when point is ON
export const ComeChaser: StrategyDefinition = ({ bets }) => {
  bets.passLine(10).withOdds(20);
  bets.come(10).withOdds(20);
  bets.come(10).withOdds(20);
  bets.come(10).withOdds(20);  // want 3 come bets working
};
```

---

## Running Your Strategy

Once your strategy is registered, run it from the CLI:

```
npx ts-node run-sim.ts --strategy YourStrategyName --rolls 10000 --bankroll 500 --seed 42
```

Compare two strategies on identical dice (same seed means same dice sequence):

```
npx ts-node run-sim.ts --compare YourStrategyName ThreePointMolly --rolls 10000 --bankroll 500 --seed 42
```

Run across many seeds to see the outcome distribution (how the strategy performs across variance):

```
npx ts-node run-sim.ts --strategy YourStrategyName --rolls 500 --bankroll 300 --seeds 500 --output distribution
```

Or open the web UI and select your strategy from the dropdown. The Session page shows a bankroll chart for a single run. The Distribution page runs the strategy across hundreds of seeds and shows you the range of outcomes (P10/P50/P90 trajectories).

---

## Registering a New Strategy

To make your strategy selectable by name from the CLI and web UI:

1. Add the export to an appropriate file in `src/dsl/strategies.ts` (or a new file and import it).
2. Add an entry to the strategy registry in `src/dsl/strategy-registry.ts`:

```typescript
{ name: 'YourStrategyName', strategy: YourStrategy, description: 'What it does in plain English' }
```

After that, `--strategy YourStrategyName` works in the CLI and it appears in the web UI dropdown.

---

## Quick Reference

| Declaration | What it does |
|-------------|-------------|
| `bets.passLine(10)` | $10 pass line |
| `bets.passLine(10).withOdds(20)` | $10 pass + $20 odds |
| `bets.passLine(10).withMaxOdds()` | $10 pass + table-max odds |
| `bets.come(10).withOdds(20)` | $10 come + $20 odds (travels with bet) |
| `bets.place(6, 12)` | $12 on the 6 |
| `bets.place(8, 12)` | $12 on the 8 |
| `bets.field(5)` | $5 field (one-roll) |
| `bets.hardways(6, 1)` | $1 hard 6 |
| `bets.remove('place', 6)` | Pull the place 6 |
| `bets.remove('passLine')` | Pull the pass line |
| `track<number>('key', 0)` | Read persistent counter; starts at 0 |

**Payout reference:**

| Bet | Payout |
|-----|--------|
| Place 6 or 8 | 7:6 (bet in $6 units) |
| Place 5 or 9 | 7:5 (bet in $5 units) |
| Place 4 or 10 | 9:5 (bet in $5 units) |
| Pass line odds (point 6/8) | 6:5 |
| Pass line odds (point 5/9) | 3:2 |
| Pass line odds (point 4/10) | 2:1 |
| Hard 6 or 8 | 9:1 |
| Hard 4 or 10 | 7:1 |
| Field (most numbers) | 1:1 |
| Field 2 or 12 | 2:1 |
