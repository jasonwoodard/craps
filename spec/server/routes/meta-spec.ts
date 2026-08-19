/**
 * Metadata contract test for GET /api/meta/strategies — the seam the Web UI
 * reads stage slugs, display names, entry gates, and ladder order from
 * (webui-plan.md W1). If this shape changes, web/ breaks silently, so the
 * contract is pinned here rather than only in the client.
 */
import { strategyMetaRoute } from '../../../server/routes/meta';
import { catsUnits, batsUnits } from '../../../src/dsl/units';
import { StrategyCatalog } from '../../../types/strategy-meta';

interface Captured {
  status: number;
  body: any;
}

function call(query: Record<string, string> = {}): Captured {
  const captured: Captured = { status: 200, body: undefined };
  const res: any = {
    status(code: number) { captured.status = code; return res; },
    json(body: unknown) { captured.body = body; return res; },
  };
  strategyMetaRoute({ query } as any, res);
  return captured;
}

function catalog(query: Record<string, string> = {}): StrategyCatalog {
  const { status, body } = call(query);
  expect(status).toBe(200);
  return body as StrategyCatalog;
}

function strategy(cat: StrategyCatalog, name: string) {
  const found = cat.strategies.find(s => s.name === name);
  if (!found) throw new Error(`no metadata for ${name}`);
  return found;
}

describe('GET /api/meta/strategies', () => {

  it('defaults to a $10 table', () => {
    expect(catalog().tableMin).toBe(10);
  });

  it('returns one entry per registered strategy, with the documented shape', () => {
    const cat = catalog();
    expect(cat.strategies.length).toBeGreaterThan(0);
    for (const s of cat.strategies) {
      expect(typeof s.name).toBe('string');
      expect(typeof s.parameterized).toBe('boolean');
      expect(Array.isArray(s.stages)).toBe(true);
      expect(Array.isArray(s.stateOrder)).toBe(true);
      for (const stage of s.stages) {
        expect(typeof stage.slug).toBe('string');
        expect(typeof stage.state).toBe('string');
        expect(typeof stage.displayName).toBe('string');
        expect(typeof stage.gate).toBe('number');
        // Every entry stage must name a real machine state on the ladder.
        expect(s.stateOrder).toContain(stage.state);
      }
    }
  });

  it('marks the spec-parameterizable strategies', () => {
    const cat = catalog();
    expect(strategy(cat, 'CATS').parameterized).toBe(true);
    expect(strategy(cat, 'BATS').parameterized).toBe(true);
    expect(strategy(cat, 'PassLineOnly').parameterized).toBe(false);
  });

  it('exposes CATS entry slugs in ladder order', () => {
    const slugs = strategy(catalog(), 'CATS').stages.map(s => s.slug);
    expect(slugs).toEqual([
      'accumulator', 'littleMolly', 'threePtMollyTight',
      'threePtMollyLoose', 'expandedAlpha', 'maxAlpha',
    ]);
  });

  it('includes internal machine states in stateOrder but not in stages', () => {
    const cats = strategy(catalog(), 'CATS');
    expect(cats.stateOrder).toContain('accumulatorRegressed');
    expect(cats.stages.map(s => s.state)).not.toContain('accumulatorRegressed');
  });

  it('reports non-staged strategies as empty ladders', () => {
    const plain = strategy(catalog(), 'PassLineOnly');
    expect(plain.stages).toEqual([]);
    expect(plain.stateOrder).toEqual([]);
  });

  it('computes CATS gates from the unit system at the requested table minimum', () => {
    for (const tableMin of [10, 15, 25]) {
      const U = catsUnits(tableMin);
      const cat = catalog({ tableMin: String(tableMin) });
      expect(cat.tableMin).toBe(tableMin);
      const gates = new Map(strategy(cat, 'CATS').stages.map(s => [s.slug, s.gate]));
      expect(gates.get('accumulator')).toBe(0);
      expect(gates.get('littleMolly')).toBe(U.gates.littleMolly);
      expect(gates.get('threePtMollyTight')).toBe(U.gates.threePtMolly);
      // Funded Loose entry is gated at the top of stage 3's band (v4 §4).
      expect(gates.get('threePtMollyLoose')).toBe(U.gates.expandedAlpha);
      expect(gates.get('expandedAlpha')).toBe(U.gates.expandedAlpha);
      expect(gates.get('maxAlpha')).toBe(U.gates.maxAlpha);
    }
  });

  it('computes BATS gates from the unit system too — no CATS-specific code', () => {
    for (const tableMin of [10, 15]) {
      const B = batsUnits(tableMin);
      const gates = new Map(
        strategy(catalog({ tableMin: String(tableMin) }), 'BATS').stages.map(s => [s.slug, s.gate]),
      );
      expect(gates.get('bearishAccumulator')).toBe(0);
      expect(gates.get('littleDolly')).toBe(B.gates.littleDolly);
      expect(gates.get('threePtDolly')).toBe(B.gates.threePtDolly);
      expect(gates.get('expandedDarkAlpha')).toBe(B.gates.expandedDarkAlpha);
      expect(gates.get('maxDarkAlpha')).toBe(B.gates.maxDarkAlpha);
    }
  });

  it('rejects a table minimum that is not a whole dollar amount of at least $5', () => {
    for (const bad of ['4', '0', '-10', '12.5', 'ten']) {
      expect(call({ tableMin: bad }).status).toBe(400);
    }
  });
});
