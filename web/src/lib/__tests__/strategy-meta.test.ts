import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { StrategyCatalog } from '@shared/strategy-meta';
import {
  fetchStrategyCatalog,
  findStrategyForSpec,
  humanizeState,
  resetStrategyCatalogCache,
  specEntryGate,
} from '../strategy-meta';

const CATALOG: StrategyCatalog = {
  tableMin: 10,
  strategies: [
    {
      name: 'CATS',
      parameterized: true,
      stateOrder: ['accumulatorFull', 'accumulatorRegressed', 'littleMolly', 'threePtMollyTight', 'threePtMollyLoose'],
      stages: [
        { slug: 'accumulator',       state: 'accumulatorFull',   displayName: 'Accumulator',            gate: 0 },
        { slug: 'littleMolly',       state: 'littleMolly',       displayName: 'Little Molly',           gate: 70 },
        { slug: 'threePtMollyLoose', state: 'threePtMollyLoose', displayName: '3-Point Molly — Loose',  gate: 250 },
      ],
    },
    { name: 'PassLineOnly', parameterized: false, stateOrder: [], stages: [] },
  ],
};

function mockFetch(catalog: StrategyCatalog = CATALOG) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(catalog), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => resetStrategyCatalogCache());
afterEach(() => vi.unstubAllGlobals());

describe('fetchStrategyCatalog', () => {
  it('asks the metadata endpoint for the requested table minimum', async () => {
    const fetchMock = mockFetch();
    await fetchStrategyCatalog(25);
    expect(fetchMock).toHaveBeenCalledWith('/api/meta/strategies?tableMin=25');
  });

  it('memoizes per table minimum', async () => {
    const fetchMock = mockFetch();
    await Promise.all([fetchStrategyCatalog(10), fetchStrategyCatalog(10)]);
    await fetchStrategyCatalog(15);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('surfaces the server error message and does not cache the failure', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: 'tableMin must be an integer of at least 5' }), { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchStrategyCatalog(1)).rejects.toThrow(/at least 5/);
    await expect(fetchStrategyCatalog(1)).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('spec resolution', () => {
  it('finds the strategy behind a spec with options', () => {
    expect(findStrategyForSpec(CATALOG, 'CATS@entry=threePtMollyLoose,tableMin=15')?.name).toBe('CATS');
  });

  it('returns nothing for an unparseable spec rather than throwing', () => {
    expect(findStrategyForSpec(CATALOG, 'CATS@')).toBeUndefined();
  });

  it('reads the funded-entry gate from metadata', () => {
    expect(specEntryGate(CATALOG, 'CATS@entry=threePtMollyLoose')).toBe(250);
    expect(specEntryGate(CATALOG, 'CATS@entry=littleMolly')).toBe(70);
  });

  it('treats classic entry as gate zero', () => {
    expect(specEntryGate(CATALOG, 'CATS')).toBe(0);
    expect(specEntryGate(CATALOG, 'PassLineOnly')).toBe(0);
    expect(specEntryGate(null, 'CATS@entry=maxAlpha')).toBe(0);
  });
});

describe('humanizeState', () => {
  it('derives a label for internal states that declare no entry metadata', () => {
    expect(humanizeState('accumulatorRegressed')).toBe('Accumulator Regressed');
    expect(humanizeState('bearishAccumulatorFull')).toBe('Bearish Accumulator Full');
  });
});
