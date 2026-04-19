import { Dice, DiceRoll } from "../../src/dice/dice";

// Dice stub that accepts explicit [die1, die2] pairs so tests can distinguish
// hard rolls (die1 === die2) from easy rolls — required for HardwaysBet tests.
export class RiggedDicePairs extends Dice {
  private rollQueue: DiceRoll[];

  constructor(pairs: Array<[number, number]>) {
    super();
    this.rollQueue = pairs.map(([d1, d2]) => ({ die1: d1, die2: d2, sum: d1 + d2 }));
  }

  doRoll(): DiceRoll {
    if (this.rollQueue.length === 0) {
      throw new RangeError("Exceeded RiggedDicePairs roll queue.");
    }
    return this.rollQueue.shift()!;
  }
}
