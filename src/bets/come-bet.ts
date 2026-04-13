import { PassLineBet } from "./pass-line-bet";
import { BetTypes } from "./base-bet";
import { CrapsTable } from "../craps-table";
import { DiceRoll } from "../dice/dice";

export class ComeBet extends PassLineBet {
  // Player may declare odds working during the come-out roll (§5.1).
  // Default: false (odds are OFF during come-out — §1.1).
  // NOTE: evaluateDiceRoll does not yet read this flag; §5 behavior is pending.
  oddsWorking: boolean = false;

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

  // Override: compute odds from this.point (the come bet's own point),
  // not table.currentPoint. Also applies during come-out when oddsWorking=true,
  // so we guard on this.point !== undefined rather than table.isPointOn.
  win(table: CrapsTable): void {
    this.payOut = this.amount;
    if (this.point !== undefined) {
      this.payOut += ComeBet.computeOddsPayoutForPoint(this.oddsAmount, this.point);
    }
  }

  private static computeOddsPayoutForPoint(oddsAmount: number, point: number): number {
    if (!oddsAmount) return 0;
    switch (point) {
      case 4: case 10: return oddsAmount * 2;
      case 5: case 9:  return Math.floor(oddsAmount / 2) * 3;
      case 6: case 8:  return Math.floor(oddsAmount / 5) * 6;
      default:         return 0;
    }
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
          // values from a valid dice roll (2–12) are 4, 5, 6, 8, 9, 10.
          // The bet travels to this number.
          this.point = rollValue;
      }
    } else {
      // Established phase: contract bet — always active regardless of
      // whether the table point is ON or OFF (new come-out).
      if (rollValue === this.point) {
        if (table.isPointOn) {
          // Normal point-phase win: base pays 1:1, odds pay true odds.
          this.win(table);
        } else {
          // Come-out: own point rolled.
          if (this.oddsWorking) {
            // Odds declared working: flat 1:1 + true odds (§5.2).
            this.win(table);
          } else {
            // Odds OFF (default): base wins 1:1, odds returned intact (§2.1–2.3).
            this.payOut = this.amount;
            // oddsAmount preserved — returned to player, not paid as winnings.
          }
        }
      } else if (rollValue === 7) {
        if (this.oddsWorking) {
          // Odds declared working: flat and odds both lose.
          this.lose();
        } else {
          // Flat is ALWAYS lost when seven is rolled after the bet has traveled.
          // Odds that are OFF (not working) are returned as a push — they were
          // never at risk.  Settlement detects amount===0 && oddsAmount>0 and
          // credits the odds back to the player without recording a win.
          this.amount = 0;
          // oddsAmount intentionally preserved — odds were not at risk.
        }
      }
    }
  }
}
