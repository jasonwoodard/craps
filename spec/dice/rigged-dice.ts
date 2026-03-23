import { Dice, DiceRoll } from "../../src/dice/dice";

export class RiggedDice extends Dice {
  rollQueue: number[];

  constructor(rollQueue?: number[]) {
    super();
    this.rollQueue = ([] as number[]).concat(rollQueue || []);
  }

  // Returns a DiceRoll where die1=0, die2=sum is a documented test-mode
  // fallback. Game mechanics only use the sum; die1/die2 are zero because
  // RiggedDice accepts sums, not individual die values.
  doRoll(): DiceRoll {
    if (this.rollQueue.length == 0) {
      throw new RangeError("Exceeded RiggedDice roll queue.");
    }
    const sum = this.rollQueue.shift()!;
    return { die1: 0, die2: sum, sum };
  }

  addToQueue(numbersToAdd: number | number[]): void {
    if (Array.isArray(numbersToAdd)) {
      this.rollQueue.push(...([] as number[]).concat(numbersToAdd));
    } else {
      this.rollQueue.push(numbersToAdd);
    }
  }
}
