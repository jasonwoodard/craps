import { RollRecord, ActiveBetInfo } from '../engine/roll-record';
import { Outcome } from '../dsl/outcome';
import { betTypeToString } from '../dsl/bet-reconciler';

export interface LoggerConfig {
  strategyName: string;
  playerId: string;
  initialBankroll: number;
  seed?: number;
}

// Per-roll JSONL entry matching the strategy-logging-spec schema.
interface RollEntry {
  type: 'roll';
  roll: { number: number; die1: number; die2: number; sum: number };
  gameState: { pointBefore: number | null; pointAfter: number | null };
  players: PlayerRollEntry[];
}

interface PlayerRollEntry {
  id: string;
  strategy: string;
  stageName?: string;
  bankroll: { before: number; after: number; change: number };
  tableLoad: { before: number; after: number; betCount: number };
  activeBets: ActiveBetInfo[];
  outcomes: OutcomeEntry[];
}

interface OutcomeEntry {
  type: string;
  point: number | null;
  result: 'win' | 'loss' | 'push';
  payout: number;
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
    rollsWithPush: number;
    rollsNoAction: number;
    winRate: number;
    lossRate: number;
    pushRate: number;
  };
  diceDistribution: {
    bySum: Record<string, number>;
    byDieFace: Record<string, number>;
  };
}

export class RunLogger {
  private config: LoggerConfig;
  private rollEntries: RollEntry[] = [];

  // Running stats
  private finalBankroll: number;
  private peakBankroll: number;
  private troughBankroll: number;
  private lastPeak: number;
  private maxDrawdown = 0;
  private rollsWithWin = 0;
  private rollsWithLoss = 0;
  private rollsWithPush = 0;
  private rollsNoAction = 0;
  private totalTableLoad = 0;
  private maxTableLoad = 0;
  private minTableLoad = Infinity;
  private totalTableLoadWhenActive = 0;
  private rollsWithActiveBets = 0;
  private bySum: Record<string, number> = {};
  private byDieFace: Record<string, number> = {};

  constructor(config: LoggerConfig) {
    this.config = config;
    this.finalBankroll = config.initialBankroll;
    this.peakBankroll = config.initialBankroll;
    this.troughBankroll = config.initialBankroll;
    this.lastPeak = config.initialBankroll;

    for (let i = 2; i <= 12; i++) this.bySum[String(i)] = 0;
    for (let i = 1; i <= 6; i++) this.byDieFace[String(i)] = 0;
  }

  onRoll(record: RollRecord): void {
    const entry = this.buildRollEntry(record);
    this.rollEntries.push(entry);
    this.updateStats(record);
  }

  private buildRollEntry(record: RollRecord): RollEntry {
    const outcomes: OutcomeEntry[] = record.outcomes.map(o => ({
      type: outcomeTypeName(o),
      point: o.point ?? null,
      result: o.result,
      payout: o.payout,
    }));

    return {
      type: 'roll',
      roll: {
        number: record.rollNumber,
        die1: record.die1,
        die2: record.die2,
        sum: record.rollValue,
      },
      gameState: {
        pointBefore: record.pointBefore ?? null,
        pointAfter: record.pointAfter ?? null,
      },
      players: [{
        id: this.config.playerId,
        strategy: this.config.strategyName,
        ...(record.stageName !== undefined ? { stageName: record.stageName } : {}),
        bankroll: {
          before: record.bankrollBefore,
          after: record.bankrollAfter,
          change: record.bankrollAfter - record.bankrollBefore,
        },
        tableLoad: {
          before: record.tableLoadBefore,
          after: record.tableLoadAfter,
          betCount: record.activeBets.length,
        },
        activeBets: record.activeBets,
        outcomes,
      }],
    };
  }

  private updateStats(record: RollRecord): void {
    this.finalBankroll = record.bankrollAfter;

    // Bankroll tracking
    if (record.bankrollAfter > this.peakBankroll) this.peakBankroll = record.bankrollAfter;
    if (record.bankrollAfter < this.troughBankroll) this.troughBankroll = record.bankrollAfter;

    // Max drawdown: largest peak-to-trough decline
    if (record.bankrollAfter > this.lastPeak) this.lastPeak = record.bankrollAfter;
    const drawdown = this.lastPeak - record.bankrollAfter;
    if (drawdown > this.maxDrawdown) this.maxDrawdown = drawdown;

    // Activity — each flag is independent; a roll can count in multiple categories
    // (e.g. loss + push on a ComeBet seven-out with odds OFF). noAction is strict:
    // only rolls with zero outcomes of any kind.
    const hasWin = record.outcomes.some(o => o.result === 'win');
    const hasLoss = record.outcomes.some(o => o.result === 'loss');
    const hasPush = record.outcomes.some(o => o.result === 'push');
    if (hasWin) this.rollsWithWin++;
    if (hasLoss) this.rollsWithLoss++;
    if (hasPush) this.rollsWithPush++;
    if (!hasWin && !hasLoss && !hasPush) this.rollsNoAction++;

    // Table load
    const load = record.tableLoadBefore;
    this.totalTableLoad += load;
    if (load > this.maxTableLoad) this.maxTableLoad = load;
    if (load < this.minTableLoad) this.minTableLoad = load;
    if (load > 0) {
      this.totalTableLoadWhenActive += load;
      this.rollsWithActiveBets++;
    }

    // Dice distribution — skip die1=0 (test-mode fallback from RiggedDice)
    const sum = record.rollValue;
    if (this.bySum[String(sum)] !== undefined) {
      this.bySum[String(sum)]++;
    }
    if (record.die1 >= 1 && record.die1 <= 6) {
      this.byDieFace[String(record.die1)]++;
    }
    if (record.die2 >= 1 && record.die2 <= 6) {
      this.byDieFace[String(record.die2)]++;
    }
  }

  buildSummary(): SummaryRecord {
    const totalRolls = this.rollEntries.length;
    const avgTableLoad = totalRolls > 0 ? this.totalTableLoad / totalRolls : 0;
    const avgWhenActive = this.rollsWithActiveBets > 0
      ? this.totalTableLoadWhenActive / this.rollsWithActiveBets
      : 0;

    return {
      type: 'summary',
      meta: {
        strategy: this.config.strategyName,
        startBankroll: this.config.initialBankroll,
        totalRolls,
        seed: this.config.seed ?? null,
        timestamp: new Date().toISOString(),
      },
      bankroll: {
        final: this.finalBankroll,
        peak: this.peakBankroll,
        trough: this.troughBankroll,
        maxDrawdown: this.maxDrawdown,
        netChange: this.finalBankroll - this.config.initialBankroll,
      },
      tableLoad: {
        avg: round2(avgTableLoad),
        max: this.maxTableLoad,
        min: this.minTableLoad === Infinity ? 0 : this.minTableLoad,
        avgWhenActive: round2(avgWhenActive),
      },
      activity: {
        rollsWithWin: this.rollsWithWin,
        rollsWithLoss: this.rollsWithLoss,
        rollsWithPush: this.rollsWithPush,
        rollsNoAction: this.rollsNoAction,
        winRate: totalRolls > 0 ? round4(this.rollsWithWin / totalRolls) : 0,
        lossRate: totalRolls > 0 ? round4(this.rollsWithLoss / totalRolls) : 0,
        pushRate: totalRolls > 0 ? round4(this.rollsWithPush / totalRolls) : 0,
      },
      diceDistribution: {
        bySum: { ...this.bySum },
        byDieFace: { ...this.byDieFace },
      },
    };
  }

  flush(outputMode: 'summary' | 'verbose' | 'json'): void {
    const summary = this.buildSummary();

    switch (outputMode) {
      case 'json':
        for (const entry of this.rollEntries) {
          console.log(JSON.stringify(entry));
        }
        console.log(JSON.stringify(summary));
        break;

      case 'verbose':
        for (const entry of this.rollEntries) {
          this.printRollEntry(entry);
        }
        this.printSummary(summary);
        break;

      case 'summary':
      default:
        this.printSummary(summary);
        break;
    }
  }

  private printRollEntry(entry: RollEntry): void {
    const r = entry.roll;
    const gs = entry.gameState;
    const p = entry.players[0];
    const pointStr = (n: number | null) => n != null ? String(n) : 'OFF';
    const phase = gs.pointBefore == null ? 'come-out' : 'point';

    console.log(`Roll #${r.number}: [${r.die1}+${r.die2}=${r.sum}]  point: ${pointStr(gs.pointBefore)} → ${pointStr(gs.pointAfter)}  [${phase}]`);
    console.log(`  bankroll: $${p.bankroll.before} → $${p.bankroll.after}  load: $${p.tableLoad.before}`);

    for (const o of p.outcomes) {
      const pointInfo = o.point != null ? ` (${o.point})` : '';
      console.log(`  ${o.result.toUpperCase()}: ${o.type}${pointInfo}  payout=$${o.payout}`);
    }
  }

  private printSummary(summary: SummaryRecord): void {
    const b = summary.bankroll;
    const a = summary.activity;
    const tl = summary.tableLoad;

    console.log('\n=== Simulation Summary ===');
    console.log(`Strategy:     ${summary.meta.strategy}`);
    console.log(`Seed:         ${summary.meta.seed ?? '(random)'}`);
    console.log(`Total rolls:  ${summary.meta.totalRolls}`);
    console.log('');
    console.log(`Bankroll:     $${summary.meta.startBankroll} → $${b.final}  (net: ${b.netChange >= 0 ? '+' : ''}$${b.netChange})`);
    console.log(`Peak:         $${b.peak}    Trough: $${b.trough}    Max drawdown: $${b.maxDrawdown}`);
    console.log('');
    console.log(`Win rolls:    ${a.rollsWithWin} (${(a.winRate * 100).toFixed(1)}%)`);
    console.log(`Loss rolls:   ${a.rollsWithLoss} (${(a.lossRate * 100).toFixed(1)}%)`);
    console.log(`Push rolls:   ${a.rollsWithPush} (${(a.pushRate * 100).toFixed(1)}%)`);
    console.log(`No action:    ${a.rollsNoAction}`);
    console.log('');
    console.log(`Table load:   avg $${tl.avg}  max $${tl.max}  avg-when-active $${tl.avgWhenActive}`);
  }

  // Accessors for testing
  getRollCount(): number { return this.rollEntries.length; }
  getRollEntries(): RollEntry[] { return [...this.rollEntries]; }
  getFinalBankroll(): number { return this.finalBankroll; }
  getPeakBankroll(): number { return this.peakBankroll; }
  getTroughBankroll(): number { return this.troughBankroll; }
  getMaxDrawdown(): number { return this.maxDrawdown; }
  getRollsWithWin(): number { return this.rollsWithWin; }
  getRollsWithLoss(): number { return this.rollsWithLoss; }
  getDiceSumDistribution(): Record<string, number> { return { ...this.bySum }; }
}

function round2(n: number): number { return Math.round(n * 100) / 100; }
function round4(n: number): number { return Math.round(n * 10000) / 10000; }

function outcomeTypeName(o: Outcome): string {
  return betTypeToString(o.betType) ?? 'unknown';
}
