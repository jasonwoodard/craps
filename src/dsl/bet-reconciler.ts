import { BaseBet, OddsBet, ComeBet } from './player-state';

export interface BetWithOdds {
  withOdds(amount: number): void;
  withMaxOdds(): void;
}

export interface BetReconciler {
  passLine(amount: number): BetWithOdds;
  come(amount: number): BetWithOdds;
  place(point: number, amount: number): void;
  field(amount: number): void;
  hardways(point: number, amount: number): void;
  remove(type: string, point?: number): void;
}

interface DesiredBet {
  type: string;
  amount: number;
  point?: number;
  odds?: number;
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
