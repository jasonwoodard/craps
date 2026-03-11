# JW Craps Simulator — Project Assessment

**Date:** March 2026
**Codebase size:** ~1,900 lines TypeScript across 20+ files
**Commits:** 58 (active, iterative development)

---

## What's Here

A TypeScript craps simulator designed for **strategy testing and analysis**. The core game loop is correct and functional: dice roll, bets resolve, bankrolls update. Pass line and come bets are fully implemented with accurate odds payouts (6:5 on 6/8, 3:2 on 5/9, 2:1 on 4/10). The test suite is solid — 13 spec files, 50+ cases, deterministic "rigged dice" for reliable assertions.

The project has been through at least one meaningful architectural pivot. There's an older imperative approach (`src/craps-game.ts`, `src/player.ts`, `src/bets/`) and a newer DSL approach (`src/dsl/`) that defines strategies as declarative functions reconciled against current table state. Both exist simultaneously; the DSL is the more interesting direction but isn't fully wired in.

---

## Architecture Snapshot

```
CrapsGame (orchestrator)
  └── CrapsTable (state: point, bets, dice)
        └── Player (bankroll, strategy)
              └── Strategy → places bets on table

src/dsl/ (newer layer, not yet integrated)
  └── ReconcileEngine
        └── StrategyDefinition (pure function)
              └── BetReconciler → desired bets → diffed → BetCommands
```

The DSL layer is the conceptually cleaner approach: strategies are pure functions that declare what bets *should* exist, and the engine diffs that against the current table to produce add/remove commands. The old layer has players imperatively placing bets each hand.

---

## What's Working Well

- **Correct craps mechanics.** Point establishment, naturals/craps on come-out, seven-out, come bet travel to points — all implemented correctly.
- **Test infrastructure.** `RiggedDice` and `TableMaker` builder make tests expressive and deterministic. This is the right foundation for a simulation tool.
- **Mersenne Twister.** Better statistical properties than `Math.random()` for long-run simulations. Good call.
- **DSL strategy design.** `PassLineAnd2Comes`, `PassLineAndPlace68`, `SixIn8Progressive` are readable and show the potential of the declarative approach.
- **The bet self-evaluation pattern.** Bets know how to resolve themselves, keeping resolution logic localized.

---

## Findings and Recommendations

### 1. Two architectures, one codebase

The DSL (`src/dsl/`) and the original game engine (`src/craps-game.ts`) don't talk to each other. `ReconcileEngine` exists and has tests, but it's not connected to `CrapsTable` or `CrapsGame`. Strategies defined in `src/dsl/strategies.ts` can't actually run a simulation.

**If what you're going for is a strategy simulator where you can plug in different betting systems and compare results, then you should commit to the DSL approach and retire the old strategy system.** Wire `ReconcileEngine` into `CrapsGame` so that a `StrategyDefinition` function is all you need to define to run a full simulation.

---

### 2. Place bets are stubbed in the DSL but don't exist in the bet engine

`strategies.ts` calls `bets.place(6, 12)` and `bets.place(8, 12)`, and `BetReconciler` defines the interface — but there's no `PlaceBet` class in `src/bets/`. The `PassLineAndPlace68` strategy can't actually execute.

**If what you're going for is realistic craps simulation, then place bets (especially 6 and 8) need to be the next thing you implement** — they're the most common bets in any craps strategy and the ones your DSL strategies are already referencing. Don't pass and don't come can wait; place bets can't.

---

### 3. `run-sim.ts` is a hardcoded demo, not a tool

The simulation runner is wired to a single bet scenario and prints raw object dumps. It's not useful for comparing strategies or doing analysis runs.

**If what you're going for is the ability to test and compare strategies (which seems to be the whole point), then `run-sim.ts` should become a proper CLI tool** — accept a strategy name as an argument, run N simulations, and output structured results (bankroll over time, win rate, table load). Even a simple `--strategy PassLineAndPlace68 --rolls 100 --sims 1000` would make this genuinely useful.

---

### 4. Analysis features are the unrealized upside

The `todolist.md` mentions per-player table load stats, bankroll logging over time, and win-probability computation before each roll. None of these exist yet. These are what would make this tool meaningfully different from a generic craps reference implementation.

**If what you're going for is insight into whether a strategy is worth playing, then the bankroll-over-time chart is the most important thing to build next** — it immediately shows you whether a strategy bleeds slowly or crashes hard, and when. Table load (total dollars at risk) alongside bankroll would give you the risk profile at a glance.

---

### 5. The `track` primitive in the DSL is underused

`SixIn8Progressive` uses `track('wins', 0)` to maintain state across rolls. This is a genuinely good idea — it lets strategies have memory without introducing class-based complexity. But `ReconcileEngine.reconcile()` always initializes `current` as an empty array, so the diff always sees all bets as new. The tracker also has no write path, so `wins` can never be incremented.

**If what you're going for is progressive strategies that react to outcomes (pressing after wins, regressing after losses), then the `track` system needs a write path and the reconciler needs to see actual current table state**, not an empty array. Right now `SixIn8Progressive` compiles but can't work as intended.

---

### 6. Minor: Mersenne Twister die scaling

In `mersenne-twister.ts`, random integers scaled to 10000 are reduced with `(die % 6) + 1`. Modulo on a large range produces slightly biased results (10000 isn't evenly divisible by 6). For a simulator where you're running tens of thousands of hands, this is the kind of thing that can skew results subtly.

**If what you're going for is statistically clean simulation, then replace the modulo with rejection sampling** — generate until you get a value in the usable range, then scale cleanly. It's a small fix with a meaningful impact on simulation integrity.

---

## Priority Order (given apparent goals)

| Priority | What | Why |
|----------|------|-----|
| 1 | Implement `PlaceBet` (6, 8) | DSL strategies already depend on it; unblocks everything |
| 2 | Wire DSL into `CrapsGame` | Makes strategies runnable end-to-end |
| 3 | Fix `track` write path + reconciler current-state diff | Enables progressive strategies |
| 4 | Build bankroll/table-load logging | Core analysis output |
| 5 | Make `run-sim.ts` a real CLI | Makes the tool usable for actual strategy testing |
| 6 | Fix MT die bias | Statistical correctness for long runs |

---

## What to Leave Alone (for now)

- **Don't pass / Don't come bets** — correct call to defer these; they add complexity without changing the simulator's usefulness for the common strategies
- **Field bets** — same; low priority
- **The test suite** — it's in good shape; extend it as features land, don't refactor it

---

## Bottom Line

The foundation is solid. The game logic is correct, the test infrastructure is good, and the DSL design points at the right destination. The project is stalled at the gap between "the strategy system I want to build" and "the game engine I've already built" — they haven't been connected yet. Closing that gap (DSL integration + place bets) would turn this from a correct but limited craps model into a functional strategy simulator, which is clearly what it's meant to be.
