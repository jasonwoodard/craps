import { test, expect } from '@playwright/test';

/**
 * Mobile-viewport suite. The desktop analytics app is deliberately not built
 * for phones (webui-plan.md §1), so this project does NOT run the desktop
 * smoke specs — it covers what is meant to work on a phone.
 *
 * W3 fills this out with the `/reference` redirect matrix and the ladder
 * fixture; for now it pins that the app boots at a phone viewport and that the
 * stage metadata a phone-sized reference will read is reachable.
 */

test('the app boots at a phone viewport without page errors', async ({ page }) => {
  const failures: string[] = [];
  page.on('pageerror', err => failures.push(err.message));

  await page.goto('/strategies/cats');
  await expect(page.getByRole('heading', { name: 'CATS', exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('ladder')).toBeVisible();
  expect(failures, 'uncaught page errors').toEqual([]);
});

test('stage metadata is served with gates scaled to the table minimum', async ({ request }) => {
  const res = await request.get('/api/meta/strategies?tableMin=25');
  expect(res.ok()).toBe(true);

  const catalog = await res.json();
  expect(catalog.tableMin).toBe(25);
  const cats = catalog.strategies.find((s: { name: string }) => s.name === 'CATS');
  const gates = Object.fromEntries(cats.stages.map((s: { slug: string; gate: number }) => [s.slug, s.gate]));
  // 7u / 15u / 25u / 40u at a $25 table.
  expect(gates.littleMolly).toBe(175);
  expect(gates.threePtMollyTight).toBe(375);
  expect(gates.threePtMollyLoose).toBe(625);
  expect(gates.maxAlpha).toBe(1000);
});
