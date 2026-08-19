import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { StrategyCatalog } from '@shared/strategy-meta';
import { catsUnits } from '@engine/dsl/units';
import { RunToolbar, buildSpec } from '../RunToolbar';
import { resetStrategyCatalogCache } from '../../lib/strategy-meta';

/**
 * The toolbar is where canonical spec strings are minted. These tests pin the
 * round trip the plan asks for — URL -> controls -> URL -> run request — and
 * assert the entry dropdown is populated from metadata, never from a list in
 * web/.
 */

const STRATEGY_NAMES = ['CATS', 'BATS', 'PassLineOnly', 'ThreePointMolly3X'];

function catalogFor(tableMin: number): StrategyCatalog {
  const U = catsUnits(tableMin);
  return {
    tableMin,
    strategies: [
      {
        name: 'CATS',
        parameterized: true,
        stateOrder: ['accumulatorFull', 'accumulatorRegressed', 'littleMolly', 'threePtMollyTight', 'threePtMollyLoose'],
        stages: [
          { slug: 'accumulator',       state: 'accumulatorFull',    displayName: 'Accumulator',           gate: 0 },
          { slug: 'littleMolly',       state: 'littleMolly',        displayName: 'Little Molly',          gate: U.gates.littleMolly },
          { slug: 'threePtMollyTight', state: 'threePtMollyTight',  displayName: '3-Point Molly — Tight', gate: U.gates.threePtMolly },
          { slug: 'threePtMollyLoose', state: 'threePtMollyLoose',  displayName: '3-Point Molly — Loose', gate: U.gates.expandedAlpha },
        ],
      },
      { name: 'BATS', parameterized: true, stateOrder: ['bearishAccumulator'], stages: [
        { slug: 'bearishAccumulator', state: 'bearishAccumulator', displayName: 'Bearish Accumulator', gate: 0 },
        { slug: 'littleDolly',        state: 'littleDolly',        displayName: 'Little Dolly',        gate: 120 },
      ] },
      { name: 'PassLineOnly',      parameterized: false, stateOrder: [], stages: [] },
      { name: 'ThreePointMolly3X', parameterized: false, stateOrder: [], stages: [] },
    ],
  };
}

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

beforeEach(() => {
  resetStrategyCatalogCache();
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.startsWith('/api/strategies')) return json(STRATEGY_NAMES);
    const tableMin = Number(new URL(url, 'http://x').searchParams.get('tableMin') ?? 10);
    return json(catalogFor(tableMin));
  }));
});
afterEach(() => vi.unstubAllGlobals());

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="url">{`${location.pathname}${location.search}`}</output>;
}

function renderToolbar(initialUrl: string) {
  return render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <RunToolbar />
      <LocationProbe />
    </MemoryRouter>,
  );
}

const url = () => screen.getByTestId('url').textContent ?? '';

describe('buildSpec', () => {
  it('omits the engine default table minimum so plain runs stay bare', () => {
    expect(buildSpec('CATS', '', 10)).toBe('CATS');
    expect(buildSpec('CATS', 'threePtMollyLoose', 10)).toBe('CATS@entry=threePtMollyLoose');
  });

  it('carries a non-default table minimum in canonical order', () => {
    expect(buildSpec('CATS', '', 15)).toBe('CATS@tableMin=15');
    expect(buildSpec('CATS', 'littleMolly', 25)).toBe('CATS@entry=littleMolly,tableMin=25');
  });
});

describe('RunToolbar entry stage', () => {
  it('populates the dropdown from stage metadata, in ladder order', async () => {
    const user = userEvent.setup();
    renderToolbar('/session?strategy=CATS');

    await user.click(await screen.findByRole('button', { name: /Entry Stage/ }));
    const options = await screen.findAllByRole('option');
    expect(options.map(o => o.textContent)).toEqual([
      'Accumulator (classic)',
      'Little Molly · buy in at +$70',
      '3-Point Molly — Tight · buy in at +$150',
      '3-Point Molly — Loose · buy in at +$250',
    ]);
  });

  it('reads the entry slug out of the URL spec and shows its display name', async () => {
    renderToolbar('/session?strategy=CATS@entry=threePtMollyLoose');
    expect(await screen.findByRole('button', { name: /3-Point Molly — Loose/ })).toBeInTheDocument();
  });

  it('writes the slug — not the display name — back into the URL', async () => {
    const user = userEvent.setup();
    renderToolbar('/session?strategy=CATS&rolls=500&bankroll=300');

    await user.click(await screen.findByRole('button', { name: /Entry Stage/ }));
    await user.click(await screen.findByRole('option', { name: /3-Point Molly — Loose/ }));
    await user.click(screen.getByRole('button', { name: /Run/ }));

    await waitFor(() => expect(url()).toContain('strategy=CATS%40entry%3DthreePtMollyLoose'));
    expect(decodeURIComponent(url())).toContain('strategy=CATS@entry=threePtMollyLoose');
  });

  it('hides itself for strategies with no stage ladder', async () => {
    renderToolbar('/session?strategy=PassLineOnly');
    await screen.findByRole('button', { name: /Strategy/ });
    await waitFor(() => expect(screen.queryByRole('button', { name: /Entry Stage/ })).not.toBeInTheDocument());
  });

  it('drops an entry slug that the newly chosen strategy does not declare', async () => {
    const user = userEvent.setup();
    renderToolbar('/session?strategy=CATS@entry=threePtMollyLoose');

    await user.click(await screen.findByRole('button', { name: /Strategy/ }));
    await user.click(await screen.findByRole('option', { name: 'BATS' }));
    await user.click(screen.getByRole('button', { name: /Run/ }));

    await waitFor(() => {
      expect(new URLSearchParams(url().split('?')[1]).get('strategy')).toBe('BATS');
    });
  });
});

describe('RunToolbar table minimum', () => {
  it('offers the presets and reaches the run request through the spec', async () => {
    const user = userEvent.setup();
    renderToolbar('/session?strategy=CATS');

    await user.click(await screen.findByRole('button', { name: /Table Min/ }));
    expect((await screen.findAllByRole('option')).map(o => o.textContent)).toEqual(['$10', '$15', '$25']);

    await user.click(screen.getByRole('option', { name: '$15' }));
    await user.click(screen.getByRole('button', { name: /Run/ }));

    await waitFor(() => expect(decodeURIComponent(url())).toContain('strategy=CATS@tableMin=15'));
  });

  it('accepts a free-entry table minimum', async () => {
    const user = userEvent.setup();
    renderToolbar('/session?strategy=CATS');

    await user.click(await screen.findByRole('button', { name: /Table Min/ }));
    const field = screen.getByLabelText('Custom table minimum');
    await user.clear(field);
    await user.type(field, '12');
    await user.click(screen.getByRole('button', { name: /Run/ }));

    await waitFor(() => expect(decodeURIComponent(url())).toContain('strategy=CATS@tableMin=12'));
  });

  it('rejects a table minimum below $5 instead of running', async () => {
    const user = userEvent.setup();
    renderToolbar('/session?strategy=CATS');

    await user.click(await screen.findByRole('button', { name: /Table Min/ }));
    const field = screen.getByLabelText('Custom table minimum');
    await user.clear(field);
    await user.type(field, '3');
    await user.click(screen.getByRole('button', { name: /Run/ }));

    expect(await screen.findByText(/at least \$5/)).toBeInTheDocument();
    expect(url()).toBe('/session?strategy=CATS');
  });

  it('hides itself for strategies the unit system does not parameterize', async () => {
    renderToolbar('/session?strategy=ThreePointMolly3X');
    await screen.findByRole('button', { name: /Strategy/ });
    await waitFor(() => expect(screen.queryByRole('button', { name: /Table Min/ })).not.toBeInTheDocument());
  });
});

describe('spec round trip', () => {
  it('re-emits an identical spec when a pasted URL is run unchanged', async () => {
    const user = userEvent.setup();
    const pasted = '/session?strategy=CATS%40entry%3DthreePtMollyLoose%2CtableMin%3D15&rolls=500&bankroll=300&seed=42';
    renderToolbar(pasted);

    await screen.findByRole('button', { name: /3-Point Molly — Loose/ });
    await user.click(screen.getByRole('button', { name: /Run/ }));

    await waitFor(() => {
      const params = new URLSearchParams(url().split('?')[1]);
      expect(params.get('strategy')).toBe('CATS@entry=threePtMollyLoose,tableMin=15');
      expect(params.get('rolls')).toBe('500');
      expect(params.get('bankroll')).toBe('300');
      expect(params.get('seed')).toBe('42');
    });
  });
});
