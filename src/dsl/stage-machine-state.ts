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
import { BetReconciler, BetWithOdds } from './bet-reconciler';

/** Mutable session state owned by the runtime. */
interface MutableSessionState {
  profit: number;
  stage: string;
  consecutiveSevenOuts: number;
  handsPlayed: number;
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
  remove: () => {},
};

export class StageMachineRuntime {
  private currentStage: string;
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
  ) {
    this.currentStage = startingStage;
    this.stageConfigs = configs;
    this.sessionState = {
      profit: 0,
      stage: startingStage,
      consecutiveSevenOuts: 0,
      handsPlayed: 0,
    };
  }

  /** Inject table context — called by ReconcileEngine before each reconcile. */
  setTableContext(table: CrapsTable, playerId: string, bankroll?: number): void {
    this.table = table;
    this.playerId = playerId;
    // Capture initial bankroll on first call (before any bets are placed)
    if (bankroll !== undefined && this.initialBankroll === null) {
      this.initialBankroll = bankroll;
    }
  }

  /** Returns the current stage name. */
  getCurrentStage(): string {
    return this.currentStage;
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
    // Update profit (initialBankroll is set in setTableContext on first reconcile call)
    if (this.initialBankroll !== null) {
      this.sessionState.profit = bankroll - this.initialBankroll;
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
    const config = this.stageConfigs.get(this.currentStage);
    if (!config || !config.mustRetreatTo) return;

    const target = config.mustRetreatTo(this.sessionState);
    if (target && this.stageConfigs.has(target)) {
      this.transitionTo(target);
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
      };
    }

    const point = this.table.currentPoint ?? null;
    const coverage = new Set<number>();
    let comeBetsInTransit = 0;

    const bets = this.table.getPlayerBets(this.playerId);
    for (const bet of bets) {
      if (bet instanceof ComeBet) {
        // Come bet — contributes to coverage only if it has traveled to a number
        if (bet.point != null && bet.point > 0) {
          coverage.add(bet.point);
        } else {
          comeBetsInTransit++;
        }
      } else if (bet instanceof PassLineBet) {
        // Pass line bet — contributes to coverage when point is ON
        // PassLineBet doesn't store its own point; the table's currentPoint IS the pass line point
        if (this.table.isPointOn && this.table.currentPoint != null) {
          coverage.add(this.table.currentPoint);
        }
      }
    }

    const hasSixOrEight = coverage.has(6) || coverage.has(8);

    return { point, coverage, hasSixOrEight, comeBetsInTransit };
  }
}
