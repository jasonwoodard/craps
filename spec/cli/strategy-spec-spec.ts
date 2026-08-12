/**
 * Canonical strategy specs (NAME@key=value[,key=value]) and stage metadata
 * export — session-lifecycle.md v4 §2.
 */
import { parseStrategySpec, canonicalizeSpec } from '../../src/cli/strategy-loader';
import { createStrategy, getStrategyMetadata } from '../../src/cli/strategy-registry';
import { STAGE_MACHINE_RUNTIME } from '../../src/dsl/strategy';
import { StageMachineRuntime } from '../../src/dsl/stage-machine-state';

function runtimeOf(strategy: any): StageMachineRuntime {
  return strategy[STAGE_MACHINE_RUNTIME];
}

describe('canonical strategy specs', () => {

  describe('parseStrategySpec', () => {
    it('parses a bare name', () => {
      const p = parseStrategySpec('CATS');
      expect(p.name).toBe('CATS');
      expect(p.options).toEqual({});
      expect(p.canonical).toBe('CATS');
    });

    it('parses entry and tableMin', () => {
      const p = parseStrategySpec('CATS@entry=threePtMollyLoose,tableMin=15');
      expect(p.name).toBe('CATS');
      expect(p.options).toEqual({ entry: 'threePtMollyLoose', tableMin: 15 });
    });

    it('normalizes key order to the canonical form', () => {
      const p = parseStrategySpec('CATS@tableMin=15,entry=littleMolly');
      expect(p.canonical).toBe('CATS@entry=littleMolly,tableMin=15');
    });

    it('round-trips: parse(canonical).canonical === canonical', () => {
      for (const spec of ['CATS', 'CATS@entry=threePtMollyLoose', 'BATS@entry=threePtDolly,tableMin=15']) {
        const once = parseStrategySpec(spec).canonical;
        expect(parseStrategySpec(once).canonical).toBe(once);
      }
    });

    it('rejects unknown keys with the valid list', () => {
      expect(() => parseStrategySpec('CATS@foo=1'))
        .toThrowError(/unknown option "foo".*entry, tableMin/);
    });

    it('rejects malformed specs', () => {
      expect(() => parseStrategySpec('CATS@')).toThrow();
      expect(() => parseStrategySpec('CATS@entry')).toThrow();
      expect(() => parseStrategySpec('CATS@entry=')).toThrow();
      expect(() => parseStrategySpec('CATS@entry=a,entry=b')).toThrow();
      expect(() => parseStrategySpec('CATS@tableMin=zero')).toThrow();
      expect(() => parseStrategySpec('@entry=a')).toThrow();
    });

    it('canonicalizeSpec renders bare name when there are no options', () => {
      expect(canonicalizeSpec('CATS', {})).toBe('CATS');
    });
  });

  describe('createStrategy with specs', () => {
    it('creates a funded-entry CATS from a spec string', () => {
      const s = createStrategy('CATS@entry=threePtMollyLoose');
      expect(runtimeOf(s).getCurrentStage()).toBe('threePtMollyLoose');
    });

    it('maps the accumulator slug to the accumulatorFull state', () => {
      const s = createStrategy('CATS@entry=accumulator');
      expect(runtimeOf(s).getCurrentStage()).toBe('accumulatorFull');
    });

    it('applies tableMin through the spec', () => {
      const s = createStrategy('CATS@entry=littleMolly,tableMin=15');
      // $15 littleMolly gate is $105; funded entry starts profit at the gate
      // once the bankroll is captured — verify via the runtime's metadata.
      const meta = runtimeOf(s).getStageMetadata();
      expect(meta.find(m => m.slug === 'littleMolly')!.gate).toBe(105);
    });

    it('fails loudly on unknown entry slugs, listing the valid slugs', () => {
      expect(() => createStrategy('CATS@entry=bogusStage'))
        .toThrowError(/unknown entry stage "bogusStage".*accumulator, littleMolly, threePtMollyTight, threePtMollyLoose, expandedAlpha, maxAlpha/);
    });

    it('fails loudly when options are passed to a non-parameterized strategy', () => {
      expect(() => createStrategy('PassLineOnly@entry=foo'))
        .toThrowError(/does not accept spec options/);
    });

    it('fails loudly on unknown strategy names', () => {
      expect(() => createStrategy('NotAStrategy')).toThrowError(/Unknown strategy/);
    });
  });

  describe('getStrategyMetadata', () => {
    it('exports the CATS ladder in order with display names and gates', () => {
      const meta = getStrategyMetadata('CATS');
      expect(meta.parameterized).toBe(true);
      expect(meta.stages.map(s => s.slug)).toEqual([
        'accumulator', 'littleMolly', 'threePtMollyTight',
        'threePtMollyLoose', 'expandedAlpha', 'maxAlpha',
      ]);
      expect(meta.stages.map(s => s.displayName)).toEqual([
        'Accumulator', 'Little Molly', '3-Point Molly — Tight',
        '3-Point Molly — Loose', 'Expanded Alpha', 'Max Alpha',
      ]);
      expect(meta.stages.map(s => s.gate)).toEqual([0, 70, 150, 250, 250, 400]);
    });

    it('exports the BATS Dolly ladder generically', () => {
      const meta = getStrategyMetadata('BATS');
      expect(meta.stages.map(s => s.slug)).toEqual([
        'bearishAccumulator', 'littleDolly', 'threePtDolly',
        'expandedDarkAlpha', 'maxDarkAlpha',
      ]);
      expect(meta.stages.map(s => s.gate)).toEqual([0, 120, 225, 350, 500]);
    });

    it('returns an empty stage list for non-staged strategies', () => {
      const meta = getStrategyMetadata('PassLineOnly');
      expect(meta.stages).toEqual([]);
      expect(meta.parameterized).toBe(false);
    });
  });
});
