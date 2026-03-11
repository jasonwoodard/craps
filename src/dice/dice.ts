import { MersenneTwister } from '../dice/mersenne-twister';

export abstract class Dice {
  rollHistory : number[] = [];

  roll(): number {
    let rollValue = this.doRoll()
    this.rollHistory.push(rollValue);
    return rollValue;
  }

  protected abstract doRoll() : number;
}

export class LiveDice extends Dice {

  private twister: MersenneTwister;
  
  constructor() {
    super();
    this.twister = new MersenneTwister();
  };

  doRoll() :number {
    let dValue1 = this.rollD6();
    let dValue2 = this.rollD6();
    return dValue1 + dValue2;
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