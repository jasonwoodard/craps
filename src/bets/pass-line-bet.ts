import { CrapsTable } from "../craps-table";
import { BaseBet, BetTypes } from "./base-bet";

/**
 *  Pass line or come line bet
 */
export class PassLineBet extends BaseBet {
  oddsAmount: number = 0;

  constructor(amount: number, playerId: string) {
    super(BetTypes.PASS_LINE, amount, playerId);
  }

  static isOkayToPlace(table: CrapsTable): boolean {
    let plb = new PassLineBet(1, "dummy");
    return plb.isOkayToPlace(table);
  }

  isOkayToPlace(table: CrapsTable): boolean {
    return !table.isPointOn;
  }

  isEqual(otherBet: BaseBet): boolean {
    if (super.isEqual(otherBet)) {
      let otherPassBet = otherBet as PassLineBet;
      return otherPassBet && this.oddsAmount == otherPassBet.oddsAmount;
    }
    return false;
  }

  get totalAmount () : number {
    return this.amount + this.oddsAmount;
  }

  evaluateDiceRoll(rollValue: number, table: CrapsTable) {
    // If there is a point and it's hit, the bet wins.
    if (table.isPointOn && rollValue == table.currentPoint) {
      this.win(table);
    } else {
      // If the point is not made or there is no point
      switch (rollValue) {
        case 2:
        case 3:
        case 12:
          if (!table.isPointOn) {
            this.lose();
          }
          break;
        case 7:
          if (table.isPointOn) {
            // Seven Out
            this.lose();
          } else {
            // 7 on Comeout
            this.win(table);
          }
          break;
        case 11:
          if (!table.isPointOn) {
            // 11 on Comeout
            this.win(table);
          }
          break;
      }
    }
  }

  lose() {
    // Zero out the bet anticipating the table will remove
    // zero amount bets.
    this.amount = 0;
    this.oddsAmount = 0;
  }

  //Pays: 2:1 on 4, 10; 3:2 on 5, 9; 6:5 on 6,8
  win(table: CrapsTable) {
    this.payOut = this.amount;
    if (table.isPointOn) {
      this.payOut += PassLineBet.computeOddsPayout(this, table);
    }
  }

  static computeOddsPayout(bet: PassLineBet, table: CrapsTable): number {
    if (!bet.oddsAmount) {
      return 0;
    }
    const point = table.currentPoint;
    switch (point) {
      case 4:
      case 10:
        return bet.oddsAmount * 2;
        break;
      case 5:
      case 9:
        return Math.floor(bet.oddsAmount / 2) * 3;
        break;
      case 6:
      case 8:
        return Math.floor(bet.oddsAmount / 5) * 6;
        break;
      default:
        return 0;
    }
  }
}
