import { CrapsTable } from '../craps-table';
import { BaseBet, BetTypes } from './base-bet';
import { DiceRoll } from '../dice/dice';

const VALID_LAY_POINTS = [4, 5, 6, 8, 9, 10];

/**
 * Lay Bet (standalone) — wins when 7 rolls before the bet's number.
 *
 * The player lays more to win less (inverse of place odds):
 *   4 / 10 → lay 2:1  (lay $40 wins $20)
 *   5 / 9  → lay 3:2  (lay $30 wins $20)
 *   6 / 8  → lay 6:5  (lay $24 wins $20)
 *
 * Vig = Math.max(1, Math.floor(winAmount × 0.05)), charged on win only.
 * Net win = winAmount − vig
 * payOut = amount (original) + net win   (includes original stake, like PlaceBet)
 *
 * Always working — not turned off during come-out.
 * No vig charged on a loss.
 */
export class LayBet extends BaseBet {
  constructor(amount: number, point: number, playerId: string) {
    super(BetTypes.LAY, amount, playerId);
    if (!VALID_LAY_POINTS.includes(point)) {
      throw new Error(`Invalid lay bet point: ${point}. Must be 4, 5, 6, 8, 9, or 10.`);
    }
    this.point = point;
  }

  isOkayToPlace(_table: CrapsTable): boolean {
    return VALID_LAY_POINTS.includes(this.point!);
  }

  evaluateDiceRoll(diceRoll: DiceRoll, _table: CrapsTable): void {
    // Lay bets are always working (not affected by come-out state).
    if (diceRoll.sum === 7) {
      this.win(_table);
    } else if (diceRoll.sum === this.point) {
      this.lose();
    }
  }

  win(_table: CrapsTable): void {
    const winAmount = LayBet.computeLayWin(this.amount, this.point!);
    const vig = Math.max(1, Math.floor(winAmount * 0.05));
    // payOut includes the original stake (matches PlaceBet convention).
    this.payOut = this.amount + winAmount - vig;
  }

  lose(): void {
    this.amount = 0; // no vig on loss
  }

  static computeLayWin(amount: number, point: number): number {
    switch (point) {
      case 4:
      case 10:
        return Math.floor(amount / 2);
      case 5:
      case 9:
        return Math.floor(amount * 2 / 3);
      case 6:
      case 8:
        return Math.floor(amount * 5 / 6);
      default:
        throw new Error(`Invalid lay bet point: ${point}`);
    }
  }
}
