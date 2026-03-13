import { Dice, LiveDice } from "./dice/dice";
import * as _ from "lodash";
import { BaseBet } from "./bets/base-bet";

export class CrapsTable {
  public currentPoint: number;

  public dice: Dice;

  private _bets: BaseBet[] = [];
  bettors: ((table: CrapsTable) => void)[];

  constructor() {
    this.dice = new LiveDice();
    this.bettors = [];
  }

  get isPointOn(): boolean {
    return !(this.currentPoint == undefined);
  }

  getLastRoll(): number {
    return _.last(this.dice.rollHistory);
  }

  placeBet(bet: BaseBet): void {
    this._bets.push(bet);
  }

  removeBet(bet: BaseBet): void {
    const idx = this._bets.indexOf(bet);
    if (idx >= 0) this._bets.splice(idx, 1);
  }

  get bets(): BaseBet[] {
    return this._bets;
  }

  onPlaceBets(bettor: (table: CrapsTable) => void) {
    this.bettors.push(bettor);
  }

  getPlayerBets(playerId: string): BaseBet[] {
    let playerBets = _.filter(this._bets, bet => {
      return bet.player == playerId;
    });
    return _.clone(playerBets);
  }

  rollDice(): void {
    // TODO: Add player table load logging right before dice roll.
    // How much each player has on the table (# of bets and total amount)

    // Roll dice and resolve bets.
    let rollvalue = this.dice.roll();

    // Resolve the bets
    this.resolveBets(rollvalue);

    // 'Handle' the on/off puck table state.
    if (this.isPointOn) {
      if (this.currentPoint === rollvalue || rollvalue === 7) {
        this.currentPoint = undefined;
      }
    } else {
      if (
        (rollvalue >= 4 && rollvalue <= 6) ||
        (rollvalue >= 8 && rollvalue <= 10)
      ) {
        this.currentPoint = rollvalue;
      }
    }
  }

  resolveBets(rollValue: number) {
    this._bets.forEach(bet => {
      bet.evaluateDiceRoll(rollValue, this);
    });

    // Remove zero'd out bets.
    this._bets = _.filter(this._bets, bet => {
      return bet.amount != 0;
    });
  }
}
