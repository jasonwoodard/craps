import type { EngineResult, RollRecord } from '@shared/simulation';

export interface SessionStats {
  totalRolls: number;
  netChange: number;
  peakBankroll: number;
  troughBankroll: number;
  maxDrawdown: number;
  winRolls: number;
  lossRolls: number;
  noActionRolls: number;
  avgTableLoad: number;
  maxTableLoad: number;
}

export function computeRollingPnL(rolls: RollRecord[], window: number = 24): number[] {
  return rolls.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    return rolls[i].bankrollAfter - rolls[start].bankrollBefore;
  });
}

// Resets on any win, not just after a hand completes — matches CATS step-down trigger logic.
export function computeConsecutiveSevenOuts(rolls: RollRecord[]): number[] {
  const result: number[] = [];
  let count = 0;
  for (const roll of rolls) {
    if (roll.pointBefore != null && roll.rollValue === 7) {
      count++;
    } else if (roll.outcomes.some(o => o.result === 'win')) {
      count = 0;
    }
    result.push(count);
  }
  return result;
}

function phantomPassLineValue(roll: RollRecord): number {
  const isComeOut = roll.pointBefore == null;
  if (isComeOut) {
    if (roll.rollValue === 7 || roll.rollValue === 11) return +1;  // natural
    if (roll.rollValue === 2 || roll.rollValue === 3 || roll.rollValue === 12) return -1;  // craps
    return 0;  // point established
  }
  // Point phase
  if (roll.rollValue === roll.pointBefore) return +1;  // point made
  if (roll.rollValue === 7) return -1;  // seven-out
  return 0;
}

/**
 * Compute a clamped phantom pass-line heat score in [-2, +2] for each roll.
 * Uses a centered window of ±halfWindow rolls (default ±4, max 9-roll window).
 * Window shrinks naturally at both edges — no padding.
 */
export function computeHeatScores(rolls: RollRecord[], halfWindow = 4): number[] {
  return rolls.map((_, r) => {
    const lo = Math.max(0, r - halfWindow);
    const hi = Math.min(rolls.length - 1, r + halfWindow);
    let sum = 0;
    for (let i = lo; i <= hi; i++) {
      sum += phantomPassLineValue(rolls[i]);
    }
    return Math.max(-2, Math.min(2, sum));
  });
}

export function computeSessionStats(result: EngineResult): SessionStats {
  const { rolls, initialBankroll, finalBankroll } = result;

  // Scan starts from roll 1 (index 0). The initial bankroll (pre-roll state)
  // is excluded so that peak, trough, and drawdown reflect only post-roll
  // bankroll values — matching the CLI logger output exactly.
  const firstBankroll = rolls.length > 0 ? rolls[0].bankrollAfter : initialBankroll;
  let peakBankroll = firstBankroll;
  let troughBankroll = firstBankroll;
  let lastPeak = firstBankroll;
  let maxDrawdown = 0;
  let winRolls = 0;
  let lossRolls = 0;
  let totalTableLoad = 0;
  let maxTableLoad = 0;

  for (const roll of rolls) {
    if (roll.bankrollAfter > peakBankroll) peakBankroll = roll.bankrollAfter;
    if (roll.bankrollAfter < troughBankroll) troughBankroll = roll.bankrollAfter;

    if (roll.bankrollAfter > lastPeak) lastPeak = roll.bankrollAfter;
    const drawdown = lastPeak - roll.bankrollAfter;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;

    const hasWin = roll.outcomes.some(o => o.result === 'win');
    const hasLoss = roll.outcomes.some(o => o.result === 'loss');
    if (hasWin) winRolls++;
    if (hasLoss) lossRolls++;

    totalTableLoad += roll.tableLoadBefore;
    if (roll.tableLoadBefore > maxTableLoad) maxTableLoad = roll.tableLoadBefore;
  }

  const totalRolls = rolls.length;
  const noActionRolls = totalRolls - winRolls - lossRolls;
  const avgTableLoad = totalRolls > 0 ? Math.round((totalTableLoad / totalRolls) * 100) / 100 : 0;

  return {
    totalRolls,
    netChange: finalBankroll - initialBankroll,
    peakBankroll,
    troughBankroll,
    maxDrawdown,
    winRolls,
    lossRolls,
    noActionRolls,
    avgTableLoad,
    maxTableLoad,
  };
}
