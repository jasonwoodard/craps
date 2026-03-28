# Craps Simulator — Technical Plan

**Date:** March 2026
**Status:** Draft v1 — for review and comment

---

## Purpose

Describe the target architecture, package layout, and key design decisions for the simulator. This document bridges the functional requirements and the actual code. It answers: *what does the implementation look like, and why is it structured this way?*

---

## High-Level Architecture

The simulator is organized into four layers with a strict dependency direction: each layer only knows about the layers below it.

```
┌─────────────────────────────────────────────────────┐
│  CLI Layer                                          │
│  run-sim.ts · StrategyRegistry · StrategyFileLoader │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│  Orchestration Layer                                │
│  CrapsEngine (single run)                           │
│  SharedTable (multi-strategy comparison)            │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│  DSL / Strategy Layer                               │
│  ReconcileEngine · BetReconciler · diffBets         │
│  StrategyDefinition (user-supplied pure functions)  │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│  Game Mechanics Layer                               │
│  CrapsTable · PlaceBet · PassLineBet · ComeBet      │
│  MersenneTwister · RiggedDice                       │
└─────────────────────────────────────────────────────┘
```

**Dependency rule:** Game Mechanics knows nothing about strategies. The DSL layer compiles strategy intent into `BetCommand[]` and hands those down. The Orchestration layer drives the game loop. The CLI layer only wires things together.

---

## Layer Descriptions

### Game Mechanics Layer

Responsible for: dice, table state (point on/off), bet resolution, payout math.

- **`CrapsTable`** — owns the dice, the current point, and the list of active bets. Drives the come-out / point-on / seven-out state machine.
- **`PassLineBet`, `ComeBet`, `PlaceBet`** — each bet knows how to evaluate itself against a roll and compute its own payout. Bets do not call back into the table; they return a result and the table collects it.
- **`MersenneTwister`** — seeded RNG. Produces die values using rejection sampling (no modulo bias — see FR2).
- **`RiggedDice`** — replaces RNG with a fixed roll sequence for deterministic testing.

Nothing in this layer knows what a strategy is.

---

### DSL / Strategy Layer

Responsible for: translating a strategy function's declared intent into table operations.

- **`StrategyDefinition`** — a plain TypeScript function `(ctx: StrategyContext) => void`. This is the only thing a strategy author needs to implement.
- **`BetReconciler`** — collects desired bets declared by the strategy into a `DesiredBet[]` list.
- **`diffBets(current, desired)`** — diffs desired state against the actual table state and produces a minimal `BetCommand[]` (place / remove / updateOdds). Idempotent: declaring an existing bet at the same amount is a no-op.
- **`ReconcileEngine`** — per-strategy engine instance. Holds the `track()` state map. Calls `strategy(ctx)` to get the desired list, then calls `diffBets` against the real current table state to get commands. After each roll, updates `track()` values based on outcomes.
- **`strategies.ts`** — the library of built-in named strategies (ThreePointMolly, Place6And8, PlaceInside, etc.).

The key contract: strategies are **pure readers**. They read `track()` values and declare bets. They do not write state, do not see the RNG, and do not know whether they are in a single run or a comparison.

---

### Orchestration Layer

Responsible for: game loop, per-roll sequencing, multi-strategy dispatch.

#### `CrapsEngine` (single-strategy run)

The unified replacement for the old `CrapsGame` + `Player` approach.

Per-roll sequence:
1. Ask `ReconcileEngine` for `BetCommand[]` → apply to `CrapsTable`
2. Roll dice
3. Resolve all bets → collect outcomes
4. Update `track()` values in `ReconcileEngine` based on outcomes
5. Emit a roll record to the `Logger`
6. Repeat

#### `SharedTable` (multi-strategy comparison — FR4)

Owns a single `CrapsTable` and a list of `(name, ReconcileEngine, PlayerState)` tuples.

Per-roll sequence:
1. For each strategy: call its `ReconcileEngine` → collect `BetCommand[]` → apply to that strategy's **virtual bet set** (not shared)
2. Roll dice **once** — all strategies see the same roll
3. For each strategy: resolve bets against that roll → collect outcomes
4. For each strategy: update `track()` values
5. Emit per-strategy entries in the shared roll record to the `Logger`

The dice are rolled exactly once per turn. No strategy's bet decisions can consume extra RNG calls. This is the guarantee that makes the comparison fair and deterministic (addresses FR4's explicit prohibition on "same seed, independent games").

---

### CLI Layer

Responsible for: parsing arguments, loading strategies, wiring everything together, formatting output.

**Built-in strategy selection** (`--strategy ThreePointMolly`)

A `StrategyRegistry` maps string names to `StrategyDefinition` exports from `strategies.ts`. The registry is a plain object — adding a new built-in is a one-line edit.

```typescript
export const BUILT_IN_STRATEGIES: Record<string, StrategyDefinition> = {
  'ThreePointMolly':   ThreePointMolly,
  'Place6And8':        Place6And8,
  'PlaceInside':       PlaceInside,
  'PlaceAll':          PlaceAll,
  'PassLineOnly':      PassLineOnly,
  'Place6And8Progressive': Place6And8Progressive,
};
```

**Custom strategy file loading** (`--strategy-file ./my-strategy.ts`)

The CLI dynamically imports the file using `ts-node`'s `require()` and reads the first exported `StrategyDefinition` it finds. The user's file only needs to export one function matching the `StrategyDefinition` type — it does not need to import from a registry or register itself anywhere.

This is the path for the semi-technical user who wants to define a novel strategy without touching engine code (see CUJ 2.0).

**Supported CLI flags:**

| Flag | Description |
|------|-------------|
| `--strategy <name>` | Run a built-in named strategy |
| `--strategy-file <path>` | Run a strategy from a `.ts` file |
| `--compare <name> <name>` | Compare two built-in strategies (SharedTable) |
| `--compare-files <path> <path>` | Compare two custom strategy files |
| `--compare <name> --strategy-file <path>` | Compare built-in vs custom |
| `--rolls <n>` | Number of rolls (default: 10,000) |
| `--bankroll <n>` | Starting bankroll per strategy (default: 500) |
| `--seed <n>` | RNG seed (default: random) |
| `--output summary \| verbose \| json` | Output format (default: summary) |

---

## Data Flow: Single Roll

```
CLI / Orchestrator
  │
  ├─1─► ReconcileEngine.reconcile(strategy)
  │       strategy(ctx) → desired bets collected
  │       diffBets(currentTableBets, desired) → BetCommand[]
  │
  ├─2─► CrapsTable.applyCommands(BetCommand[])
  │       PlaceBet / PassLineBet / ComeBet instances added/updated
  │
  ├─3─► CrapsTable.roll()
  │       MersenneTwister → die1 + die2 → sum
  │
  ├─4─► CrapsTable.resolveBets(roll)
  │       each Bet.evaluateDiceRoll(roll, table) → win/lose/push
  │       payouts collected → Outcome[]
  │
  ├─5─► PlayerState.update(Outcome[])
  │       bankroll adjusted
  │
  ├─6─► ReconcileEngine.postRoll(Outcome[])
  │       track() values written based on outcomes
  │
  └─7─► Logger.emit(rollRecord)
          JSONL record written
```

---

## Package Layout (Target State)

```
craps/
├── src/
│   ├── cli/
│   │   ├── run-sim.ts            # Entry point: parse args, wire, run
│   │   ├── strategy-registry.ts  # Built-in name → StrategyDefinition map
│   │   └── strategy-loader.ts    # Dynamic import for --strategy-file
│   │
│   ├── engine/
│   │   ├── craps-engine.ts       # Single-strategy game loop (replaces CrapsGame)
│   │   └── shared-table.ts       # Multi-strategy comparison (FR4)
│   │
│   ├── dsl/
│   │   ├── strategy.ts           # StrategyDefinition, StrategyContext, ReconcileEngine
│   │   ├── bet-reconciler.ts     # SimpleBetReconciler, diffBets, BetCommand
│   │   ├── game-state.ts         # Read-only game state view
│   │   ├── player-state.ts       # Read-only player state view
│   │   └── strategies.ts         # Built-in strategy library
│   │
│   ├── bets/
│   │   ├── base-bet.ts           # BaseBet abstract class
│   │   ├── pass-line-bet.ts      # PassLineBet + odds
│   │   ├── come-bet.ts           # ComeBet + travel + odds
│   │   └── place-bet.ts          # PlaceBet ✓ (done)
│   │
│   ├── dice/
│   │   ├── dice.ts               # Dice interface, RiggedDice
│   │   └── mersenne-twister.ts   # MersenneTwister (rejection sampling needed)
│   │
│   └── logger/
│       └── run-logger.ts         # JSONL logger (per strategy-logging-spec.md)
│
├── spec/                         # Test files mirroring src/
│   ├── bets/
│   ├── dsl/
│   ├── engine/
│   └── dice/
│
└── docs/
    ├── functional-requirements.md
    ├── craps-dsl-spec.md
    ├── strategy-logging-spec.md
    ├── critical-user-journeys.md
    ├── tech-plan.md               # this file
    └── project-assessment.md
```

### Files to retire

The old imperative layer will be deleted once `CrapsEngine` and `SharedTable` are implemented and tests pass:

| File | Replaced by |
|------|-------------|
| `src/craps-game.ts` | `src/engine/craps-engine.ts` |
| `src/player.ts` | `src/dsl/player-state.ts` + `ReconcileEngine` |
| `src/strategy.ts` | `src/dsl/strategy.ts` |
| `src/main.ts` | `src/cli/run-sim.ts` |

`src/craps-table.ts` and `src/bets/` are kept and extended, not replaced.

---

## Key Design Constraints

**Strategies are stateless functions.** No class instances, no callbacks, no event emitters. A strategy is callable N times independently. This makes comparison runs trivial: the same function is passed to N different `ReconcileEngine` instances.

**`diffBets` must see real current state.** The current `ReconcileEngine` passes an empty array as `current` to `diffBets`, which means every call is seen as "all bets are new." The fix is to pass the actual active bets from `CrapsTable` filtered by player. This is the single most important correctness gap to close.

**`track()` write path is engine-owned.** After each roll, `ReconcileEngine.postRoll(outcomes)` increments tracked counters. The strategy DSL spec defines which outcomes increment which keys (e.g., a Place 6 win increments `'wins'`). The strategy function itself never writes.

**SharedTable rolls dice once.** Each strategy's bet decisions are applied to a per-strategy virtual bet set before the roll. The roll happens once. All strategies see the same `(die1, die2)` pair. This is architecturally enforced — the dice are not accessible to strategy code.

**No RNG calls outside dice.** Strategies, loggers, and reconcilers do not call the RNG. This ensures that the number of RNG calls per roll is exactly 2 (one per die), regardless of strategy behavior.

---

## Implementation Sequence

Based on the dependency graph, the correct build order is:

| Step | What | Unblocks |
|------|------|----------|
| 1 | Fix MT rejection sampling | Statistical correctness (FR2) |
| 2 | Wire `ReconcileEngine` to real table state | All DSL strategies runnable |
| 3 | Implement `ReconcileEngine.postRoll()` (track write path) | Progressive strategies (FR6) |
| 4 | Build `CrapsEngine` (new game loop) | End-to-end single-strategy runs |
| 5 | Build `RunLogger` (JSONL output) | Output (FR7) |
| 6 | Build `SharedTable` | Comparison runs (FR4) |
| 7 | Build CLI (`run-sim.ts`, registry, file loader) | All CUJ 1.x and 2.x |

Steps 1–3 are pure fixes to existing code. Steps 4–7 are new files. The old layer (`craps-game.ts`, `player.ts`) stays untouched until step 4 is complete and tests pass, then it's deleted.
