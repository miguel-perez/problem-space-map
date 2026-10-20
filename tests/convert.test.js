import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { convert } from '../scripts/lib/convert.mjs';
import { parseMap } from '../src/schema.js';

const groupsCsv = readFileSync(new URL('./fixtures/groups.csv', import.meta.url), 'utf8');
const meta = { title: 'T', description: 'D', levels: ['Purpose', 'Goal', 'Task'] };
const byId = (m, id) => m.sections.find((s) => s.id === id);

test('maps level3..level1 to 3..1', () => {
  const m = convert({ groupsCsv, meta });
  expect(byId(m, 'g1').level).toBe(3);
  expect(byId(m, 'g2').level).toBe(2);
  expect(byId(m, 'g4').level).toBe(1);
  expect(byId(m, 'g1').label).toBe('Turn talks into findings, trusted');
  expect(m.solutions).toEqual([]);
});

test('roots have parent null', () => {
  const m = convert({ groupsCsv, meta });
  expect(byId(m, 'g1').parent).toBeNull();
  expect(byId(m, 'g4').parent).toBe('g2');
});

test('people parsed as int', () => {
  expect(byId(convert({ groupsCsv, meta }), 'g5').people).toBe(9);
});

test('satisfaction.csv (group_id,satisfaction) is applied', () => {
  const m = convert({ groupsCsv, meta, satisfactionCsv: 'group_id,satisfaction\ng4,2.5\ng5,8\n' });
  expect(byId(m, 'g4').satisfaction).toBe(2.5);
  expect(byId(m, 'g5').satisfaction).toBe(8);
  expect(byId(m, 'g6').satisfaction).toBe(5);
  expect(() => convert({ groupsCsv, meta, satisfactionCsv: 'group_id,satisfaction\nnope,3\n' })).toThrow(/nope/);
});

test('a blank satisfaction cell keeps the default; bad values throw', () => {
  const m = convert({ groupsCsv, meta, satisfactionCsv: 'group_id,satisfaction\ng4,\ng5, \n' });
  expect(byId(m, 'g4').satisfaction).toBe(5);
  expect(byId(m, 'g5').satisfaction).toBe(5);
  expect(() => convert({ groupsCsv, meta, satisfactionCsv: 'group_id,satisfaction\ng4,abc\n' })).toThrow(/g4/);
  expect(() => convert({ groupsCsv, meta, satisfactionCsv: 'group_id,satisfaction\ng4,11\n' })).toThrow(/g4/);
});

test('an unknown level throws with the group id', () => {
  const bad = 'group_id,level,label,parent_id,parent_label,summaries,people\ng1,level4,X,,,1,2\n';
  expect(() => convert({ groupsCsv: bad, meta })).toThrow(/g1.*level4/);
});

test('output passes parseMap', () => {
  const m = convert({ groupsCsv, meta });
  expect(() => parseMap(m)).not.toThrow();
});
