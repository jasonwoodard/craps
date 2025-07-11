import { GameState } from '../../src/dsl/game-state';
import { Dice } from '../../src/dice/dice';

class StubDice implements Dice {
  rollHistory: number[] = [];
  constructor(private values: number[]) {}
  roll() {
    const v = this.values.shift()!;
    this.rollHistory.push(v);
    return v;
  }
}

describe('GameState', () => {
  it('establishes and clears the point with events', () => {
    const dice = new StubDice([4, 7]);
    const game = new GameState(dice);
    let established = 0;
    let cleared = 0;
    game.onPointEstablished(v => { established = v; });
    game.onPointCleared(v => { cleared = v; });

    expect(game.point).toBeNull();
    game.roll();
    expect(established).toBe(4);
    expect(game.point).toBe(4);
    game.roll();
    expect(cleared).toBe(7);
    expect(game.point).toBeNull();
  });
});
