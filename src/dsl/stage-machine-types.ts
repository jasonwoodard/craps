/**
 * Stage Machine API — Type definitions and public interfaces.
 *
 * This file is the API contract for the Stage Machine sublayer.
 * It contains no implementation — types only.
 */

import { BetReconciler } from './bet-reconciler';
import { StrategyDefinition } from './strategy';

// ---------------------------------------------------------------------------
// Event system
// ---------------------------------------------------------------------------

/** Fixed vocabulary of craps table events. */
export type CrapsEventName =
  | 'comeOut'
  | 'pointEstablished'
  | 'numberHit'
  | 'sevenOut'
  | 'comeTravel'
  | 'naturalWin';

/** Payload shapes per event. */
export type CrapsEventPayload<K extends CrapsEventName> =
  K extends 'numberHit'          ? { number: number; payout: number } :
  K extends 'comeTravel'         ? { number: number } :
  K extends 'sevenOut'           ? { rollNumber: number } :
  K extends 'pointEstablished'   ? { point: number } :
  void;

/** Handler signature for each event type. */
export type CrapsEventHandlers = {
  [K in CrapsEventName]: (payload: CrapsEventPayload<K>, ctx: StageContext) => void;
};

// ---------------------------------------------------------------------------
// Session and table read-only state
// ---------------------------------------------------------------------------

/** Session-level state — read-only in strategy code. */
export interface SessionState {
  /** Current bankroll minus buy-in. */
  readonly profit: number;
  /** Current stage name. */
  readonly stage: string;
  /** Consecutive seven-outs without an intervening win. Resets on any win. */
  readonly consecutiveSevenOuts: number;
  /** Total hands played (seven-outs + points made). */
  readonly handsPlayed: number;
  /** Consecutive come-out natural wins (7 or 11). Resets on any non-natural come-out outcome. */
  readonly consecutiveComeOutLosses: number;
  /** Consecutive hands where the shooter made their point. Resets on any seven-out. */
  readonly pointRepeaterStreak: number;
}

/** Table/coverage state — read-only in strategy code. */
export interface TableReadView {
  /** Current point, or null if point is OFF. */
  readonly point: number | null;
  /** Numbers currently covered by Pass Line and traveled Come bets. */
  readonly coverage: ReadonlySet<number>;
  /** True when coverage includes 6 or 8. */
  readonly hasSixOrEight: boolean;
  /** Come bets not yet settled on a number. */
  readonly comeBetsInTransit: number;
  /** Numbers currently covered by Don't Pass and traveled Don't Come bets. */
  readonly dontCoverage: ReadonlySet<number>;
  /** Don't Come bets placed but not yet traveled to a point. */
  readonly dontComeBetsInTransit: number;
}

// ---------------------------------------------------------------------------
// Stage context (passed to board functions)
// ---------------------------------------------------------------------------

/** Context passed to board() functions — the stage-aware strategy context. */
export interface StageContext {
  /** Bet reconciler — same API as StrategyContext.bets. */
  bets: BetReconciler;
  /** Per-stage scoped state. Resets when re-entering a stage. */
  track: <T>(key: string, initial?: T) => T;
  /** Read-only session-level state. */
  session: SessionState;
  /** Read-only table/coverage state. */
  table: TableReadView;
  /** Imperative step-up trigger. Gated by canAdvanceTo guard. */
  advanceTo(stageName: string): void;
}

// ---------------------------------------------------------------------------
// Stage configuration
// ---------------------------------------------------------------------------

/** Configuration for a single stage. */
export interface StageConfig {
  /**
   * Declares desired bets for this stage. Called once per roll.
   * Same BetReconciler API as StrategyDefinition.
   */
  board: (ctx: StageContext) => void;

  /**
   * Advance guard: returns true when stepping up to the named stage is
   * permitted. The engine does NOT auto-advance — this only gates the
   * advanceTo() call inside board().
   */
  canAdvanceTo?: (targetStage: string, ctx: SessionState) => boolean;

  /**
   * Step-down guard: returns the name of the stage to retreat to, or
   * undefined when no retreat is required. Evaluated after every postRoll()
   * and enforced automatically — the strategy has no veto.
   */
  mustRetreatTo?: (ctx: SessionState) => string | undefined;

  /** Optional map of named event handlers. */
  on?: Partial<CrapsEventHandlers>;
}

// ---------------------------------------------------------------------------
// Stage Machine builder
// ---------------------------------------------------------------------------

/** Fluent builder for a Stage Machine. */
export interface StageMachineBuilder {
  /** Declare the initial stage. */
  startingAt(stageName: string): StageMachineBuilder;

  /** Add a stage with its configuration. */
  stage(name: string, config: StageConfig): StageMachineBuilder;

  /** Compile to StrategyDefinition — must be called last. */
  build(): StrategyDefinition;
}
