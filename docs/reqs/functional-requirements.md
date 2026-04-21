# Craps Simulator — Functional Requirements

**Date:** April 2026
**Status:** Draft v2 — expanded to cover Engine, Web UI, and Analytics

---

## Purpose

Define what the craps simulator must and must not do, at a level of detail sufficient to guide implementation decisions and resolve design ambiguity.

---

# Part I: Game Engine

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

## 3. Bet Types

- The simulator **must** support: Pass Line, Pass Line Odds, Come, Come Odds, Place (4, 5, 6, 8, 9, 10), Don't Pass, Don't Come, Field, Hardways (4, 6, 8, 10), and Craps-Eleven (CE).
- The simulator **must** pay Place bets at correct non-even odds: 9:5 on 4/10, 7:5 on 5/9, 7:6 on 6/8.
- The simulator **must** pay Pass Line odds at correct odds: 2:1 on 4/10, 3:2 on 5/9, 6:5 on 6/8.
- The simulator **must** pay Don't Pass / Don't Come lay odds at the inverse: 1:2 on 4/10, 2:3 on 5/9, 5:6 on 6/8.
- The simulator **must** handle the bar-12 rule on Don't Pass / Don't Come come-out rolls: a 12 is a push, not a loss.
- The simulator **must** pay Field bets at 1:1 on 3, 4, 9, 10, 11 and at 2:1 on 2 and 12.
- The simulator **must** enforce table minimum and maximum bet limits (configurable per run).
- The simulator **must** enforce maximum odds multiples (configurable per run, e.g., 3-4-5x).
- The simulator **must** take Place bets off (no action) during the come-out roll by default.
- Come bets **must** travel to the number rolled on the next throw; their odds must travel with them.
- Each bet type **must** implement an `isOkayToPlace(table)` guard that enforces game-phase placement rules.

---

## 4. Strategy Definition and Reconciler

- A strategy **must** be defined as a pure function (`StrategyDefinition`) that receives a context object and declares desired bets via a `BetReconciler`.
- A strategy **must NOT** directly mutate table state; all bet changes flow through the reconciler.
- A strategy **must** be callable once per roll, before the dice are thrown.
- A strategy **must** be able to maintain state across rolls via a `track(key, initial)` primitive.
- The `track()` write path **must** be owned by the engine, updated post-roll based on resolved outcomes; strategies **must NOT** write to tracked values directly.
- A strategy **must NOT** need to guard for game phase (come-out vs. point ON) in most cases; the engine must skip bet placements that violate table rules automatically.
- Strategies **must** be idempotent: declaring a bet that already exists at the same amount is a no-op.
- The reconciler **must** expose: `passLine`, `come`, `place`, `field`, `dontPass`, `dontCome`, `hardways`, `ce`, and `remove`.
- The reconciler **must** support chaining odds onto Pass Line and Come bets via `.withOdds(amount)`.

---

## 5. Stage Machine

- The engine **must** provide a `stageMachine()` fluent builder for defining multi-stage strategies without class inheritance or imperative callbacks.
- A stage machine strategy **must** be composed of named stages, each specifying: a `board` function (bet declarations), optional `canAdvanceTo` and `mustRetreatTo` guards, and event handlers.
- Stage transitions **must** be triggered either imperatively (via `advanceTo`) inside an event handler, or automatically by the engine after evaluating the `canAdvanceTo` / `mustRetreatTo` guards post-roll.
- Each stage **must** have access to a scoped `track()` state that resets when the stage is re-entered from a different stage.
- The stage machine **must** emit the following events that stages can handle: `comeOut`, `pointEstablished`, `numberHit`, `sevenOut`, `comeTravel`, `naturalWin`.
- A stage machine strategy **must** be usable anywhere a plain `StrategyDefinition` is accepted — the stage machine is an implementation detail, not a separate execution path.
- The `session` context available to stages **must** expose read-only: current profit, current stage name, consecutive 7-outs, and hands played.
- The `table` context available to stages **must** expose read-only: current point, active coverage set, whether 6 and 8 are covered, and come bets currently in transit.

---

## 6. Progressive Strategies and State

- The `track()` system **must** support integers, booleans, and arbitrary JSON-serializable values as tracked state.
- The engine **must** update tracked values after each roll's outcomes are resolved and before the next strategy call.
- Progressive strategies (press after win, regress after loss, Martingale stop-loss) **must** be expressible using only `track()` and the `BetReconciler` API — no class inheritance or imperative callbacks required.
- The simulator **must NOT** require strategies to be rewritten when the comparison mode is used; the same strategy definition runs in both single and multi-strategy contexts.

---

## 7. Shared-Table Strategy Comparison

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

## 8. Simulation Output and Logging

- Each simulation run **must** produce a structured log of every roll: dice values, bets resolved, amounts won/lost, bankroll after roll.
- The log **must** be available as a structured data object (array of `RollRecord` items) for programmatic analysis, not just as printed text.
- The simulator **must** emit summary statistics at the end of each run: starting bankroll, final bankroll, net, max bankroll reached, min bankroll reached, total rolls, number of seven-outs, number of points made.
- Summary statistics **must** also include: average table load, max table load, rolls with a win, rolls with a loss, win rate, loss rate, and dice-sum frequency distribution.
- The simulator **must NOT** print raw object dumps as its default output; all output must be formatted for human readability or structured for machine consumption.
- The simulator **must** support a verbose mode (full roll-by-roll log) and a summary-only mode.

---

## 9. Strategy Registry

- The engine **must** maintain a named registry of built-in strategies selectable by string.
- The registry **must** include strategies spanning: basic flat-bet styles (Pass Line, Place 6/8, Field), odds-based styles (2x–5x odds variants), don't-side strategies (Don't Pass with lay odds), progressive / Martingale variants, combination styles (Iron Cross, Three-Point Molly variants), and stage machine strategies (CATS and variants).
- The registry **must** be the single source of truth used by both the CLI and the backend API; strategies **must NOT** be registered separately for each entry point.

---

## 10. CLI Runner

- The simulator **must** expose a command-line interface for running simulations without writing code.
- The CLI **must** accept: strategy name(s), number of rolls, starting bankroll, RNG seed, and output format (summary / verbose / JSON / distribution).
- The CLI **must** support specifying two strategies for a comparison run.
- The CLI **must** support a distribution mode that runs a single strategy across many seeds and outputs aggregate percentile statistics (p10, p50, p90, p95, p99).
- The CLI **must NOT** require the user to edit source files to run a standard strategy; named strategies must be selectable by string.
- Examples:

  ```
  npx ts-node run-sim.ts --strategy ThreePointMolly --rolls 10000 --bankroll 500 --seed 42
  npx ts-node run-sim.ts --compare ThreePointMolly Place6And8 --rolls 10000 --bankroll 500 --seed 42
  npx ts-node run-sim.ts --strategy CATS --rolls 500 --bankroll 300 --seeds 500 --output distribution
  ```

---

## 11. Testing

- All bet types **must** have unit tests covering: correct placement, correct payout, correct loss, and edge cases (e.g., come bet during come-out, bar-12 on don't pass).
- The reconciler **must** have tests verifying that declaring an existing bet at the same amount is a no-op, and that declaring a different amount produces an update command.
- Shared-table comparison **must** have at least one integration test verifying that both strategies see identical dice rolls across the full run.
- Tests **must NOT** depend on real RNG output; all game-logic tests must use rigged dice or a fixed seed with asserted roll counts.

---

# Part II: Web Application and Analytics

## 12. Backend API Server

- The server **must** expose a REST API consumed exclusively by the web UI; it is not a public API.
- **POST `/api/simulate`** — run a single strategy for N rolls; return the full `EngineResult` (log + summary).
- **GET `/api/distribution/stream`** — run a strategy across many seeds; stream progress and partial aggregates via Server-Sent Events (SSE) until completion.
- **POST `/api/session-compare`** — run two or more strategies on the same dice sequence; return per-strategy logs and summaries.
- **GET `/api/distribution-compare/stream`** — run two strategies across many seeds each and stream comparative distribution data via SSE.
- **GET `/api/strategies`** — return the list of registered strategy names.
- All endpoints **must** validate inputs and return structured error responses; they **must NOT** crash the server on bad input.
- The SSE endpoints **must** emit incremental progress events (percent complete, partial aggregates) so the UI can display a live progress indicator without waiting for full completion.

---

## 13. Session Viewer (Single Run)

- The web UI **must** provide a page for running a single strategy over a single dice sequence and inspecting the result in detail.
- The page **must** display: final bankroll, net profit/loss, peak bankroll, max drawdown, win rate, total rolls.
- The page **must** render a bankroll-over-time line chart for the full run.
- The page **must** display a stage breakdown panel showing time (rolls and percentage) spent in each stage, when the strategy uses the stage machine.
- The page **must** display a trend panel showing derived metrics: average profit per roll, total hands played, and seven-out frequency.
- Run parameters (strategy, rolls, bankroll, seed) **must** be reflected in the page URL so results are shareable and bookmarkable.
- The page **must** allow the user to re-run with a new random seed without navigating away.

---

## 14. Distribution Analysis

- The web UI **must** provide a page for running a strategy across a large number of seeds (e.g., 200–1000+) to characterize the strategy's outcome distribution.
- The page **must** display a percentile band chart showing P10, P50, and P90 bankroll trajectories over time.
- The page **must** display final-bankroll and peak-bankroll percentiles (P10, P25, P50, P75, P90) and their mean values.
- The page **must** display a ruin curve: probability of having been ruined by roll N, plotted over time.
- The page **must** display aggregate win rate and ruin rate across all seeds.
- While the distribution is computing, the page **must** show a progress bar and update the charts incrementally as seeds complete.
- The page **must** allow the user to download the computed distribution as a JSON file for offline use.
- The page **must** allow the user to upload a previously saved distribution file and view its charts without re-running the simulation.

---

## 15. Session Comparison

- The web UI **must** provide a page for running two strategies on the same dice sequence and comparing results side-by-side.
- The page **must** render bankroll-over-time charts for both strategies on the same axes.
- The page **must** display a profit delta chart showing the difference in bankroll between the two strategies at each roll.
- The page **must** show per-strategy summary panels (final bankroll, net, peak, drawdown, win rate) in a side-by-side layout.
- The page **must** show per-strategy stage breakdowns when applicable.
- Run parameters **must** be reflected in the URL so comparisons are shareable.

---

## 16. Distribution Comparison

- The web UI **must** provide a page for comparing the outcome distributions of two strategies across many seeds.
- The page **must** overlay the P10/P50/P90 percentile bands for both strategies on a single chart, with visual distinction between them.
- The page **must** display a side-by-side summary of final-bankroll and peak-bankroll percentiles for both strategies.
- The page **must** stream progress for both distributions and update charts incrementally.

---

## 17. Strategy Browser and Guide

- The web UI **must** provide a page listing all registered strategies with their names and plain-language descriptions.
- The web UI **must** provide a guide page covering: craps rules reference, bet type explanations, and instructions for using the simulator.
- Strategy names on the browser page **must** link directly to a pre-filled Session Viewer URL for that strategy.

---

## 18. Out of Scope

- **Graphics or casino-style visual output** — text and chart-based output only; no 3D rendering or animated dice.
- **Multi-shooter / table rotation** — single shooter per run; no player rotation between hands.
- **Networked or multiplayer** — single-process simulation only; no real-time shared sessions.
- **Persistence / save state** — no save/resume between runs (distribution JSON export is a snapshot, not a resumable state).
- **Authentication / user accounts** — the web UI is unauthenticated; it is intended for local or trusted-network use.
- **Real-money integration** — the simulator is for analysis only; no connection to any gambling platform or payment system.
