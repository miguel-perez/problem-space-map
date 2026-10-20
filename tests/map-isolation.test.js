import { test, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync, copyFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'vite';
import { loadMap } from '../vite/seo-plugin.js';

const sha = (b) => createHash('sha256').update(b).digest('hex');
let lastOg; // hash of og.png in the last build, or null

// Build with MAP set, return every emitted text file joined, then clean up.
async function buildWith(mapPath, outDir) {
  const prev = process.env.MAP;
  process.env.MAP = mapPath;
  try {
    await build({ logLevel: 'silent', build: { outDir, emptyOutDir: true } });
    const files = readdirSync(outDir, { recursive: true });
    lastOg = existsSync(`${outDir}/og.png`) ? sha(readFileSync(`${outDir}/og.png`)) : null;
    // File names count too: a logo file names its product.
    return files.join('\n') + '\n' + files.filter((f) => /\.(js|html|xml|txt)$/.test(f))
      .map((f) => readFileSync(`${outDir}/${f}`, 'utf8')).join('\n');
  } finally {
    if (prev === undefined) delete process.env.MAP; else process.env.MAP = prev;
    rmSync(outDir, { recursive: true, force: true });
  }
}

test('the UX build ships only the UX map', async () => {
  const out = await buildWith('examples/ux-research/map.json', 'dist-iso-ux');
  expect(out).toContain('UX Research Problem Space Map');
  expect(out).toContain('logos/zoom.us.png');
  expect(out).not.toMatch(/Trading Card Game|Digimon|cardmarket/i);
}, 120_000);

test('the TCG build ships only the TCG map, with a ./ path', async () => {
  const out = await buildWith('./examples/tcg-players/map.json', 'dist-iso-tcg');
  expect(out).toContain('Trading Card Game Players Problem Space Map');
  expect(out).not.toMatch(/UX Research Problem Space Map|usertesting|condens/i);
}, 120_000);

test('MAP accepts relative, ./ and absolute paths', () => {
  const root = process.cwd();
  const want = resolve(root, 'examples/ux-research/map.json');
  for (const p of ['examples/ux-research/map.json', './examples/ux-research/map.json', want]) {
    expect(loadMap(root, p).file).toBe(want);
  }
});

test('a missing or invalid MAP fails the build with a clear error', async () => {
  await expect(buildWith('examples/nope/map.json', 'dist-iso-bad')).rejects.toThrow(/MAP: no file at examples\/nope\/map\.json/);
  const dir = 'examples/.iso-invalid';
  mkdirSync(dir, { recursive: true });
  try {
    writeFileSync(`${dir}/map.json`, '{"title": 1}');
    await expect(buildWith(`${dir}/map.json`, 'dist-iso-bad')).rejects.toThrow(/MAP: .* is not a valid map/);
    writeFileSync(`${dir}/map.json`, '{nope');
    await expect(buildWith(`${dir}/map.json`, 'dist-iso-bad')).rejects.toThrow(/not valid JSON/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 120_000);

test('each build ships its own map\'s og.png, and a map without one ships none', async () => {
  const ux = sha(readFileSync('examples/ux-research/og.png'));
  const tcg = sha(readFileSync('examples/tcg-players/og.png'));
  expect(ux).not.toBe(tcg);
  const uxOut = await buildWith('examples/ux-research/map.json', 'dist-iso-og1');
  expect(lastOg).toBe(ux);
  expect(uxOut).toContain('og:image');
  await buildWith('examples/tcg-players/map.json', 'dist-iso-og2');
  expect(lastOg).toBe(tcg);
  const dir = 'examples/.iso-noog';
  mkdirSync(dir, { recursive: true });
  try {
    copyFileSync('examples/ux-research/map.json', `${dir}/map.json`);
    const out = await buildWith(`${dir}/map.json`, 'dist-iso-og3');
    expect(lastOg).toBeNull();
    expect(out).not.toMatch(/og:image|twitter:image/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 180_000);
