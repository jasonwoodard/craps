/**
 * Stage Machine Runtime — stateful driver for Stage Machine strategies.
 *
 * Manages current stage, SessionState, per-stage track() scope,
 * event dispatch, and transition evaluation.
 */

import { StageConfig, StageContext, SessionState, TableReadView } from './stage-machine-types';
import { StrategyContext } from './strategy';
import { CrapsTable } from '../craps-table';
import { Outcome } from './outcome';
import { BetTypes } from '../bets/base-bet';
import { PassLineBet } from '../bets/pass-line-bet';
import { ComeBet } from '../bets/come-bet';
import { DontPassBet } from '../bets/dont-pass-bet';
import { DontComeBet } from '../bets/dont-come-bet';
import { BetReconciler, BetWithOdds } from './bet-reconciler';

/** Mutable session state owned by the runtime. */
interface MutableSessionState {
  profit: number;
  stage: string;
  consecutiveSevenOuts: number;
  sevenOutStepDownTriggered: boolean;
  handsPlayed: number;
  consecutiveComeOutLosses: number;
  pointRepeaterStreak: number;
}

/** Box numbers / point numbers — the six numbers that can be a point. */
const BOX_NUMBERS = new Set([4, 5, 6, 8, 9, 10]);

/** Shared no-op BetWithOdds return value for event handler contexts. */
const NOOP_BET_WITH_ODDS: BetWithOdds = { withOdds: () => {}, withMaxOdds: () => {} };

/** Shared no-op BetReconciler for event handler contexts. */
const NOOP_BET_RECONCILER: BetReconciler = {
  passLine: () => NOOP_BET_WITH_ODDS,
  come: () => NOOP_BET_WITH_ODDS,
  dontPass: () => NOOP_BET_WITH_ODDS,
  dontCome: () => NOOP_BET_WITH_ODDS,
  place: () => {},
  field: () => {},
  hardways: () => {},
  ce: () => {},
  lay: () => {},
  buy: () => {},
  remove: () => {},
};

export class StageMachineRuntime {
  private currentStage: string;
  private lastBoardStage: string;
  /** Funded-entry gate (v4 §2): origin = initialBankroll − entryGate. */
  private entryGate: number;
  private stageTrackers = new Map<string, Map<string, any>>();
  private sessionState: MutableSessionState;
  private stageConfigs: Map<string, StageConfig>;
  private initialBankroll: number | null = null;
  private pendingAdvance: string | null = null;
  private table: CrapsTable | null = null;
  private playerId: string = '';

  constructor(
    startingStage: string,
    configs: Map<string, StageConfig>,
    _machineName: string,
    entryGate: number = 0,
  ) {
    this.currentStage = startingStage;
    this.lastBoardStage = startingStage;
    this.entryGate = entryGate;
    this.stageConfigs = configs;
    this.sessionState = {
      profit: 0,
      stage: startingStage,
      consecutiveSevenOuts: 0,
      sevenOutStepDownTriggered: false,
      handsPlayed: 0,
      consecutiveComeOutLosses: 0,
      pointRepeaterStreak: 0,
    };
  }

  /** Inject table context — called by ReconcileEngine before each reconcile. */
  setTableContext(table: CrapsTable, playerId: string, bankroll?: number): void {
    this.table = table;
    this.playerId = playerId;
    // Capture initial bankroll on first call (before any bets are placed)
    if (bankroll !== undefined && this.initialBankroll === null) {
      this.initialBankroll = bankroll;
      // Session start: equity = bankroll, so profit = bankroll − origin =
      // entryGate exactly. Without this, the first reconcile's retreat
      // check would see the constructor's profit 0 and cascade a funded
      // entry down the ladder before the first roll. Default entry has
      // gate 0 — identical to the previous initialization.
      this.sessionState.profit = this.entryGate;
    }
  }

  /** Returns the current stage name. */
  getCurrentStage(): string {
    return this.currentStage;
  }

  /**
   * Returns the stage whose board() built the bets for the most recent
   * reconcile — i.e., the stage that actually PLAYED the roll. Differs from
   * getCurrentStage() on transition rolls: retreats apply before board(),
   * advances after it, and events can advance during postRoll.
   */
  getLastBoardStage(): string {
    return this.lastBoardStage;
  }

  /** Returns session state for external inspection (e.g., tests). */
  getSessionState(): SessionState {
    return this.sessionState;
  }

  /**
   * Called by the StrategyDefinition wrapper on each reconcile pass.
   * Delegates to the current stage's board() function.
   */
  onStrategyCall(ctx: StrategyContext): void {
    // Evaluate retreats before board()
    this.evaluateRetreats();

    const config = this.stageConfigs.get(this.currentStage);
    if (!config) return;

    this.pendingAdvance = null;
    this.lastBoardStage = this.currentStage;

    const stageCtx = this.buildStageContext(ctx, config);

    config.board(stageCtx);

    // Apply pending advance after board() completes
    if (this.pendingAdvance && this.stageConfigs.has(this.pendingAdvance)) {
      this.transitionTo(this.pendingAdvance);
    }
  }

  /**
   * Updates session state after a roll completes.
   * Called by ReconcileEngine.postRoll() for stage machine strategies.
   */
  postRoll(
    outcomes: Outcome[],
    bankroll: number,
    pointBefore: number | undefined,
    pointAfter: number | undefined,
    rollValue: number,
  ): void {
    // Update profit per §3.7 accounting: (rack + working bets at face value)
    // − origin, after payouts settle. Face value = flat + odds. Origin is
    // the funded-entry zero point (v4 §2): initialBankroll − entryGate, so
    // a default entry (gate 0) reproduces the classic equity − buy-in and a
    // funded entry starts with profit exactly at its stage's gate. Without
    // table context (unit tests), felt load is 0 and profit is rack-only.
    // (initialBankroll is set in setTableContext on first reconcile call)
    if (this.initialBankroll !== null) {
      let feltLoad = 0;
      if (this.table) {
        for (const bet of this.table.getPlayerBets(this.playerId)) {
          feltLoad += bet.totalAmount;
        }
      }
      const origin = this.initialBankroll - this.entryGate;
      this.sessionState.profit = bankroll + feltLoad - origin;
    }

    // Track seven-outs and hands played
    const hadSevenOut = pointBefore != null && rollValue === 7;
    const pointMade = pointBefore != null && pointBefore === rollValue;

    if (hadSevenOut) {
      this.sessionState.handsPlayed++;
    }
    if (pointMade) {
      this.sessionState.handsPlayed++;
    }

    // Consecutive seven-outs tracking
    const hasWin = outcomes.some(o => o.result === 'win');
    if (hadSevenOut) {
      if (hasWin) {
        // Come bets in transit can win on a seven-out (7 is natural for come bet)
        this.sessionState.consecutiveSevenOuts = 0;
      } else {
        this.sessionState.consecutiveSevenOuts++;
      }
    } else if (hasWin) {
      this.sessionState.consecutiveSevenOuts = 0;
    }
    // No-action rolls do not reset consecutiveSevenOuts

    // Edge-triggered step-down signal: fires only on the roll where a
    // seven-out brings the counter to >= 2. Each further consecutive
    // seven-out re-arms it, so every trigger costs exactly one stage.
    this.sessionState.sevenOutStepDownTriggered =
      hadSevenOut && this.sessionState.consecutiveSevenOuts >= 2;

    // Come-out loss tracking (natural win = bad for don't side)
    const isComeOut = pointBefore == null;
    const isComeOutLoss = isComeOut && (rollValue === 7 || rollValue === 11);
    if (isComeOutLoss) {
      this.sessionState.consecutiveComeOutLosses++;
    } else if (isComeOut) {
      this.sessionState.consecutiveComeOutLosses = 0;
    }

    // Point repeater streak tracking
    if (hadSevenOut) {
      this.sessionState.pointRepeaterStreak = 0;
    }
    if (pointMade) {
      this.sessionState.pointRepeaterStreak++;
    }

    // Fire events for the current stage
    this.fireEvents(outcomes, pointBefore, pointAfter, rollValue);
  }

  /**
   * Fire event handlers for the current stage based on roll outcomes.
   */
  private fireEvents(
    outcomes: Outcome[],
    pointBefore: number | undefined,
    pointAfter: number | undefined,
    rollValue: number,
  ): void {
    const config = this.stageConfigs.get(this.currentStage);
    if (!config || !config.on) return;

    const handlers = config.on;
    const eventCtx = this.buildEventContext(config);

    // Seven-out: 7 during point-ON
    if (pointBefore != null && rollValue === 7 && handlers.sevenOut) {
      handlers.sevenOut({ rollNumber: 0 }, eventCtx);
    }

    // Point established: come-out establishes a point
    if (pointBefore == null && pointAfter != null && handlers.pointEstablished) {
      handlers.pointEstablished({ point: pointAfter }, eventCtx);
    }

    // Come-out: point turns OFF (after sevenOut or pointMade)
    if (pointBefore != null && pointAfter == null && handlers.comeOut) {
      (handlers.comeOut as any)(undefined, eventCtx);
    }

    // Natural win: 7 or 11 on come-out
    if (pointBefore == null && (rollValue === 7 || rollValue === 11) && handlers.naturalWin) {
      (handlers.naturalWin as any)(undefined, eventCtx);
    }

    // Number hit: box number rolled during point-ON (not 7)
    if (pointBefore != null && BOX_NUMBERS.has(rollValue) && rollValue !== 7 && handlers.numberHit) {
      const payout = outcomes
        .filter(o => o.result === 'win' && o.point === rollValue)
        .reduce((sum, o) => sum + o.payout, 0);
      handlers.numberHit({ number: rollValue, payout }, eventCtx);
    }

    // Come travel: come bet settles on a number
    if (handlers.comeTravel && pointBefore != null && BOX_NUMBERS.has(rollValue) && this.table) {
      const bets = this.table.getPlayerBets(this.playerId);
      for (const bet of bets) {
        if (bet.betType === BetTypes.COME && bet.point === rollValue) {
          handlers.comeTravel({ number: rollValue }, eventCtx);
          break;
        }
      }
    }
  }

  private evaluateRetreats(): void {
    // Loop so a deep profit crash descends immediately (§3.4 "step down
    // immediately") rather than one stage per roll; bounded by stage count.
    for (let i = 0; i < this.stageConfigs.size; i++) {
      const config = this.stageConfigs.get(this.currentStage);
      if (!config || !config.mustRetreatTo) return;

      const target = config.mustRetreatTo(this.sessionState);
      if (!target || !this.stageConfigs.has(target)) return;
      this.transitionTo(target);
      // A 7-out trigger is consumed by its step-down: one stage per trigger.
      this.sessionState.sevenOutStepDownTriggered = false;
    }
  }

  private transitionTo(stageName: string): void {
    // Reset per-stage trackers for the target stage
    this.stageTrackers.delete(stageName);
    this.currentStage = stageName;
    this.sessionState.stage = stageName;
  }

  /** Creates a track() function scoped to the given stage name. */
  private makeTrackFn(stageName: string): <T>(key: string, initial?: T) => T {
    return <T>(key: string, initial?: T): T => {
      if (!this.stageTrackers.has(stageName)) {
        this.stageTrackers.set(stageName, new Map());
      }
      const trackerMap = this.stageTrackers.get(stageName)!;
      if (!trackerMap.has(key)) {
        trackerMap.set(key, initial);
      }
      return trackerMap.get(key);
    };
  }

  private buildStageContext(ctx: StrategyContext, config: StageConfig): StageContext {
    return {
      bets: ctx.bets,
      track: this.makeTrackFn(this.currentStage),
      session: this.sessionState as SessionState,
      table: this.buildTableReadView(),
      advanceTo: (stageName: string) => {
        if (stageName === this.currentStage) return;
        if (this.pendingAdvance) return; // only first advanceTo counts
        if (config.canAdvanceTo) {
          if (!config.canAdvanceTo(stageName, this.sessionState)) return;
        }
        this.pendingAdvance = stageName;
      },
    };
  }

  private buildEventContext(config: StageConfig): StageContext {
    return {
      bets: NOOP_BET_RECONCILER,
      track: this.makeTrackFn(this.currentStage),
      session: this.sessionState as SessionState,
      table: this.buildTableReadView(),
      advanceTo: (stageName: string) => {
        if (stageName === this.currentStage) return;
        if (config.canAdvanceTo) {
          if (!config.canAdvanceTo(stageName, this.sessionState)) return;
        }
        this.transitionTo(stageName);
      },
    };
  }

  private buildTableReadView(): TableReadView {
    if (!this.table) {
      return {
        point: null,
        coverage: new Set<number>(),
        hasSixOrEight: false,
        comeBetsInTransit: 0,
        dontCoverage: new Set<number>(),
        dontComeBetsInTransit: 0,
      };
    }

    const point = this.table.currentPoint ?? null;
    const coverage = new Set<number>();
    let comeBetsInTransit = 0;
    const dontCoverage = new Set<number>();
    let dontComeBetsInTransit = 0;

    const bets = this.table.getPlayerBets(this.playerId);
    for (const bet of bets) {
      if (bet instanceof ComeBet) {
        if (bet.point != null && bet.point > 0) {
          coverage.add(bet.point);
        } else {
          comeBetsInTransit++;
        }
      } else if (bet instanceof PassLineBet) {
        if (this.table.isPointOn && this.table.currentPoint != null) {
          coverage.add(this.table.currentPoint);
        }
      } else if (bet instanceof DontComeBet) {
        if (bet.point != null && bet.point > 0) {
          dontCoverage.add(bet.point);
        } else {
          dontComeBetsInTransit++;
        }
      } else if (bet instanceof DontPassBet) {
        if (this.table.isPointOn && this.table.currentPoint != null) {
          dontCoverage.add(this.table.currentPoint);
        }
      }
    }

    const hasSixOrEight = coverage.has(6) || coverage.has(8);

    return { point, coverage, hasSixOrEight, comeBetsInTransit, dontCoverage, dontComeBetsInTransit };
  }
}
