# Craps Simulator — Critical User Journeys

**Date:** March 2026
**Status:** Draft v1 — for review and comment

---

## Purpose

Define the concrete scenarios users will encounter when running the simulator. Each journey is numbered so functional requirements can reference which CUJs they exist to support, and CUJs can reference which FRs enable them.

Numbering convention: `N.M` where `N` is the user archetype and `M` is the specific journey within that archetype.

---

## User Archetypes

| # | Archetype | Description |
|---|-----------|-------------|
| 1 | **Casual CLI User** | Downloaded the simulator from GitHub. Has minimal engineering experience. Wants to run a pre-built strategy or tweak one they copied from the docs. Will not write TypeScript from scratch. |
| 2 | **Strategy Author** | Has some programming experience. Wants to define and test a novel betting strategy. Will write a strategy file using the DSL. Does not want to touch the engine. |
| 3 | **Researcher / Developer** | Using the simulator as a library inside their own TypeScript code. Wants programmatic access, structured output, and comparison runs. |
| 4 | **Debugger / Tester** | Wants to verify simulator correctness, reproduce a specific run, or confirm a strategy behaves as intended on a known roll sequence. |

---

## CUJ 1 — Casual CLI User

### 1.0 Run a built-in strategy

> "I just want to see how ThreePointMolly does over 10,000 rolls starting with $500."

**Steps:**
1. Clone or download the repo from GitHub.
2. Run `npm install`.
3. Run: `npx ts-node run-sim.ts --strategy ThreePointMolly --rolls 10000 --bankroll 500`
4. Read the summary output: final bankroll, net win/loss, max/min bankroll, number of seven-outs.

**Success:** User gets a readable summary without editing any source file.

**Supported by FRs:** 3 (strategy definition), 7 (output/logging), 8 (CLI runner)

---

### 1.1 Run a comparison between two built-in strategies

> "I've heard Place6And8 is safer than ThreePointMolly. I want to see them head-to-head on the same dice."

**Steps:**
1. Run: `npx ts-node run-sim.ts --compare ThreePointMolly Place6And8 --rolls 10000 --bankroll 500`
2. Read side-by-side summary: per-strategy final bankroll, net, max drawdown.

**Success:** User can directly compare results knowing the dice were identical for both.

**Supported by FRs:** 4 (shared-table comparison), 7 (output), 8 (CLI runner)

---

### 1.2 Reproduce a specific run

> "My friend said ThreePointMolly lost everything with seed 99. I want to see that exact run."

**Steps:**
1. Run: `npx ts-node run-sim.ts --strategy ThreePointMolly --rolls 10000 --bankroll 500 --seed 99`
2. Confirm the output matches the run described.

**Success:** Same seed always produces identical results regardless of when or where the simulator is run.

**Supported by FRs:** 2 (seeded RNG), 8 (CLI runner)

---

### 1.3 Get verbose roll-by-roll output

> "I want to see every single roll and what happened to my bets."

**Steps:**
1. Run: `npx ts-node run-sim.ts --strategy Place6And8 --rolls 200 --bankroll 500 --verbose`
2. Read roll-by-roll log: dice, bets resolved, win/loss amounts, bankroll after each roll.

**Success:** Every roll is accounted for in human-readable text.

**Supported by FRs:** 7 (verbose mode), 8 (CLI runner)

---

## CUJ 2 — Strategy Author

### 2.0 Write and run a custom static strategy

> "I want to test my own idea: just place 6 and 9, no pass line. I don't want to touch the engine."

**Steps:**
1. Copy the strategy file template from the docs (or an example from `docs/craps-dsl-spec.md`).
2. Create `my-strategy.ts` in the project root:
   ```typescript
   import { StrategyDefinition } from './src/dsl/strategy';

   export const MySixAndNine: StrategyDefinition = ({ bets }) => {
     bets.place(6, 12);
     bets.place(9, 10);
   };
   ```
3. Run: `npx ts-node run-sim.ts --strategy-file ./my-strategy.ts --rolls 10000 --bankroll 500`
4. Read the output.

**Success:** User never edits the engine. The only file they touch is their own strategy file.
The strategy file is 4–6 lines and reads almost like English. No knowledge of TypeScript internals required beyond the bet-declaration syntax.

**Supported by FRs:** 3 (strategy definition), 5 (bet types), 8 (CLI `--strategy-file` flag)

---

### 2.1 Write a progressive strategy using `track()`

> "I want to press my Place 6 after every win and reset after a loss."

**Steps:**
1. Create a strategy file using `track()` to read win count:
   ```typescript
   import { StrategyDefinition } from './src/dsl/strategy';

   export const PressAndReset: StrategyDefinition = ({ bets, track }) => {
     const wins = track<number>('wins', 0);
     const unit = wins > 0 ? 24 : 12;
     bets.place(6, unit);
   };
   ```
2. Run with `--strategy-file` as in 2.0.

**Success:** Progressive logic is expressible without class inheritance, event callbacks, or engine changes.

**Supported by FRs:** 3 (strategy definition), 6 (track() system), 8 (CLI)

---

### 2.2 Compare a custom strategy against a built-in

> "I wrote my own strategy. How does it do against ThreePointMolly on the same dice?"

**Steps:**
1. Have a custom strategy file (as in 2.0 or 2.1).
2. Run: `npx ts-node run-sim.ts --compare-files ./my-strategy.ts --compare ThreePointMolly --rolls 10000 --bankroll 500`
3. Read side-by-side results.

**Success:** Custom strategy runs against a named built-in on identical dice. User can evaluate their idea against a known baseline.

**Supported by FRs:** 3, 4 (shared-table comparison), 8 (CLI)

---

### 2.3 Iterate on a strategy with a fixed seed

> "I want to keep the dice the same while I tweak my strategy logic."

**Steps:**
1. Pick a seed: `--seed 42`
2. Edit strategy file, re-run with the same seed, compare output between iterations.

**Success:** The dice are frozen; only strategy changes affect the outcome. Isolates the variable being tested.

**Supported by FRs:** 2 (seeded RNG), 3, 8

---

## CUJ 3 — Researcher / Developer

### 3.0 Use the simulator as a TypeScript library

> "I want to run 100 different seeds and collect statistics across all of them."

**Steps:**
1. Import `SharedTable` or `CrapsGame` directly in their own TypeScript file.
2. Loop over seeds, call `table.run()`, collect structured results.
3. Process `results[strategyName].log` for analysis.

**Success:** No CLI needed. Full programmatic access to results as data objects.

**Supported by FRs:** 3, 4, 7 (structured log output)

---

### 3.1 Run a multi-strategy comparison programmatically

> "I want to compare five strategies in one run and get structured data back."

**Steps:**
1. Construct a `SharedTable` with a fixed seed.
2. Call `table.addStrategy(name, fn, config)` for each strategy.
3. Call `table.run()`.
4. Access `results[name].finalBankroll`, `results[name].log`, etc. for each strategy.

**Success:** All strategies see identical dice. Results are structured data, not just printed text.

**Supported by FRs:** 4 (shared-table API), 7

---

### 3.2 Export results as JSON for external analysis

> "I want to pipe the results into a Python notebook."

**Steps:**
1. Run: `npx ts-node run-sim.ts --strategy ThreePointMolly --rolls 10000 --bankroll 500 --output json > results.json`
2. Load `results.json` in the external tool.

**Success:** Output is valid, structured JSON with per-roll records and a summary block.

**Supported by FRs:** 7 (JSON output mode), 8 (CLI `--output` flag)

---

## CUJ 4 — Debugger / Tester

### 4.0 Verify a strategy behaves correctly on a known roll sequence

> "I want to confirm my strategy places bets correctly when the sequence is 7 (come-out win), then 6 established, then 8 rolled, then 7-out."

**Steps:**
1. Use the rigged-dice API in a unit test:
   ```typescript
   const game = new CrapsGame({ strategy: MyStrategy, bankroll: 500, rolls: [7, 6, 8, 7] });
   game.run();
   // Assert on game.log[0], game.log[1], etc.
   ```
2. Assert bet placements, resolutions, and bankroll changes at each step.

**Success:** Strategy behavior is deterministic and verifiable without real RNG. Test does not depend on random output.

**Supported by FRs:** 2 (rigged dice), 3, 9 (testing requirements)

---

### 4.1 Confirm shared-table runs see identical dice

> "I need to be certain both strategies in a comparison saw exactly the same rolls, not just the same seed."

**Steps:**
1. Write an integration test using `SharedTable`.
2. Assert that `results['StrategyA'].log[i].roll` equals `results['StrategyB'].log[i].roll` for all `i`.

**Success:** The test proves roll identity, not just seed identity — guarding against any accidental RNG-state divergence.

**Supported by FRs:** 2, 4, 9

---

### 4.2 Reproduce and inspect a production run that had unexpected results

> "A user ran seed 1234 and claims they hit a seven-out on roll 3. I want to inspect that exact run."

**Steps:**
1. Run: `npx ts-node run-sim.ts --strategy ThreePointMolly --rolls 50 --bankroll 500 --seed 1234 --verbose`
2. Read roll-by-roll log and confirm or deny the claim.

**Success:** The run is perfectly reproducible. The verbose log shows every roll, resolution, and bankroll state.

**Supported by FRs:** 2 (seeded RNG), 7 (verbose logging), 8 (CLI)

---

## FR → CUJ Traceability

| FR | Description | Supports CUJs |
|----|-------------|---------------|
| FR 2 | Seeded/reproducible RNG, rigged dice | 1.2, 2.3, 4.0, 4.1, 4.2 |
| FR 3 | Strategy definition (DSL, StrategyDefinition) | 1.0, 2.0, 2.1, 2.2, 2.3, 3.0, 4.0 |
| FR 4 | Shared-table comparison | 1.1, 2.2, 3.1, 4.1 |
| FR 5 | Bet types | 2.0, 2.1 |
| FR 6 | track() / progressive state | 2.1 |
| FR 7 | Structured output and logging | 1.0, 1.1, 1.3, 3.0, 3.1, 3.2, 4.2 |
| FR 8 | CLI runner | 1.0, 1.1, 1.2, 1.3, 2.0, 2.1, 2.2, 2.3, 3.2, 4.2 |
| FR 9 | Testing | 4.0, 4.1 |
