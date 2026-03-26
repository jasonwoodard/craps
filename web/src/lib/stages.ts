import type { RollRecord } from '@shared/simulation';

export interface StageSpan {
  stageName: string;
  startRoll: number;
  endRoll: number;
  visitIndex: number; // 1st visit, 2nd visit, etc.
}

export interface StageVisitSummary {
  stageName: string;
  visitIndex: number;
  startRoll: number;
  endRoll: number;
  rollCount: number;
  entryBankroll: number;
  exitBankroll: number;
  netPnL: number;
  peakPnL: number;    // max bankrollAfter - entryBankroll within visit
  troughPnL: number;  // min bankrollAfter - entryBankroll within visit
  winRolls: number;
  lossRolls: number;
  sevenOuts: number;
}

// Defined once — imported by all components that need stage colors
export const STAGE_COLORS: Record<string, string> = {
  accumulatorFull: '#fef3c7',      // amber-100
  accumulatorRegressed: '#fffbeb', // amber-50
  littleMolly: '#dcfce7',          // green-100
  threePtMollyTight: '#dbeafe',    // blue-100
  threePtMollyLoose: '#e0e7ff',    // indigo-100
};

export const STAGE_LABELS: Record<string, string> = {
  accumulatorFull: 'Accumulator Full',
  accumulatorRegressed: 'Accumulator Regressed',
  littleMolly: 'Little Molly',
  threePtMollyTight: 'Three Pt Molly Tight',
  threePtMollyLoose: 'Three Pt Molly Loose',
};

export function hasStageData(rolls: RollRecord[]): boolean {
  return rolls.some(r => r.stageName != null);
}

export function computeStageSpans(rolls: RollRecord[]): StageSpan[] {
  const spans: StageSpan[] = [];
  const visitCounts: Record<string, number> = {};

  let i = 0;
  while (i < rolls.length) {
    const stageName = rolls[i].stageName;
    if (stageName == null) {
      i++;
      continue;
    }

    let j = i + 1;
    while (j < rolls.length && rolls[j].stageName === stageName) j++;

    visitCounts[stageName] = (visitCounts[stageName] ?? 0) + 1;

    spans.push({
      stageName,
      startRoll: rolls[i].rollNumber,
      endRoll: rolls[j - 1].rollNumber,
      visitIndex: visitCounts[stageName],
    });

    i = j;
  }

  return spans;
}

export function computeStageVisitSummaries(rolls: RollRecord[]): StageVisitSummary[] {
  const summaries: StageVisitSummary[] = [];
  const visitCounts: Record<string, number> = {};

  let i = 0;
  while (i < rolls.length) {
    const stageName = rolls[i].stageName;
    if (stageName == null) {
      i++;
      continue;
    }

    let j = i + 1;
    while (j < rolls.length && rolls[j].stageName === stageName) j++;

    const visitRolls = rolls.slice(i, j);
    visitCounts[stageName] = (visitCounts[stageName] ?? 0) + 1;

    const entryBankroll = visitRolls[0].bankrollBefore;
    const exitBankroll = visitRolls[visitRolls.length - 1].bankrollAfter;
    let peakPnL = -Infinity;
    let troughPnL = Infinity;
    let winRolls = 0;
    let lossRolls = 0;
    let sevenOuts = 0;

    for (const r of visitRolls) {
      const pnl = r.bankrollAfter - entryBankroll;
      if (pnl > peakPnL) peakPnL = pnl;
      if (pnl < troughPnL) troughPnL = pnl;
      if (r.outcomes.some(o => o.result === 'win')) winRolls++;
      if (r.outcomes.some(o => o.result === 'loss')) lossRolls++;
      if (r.pointBefore != null && r.rollValue === 7) sevenOuts++;
    }

    summaries.push({
      stageName,
      visitIndex: visitCounts[stageName],
      startRoll: visitRolls[0].rollNumber,
      endRoll: visitRolls[visitRolls.length - 1].rollNumber,
      rollCount: visitRolls.length,
      entryBankroll,
      exitBankroll,
      netPnL: exitBankroll - entryBankroll,
      peakPnL: peakPnL === -Infinity ? 0 : peakPnL,
      troughPnL: troughPnL === Infinity ? 0 : troughPnL,
      winRolls,
      lossRolls,
      sevenOuts,
    });

    i = j;
  }

  return summaries;
}
