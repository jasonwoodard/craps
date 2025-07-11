import { CrapsTable } from './src/craps-table';
import { PassLineBet } from './src/bets/pass-line-bet';

const table = new CrapsTable();
const playerId = 'player1';
const bet = new PassLineBet(10, playerId);

// place initial pass line bet
table.placeBet(bet);

let rolls = 0;
while (rolls < 500) {
  rolls++;
  table.rollDice();
  const lastRoll = table.getLastRoll();
  // establish odds when point becomes active
  if (table.isPointOn && bet.point === undefined) {
    bet.point = table.currentPoint;
    bet.oddsAmount = 50;
  }
  console.log(`Roll ${rolls}: rolled ${lastRoll} | point: ${table.currentPoint ?? 'off'} | bet amount: ${bet.amount} | odds: ${bet.oddsAmount} | payout: ${bet.payOut}`);
  if (bet.payOut > 0 || bet.amount === 0) {
    break;
  }
}

if (bet.payOut > 0) {
  console.log(`Bet won after ${rolls} rolls with payout $${bet.payOut}`);
} else if (bet.amount === 0) {
  console.log(`Bet lost after ${rolls} rolls.`);
} else {
  console.log(`Stopped after ${rolls} rolls with unresolved bet.`);
}
