import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseMap } from '../src/schema.js';
import { computeHeights, layout } from '../src/model.js';

const sec = (id, level, parent, people, satisfaction) => ({ id, level, label: id, parent, people, satisfaction });
const mapOf = (sections, solutions = []) => parseMap({ title: 't', description: 'd', levels: ['P', 'G', 'T'], sections, solutions });

test('heights rise with people and with unmet satisfaction', () => {
  const map = mapOf([
    sec('p', 3, null, 10), sec('g', 2, 'p', 10),
    sec('few', 1, 'g', 2, 5), sec('many', 1, 'g', 10, 5),
    sec('met', 1, 'g', 10, 9), sec('unmet', 1, 'g', 10, 1),
  ]);
  const h = computeHeights(map);
  expect(h.get('many').A).toBeGreaterThan(h.get('few').A);
  expect(h.get('unmet').A).toBeGreaterThan(h.get('met').A);
  // Task: importance 1 + 9·rr^0.6 = 10 at full reach; opportunity adds the unmet part.
  expect(h.get('unmet').opp).toBeCloseTo(10 + 9);
  expect(h.get('met').opp).toBeCloseTo(10 + 1);
  // Goal and purpose heights are scaled down, and their satisfaction is the people-weighted mean of children.
  expect(h.get('g').A).toBeCloseTo(0.3 * h.get('g').opp);
  expect(h.get('p').A).toBeCloseTo(0.22 * h.get('p').opp);
  expect(h.get('g').sat).toBeCloseTo((2 * 5 + 10 * 5 + 10 * 9 + 10 * 1) / 32);
});

const inside = (c, p) => c.x - c.w / 2 >= p.x - p.w / 2 - 1e-9 && c.x + c.w / 2 <= p.x + p.w / 2 + 1e-9
  && c.z - c.d / 2 >= p.z - p.d / 2 - 1e-9 && c.z + c.d / 2 <= p.z + p.d / 2 + 1e-9;

test('layout handles single-child and empty-solution sections', () => {
  const map = mapOf([
    sec('p1', 3, null, 5), sec('g1', 2, 'p1', 5), sec('t1', 1, 'g1', 5),
    sec('p2', 3, null, 0), sec('g2', 2, 'p2', 0),            // a goal with no tasks, nobody counted
    sec('p3', 3, null, 9), sec('g3', 2, 'p3', 9), sec('t3', 1, 'g3', 0), sec('t4', 1, 'g3', 9),
  ]);
  const rects = layout(map, computeHeights(map));
  expect(rects.size).toBe(map.sections.length);
  for (const s of map.sections) {
    const r = rects.get(s.id);
    for (const k of ['x', 'z', 'w', 'd', 'top']) expect(Number.isFinite(r[k]), `${s.id}.${k}`).toBe(true);
    if (s.parent) {
      const p = rects.get(s.parent);
      expect(inside(r, p), `${s.id} inside ${s.parent}`).toBe(true);
      expect(r.top).toBeGreaterThan(p.top);
    }
  }
});

test('layout of the ux example nests every section in its parent', () => {
  const map = parseMap(JSON.parse(readFileSync(new URL('../examples/ux-research/map.json', import.meta.url), 'utf8')));
  const rects = layout(map, computeHeights(map));
  for (const s of map.sections) if (s.parent) expect(inside(rects.get(s.id), rects.get(s.parent))).toBe(true);
});
