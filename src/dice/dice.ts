import { MersenneTwister } from '../dice/mersenne-twister';

export interface DiceRoll {
  die1: number;
  die2: number;
  sum: number;
}

export abstract class Dice {
  rollHistory: DiceRoll[] = [];

  roll(): DiceRoll {
    const result = this.doRoll();
    this.rollHistory.push(result);
    return result;
  }

  protected abstract doRoll(): DiceRoll;
}

export class LiveDice extends Dice {

  private twister: MersenneTwister;

  constructor(seed?: number) {
    super();
    this.twister = new MersenneTwister(seed);
  };

  doRoll(): DiceRoll {
    const die1 = this.rollD6();
    const die2 = this.rollD6();
    return { die1, die2, sum: die1 + die2 };
  };

  private rollD6(): number {
    // Rejection sampling: discard values >= LIMIT so the remaining
    // range is exactly divisible by 6, eliminating modulo bias.
    const LIMIT = Math.floor(0x100000000 / 6) * 6; // 4,294,967,292
    let n: number;
    do {
      n = this.twister.genrand_int32();
    } while (n >= LIMIT);
    return (n % 6) + 1;
  }
}
