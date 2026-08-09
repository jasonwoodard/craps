import { Outcome } from '../dsl/outcome';

export interface ActiveBetInfo {
  type: string;
  point: number | null;
  amount: number;
  odds: number;
}

export interface RollRecord {
  rollNumber: number;
  die1: number;
  die2: number;
  rollValue: number;
  pointBefore: number | undefined;
  pointAfter: number | undefined;
  outcomes: Outcome[];
  bankrollBefore: number;
  bankrollAfter: number;
  activeBets: ActiveBetInfo[];
  tableLoadBefore: number;
  tableLoadAfter: number;
  /** Stage after this roll's events settled (may reflect a transition
   *  triggered by the roll itself). */
  stageName?: string;
  /** Stage whose board() actually built the bets that played this roll —
   *  use this for per-stage attribution of results. */
  stagePlayed?: string;
}

export interface EngineResult {
  finalBankroll: number;
  initialBankroll: number;
  rollsPlayed: number;
  rolls: RollRecord[];
  /** True when the run stopped early via stopAtRuin: the strategy could no
   *  longer put a single bet on the felt. */
  endedAtRuin?: boolean;
}
