import { Dice, LiveDice } from '../../src/dice/dice';
import * as _ from 'lodash';
import { RiggedDice } from './rigged-dice';

describe('Dice', ():void => {

  let d : Dice;

  let getRollHash = function() {
    let rolls = new Map<number, number>();
    _.range(2,13).forEach((i) => {
      rolls.set(i, 0);
    });
    return rolls;
  }

  let historyCheck = function(dice: Dice) : void {
    let rollCount = 0;
    let rollValues = [];

    while (rollCount < 10) {
      rollValues.push(dice.roll());
      rollCount++;
    }
    expect(rollValues).toEqual(dice.rollHistory);
  };

  it('should keep a roll history—all types.', () => {
    historyCheck(new LiveDice());
    historyCheck(new RiggedDice(_.range(2,13)));
  });

  describe('LiveDice', () => {
    beforeEach(() => {
      d = new LiveDice();
     });

     it('should be between 2 and 12', () => {
       let roll = d.roll();
       expect(roll.sum).toBeLessThanOrEqual(12);
       expect(roll.sum).toBeGreaterThanOrEqual(2);
     });

     it('should roll all numbers 2 to 12', () => {
       let rolls = getRollHash();
       let totalRolls = 1000000;
       let i = 0
       while(i < totalRolls ){
         let roll = d.roll();
         let value = rolls.get(roll.sum);
         rolls.set(roll.sum, value + 1);
         i++
       }

       for (let key of rolls.keys()) {
         let rollCount = rolls.get(key);
         // Outputs roll counts and %
         // console.log(key, ', ', rollCount, ',', rollCount/totalRolls);
         expect(rolls.get(key)).toBeGreaterThan(0);
       }
     });

     it('should produce an unbiased sum distribution (2d6)', () => {
       // Roll 30,000 times and verify the triangular sum distribution
       // matches theory within 0.5% absolute tolerance.
       // This catches modulo bias in the d6 implementation.
       const totalRolls = 30000;
       const sumCounts = new Map<number, number>();
       _.range(2, 13).forEach(n => sumCounts.set(n, 0));

       for (let i = 0; i < totalRolls; i++) {
         const r = d.roll();
         sumCounts.set(r.sum, sumCounts.get(r.sum) + 1);
       }

       // Theoretical 2d6 probabilities: 2:1/36 ... 7:6/36 ... 12:1/36
       const expectedProbs: Record<number, number> = {
         2:1/36, 3:2/36, 4:3/36, 5:4/36, 6:5/36, 7:6/36,
         8:5/36, 9:4/36, 10:3/36, 11:2/36, 12:1/36
       };
       const tolerance = 0.005; // 0.5% absolute tolerance on proportion

       for (const [key, expectedProb] of Object.entries(expectedProbs)) {
         const observed = sumCounts.get(Number(key)) / totalRolls;
         expect(Math.abs(observed - expectedProb))
           .toBeLessThan(tolerance,
             `Sum ${key}: observed ${observed.toFixed(4)} vs expected ${expectedProb.toFixed(4)}`);
       }
     });

     it('should produce valid die1 and die2 values (1–6 each)', () => {
       for (let i = 0; i < 1000; i++) {
         const r = d.roll();
         expect(r.die1).toBeGreaterThanOrEqual(1);
         expect(r.die1).toBeLessThanOrEqual(6);
         expect(r.die2).toBeGreaterThanOrEqual(1);
         expect(r.die2).toBeLessThanOrEqual(6);
         expect(r.die1 + r.die2).toBe(r.sum);
       }
     });
  });
});
