import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Shell } from '../Shell';
import { resetStrategyCatalogCache } from '../../lib/strategy-meta';

// Shell renders the RunToolbar, which loads the strategy catalog on mount.
// Stub it so these tests are hermetic and settle before assertions run.
beforeEach(() => {
  resetStrategyCatalogCache();
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(
    JSON.stringify(url.startsWith('/api/strategies') ? ['CATS'] : { tableMin: 10, strategies: [] }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )));
});
afterEach(() => vi.unstubAllGlobals());

async function renderShell(url: string) {
  const result = render(
    <MemoryRouter initialEntries={[url]}>
      <Shell><p>content</p></Shell>
    </MemoryRouter>,
  );
  await waitFor(() => expect(screen.getByRole('toolbar', { name: 'Run settings' })).toBeInTheDocument());
  return result;
}

describe('Shell', () => {
  it('renders every nav destination', async () => {
    await renderShell('/session');

    for (const label of ['Session', 'Session Compare', 'Distribution', 'Dist\\. Compare', 'Strategies', 'Guide']) {
      expect(screen.getByRole('link', { name: new RegExp(`${label}$`) })).toBeInTheDocument();
    }
  });

  it('carries shared run params forward when navigating', async () => {
    await renderShell('/session?strategy=CATS%40entry%3DthreePtMollyLoose&rolls=250&bankroll=300&seed=7');

    const link = screen.getByRole('link', { name: /Distribution$/ });
    const query = new URLSearchParams(link.getAttribute('href')!.split('?')[1]);
    expect(query.get('strategy')).toBe('CATS@entry=threePtMollyLoose');
    expect(query.get('seed')).toBe('7');
  });
});
