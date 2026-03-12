import { SimpleBetReconciler, BetReconciler, BetCommand, diffBets, tableBetToDesired } from './bet-reconciler';
import { PlayerState } from './player-state';
import { GameState } from './game-state';
import { CrapsTable } from '../craps-table';
import { Outcome } from './outcome';

export type StrategyDefinition = (ctx: StrategyContext) => void;

export interface StrategyContext {
  bets: BetReconciler;
  track: <T>(key: string, initial?: T) => T;
}

export class ReconcileEngine {
  private trackers = new Map<string, any>();

  constructor(
    private table: CrapsTable,
    private playerId: string,
    private game: GameState,
  ) {}

  reconcile(strategy: StrategyDefinition): BetCommand[] {
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

  postRoll(outcomes: Outcome[]): void {
    for (const outcome of outcomes) {
      if (outcome.result === 'win') {
        const current = this.trackers.get('wins') ?? 0;
        this.trackers.set('wins', current + 1);
      } else if (outcome.result === 'loss') {
        const current = this.trackers.get('losses') ?? 0;
        this.trackers.set('losses', current + 1);
      }
    }
  }
}
