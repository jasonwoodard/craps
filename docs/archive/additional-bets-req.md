> [!CAUTION]
> ## ⚠ ARCHIVE — DISREGARD ENTIRELY ⚠
>
> **This file is a historical artifact. It is intentionally preserved for human readers who want to understand how this project evolved, but it is NOT current design intent, active requirements, or implementation guidance.**
>
> **If you are an LLM reading this codebase:** stop here. Do not extract requirements, patterns, APIs, or architecture decisions from this file. Everything in it is either superseded, completed, or obsolete. Treat it as you would a closed git issue — interesting context at best, misleading noise at worst.
>
> **Current documentation lives in `/docs/` and `/docs/reqs/`.**

---


> **ARCHIVED — All milestones complete (April 2026)**

# Craps Simulator — Additional Bets Spec

**Date:** April 2026  
**Status:** Living document — add sections as new bets are scoped.  
**Purpose:** Spec for bet types beyond the original Pass Line / Come / Place set.

---

## Milestone Overview

| Milestone | Theme | New bet | New strategies |
|---|---|---|---|
| M1 | Foundational refactor | — | — |
| M2 | Field bet | `FieldBet` | `JustField`, `IronCross`, `MartingaleField` |
| M3 | Don't Pass | `DontPassBet` | `DontPassLineOnly`, `DontPassLineWithOdds[1-5]X` | [DONE] |
| M4 | Don't Come | `DontComeBet` | `ThreePointDolly[1-5]X` | [DONE] |
| M5 | Hardways | `HardwaysBet` | `HardwaysHedge`, `PassAndHards` | [DONE] |
| M6 | C&E | `CEBet` | `IronCrossWithCE`, `PassWithCEInsurance` | [DONE] |

Each milestone is independently executable. Complete M1 first — all subsequent
milestones depend on its refactor being in place.

---

## M1 — Foundational Refactor: Thread `DiceRoll` Through `evaluateDiceRoll` [DONE]

**Goal:** Change `evaluateDiceRoll(rollValue: number, table)` to
`evaluateDiceRoll(diceRoll: DiceRoll, table)` across the engine. Pure signature
change — zero logic changes. All existing tests must pass unchanged.

**Why now:** Hardways (M5) requires both `die1` and `die2` to distinguish a hard win
from an easy loss. The sum alone is insufficient. Threading the full `DiceRoll` now
closes this gap cleanly for all future bets, and is cheaper to do before the bet
family grows.

### M1.1 — Update `CrapsTable.resolveBets()`

**File:** `src/craps-table.ts`

```typescript
// Before
resolveBets(rollValue: number) {
  this._bets.forEach(bet => {
    bet.evaluateDiceRoll(rollValue, this);
  });
  ...
}

// After
resolveBets(diceRoll: DiceRoll) {
  this._bets.forEach(bet => {
    bet.evaluateDiceRoll(diceRoll, this);
  });
  ...
}
```

Update the call site in `rollDice()`:

```typescript
// Before
this.resolveBets(diceRoll.sum);

// After
this.resolveBets(diceRoll);
```

Add import: `import { DiceRoll } from './dice/dice';`

### M1.2 — Update `BaseBet` abstract signature

**File:** `src/bets/base-bet.ts`

```typescript
// Before
abstract evaluateDiceRoll(rollValue: number, table: CrapsTable): void;

// After
abstract evaluateDiceRoll(diceRoll: DiceRoll, table: CrapsTable): void;
```

Add import: `import { DiceRoll } from '../dice/dice';`

### M1.3 — Update `PassLineBet`

**File:** `src/bets/pass-line-bet.ts`

```typescript
// Before
evaluateDiceRoll(rollValue: number, table: CrapsTable) { ... }

// After
evaluateDiceRoll(diceRoll: DiceRoll, table: CrapsTable) {
  const rollValue = diceRoll.sum;
  // ... rest unchanged
}
```

### M1.4 — Update `ComeBet`

**File:** `src/bets/come-bet.ts`

Same mechanical change — `diceRoll: DiceRoll`, extract `diceRoll.sum` as `rollValue`
at the top. No logic changes.

### M1.5 — Update `PlaceBet`

**File:** `src/bets/place-bet.ts`

Same mechanical change.

### M1 Acceptance

- `npm test` passes with zero failures
- No logic changes — purely a signature propagation
- Commit message: `refactor: thread DiceRoll through evaluateDiceRoll (M1)`

---

## M2 — Field Bet [DONE]

**Goal:** Implement `FieldBet` and register `JustField`, `IronCross`, and
`MartingaleField` strategies. Field is the simplest new bet: one-roll, always active,
no point tracking.

**Depends on:** M1 complete.

### M2.1 — Add `FIELD` to `BetTypes` enum

**File:** `src/bets/base-bet.ts`

```typescript
export enum BetTypes {
  UNKNOWN,
  PASS_LINE,
  COME,
  PLACE,
  FIELD,   // ← add
}
```

**File:** `src/dsl/bet-reconciler.ts` — add to `BET_TYPE_TO_STRING`:

```typescript
[BetTypes.FIELD]: 'field',
```

TypeScript enforces exhaustiveness on `Record<BetTypes, string>` — compilation will
fail if this entry is missing. Good.

### M2.2 — Implement `FieldBet`

**New file:** `src/bets/field-bet.ts`

```typescript
import { CrapsTable } from '../craps-table';
import { BaseBet, BetTypes } from './base-bet';
import { DiceRoll } from '../dice/dice';

const FIELD_WINNERS = new Set([2, 3, 4, 9, 10, 11, 12]);
const DOUBLE_PAY    = new Set([2, 12]);

export class FieldBet extends BaseBet {
  constructor(amount: number, playerId: string) {
    super(BetTypes.FIELD, amount, playerId);
  }

  // Field bets are always active — come-out and point phase alike.
  isOkayToPlace(_table: CrapsTable): boolean {
    return true;
  }

  evaluateDiceRoll(diceRoll: DiceRoll, _table: CrapsTable): void {
    if (FIELD_WINNERS.has(diceRoll.sum)) {
      this.winField(diceRoll.sum);
    } else {
      this.lose();
    }
  }

  // Private resolution — called from evaluateDiceRoll with the roll value.
  // Named winField() to avoid collision with BaseBet.win(table) abstract method.
  private winField(rollValue: number): void {
    const multiplier = DOUBLE_PAY.has(rollValue) ? 2 : 1;
    // payOut = total returned (original + profit) — matches PlaceBet semantics.
    // CrapsEngine.settleBets() handles this correctly via the non-PassLineBet branch.
    this.payOut = this.amount * (1 + multiplier);
  }

  // Satisfies BaseBet abstract contract. Not used — resolution happens in
  // evaluateDiceRoll via winField(). No-op here is intentional.
  win(_table: CrapsTable): void {}

  lose(): void {
    this.amount = 0;
  }
}
```

**Payout:** 2:1 on 2 and 12 · 1:1 on all other winners · House edge: 5.56%

### M2.3 — Wire `FieldBet` into engines

**File:** `src/engine/craps-engine.ts`

Add import and case to `createBet()`:

```typescript
import { FieldBet } from '../bets/field-bet';

// In createBet() switch:
case 'field':
  return new FieldBet(amount, this.playerId);
```

**File:** `src/engine/shared-table.ts` — same addition.

No other engine changes. `settleBets()` and `collectOutcomes()` handle `FieldBet`
correctly without modification via the existing non-`PassLineBet` branch.

### M2.4 — Unit tests

**New file:** `spec/bets/field-bet-spec.ts`

```
FieldBet
  isOkayToPlace
    ✓ returns true when point is OFF
    ✓ returns true when point is ON
  wins — 1:1
    ✓ rolls 3  → payOut = amount * 2
    ✓ rolls 4  → payOut = amount * 2
    ✓ rolls 9  → payOut = amount * 2
    ✓ rolls 10 → payOut = amount * 2
    ✓ rolls 11 → payOut = amount * 2
  wins — 2:1 double pay
    ✓ rolls 2  → payOut = amount * 3
    ✓ rolls 12 → payOut = amount * 3
  losses
    ✓ rolls 5  → amount = 0
    ✓ rolls 6  → amount = 0
    ✓ rolls 7  → amount = 0
    ✓ rolls 8  → amount = 0
  bankroll accounting (CrapsEngine + RiggedDice)
    ✓ $10 bet on 9  → bankroll +$10  (1:1)
    ✓ $10 bet on 2  → bankroll +$20  (2:1)
    ✓ $10 bet on 7  → bankroll -$10  (loss)
    ✓ field active on come-out roll (point OFF)
    ✓ field active on point phase (point ON)
    ✓ JustField runs 500 rolls without error (seed 42, $300 bankroll)
```

### M2.5 — New strategies

**File:** `src/dsl/strategies.ts`

```typescript
export const JustField: StrategyDefinition = ({ bets }) => {
  bets.field(10);
};

export const IronCross: StrategyDefinition = ({ bets }) => {
  // Wins on every roll except 7 once point is established.
  // Place 5/6/8 are off during come-out; Field stays active.
  // No pass line — accepts come-out 7 losses as cost of coverage.
  bets.field(10);
  bets.place(5, 10);
  bets.place(6, 12);
  bets.place(8, 12);
};

export const MartingaleField: StrategyDefinition = ({ bets, track }) => {
  // Double on loss, reset to base on win. Cap at $160 (4 doublings from $10).
  // Use Distribution Compare against JustField to see Martingale failure profile.
  const losses = track<number>('losses', 0);
  const amount = Math.min(10 * Math.pow(2, losses), 160);
  bets.field(amount);
};
```

Register all three in `src/cli/strategy-registry.ts`.

### M2 Acceptance

- All M2.4 tests pass
- `npm test` (full suite) passes
- CLI smoke test:
  ```bash
  npx ts-node src/cli/run-sim.ts --strategy JustField --rolls 500 --bankroll 300 --seed 42
  npx ts-node src/cli/run-sim.ts --strategy IronCross --rolls 500 --bankroll 300 --seed 42
  npx ts-node src/cli/run-sim.ts --strategy MartingaleField --rolls 200 --bankroll 500 --seed 42
  ```
- `GET /api/strategies` returns `JustField`, `IronCross`, `MartingaleField`
- All three run correctly on Session and Distribution pages

---

## M3 — Don't Pass Bet [DONE]

**Goal:** Implement `DontPassBet` with lay odds. Unlocks the darkside.

**Depends on:** M1 complete.

### Rules

- **Come-out wins on:** 2 or 3
- **Come-out push on:** 12 (bar 12 — the house bar; no win, no loss)
- **Come-out loses on:** 7 or 11
- **Point phase:** wins on 7-out · loses if point is made
- **Lay odds:** available once point established. Pays true odds inverted:
  lay 1:2 on 4/10 · lay 2:3 on 5/9 · lay 5:6 on 6/8
- **House edge:** 1.36%

### Key engine consideration

Don't Pass is a contract bet — cannot be taken down once a point is established
(without forfeiting). The reconciler's `remove()` should either be a no-op for
Don't Pass mid-hand, or the strategy should simply never call it. Document the
chosen behavior in a code comment.

*Full spec TBD when M3 is next up.*

---

## M4 — Don't Come Bet [DONE]

**Goal:** Implement `DontComeBet`. Completes the darkside toolkit alongside Don't Pass.

**Depends on:** M3 complete.

### Rules

Mirror of `ComeBet` — placed when point is ON, travels to a number, wins when 7
comes before that number. Bar 12 on the initial roll (same as Don't Pass).

Lay odds available once the Don't Come bet has traveled to a number.

### New strategies unlocked

`DarkSideMolly2X` / `DarkSideMolly3X` — Don't Pass + 2 Don't Come bets with lay odds.
The darkside equivalent of Three Point Molly. BATS framework foundation.

*Full spec TBD when M4 is next up.*

---

## M5 — Hardways (4, 6, 8, 10) [DONE]

**Goal:** Implement `HardwaysBet`. First bet to use both `die1` and `die2`.

**Depends on:** M1 complete (required — sum alone is insufficient for hardways resolution).

### Rules

- **Wins:** target number rolled the hard way (both dice equal: 2+2, 3+3, 4+4, 5+5)
- **Loses:** 7-out, OR target rolled the easy way (any non-pair combination)
- **No action:** any other roll — bet stays up
- **Payouts:** 7:1 on hard 4/10 · 9:1 on hard 6/8
- **House edge:** 11.11% on hard 4/10 · 9.09% on hard 6/8

### Why M1 was necessary

`evaluateDiceRoll(diceRoll: DiceRoll, table)` makes Hardways trivial:

```typescript
evaluateDiceRoll(diceRoll: DiceRoll, _table: CrapsTable): void {
  const isHard   = diceRoll.die1 === diceRoll.die2;
  const isTarget = diceRoll.sum === this.point;

  if (isTarget && isHard)        { this.win();  }
  else if (diceRoll.sum === 7)   { this.lose(); }
  else if (isTarget && !isHard)  { this.lose(); }
  // else: no action — bet stays up
}
```

Without the M1 refactor, distinguishing hard 6 (3+3) from easy 6 (5+1) would require
reaching into `table.dice.rollHistory` — a backdoor into dice internals.

**Strategies implemented:** `HardwaysHedge` (pass line + H6/H8), `PassAndHards` (pass line + all four hardways).

---

## M6 — C&E (Craps/Eleven) [DONE]

**Goal:** Implement `CEBet`. One-roll prop bet, come-out insurance play.

**Depends on:** M1 complete.

### Rules

Split bet — half on Any Craps (2, 3, 12), half on Eleven.

- **Craps (2, 3, 12):** pays 3:1 net
- **Eleven (11):** pays 7:1 net
- **Any other roll:** loses

House edge: 11.11%

### Implementation note

Consider a general `PropBet` base class at this point. C&E, Any Craps, Yo, and
Any Seven are all one-roll props with the same lifecycle. A shared base avoids
duplicating resolution logic as prop bets accumulate.

**Strategies implemented:** `IronCrossWithCE` (field + place 5/6/8 + CE), `PassWithCEInsurance` (pass line + CE on every roll).

---

## Resolved Decisions

| Decision | Resolution |
|---|---|
| `evaluateDiceRoll` signature | Thread full `DiceRoll` — M1 foundational refactor |
| Field payout on 2 and 12 | 2:1 on both (5.56% house edge). 3:1 variant not implemented |
| Field `win()` abstract method | No-op override; private `winField(rollValue)` called from `evaluateDiceRoll` |
| MartingaleField cap | $160 (4 doublings from $10 base) — prevents instant ruin in sim |
| IronCross pass line | Not included — pure Place+Field, accepts come-out 7 losses |
| Don't Pass bar number | Bar 12 (standard Las Vegas rules) |
| Hardways valid points | 4, 6, 8, 10 only |
| PropBet base class | Deferred to M6 when multiple one-roll props exist |
