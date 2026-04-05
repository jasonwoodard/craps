import { CrapsTable } from "../craps-table";
import { BaseBet, BetTypes } from "./base-bet";
import { DiceRoll } from '../dice/dice';

const VALID_PLACE_POINTS = [4, 5, 6, 8, 9, 10];

export class PlaceBet extends BaseBet {
  constructor(amount: number, point: number, playerId: string) {
    super(BetTypes.PLACE, amount, playerId);
    this.point = point;
  }

  isOkayToPlace(_table: CrapsTable): boolean {
    return VALID_PLACE_POINTS.includes(this.point!);
  }

  evaluateDiceRoll(diceRoll: DiceRoll, table: CrapsTable): void {
    const rollValue = diceRoll.sum;
    // Place bets are "off" during the come-out roll (point not established).
    if (!table.isPointOn) return;

    if (rollValue === this.point) {
      this.win(table);
    } else if (rollValue === 7) {
      this.lose();
    }
  }

  win(_table: CrapsTable): void {
    this.payOut = this.amount + PlaceBet.computeWinAmount(this.amount, this.point!);
  }

  lose(): void {
    this.amount = 0;
  }

  /**
   * Computes the profit on a winning place bet.
   * Payouts: 9:5 on 4/10, 7:5 on 5/9, 7:6 on 6/8
   * Floor division replicates casino behavior (no fractional chips).
   */
  static computeWinAmount(amount: number, point: number): number {
    switch (point) {
      case 4:
      case 10:
        return Math.floor(amount * 9 / 5);
      case 5:
      case 9:
        return Math.floor(amount * 7 / 5);
      case 6:
      case 8:
        return Math.floor(amount * 7 / 6);
      default:
        throw new Error(`Invalid place bet point: ${point}. Must be 4, 5, 6, 8, 9, or 10.`);
    }
  }
}
