import { CrapsTable } from '../craps-table';
import { BaseBet, BetTypes } from './base-bet';
import { DiceRoll } from '../dice/dice';

/**
 * Don't Pass bet — the "darkside" inverse of PassLineBet.
 *
 * Come-out phase (point OFF):
 *   wins on 2 or 3  ·  pushes on 12 (bar 12)  ·  loses on 7 or 11
 *
 * Point phase (point ON):
 *   wins on 7 (seven-out)  ·  loses if point is made
 *
 * Lay odds are available once a point is established. The player lays more
 * to win less: 2:1 on 4/10 · 3:2 on 5/9 · 6:5 on 6/8 (true odds inverted).
 *
 * House edge: 1.36%
 *
 * Contract bet: once a point is established the bet may not be taken down.
 * The reconciler's remove() is a no-op for DontPassBet mid-hand; strategies
 * should simply never call remove() on it after the point is set.
 */
export class DontPassBet extends BaseBet {
  layOddsAmount: number = 0;

  constructor(amount: number, playerId: string) {
    super(BetTypes.DONT_PASS, amount, playerId);
  }

  get totalAmount(): number {
    return this.amount + this.layOddsAmount;
  }

  isOkayToPlace(table: CrapsTable): boolean {
    return !table.isPointOn; // can only be placed on come-out
  }

  evaluateDiceRoll(diceRoll: DiceRoll, table: CrapsTable): void {
    const rollValue = diceRoll.sum;
    if (table.isPointOn) {
      // Point phase: 7 wins, point loses
      if (rollValue === 7) {
        this.win(table);
      } else if (rollValue === table.currentPoint) {
        this.lose();
      }
      // all other rolls: no action
    } else {
      // Come-out phase
      switch (rollValue) {
        case 2:
        case 3:
          this.win(table);
          break;
        case 12:
          // Bar 12: push — no action
          break;
        case 7:
        case 11:
          this.lose();
          break;
        // 4-6, 8-10: point established, bet rides — no action
      }
    }
  }

  win(table: CrapsTable): void {
    // payOut = profit only; engine returns amount + layOddsAmount + payOut
    this.payOut = this.amount; // flat bet wins even money
    if (table.isPointOn) {
      this.payOut += DontPassBet.computeLayOddsPayout(this, table);
    }
  }

  lose(): void {
    this.amount = 0;
    this.layOddsAmount = 0;
  }

  /**
   * Computes the profit from lay odds on a winning Don't Pass bet.
   * The player lays more to win less (inverse of take odds):
   *   4/10 → lay 2:1 (win half the lay amount)
   *   5/9  → lay 3:2 (win 2/3 of the lay amount)
   *   6/8  → lay 6:5 (win 5/6 of the lay amount)
   */
  static computeLayOddsPayout(bet: DontPassBet, table: CrapsTable): number {
    if (!bet.layOddsAmount) return 0;
    const point = table.currentPoint;
    switch (point) {
      case 4:
      case 10:
        return Math.floor(bet.layOddsAmount / 2);
      case 5:
      case 9:
        return Math.floor(bet.layOddsAmount * 2 / 3);
      case 6:
      case 8:
        return Math.floor(bet.layOddsAmount * 5 / 6);
      default:
        return 0;
    }
  }
}
