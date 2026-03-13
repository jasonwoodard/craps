import { BetTypes } from '../bets/base-bet';

export interface Outcome {
  result: 'win' | 'loss';
  betType: BetTypes;
  point?: number;
  amount: number;
  payout: number;
}
