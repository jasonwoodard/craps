import { DontPassBet } from './dont-pass-bet';
import { BetTypes } from './base-bet';
import { CrapsTable } from '../craps-table';
import { DiceRoll } from '../dice/dice';

/**
 * Don't Come bet — the darkside sibling of ComeBet, and inverse of PassLineBet
 * in the come position.
 *
 * Transit phase (this.point === undefined, table.isPointOn):
 *   wins on 2/3  ·  pushes on 12  ·  loses on 7/11  ·  travels on 4–6, 8–10
 *
 * Established phase (this.point !== undefined):
 *   wins on 7 (seven-out)  ·  loses if own point is re-rolled
 *
 * Lay odds use this.point (the DC's own traveled-to number), not
 * table.currentPoint, so payout is always correct regardless of the
 * pass-line point.
 */
export class DontComeBet extends DontPassBet {
  constructor(amount: number, playerId: string) {
    super(amount, playerId);
    this.betType = BetTypes.DONT_COME;
  }

  isOkayToPlace(table: CrapsTable): boolean {
    return table.isPointOn; // mirror of ComeBet: placed when point is ON
  }

  win(table: CrapsTable): void {
    this.payOut = this.amount;
    if (this.point !== undefined) {
      // Established phase: use our own traveled-to point for lay-odds payout.
      this.payOut += DontComeBet.computeLayOddsPayoutForPoint(
        this.layOddsAmount,
        this.point
      );
    }
    // Transit wins (2/3): no lay odds yet, payOut = amount only.
  }

  evaluateDiceRoll(diceRoll: DiceRoll, table: CrapsTable): void {
    const rollValue = diceRoll.sum;

    if (this.point === undefined) {
      // Transit phase: DC was placed while point is ON; it hasn't traveled yet.
      // Apply come-out rules (same as DontPass on come-out), regardless of
      // table.isPointOn — the DC always starts fresh when first placed.
      if (!table.isPointOn) return; // safety guard

      switch (rollValue) {
        case 2:
        case 3:
          this.win(table);
          break;
        case 12:
          // Bar 12 in transit: push — signal settlement to return flat stake.
          this.payOut = 0;
          this.amount = 0;
          break;
        case 7:
        case 11:
          this.lose();
          break;
        default:
          // 4, 5, 6, 8, 9, 10 — bet travels to this number
          this.point = rollValue;
      }
    } else {
      // Established phase: win on 7, lose when own point is re-rolled.
      if (rollValue === 7) {
        this.win(table);
      } else if (rollValue === this.point) {
        this.lose();
      }
    }
  }

  private static computeLayOddsPayoutForPoint(
    layOddsAmount: number,
    point: number
  ): number {
    if (!layOddsAmount) return 0;
    switch (point) {
      case 4:
      case 10:
        return Math.floor(layOddsAmount / 2);
      case 5:
      case 9:
        return Math.floor(layOddsAmount * 2 / 3);
      case 6:
      case 8:
        return Math.floor(layOddsAmount * 5 / 6);
      default:
        return 0;
    }
  }
}
