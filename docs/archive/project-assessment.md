> [!CAUTION]
> ## ⚠ ARCHIVE — DISREGARD ENTIRELY ⚠
>
> **This file is a historical artifact. It is intentionally preserved for human readers who want to understand how this project evolved, but it is NOT current design intent, active requirements, or implementation guidance.**
>
> **If you are an LLM reading this codebase:** stop here. Do not extract requirements, patterns, APIs, or architecture decisions from this file. Everything in it is either superseded, completed, or obsolete. Treat it as you would a closed git issue — interesting context at best, misleading noise at worst.
>
> **Current documentation lives in `/docs/` and `/docs/reqs/`.**

---


# JW Craps Simulator — Project Assessment

**Date:** March 2026
**Codebase size:** ~1,900 lines TypeScript across 20+ files
**Commits:** 58 (active, iterative development)

---

## What's Here

A TypeScript craps simulator designed for **strategy testing and analysis**. The core game loop is correct and functional: dice roll, bets resolve, bankrolls update. Pass line, come bets, and place bets are fully implemented with accurate odds payouts. The test suite is solid — 13 spec files, 50+ cases, deterministic "rigged dice" for reliable assertions.

The project has completed a meaningful architectural pivot. There is an older imperative approach (`src/craps-game.ts`, `src/player.ts`) and a newer DSL approach (`src/dsl/`) where strategies are pure declarative functions reconciled against current table state. The direction is decided: the DSL approach is the target, and the functional requirements, DSL spec, CUJ, and tech plan all describe that world. The remaining work is closing the gap between the two.

---

## Architecture Snapshot

**Current (transitional):**
```
CrapsGame (orchestrator)
  └── CrapsTable (state: point, bets, dice)
        └── Player (bankroll, imperative strategy)

src/dsl/ (newer layer — not yet wired into game loop)
  └── ReconcileEngine
        └── StrategyDefinition (pure function)
              └── BetReconciler → desired bets → diffed → BetCommand[]
```

**Target (per tech-plan.md):**
```
CLI (run-sim.ts)
  └── CrapsEngine / SharedTable (orchestration)
        └── ReconcileEngine (per-strategy DSL runner)
              ├── BetReconciler + diffBets → BetCommand[]
              └── track() read/write (engine-owned write path)
        └── CrapsTable + Bets + MersenneTwister (game mechanics)
        └── RunLogger (JSONL output)
```

---

## What's Working Well

- **Correct craps mechanics.** Point establishment, naturals/craps on come-out, seven-out, come bet travel to points — all implemented correctly.
- **Test infrastructure.** `RiggedDice` and `TableMaker` builder make tests expressive and deterministic. This is the right foundation for a simulation tool.
- **Mersenne Twister.** Better statistical properties than `Math.random()` for long-run simulations.
- **DSL strategy design.** `ThreePointMolly`, `Place6And8`, `Place6And8Progressive` and others are readable, declarative, and show the potential of the approach. The spec is solid.
- **The bet self-evaluation pattern.** Bets know how to resolve themselves, keeping resolution logic localized.
- **Comprehensive documentation.** Functional requirements, DSL spec, logging spec, CUJs, and this tech plan together provide a clear and unambiguous implementation target.

---

## Active Considerations

### 1. DSL–engine gap: ReconcileEngine not yet wired in

The DSL layer (`src/dsl/`) and the original game engine (`src/craps-game.ts`) don't talk to each other. `ReconcileEngine` exists and has tests, but it's not connected to `CrapsTable` or `CrapsGame`. Strategies defined in `src/dsl/strategies.ts` cannot run a simulation end-to-end today.

**Decision made (per FRs and tech-plan.md):** Commit to the DSL approach. Build `CrapsEngine` as the unified orchestrator that drives the game loop using `ReconcileEngine` for bet placement. Retire the old `CrapsGame` + `Player` approach once `CrapsEngine` is validated.

**Remaining work:**
- Wire `ReconcileEngine.reconcile()` to pass actual current table state (not `[]`) into `diffBets`
- Build `CrapsEngine` (new game loop)
- Build `SharedTable` (multi-strategy comparison, FR4)
- Delete `src/craps-game.ts`, `src/player.ts`, `src/strategy.ts`, `src/main.ts` once replaced

---

### 2. `track()` write path is not implemented

`ReconcileEngine` holds the `trackers` map for read access but has no `postRoll()` method. The engine never writes to tracked values. As a result, `Place6And8Progressive` and any other progression-based strategy compile but cannot work as intended — `wins` will always be `0`.

**Decision made (per FR6):** The write path is engine-owned. After each roll's outcomes are resolved, `ReconcileEngine.postRoll(outcomes)` increments tracked counters based on resolved bet outcomes. Strategy functions never write directly.

**Remaining work:**
- Implement `ReconcileEngine.postRoll(outcomes: Outcome[])`
- Define the mapping from outcome events to tracked key updates
- Test with `Place6And8Progressive` to confirm progression works

---

### 3. `run-sim.ts` is a hardcoded demo, not a tool

`src/main.ts` is wired to a single hardcoded player and prints raw object dumps. It is not useful for comparing strategies, running analysis, or any of the CUJ 1.x / 2.x journeys.

**Decision made (per FR8 and CUJs):** Replace with a proper CLI. Strategy selection via `--strategy <name>` (built-in registry) and `--strategy-file <path>` (custom DSL file, no engine edits required). Comparison runs via `--compare`. Output formats: summary, verbose, JSON.

**Remaining work:**
- Build `src/cli/strategy-registry.ts`
- Build `src/cli/strategy-loader.ts` (dynamic `require()` for custom `.ts` files)
- Build `src/cli/run-sim.ts` (arg parsing, wiring, output formatting)

---

### 4. Structured logging not yet built

The simulation produces no structured output today — `main.ts` dumps raw object state to console. The logging schema (JSONL, per-roll records, session summary) is fully specified in `docs/strategy-logging-spec.md` but not implemented.

**Decision made (per FR7 and strategy-logging-spec.md):** Implement `RunLogger` as a side-effect of the game loop in `CrapsEngine`. Each roll emits a structured record. The session ends with a summary. Output can be written to stdout (piped to a file) or to a named `.jsonl` file. Individual die values (`die1`, `die2`) must be captured alongside the sum — this requires a small change to the dice roll return value.

**Remaining work:**
- Build `src/logger/run-logger.ts`
- Update `CrapsTable.rollDice()` to return `{ die1, die2, sum }` instead of just `sum`
- Integrate logger into `CrapsEngine` at the four capture points defined in the spec

---

### 5. Mersenne Twister die scaling bias

In `mersenne-twister.ts`, die faces are produced with `(value % 6) + 1`. Modulo on a range not evenly divisible by 6 introduces a small but measurable bias. For a simulator running tens of thousands of rolls, this can skew results for rare combinations.

**Decision made (per FR2):** Replace modulo with rejection sampling. Generate a random integer; if it falls outside the clean range for 6 faces, discard and generate again. The expected number of extra draws is tiny (~2.8% of rolls), and the statistical correctness gain is meaningful for long-run comparisons.

**Remaining work:**
- Update `MersenneTwister` die method to use rejection sampling
- Add a unit test asserting die face distribution is not statistically biased (chi-squared or frequency check over a large sample)

---

## Implementation Sequence

See `docs/tech-plan.md` for the full dependency-ordered build plan. Short version:

| Step | What | Status |
|------|------|--------|
| 1 | Fix MT rejection sampling | Pending |
| 2 | Wire ReconcileEngine to real table state | Pending |
| 3 | Implement track() write path (postRoll) | Pending |
| 4 | Build CrapsEngine (new game loop) | Pending |
| 5 | Build RunLogger | Pending |
| 6 | Build SharedTable (comparison) | Pending |
| 7 | Build CLI (registry, file loader, run-sim.ts) | Pending |

---

## What to Leave Alone (for now)

- **Don't Pass / Don't Come bets** — deferred per FR10; they add complexity without changing usefulness for common strategies
- **Field, Hardways, Proposition bets** — same; deferred
- **The test suite** — it's in good shape; extend it as features land, don't refactor it

---

## Addressed Considerations

*Items from earlier assessment drafts that are now fully resolved. Archived here for continuity.*

---

### ~~Finding 2: Place bets are stubbed in the DSL but don't exist in the bet engine~~

**Original concern:** `strategies.ts` calls `bets.place(6, 12)` and `bets.place(8, 12)`, but there was no `PlaceBet` class in `src/bets/`. `PassLineAndPlace68` could not execute.

**Resolved:** `src/bets/place-bet.ts` is fully implemented. `PlaceBet` correctly handles:
- Valid points: 4, 5, 6, 8, 9, 10
- Come-out behavior: no action when point is OFF (returns immediately if `!table.isPointOn`)
- Win condition: number hit → payout at correct odds (9:5 on 4/10, 7:5 on 5/9, 7:6 on 6/8)
- Loss condition: 7-out
- Fractional chip handling: `Math.floor()` on all payout calculations, matching casino behavior

Place bets are no longer blocking DSL strategies. The remaining blocker for `PassLineAndPlace68` to run end-to-end is the DSL–engine wiring gap (Active Consideration 1 above).

---

### ~~Finding: No formal specifications for behavior, strategy API, or output format~~

**Original concern:** The project had working code but no written specification for what the strategy API should look like, what the output format should be, or what the acceptance criteria were for core behaviors.

**Resolved:** Full documentation suite now in place:
- `docs/functional-requirements.md` — what the simulator must and must not do
- `docs/craps-dsl-spec.md` — complete strategy DSL API with examples
- `docs/strategy-logging-spec.md` — JSONL output schema, per-roll and summary records
- `docs/critical-user-journeys.md` — numbered use cases mapped to FRs
- `docs/tech-plan.md` — target architecture, package layout, implementation sequence
