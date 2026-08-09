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
  ce(amount: number): void;
  lay(point: number, amount: number): void;
  buy(point: number, amount: number): void;
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
  [BetTypes.BUY]: 'buy',
  [BetTypes.LAY]: 'lay',
  [BetTypes.HARDWAYS]: 'hardways',
  [BetTypes.CE]: 'ce',
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

  ce(amount: number): void {
    this.add('ce', amount);
  }

  lay(point: number, amount: number): void {
    this.add('lay', amount, point);
  }

  buy(point: number, amount: number): void {
    this.add('buy', amount, point);
  }

  remove(type: string, point?: number): void {
    this.desired.push({ type: `remove:${type}`, amount: 0, point });
  }
}

/**
 * Bet types whose flat amount is adjustable between rolls: the bet can be
 * taken down and re-placed at a new amount. Contract bets (pass/come and
 * their don't counterparts) are excluded — only their odds are adjustable.
 */
const RESIZABLE_TYPES = new Set(['place', 'field', 'hardways', 'ce', 'lay', 'buy']);

/**
 * Come and Don't Come are contract bets that acquire a point when they travel,
 * but a desired `come(10)` declaration can never name a point — keyed matching
 * would tear a traveled bet down (refunding a contract bet) on the very next
 * roll. They are instead matched as a pool:
 *
 *   - Traveled bets (point set) are contracts: never removed, flat never
 *     resized. Each consumes one declaration, in declaration order, and takes
 *     that declaration's odds (odds go ON after travel, as at a real table).
 *   - Leftover declarations maintain in-transit bets: excess transit bets are
 *     removed, missing ones placed — at most ONE new bet per reconcile (the
 *     come box holds one bet per player per roll, so a multi-point board
 *     builds up one number at a time, as in live play). New transit bets
 *     carry NO odds — odds cannot legally exist on a come bet before it
 *     travels.
 *   - A traveled bet with no declaration left (strategy stepped down) keeps
 *     its flat riding (contract) but has its odds taken down.
 */
function diffContractPool(
  type: string,
  current: DesiredBet[],
  declarations: DesiredBet[],
  commands: BetCommand[],
): void {
  const traveled = current.filter(b => b.point != null);
  const transit = current.filter(b => b.point == null);

  let di = 0;
  for (const tb of traveled) {
    const decl = declarations[di++];
    const wantOdds = decl ? (decl.odds ?? 0) : 0;
    if ((tb.odds ?? 0) !== wantOdds) {
      commands.push({ type: 'updateOdds', betType: type, amount: wantOdds, point: tb.point });
    }
  }

  for (const trb of transit) {
    const decl = declarations[di++];
    if (!decl) {
      commands.push({ type: 'remove', betType: type });
    } else if (trb.amount !== decl.amount) {
      commands.push({ type: 'remove', betType: type });
      commands.push({ type: 'place', betType: type, amount: decl.amount });
    }
  }

  if (di < declarations.length) {
    commands.push({ type: 'place', betType: type, amount: declarations[di].amount });
  }
}

const CONTRACT_POOL_TYPES = ['come', 'dontCome'];

export function diffBets(current: DesiredBet[], desired: DesiredBet[]): BetCommand[] {
  const commands: BetCommand[] = [];

  for (const type of CONTRACT_POOL_TYPES) {
    diffContractPool(
      type,
      current.filter(b => b.type === type),
      desired.filter(b => b.type === type),
      commands,
    );
  }

  const key = (b: DesiredBet) => `${b.type}:${b.point ?? ''}`;
  const isPooled = (b: DesiredBet) => CONTRACT_POOL_TYPES.includes(b.type);
  const currentMap = new Map(current.filter(b => !isPooled(b)).map(b => [key(b), b]));
  const desiredMap = new Map(desired.filter(b => !isPooled(b)).map(b => [key(b), b]));

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
    } else if (cb.amount !== db.amount && RESIZABLE_TYPES.has(db.type)) {
      // Flat-amount change on a non-contract bet: take it down and re-place
      // at the new amount (e.g. Place 6/8 regression $18 → $12).
      commands.push({ type: 'remove', betType: cb.type, point: cb.point });
      commands.push({ type: 'place', betType: db.type, amount: db.amount, point: db.point });
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

/**
 * Decides whether an updateOdds command applies to a given table bet.
 * Shared by CrapsEngine and SharedTable so odds-legality rules stay in sync.
 *
 *   - come/dontCome with a point: targets the traveled bet on that point whose
 *     odds differ from the command amount (skips already-correct duplicates
 *     when two bets share a point).
 *   - come/dontCome without a point: targets in-transit bets only.
 *   - passLine/dontPass: odds may only be INCREASED while the table point is
 *     ON — odds cannot legally exist during the come-out roll. Decreases
 *     (taking odds down) are always allowed. A dropped increase is re-issued
 *     by the next reconcile once a point is established.
 */
export function oddsCommandMatchesBet(
  cmd: { betType: string; amount: number; point?: number },
  bet: TableBaseBet,
  table: { isPointOn: boolean },
): boolean {
  const currentOdds =
    bet instanceof PassLineBet ? bet.oddsAmount :
    bet instanceof DontPassBet ? bet.layOddsAmount :
    0;

  if (cmd.betType === 'come' || cmd.betType === 'dontCome') {
    if (cmd.point != null) {
      return bet.point === cmd.point && currentOdds !== cmd.amount;
    }
    return bet.point == null;
  }

  if (cmd.point != null && bet.point !== cmd.point) return false;
  if (cmd.amount > currentOdds && !table.isPointOn) return false;
  return true;
}
