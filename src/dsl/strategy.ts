import { SimpleBetReconciler, BetReconciler, BetCommand, diffBets, tableBetToDesired } from './bet-reconciler';
import { PlayerState } from './player-state';
import { GameState } from './game-state';
import { CrapsTable } from '../craps-table';

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
}
