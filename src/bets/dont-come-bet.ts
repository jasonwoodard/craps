import { DontPassBet } from './dont-pass-bet';
import { BetTypes } from './base-bet';
import { CrapsTable } from '../craps-table';

/**
 * Don't Come bet — the darkside sibling of ComeBet, and inverse of PassLineBet
 * in the come position.
 *
 * Placed when the table point is ON.  Evaluation mirrors DontPassBet but using
 * the live table state:
 *   wins on 7 (seven-out)  ·  loses if the current table point is rolled
 *
 * Lay odds follow the same computation as DontPassBet.
 *
 * Note: this is a simplified implementation consistent with the existing ComeBet
 * pattern — it uses the table's current point rather than tracking its own
 * "traveled-to" number.
 */
export class DontComeBet extends DontPassBet {
  constructor(amount: number, playerId: string) {
    super(amount, playerId);
    this.betType = BetTypes.DONT_COME;
  }

  isOkayToPlace(table: CrapsTable): boolean {
    return table.isPointOn; // mirror of ComeBet: placed when point is ON
  }
}
