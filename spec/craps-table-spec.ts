import { CrapsTable } from '../src/craps-table';
import { PassLineBet } from '../src/bets/pass-line-bet';
import { TableMaker } from './table-maker/table-maker';
import * as _ from 'lodash';

describe('CrapsGame', (): void => {
  let table : CrapsTable;

  let points = [4,5,6,8,9,10];

  let getNewTable = function() {
    return new CrapsTable();
  };

  beforeEach(() => {
    table = getNewTable();
  });

  it('should instance', () => {
    expect(table).toBeDefined();
  });

  it('should know if the point is on', () =>{
    expect(table.isPointOn).toBe(false);
  });

  it('should allow you to place a pass line bet', () => {
    expect(table.bets.length).toBe(0);
    table.placeBet(new PassLineBet(1, ''));
    expect(table.bets.length).toBe(1);
  });

  it('should be able to returns bets by player', () => {
    let pid1 = 'player1'
    let betP1 = new PassLineBet(1, pid1);
    table.placeBet(betP1);
    table.placeBet(new PassLineBet(2, 'player2'))
    expect(table.getPlayerBets(pid1)).toEqual([betP1]);
  });

  it('should take bets on 2,3,12 when point is off', ()=> {
    let crapsRolled = function(rollValue : number) {
      table.placeBet(new PassLineBet(1, ''));
      table.resolveBets(rollValue);
      expect(table.bets.length).toBe(0);
    }

    crapsRolled(2);
    crapsRolled(3);
    crapsRolled(12);
  });

  it('should have the last roll', () => {
    table = TableMaker.getTable().withRiggedDice(_.range(2, 13)).value();

    expect(table.getLastRoll()).toBeUndefined();

    table.rollDice();
    expect(table.getLastRoll()).toBe(2);

    table.rollDice();
    expect(table.getLastRoll()).toBe(3);

    table.rollDice()
    expect(table.getLastRoll()).toBe(4);
  });

  it('should set the point on when a 4,5,6,8,9,10 is rolled', () =>{

    let pointRolled = function(rollValue: number){
      table = getNewTable();
      expect(table.isPointOn).toBe(false);
      expect(table.currentPoint).toBeUndefined();
      table.placeBet(new PassLineBet(1, ''));
      spyOn(table.dice, 'roll').and.returnValue({ die1: 0, die2: rollValue, sum: rollValue });
      table.rollDice();
      expect(table.isPointOn).toBe(true);
      expect(table.currentPoint).toBe(rollValue);
    }

    points.forEach(pointRolled);
  })

  it('should set the point off when the current point it rolled', () => {

    let pointSetAndMade = function(pointValue: number) {
      table = getNewTable();
      // Confirm point is NOT set.
      expect(table.isPointOn).toBe(false);
      // Establish the point
      spyOn(table.dice, 'roll').and.returnValue({ die1: 0, die2: 4, sum: 4 });
      table.rollDice();
      // Confirm Point is set.
      expect(table.isPointOn).toBe(true);
      expect(table.currentPoint).toBe(4);
      // Hit the point.
      table.rollDice();
      expect(table.isPointOn).toBe(false);
      expect(table.currentPoint).toBe(undefined);
    }

    points.forEach(pointSetAndMade);
  });

  it('should clear the point when a 7 is rolled', () => {
    let table = TableMaker.getTable().withRiggedDice([7]).withPoint(10).value();
    expect(table.isPointOn).toBe(true);
    expect(table.currentPoint).toBe(10);

    table.rollDice();

    expect(table.getLastRoll()).toBe(7);
    expect(table.isPointOn).toBe(false);
    expect(table.currentPoint).toBeUndefined();
  })

  it('should zero out and remove lost bets', () => {
    let table =
      TableMaker.getTable().withPoint(6).withRiggedDice([7]).value();
    let bet = new PassLineBet(10, 'player');
    spyOn(bet, 'lose').and.callThrough();
    bet.oddsAmount = 50;
    table.placeBet(bet);
    table.rollDice();
    expect(bet.lose).toHaveBeenCalled();
    expect(bet.amount).toBe(0);
    expect(bet.oddsAmount).toBe(0);
    expect(table.bets.length).toBe(0);
  });

  it('should callback won bets upon making point', () => {
    let table = TableMaker.getTable()
      .withPoint(6)
      .withRiggedDice([6]).value();
    let bet = new PassLineBet(10, 'player')
    bet.point = 6;
    spyOn(bet, 'win').and.stub();
    table.placeBet(bet);
    expect(table.currentPoint).toBe(6);
    expect(table.bets.length).toBe(1)

    table.rollDice();
    expect(bet.win).toHaveBeenCalled();
  });

  it('should callback won bets on 7 if there is no point', ()  => {
    let table = TableMaker.getTable().withRiggedDice([7]).value();
    let bet = new PassLineBet(10, 'player');
    spyOn(bet, 'win').and.stub();
    table.placeBet(bet);
    expect(table.currentPoint).toBeUndefined();
    table.rollDice();
    expect(bet.win).toHaveBeenCalledWith(table);
  });

  it('should callback won bets on 11 if there is no point', ()  => {
    let table = TableMaker.getTable().withRiggedDice([11]).value();
    let bet = new PassLineBet(10, 'player');
    spyOn(bet, 'win').and.stub();
    table.placeBet(bet);
    expect(table.currentPoint).toBeUndefined();
    table.rollDice();
    expect(bet.win).toHaveBeenCalledWith(table);
  });
});
