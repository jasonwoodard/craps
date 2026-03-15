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
}

export interface EngineResult {
  finalBankroll: number;
  initialBankroll: number;
  rollsPlayed: number;
  rolls: RollRecord[];
}
