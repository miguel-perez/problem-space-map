import { test, expect } from 'vitest';
import { parseMap } from '../src/schema.js';

const base = () => ({
  title: 'T',
  description: 'D',
  levels: ['Purpose', 'Goal', 'Task'],
  sections: [
    { id: 'p', level: 3, label: 'P', parent: null, people: 10, satisfaction: 7 },
    { id: 'g', level: 2, label: 'G', parent: 'p', people: 5 },
    { id: 't', level: 1, label: 'T', parent: 'g', people: 2 },
  ],
  solutions: [
    { name: 'A', kind: 'product', url: 'https://a.example', domain: 'a.example', placements: [{ section: 't', use: 'x' }] },
  ],
});

test('accepts a minimal valid map', () => {
  const m = parseMap(base());
  expect(m.sections).toHaveLength(3);
  expect(m.solutions[0].placements[0].section).toBe('t');
});

test('rejects a section whose parent id does not exist', () => {
  const j = base();
  j.sections[1].parent = 'missing-id';
  expect(() => parseMap(j)).toThrow(/missing-id/);
});

test('rejects a placement on a non-level-1 section', () => {
  const j = base();
  j.solutions[0].placements[0].section = 'g';
  expect(() => parseMap(j)).toThrow(/level-1/);
});

test('rejects duplicate section ids', () => {
  const j = base();
  j.sections[2].id = 'g';
  expect(() => parseMap(j)).toThrow(/duplicate/i);
});

test('defaults satisfaction to 5', () => {
  const m = parseMap(base());
  expect(m.sections[1].satisfaction).toBe(5);
  expect(m.sections[0].satisfaction).toBe(7);
});

test('rejects unknown keys', () => {
  const j = base();
  j.sections[0].evidence = 'quote';
  expect(() => parseMap(j)).toThrow(/evidence/);
  const k = base();
  k.solutions[0].voices = [];
  expect(() => parseMap(k)).toThrow(/voices/);
  const l = base();
  l.category = 'x';
  expect(() => parseMap(l)).toThrow(/category/);
});

test('rejects parent level mismatch, bad roots, duplicate solutions; lists every problem', () => {
  const j = base();
  j.sections[2].parent = 'p'; // level 1 under level 3
  j.sections[0].parent = 'g'; // level 3 with parent
  j.solutions.push({ ...j.solutions[0] });
  let msg = '';
  try { parseMap(j); } catch (e) { msg = e.message; }
  expect(msg).toMatch(/level/);
  expect(msg).toMatch(/duplicate solution/i);
  expect(msg.split('\n').length).toBeGreaterThanOrEqual(3);
});

test('rejects non-http(s) solution urls', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,hi', 'ftp://a.example']) {
    const j = base();
    j.solutions[0].url = url;
    expect(() => parseMap(j), url).toThrow(/url/);
  }
});

test('rejects domains that are not hostname-shaped', () => {
  for (const domain of ['a/b.png', '../x', 'a b.com', 'https://a.example', '']) {
    const j = base();
    j.solutions[0].domain = domain;
    expect(() => parseMap(j), domain).toThrow(/domain/);
  }
  const ok = base();
  ok.solutions[0].domain = 'my-app.example.com';
  expect(() => parseMap(ok)).not.toThrow();
});

test('siteUrl must be an http(s) URL ending with /', () => {
  expect(parseMap({ ...base(), siteUrl: 'https://x.example/map/' }).siteUrl).toBe('https://x.example/map/');
  for (const u of ['https://x.example', 'ftp://x.example/', 'x.example/', 'https://x.example/a b/', '/']) {
    expect(() => parseMap({ ...base(), siteUrl: u }), u).toThrow();
  }
});
