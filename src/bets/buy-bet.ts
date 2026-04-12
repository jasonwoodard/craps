import { CrapsTable } from '../craps-table';
import { BaseBet, BetTypes } from './base-bet';
import { DiceRoll } from '../dice/dice';

const VALID_BUY_POINTS = [4, 5, 6, 8, 9, 10];

/**
 * Buy Bet — like a place bet but at true odds, with a vig charged on win only.
 *
 * Payouts (true odds):
 *   4 / 10 → 2:1
 *   5 / 9  → 3:2
 *   6 / 8  → 6:5
 *
 * Vig = Math.max(1, Math.floor(winAmount × 0.05))
 * Net win = winAmount − vig
 * payOut = amount (original) + net win   (like PlaceBet, includes original stake)
 *
 * Off during come-out (point OFF), matching PlaceBet behaviour.
 * No vig charged on a losing buy.
 */
export class BuyBet extends BaseBet {
  constructor(amount: number, point: number, playerId: string) {
    super(BetTypes.BUY, amount, playerId);
    if (!VALID_BUY_POINTS.includes(point)) {
      throw new Error(`Invalid buy bet point: ${point}. Must be 4, 5, 6, 8, 9, or 10.`);
    }
    this.point = point;
  }

  isOkayToPlace(_table: CrapsTable): boolean {
    return VALID_BUY_POINTS.includes(this.point!);
  }

  evaluateDiceRoll(diceRoll: DiceRoll, table: CrapsTable): void {
    // Off during come-out (same as place bets).
    if (!table.isPointOn) return;

    if (diceRoll.sum === this.point) {
      this.win(table);
    } else if (diceRoll.sum === 7) {
      this.lose();
    }
  }

  win(_table: CrapsTable): void {
    const winAmount = BuyBet.computeTrueOddsWin(this.amount, this.point!);
    const vig = Math.max(1, Math.floor(winAmount * 0.05));
    // payOut includes the original stake (matches PlaceBet convention).
    this.payOut = this.amount + winAmount - vig;
  }

  lose(): void {
    this.amount = 0; // no vig on loss
  }

  static computeTrueOddsWin(amount: number, point: number): number {
    switch (point) {
      case 4:
      case 10:
        return amount * 2;
      case 5:
      case 9:
        return Math.floor(amount * 3 / 2);
      case 6:
      case 8:
        return Math.floor(amount * 6 / 5);
      default:
        throw new Error(`Invalid buy bet point: ${point}`);
    }
  }
}
