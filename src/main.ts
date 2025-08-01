import { CrapsGame } from './craps-game';
import { Player } from './player';

let player = new Player();
player.playerId = 'jason';
player.bankRoll = 300;

let game = new CrapsGame();
game.registerPlayers([player]);

game.startGame(100);

console.log('player', player);
console.log(game.table.dice.rollHistory);
