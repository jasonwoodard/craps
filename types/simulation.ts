// Shared type definitions for server/ and web/ consumers.
// These mirror the engine types structurally; source of truth is src/engine/.
// Using standalone definitions avoids importing engine source (which uses
// constructs incompatible with the web's strict tsconfig settings).

export interface ActiveBetInfo {
  type: string;
  point: number | null;
  amount: number;
  odds: number;
}

export interface Outcome {
  result: 'win' | 'loss';
  betType: number;
  point?: number;
  amount: number;
  payout: number;
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
  stageName?: string;
}

export interface EngineResult {
  finalBankroll: number;
  initialBankroll: number;
  rollsPlayed: number;
  rolls: RollRecord[];
  seed?: number;
}

export interface SummaryRecord {
  type: 'summary';
  meta: {
    strategy: string;
    startBankroll: number;
    totalRolls: number;
    seed: number | null;
    timestamp: string;
  };
  bankroll: {
    final: number;
    peak: number;
    trough: number;
    maxDrawdown: number;
    netChange: number;
  };
  tableLoad: {
    avg: number;
    max: number;
    min: number;
    avgWhenActive: number;
  };
  activity: {
    rollsWithWin: number;
    rollsWithLoss: number;
    rollsNoAction: number;
    winRate: number;
    lossRate: number;
  };
  diceDistribution: {
    bySum: Record<string, number>;
    byDieFace: Record<string, number>;
  };
}

export interface SharedTableResult {
  [strategyName: string]: {
    finalBankroll: number;
    netChange: number;
    log: RollRecord[];
    summary: SummaryRecord;
  };
}

export interface DistributionAggregates {
  p10: number[];
  p50: number[];
  p90: number[];
  finalBankroll: { p10: number; p50: number; p90: number; mean: number };
  peakBankroll:  { p10: number; p50: number; p90: number; mean: number };
  rollsToPeak:   { p10: number; p50: number; p90: number; mean: number };
  ruinByRoll:    number[];
  winRate:       number;
  ruinRate:      number;
  seedCount:     number;
}
