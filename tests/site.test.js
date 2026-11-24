import { test, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

test('build:site writes the UX map at dist/ and the TCG map at dist/tcg/ under its own base', () => {
  execSync('npm run build:site', { stdio: 'ignore' });
  const ux = readFileSync('dist/index.html', 'utf8');
  const tcg = readFileSync('dist/tcg/index.html', 'utf8');
  expect(ux).toContain('UX Research Problem Space Map');
  expect(ux).not.toContain('Card Game');
  expect(tcg).toContain('Card Game Ecosystem Problem Space Map');
  expect(tcg).toContain('href="https://miguel.design/problem-space-map/tcg/"');
  const urls = [...tcg.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map((m) => m[1]);
  expect(urls.length).toBeGreaterThan(0);
  for (const u of urls) expect(u.startsWith('/problem-space-map/tcg/'), u).toBe(true);
  const js = readdirSync('dist/tcg/assets').filter((f) => f.endsWith('.js')).map((f) => readFileSync(`dist/tcg/assets/${f}`, 'utf8')).join('');
  expect(js).toContain('/problem-space-map/tcg/');
  expect(existsSync('dist/tcg/og.png')).toBe(true);
  expect(existsSync('dist/tcg/logos/tcgplayer.com.png')).toBe(true);
  expect(existsSync('dist/logos/tcgplayer.com.png')).toBe(false);
  expect(readFileSync('dist/tcg/sitemap.xml', 'utf8')).toContain('/problem-space-map/tcg/');
}, 240_000);
