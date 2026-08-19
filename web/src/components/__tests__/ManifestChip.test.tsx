import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { RunManifest } from '@shared/manifest';
import { ManifestChip } from '../ManifestChip';

const MANIFEST: RunManifest = {
  schemaVersion: 1,
  strategySpec: 'CATS@entry=threePtMollyLoose',
  tableMin: 10,
  bankroll: 300,
  rolls: 500,
  seeds: { seed: 42 },
  engineVersion: 'abc1234',
  generatedAt: '2026-08-19T00:00:00.000Z',
};

afterEach(() => vi.unstubAllGlobals());

describe('ManifestChip', () => {
  it('summarises the run identity, spec first', () => {
    render(<ManifestChip manifest={MANIFEST} />);
    const chip = screen.getByRole('button', { name: /CATS@entry=threePtMollyLoose/ });
    expect(chip).toHaveTextContent('$10 table');
    expect(chip).toHaveTextContent('$300 buy-in');
    expect(chip).toHaveTextContent('500 rolls');
    expect(chip).toHaveTextContent('seed 42');
  });

  it('labels a seed range for multi-session runs', () => {
    render(<ManifestChip manifest={{ ...MANIFEST, seeds: { count: 500 } }} />);
    expect(screen.getByRole('button', { name: /seeds 0–499/ })).toBeInTheDocument();
  });

  it('expands to the full manifest and copies it as JSON', async () => {
    // user-event installs a clipboard stub on navigator for the duration of
    // the test, so the chip's write is observable through readText().
    const user = userEvent.setup();

    render(<ManifestChip manifest={MANIFEST} />);
    expect(screen.queryByText('engineVersion')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /CATS@entry/ }));
    expect(screen.getByText('engineVersion')).toBeInTheDocument();
    expect(screen.getByText('abc1234')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Copy as JSON' }));
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(JSON.parse(await navigator.clipboard.readText())).toEqual(MANIFEST);
  });

  it('renders a note beside the chip when the result was memoized', () => {
    render(<ManifestChip manifest={MANIFEST} note="served from cache" />);
    expect(screen.getByText('served from cache')).toBeInTheDocument();
  });

  it('renders nothing without a manifest', () => {
    const { container } = render(<ManifestChip manifest={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
