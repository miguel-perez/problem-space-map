import { test, expect } from '@playwright/test';

// Runs against the one build made from the current MAP (see playwright.config.js). To check another map, run
// `MAP=examples/<name>/map.json npm run e2e`; each run covers one map.
let errors;
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
    // vite preview answers a missing file with index.html, where GitHub Pages would 404; a logo request must
    // come back as an image.
    else if (r.url().includes('/logos/') && !(r.headers()['content-type'] || '').startsWith('image/')) errors.push(`not an image: ${r.url()}`);
  });
  await page.goto('./');
  await expect(page.locator('#view canvas')).toBeVisible();
  await expect(page.locator('.crumb')).toHaveCount(4);
});

test('loads with no console errors or failed requests', async ({ page }) => {
  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
});

test('four dropdowns visible at equal width', async ({ page }) => {
  const widths = await page.locator('.crumb > button').evaluateAll((bs) => bs.map((b) => b.getBoundingClientRect().width));
  expect(widths).toHaveLength(4);
  for (const w of widths) expect(Math.abs(w - widths[0])).toBeLessThan(1);
});

test('choosing a purpose updates the Goal menu', async ({ page }) => {
  const crumbs = page.locator('.crumb');
  const allGoals = await crumbs.nth(1).locator('.menu button').count();
  const purposes = await crumbs.nth(0).locator('.menu button').count();
  await crumbs.nth(0).locator('> button').click();
  await crumbs.nth(0).locator('.menu button').first().click();
  expect(await page.locator('main.stage').getAttribute('data-selected')).not.toBe('');
  await expect(crumbs.nth(0)).toHaveClass(/cur/);
  // The Goal menu now lists only goals inside that purpose.
  const goals = await crumbs.nth(1).locator('.menu button').count();
  expect(goals).toBeGreaterThan(0);
  if (purposes > 1) expect(goals).toBeLessThan(allGoals);
  else expect(goals).toBe(allGoals);
});

test('pinning a solution, then clicking background clears it', async ({ page }) => {
  const sol = page.locator('.crumb.product');
  await sol.locator('> button').click();
  // The first solution listed in this map's Solutions menu.
  const first = sol.locator('.menu button').first();
  const name = (await first.locator('span').first().textContent()).trim();
  await first.click();
  await expect(page.locator('main.stage')).toHaveAttribute('data-pinned', 'p:' + name);
  await expect(sol.locator('> button')).toContainText(name);
  // Bottom-left corner of the window is open floor.
  const vp = page.viewportSize();
  await page.mouse.click(12, vp.height - 12);
  await expect(page.locator('main.stage')).toHaveAttribute('data-pinned', '');
});
