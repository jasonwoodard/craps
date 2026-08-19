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
