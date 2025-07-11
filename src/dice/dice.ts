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

  private rollD6() : number {
    let die = Math.round(this.twister.random() * 10000);
    return (die % 6) + 1
  };
}