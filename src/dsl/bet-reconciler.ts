import { BaseBet as TableBaseBet, BetTypes } from '../bets/base-bet';
import { PassLineBet } from '../bets/pass-line-bet';
import { DontPassBet } from '../bets/dont-pass-bet';

export interface BetWithOdds {
  withOdds(amount: number): void;
  withMaxOdds(): void;
}

export interface BetReconciler {
  passLine(amount: number): BetWithOdds;
  come(amount: number): BetWithOdds;
  dontPass(amount: number): BetWithOdds;
  dontCome(amount: number): BetWithOdds;
  place(point: number, amount: number): void;
  field(amount: number): void;
  hardways(point: number, amount: number): void;
  remove(type: string, point?: number): void;
}

export interface DesiredBet {
  type: string;
  amount: number;
  point?: number;
  odds?: number;
}

const BET_TYPE_TO_STRING: Record<BetTypes, string> = {
  [BetTypes.UNKNOWN]: 'unknown',
  [BetTypes.PASS_LINE]: 'passLine',
  [BetTypes.COME]: 'come',
  [BetTypes.PLACE]: 'place',
  [BetTypes.FIELD]: 'field',
  [BetTypes.DONT_PASS]: 'dontPass',
  [BetTypes.DONT_COME]: 'dontCome',
};

const STRING_TO_BET_TYPE = new Map<string, BetTypes>(
  Object.entries(BET_TYPE_TO_STRING).map(([k, v]) => [v, Number(k) as BetTypes]),
);

export function stringToBetType(type: string): BetTypes | undefined {
  return STRING_TO_BET_TYPE.get(type);
}

export function betTypeToString(betType: BetTypes): string {
  return BET_TYPE_TO_STRING[betType] ?? 'unknown';
}

export function tableBetToDesired(bet: TableBaseBet): DesiredBet {
  const type = BET_TYPE_TO_STRING[bet.betType] ?? 'unknown';
  const desired: DesiredBet = { type, amount: bet.amount };
  if (bet.point != null) {
    desired.point = bet.point;
  }
  if (bet instanceof PassLineBet && bet.oddsAmount > 0) {
    desired.odds = bet.oddsAmount;
  }
  if (bet instanceof DontPassBet && bet.layOddsAmount > 0) {
    desired.odds = bet.layOddsAmount;
  }
  return desired;
}

export class SimpleBetReconciler implements BetReconciler {
  readonly desired: DesiredBet[] = [];

  private add(type: string, amount: number, point?: number): BetWithOdds {
    const bet: DesiredBet = { type, amount, point };
    this.desired.push(bet);
    return {
      withOdds: (odds: number) => { bet.odds = odds; },
      withMaxOdds: () => { /* noop for now */ },
    };
  }

  passLine(amount: number): BetWithOdds {
    return this.add('passLine', amount);
  }

  come(amount: number): BetWithOdds {
    return this.add('come', amount);
  }

  dontPass(amount: number): BetWithOdds {
    return this.add('dontPass', amount);
  }

  dontCome(amount: number): BetWithOdds {
    return this.add('dontCome', amount);
  }

  place(point: number, amount: number): void {
    this.add('place', amount, point);
  }

  field(amount: number): void {
    this.add('field', amount);
  }

  hardways(point: number, amount: number): void {
    this.add('hardways', amount, point);
  }

  remove(type: string, point?: number): void {
    this.desired.push({ type: `remove:${type}`, amount: 0, point });
  }
}

export function diffBets(current: DesiredBet[], desired: DesiredBet[]): BetCommand[] {
  const commands: BetCommand[] = [];
  const key = (b: DesiredBet) => `${b.type}:${b.point ?? ''}`;
  const currentMap = new Map(current.map(b => [key(b), b]));
  const desiredMap = new Map(desired.map(b => [key(b), b]));

  // removals
  for (const [k, cb] of currentMap) {
    if (!desiredMap.has(k)) {
      commands.push({ type: 'remove', betType: cb.type, point: cb.point });
    }
  }

  // additions / updates
  for (const [k, db] of desiredMap) {
    const cb = currentMap.get(k);
    if (!cb) {
      commands.push({ type: 'place', betType: db.type, amount: db.amount, point: db.point });
      if (db.odds) {
        commands.push({ type: 'updateOdds', betType: db.type, amount: db.odds, point: db.point });
      }
    } else if (cb.amount !== db.amount || cb.odds !== db.odds) {
      commands.push({ type: 'updateOdds', betType: db.type, amount: db.odds ?? 0, point: db.point });
    }
  }
  return commands;
}

export type BetCommand =
  | { type: 'place'; betType: string; amount: number; point?: number }
  | { type: 'remove'; betType: string; point?: number }
  | { type: 'updateOdds'; betType: string; amount: number; point?: number };
