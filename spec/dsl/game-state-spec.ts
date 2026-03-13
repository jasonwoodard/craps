import { GameState } from '../../src/dsl/game-state';
import { RiggedDice } from '../dice/rigged-dice';

describe('GameState', () => {
  it('establishes and clears the point with events', () => {
    const dice = new RiggedDice([4, 7]);
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
