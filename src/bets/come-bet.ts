import { PassLineBet } from "./pass-line-bet";
import { BetTypes } from "./base-bet";
import { CrapsTable } from "../craps-table";
import { DiceRoll } from "../dice/dice";

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
    // Come bets are only active when the table point is ON.
    if (!table.isPointOn) return;

    const rollValue = diceRoll.sum;

    if (this.point === undefined) {
      // Transit phase: behaves like a come-out for the come bet.
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
          // 4, 5, 6, 8, 9, 10 — the bet travels to this number.
          if ((rollValue >= 4 && rollValue <= 6) || (rollValue >= 8 && rollValue <= 10)) {
            this.point = rollValue;
          }
      }
    } else {
      // Established phase: the bet has its own point.
      // Win only on the bet's OWN point; lose on 7; all else → no action.
      if (rollValue === this.point) {
        this.win(table);
      } else if (rollValue === 7) {
        this.lose();
      }
    }
  }
}
