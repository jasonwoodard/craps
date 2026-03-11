# Craps Simulator — Functional Requirements

**Date:** March 2026
**Status:** Draft v1 — for review and comment

---

## Purpose

Define what the craps simulator must and must not do, at a level of detail sufficient to guide implementation decisions and resolve design ambiguity.

---

## 1. Core Game Engine

- The simulator **must** implement standard Las Vegas craps rules for all supported bet types.
- The simulator **must** correctly handle the come-out phase (point OFF) and the point phase (point ON) as distinct game states.
- The simulator **must** resolve bets in the correct order relative to dice outcome (e.g., pass line wins before place bets are evaluated on the same roll).
- The simulator **must NOT** silently accept invalid bet placements (e.g., pass line during point ON); these must either be rejected or skipped with a reason logged.
- The simulator **must** track shooter hand lifecycle: come-out → point established → point made or seven-out.

---

## 2. Dice and Randomness

- The simulator **must** use a seedable, reproducible random number generator (Mersenne Twister or equivalent) so that any roll sequence can be replayed exactly.
- The simulator **must NOT** use modulo reduction on large RNG ranges to produce die faces, as this introduces statistical bias. Rejection sampling must be used instead.
- The simulator **must** support injecting a fixed roll sequence (rigged dice) for testing purposes, completely replacing RNG output.
- The simulator **must NOT** expose raw RNG state to strategies; strategies are not permitted to look ahead or manipulate randomness.

---

## 3. Strategy Definition

- A strategy **must** be defined as a pure function (`StrategyDefinition`) that receives a context object and declares desired bets via a `BetReconciler`.
- A strategy **must NOT** directly mutate table state; all bet changes flow through the reconciler.
- A strategy **must** be callable once per roll, before the dice are thrown.
- A strategy **must** be able to maintain state across rolls via a `track(key, initial)` primitive.
- The `track()` write path **must** be owned by the engine, updated post-roll based on resolved outcomes; strategies **must NOT** write to tracked values directly.
- A strategy **must NOT** need to guard for game phase (come-out vs. point ON) in most cases; the engine must skip bet placements that violate table rules automatically.
- Strategies **must** be idempotent: declaring a bet that already exists at the same amount is a no-op.

---

## 4. Shared-Table Strategy Comparison (primary feature)

- The simulator **must** support running two or more strategies against the **same sequence of dice rolls** within a single simulation run.
- Each strategy **must** maintain its own independent bankroll, bet state, and tracked variables; strategies **must NOT** share any mutable state.
- The dice roll sequence **must** be generated once and replayed identically across all strategies being compared.
- A comparison run **must** produce per-strategy output (bankroll over time, net win/loss, total bets placed, total at risk) in a format that can be directly compared side-by-side.
- The comparison **must NOT** be implemented as two independent games with the same RNG seed — this is an approximation and can diverge if strategies place different numbers of bets that consume RNG calls differently.
- The simulator **must** clearly distinguish between single-strategy runs and multi-strategy comparison runs in both the API and output format.
- The comparison API **must** look like this (or equivalent):

  ```typescript
  const table = new SharedTable({ seed: 42, rolls: 10000 });
  table.addStrategy('ThreePointMolly', ThreePointMolly, { bankroll: 500 });
  table.addStrategy('Place6And8',      Place6And8,      { bankroll: 500 });
  const results = table.run();
  // results['ThreePointMolly'].finalBankroll, results['Place6And8'].finalBankroll, etc.
  ```

- The simulator **must NOT** require strategies to be aware they are being compared; each strategy receives the same context interface as in a standalone run.

---

## 5. Bet Types

- The simulator **must** support: Pass Line, Pass Line Odds, Come, Come Odds, Place (4, 5, 6, 8, 9, 10).
- The simulator **must** pay Place bets at correct non-even odds: 9:5 on 4/10, 7:5 on 5/9, 7:6 on 6/8.
- The simulator **must** enforce table minimum and maximum bet limits (configurable per run).
- The simulator **must** enforce maximum odds multiples (configurable per run, e.g., 3-4-5x).
- The simulator **must NOT** implement Don't Pass, Don't Come, Field, or Hardways bets in the initial version; these are deferred.
- The simulator **must** take Place bets off (no action) during the come-out roll by default.
- Come bets **must** travel to the number rolled on the next throw; their odds must travel with them.

---

## 6. Progressive Strategies and State

- The `track()` system **must** support integers, booleans, and arbitrary JSON-serializable values as tracked state.
- The engine **must** update tracked values after each roll's outcomes are resolved and before the next strategy call.
- Progressive strategies (press after win, regress after loss, Martingale stop-loss) **must** be expressible using only `track()` and the `BetReconciler` API — no class inheritance or imperative callbacks required.
- The simulator **must NOT** require strategies to be rewritten when the comparison mode is used; the same strategy definition runs in both single and multi-strategy contexts.

---

## 7. Simulation Output and Logging

- Each simulation run **must** produce a structured log of every roll: dice values, bets resolved, amounts won/lost, bankroll after roll.
- The log **must** be available as a structured data object (array of roll records) for programmatic analysis, not just as printed text.
- The simulator **must** emit summary statistics at the end of each run: starting bankroll, final bankroll, net, max bankroll reached, min bankroll reached, total rolls, number of seven-outs, number of points made.
- The simulator **must NOT** print raw object dumps as its default output; all output must be formatted for human readability or structured for machine consumption.
- The simulator **must** support a verbose mode (full roll-by-roll log) and a summary-only mode.

---

## 8. CLI Runner

- The simulator **must** expose a command-line interface for running simulations without writing code.
- The CLI **must** accept: strategy name(s), number of rolls, starting bankroll, RNG seed, and output format (summary / verbose / JSON).
- The CLI **must** support specifying two strategies for a comparison run.
- The CLI **must NOT** require the user to edit source files to run a standard strategy; named strategies must be selectable by string.
- Example:

  ```
  npx ts-node run-sim.ts --strategy ThreePointMolly --rolls 10000 --bankroll 500 --seed 42
  npx ts-node run-sim.ts --compare ThreePointMolly Place6And8 --rolls 10000 --bankroll 500 --seed 42
  ```

---

## 9. Testing

- All bet types **must** have unit tests covering: correct placement, correct payout, correct loss, and edge cases (e.g., come bet during come-out).
- The reconciler **must** have tests verifying that declaring an existing bet at the same amount is a no-op, and that declaring a different amount produces an update command.
- Shared-table comparison **must** have at least one integration test verifying that both strategies see identical dice rolls across the full run.
- Tests **must NOT** depend on real RNG output; all game-logic tests must use rigged dice or a fixed seed with asserted roll counts.

---

## 10. Out of Scope (v1)

- **Graphics or visual output** — text only.
- **Don't Pass / Don't Come** — deferred.
- **Field, Hardways, Proposition bets** — deferred.
- **Multi-shooter / table rotation** — single shooter per run; no player rotation.
- **Networked or multiplayer** — single-process only.
- **Persistence / save state** — no save/resume between runs.
