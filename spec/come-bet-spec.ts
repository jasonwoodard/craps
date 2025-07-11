import { ComeBet } from '../src/bets/come-bet';
import { Player } from '../src/player';
import { CrapsTable } from '../src/craps-table';
import { TableMaker } from './table-maker/table-maker';

describe('ComeBet', () => {
  let comeBet: ComeBet;
  let player: Player;
  let betAmount: number = 10;

  beforeEach(() => {
    player = new Player();
    comeBet = new ComeBet(betAmount, player.playerId);
  });

  it('should not set the ComeBet point unless the table point is on', () => {
    let table: CrapsTable = TableMaker.getTable().value();
    expect(comeBet.point).toBeUndefined();
    comeBet.evaluateDiceRoll(5, table);
    // Rolling a valid point should not cause the point to set if the table 
    // point is not set.
    expect(comeBet.point).toBeUndefined();
  });

  it('should indicate okToPlace only when the point is on', () =>{
    let table = TableMaker.getTable().withPoint(10).value();
    expect(ComeBet.isOkayToPlace(table)).toBe(true);

    table = TableMaker.getTable().value();
    expect(ComeBet.isOkayToPlace(table)).toBe(false);
  })
});