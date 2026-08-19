import { test, expect } from '@playwright/test';

/**
 * Every nav destination loads and renders its heading, with no uncaught page
 * errors. Runs are kept small and seeded so the suite is fast and repeatable.
 */
const RUN = 'rolls=120&bankroll=300&seed=42';

const DESTINATIONS = [
  { path: `/session?strategy=CATS&${RUN}`,                                  heading: 'Session' },
  { path: `/session-compare?strategies=CATS,PassLineOnly&${RUN}`,           heading: 'Session Compare' },
  { path: `/distribution?strategy=CATS&${RUN}&seeds=20`,                    heading: 'Distribution Analysis' },
  { path: `/distribution-compare?strategy=CATS&test=PassLineOnly&${RUN}&seeds=20`, heading: 'Distribution Compare' },
  { path: '/strategies',                                                     heading: 'Strategies' },
  { path: '/guide',                                                          heading: 'Guide' },
];

for (const { path, heading } of DESTINATIONS) {
  test(`loads ${heading}`, async ({ page }) => {
    const failures: string[] = [];
    page.on('pageerror', err => failures.push(err.message));

    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible({ timeout: 60_000 });
    expect(failures, `uncaught page errors on ${path}`).toEqual([]);
  });
}

test('the API serves the strategy catalog', async ({ request }) => {
  const res = await request.get('/api/strategies');
  expect(res.ok()).toBe(true);
  expect(await res.json()).toContain('CATS');
});

test('a funded-entry CATS session reports its spec in the manifest chip', async ({ page }) => {
  await page.goto('/session?strategy=CATS&rolls=120&bankroll=300&seed=42');
  await expect(page.getByRole('heading', { name: 'Session', exact: true })).toBeVisible({ timeout: 60_000 });

  // Pick the entry stage by its metadata display name, exactly as a user would.
  await page.getByRole('button', { name: /Entry Stage/ }).click();
  await page.getByRole('option', { name: /3-Point Molly — Loose/ }).click();
  await page.getByRole('button', { name: /Run/ }).click();

  const chip = page.getByTestId('manifest-chip');
  await expect(chip).toContainText('CATS@entry=threePtMollyLoose', { timeout: 60_000 });
  await expect(chip).toContainText('$10 table');
  await expect(chip).toContainText('$300 buy-in');
  await expect(chip).toContainText('seed 42');

  // The URL is the spec, so the view is shareable and reproducible.
  expect(new URL(page.url()).searchParams.get('strategy')).toBe('CATS@entry=threePtMollyLoose');
});

test('the table minimum reaches the manifest through the spec', async ({ page }) => {
  await page.goto('/session?strategy=CATS&rolls=120&bankroll=450&seed=7');
  await expect(page.getByRole('heading', { name: 'Session', exact: true })).toBeVisible({ timeout: 60_000 });

  await page.getByRole('button', { name: /Table Min/ }).click();
  await page.getByRole('option', { name: '$15' }).click();
  await page.getByRole('button', { name: /Run/ }).click();

  const chip = page.getByTestId('manifest-chip');
  await expect(chip).toContainText('CATS@tableMin=15', { timeout: 60_000 });
  await expect(chip).toContainText('$15 table');
});

test('the distribution view carries its manifest too', async ({ page }) => {
  await page.goto('/distribution?strategy=CATS&rolls=120&bankroll=300&seeds=20');
  const chip = page.getByTestId('manifest-chip');
  await expect(chip).toContainText('CATS', { timeout: 60_000 });
  await expect(chip).toContainText('seeds 0–19');
});
