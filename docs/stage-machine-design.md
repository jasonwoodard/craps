# Stage Machine Design
## Craps Simulator — Strategy Escalation API

**Date:** March 2026  
**Status:** Design Specification — pre-implementation  
**Target:** Milestone 4 (post-M3)  
**Author:** Design session / JW

---

## Part 1: Principles, Approach, and High-Level Goals

### 1.1 What Problem This Solves

**Repository context:** This document targets the craps simulator at the root of this repository. The primary source tree is `src/`, tests are in `spec/`, strategy documents are in `strategy/`, and design documentation lives in `docs/`. The existing implementation plan is `docs/implementation-plan.md`. All file paths in this document are relative to the repository root.

The existing `StrategyDefinition` DSL — a plain function called once per roll that declares desired bets via `BetReconciler` — is the right tool for simple strategies. `Place6And8`, `ThreePointMolly`, and `SixIn8Progressive` are all clean, readable, and correct in this model. The engine handles reconciliation; the strategy handles declaration. Good.

CATS breaks this model. Not because CATS is complicated, but because CATS has **named states and explicit transitions between them**. Implementing CATS as a `StrategyDefinition` function produces a 150-line pile of nested if/else that implicitly re-implements a state machine without saying so. It is error-prone to write, opaque to read, and impossible to test at the state level.

The Stage Machine API gives CATS-class strategies a first-class way to say what they actually are: a finite state machine where each stage has a defined board, explicit step-up guards, explicit step-down guards, and a current session context that drives those guards.

### 1.2 Design Philosophy

**The Bet DSL is not touched.** `BetReconciler`, `StrategyDefinition`, and the reconciliation model are proven, tested, and correct. The Stage Machine is a layer above them, not a replacement for any part of them.

**Simple strategies opt out entirely.** A strategy author writing `Place6And8` never imports anything from the Stage Machine layer. The entry points are additive. No existing strategy code changes.

**The Stage Machine is a fluent builder API, not a DSL.** There is no grammar to parse, no custom syntax, no external format. The author writes TypeScript. The API provides named methods that happen to read like the domain. The type system enforces legal sequences. This is a deliberate choice: the audience for CATS-level strategies has coding ability and benefits from full TypeScript tooling.

**Reads like craps.** Every method, event, and property name should be recognizable to a craps player. `sevenOut`, `pointEstablished`, `comeTravel`, `passLine`, `accumulator` are vocabulary before they are identifiers. `onTransition` is software vocabulary. `onSevenOut` is craps vocabulary.

**States, not rules.** Where CATS describes a rule that fires once (De-Leverage: "on first hit, regress"), the right model is a state (`AccumulatorFull` → `AccumulatorRegressed`), not an event callback. The Stage Machine forces clarity about what is actually a state versus what is actually a per-roll decision. This surfaces latent structure in strategy documents that describe things as rules because they were written in prose, not code.

**Stage authoring heuristic:** If the bet configuration is different — different bet types, different numbers covered, different amounts — it is probably a different stage. This rule is more expressive than trying to model configuration deltas inside a single board function. The notable exception is "organic" multi-roll bet establishment: a Come bet with odds is logically one bet but takes two or more rolls to fully establish. That lifecycle is already handled by the reconciler and the engine; from the strategy's perspective `bets.come(10).withOdds(20)` is a single declarative statement. Come bets are not an exception to the stage heuristic — they just look like one at the table.

**Test-first discipline.** Spec files are written before implementation. Specs document intended behavior with enough description that a failing test tells you exactly what is missing. The spec files are the living specification.

### 1.3 High-Level Goals

The Stage Machine must enable the following, in order of priority:

1. Express CATS in full — all five stages, both Accumulator variants, Tight/Loose Molly modes, the Swap Rule, the De-Leverage Rule — without writing a single if/else that re-implements state tracking
2. Compare CATS variants programmatically — e.g., "standard CATS vs. CATS with a $500 starting threshold for Stage 3" — by parameterizing guards rather than forking strategy files
3. Remain invisible to simple strategies — no existing strategy is affected, no imports change, no new required boilerplate
4. Compose with the existing `SharedTable` comparison API — a Stage Machine strategy runs in `SharedTable` without modification, just like any other `StrategyDefinition`
5. Support a minimal, well-bounded event system — sufficient to handle reactive rules (Swap Rule, De-Leverage) without building a general-purpose event bus

### 1.4 Non-Goals (explicitly deferred)

- External DSL or config-file format for strategies (`.cats` files, YAML, etc.)
- UI or visualization of stage state
- Multi-shooter rotation or table rotation events
- Buy bet support (deferred to a later milestone along with Don't Pass / Don't Come)
- Full BATS (darkside) implementation

---

## Part 2: Design Specifics

### 2.1 Architecture — Where This Fits

The Stage Machine inserts a thin new sublayer into the existing DSL / Strategy Layer:

```
┌─────────────────────────────────────────────────────────┐
│  CLI Layer                                              │
│  run-sim.ts · StrategyRegistry · StrategyFileLoader     │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  Orchestration Layer                                    │
│  CrapsEngine (single run)                               │
│  SharedTable (multi-strategy comparison)                │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  DSL / Strategy Layer                                   │
│  StrategyDefinition (plain functions — unchanged)       │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Stage Machine sublayer (NEW)                   │   │
│  │  StageMachineBuilder · StageBuilder             │   │
│  │  StageContext · SessionState · CrapsEvents      │   │
│  │  stageMachine() entry point                     │   │
│  └─────────────────────────────────────────────────┘   │
│  ReconcileEngine · BetReconciler · diffBets             │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  Game Mechanics Layer (unchanged)                       │
│  CrapsTable · PlaceBet · PassLineBet · ComeBet          │
│  MersenneTwister · RiggedDice                           │
└─────────────────────────────────────────────────────────┘
```

The Stage Machine sublayer produces a `StrategyDefinition` as its output. This is the key seam: the engine never knows it is talking to a state machine. From `CrapsEngine` and `SharedTable`'s perspective, every strategy is just a `StrategyDefinition`. The Stage Machine is compile-time infrastructure, not runtime wiring.

### 2.2 State Model

A Stage Machine is a set of named stages. Each stage is a state. The machine is always in exactly one stage. The engine drives stage transitions based on guard evaluation after each roll.

**Stage identity is owned by the engine, not the strategy.** The strategy declares the machine shape. The `ReconcileEngine` (extended) tracks which stage is active and evaluates transition guards.

#### Stages as States — the CATS mapping

The key insight from the design discussion: some things CATS describes as rules are actually underspecified states. Naming them explicitly improves clarity and testability.

| CATS prose description | Stage Machine state |
|---|---|
| "Accumulator — before first hit" | `AccumulatorFull` |
| "Accumulator — after first hit, regressed" | `AccumulatorRegressed` |
| "Little Molly" | `LittleMolly` |
| "3-Point Molly — Tight mode" | `ThreePtMollyTight` |
| "3-Point Molly — Loose mode" | `ThreePtMollyLoose` |
| "Expanded Alpha" | `ExpandedAlpha` |
| "Max Alpha" | `MaxAlpha` |

Tight/Loose Molly are two states, not one state with a flag. The transition between them has a guard (`profit >= 200 && coverage.has6or8`). This is cleaner than a conditional inside a single board function.

### 2.3 Core Interfaces

```typescript
// Entry point — produces a StrategyDefinition
// stageMachine() is the domain vocabulary (not new StageMachineBuilder())
export function stageMachine(name: string): StageMachineBuilder;

// Builder for the whole machine
export interface StageMachineBuilder {
  // Declare the initial stage
  startingAt(stageName: string): StageMachineBuilder;

  // Add a stage
  stage(name: string, config: StageConfig): StageMachineBuilder;

  // Compile to StrategyDefinition — must be called last
  build(): StrategyDefinition;
}

// Config for a single stage
export interface StageConfig {
  // Declares desired bets for this stage. Called once per roll.
  // Same BetReconciler API as StrategyDefinition — no new vocabulary.
  board: (ctx: StageContext) => void;

  // Advance guard: returns true when stepping up to the named stage is
  // permitted. The engine does NOT auto-advance — this only gates the
  // advanceTo() call inside board(). Threshold is permission, not command.
  canAdvanceTo?: (targetStage: string, ctx: SessionState) => boolean;

  // Imperative step-up: called inside board() to trigger the advance.
  // The guard in canAdvanceTo must pass or the call is a no-op.
  // This preserves the "threshold is a permission, not a command" CATS principle.

  // Step-down guard: returns the name of the stage to retreat to when the
  // engine MUST step down, or undefined when no retreat is required.
  // Engine evaluates after every postRoll() and enforces the retreat
  // automatically — the strategy has no veto.
  // Return type is string | undefined (not boolean) so the guard both
  // signals the retreat and names the target in a single call.
  mustRetreatTo?: (ctx: SessionState) => string | undefined;

  // Optional: map of named event handlers. Fires after game events,
  // before the next reconcile pass.
  on?: Partial<CrapsEventHandlers>;
}

// Context passed to board() functions — extends StrategyContext
// with stage-aware session state
export interface StageContext {
  bets: BetReconciler;              // unchanged from StrategyDefinition
  track: <T>(key: string, initial?: T) => T;  // scoped to current stage entry
  session: SessionState;            // read-only session-level state
  table: TableReadView;             // read-only table/coverage state
  advanceTo(stageName: string): void;  // imperative step-up trigger
}

// Session-level state — read-only in strategy code
export interface SessionState {
  readonly profit: number;                  // current bankroll minus buy-in
  readonly stage: string;                   // current stage name
  readonly consecutiveSevenOuts: number;    // resets on any win
  readonly handsPlayed: number;             // total 7-outs + points made
}

// Table/coverage state — read-only in strategy code
export interface TableReadView {
  readonly point: number | null;
  readonly coverage: ReadonlySet<number>;   // numbers currently working
  readonly hasSixOrEight: boolean;          // derived convenience
  readonly comeBetsInTransit: number;       // come bets not yet on a number
}
```

### 2.4 Event System

Six domain events cover all reactive rules identified in CATS. This is not a general event bus — it is a fixed vocabulary of craps table events.

```typescript
export type CrapsEventName =
  | 'comeOut'           // point turns OFF (after sevenOut or pointMade)
  | 'pointEstablished'  // point turns ON
  | 'numberHit'         // any box number rolled (not 7, not craps)
  | 'sevenOut'          // 7 during point-ON
  | 'comeTravel'        // come bet settles on a number
  | 'naturalWin';       // 7 or 11 on come-out

export type CrapsEventHandlers = {
  [K in CrapsEventName]: (payload: CrapsEventPayload<K>, ctx: StageContext) => void;
};

// Payload shapes per event
export type CrapsEventPayload<K extends CrapsEventName> =
  K extends 'numberHit'   ? { number: number; payout: number } :
  K extends 'comeTravel'  ? { number: number } :
  K extends 'sevenOut'    ? { rollNumber: number } :
  K extends 'pointEstablished' ? { point: number } :
  never; // comeOut and naturalWin carry no payload beyond StageContext
```

**Execution model:** Event handlers fire after dice resolve and before the next `board()` call. Handlers call into `bets` (the `BetReconciler`) to declare adjustments. The reconciler accumulates all changes — from `board()` and from event handlers — into a single `BetCommand[]` diff that is applied atomically before the next roll. No ordering conflicts.

**Why not more hooks?** The De-Leverage Rule and Accumulator regression are modeled as state transitions (`AccumulatorFull` → `AccumulatorRegressed`), not `numberHit` handlers. The `numberHit` event is available for cases where a one-time reaction to a win can't be cleanly modeled as a state — but the first question is always "is this actually a state?"

### 2.5 The `track()` Scoping Model

`track()` in the Stage Machine is scoped to the current stage entry. When the machine transitions to a new stage, all tracked values for that stage reset to their declared initial values. This is the correct behavior: CATS win counts and first-hit flags are per-hand within a stage, not session-global.

For session-global state, use `session.profit`, `session.consecutiveSevenOuts`, etc. — these are engine-owned and not writable by strategies.

If an author genuinely needs cross-stage persistence (uncommon), they can track it via a closure in the `stageMachine()` callback scope — a deliberate escape hatch that requires explicit intent.

### 2.6 Transition Semantics

**Step-down is mandatory.** If `mustRetreatTo` returns a stage name, the engine transitions immediately after the current roll, before the next `board()` call. The strategy has no veto. Returning `undefined` means no retreat.

**Step-up is permissive.** `canAdvanceTo` returning true does not trigger a transition. It gates the `advanceTo()` call inside `board()`. This maps directly to CATS: "profit ≥ +$150 is permission to step up, not a command." The board function reads session state, evaluates table conditions, and calls `advanceTo()` when both the guard passes and the author's judgment says go.

**Transition order within a roll:**
1. `mustRetreatTo` guards evaluated (engine)
2. If retreat: transition fires, stage changes, `on.comeOut` or relevant event handlers fire
3. `board()` called with new stage context
4. `canAdvanceTo` gates become active for any `advanceTo()` calls within `board()`
5. If advance: transition fires at end of `board()` execution
6. `BetCommand[]` applied to table

### 2.7 CATS in the Stage Machine — Sketch

This is design validation, not final code. It demonstrates that CATS expresses cleanly.

```typescript
import { stageMachine } from '../src/dsl/stage-machine';

export const CATS = stageMachine('CATS')
  .startingAt('accumulatorFull')

  .stage('accumulatorFull', {
    board: ({ bets }) => {
      bets.place(6, 18);
      bets.place(8, 18);
    },
    on: {
      numberHit: ({ number }, { advanceTo }) => {
        // First hit transitions to AccumulatorRegressed
        if (number === 6 || number === 8) {
          advanceTo('accumulatorRegressed');
        }
      },
    },
    mustRetreatTo: () => undefined,  // no retreat from starting state
  })

  .stage('accumulatorRegressed', {
    board: ({ bets, session, advanceTo }) => {
      bets.place(6, 12);
      bets.place(8, 12);
      if (session.profit >= 70) advanceTo('littleMolly');
    },
    canAdvanceTo: (_, { profit }) => profit >= 70,
  })

  .stage('littleMolly', {
    board: ({ bets }) => {
      bets.passLine(10).withOdds(20);
      bets.come(10).withOdds(20);
    },
    canAdvanceTo: (_, { profit }) => profit >= 150,
    mustRetreatTo: ({ profit, consecutiveSevenOuts }) =>
      profit < 70 || consecutiveSevenOuts >= 2 ? 'accumulatorRegressed' : undefined,
  })

  .stage('threePtMollyTight', {
    board: ({ bets, table, session, advanceTo }) => {
      const odds = tieredOdds(table);
      bets.passLine(10).withOdds(odds.passLine);
      bets.come(10).withOdds(odds.come1);
      bets.come(10).withOdds(odds.come2);
      if (session.profit >= 200 && table.hasSixOrEight) {
        advanceTo('threePtMollyLoose');
      }
    },
    canAdvanceTo: (_, { profit }) => profit >= 150,
    mustRetreatTo: ({ profit, consecutiveSevenOuts }) =>
      profit < 150 || consecutiveSevenOuts >= 2 ? 'littleMolly' : undefined,
  })

  // ... remaining stages follow the same pattern

  .build();

function tieredOdds(table: TableReadView) {
  if (table.hasSixOrEight && [...table.coverage].some(n => n === 5 || n === 9)) {
    return { passLine: 30, come1: 20, come2: 10 };  // sweet spot: 3x/2x/1x
  } else if (table.hasSixOrEight) {
    return { passLine: 20, come1: 10, come2: 10 };  // middle: 2x/1x/1x
  }
  return { passLine: 10, come1: 10, come2: 10 };    // rough: 1x all
}
```

This is approximately 60 lines for a five-stage strategy with variant modes. The logic is localized to each stage. No shared mutable state. No if/else cascade. Testable per-stage.

---

## Part 3: Implementation Details

### 3.1 New Files

```
src/dsl/stage-machine.ts        # StageMachineBuilder, StageBuilder, all interfaces
src/dsl/stage-machine-state.ts  # StageMachineRuntime — the per-strategy stateful instance
                                #   manages current stage, SessionState, track() scope,
                                #   event dispatch, and produces StrategyDefinition
src/dsl/stage-machine-types.ts  # All exported types and interfaces (no implementation)
```

Why the split: `stage-machine.ts` contains the fluent builder that strategy authors interact with. `stage-machine-state.ts` contains the runtime that the engine drives. Separating them keeps the public API surface clean and makes the runtime independently testable without importing builder machinery.

### 3.2 Changes to Existing Files

**`src/dsl/strategy.ts` — `ReconcileEngine`**

`ReconcileEngine` currently manages `track()` state as a flat map. It needs two additions:

1. A `stageContext` injection point — the Stage Machine runtime passes its `SessionState` through `ReconcileEngine` so it appears in `StageContext`. `ReconcileEngine` does not need to understand stage state; it only needs to thread the context through.

2. `postRoll()` must remain the engine's write path for `wins` and `losses` trackers. The Stage Machine runtime listens to outcomes for its own `consecutiveSevenOuts` counter and `profit` calculation — this is additive, not a replacement.

The change is non-breaking: `ReconcileEngine` gains an optional `sessionContext?: SessionState` parameter on `reconcile()`. When absent (all existing strategies), behavior is unchanged.

**`src/engine/craps-engine.ts`**

No changes required. The Stage Machine produces a `StrategyDefinition`. `CrapsEngine` calls it exactly as it calls any other strategy. The machine is opaque to the engine.

**`src/engine/shared-table.ts`** (M3, not yet built)

No changes anticipated. Same reasoning — the Stage Machine produces a `StrategyDefinition`.

**`src/cli/strategy-registry.ts`**

CATS and any other Stage Machine strategies are registered here exactly like any built-in. From the registry's perspective they are `StrategyDefinition` functions. One-line additions.

### 3.3 `StageMachineRuntime` — Internal Design

This is the stateful object that holds the current stage name, session state, and per-stage `track()` map. It is created once per `CrapsEngine` / player slot and lives for the duration of the simulation run.

```typescript
class StageMachineRuntime {
  private currentStage: string;
  private stageTrackers: Map<string, Map<string, any>>;  // stageName → key → value
  private sessionState: MutableSessionState;
  private stageConfigs: Map<string, StageConfig>;

  constructor(startingStage: string, configs: Map<string, StageConfig>, initialBankroll: number)

  // Called by ReconcileEngine instead of strategy(ctx) directly
  reconcile(table: CrapsTable, playerId: string): BetCommand[]

  // Called by ReconcileEngine.postRoll() — updates session state
  postRoll(outcomes: Outcome[]): void

  // Evaluates mandatory retreats — fires before board() if applicable
  private evaluateRetreats(): void

  // Resets per-stage track() map on transition
  private transitionTo(stageName: string): void
}
```

The `StageMachineRuntime` is wrapped in a thin adapter that presents as a `StrategyDefinition` to the outside world. This is the output of `StageMachineBuilder.build()`.

### 3.4 SessionState Calculations

`profit` = `currentBankroll - initialBankroll`. The engine already tracks bankroll; `StageMachineRuntime` reads it via a callback injected at construction.

`consecutiveSevenOuts` is incremented in `postRoll()` on any roll where `outcomes` contains a pass line or come bet loss with a non-null point (distinguishing 7-out from come-out craps). It resets to zero on any roll with at least one win.

`handsPlayed` increments on every 7-out and every point made.

### 3.5 Test Fixtures

The following fixtures should be created in `spec/dsl/fixtures/`:

- `minimal-stage-machine.ts` — two-stage machine (A → B), single guard, used for structural tests
- `cats-stages.ts` — full CATS implementation in Stage Machine form, used for integration tests
- `two-stage-test-strategy.ts` — a deterministic two-stage strategy for RiggedDice-based unit tests

### 3.6 Coverage State Implementation

`TableReadView.coverage` is derived from the player's active bets at the time `board()` is called. The coverage set contains the point numbers of all active Pass Line and Come bets that have traveled to a number. Come bets in transit (not yet on a number) do not contribute to coverage.

`hasSixOrEight` is `coverage.has(6) || coverage.has(8)` — pre-computed as a convenience because CATS references it in multiple places.

---

## Part 4: Implementation Plan

### Where This Fits in the Existing Milestones

M1 and M2 are complete. M3 (SharedTable + comparison CLI) is the current target. The Stage Machine is **Milestone 4**, inserted after M3. The implementation plan becomes:

| Milestone | Theme | Status |
|---|---|---|
| M1 | Core engine — DSL wired end-to-end | DONE |
| M2 | Output and CLI — usable from terminal | DONE |
| M3 | Comparison and advanced CUJs | In progress |
| **M4** | **Stage Machine — CATS-class strategy support** | New |

M3 is not blocked and does not change. M4 adds no FRs to M3.

---

### Milestone 4 — Stage Machine

**Goal:** A CATS-class multi-stage strategy is expressible, runnable, and comparable against simple strategies on identical dice. The Stage Machine API is documented and tested well enough that a strategy author can write a novel multi-stage strategy without reading the implementation.

**Unlocks:** CATS simulation, stage-variant comparisons, parametric threshold testing.

---

#### M4.1 — Type definitions and interfaces

**New file:** `src/dsl/stage-machine-types.ts`

Define all public interfaces with full TSDoc:
- `StageMachineBuilder`
- `StageConfig`
- `StageContext` (extends `StrategyContext`)
- `SessionState`
- `TableReadView`
- `CrapsEventName`, `CrapsEventPayload<K>`, `CrapsEventHandlers`

No implementation. Types only. This file is the API contract.

**Spec file:** `spec/dsl/stage-machine-types-spec.ts`

```typescript
// These are type-level tests — they verify the API shape is correct
// by attempting to construct valid and invalid usages.
// TypeScript compilation failure = test failure.

describe('StageContext type contract', () => {
  it('includes bets, track, session, table, and advanceTo');
  it('bets has the same interface as StrategyContext.bets');
  it('session fields are all readonly');
  it('table fields are all readonly');
  it('advanceTo accepts a string stage name');
});

describe('StageConfig type contract', () => {
  it('board is required');
  it('canAdvanceTo is optional');
  it('mustRetreatTo is optional');
  it('on is optional and accepts a partial CrapsEventHandlers');
});
```

**FR:** New — Stage Machine API contract  
**Risk:** Low. Pure types, no runtime behavior.

---

#### M4.2 — `StageMachineBuilder` and `stageMachine()` entry point

**New file:** `src/dsl/stage-machine.ts`

Implement the fluent builder. `build()` produces a `StrategyDefinition` by constructing a `StageMachineRuntime` (from M4.3) and wrapping it.

```typescript
export function stageMachine(name: string): StageMachineBuilder
```

Builder pattern: each call returns `this` (or a narrowed interface). `build()` is the terminus — returns `StrategyDefinition`, not the builder.

**Spec file:** `spec/dsl/stage-machine-builder-spec.ts`

```typescript
describe('stageMachine() builder', () => {
  it('throws if build() is called before startingAt()');
  it('throws if startingAt() references a stage that was not added');
  it('throws if a canAdvanceTo target references an undeclared stage');
  it('throws if a mustRetreatTo target references an undeclared stage');
  it('returns a callable StrategyDefinition from build()');
  it('allows adding multiple stages before build()');
  it('allows the same stage to have both canAdvanceTo and mustRetreatTo');

  describe('structural validation', () => {
    it('rejects a machine with zero stages');
    it('rejects a machine where startingAt stage has no board function');
  });
});
```

**FR:** Stage Machine builder  
**Risk:** Medium. Builder validation logic is where most bugs will surface.

---

#### M4.3 — `StageMachineRuntime`

**New file:** `src/dsl/stage-machine-state.ts`

The stateful runtime. This is the most complex piece.

Key behaviors to implement:
- Stage tracking: which stage is active
- Per-stage `track()` isolation: map is keyed by stage name, reset on transition
- `SessionState` computation: profit, consecutiveSevenOuts, handsPlayed
- Retreat evaluation: `mustRetreatTo` checked after every `postRoll()`, before next `reconcile()`
- Event dispatch: outcomes from `postRoll()` mapped to event types, handlers fired
- `advanceTo()` implementation: checks `canAdvanceTo` guard, queues transition (fires at end of `board()`)
- `TableReadView` construction: derives `coverage` and `hasSixOrEight` from current table bets

**Spec file:** `spec/dsl/stage-machine-runtime-spec.ts`

This is the most important spec file in M4. Written before implementation (TDD).

```typescript
describe('StageMachineRuntime', () => {

  // --- Stage identity ---

  describe('stage identity', () => {
    it('starts in the declared starting stage');
    it('session.stage reflects current stage name');
    it('stage name is accessible from within board()');
  });

  // --- Transitions ---

  describe('step-up transitions', () => {
    it('does not advance when canAdvanceTo guard returns false');
    it('does not advance when advanceTo() is not called from board()');
    it('advances when canAdvanceTo passes AND advanceTo() is called');
    it('board() of new stage is used on the NEXT roll after transition');
    it('multiple advanceTo() calls in one board() only fire once');
    it('advanceTo() to the current stage is a no-op');
  });

  describe('step-down transitions', () => {
    it('retreats when mustRetreatTo returns a stage name string');
    it('retreat fires before the next board() call');
    it('retreat fires even if bankroll is high (non-profit-based trigger)');
    it('retreat to a stage below current is allowed');
    it('mustRetreatTo returning undefined does not trigger retreat');
  });

  describe('transition sequencing', () => {
    it('retreat takes priority over advance if both conditions are true on same roll');
    it('retreating resets track() for the target stage');
    it('advancing resets track() for the target stage');
  });

  // --- track() scoping ---

  describe('track() isolation', () => {
    it('track() in stage A returns initial value when entering stage A for first time');
    it('track() accumulates within a stage across rolls');
    it('track() resets to initial value when re-entering a stage after transition');
    it('track() in stage A is independent from track() with same key in stage B');
  });

  // --- SessionState ---

  describe('SessionState', () => {
    it('profit is 0 at start of session');
    it('profit increases after a winning roll');
    it('profit decreases after a losing roll');
    it('consecutiveSevenOuts starts at 0');
    it('consecutiveSevenOuts increments on a 7-out');
    it('consecutiveSevenOuts resets to 0 on any win');
    it('consecutiveSevenOuts does NOT reset on a no-action roll');
    it('handsPlayed increments on sevenOut');
    it('handsPlayed increments on point made');
    it('handsPlayed does not increment on come-out win');
  });

  // --- TableReadView ---

  describe('TableReadView', () => {
    it('coverage is empty when no come or pass bets are on numbers');
    it('coverage includes pass line point when point is ON');
    it('coverage includes come bet points once they have traveled');
    it('coverage does NOT include come bets in transit');
    it('hasSixOrEight is false when coverage has no 6 or 8');
    it('hasSixOrEight is true when 6 is in coverage');
    it('hasSixOrEight is true when 8 is in coverage');
    it('comeBetsInTransit counts come bets not yet on a number');
  });

  // --- Event dispatch ---

  describe('event dispatch', () => {
    it('numberHit fires when a box number is rolled during point-ON');
    it('numberHit does NOT fire during come-out');
    it('sevenOut fires when 7 is rolled during point-ON');
    it('comeTravel fires when a come bet settles on a number');
    it('pointEstablished fires when come-out establishes a point');
    it('comeOut fires when point turns OFF (after sevenOut or pointMade)');
    it('naturalWin fires on 7 or 11 during come-out');
    it('event handlers receive correct payload');
    it('event handler can call bets.remove() and it takes effect');
    it('event handler advanceTo() is respected');
  });

  // --- Integration with RiggedDice ---

  describe('full roll sequences (RiggedDice)', () => {
    it('two-stage machine stays in stage 1 until profit threshold is met');
    it('two-stage machine advances on the roll where threshold is first crossed');
    it('machine retreats to stage 1 on consecutive 7-outs');
    it('CATS Accumulator → AccumulatorRegressed on first 6 or 8 hit');
    it('CATS AccumulatorRegressed → LittleMolly when profit crosses +$70');
  });
});
```

**FR:** Stage Machine runtime behavior  
**Risk:** High. Most of the Stage Machine complexity lives here. The spec should be completed before a line of implementation is written.

---

#### M4.4 — `TableReadView` construction

**Location:** `src/dsl/stage-machine-state.ts` (private method on `StageMachineRuntime`)

`TableReadView` is derived from the player's active bets at the time `board()` is called. This requires reading `CrapsTable.getPlayerBets(playerId)` and filtering for traveled Come bets and Pass Line bets on a point.

The implementation is straightforward but has a correctness dependency: it must distinguish between a Come bet that has traveled (has a `point` value) and one still in transit (no `point` value). Existing `ComeBet` already has a `point` field — this works.

**Spec:** Covered by `stage-machine-runtime-spec.ts` `TableReadView` section above.

**Risk:** Low. Derived from existing data structures.

---

#### M4.5 — CATS strategy implementation

**New file:** `src/dsl/strategies-staged.ts`

Implement CATS using the Stage Machine API. This file is the proof-of-concept and the primary integration test target.

Stages to implement:
- `accumulatorFull` — Place 6/8 at $18 each; transitions to `accumulatorRegressed` on first hit
- `accumulatorRegressed` — Place 6/8 at $12 each; advances to `littleMolly` at profit ≥ +$70
- `littleMolly` — Pass + 1 Come + 2× odds; advances at +$150; retreats at +$70 / 2× 7-outs
- `threePtMollyTight` — Pass + 2 Come + tiered odds; shifts to Loose at +$200 with 6/8; retreats at +$150 / 2× 7-outs
- `threePtMollyLoose` — Pass + 2 Come + 5× odds; advances to ExpandedAlpha at +$250

Note: ExpandedAlpha and MaxAlpha require Buy 4/10 and Buy 5/9, which are not yet implemented in the engine (deferred per existing FR10). The Stage Machine is implemented up to `threePtMollyLoose` in M4. The Buy bet stages are wired in a subsequent milestone when Buy bet support is added.

**Spec file:** `spec/dsl/cats-strategy-spec.ts`

```typescript
describe('CATS strategy (Stage Machine implementation)', () => {

  describe('Accumulator stages', () => {
    it('starts with Place 6/8 at $18 each');
    it('transitions to AccumulatorRegressed when 6 is hit');
    it('transitions to AccumulatorRegressed when 8 is hit');
    it('does NOT transition on a non-6/8 number hit');
    it('does NOT transition on 7-out in AccumulatorFull');
    it('places Place 6/8 at $12 each in AccumulatorRegressed');
    it('advances to LittleMolly when profit reaches +$70 in AccumulatorRegressed');
  });

  describe('Little Molly', () => {
    it('maintains pass line + 1 come bet');
    it('applies 2× odds to both');
    it('retreats to AccumulatorRegressed on profit drop below +$70');
    it('retreats to AccumulatorRegressed on 2 consecutive 7-outs');
    it('consecutiveSevenOut counter resets when a win occurs');
    it('advances to ThreePtMollyTight when profit reaches +$150');
  });

  describe('3-Point Molly — Tight', () => {
    it('maintains pass line + 2 come bets');
    it('applies tiered odds: 3× on 6/8, 2× on 5/9, 1× on 4/10');
    it('applies 1× everywhere when no 6 or 8 is covered (rough)');
    it('shifts to ThreePtMollyLoose at profit +$200 with 6 or 8 covered');
    it('does NOT shift to Loose at +$200 without 6 or 8 covered');
    it('retreats to LittleMolly on profit drop below +$150');
    it('retreats to LittleMolly on 2 consecutive 7-outs');
  });

  describe('3-Point Molly — Loose', () => {
    it('maintains pass line + 2 come bets with 5× odds on all');
    it('retreats to ThreePtMollyTight on profit drop below +$150');
    it('retreats to ThreePtMollyTight on 2 consecutive 7-outs');
  });

  describe('full roll sequence integration', () => {
    it('runs the Accumulator grind to LittleMolly on a known dice sequence');
    it('correctly computes profit after multiple stage transitions');
    it('CATS strategy runs without throwing over 10,000 rolls with a fixed seed');
    it('CATS strategy is comparable against ThreePointMolly5X in SharedTable');
  });
});
```

**FR:** CATS expressible in Stage Machine  
**Risk:** Medium. Dependent on M4.3 correctness. The integration tests will surface any edge cases in the runtime.

---

#### M4.6 — Register CATS in StrategyRegistry

**File:** `src/cli/strategy-registry.ts`

Add CATS to `BUILT_IN_STRATEGIES`:

```typescript
import { CATS } from '../dsl/strategies-staged';

export const BUILT_IN_STRATEGIES: Record<string, StrategyDefinition> = {
  // ... existing entries ...
  'CATS':  CATS,
};
```

One line. The CLI immediately supports `--strategy CATS` and `--compare CATS ThreePointMolly3X`.

**Spec:** Extend `spec/cli/strategy-registry-spec.ts` to assert `'CATS'` resolves.

**Risk:** Low.

---

#### M4.7 — Milestone 4 Review

Run the `/simplify` skill across all new files:
- `src/dsl/stage-machine-types.ts`
- `src/dsl/stage-machine.ts`
- `src/dsl/stage-machine-state.ts`
- `src/dsl/strategies-staged.ts`
- All new spec files

Review checklist:
- Does the CATS strategy read like CATS? A craps player should be able to follow the stage progression without knowing TypeScript.
- Is `StageMachineRuntime` testable without `CrapsEngine`? It should be, using `RiggedDice` and a stub table.
- Are all transition edge cases covered in the spec? Specifically: simultaneous retreat + advance condition, re-entering a stage, transitioning to the current stage.
- Does `consecutiveSevenOuts` reset correctly? (Resets on win, not on no-action roll — this is subtle and tested.)
- Is the existing strategy test suite still green? No regression from M4 additions.

---

#### M4.8 — Milestone 4 Demo

**New file:** `demo/cats-vs-molly.ts`

CUJ: "I want to see how CATS performs against ThreePointMolly3X on the same dice."

```typescript
// Demonstrates:
// - Running CATS as a built-in named strategy
// - Comparing CATS vs ThreePointMolly3X in SharedTable (M3)
// - Reading per-strategy summary statistics
// - Printing stage transition counts from CATS's session log

npx ts-node demo/cats-vs-molly.ts
```

The demo is self-verifying: it asserts that CATS completes 10,000 rolls without error and that SharedTable reports identical dice for both strategies.

---

### Updated CUJ Coverage Summary

| CUJ | Description | Milestone |
|---|---|---|
| 4.0 | Verify strategy on known roll sequence | M1 ✅ |
| 1.0 | Run a built-in strategy | M2 ✅ |
| 1.2 | Reproduce run with seed | M2 ✅ |
| 1.3 | Verbose roll-by-roll output | M2 ✅ |
| 2.0 | Run a custom strategy file | M2 ✅ |
| 1.1 | Head-to-head strategy comparison | M3 |
| 2.1 | Progressive strategy with track() | M3 |
| 2.2 | Custom vs built-in comparison | M3 |
| 2.3 | Fixed-seed strategy iteration | M3 |
| 3.0 | Use simulator as TypeScript library | M3 |
| 3.1 | Multi-strategy programmatic run | M3 |
| 3.2 | Export results as JSON | M3 |
| 4.1 | Verify shared-table dice identity | M3 |
| 4.2 | Reproduce and inspect a production run | M3 |
| **5.0** | **Run CATS as a named strategy** | **M4** |
| **5.1** | **Compare CATS variants on identical dice** | **M4** |
| **5.2** | **Write a novel multi-stage strategy** | **M4** |

---

### Updated Task Dependency Graph

```
[M1 DONE] → [M2 DONE] → M3 (in progress)
                              │
                              ▼
                         M3.1 SharedTable
                              │
                         M3.2 --compare CLI
                              │
                         M3.3 --compare-files
                              │
                         M3.4 integration tests
                              │
                         M3.5 M3 review
                              │
                         M3.6 M3 demo
                              │
                              ▼
                         M4.1 type definitions
                              │
                         M4.2 StageMachineBuilder
                              │
                         M4.3 StageMachineRuntime ◄── TDD: spec written first
                              │
                         M4.4 TableReadView (bundled in M4.3)
                              │
                         M4.5 CATS implementation
                              │
                         M4.6 StrategyRegistry entry
                              │
                         M4.7 M4 review
                              │
                         M4.8 M4 demo
```

---

### New Files Summary

| File | Milestone | Purpose |
|---|---|---|
| `src/dsl/stage-machine-types.ts` | M4.1 | Public API interfaces — types only |
| `src/dsl/stage-machine.ts` | M4.2 | `stageMachine()` entry point and builder |
| `src/dsl/stage-machine-state.ts` | M4.3 | `StageMachineRuntime` — stateful driver |
| `src/dsl/strategies-staged.ts` | M4.5 | CATS and future Stage Machine strategies |
| `spec/dsl/stage-machine-types-spec.ts` | M4.1 | Type contract tests |
| `spec/dsl/stage-machine-builder-spec.ts` | M4.2 | Builder validation tests |
| `spec/dsl/stage-machine-runtime-spec.ts` | M4.3 | Runtime behavior tests (primary spec) |
| `spec/dsl/cats-strategy-spec.ts` | M4.5 | CATS integration tests |
| `spec/dsl/fixtures/minimal-stage-machine.ts` | M4.3 | Two-stage test fixture |
| `spec/dsl/fixtures/cats-stages.ts` | M4.5 | Full CATS fixture |
| `demo/cats-vs-molly.ts` | M4.8 | M4 demo |

---

### A Note on Spec-First Development

The spec files above are written as descriptions rather than implementations — they document intended behavior before the runtime exists. The recommended sequence for M4.3 is:

1. Copy the `stage-machine-runtime-spec.ts` skeleton into the repo
2. Fill in the test bodies using `RiggedDice` and fixture strategies
3. Run the test suite — everything fails (expected)
4. Implement `StageMachineRuntime` until the suite is green
5. Refactor

This is the correct TDD cycle for this codebase. The existing test infrastructure (`RiggedDice`, `TableMaker`, Jasmine) is already well-suited to it. The Stage Machine runtime is deterministic and has no I/O — unit tests are fast, hermetic, and complete coverage is achievable.

The `cats-strategy-spec.ts` integration tests are a secondary loop: they test CATS behavior at the strategy level using known dice sequences. These should pass immediately after M4.5 if M4.3 is implemented correctly — they are regression guards, not TDD drivers.

---

## Part 5: Implementation Notes — Decisions Not Explicitly Specified

The following decisions were made during M4 implementation where the design doc was silent or where runtime constraints required deviation.

### 5.1 Symbol-Based Runtime Detection

**Location:** `src/dsl/strategy.ts:19`

The design doc proposed threading an optional `sessionContext?: SessionState` parameter through `ReconcileEngine.reconcile()`. The implementation instead uses a `Symbol('stageMachineRuntime')` tag attached to the strategy function at `build()` time. `ReconcileEngine` detects this tag and injects table context without changing the `StrategyDefinition` signature. This keeps the public API surface unchanged for simple strategies — they never see the Symbol.

### 5.2 Lazy Initial Bankroll Capture

**Location:** `src/dsl/stage-machine-state.ts:67–74`

The design doc specifies that the `StageMachineRuntime` constructor receives `initialBankroll`. However, the runtime is created at `build()` time, before any engine exists. The implementation captures `initialBankroll` lazily on the first `setTableContext()` call during reconcile, when the engine's bankroll is first available.

### 5.3 `PostRollContext` Options Object

**Location:** `src/dsl/strategy.ts:22–27`, `src/engine/craps-engine.ts:113–118`

The design doc says `postRoll()` updates session state from outcomes but doesn't specify what additional data the runtime needs. The implementation introduces a `PostRollContext` interface (`bankroll`, `pointBefore`, `pointAfter`, `rollValue`) threaded from `CrapsEngine` through `ReconcileEngine` to the runtime. This required modifying `craps-engine.ts` — contradicting the design doc's "No changes required" statement for that file.

### 5.4 Event Handlers Receive a No-Op BetReconciler

**Location:** `src/dsl/stage-machine-state.ts:32–39`

The design doc says event handlers "call into `bets` (the `BetReconciler`) to declare adjustments." Since events fire during `postRoll()` (after bets have resolved, before the next reconcile), there is no live reconciler to collect declarations. Event handlers receive a no-op `BetReconciler`. Bet changes from events take effect indirectly: the handler calls `advanceTo()` to change stage, and the next `board()` call declares the new stage's bets.

### 5.5 `advanceTo()` Behavior Differs Between board() and Event Handlers

**Location:** `src/dsl/stage-machine-state.ts:246–253` (board), `src/dsl/stage-machine-state.ts:263–268` (events)

In `board()`, `advanceTo()` queues a pending transition applied after `board()` completes. In event handlers, `advanceTo()` calls `transitionTo()` immediately. The design doc doesn't distinguish these two code paths. The rationale: `board()` is declaring bets for the current stage and should complete before the transition fires; event handlers fire between rolls and have no pending bet declarations.

### 5.6 Guard Bypass When `canAdvanceTo` Is Absent

**Location:** `src/dsl/stage-machine-state.ts:249–251`

When a stage has no `canAdvanceTo` guard, `advanceTo()` is allowed unconditionally. The design doc says `canAdvanceTo` "gates" `advanceTo()` but doesn't specify behavior when the guard is omitted. The chosen semantics: no guard = no gate.

### 5.7 `CATS()` Is a Factory Function, Not a Constant

**Location:** `src/dsl/strategies-staged.ts:22`

The design doc sketch shows `export const CATS = stageMachine(...)`. The implementation uses `export function CATS()` so each call returns a fresh `StrategyDefinition` with its own runtime. This prevents shared mutable state if CATS is used in multiple engine runs. The registry calls `CATS()` at registration time.

### 5.8 `accumulatorFull` Has an Explicit `canAdvanceTo: () => true`

**Location:** `src/dsl/strategies-staged.ts:33`

The design doc sketch omits `canAdvanceTo` on the accumulator stage, relying on the `numberHit` event handler's `advanceTo()` call. But per §5.6, `advanceTo()` is ungated when `canAdvanceTo` is absent — so the explicit `() => true` is redundant but documents intent. It was added for clarity during implementation and could be removed.

### 5.9 Coverage Excludes Place Bets

**Location:** `src/dsl/stage-machine-state.ts:289–303`

`TableReadView.coverage` includes only Pass Line and Come bet points, not Place bet numbers. The design doc says coverage is "numbers currently working" which could include Place bets, but §3.6 specifies "point numbers of all active Pass Line and Come bets that have traveled to a number." This means `hasSixOrEight` is false during the Accumulator stages (which only use Place bets), and only becomes true when Come/Pass bets land on 6 or 8 in the Molly stages.

### 5.10 `sevenOut` Event Payload Uses Placeholder `rollNumber: 0`

**Location:** `src/dsl/stage-machine-state.ts:171`

The `CrapsEventPayload<'sevenOut'>` type requires `{ rollNumber: number }`. The runtime doesn't track the global roll number (that's `CrapsEngine`'s responsibility). The implementation hardcodes `rollNumber: 0`. No current strategy code reads this field.

### 5.11 `consecutiveSevenOuts` Resets on Seven-Out With Concurrent Win

**Location:** `src/dsl/stage-machine-state.ts:139–142`

A seven-out can co-occur with a come bet win (7 is a natural for in-transit come bets). The implementation resets the counter when a seven-out has any concurrent win. The design doc says "resets on any win" but doesn't address this overlap.

### 5.12 Cached Runtime Reference

**Location:** `src/dsl/strategy.ts:31`

`ReconcileEngine` caches the `StageMachineRuntime` reference after the first Symbol lookup to avoid repeated lookups on every `postRoll()` call. This is a performance optimization not mentioned in the design doc.

### 5.13 Demo Uses Separate CrapsEngine Runs, Not SharedTable

**Location:** `demo/cats-vs-molly.ts:43–76`

The design doc says M4.8 should use `SharedTable` for comparison. SharedTable is M3 (not yet built). The demo uses two independent `CrapsEngine` runs with the same seed. Dice sequences match because both engines consume RNG calls at the same rate and strategy decisions don't consume RNG. The demo documents this distinction.

### 5.14 Builder Does Not Validate Guard Target Stage Names

**Location:** `src/dsl/stage-machine.ts:48–93`

The design doc spec suggests validation that `canAdvanceTo` and `mustRetreatTo` targets reference declared stages. The builder only validates that the starting stage exists and has a board function. Target stage validation in guards would require parsing function return values at build time, which isn't possible — guards are runtime functions that return stage names dynamically.

### 5.15 `_machineName` Constructor Parameter Is Unused

**Location:** `src/dsl/stage-machine-state.ts:54`

The constructor accepts but ignores the machine name (prefixed with `_`). The design doc implies it's used for error messages. After M4.7 review cleanup, no runtime code references it. It's retained in the constructor signature for potential future use in diagnostics.
