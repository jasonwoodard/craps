import { Dice, LiveDice } from '../dice/dice';

export type RollListener = (roll: number) => void;

export class GameState {
  point: number | null = null;
  dice: Dice;

  private rollListeners: RollListener[] = [];
  private pointEstablishedListeners: RollListener[] = [];
  private pointClearedListeners: RollListener[] = [];

  constructor(dice: Dice = new LiveDice()) {
    this.dice = dice;
  }

  roll(): number {
    const value = this.dice.roll();
    this.rollListeners.forEach(l => l(value));
    if (this.point === null) {
      if ([4,5,6,8,9,10].includes(value)) {
        this.point = value;
        this.pointEstablishedListeners.forEach(l => l(value));
      }
    } else {
      if (value === 7 || value === this.point) {
        this.point = null;
        this.pointClearedListeners.forEach(l => l(value));
      }
    }
    return value;
  }

  onRoll(l: RollListener): void { this.rollListeners.push(l); }
  onPointEstablished(l: RollListener): void { this.pointEstablishedListeners.push(l); }
  onPointCleared(l: RollListener): void { this.pointClearedListeners.push(l); }
}
