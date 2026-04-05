import { SimpleBetReconciler, BetReconciler, BetCommand, diffBets, tableBetToDesired } from './bet-reconciler';
import { PlayerState } from './player-state';
import { GameState } from './game-state';
import { CrapsTable } from '../craps-table';
import { Outcome } from './outcome';
import { StageMachineRuntime } from './stage-machine-state';

export type StrategyDefinition = (ctx: StrategyContext) => void;

export interface StrategyContext {
  bets: BetReconciler;
  track: <T>(key: string, initial?: T) => T;
}

/**
 * Symbol used to tag StrategyDefinition functions that wrap a StageMachineRuntime.
 * ReconcileEngine detects this tag and provides extra context to the runtime.
 */
export const STAGE_MACHINE_RUNTIME = Symbol('stageMachineRuntime');

/** Optional post-roll context for stage machine integration. */
export interface PostRollContext {
  bankroll: number;
  pointBefore: number | undefined;
  pointAfter: number | undefined;
  rollValue: number;
}

export class ReconcileEngine {
  private trackers = new Map<string, any>();
  private cachedRuntime: StageMachineRuntime | null = null;

  constructor(
    private table: CrapsTable,
    private playerId: string,
    private game: GameState,
  ) {}

  reconcile(strategy: StrategyDefinition, bankroll?: number): BetCommand[] {
    // Cache runtime reference to avoid repeated Symbol lookups
    const runtime = (strategy as any)[STAGE_MACHINE_RUNTIME] as StageMachineRuntime | undefined;
    this.cachedRuntime = runtime ?? null;

    if (runtime) {
      runtime.setTableContext(this.table, this.playerId, bankroll);
    }

    const reconciler = new SimpleBetReconciler();
    const ctx: StrategyContext = {
      bets: reconciler,
      track: <T>(key: string, initial?: T) => {
        if (!this.trackers.has(key)) this.trackers.set(key, initial);
        return this.trackers.get(key);
      },
    };
    strategy(ctx);
    const current = this.table.getPlayerBets(this.playerId).map(tableBetToDesired);
    return diffBets(current, reconciler.desired);
  }

  postRoll(outcomes: Outcome[], ctx?: PostRollContext): void {
    for (const outcome of outcomes) {
      if (outcome.result === 'win') {
        const current = this.trackers.get('wins') ?? 0;
        this.trackers.set('wins', current + 1);
        // Reset consecutive-loss counter so Martingale-style strategies return to base bet.
        this.trackers.set('consecutiveLosses', 0);
      } else if (outcome.result === 'loss') {
        const current = this.trackers.get('losses') ?? 0;
        this.trackers.set('losses', current + 1);
        const consec = this.trackers.get('consecutiveLosses') ?? 0;
        this.trackers.set('consecutiveLosses', consec + 1);
      }
    }

    // Forward post-roll data to stage machine runtime if present
    if (this.cachedRuntime && ctx) {
      this.cachedRuntime.postRoll(outcomes, ctx.bankroll, ctx.pointBefore, ctx.pointAfter, ctx.rollValue);
    }
  }
}
