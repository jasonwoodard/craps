import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { StrategyCatalog } from '@shared/strategy-meta';
import { batsUnits, catsUnits } from '@engine/dsl/units';
import { CatsStrategyPage } from '../CatsStrategyPage';
import { BatsStrategyPage } from '../BatsStrategyPage';
import { resetStrategyCatalogCache } from '../../../lib/strategy-meta';

/**
 * UNITS-PARITY — the anti-drift keystone for all three web phases
 * (webui-plan.md W1 acceptance criteria).
 *
 * The strategy pages must contain no hardcoded dollar figures: every amount
 * they render has to be a value the engine's unit system produces at the table
 * minimum in question. This test renders the pages and asserts exactly that,
 * at $10 and $15, by scanning the rendered text for dollar amounts and
 * checking each one against `units.ts` output.
 *
 * Do not weaken this test to make a page pass. If a page needs a number the
 * unit system does not produce, that number is either a bug or an engine
 * output — and engine outputs live in a `data-figures="simulation"` block with
 * a manifest attached, which the scan skips.
 *
 * Split of responsibility: dollar amounts are checked here against units.ts
 * directly. The stage slugs and display names in the stubbed catalog below are
 * pinned against the real stage machines by spec/server/routes/meta-spec.ts —
 * a rename there fails that test loudly.
 */

const CATS_STAGES = [
  { slug: 'accumulator',       state: 'accumulatorFull',   displayName: 'Accumulator' },
  { slug: 'littleMolly',       state: 'littleMolly',       displayName: 'Little Molly' },
  { slug: 'threePtMollyTight', state: 'threePtMollyTight', displayName: '3-Point Molly — Tight' },
  { slug: 'threePtMollyLoose', state: 'threePtMollyLoose', displayName: '3-Point Molly — Loose' },
  { slug: 'expandedAlpha',     state: 'expandedAlpha',     displayName: 'Expanded Alpha' },
  { slug: 'maxAlpha',          state: 'maxAlpha',          displayName: 'Max Alpha' },
];

const BATS_STAGES = [
  { slug: 'bearishAccumulator', state: 'bearishAccumulator', displayName: 'Bearish Accumulator' },
  { slug: 'littleDolly',        state: 'littleDolly',        displayName: 'Little Dolly' },
  { slug: 'threePtDolly',       state: 'threePtDolly',       displayName: '3-Point Dolly' },
  { slug: 'expandedDarkAlpha',  state: 'expandedDarkAlpha',  displayName: 'Expanded Dark Alpha' },
  { slug: 'maxDarkAlpha',       state: 'maxDarkAlpha',       displayName: 'Max Dark Alpha' },
];

/** Gates come from units.ts, exactly as the server route computes them. */
function catsGate(slug: string, tableMin: number): number {
  const U = catsUnits(tableMin);
  switch (slug) {
    case 'accumulator':       return 0;
    case 'littleMolly':       return U.gates.littleMolly;
    case 'threePtMollyTight': return U.gates.threePtMolly;
    case 'threePtMollyLoose': return U.gates.expandedAlpha;
    case 'expandedAlpha':     return U.gates.expandedAlpha;
    default:                  return U.gates.maxAlpha;
  }
}

function batsGate(slug: string, tableMin: number): number {
  const B = batsUnits(tableMin);
  switch (slug) {
    case 'bearishAccumulator': return 0;
    case 'littleDolly':        return B.gates.littleDolly;
    case 'threePtDolly':       return B.gates.threePtDolly;
    case 'expandedDarkAlpha':  return B.gates.expandedDarkAlpha;
    default:                   return B.gates.maxDarkAlpha;
  }
}

function catalogFor(tableMin: number): StrategyCatalog {
  return {
    tableMin,
    strategies: [
      {
        name: 'CATS',
        parameterized: true,
        stateOrder: CATS_STAGES.map(s => s.state),
        stages: CATS_STAGES.map(s => ({ ...s, gate: catsGate(s.slug, tableMin) })),
      },
      {
        name: 'BATS',
        parameterized: true,
        stateOrder: BATS_STAGES.map(s => s.state),
        stages: BATS_STAGES.map(s => ({ ...s, gate: batsGate(s.slug, tableMin) })),
      },
    ],
  };
}

beforeEach(() => {
  resetStrategyCatalogCache();
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const tableMin = Number(new URL(url, 'http://x').searchParams.get('tableMin') ?? 10);
    return new Response(JSON.stringify(catalogFor(tableMin)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }));
});
afterEach(() => vi.unstubAllGlobals());

/**
 * Every dollar amount the rendered page shows, outside exempt blocks. Scans
 * text nodes one at a time — concatenating a whole subtree would weld
 * neighbouring cells together ("$180" + "3-Point Dolly" reads as $1803).
 */
function renderedDollars(container: HTMLElement): number[] {
  const clone = container.cloneNode(true) as HTMLElement;
  // Engine outputs (quoted figures with a manifest) are not unit-system rules.
  clone.querySelectorAll('[data-figures="simulation"]').forEach(node => node.remove());

  const walker = clone.ownerDocument.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
  const amounts: number[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    for (const match of (node.textContent ?? '').match(/\$[\d,]+/g) ?? []) {
      amounts.push(Number(match.slice(1).replace(/,/g, '')));
    }
  }
  return amounts;
}

function catsAllowedDollars(): Set<number> {
  const allowed = new Set<number>();
  for (const tableMin of [10, 15]) {
    const U = catsUnits(tableMin);
    [
      U.tableMin, U.unit, U.flat, U.oddsLittle, U.oddsLoose,
      U.tier.sweet.passLine, U.tier.sweet.come1, U.tier.sweet.come2,
      U.tier.middle.passLine, U.tier.middle.come1, U.tier.middle.come2,
      U.tier.rough.passLine, U.tier.rough.come1, U.tier.rough.come2,
      U.buyAmount, U.accumulatorStart, U.accumulatorRegressed,
      U.gates.littleMolly, U.gates.threePtMolly, U.gates.expandedAlpha, U.gates.maxAlpha,
      U.modeShiftCushion, U.classicRisk,
      U.referenceFunded.tight, U.referenceFunded.littleMolly,
      // The worked funded-entry example: origin = B - gate(entry).
      U.classicRisk - U.gates.expandedAlpha,
    ].forEach(v => allowed.add(v));
  }
  return allowed;
}

function batsAllowedDollars(): Set<number> {
  const allowed = new Set<number>();
  for (const tableMin of [10, 15]) {
    const B = batsUnits(tableMin);
    [
      B.tableMin, B.unit, B.flat,
      B.layWinAccumulator, B.layWinDolly, B.layWinThreePt, B.layWinStandalone,
      B.gates.littleDolly, B.gates.threePtDolly, B.gates.expandedDarkAlpha, B.gates.maxDarkAlpha,
    ].forEach(v => allowed.add(v));
  }
  return allowed;
}

function renderPage(page: 'cats' | 'bats') {
  return render(
    <MemoryRouter>
      {page === 'cats' ? <CatsStrategyPage /> : <BatsStrategyPage />}
    </MemoryRouter>,
  );
}

/** Resolves once the ladder has been rendered from the (async) catalog. */
async function ladderWithRows(expectedRows: number): Promise<HTMLElement> {
  const table = await screen.findByTestId('ladder');
  await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(expectedRows + 1));
  return table;
}

describe('units parity — CATS strategy page', () => {
  it('renders no dollar figure the unit system does not produce', async () => {
    const { container } = renderPage('cats');
    await ladderWithRows(CATS_STAGES.length);

    const allowed = catsAllowedDollars();
    const rendered = renderedDollars(container);
    expect(rendered.length).toBeGreaterThan(10);
    expect(rendered.filter(v => !allowed.has(v))).toEqual([]);
  });

  it('shows the ladder gates at $10 and $15, from metadata', async () => {
    renderPage('cats');
    const table = await ladderWithRows(CATS_STAGES.length);

    const expected: [string, number, number][] = [
      ['Accumulator', 0, 0],
      ['Little Molly', catsUnits(10).gates.littleMolly, catsUnits(15).gates.littleMolly],
      ['3-Point Molly — Tight', catsUnits(10).gates.threePtMolly, catsUnits(15).gates.threePtMolly],
      ['3-Point Molly — Loose', catsUnits(10).gates.expandedAlpha, catsUnits(15).gates.expandedAlpha],
      ['Expanded Alpha', catsUnits(10).gates.expandedAlpha, catsUnits(15).gates.expandedAlpha],
      ['Max Alpha', catsUnits(10).gates.maxAlpha, catsUnits(15).gates.maxAlpha],
    ];

    for (const [name, gateTen, gateFifteen] of expected) {
      const cells = within(within(table).getByText(name).closest('tr')!).getAllByRole('cell');
      expect(cells[2]).toHaveTextContent(gateTen === 0 ? 'entry' : `+$${gateTen}`);
      expect(cells[3]).toHaveTextContent(gateFifteen === 0 ? 'entry' : `+$${gateFifteen}`);
    }
  });

  it('sizes the boards from the unit system', async () => {
    renderPage('cats');
    const U = catsUnits(10);
    expect(await screen.findByText(new RegExp(`Place 6 & 8 at \\$${U.accumulatorStart} each`))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`regress to \\$${U.accumulatorRegressed} each`))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`\\$${U.oddsLoose} odds`))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`Buy 4 & 10 at \\$${U.buyAmount} each`))).toBeInTheDocument();
  });

  it('states the acronym correctly', async () => {
    renderPage('cats');
    expect(await screen.findByText('Craps Alpha-Transition Strategy')).toBeInTheDocument();
  });

  it('quotes engine findings only inside a manifest-carrying block', async () => {
    const { container } = renderPage('cats');
    await ladderWithRows(CATS_STAGES.length);
    const exempt = container.querySelector('[data-figures="simulation"]')!;
    expect(exempt).toBeTruthy();
    expect(within(exempt as HTMLElement).getByTestId('manifest-chip')).toBeInTheDocument();
  });

  it('links to the strategy document as the source of truth', async () => {
    renderPage('cats');
    const link = await screen.findByRole('link', { name: 'strategy/cats-strategy.md' });
    expect(link).toHaveAttribute('href', 'https://github.com/jasonwoodard/craps/blob/master/strategy/cats-strategy.md');
  });
});

describe('units parity — BATS strategy page', () => {
  it('renders no dollar figure the unit system does not produce', async () => {
    const { container } = renderPage('bats');
    await ladderWithRows(BATS_STAGES.length);

    const allowed = batsAllowedDollars();
    const rendered = renderedDollars(container);
    expect(rendered.length).toBeGreaterThan(5);
    expect(rendered.filter(v => !allowed.has(v))).toEqual([]);
  });

  it('shows the Dolly ladder gates at $10 and $15, from metadata', async () => {
    renderPage('bats');
    const table = await ladderWithRows(BATS_STAGES.length);
    for (const stage of BATS_STAGES) {
      const cells = within(within(table).getByText(stage.displayName).closest('tr')!).getAllByRole('cell');
      const ten = batsGate(stage.slug, 10);
      const fifteen = batsGate(stage.slug, 15);
      expect(cells[2]).toHaveTextContent(ten === 0 ? 'entry' : `+$${ten}`);
      expect(cells[3]).toHaveTextContent(fifteen === 0 ? 'entry' : `+$${fifteen}`);
    }
  });

  it('is badged Draft and states the acronym correctly', async () => {
    renderPage('bats');
    expect(await screen.findByText('Bearish Alpha-Transition Strategy')).toBeInTheDocument();
    expect(screen.getAllByText('Draft').length).toBeGreaterThan(0);
  });
});
