import { test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { parseMap } from '../src/schema.js';

const raw = JSON.parse(readFileSync(new URL('../examples/ux-research/map.json', import.meta.url), 'utf8'));

test('ux example parses', () => {
  expect(() => parseMap(raw)).not.toThrow();
});

test('has 60 tasks', () => {
  expect(raw.sections.filter((s) => s.level === 1)).toHaveLength(60);
});

test('only schema fields present', () => {
  const top = ['title', 'description', 'siteUrl', 'levels', 'note', 'sections', 'solutions'];
  const sec = ['id', 'level', 'label', 'parent', 'people', 'satisfaction'];
  const sol = ['name', 'kind', 'url', 'domain', 'placements'];
  const pl = ['section', 'use'];
  const bad = (o, allowed) => Object.keys(o).filter((k) => !allowed.includes(k));
  expect(bad(raw, top)).toEqual([]);
  for (const s of raw.sections) expect(bad(s, sec)).toEqual([]);
  for (const s of raw.solutions) {
    expect(bad(s, sol)).toEqual([]);
    for (const p of s.placements) expect(bad(p, pl)).toEqual([]);
  }
});

test('every solution domain has public/logos/<domain>.png', () => {
  const missing = raw.solutions
    .map((s) => s.domain)
    .filter((d) => !existsSync(new URL(`../public/logos/${d}.png`, import.meta.url)));
  expect(missing).toEqual([]);
});
