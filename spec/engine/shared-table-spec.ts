import { SharedTable } from '../../src/engine/shared-table';
import { CrapsEngine } from '../../src/engine/craps-engine';
import { StrategyDefinition } from '../../src/dsl/strategy';
import { RiggedDice } from '../dice/rigged-dice';
import { Place6And8Progressive, Place6And8 as Place6And8Strategy } from '../../src/dsl/strategies';

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

  // M3.4: Progressive strategy test (CUJ 2.1)
  //
  // Roll sequence rationale:
  //   Roll 1 (4): come-out; point=4 established; place bets placed but OFF (no resolution).
  //   Roll 2 (6): place 6 hits (wins=0→1). Both strategies pay at $12.
  //   Roll 3 (8): place 8 hits (wins=1→2). Both strategies pay at $12.
  //   Roll 4 (6): place 6 hits (wins=2→3). Place6And8Progressive still has place6@$12 on table
  //               (updateOdds is a no-op for place bets; amount updates only take effect after
  //               a bet is naturally removed and re-placed). Pays at $12.
  //   Roll 5 (8): place 8 hits (wins=3→4). Place6And8Progressive re-placed place8@$18 before this
  //               roll (after roll 3's win cleared it and wins=2 on reconcile), so it pays at $18
  //               vs Place6And8's flat $12.
  //   Roll 6 (7): seven-out; both remaining place bets lose; no credit.
  //
  // Expected final bankrolls (derived from hand-trace):
  //   Place6And8Progressive: 515  (higher exposure from pressing bets)
  //   Place6And8:        532  (flat $12 throughout — avoids the larger bets but misses upside)
  describe('progressive strategy (CUJ 2.1)', () => {

    it('Place6And8Progressive diverges from flat Place6And8 on identical dice (CUJ 2.1)', () => {
      // [4, 6, 8, 6, 8, 7]: point established, four place-bet wins at escalating sizes, then seven-out
      const rolls = [4, 6, 8, 6, 8, 7];
      const dice = new RiggedDice(rolls);
      const table = new SharedTable({ rolls: rolls.length, dice });

      table.addStrategy('Place6And8Progressive', Place6And8Progressive, { bankroll: 500 });
      table.addStrategy('Place6And8',        Place6And8Strategy, { bankroll: 500 });

      const results = table.run();

      // Both strategies see identical dice — the comparison is fair
      for (let i = 0; i < rolls.length; i++) {
        expect(results['Place6And8Progressive'].log[i].rollValue)
          .toBe(results['Place6And8'].log[i].rollValue);
      }

      // Strategies produce different final bankrolls because bet sizes diverged after wins accumulated
      expect(results['Place6And8Progressive'].finalBankroll).not.toBe(results['Place6And8'].finalBankroll);

      // Exact values verified by hand-trace (see comment above)
      expect(results['Place6And8Progressive'].finalBankroll).toBe(515);
      expect(results['Place6And8'].finalBankroll).toBe(532);
    });

    it('Place6And8Progressive shows larger place bets than Place6And8 once wins accumulate', () => {
      // After 2 wins (rolls 2 and 3 in the sequence), Place6And8Progressive re-places the cleared
      // bet at $18 while Place6And8 re-places at $12.  We inspect activeBets (snapshotted after
      // reconcile, before the dice roll) to verify the amounts directly.
      const rolls = [4, 6, 8, 6, 8, 7];
      const dice = new RiggedDice(rolls);
      const table = new SharedTable({ rolls: rolls.length, dice });

      table.addStrategy('Place6And8Progressive', Place6And8Progressive, { bankroll: 500 });
      table.addStrategy('Place6And8',        Place6And8Strategy, { bankroll: 500 });

      const results = table.run();

      // Roll 5 (index 4): before this roll, reconcile ran with wins=3 (amount=24 for new bets).
      // Place6 was removed after roll 4's win and re-placed at $24.
      // Place8 survived from before roll 4, but was placed at $18 (wins=2 on that reconcile)
      // and was not updated (updateOdds is a no-op for place bets).
      const progressiveLog = results['Place6And8Progressive'].log;
      const flatLog        = results['Place6And8'].log;

      const progressiveBetsOnRoll5 = progressiveLog[4].activeBets;
      const flatBetsOnRoll5        = flatLog[4].activeBets;

      // Place6And8Progressive has at least one bet larger than $12 by roll 5
      const progressiveAmounts = progressiveBetsOnRoll5.map(b => b.amount);
      expect(progressiveAmounts.some(a => a > 12)).toBe(true);

      // Place6And8 always bets exactly $12
      const flatAmounts = flatBetsOnRoll5.map(b => b.amount);
      expect(flatAmounts.every(a => a === 12)).toBe(true);
    });

  });

  // M3.4: Seed reproducibility for SharedTable (CUJs 1.2, 2.3)
  describe('seed reproducibility (CUJs 1.2, 2.3)', () => {

    it('two SharedTable runs with the same seed produce identical dice sequences', () => {
      const run1 = new SharedTable({ seed: 42, rolls: 200 });
      run1.addStrategy('A', PassLineOnly, { bankroll: 500 });
      const results1 = run1.run();

      const run2 = new SharedTable({ seed: 42, rolls: 200 });
      run2.addStrategy('A', PassLineOnly, { bankroll: 500 });
      const results2 = run2.run();

      expect(results1['A'].log.length).toBe(results2['A'].log.length);
      for (let i = 0; i < results1['A'].log.length; i++) {
        expect(results1['A'].log[i].die1).toBe(results2['A'].log[i].die1);
        expect(results1['A'].log[i].die2).toBe(results2['A'].log[i].die2);
        expect(results1['A'].log[i].rollValue).toBe(results2['A'].log[i].rollValue);
      }
    });

    it('two SharedTable runs with the same seed produce identical final bankrolls', () => {
      const run1 = new SharedTable({ seed: 99, rolls: 500 });
      run1.addStrategy('PassLine', PassLineOnly, { bankroll: 500 });
      run1.addStrategy('Place68',  Place6And8,  { bankroll: 500 });
      const results1 = run1.run();

      const run2 = new SharedTable({ seed: 99, rolls: 500 });
      run2.addStrategy('PassLine', PassLineOnly, { bankroll: 500 });
      run2.addStrategy('Place68',  Place6And8,  { bankroll: 500 });
      const results2 = run2.run();

      expect(results1['PassLine'].finalBankroll).toBe(results2['PassLine'].finalBankroll);
      expect(results1['Place68'].finalBankroll).toBe(results2['Place68'].finalBankroll);
    });

    it('SharedTable and CrapsEngine with the same seed see the same dice (cross-engine reproducibility)', () => {
      // A SharedTable single-strategy run and a CrapsEngine run on the same seed should
      // see the same dice sequence, proving both engines share the same MT19937 implementation.
      const sharedTable = new SharedTable({ seed: 7, rolls: 100 });
      sharedTable.addStrategy('A', PassLineOnly, { bankroll: 500 });
      const sharedResults = sharedTable.run();

      const engineResult = new CrapsEngine({
        strategy: PassLineOnly,
        bankroll: 500,
        rolls: 100,
        seed: 7,
      }).run();

      const sharedRolls = sharedResults['A'].log.map(r => r.rollValue);
      const engineRolls = engineResult.rolls.map(r => r.rollValue);

      expect(sharedRolls.length).toBe(engineRolls.length);
      for (let i = 0; i < sharedRolls.length; i++) {
        expect(sharedRolls[i]).toBe(engineRolls[i]);
      }
    });

  });

});
