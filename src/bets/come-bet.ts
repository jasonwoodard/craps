import { PassLineBet } from "./pass-line-bet";
import { BetTypes } from "./base-bet";
import { CrapsTable } from "../craps-table";
import { DiceRoll } from "../dice/dice";

const BOX_NUMBERS = new Set([4, 5, 6, 8, 9, 10]);

export class ComeBet extends PassLineBet {
  constructor(amount: number, playerId: string) {
    super(amount, playerId);
    this.betType = BetTypes.COME;
  }

  isOkayToPlace(table: CrapsTable): boolean {
    return table.isPointOn;
  }

  static isOkayToPlace(table: CrapsTable): boolean {
    let cb = new ComeBet(1, "dummy");
    return cb.isOkayToPlace(table);
  }

  evaluateDiceRoll(diceRoll: DiceRoll, table: CrapsTable): void {
    const rollValue = diceRoll.sum;

    if (this.point === undefined) {
      // Transit phase: a come bet in transit is only active when the table
      // point is ON (placement is already blocked during come-out, so this
      // guard is a safety net for direct evaluateDiceRoll calls).
      if (!table.isPointOn) return;

      // 7/11 → natural win; 2/3/12 → craps loss; point number → travel.
      switch (rollValue) {
        case 7:
        case 11:
          this.win(table);
          break;
        case 2:
        case 3:
        case 12:
          this.lose();
          break;
        default:
          // After handling 2, 3, 7, 11, 12 above, the only remaining
          // values are the box numbers — the bet travels to this number.
          if (BOX_NUMBERS.has(rollValue)) {
            this.point = rollValue;
          }
      }
    } else {
      // Established phase: contract bet — always active regardless of
      // whether the table point is ON or OFF (new come-out).
      if (rollValue === this.point) {
        if (table.isPointOn) {
          // Normal point-phase win: base pays 1:1, odds pay true odds.
          this.win(table);
        } else {
          // Come-out: own point rolled while odds are OFF.
          // Base wins 1:1; odds returned (not paid, not lost).
          this.payOut = this.amount;
          // oddsAmount preserved — returned to player, not paid as winnings.
        }
      } else if (rollValue === 7) {
        if (table.isPointOn) {
          // Seven-out: base AND odds both lose.
          this.lose();
        } else {
          // Come-out 7: base loses, odds are OFF and returned to player.
          this.amount = 0;
          // oddsAmount intentionally preserved — odds were not at risk.
        }
      }
    }
  }
}
