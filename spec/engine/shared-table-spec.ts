import { SharedTable } from '../../src/engine/shared-table';
import { StrategyDefinition } from '../../src/dsl/strategy';
import { RiggedDice } from '../dice/rigged-dice';

// --- Strategy fixtures ---

const PassLineOnly: StrategyDefinition = ({ bets }) => {
  bets.passLine(10);
};

const Place6And8: StrategyDefinition = ({ bets }) => {
  bets.place(6, 12);
  bets.place(8, 12);
};

describe('SharedTable', () => {

  describe('dice identity', () => {
    it('both strategies see identical (die1, die2, rollValue) at every roll index (CUJ 4.1)', () => {
      // Sequence: 5 (point), 7 (seven-out), 8 (point), 8 (point made), 6 (point), 6 (point made)
      const rolls = [5, 7, 8, 8, 6, 6];
      const dice = new RiggedDice(rolls);
      const table = new SharedTable({ rolls: rolls.length, dice });

      table.addStrategy('PassLine', PassLineOnly, { bankroll: 500 });
      table.addStrategy('Place68',  Place6And8,  { bankroll: 500 });

      const results = table.run();

      const passLog  = results['PassLine'].log;
      const placeLog = results['Place68'].log;

      expect(passLog.length).toBe(rolls.length);
      expect(placeLog.length).toBe(rolls.length);

      for (let i = 0; i < rolls.length; i++) {
        expect(placeLog[i].die1).toBe(passLog[i].die1);
        expect(placeLog[i].die2).toBe(passLog[i].die2);
        expect(placeLog[i].rollValue).toBe(passLog[i].rollValue);
      }
    });

    it('both strategies see identical pointBefore/pointAfter transitions', () => {
      // 5 (point established), 5 (point made) → come-out again
      const rolls = [5, 5];
      const dice = new RiggedDice(rolls);
      const table = new SharedTable({ rolls: rolls.length, dice });

      table.addStrategy('A', PassLineOnly, { bankroll: 500 });
      table.addStrategy('B', PassLineOnly, { bankroll: 500 });

      const results = table.run();

      for (let i = 0; i < rolls.length; i++) {
        expect(results['A'].log[i].pointBefore).toBe(results['B'].log[i].pointBefore);
        expect(results['A'].log[i].pointAfter).toBe(results['B'].log[i].pointAfter);
      }
    });
  });

  describe('bankroll independence', () => {
    it('strategies with different bets end at different bankrolls on the same dice', () => {
      // Roll sequence: 8 (point), 8 (point made)
      // PassLine: places $10 on come-out; point 8 made → wins $10 flat. Final: 500 - 10 + 10 + 10 = 510.
      // Place68: places $12 on 6 and $12 on 8; point 8 made → Place8 wins $26 payout, Place6 remains.
      //          Final: 500 - 24 + 26 = 502.
      const rolls = [8, 8];
      const dice = new RiggedDice(rolls);
      const table = new SharedTable({ rolls: rolls.length, dice });

      table.addStrategy('PassLine', PassLineOnly, { bankroll: 500 });
      table.addStrategy('Place68',  Place6And8,  { bankroll: 500 });

      const results = table.run();

      expect(results['PassLine'].finalBankroll).toBe(510);
      expect(results['Place68'].finalBankroll).toBe(502);
      expect(results['PassLine'].netChange).toBe(results['PassLine'].finalBankroll - 500);
      expect(results['Place68'].netChange).toBe(results['Place68'].finalBankroll - 500);
    });

    it('a win for PassLine does not affect Place68 bankroll and vice versa', () => {
      // Come-out 7 (natural): PassLine wins.
      // Place68: places $12 on 6 and $12 on 8 (place bets are "off" on come-out — no resolution).
      // PassLine: 500 - 10 (bet) + 10 (returned) + 10 (profit) = 510.
      // Place68:  500 - 12 - 12 = 476 (bets placed but no win/loss on come-out 7).
      const dice = new RiggedDice([7]);
      const table = new SharedTable({ rolls: 1, dice });

      table.addStrategy('PassLine', PassLineOnly, { bankroll: 500 });
      table.addStrategy('Place68',  Place6And8,  { bankroll: 500 });

      const results = table.run();

      // PassLine wins the natural 7
      expect(results['PassLine'].finalBankroll).toBe(510);
      // Place68 placed bets ($24 total) but they were off on come-out — no credits from PassLine's win
      expect(results['Place68'].finalBankroll).toBe(476);
    });
  });

  describe('roll count parity', () => {
    it('all strategy log arrays have the same length', () => {
      const rolls = [4, 5, 6, 7, 8, 9, 10];
      const dice = new RiggedDice(rolls);
      const table = new SharedTable({ rolls: rolls.length, dice });

      table.addStrategy('A', PassLineOnly, { bankroll: 500 });
      table.addStrategy('B', Place6And8,  { bankroll: 500 });

      const results = table.run();

      expect(results['A'].log.length).toBe(results['B'].log.length);
      expect(results['A'].log.length).toBe(rolls.length);
    });

    it('respects maxRolls', () => {
      const table = new SharedTable({ seed: 42, rolls: 50 });
      table.addStrategy('A', PassLineOnly, { bankroll: 500 });
      const results = table.run();
      expect(results['A'].log.length).toBeLessThanOrEqual(50);
    });
  });

  describe('result structure', () => {
    it('result contains finalBankroll, netChange, log, and summary fields', () => {
      const dice = new RiggedDice([7]);
      const table = new SharedTable({ rolls: 1, dice });
      table.addStrategy('PassLine', PassLineOnly, { bankroll: 500 });
      const results = table.run();

      const r = results['PassLine'];
      expect(typeof r.finalBankroll).toBe('number');
      expect(typeof r.netChange).toBe('number');
      expect(Array.isArray(r.log)).toBe(true);
      expect(r.summary).toBeDefined();
      expect(r.summary.type).toBe('summary');
    });

    it('netChange equals finalBankroll minus initial bankroll', () => {
      const dice = new RiggedDice([7]);
      const table = new SharedTable({ rolls: 1, dice });
      table.addStrategy('PassLine', PassLineOnly, { bankroll: 500 });
      const results = table.run();

      expect(results['PassLine'].netChange).toBe(results['PassLine'].finalBankroll - 500);
    });

    it('summary.bankroll.final matches finalBankroll', () => {
      const dice = new RiggedDice([7]);
      const table = new SharedTable({ rolls: 1, dice });
      table.addStrategy('PassLine', PassLineOnly, { bankroll: 500 });
      const results = table.run();

      const r = results['PassLine'];
      expect(r.summary.bankroll.final).toBe(r.finalBankroll);
    });
  });

  describe('adding strategies', () => {
    it('supports three or more strategies in one run', () => {
      const PassLineWithOdds: StrategyDefinition = ({ bets }) => {
        bets.passLine(10).withOdds(20);
      };

      const rolls = [6, 6]; // point 6, then 6 again (point made)
      const dice = new RiggedDice(rolls);
      const table = new SharedTable({ rolls: rolls.length, dice });

      table.addStrategy('A', PassLineOnly,     { bankroll: 500 });
      table.addStrategy('B', Place6And8,       { bankroll: 500 });
      table.addStrategy('C', PassLineWithOdds, { bankroll: 500 });

      const results = table.run();

      expect(Object.keys(results)).toHaveSize(3);
      // All three logs are same length
      expect(results['A'].log.length).toBe(results['B'].log.length);
      expect(results['B'].log.length).toBe(results['C'].log.length);
      // All see the same dice
      expect(results['A'].log[0].rollValue).toBe(results['B'].log[0].rollValue);
      expect(results['B'].log[0].rollValue).toBe(results['C'].log[0].rollValue);
    });
  });

});
