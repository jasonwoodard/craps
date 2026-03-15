import { RiggedDice } from "./rigged-dice";

describe("RiggedDice", () => {
  let dice: RiggedDice;

  it("should return the values given it", () => {
    let stackedValues = [6, 5, 4, 3, 12, 2, 9];
    dice = new RiggedDice(stackedValues);

    let rolls: number[] = [];

    for (let i: number = 0; i < stackedValues.length; i++) {
      rolls.push(dice.roll().sum);
    }

    expect(rolls).toEqual(stackedValues);
  });

  it("should allow you to add to rolls", () => {
    dice = new RiggedDice();
    expect(dice.rollQueue).toEqual([]);

    let desiredRoll = 6;
    dice.addToQueue(desiredRoll);
    expect(dice.roll().sum).toBe(desiredRoll);

    let theOneAfter = 7;
    dice.addToQueue([desiredRoll, theOneAfter]);

    expect(dice.roll().sum).toBe(desiredRoll);
    expect(dice.roll().sum).toBe(theOneAfter);
  });

  it("should throw an error if you overrun the queue", () => {
    let rollQueue = [2, 3];
    dice = new RiggedDice(rollQueue);
    dice.roll();
    dice.roll();
    expect(dice.rollQueue.length).toBe(0);
    expect(dice.roll.bind(dice)).toThrowError();
  });

  it("should set die1=0 and die2=sum as test-mode fallback", () => {
    dice = new RiggedDice([7]);
    const result = dice.roll();
    expect(result.die1).toBe(0);
    expect(result.die2).toBe(7);
    expect(result.sum).toBe(7);
  });
});
