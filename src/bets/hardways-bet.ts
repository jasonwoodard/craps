import { CrapsTable } from '../craps-table';
import { BaseBet, BetTypes } from './base-bet';
import { DiceRoll } from '../dice/dice';

const VALID_HARDWAYS_POINTS = [4, 6, 8, 10];

// Payout multipliers: 7:1 on hard 4/10, 9:1 on hard 6/8
const HARDWAYS_PAYOUT: Record<number, number> = {
  4: 7,
  6: 9,
  8: 9,
  10: 7,
};

export class HardwaysBet extends BaseBet {
  constructor(amount: number, point: number, playerId: string) {
    super(BetTypes.HARDWAYS, amount, playerId);
    this.point = point;
  }

  isOkayToPlace(_table: CrapsTable): boolean {
    return VALID_HARDWAYS_POINTS.includes(this.point!);
  }

  evaluateDiceRoll(diceRoll: DiceRoll, _table: CrapsTable): void {
    const isHard = diceRoll.die1 === diceRoll.die2;
    const isTarget = diceRoll.sum === this.point;

    if (isTarget && isHard) {
      this.win(_table);
    } else if (diceRoll.sum === 7 || (isTarget && !isHard)) {
      this.lose();
    }
    // else: no action — bet stays up
  }

  win(_table: CrapsTable): void {
    const multiplier = HARDWAYS_PAYOUT[this.point!];
    this.payOut = this.amount + this.amount * multiplier;
  }

  lose(): void {
    this.amount = 0;
  }
}
