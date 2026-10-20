import { test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { productsTable, replaceBlock } from '../scripts/products-table.mjs';

const readme = readFileSync('README.md', 'utf8');
const map = (p) => JSON.parse(readFileSync(p, 'utf8'));

test('README products table matches the UX map (run npm run docs:products)', () => {
  const fresh = replaceBlock(readme, 'products', productsTable(map('examples/ux-research/map.json')));
  expect(readme).toBe(fresh);
});

test('every product on the UX map is linked in the README', () => {
  for (const s of map('examples/ux-research/map.json').solutions) expect(readme).toContain(`](${s.url})`);
});

test('images and local links in README and AGENTS.md exist', () => {
  for (const file of ['README.md', 'AGENTS.md']) {
    const text = readFileSync(file, 'utf8');
    for (const [, target] of text.matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)) {
      if (/^https?:/.test(target)) continue;
      expect(existsSync(target), `${file} links ${target}`).toBe(true);
    }
  }
  for (const m of ['ux-research', 'tcg-players']) expect(existsSync(`examples/${m}/og.png`), m).toBe(true);
  expect(existsSync('public/og.png')).toBe(false);
});

test('package.json scripts named in the docs exist', () => {
  const scripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts;
  const text = readme + readFileSync('AGENTS.md', 'utf8');
  for (const [, name] of text.matchAll(/npm run ([\w:-]+)/g)) expect(scripts[name], name).toBeDefined();
});
