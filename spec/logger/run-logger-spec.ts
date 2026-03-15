import { RunLogger, LoggerConfig } from '../../src/logger/run-logger';
import { CrapsEngine } from '../../src/engine/craps-engine';
import { StrategyDefinition } from '../../src/dsl/strategy';
import { RiggedDice } from '../dice/rigged-dice';
import { RollRecord } from '../../src/engine/roll-record';

// Minimal strategy for testing
const PassLineOnly: StrategyDefinition = ({ bets }) => {
  bets.passLine(10);
};

// Helper to build a minimal RollRecord for unit testing the logger in isolation
function makeRollRecord(overrides: Partial<RollRecord> = {}): RollRecord {
  return {
    rollNumber: 1,
    die1: 3,
    die2: 4,
    rollValue: 7,
    pointBefore: undefined,
    pointAfter: undefined,
    outcomes: [],
    bankrollBefore: 500,
    bankrollAfter: 510,
    activeBets: [{ type: 'passLine', point: null, amount: 10, odds: 0 }],
    tableLoadBefore: 10,
    tableLoadAfter: 0,
    ...overrides,
  };
}

function makeConfig(overrides: Partial<LoggerConfig> = {}): LoggerConfig {
  return {
    strategyName: 'TestStrategy',
    playerId: 'p1',
    initialBankroll: 500,
    seed: 42,
    ...overrides,
  };
}

describe('RunLogger', () => {

  describe('onRoll accumulation', () => {
    it('should count roll records', () => {
      const logger = new RunLogger(makeConfig());
      expect(logger.getRollCount()).toBe(0);

      logger.onRoll(makeRollRecord({ rollNumber: 1 }));
      logger.onRoll(makeRollRecord({ rollNumber: 2 }));

      expect(logger.getRollCount()).toBe(2);
    });

    it('should track final bankroll as the last roll bankrollAfter', () => {
      const logger = new RunLogger(makeConfig());
      logger.onRoll(makeRollRecord({ bankrollAfter: 520 }));
      logger.onRoll(makeRollRecord({ bankrollAfter: 495 }));

      expect(logger.getFinalBankroll()).toBe(495);
    });

    it('should track peak bankroll', () => {
      const logger = new RunLogger(makeConfig({ initialBankroll: 500 }));
      logger.onRoll(makeRollRecord({ bankrollAfter: 520 }));
      logger.onRoll(makeRollRecord({ bankrollAfter: 480 }));
      logger.onRoll(makeRollRecord({ bankrollAfter: 540 }));

      expect(logger.getPeakBankroll()).toBe(540);
    });

    it('should track trough bankroll', () => {
      const logger = new RunLogger(makeConfig({ initialBankroll: 500 }));
      logger.onRoll(makeRollRecord({ bankrollAfter: 520 }));
      logger.onRoll(makeRollRecord({ bankrollAfter: 460 }));
      logger.onRoll(makeRollRecord({ bankrollAfter: 540 }));

      expect(logger.getTroughBankroll()).toBe(460);
    });

    it('should compute max drawdown correctly', () => {
      const logger = new RunLogger(makeConfig({ initialBankroll: 500 }));
      // Peak at 600, trough to 400 = drawdown of 200
      logger.onRoll(makeRollRecord({ bankrollAfter: 600 }));
      logger.onRoll(makeRollRecord({ bankrollAfter: 400 }));
      logger.onRoll(makeRollRecord({ bankrollAfter: 580 }));

      expect(logger.getMaxDrawdown()).toBe(200);
    });

    it('should count rollsWithWin', () => {
      const logger = new RunLogger(makeConfig());
      logger.onRoll(makeRollRecord({
        outcomes: [{ result: 'win', betType: 1 as any, amount: 10, payout: 10 }],
      }));
      logger.onRoll(makeRollRecord({ outcomes: [] }));
      logger.onRoll(makeRollRecord({
        outcomes: [{ result: 'win', betType: 1 as any, amount: 10, payout: 10 }],
      }));

      expect(logger.getRollsWithWin()).toBe(2);
    });

    it('should count rollsWithLoss', () => {
      const logger = new RunLogger(makeConfig());
      logger.onRoll(makeRollRecord({
        outcomes: [{ result: 'loss', betType: 1 as any, amount: 10, payout: 0 }],
      }));
      logger.onRoll(makeRollRecord({ outcomes: [] }));

      expect(logger.getRollsWithLoss()).toBe(1);
    });
  });

  describe('dice distribution', () => {
    it('should accumulate bySum distribution', () => {
      const logger = new RunLogger(makeConfig());
      logger.onRoll(makeRollRecord({ rollValue: 7 }));
      logger.onRoll(makeRollRecord({ rollValue: 7 }));
      logger.onRoll(makeRollRecord({ rollValue: 6 }));

      const dist = logger.getDiceSumDistribution();
      expect(dist['7']).toBe(2);
      expect(dist['6']).toBe(1);
      expect(dist['8']).toBe(0);
    });

    it('should only count valid die face values (1-6)', () => {
      const logger = new RunLogger(makeConfig());
      // die1=0 is RiggedDice test-mode fallback — should NOT count in byDieFace
      logger.onRoll(makeRollRecord({ die1: 0, die2: 7, rollValue: 7 }));

      const summary = logger.buildSummary();
      // die1=0 is skipped, die2=7 is out of range, so all face counts should be 0
      for (let i = 1; i <= 6; i++) {
        expect(summary.diceDistribution.byDieFace[String(i)]).toBe(0);
      }
    });

    it('should count real die face values (1-6)', () => {
      const logger = new RunLogger(makeConfig());
      logger.onRoll(makeRollRecord({ die1: 3, die2: 4, rollValue: 7 }));

      const summary = logger.buildSummary();
      expect(summary.diceDistribution.byDieFace['3']).toBe(1);
      expect(summary.diceDistribution.byDieFace['4']).toBe(1);
      expect(summary.diceDistribution.byDieFace['1']).toBe(0);
    });
  });

  describe('buildSummary', () => {
    it('should produce correct bankroll fields', () => {
      const logger = new RunLogger(makeConfig({ initialBankroll: 500 }));
      logger.onRoll(makeRollRecord({ bankrollAfter: 520 }));
      logger.onRoll(makeRollRecord({ bankrollAfter: 490 }));

      const summary = logger.buildSummary();
      expect(summary.type).toBe('summary');
      expect(summary.bankroll.final).toBe(490);
      expect(summary.bankroll.peak).toBe(520);
      expect(summary.bankroll.trough).toBe(490);
      expect(summary.bankroll.netChange).toBe(-10);
    });

    it('should produce correct meta fields', () => {
      const logger = new RunLogger(makeConfig({ strategyName: 'TestStrategy', seed: 42 }));
      logger.onRoll(makeRollRecord());

      const summary = logger.buildSummary();
      expect(summary.meta.strategy).toBe('TestStrategy');
      expect(summary.meta.seed).toBe(42);
      expect(summary.meta.totalRolls).toBe(1);
      expect(summary.meta.startBankroll).toBe(500);
    });

    it('should include rollsNoAction as rolls where no outcome occurred', () => {
      const logger = new RunLogger(makeConfig());
      logger.onRoll(makeRollRecord({ outcomes: [] }));  // no action
      logger.onRoll(makeRollRecord({
        outcomes: [{ result: 'win', betType: 1 as any, amount: 10, payout: 10 }],
      }));
      logger.onRoll(makeRollRecord({ outcomes: [] }));  // no action

      const summary = logger.buildSummary();
      expect(summary.activity.rollsWithWin).toBe(1);
      expect(summary.activity.rollsNoAction).toBe(2);
    });
  });

  describe('JSONL output via flush', () => {
    it('should produce parseable JSONL for each roll plus a summary line', () => {
      const logger = new RunLogger(makeConfig());
      logger.onRoll(makeRollRecord({ rollNumber: 1 }));
      logger.onRoll(makeRollRecord({ rollNumber: 2 }));

      const lines: string[] = [];
      spyOn(console, 'log').and.callFake((msg: string) => lines.push(msg));

      logger.flush('json');

      // Should have 2 roll lines + 1 summary line
      expect(lines.length).toBe(3);

      // Each line should be valid JSON
      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow();
      }

      // First two lines should be roll entries
      const roll1 = JSON.parse(lines[0]);
      expect(roll1.type).toBe('roll');
      expect(roll1.roll.number).toBe(1);

      // Last line should be summary
      const summary = JSON.parse(lines[2]);
      expect(summary.type).toBe('summary');
    });

    it('should include per-roll player entries with correct structure', () => {
      const logger = new RunLogger(makeConfig({ playerId: 'alice', strategyName: 'TestStrategy' }));
      logger.onRoll(makeRollRecord({
        die1: 3, die2: 4, rollValue: 7,
        bankrollBefore: 500, bankrollAfter: 510,
        activeBets: [{ type: 'passLine', point: null, amount: 10, odds: 0 }],
        tableLoadBefore: 10, tableLoadAfter: 0,
        outcomes: [{ result: 'win', betType: 1 as any, amount: 10, payout: 10 }],
      }));

      const lines: string[] = [];
      spyOn(console, 'log').and.callFake((msg: string) => lines.push(msg));
      logger.flush('json');

      const entry = JSON.parse(lines[0]);
      expect(entry.roll.die1).toBe(3);
      expect(entry.roll.die2).toBe(4);
      expect(entry.roll.sum).toBe(7);

      const player = entry.players[0];
      expect(player.id).toBe('alice');
      expect(player.strategy).toBe('TestStrategy');
      expect(player.bankroll.before).toBe(500);
      expect(player.bankroll.after).toBe(510);
      expect(player.bankroll.change).toBe(10);
      expect(player.tableLoad.before).toBe(10);
      expect(player.tableLoad.betCount).toBe(1);
      expect(player.outcomes[0].result).toBe('win');
    });
  });

  describe('integration with CrapsEngine', () => {
    it('should receive roll records from CrapsEngine when logger is provided', () => {
      const logger = new RunLogger(makeConfig());
      const engine = new CrapsEngine({
        strategy: PassLineOnly,
        bankroll: 500,
        rolls: 3,
        dice: new RiggedDice([7, 4, 4]),
        logger,
      });

      engine.run();

      expect(logger.getRollCount()).toBe(3);
    });

    it('should compute correct summary after a full engine run', () => {
      const logger = new RunLogger(makeConfig({ initialBankroll: 500 }));
      const engine = new CrapsEngine({
        strategy: PassLineOnly,
        bankroll: 500,
        rolls: 3,
        dice: new RiggedDice([7, 7, 7]),  // 3 come-out wins
        logger,
      });

      engine.run();

      const summary = logger.buildSummary();
      expect(summary.meta.totalRolls).toBe(3);
      expect(summary.bankroll.final).toBe(530);  // 500 + 3 * 10
      expect(summary.bankroll.peak).toBe(530);
      expect(summary.activity.rollsWithWin).toBe(3);
      expect(summary.activity.rollsWithLoss).toBe(0);
    });

    it('should accumulate dice sum distribution from engine runs', () => {
      const logger = new RunLogger(makeConfig());
      const engine = new CrapsEngine({
        strategy: PassLineOnly,
        bankroll: 500,
        rolls: 3,
        dice: new RiggedDice([7, 6, 8]),
        logger,
      });

      engine.run();

      const dist = logger.getDiceSumDistribution();
      expect(dist['7']).toBe(1);
      expect(dist['6']).toBe(1);
      expect(dist['8']).toBe(1);
    });
  });
});
