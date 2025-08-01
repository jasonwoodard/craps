import { CrapsTable } from "./craps-table";
import { Player } from "./player";
import * as _ from "lodash";

export class CrapsGame {
  table: CrapsTable;
  players: Player[];

  constructor() {
    this.table = new CrapsTable();
    this.players = [];
  }

  registerPlayers(newPlayers: Player[]) {
    newPlayers.forEach(player => {
      this.table.onPlaceBets(player.placeBets);
      this.players.push(player);
    });
  }

  startGame(rollsToPlay: number): void {
    while (this.keepPlaying(this.players, this.table, rollsToPlay)) {
      this.playHand();
      rollsToPlay--;
    }
  }

  keepPlaying(
    players: Player[],
    table: CrapsTable,
    rollsToPlay: number
  ): boolean {
    // Do we have unresolved bets?
    let haveBets = table.bets.length > 0;

    // Look for one player with money.
    let playerBankroll = 0;
    players.forEach(player => {
      playerBankroll += player.bankRoll;
    });

    // Keep playing if we have bets OR there are rolls to play and players
    // who have money to bet.
    let output = haveBets || (rollsToPlay > 0 && playerBankroll > 0);

    return output;
  }

  playHand(): void {
    this.placeBets();
    this.table.rollDice();
    this.players.forEach(player => {
      player.resolveHand(this.table);
    });
  }

  placeBets(): void {
    this.players.forEach(player => {
      player.placeBets(this.table);
    });
  }
}
