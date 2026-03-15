import { Dice, DiceRoll, LiveDice } from "./dice/dice";
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

  getLastRoll(): number | undefined {
    return _.last(this.dice.rollHistory)?.sum;
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

  rollDice(): DiceRoll {
    const diceRoll = this.dice.roll();

    // Resolve the bets using the sum
    this.resolveBets(diceRoll.sum);

    // 'Handle' the on/off puck table state.
    if (this.isPointOn) {
      if (this.currentPoint === diceRoll.sum || diceRoll.sum === 7) {
        this.currentPoint = undefined;
      }
    } else {
      if (
        (diceRoll.sum >= 4 && diceRoll.sum <= 6) ||
        (diceRoll.sum >= 8 && diceRoll.sum <= 10)
      ) {
        this.currentPoint = diceRoll.sum;
      }
    }

    return diceRoll;
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
