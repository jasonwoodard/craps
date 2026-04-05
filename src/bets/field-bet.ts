import { CrapsTable } from '../craps-table';
import { BaseBet, BetTypes } from './base-bet';
import { DiceRoll } from '../dice/dice';

const FIELD_WINNERS = new Set([2, 3, 4, 9, 10, 11, 12]);
const DOUBLE_PAY    = new Set([2, 12]);

export class FieldBet extends BaseBet {
  constructor(amount: number, playerId: string) {
    super(BetTypes.FIELD, amount, playerId);
  }

  // Field bets are always active — come-out and point phase alike.
  isOkayToPlace(_table: CrapsTable): boolean {
    return true;
  }

  evaluateDiceRoll(diceRoll: DiceRoll, _table: CrapsTable): void {
    if (FIELD_WINNERS.has(diceRoll.sum)) {
      this.winField(diceRoll.sum);
    } else {
      this.lose();
    }
  }

  // Private resolution — called from evaluateDiceRoll with the roll value.
  // Named winField() to avoid collision with BaseBet.win(table) abstract method.
  private winField(rollValue: number): void {
    const multiplier = DOUBLE_PAY.has(rollValue) ? 2 : 1;
    // payOut = total returned (original + profit) — matches PlaceBet semantics.
    // CrapsEngine.settleBets() handles this correctly via the non-PassLineBet branch.
    this.payOut = this.amount * (1 + multiplier);
  }

  // Satisfies BaseBet abstract contract. Not used — resolution happens in
  // evaluateDiceRoll via winField(). No-op here is intentional.
  win(_table: CrapsTable): void {}

  lose(): void {
    this.amount = 0;
  }
}
