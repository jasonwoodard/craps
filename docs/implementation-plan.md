# Craps Simulator — Implementation Plan

**Date:** March 2026
**Status:** In Progress — Milestone 1 complete (M1.1–M1.6)

---

## Overview

Three milestones, each building on the last. Each ends with a structured review pass followed by a demo that exercises the milestone's primary CUJ(s).

| Milestone | Theme | Primary CUJs | Status |
|-----------|-------|--------------|--------|
| M1 | Core engine — DSL wired end-to-end | 4.0 | DONE |
| M2 | Output and CLI — usable from the terminal | 1.0, 1.2, 1.3, 2.0 | IN PROGRESS — M2.1, M2.2, M2.3, M2.4, M2.5 DONE |
| M3 | Comparison and custom strategies — full feature set | 1.1, 2.1, 2.2, 2.3, 3.0, 3.1, 3.2, 4.1, 4.2 | |

### Demo Convention

Each milestone concludes with a demo file in the `demo/` folder. Demos are:
- **Free-standing**: runnable with `npx ts-node demo/<file>.ts` — no CLI or external setup required
- **Instructional**: heavily commented so a new user can learn the relevant API by reading the file
- **Self-verifying**: include assertions that fail loudly if behavior regresses
- **Cumulative**: all prior demos must remain functional as development continues (they serve as end-to-end smoke tests)

---

## Milestone 1 — Core Engine (MVP) [DONE]

**Goal:** A strategy can run end-to-end through the DSL. `ThreePointMolly` produces correct results on a known roll sequence. The old imperative layer is gone.

**Unlocks:** CUJ 4.0 (verify strategy behavior on a known roll sequence).

**Does not yet include:** CLI, structured output, comparison runs, custom strategy files.

---

### M1.1 — Fix Mersenne Twister rejection sampling [DONE]

**File:** `src/dice/mersenne-twister.ts`

Replace `(value % 6) + 1` with rejection sampling: generate a random integer, discard and retry if it falls outside the clean range for 6 faces.

- Update the die-generation method to use rejection sampling
- Add a unit test asserting per-face distribution is statistically uniform over a large sample (e.g., 60,000 rolls; each face within ±2% of the expected 10,000 count)

**FR:** 2 — reproducible, unbiased RNG
**Risk:** Low. Self-contained change with a clear acceptance test.

---

### M1.2 — Wire `ReconcileEngine` to real table state [DONE]

**File:** `src/dsl/strategy.ts` (ReconcileEngine)

`ReconcileEngine.reconcile()` currently passes `[]` as the `current` argument to `diffBets`. This means every call treats every bet as new, causing spurious "place" commands on bets that already exist.

- Pass the actual active bets from `CrapsTable`, filtered to the current player/strategy, into `diffBets` as `current`
- Extend existing `ReconcileEngine` tests to assert that calling `reconcile()` twice with the same desired state produces no commands on the second call (idempotency)

**FR:** 3 — strategies must be idempotent
**Risk:** Medium. Core correctness fix; requires understanding how the table exposes its active bets.

---

### M1.3 — Implement `ReconcileEngine.postRoll()` (track write path) [DONE]

**File:** `src/dsl/strategy.ts` (ReconcileEngine)

`track()` is readable in strategies but never updated. After each roll's outcomes are resolved, the engine must increment tracked counters.

- Add `ReconcileEngine.postRoll(outcomes: Outcome[])` method
- Define the mapping: a resolved win on any bet increments `'wins'`; a resolved loss increments `'losses'`; the engine iterates outcomes and applies the mapping
- Add tests using `SixIn8Progressive` (or a simpler fixture) to confirm that `track('wins', 0)` returns `1` after a winning roll and `0` after a losing roll

**FR:** 6 — progressive strategies require a working track() write path
**Risk:** Medium. Requires defining and stabilizing the `Outcome` type if not already consistent.

---

### M1.4 — Build `CrapsEngine` (single-strategy game loop) [DONE]

**New file:** `src/engine/craps-engine.ts`

The unified replacement for `CrapsGame` + `Player`. Drives the per-roll sequence defined in `tech-plan.md`:

1. `ReconcileEngine.reconcile()` → apply `BetCommand[]` to `CrapsTable`
2. `CrapsTable.roll()`
3. `CrapsTable.resolveBets()` → collect `Outcome[]`
4. `PlayerState.update(outcomes)` — adjust bankroll
5. `ReconcileEngine.postRoll(outcomes)` — update track() values
6. Emit roll record (stub: `console.log` or no-op for now — logger comes in M2)

Constructor signature:
```typescript
new CrapsEngine({
  strategy: StrategyDefinition,
  bankroll: number,
  rolls: number,
  seed?: number,
  dice?: Dice,         // injection point for RiggedDice in tests
})
```

- Write integration tests using `RiggedDice` to assert: come-out win pays correct amount, point-established then seven-out loses pass line, place bets pay correct odds
- These tests replace the role of old `CrapsGame` tests

**FR:** 1, 3 — core game engine, strategy definition
**Risk:** High (most complex task in M1). Depends on M1.2 and M1.3 being complete first.

---

### M1.5 — Retire the old imperative layer [DONE]

Once `CrapsEngine` integration tests pass:

- Delete `src/craps-game.ts`
- Delete `src/player.ts`
- Delete `src/strategy.ts`
- Delete `src/main.ts`
- Remove or update any spec files that import from these paths
- Confirm `npm test` passes with zero references to deleted files

**Risk:** Low once M1.4 tests are green. Do not delete until tests pass.

---

### M1.6 — Milestone 1 Review [DONE]

Run the `/simplify` skill across all files introduced or modified in M1:

- `src/dice/mersenne-twister.ts`
- `src/dsl/strategy.ts`
- `src/engine/craps-engine.ts`
- All new and modified spec files

Review checklist:
- Are there any repeated patterns that should be extracted?
- Are all error paths (invalid bet placement, bankroll exhaustion) handled or explicitly deferred?
- Does test coverage include at least: come-out phase, point phase, seven-out, place bet payout on each valid number?
- Is the `Outcome` type consistent across all consumers?

Review findings addressed:
- Consolidated `stringToBetType`/`betTypeToString` into shared functions in `bet-reconciler.ts` (eliminated duplicate mapping in `craps-engine.ts`)
- Added `CrapsTable.removeBet()` method to encapsulate bet removal (eliminated direct `bets.splice` in engine)
- Replaced `StubDice` with existing `RiggedDice` in `game-state-spec.ts`
- Hoisted point-number array to `Set` constant in `game-state.ts`
- Removed unused `player-state.ts` imports from `bet-reconciler.ts`

---

### M1.7 — Milestone 1 Demo [DONE]

**New file:** `demo/verify-strategy-on-known-rolls.ts`

**CUJ exercised:** 4.0 — Verify a strategy behaves correctly on a known roll sequence.

Demonstrates the complete M1 API surface in a single runnable file:
- Defining a strategy with the DSL (`passLine`, `place`, `withOdds`)
- Injecting a scripted dice sequence via `RiggedDice`
- Running `CrapsEngine` with deterministic dice
- Inspecting `RollRecord` outcomes, point transitions, and bankroll changes
- Programmatic assertions for each roll

Run: `npx ts-node demo/verify-strategy-on-known-rolls.ts`

---

## Milestone 2 — Output and CLI

**Goal:** A user can run a named built-in strategy from the terminal, see formatted results, reproduce a run with a seed, and get verbose roll-by-roll output.

**Unlocks:** CUJ 1.0 (run a built-in strategy), CUJ 1.2 (reproduce with seed), CUJ 1.3 (verbose output), CUJ 2.0 (run a custom strategy file).

**Does not yet include:** comparison runs, SharedTable, multi-strategy CLI flags.

---

### M2.1 — Update dice roll return to carry die1 and die2 [DONE]

**File:** `src/dice/dice.ts`, `src/craps-table.ts`

The logging spec requires individual die values. Currently `rollDice()` returns only the sum.

- Change the roll return type to `{ die1: number; die2: number; sum: number }`
- Update `CrapsTable` and `CrapsEngine` to pass `die1`/`die2` through the roll lifecycle
- Update `RiggedDice` to accept `[die1, die2]` pairs (or keep sum-only with `die1 = 0, die2 = sum` as a test-mode fallback — choose one, document the decision)
- Update any affected spec files

**FR:** 7 — logging requires individual die values
**Risk:** Low. Type change propagates through a small number of files.

Implementation notes:
- `RiggedDice` uses sum-only inputs with `die1=0, die2=sum` as a documented test-mode fallback. Game mechanics only use the sum; `RunLogger` skips `die1=0` when accumulating `byDieFace` distribution.
- Shared types (`RollRecord`, `ActiveBetInfo`, `EngineResult`) extracted to `src/engine/roll-record.ts` to avoid circular dependency between `craps-engine.ts` and `run-logger.ts`.
- `RollRecord` extended with `die1`, `die2`, `activeBets`, `tableLoadBefore`, `tableLoadAfter` to carry all logger capture-point data.

---

### M2.2 — Build `RunLogger` [DONE]

**New file:** `src/logger/run-logger.ts`

Implements the JSONL schema from `docs/strategy-logging-spec.md`.

- `RunLogger.onRoll(record: RollRecord)` — appends a JSONL line to an in-memory buffer (or write stream)
- `RunLogger.onSummary(summary: SummaryRecord)` — appends the final summary line
- `RunLogger.flush(outputMode: 'summary' | 'verbose' | 'json')` — formats and writes to stdout
  - `summary`: prints only the summary record in human-readable text
  - `verbose`: prints each roll record as human-readable text, then the summary
  - `json`: writes raw JSONL to stdout

Integrate into `CrapsEngine` at the four capture points defined in `strategy-logging-spec.md`:
1. Before `placeBets()` — `bankroll.before`, `activeBets`, `tableLoad.before`
2. After `rollDice()` — `roll.die1/die2/sum`, `gameState.pointBefore/After`
3. After bet resolution — `outcomes[]`
4. After `resolveHand()` — `bankroll.after`, `tableLoad.after`

Unit tests:
- Logger produces valid JSONL (parseable line-by-line)
- Summary record contains correct `bankroll.final`, `bankroll.peak`, `bankroll.trough`, `activity.rollsWithWin`
- `diceDistribution.bySum` correctly accumulates across rolls

**FR:** 7 — structured output and logging
**Risk:** Medium. Schema is fully specified; complexity is in capturing state at the right points in the game loop.

Implementation notes:
- `RunLogger` accepts a `LoggerConfig` (strategyName, playerId, initialBankroll, seed) at construction.
- `onRoll(record: RollRecord)` accumulates roll data and updates running stats inline.
- `buildSummary()` computes the full `SummaryRecord` from accumulated stats (peak, trough, maxDrawdown, dice distribution, activity counts, tableLoad stats).
- `flush(mode)` writes JSONL (`json`), human-readable per-roll + summary (`verbose`), or summary-only (`summary`).
- Testing accessor methods (`getRollCount()`, `getFinalBankroll()`, `getPeakBankroll()`, etc.) allow white-box unit testing without stdout capture.
- `CrapsEngineConfig` accepts optional `logger?: RunLogger`; engine calls `logger.onRoll(record)` after each roll.

---

### M2.3 — Build `StrategyRegistry` [DONE]

**New file:** `src/cli/strategy-registry.ts`

A plain object mapping string names to `StrategyDefinition` exports:

```typescript
export const BUILT_IN_STRATEGIES: Record<string, StrategyDefinition> = {
  'ThreePointMolly':   ThreePointMolly,
  'Place6And8':        Place6And8,
  'PlaceInside':       PlaceInside,
  'PlaceAll':          PlaceAll,
  'PassLineOnly':      PassLineOnly,
  'SixIn8Progressive': SixIn8Progressive,
};
```

- Include a lookup helper that throws a descriptive error if an unknown name is requested
- Unit test: all expected strategy names resolve; unknown name throws

**FR:** 8 — CLI must select strategies by name
**Risk:** Low.

Implementation notes:
- Canonical strategy definitions added to `src/dsl/strategies.ts`: `PassLineOnly`, `Place6And8`, `PlaceInside`, `PlaceAll`, `SixIn8Progressive`, and five `ThreePointMolly[1-5]X` variants (odds multiplier on a $10 flat bet). `PassLineAnd2Comes` is a deprecated alias for `ThreePointMolly5X`; `PassLineAndPlace68` is kept as-is.
- `lookupStrategy(name)` throws a descriptive error listing all available names if the name is unknown.
- Tests in `spec/cli/strategy-registry-spec.ts` verify all ten names resolve, five ThreePointMolly variants are distinct, and unknown names throw.

---

### M2.4 — Build `run-sim.ts` CLI (single strategy) [DONE]

**New file:** `src/cli/run-sim.ts`

Parse arguments, wire `CrapsEngine`, run simulation, emit output via `RunLogger`.

Supported flags for M2:

| Flag | Default |
|------|---------|
| `--strategy <name>` | required |
| `--rolls <n>` | 10000 |
| `--bankroll <n>` | 500 |
| `--seed <n>` | random |
| `--output summary \| verbose \| json` | summary |

Exit with a clear error message for unknown strategy name, missing required flag, or invalid argument type.

- Manual acceptance test: `npx ts-node src/cli/run-sim.ts --strategy ThreePointMolly --rolls 1000 --bankroll 500` produces a readable summary
- Manual acceptance test: same command with `--seed 42` produces identical output on two runs

**FR:** 8 — CLI runner
**Risk:** Low.

Implementation notes:
- `parseArgs(argv)` handles all five flags; throws descriptive errors for missing/invalid values.
- `runSim(args)` wires `lookupStrategy` → `CrapsEngine` → `RunLogger.flush(mode)`.
- `require.main === module` guard keeps the file importable in tests without running the CLI.
- Tests in `spec/cli/run-sim-spec.ts` cover argument parsing, output modes (summary/verbose/json), seed reproducibility (dice-roll identity across runs), and unknown strategy error.

---

### M2.5 — Build `StrategyFileLoader` [DONE]

**New file:** `src/cli/strategy-loader.ts`

Dynamically load a user-supplied `.ts` strategy file:

```typescript
export function loadStrategyFile(filePath: string): StrategyDefinition
```

Uses `require()` (with `ts-node` already registered) to import the file. Reads the first exported value that passes a `typeof fn === 'function'` check. Throws a descriptive error if no valid export is found.

Add `--strategy-file <path>` flag to `run-sim.ts` as an alternative to `--strategy <name>`.

- Unit test: loads a minimal fixture strategy file and returns a callable function
- Unit test: throws on a file with no function export

**FR:** 8 (`--strategy-file`); CUJ 2.0
**Risk:** Low-medium. `ts-node` dynamic require has known quirks; test with a real `.ts` fixture file.

Implementation notes:
- `loadStrategyFile(filePath)` resolves to an absolute path via `path.resolve()`, then `require()`s it. Returns the first exported value where `typeof value === 'function'`. Throws descriptive errors for load failures (syntax/missing import) and for files with no function export.
- `CliArgs.strategy` changed from required `string` to optional `string?`; `CliArgs.strategyFile?: string` added. `parseArgs` requires exactly one of `--strategy` or `--strategy-file` and throws if both or neither is supplied.
- `runSim` branches on `args.strategyFile`: if set, calls `loadStrategyFile`; otherwise calls `lookupStrategy`. Uses the file path as the strategy name in the logger.
- Tests in `spec/cli/strategy-loader-spec.ts` cover: successful load, callable result, no-function-export error, nonexistent-file error.
- Tests in `spec/cli/run-sim-spec.ts` extended: `--strategy-file` parses correctly, mutual exclusivity error, `runSim` with file path runs and produces summary output.
- Fixture files in `spec/cli/fixtures/`: `minimal-strategy.ts` (valid), `no-function-export.ts` (invalid).

---

### M2.6 — Milestone 2 Review

Run the `/simplify` skill across all files introduced or modified in M2:

- `src/dice/dice.ts`, `src/craps-table.ts` (die1/die2 propagation)
- `src/logger/run-logger.ts`
- `src/cli/strategy-registry.ts`, `src/cli/strategy-loader.ts`, `src/cli/run-sim.ts`

Review checklist:
- Does the logger's `tableLoad` calculation match the spec definition (`sum of bet.amount + bet.oddsAmount`)?
- Does `--output json` produce line-by-line parseable JSONL (not a JSON array)?
- Are all CLI error messages clear enough for a non-technical user?
- Does the strategy file loader handle the case where the user's file has a compile error?
- Is test coverage present for the summary statistics fields?

---

### M2.7 — Milestone 2 Demo

**New file:** `demo/<tbd-m2-demo>.ts`

Write a demo exercising the primary M2 CUJs (1.0, 2.0 — running built-in and custom strategies). The demo should be free-standing and self-verifying. Ensure all prior demos (`demo/verify-strategy-on-known-rolls.ts`) still pass.

---

## Milestone 3 — Comparison and Advanced CUJs

**Goal:** Two or more strategies can be compared on identical dice, either via CLI or programmatically. Custom strategy files can be compared against built-ins. All major CUJs are supported.

**Unlocks:** CUJ 1.1 (head-to-head comparison), CUJ 2.1 (progressive strategy with track()), CUJ 2.2 (custom vs built-in comparison), CUJ 2.3 (fixed seed iteration), CUJ 3.0 (library use), CUJ 3.1 (multi-strategy programmatic), CUJ 3.2 (JSON export), CUJ 4.1 (verify identical dice), CUJ 4.2 (reproduce and inspect).

---

### M3.1 — Build `SharedTable`

**New file:** `src/engine/shared-table.ts`

Multi-strategy comparison engine. Each strategy gets its own `ReconcileEngine` and `PlayerState`. Dice are rolled once per turn and broadcast to all strategies.

```typescript
const table = new SharedTable({ seed: 42, rolls: 10000 });
table.addStrategy('ThreePointMolly', ThreePointMolly, { bankroll: 500 });
table.addStrategy('Place6And8',      Place6And8,      { bankroll: 500 });
const results = table.run();
```

Per-roll sequence (per `tech-plan.md`):
1. For each strategy: `ReconcileEngine.reconcile()` → apply `BetCommand[]` to that strategy's virtual bet set
2. Roll dice **once** — a single `(die1, die2)` pair for all strategies
3. For each strategy: resolve bets → collect `Outcome[]`
4. For each strategy: `postRoll(outcomes)` + `PlayerState.update(outcomes)`
5. Emit shared roll record with per-strategy player entries to `RunLogger`

Return type:
```typescript
{
  [strategyName: string]: {
    finalBankroll: number;
    netChange: number;
    log: RollRecord[];
    summary: SummaryRecord;
  }
}
```

Integration tests:
- Two strategies in a `SharedTable` run see **identical** `(die1, die2)` values at each roll index — assert `results['A'].log[i].roll` equals `results['B'].log[i].roll` for all `i` (CUJ 4.1)
- Each strategy's bankroll is independent — placing different bets in A does not affect B

**FR:** 4 — shared-table comparison
**Risk:** High. The shared virtual bet set per strategy is the architectural crux; must ensure no shared mutable state leaks between strategies.

---

### M3.2 — Add `--compare` CLI flag

**File:** `src/cli/run-sim.ts`

Wire `SharedTable` into the CLI for comparing two built-in strategies:

```
npx ts-node src/cli/run-sim.ts --compare ThreePointMolly Place6And8 --rolls 10000 --bankroll 500
```

Output: side-by-side summary table showing per-strategy `finalBankroll`, `netChange`, `maxDrawdown`, `bankroll.peak`.

- `--compare` and `--strategy` are mutually exclusive; error clearly if both are provided
- `--seed` applies to the shared table
- `--output json` emits JSONL with per-strategy player entries in each roll record

**FR:** 4, 8 — comparison, CLI
**Risk:** Low once SharedTable is built.

---

### M3.3 — Add `--compare-files` and mixed comparison CLI flags

**File:** `src/cli/run-sim.ts`

Extend the CLI to allow comparing custom files against each other or against built-ins:

| Flag combination | Behavior |
|-----------------|----------|
| `--compare-files ./a.ts ./b.ts` | Compare two custom strategies |
| `--compare ThreePointMolly --strategy-file ./my.ts` | Built-in vs custom |

Use `StrategyFileLoader` to resolve file paths. Pass resulting `StrategyDefinition` functions to `SharedTable.addStrategy()`.

- Manual acceptance test matching CUJ 2.2: `--compare-files ./my-strategy.ts --compare ThreePointMolly` produces side-by-side output

**FR:** 4, 8 — comparison, CLI
**Risk:** Low. Mostly argument parsing and routing; underlying mechanics already built.

---

### M3.4 — Integration tests for comparison correctness

Comprehensive test coverage for `SharedTable` and comparison CLI:

- **Dice identity test** (CUJ 4.1): `SharedTable` integration test proving roll-by-roll `die1`/`die2` identity across all strategies over a full run
- **Bankroll independence test**: strategies with different betting behavior end at different bankrolls even with identical dice
- **Progressive strategy test** (CUJ 2.1): `SixIn8Progressive` run via `SharedTable` alongside `Place6And8`; confirm track() values accumulate correctly and the progressive strategy diverges from the flat one
- **Seed reproducibility test** (CUJs 1.2, 2.3): same seed produces identical `log[i].roll` values across two separate `CrapsEngine` (or `SharedTable`) instantiations

**FR:** 2, 4, 9
**Risk:** Low. Tests are assertions over existing behavior; no new implementation.

---

### M3.5 — Milestone 3 Review

Run the `/simplify` skill across all files introduced or modified in M3:

- `src/engine/shared-table.ts`
- `src/cli/run-sim.ts` (full, now with all flags)
- All new and modified spec files

Review checklist:
- Is the virtual bet set abstraction in `SharedTable` clean enough that adding a third strategy is a one-line change?
- Does `--output json` in comparison mode produce a valid, parseable JSONL file that a Python notebook could consume directly (CUJ 3.2)?
- Are all integration tests in `spec/engine/` using `RiggedDice` or a fixed seed — no flaky real-RNG tests?
- Is the `results[name]` API shape documented enough that a library user (CUJ 3.0) can use it without reading the source?
- Are there any remaining references to the old `CrapsGame` / `Player` layer in comments, imports, or docs?

---

### M3.6 — Milestone 3 Demo

**New file:** `demo/<tbd-m3-demo>.ts`

Write a demo exercising the primary M3 CUJs (1.1, 3.0, 3.1 — multi-strategy comparison, library usage). The demo should be free-standing and self-verifying. Ensure all prior demos still pass.

---

## CUJ Coverage Summary

| CUJ | Description | Milestone |
|-----|-------------|-----------|
| 4.0 | Verify strategy on known roll sequence | M1 |
| 1.0 | Run a built-in strategy | M2 |
| 1.2 | Reproduce run with seed | M2 |
| 1.3 | Verbose roll-by-roll output | M2 |
| 2.0 | Run a custom strategy file | M2 |
| 1.1 | Head-to-head strategy comparison | M3 |
| 2.1 | Progressive strategy with track() | M3 |
| 2.2 | Custom vs built-in comparison | M3 |
| 2.3 | Fixed-seed strategy iteration | M3 |
| 3.0 | Use simulator as TypeScript library | M3 |
| 3.1 | Multi-strategy programmatic run | M3 |
| 3.2 | Export results as JSON | M3 |
| 4.1 | Verify shared-table dice identity | M3 |
| 4.2 | Reproduce and inspect a production run | M3 |

---

## Task Dependency Graph

```
M1.1 (MT bias fix)
  └─► M1.2 (wire ReconcileEngine to real state)
        └─► M1.3 (postRoll / track write path)
              └─► M1.4 (CrapsEngine)
                    └─► M1.5 (retire old layer)
                          └─► M1.6 (M1 review)
                                └─► M1.7 (M1 demo)

M1.7 (M1 demo)
  └─► M2.1 (die1/die2 return type)
        └─► M2.2 (RunLogger)
              └─► M2.3 (StrategyRegistry)
                    └─► M2.4 (CLI single strategy)
                          └─► M2.5 (StrategyFileLoader)
                                └─► M2.6 (M2 review)
                                      └─► M2.7 (M2 demo)

M2.7 (M2 demo)
  └─► M3.1 (SharedTable)
        └─► M3.2 (--compare CLI flag)
              └─► M3.3 (--compare-files / mixed)
                    └─► M3.4 (integration tests)
                          └─► M3.5 (M3 review)
                                └─► M3.6 (M3 demo)
```

---

## Files to Retire (Milestone 1)

| File | Replaced by |
|------|-------------|
| `src/craps-game.ts` | `src/engine/craps-engine.ts` |
| `src/player.ts` | `src/dsl/player-state.ts` + `ReconcileEngine` |
| `src/strategy.ts` | `src/dsl/strategy.ts` |
| `src/main.ts` | `src/cli/run-sim.ts` |

## New Files by Milestone

| File | Milestone |
|------|-----------|
| `src/engine/craps-engine.ts` | M1 |
| `demo/verify-strategy-on-known-rolls.ts` | M1 |
| `src/logger/run-logger.ts` | M2 |
| `src/cli/strategy-registry.ts` | M2 |
| `src/cli/strategy-loader.ts` | M2 |
| `src/cli/run-sim.ts` | M2 |
| `src/engine/shared-table.ts` | M3 |
