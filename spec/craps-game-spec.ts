import { CrapsGame } from "../src/craps-game";
import { Player } from "../src/player";
import { TableMaker } from "./table-maker/table-maker";
import * as _ from "lodash";
import { PassLineBet } from "../src/bets/pass-line-bet";

describe("CrapsGame", () => {
  let game: CrapsGame;

  beforeEach(() => {
    game = new CrapsGame();
  });

  it("should register players", () => {
    let players = [Player.getPlayer()];
    game.registerPlayers(players);
    expect(game.players).toBeDefined();
    expect(game.players.length).toBe(1);
    let player = game.players[0];
    expect(player).toBeDefined();
    expect(player.playerId).toBeDefined();
  });

  it("should start the game and players should place bets", () => {
    let player = new Player();
    player.strategy.bets = [new PassLineBet(10, player.playerId)];
    player.bankRoll = 1000;

    game.registerPlayers([player]);
    spyOn(game.table, "placeBet").and.stub();

    // Confirm we have some players.
    expect(game.players.length).toBeGreaterThan(0);

    //Start the game, players should bet.
    game.startGame(1);
    expect(game.table.placeBet).toHaveBeenCalled();
  });

  it("should play one hand (roll)", () => {
    let dieRollCount = game.table.dice.rollHistory.length;
    let player = new Player();

    spyOn(player, "placeBets").and.callThrough();
    spyOn(player, "resolveHand").and.stub();
    spyOn(game.table, "resolveBets").and.callThrough();
    spyOn(game.table, "rollDice").and.callThrough();

    game.registerPlayers([player]);
    game.playHand();

    expect(player.placeBets).toHaveBeenCalledTimes(1);
    expect(game.table.rollDice).toHaveBeenCalledTimes(1);
    expect(player.resolveHand).toHaveBeenCalledTimes(1);
    expect(game.table.dice.rollHistory.length).toBeGreaterThan(dieRollCount);
    expect(game.table.resolveBets).toHaveBeenCalledTimes(1);
  });

  describe("KeepPlaying", () => {
    let player: Player;

    beforeEach(() => {
      player = new Player();
    });

    it("should indicate stop playing when rolls are up and no bets", () => {
      player.bankRoll = 1;
      expect(game.table.bets).toEqual([]);
      expect(game.keepPlaying([player], game.table, 0)).toBe(false);
    });

    it("should indicate keep playing when roll count expired but bets are unresolved", () => {
      player.bankRoll = 0;
      let bet = new PassLineBet(10, player.playerId);
      game.table.placeBet(bet);
      expect(game.table.bets).toEqual([bet]);
      expect(game.keepPlaying([player], game.table, 0)).toBe(true);
    });

    it("should indicate stop if no players have money", () => {
      // This tests the keepPlaying method which should REALLY
      // be private.
      let table = TableMaker.getTable().value();
      let player = new Player();
      player.bankRoll = 10;

      expect(game.keepPlaying([player], table, 10)).toBe(true);

      player.bankRoll = 0;
      expect(game.keepPlaying([player], table, 10)).toBe(false);
    });

    it("should indicate keep playing if there are unresolved bets", () => {
      // This tests the keepPlaying method which should REALLY
      // be private.
      let player = new Player();
      let bet = new PassLineBet(10, player.playerId);
      game.table.placeBet(bet);

      player.bankRoll = 0;

      expect(game.keepPlaying([player], game.table, 10)).toBe(true);

      // Should work regardless of bankroll
      player.bankRoll = 10;
      expect(game.keepPlaying([player], game.table, 10)).toBe(true);
    });
  });

  it("should stop the game after x rolls", () => {
    let player = new Player();
    player.bankRoll = 100;
    game.registerPlayers([player]);
    spyOn(game, "playHand").and.stub();
    game.startGame(2);
    expect(game.playHand).toHaveBeenCalledTimes(2);
  });

  it("should stop game when players are out of money", () => {
    let player = new Player();
    player.bankRoll = 10;
    spyOn(game, "playHand").and.callFake(() => {
      player.bankRoll = 0;
    });

    game.registerPlayers([player]);
    game.startGame(20);
    expect(game.playHand).toHaveBeenCalledTimes(1);
  });

  it(
    "should keep going as long as there is a bet " +
      "and hand limit not reached",
    () => {
      let player = new Player();
      player.bankRoll = 0;
      game.registerPlayers([player]);

      let bet = new PassLineBet(10, player.playerId);
      bet.point = 5;

      let table = TableMaker.getTable()
        .withPoint(5)
        .withRiggedDice([6, 8, 7])
        .value();
      spyOn(table, "rollDice").and.callThrough();
      game.table = table;
      game.table.placeBet(bet);

      expect(player.bankRoll).toBe(0);
      expect(game.table.bets.length).toBe(1);

      spyOn(game, "playHand").and.callThrough();
      game.startGame(10);

      expect(game.playHand).toHaveBeenCalledTimes(3);
      expect(table.rollDice).toHaveBeenCalledTimes(3);
    }
  );

  it("should resolve all bets even if hand limit has passed", () => {
    let player = new Player();
    player.bankRoll = 0;
    game.registerPlayers([player]);

    let bet = new PassLineBet(10, player.playerId);

    let diceRolls = [6, 8, 12, 2, 7];

    let table = TableMaker.getTable()
      .withPoint(5)
      .withRiggedDice(diceRolls)
      .value();
    game.table = table;
    table.placeBet(bet);

    spyOn(game, "playHand").and.callThrough();
    game.startGame(1);

    expect(game.playHand).toHaveBeenCalledTimes(5);
  });
});
