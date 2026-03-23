# Craps Simulator — Implementation Plan

**Date:** March 2026
**Status:** In Progress — M1 and M2 complete; M3.1–M3.4 done, M3.5–M3.6 remaining; M4 implemented (pre-M3)

---

## Overview

Four milestones, each building on the last. Each ends with a structured review pass followed by a demo that exercises the milestone's primary CUJ(s).

| Milestone | Theme | Primary CUJs | Status |
|-----------|-------|--------------|--------|
| M1 | Core engine — DSL wired end-to-end | 4.0 | DONE |
| M2 | Output and CLI — usable from the terminal | 1.0, 1.2, 1.3, 2.0 | DONE |
| M3 | Comparison and custom strategies — full feature set | 1.1, 2.1, 2.2, 2.3, 3.0, 3.1, 3.2, 4.1, 4.2 | In Progress (M3.1–M3.4 done) |
| M4 | Stage Machine — CATS-class strategy support | 5.0, 5.1, 5.2 | DONE |

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

### M2.6 — Milestone 2 Review [DONE]

Run the `/simplify` skill across all files introduced or modified in M2:

- `src/dice/dice.ts`, `src/craps-table.ts` (die1/die2 propagation)
- `src/logger/run-logger.ts`
- `src/cli/strategy-registry.ts`, `src/cli/strategy-loader.ts`, `src/cli/run-sim.ts`

Review checklist:
- Does the logger's `tableLoad` calculation match the spec definition (`sum of bet.amount + bet.oddsAmount`)? ✓ Yes — `tableLoadBefore` uses snapshot `amount + oddsAmount`; `tableLoadAfter` uses `bet.totalAmount` which is `amount + oddsAmount` for PassLineBet/ComeBet and `amount` for PlaceBet (no odds). Both are correct.
- Does `--output json` produce line-by-line parseable JSONL (not a JSON array)? ✓ Yes — each entry is a separate `JSON.stringify()` call.
- Are all CLI error messages clear enough for a non-technical user? ✓ Fixed — updated usage string to show both `--strategy` and `--strategy-file` patterns.
- Does the strategy file loader handle the case where the user's file has a compile error? ✓ Yes — `try/catch` around `require()` surfaces the compile error in a descriptive message.
- Is test coverage present for the summary statistics fields? ✓ Added — four new `tableLoad` tests in `spec/logger/run-logger-spec.ts` covering avg, max, min=0 edge case, and avgWhenActive.

Review findings addressed:
- Updated `run-sim.ts` error handler to show both CLI usage patterns (`--strategy` and `--strategy-file`)
- Added `tableLoad` stats unit tests (`avg`, `max`, `min`, `avgWhenActive`) to `spec/logger/run-logger-spec.ts`

---

### M2.7 — Milestone 2 Demo [DONE]

**New files:**
- `demo/run-and-log-strategies.ts` — M2 demo (CUJs 1.0, 1.2, 1.3, 2.0)
- `demo/conservative-place-strategy.ts` — example custom strategy file for CUJ 2.0

Exercises all primary M2 CUJs in a single runnable, self-verifying file:
- **CUJ 1.0**: Runs `PassLineOnly` via `lookupStrategy` + `CrapsEngine` + `RunLogger`
- **CUJ 1.2**: Runs `ThreePointMolly3X` twice with `seed: 42` and asserts identical final bankroll, win counts, and dice distribution
- **CUJ 1.3**: Demonstrates `getRollEntries()` for programmatic inspection and `flush('verbose')` for human-readable per-roll output
- **CUJ 2.0**: Loads `demo/conservative-place-strategy.ts` via `loadStrategyFile`, runs it, and asserts it places bets and executes correctly; also asserts that loading a nonexistent file throws a descriptive error

Run: `npx ts-node demo/run-and-log-strategies.ts`

All prior demos (`demo/verify-strategy-on-known-rolls.ts`) still pass.

---

## Milestone 3 — Comparison and Advanced CUJs

**Goal:** Two or more strategies can be compared on identical dice, either via CLI or programmatically. Custom strategy files can be compared against built-ins. All major CUJs are supported.

**Unlocks:** CUJ 1.1 (head-to-head comparison), CUJ 2.1 (progressive strategy with track()), CUJ 2.2 (custom vs built-in comparison), CUJ 2.3 (fixed seed iteration), CUJ 3.0 (library use), CUJ 3.1 (multi-strategy programmatic), CUJ 3.2 (JSON export), CUJ 4.1 (verify identical dice), CUJ 4.2 (reproduce and inspect).

---

### M3.1 — Build `SharedTable` [DONE]

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

Implementation notes:
- Each strategy slot carries its own `ReconcileEngine`, `PlayerState`, `CrapsTable`, and `RunLogger`; no mutable state is shared between slots.
- Dice are rolled once per turn from a single `MersenneTwister` instance; the resulting `(die1, die2)` pair is broadcast to every strategy's resolution step.
- `run()` returns `Record<string, { finalBankroll, netChange, log: RollRecord[], summary: SummaryRecord }>`.
- `spec/engine/shared-table-spec.ts` covers: dice identity across strategies, bankroll independence, and the progressive strategy divergence case.

---

### M3.2 — Add `--compare` CLI flag [DONE]

**File:** `src/cli/run-sim.ts`

Wire `SharedTable` into the CLI for comparing two built-in strategies:

```
npx ts-node src/cli/run-sim.ts --compare ThreePointMolly Place6And8 --rolls 10000 --bankroll 500
```

Output: side-by-side summary table showing per-strategy `finalBankroll`, `netChange`, `maxDrawdown`, `bankroll.peak`.

- `--compare` and `--strategy` are mutually exclusive; error clearly if both are provided
- `--seed` applies to the shared table
- `--output json` emits one JSONL line per strategy (full `SummaryRecord` + `strategyName` field)
- `--output verbose` in comparison mode renders the same side-by-side table as `summary` — true per-roll verbose output across multiple strategies requires a unified roll log and is deferred to M3.5 (see below)

**FR:** 4, 8 — comparison, CLI
**Risk:** Low once SharedTable is built.

Implementation notes:
- `parseArgs` extended with greedy multi-value token consumption for `--compare` and `--compare-files` (consumes non-flag tokens until the next `--` flag)
- `runCompare()` exported alongside `runSim()`; entry point dispatches based on whether `compare` or `compareFiles` is present
- `--output json` emits per-strategy `SummaryRecord` lines (not per-roll); per-roll JSONL across strategies requires unified logging (deferred)

---

### M3.3 — Add `--compare-files` and mixed comparison CLI flags [DONE]

**File:** `src/cli/run-sim.ts`

Extend the CLI to allow comparing custom files against each other or against built-ins:

| Flag combination | Behavior |
|-----------------|----------|
| `--compare-files ./a.ts ./b.ts` | Compare two custom strategies |
| `--compare ThreePointMolly --strategy-file ./my.ts` | Built-in vs custom |
| `--compare-files ./a.ts --compare ThreePointMolly` | File + built-in (any order) |

Use `StrategyFileLoader` to resolve file paths. Pass resulting `StrategyDefinition` functions to `SharedTable.addStrategy()`.

- Manual acceptance test matching CUJ 2.2: `--compare-files ./my-strategy.ts --compare ThreePointMolly` produces side-by-side output

**FR:** 4, 8 — comparison, CLI
**Risk:** Low. Mostly argument parsing and routing; underlying mechanics already built.

Implementation notes:
- Validation: total strategies = `len(compare) + len(compareFiles) + (1 if strategyFile else 0)`; must be ≥ 2
- `--strategy-file` is allowed alongside `--compare` / `--compare-files` (contributes one more strategy to the comparison); `--strategy` (named, single) is never allowed in comparison mode

---

### M3.4 — Integration tests for comparison correctness [DONE]

Comprehensive test coverage for `SharedTable` and comparison CLI:

- **Dice identity test** (CUJ 4.1): `SharedTable` integration test proving roll-by-roll `die1`/`die2` identity across all strategies over a full run
- **Bankroll independence test**: strategies with different betting behavior end at different bankrolls even with identical dice
- **Progressive strategy test** (CUJ 2.1): `SixIn8Progressive` run via `SharedTable` alongside `Place6And8`; confirm track() values accumulate correctly and the progressive strategy diverges from the flat one
- **Seed reproducibility test** (CUJs 1.2, 2.3): same seed produces identical `log[i].roll` values across two separate `CrapsEngine` (or `SharedTable`) instantiations

**FR:** 2, 4, 9
**Risk:** Low. Tests are assertions over existing behavior; no new implementation.

Implementation notes:
- All four test categories implemented in `spec/engine/shared-table-spec.ts`.
- Dice identity: asserts `die1`, `die2`, and `rollValue` match at every index across two strategies in a single `SharedTable` run.
- Bankroll independence: `PassLineOnly` and `Place6And8` end at different bankrolls on a scripted roll sequence.
- Progressive divergence: `SixIn8Progressive` vs `Place6And8` — confirmed diverging final bankrolls and confirmed that progressive bets grow larger than the flat strategy's after multiple wins.
- Seed reproducibility: two separate `SharedTable` instances with the same seed produce byte-identical `die1`/`die2` sequences.

---

### M3.5 — Milestone 3 Review

Run the `/simplify` skill across all files introduced or modified in M3:

- `src/engine/shared-table.ts`
- `src/cli/run-sim.ts` (full, now with all flags)
- `spec/engine/shared-table-spec.ts`
- Any other spec files touched during M3.1–M3.4

**How `/simplify` works:** The skill reads every changed file and looks for opportunities to reduce code without changing behavior — removing duplication, replacing custom code with library primitives, flattening unnecessary indirection, and fixing anything that smells like a future bug. It then applies the improvements directly. Think of it as a focused refactoring pass driven by an AI reviewer who has read all the changed files. It does _not_ add features; it only cleans up what exists.

Review checklist (work through these after `/simplify` runs):
- Is the virtual bet set abstraction in `SharedTable` clean enough that adding a third strategy is a one-line `addStrategy()` call?
- Does `--output json` in comparison mode produce a valid, parseable JSONL file that a Python notebook could consume directly (CUJ 3.2)? Verify with `JSON.parse()` on each line.
- Are all integration tests in `spec/engine/` using `RiggedDice` or a fixed seed — no flaky real-RNG tests?
- Is the `results[name]` API shape (return type of `SharedTable.run()`) documented clearly enough that a library user (CUJ 3.0) can use it without reading the implementation?
- Are there any remaining references to the old `CrapsGame` / `Player` layer in comments, imports, or docs?
- **Unified per-roll verbose log for comparison mode**: `--output verbose` in comparison mode currently renders the same table as `summary`. Decide here whether to implement a proper roll-aligned unified log inline in M3.5 or defer to a dedicated task.

**Deferred from M3.2/M3.3:** Unified per-roll JSONL for `--compare --output json` (currently emits one summary line per strategy). Full per-roll JSONL across strategies would require either a multi-player `RunLogger` or a shared roll-log built inside `SharedTable`. If the M3.5 review decides to implement this, the output format should be:
```jsonl
{"type":"roll","roll":{...},"gameState":{...},"players":[{"id":"player-A",...},{"id":"player-B",...}]}
{"type":"summary","strategyName":"A",...}
{"type":"summary","strategyName":"B",...}
```

---

### M3.6 — Milestone 3 Demo

**New file:** `demo/<tbd-m3-demo>.ts`

Write a demo exercising the primary M3 CUJs (1.1, 3.0, 3.1 — multi-strategy comparison, library usage). The demo should be free-standing and self-verifying. Ensure all prior demos still pass.

---

## Milestone 4 — Stage Machine [DONE]

**Goal:** A CATS-class multi-stage strategy is expressible, runnable, and comparable against simple strategies on identical dice. The Stage Machine API is documented and tested well enough that a strategy author can write a novel multi-stage strategy without reading the implementation.

**Unlocks:** CUJ 5.0 (run CATS as a named strategy), CUJ 5.1 (compare CATS variants on identical dice), CUJ 5.2 (write a novel multi-stage strategy).

**Design reference:** `docs/stage-machine-design.md` — full architecture, interfaces, CATS sketch, and implementation notes.

**Note on sequencing:** M4 was implemented before M3 completed. The M4.8 demo works around the missing `SharedTable` (M3) by using two independent `CrapsEngine` runs with the same seed; it will be updated to use `SharedTable` once M3 is complete.

---

### M4.1 — Type definitions and interfaces [DONE]

**New file:** `src/dsl/stage-machine-types.ts`

All public interfaces with full TSDoc: `StageMachineBuilder`, `StageConfig`, `StageContext`, `SessionState`, `TableReadView`, `CrapsEventName`, `CrapsEventPayload<K>`, `CrapsEventHandlers`. Types only — no implementation.

**Spec file:** `spec/dsl/stage-machine-types-spec.ts` — type-level contract tests verifying API shape.

**FR:** Stage Machine API contract. **Risk:** Low.

---

### M4.2 — `StageMachineBuilder` and `stageMachine()` entry point [DONE]

**New file:** `src/dsl/stage-machine.ts`

Fluent builder API. `stageMachine(name)` returns a `StageMachineBuilder`. `build()` compiles to a `StrategyDefinition` by constructing a `StageMachineRuntime` and wrapping it. Validates that the starting stage exists and has a board function.

**Spec file:** `spec/dsl/stage-machine-builder-spec.ts` — builder validation, structural error cases, output type.

**FR:** Stage Machine builder. **Risk:** Medium.

---

### M4.3 — `StageMachineRuntime` [DONE]

**New file:** `src/dsl/stage-machine-state.ts`

The stateful runtime. Tracks current stage name, per-stage `track()` maps, `SessionState`, retreat evaluation, event dispatch, `advanceTo()` implementation, and `TableReadView` construction.

**Spec file:** `spec/dsl/stage-machine-runtime-spec.ts` — written before implementation (TDD). Covers stage identity, step-up and step-down transitions, transition sequencing, `track()` isolation, `SessionState` computation, `TableReadView` derivation, event dispatch, and full roll sequences with `RiggedDice`.

**FR:** Stage Machine runtime behavior. **Risk:** High — most complex piece of M4.

---

### M4.4 — `TableReadView` construction [DONE]

**Location:** Private method on `StageMachineRuntime` in `src/dsl/stage-machine-state.ts`.

Derived from the player's active bets at `board()` call time. Distinguishes traveled Come bets (have a `point` value) from in-transit Come bets (no `point`). `hasSixOrEight` is pre-computed. `coverage` includes Pass Line and Come bet points only — not Place bet numbers.

**Spec:** Covered by `spec/dsl/stage-machine-runtime-spec.ts` `TableReadView` section.

**FR:** Accurate coverage state. **Risk:** Low.

---

### M4.5 — CATS strategy implementation [DONE]

**New file:** `src/dsl/strategies-staged.ts`

CATS implemented via the Stage Machine API. Stages implemented through `threePtMollyLoose` (ExpandedAlpha and MaxAlpha require Buy bet support, deferred per FR10):

- `accumulatorFull` — Place 6/8 at $18; transitions to `accumulatorRegressed` on first 6/8 hit
- `accumulatorRegressed` — Place 6/8 at $12; advances to `littleMolly` at profit ≥ +$70
- `littleMolly` — Pass + 1 Come + 2× odds; advances at +$150; retreats at profit < +$70 or 2× 7-outs
- `threePtMollyTight` — Pass + 2 Come + tiered odds; shifts to Loose at +$200 with 6/8; retreats at +$150 or 2× 7-outs
- `threePtMollyLoose` — Pass + 2 Come + 5× odds; retreats at +$150 or 2× 7-outs

`CATS` is a factory function (not a constant) so each engine run gets a fresh runtime with no shared state.

**Spec file:** `spec/dsl/cats-strategy-spec.ts` — per-stage behavior and full roll sequence integration tests.

**FR:** CATS expressible in Stage Machine. **Risk:** Medium.

---

### M4.6 — Register CATS in StrategyRegistry [DONE]

**File:** `src/cli/strategy-registry.ts`

Added `'CATS': CATS()` to `BUILT_IN_STRATEGIES`. CLI immediately supports `--strategy CATS` and `--compare CATS ThreePointMolly3X`.

**Spec:** `spec/cli/strategy-registry-spec.ts` extended to assert `'CATS'` resolves.

**Risk:** Low.

---

### M4.7 — Milestone 4 Review [DONE]

Run the `/simplify` skill across all new M4 files:
- `src/dsl/stage-machine-types.ts`
- `src/dsl/stage-machine.ts`
- `src/dsl/stage-machine-state.ts`
- `src/dsl/strategies-staged.ts`
- All new spec files

Review checklist:
- Does the CATS strategy read like CATS? (A craps player can follow the stage progression without knowing TypeScript.) ✓
- Is `StageMachineRuntime` testable without `CrapsEngine`? (Yes — `RiggedDice` and a stub table.) ✓
- Are all transition edge cases covered in the spec? (Simultaneous retreat+advance, re-entering a stage, transitioning to current stage.) ✓
- Does `consecutiveSevenOuts` reset correctly? (Resets on win, not no-action roll.) ✓
- Is the existing strategy test suite still green? ✓

Implementation notes (deviations from `stage-machine-design.md` resolved during M4):

1. **Symbol-based runtime detection** (`src/dsl/strategy.ts:19`) — `ReconcileEngine` detects a `Symbol('stageMachineRuntime')` tag on the strategy function rather than an optional `sessionContext` parameter. Keeps the public API surface unchanged for simple strategies.
2. **Lazy initial bankroll capture** (`src/dsl/stage-machine-state.ts:67–74`) — `initialBankroll` is captured on the first `setTableContext()` call since the runtime is created at `build()` time before any engine exists.
3. **`PostRollContext` options object** (`src/dsl/strategy.ts:22–27`, `src/engine/craps-engine.ts:113–118`) — A `PostRollContext` interface (`bankroll`, `pointBefore`, `pointAfter`, `rollValue`) is threaded from `CrapsEngine` through `ReconcileEngine` to the runtime. This required modifying `craps-engine.ts`, contradicting the design doc's "no changes required" claim for that file.
4. **Event handlers receive a no-op BetReconciler** (`src/dsl/stage-machine-state.ts:32–39`) — Since events fire during `postRoll()` (after bets resolved, before next reconcile), there is no live reconciler. Bet changes from events take effect indirectly via stage transitions reflected in the next `board()` call.
5. **`advanceTo()` differs between board() and event handlers** (`src/dsl/stage-machine-state.ts:246–253`, `263–268`) — In `board()`, `advanceTo()` queues a pending transition applied after `board()` completes. In event handlers, it calls `transitionTo()` immediately.
6. **Guard bypass when `canAdvanceTo` is absent** (`src/dsl/stage-machine-state.ts:249–251`) — No guard = no gate. `advanceTo()` is allowed unconditionally when the stage has no `canAdvanceTo`.
7. **`CATS()` is a factory function, not a constant** (`src/dsl/strategies-staged.ts:22`) — Prevents shared mutable state when CATS is used in multiple engine runs.
8. **`accumulatorFull` has an explicit `canAdvanceTo: () => true`** (`src/dsl/strategies-staged.ts:33`) — Redundant per note 6 but documents intent. Could be removed.
9. **Coverage excludes Place bets** (`src/dsl/stage-machine-state.ts:289–303`) — `TableReadView.coverage` includes only Pass Line and Come bet points. `hasSixOrEight` is false during Accumulator stages (Place-only), becoming true only when Come/Pass bets land on 6 or 8 in Molly stages.
10. **`sevenOut` payload uses placeholder `rollNumber: 0`** (`src/dsl/stage-machine-state.ts:171`) — Runtime doesn't track global roll number. No current strategy reads this field.
11. **`consecutiveSevenOuts` resets on seven-out with concurrent win** (`src/dsl/stage-machine-state.ts:139–142`) — A seven-out can co-occur with a come bet win (7 is natural for in-transit come bets); the counter resets in that case.
12. **Cached runtime reference** (`src/dsl/strategy.ts:31`) — `ReconcileEngine` caches the `StageMachineRuntime` reference after the first Symbol lookup to avoid repeated lookups on every `postRoll()` call.
13. **Demo uses separate CrapsEngine runs, not SharedTable** (`demo/cats-vs-molly.ts:43–76`) — SharedTable (M3) not yet built. Two independent `CrapsEngine` runs with the same seed. Dice sequences match because strategy decisions don't consume RNG. Demo documents this distinction.
14. **Builder does not validate guard target stage names** (`src/dsl/stage-machine.ts:48–93`) — Only validates that the starting stage exists and has a board function. Guard target validation would require parsing runtime function return values at build time, which is not possible.
15. **`_machineName` constructor parameter is unused** (`src/dsl/stage-machine-state.ts:54`) — Retained in constructor for potential future diagnostic use.

---

### M4.8 — Milestone 4 Demo [DONE]

**New file:** `demo/cats-vs-molly.ts`

**CUJ exercised:** 5.0 (Run CATS as a named strategy), 5.1 (compare CATS vs ThreePointMolly on identical dice).

Demonstrates CATS running as a built-in strategy and compared against `ThreePointMolly3X`. Uses two independent `CrapsEngine` runs with the same seed (SharedTable workaround — see note 13 above). Asserts CATS completes 10,000 rolls without error and reports per-stage transition counts.

Run: `npx ts-node demo/cats-vs-molly.ts`

All prior demos still pass.

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
| 5.0 | Run CATS as a named strategy | M4 |
| 5.1 | Compare CATS variants on identical dice | M4 |
| 5.2 | Write a novel multi-stage strategy | M4 |

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
                                      └─► M4.1 (type definitions)
                                            └─► M4.2 (StageMachineBuilder)
                                                  └─► M4.3 (StageMachineRuntime — TDD: spec first)
                                                        └─► M4.4 (TableReadView — bundled in M4.3)
                                                              └─► M4.5 (CATS implementation)
                                                                    └─► M4.6 (StrategyRegistry entry)
                                                                          └─► M4.7 (M4 review)
                                                                                └─► M4.8 (M4 demo)
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
| `demo/run-and-log-strategies.ts` | M2 |
| `demo/conservative-place-strategy.ts` | M2 |
| `src/engine/shared-table.ts` | M3 |
| `src/dsl/stage-machine-types.ts` | M4 |
| `src/dsl/stage-machine.ts` | M4 |
| `src/dsl/stage-machine-state.ts` | M4 |
| `src/dsl/strategies-staged.ts` | M4 |
| `spec/dsl/stage-machine-types-spec.ts` | M4 |
| `spec/dsl/stage-machine-builder-spec.ts` | M4 |
| `spec/dsl/stage-machine-runtime-spec.ts` | M4 |
| `spec/dsl/cats-strategy-spec.ts` | M4 |
| `spec/dsl/fixtures/minimal-stage-machine.ts` | M4 |
| `spec/dsl/fixtures/cats-stages.ts` | M4 |
| `demo/cats-vs-molly.ts` | M4 |
