import { CrapsTable } from '../craps-table';
import { BaseBet, BetTypes } from './base-bet';
import { DiceRoll } from '../dice/dice';

const CRAPS_NUMBERS = new Set([2, 3, 12]);

export class CEBet extends BaseBet {
  constructor(amount: number, playerId: string) {
    super(BetTypes.CE, amount, playerId);
  }

  // C&E is always active — one-roll prop, no phase restriction.
  isOkayToPlace(_table: CrapsTable): boolean {
    return true;
  }

  evaluateDiceRoll(diceRoll: DiceRoll, _table: CrapsTable): void {
    if (CRAPS_NUMBERS.has(diceRoll.sum)) {
      // Craps (2, 3, 12): pays 3:1 net
      this.payOut = this.amount + this.amount * 3;
    } else if (diceRoll.sum === 11) {
      // Eleven: pays 7:1 net
      this.payOut = this.amount + this.amount * 7;
    } else {
      this.lose();
    }
  }

  win(_table: CrapsTable): void {}

  lose(): void {
    this.amount = 0;
  }
}
