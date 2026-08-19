import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, it, expect } from 'vitest';
import { Shell } from '../Shell';

describe('Shell', () => {
  it('renders every nav destination', () => {
    render(
      <MemoryRouter initialEntries={['/session']}>
        <Shell><p>content</p></Shell>
      </MemoryRouter>,
    );

    for (const label of ['Session', 'Session Compare', 'Distribution', 'Dist\\. Compare', 'Strategies', 'Guide']) {
      expect(screen.getByRole('link', { name: new RegExp(`${label}$`) })).toBeInTheDocument();
    }
  });

  it('carries shared run params forward when navigating', () => {
    render(
      <MemoryRouter initialEntries={['/session?strategy=CATS&rolls=250&bankroll=300&seed=7']}>
        <Shell><p>content</p></Shell>
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: /Distribution$/ });
    expect(link.getAttribute('href')).toContain('strategy=CATS');
    expect(link.getAttribute('href')).toContain('seed=7');
  });
});
