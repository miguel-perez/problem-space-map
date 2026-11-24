// Screenshots for the README and the social card. Builds each example, serves it with `vite preview` and
// drives it with Playwright (chromium). Run: npm run screenshots
//   docs/images/overview.webp, selection.webp, pinned-solution.webp, tooltip.webp   UX map, 1600×1000 @1.25x
//   examples/<map>/og.png                                                           1200×630 @1x, next to each map
// WebP needs `cwebp` (brew install webp); without it the PNGs are kept.
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { chromium } from '@playwright/test';

const PORT = 4179;
const URL = `http://localhost:${PORT}/problem-space-map/`;
const SCALE = 1.25;
const SETTLE = 1500; // logos load and the fly animation ends
mkdirSync('docs/images', { recursive: true });

async function serve(map, outDir) {
  execSync(`npx vite build --outDir ${outDir} --emptyOutDir`, { stdio: 'inherit', env: { ...process.env, MAP: map } });
  const p = spawn('npx', ['vite', 'preview', '--outDir', outDir, '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(URL)).ok) return p; } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  p.kill();
  throw new Error('preview server did not start');
}

async function open(browser, viewport, deviceScaleFactor) {
  const page = await browser.newPage({ viewport, deviceScaleFactor });
  await page.goto(URL);
  await page.locator('#view canvas').waitFor();
  await page.waitForTimeout(SETTLE);
  return page;
}

// No hover left over from loading: the pointer is off the canvas.
async function clearHover(page) {
  await page.mouse.move(0, 0);
  await page.locator('#view canvas').dispatchEvent('pointerleave');
  await page.waitForTimeout(300);
}

function hasCwebp() {
  try { execSync('cwebp -version', { stdio: 'ignore' }); return true; } catch { return false; }
}
const WEBP = hasCwebp();
if (!WEBP) console.warn('cwebp not found: keeping docs images as PNG (larger)');

// Writes `path` (.webp when cwebp is available, else .png). Pass a .png path for files that must stay PNG.
async function shot(page, path) {
  if (!WEBP || !path.endsWith('.webp')) {
    path = path.replace(/\.webp$/, '.png');
    await page.screenshot({ path });
  } else {
    const tmp = path.replace(/\.webp$/, '.tmp.png');
    await page.screenshot({ path: tmp });
    execSync(`cwebp -quiet -q 82 -m 6 "${tmp}" -o "${path}"`);
    rmSync(tmp);
  }
  console.log('wrote', path, Math.round(statSync(path).size / 1024) + ' KB');
}

// Points on the screen where a logo badge is likely: the most saturated pixels (logos are the only colour).
async function colourfulPoints(page) {
  const png = (await page.screenshot()).toString('base64');
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    const scale = img.width / innerWidth, pts = [], step = 12;
    for (let py = 80; py < innerHeight - 20; py += step) {
      for (let px = 20; px < innerWidth - 20; px += step) {
        const i = (Math.round(py * scale) * c.width + Math.round(px * scale)) * 4;
        const r = d[i], g = d[i + 1], bl = d[i + 2];
        const sat = Math.max(r, g, bl) - Math.min(r, g, bl);
        if (sat > 90) pts.push({ x: px, y: py, sat });
      }
    }
    // Spread out: keep points from different parts of the screen, nearest the middle first.
    pts.sort((a, b) => Math.hypot(a.x - innerWidth / 2, a.y - innerHeight / 2) - Math.hypot(b.x - innerWidth / 2, b.y - innerHeight / 2));
    return pts;
  }, png);
}

async function pinSolution(page, name) {
  const sol = page.locator('.crumb.product');
  await sol.locator('> button').click();
  await sol.locator('.menu button', { hasText: name }).first().click();
}

const browser = await chromium.launch();
let server;
try {
  // ── UX research map ──
  server = await serve('examples/ux-research/map.json', 'dist-e2e-shots');
  const vp = { width: 1600, height: 1000 };

  let page = await open(browser, vp, SCALE);
  await clearHover(page);
  await shot(page, 'docs/images/overview.webp');

  // A goal chosen from the Goal dropdown: the view flies to it and it glows.
  const goal = page.locator('.crumb').nth(1);
  await goal.locator('> button').click();
  await goal.locator('.menu button').nth(1).click();
  await page.waitForTimeout(SETTLE);
  await clearHover(page);
  await shot(page, 'docs/images/selection.webp');
  await page.close();

  // A product pinned from the Solutions dropdown: arcs in its colour join every task it serves.
  page = await open(browser, vp, SCALE);
  await pinSolution(page, process.env.PIN || 'Dovetail');
  await page.waitForTimeout(SETTLE);
  await clearHover(page);
  await shot(page, 'docs/images/pinned-solution.webp');
  await page.close();

  // Hovering a logo badge: its tooltip says what people do with it on that task.
  page = await open(browser, vp, SCALE);
  await clearHover(page);
  let found = false;
  for (const p of (await colourfulPoints(page)).slice(0, 400)) {
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(80);
    if (await page.locator('.tip.on .use').count()) { found = true; break; }
  }
  if (!found) throw new Error('no solution badge with a tooltip found');
  await page.waitForTimeout(600);
  await shot(page, 'docs/images/tooltip.webp');
  await page.close();

  // Social card.
  page = await open(browser, { width: 1200, height: 630 }, 1);
  await clearHover(page);
  await shot(page, 'examples/ux-research/og.png');
  await page.close();
  server.kill();

  // ── Card game ecosystem map (live at /tcg/) ──
  server = await serve('examples/tcg-ecosystem/map.json', 'dist-e2e-shots');
  page = await open(browser, { width: 1200, height: 630 }, 1);
  await clearHover(page);
  await shot(page, 'examples/tcg-ecosystem/og.png');
  await page.close();
} finally {
  server?.kill();
  await browser.close();
  rmSync('dist-e2e-shots', { recursive: true, force: true });
}
