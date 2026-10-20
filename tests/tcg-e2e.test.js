import { test, expect } from 'vitest';
import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { csvParse } from 'd3-dsv';
import { build } from 'vite';
import { convert } from '../scripts/lib/convert.mjs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const groupsCsv = read('./fixtures/tcg/groups.csv');
const satisfactionCsv = read('./fixtures/tcg/satisfaction.csv');
const solutions = JSON.parse(read('../examples/tcg-players/solutions.json'));
const meta = {
  title: 'Trading Card Game Players Problem Space Map',
  description: 'What trading card game players are trying to get done, grouped by purpose, with how satisfied they are and the products they use.',
  levels: ['Purpose', 'Goal', 'Task'],
};
const make = () => convert({ groupsCsv, satisfactionCsv, solutions, meta });

test('fixture groups.csv + satisfaction.csv + solutions convert to a valid map', () => {
  const map = make();
  expect(map.sections).toHaveLength(78);
  expect(map.solutions).toHaveLength(14);
  expect(map.siteUrl).toBeUndefined();
});

test('every level-1 group in groups.csv is a task', () => {
  const map = make();
  const ids = csvParse(groupsCsv).filter((r) => r.level === 'level1').map((r) => r.group_id);
  expect(ids).toHaveLength(57);
  const tasks = new Set(map.sections.filter((s) => s.level === 1).map((s) => s.id));
  for (const id of ids) expect(tasks.has(id)).toBe(true);
});

test('satisfaction comes from satisfaction.csv', () => {
  const map = make();
  for (const r of csvParse(satisfactionCsv)) {
    expect(map.sections.find((s) => s.id === r.group_id).satisfaction).toBeCloseTo(Number(r.satisfaction), 5);
  }
});

test('vite build of the map contains the title and a task label', async () => {
  const map = make();
  const dir = 'examples/.e2e-tcg';
  const outDir = 'dist-e2e-tcg';
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/map.json`, JSON.stringify(map));
  const prev = process.env.MAP;
  process.env.MAP = `${dir}/map.json`;
  try {
    await build({ logLevel: 'silent', build: { outDir, emptyOutDir: true } });
    const html = readFileSync(`${outDir}/index.html`, 'utf8');
    const task = map.sections.find((s) => s.level === 1);
    expect(html).toContain(meta.title);
    expect(html).toContain(task.label.replace(/&/g, '&amp;'));
  } finally {
    if (prev === undefined) delete process.env.MAP; else process.env.MAP = prev;
    rmSync(dir, { recursive: true, force: true });
    rmSync(outDir, { recursive: true, force: true });
  }
}, 120_000);
