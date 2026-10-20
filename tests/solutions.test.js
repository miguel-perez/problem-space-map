import { test, expect } from 'vitest';
import { gridFor, unitsByTask, logoUrlFor, GRID_STEP, BASE_R } from '../src/solutions.js';

test('gridFor keeps bases inside the roof', () => {
  for (const [w, d] of [[4.6, 19], [30, 30]]) {
    for (let n = 1; n <= 9; n++) {
      const { L, cols, rows } = gridFor(n, w, d);
      expect(L).toBeGreaterThan(0);
      expect(cols * rows).toBeGreaterThanOrEqual(n);
      expect(L * (GRID_STEP * (cols - 1) + 2 * BASE_R)).toBeLessThanOrEqual(w + 1e-9);
      expect(L * (GRID_STEP * (rows - 1) + 2 * BASE_R)).toBeLessThanOrEqual(d + 1e-9);
    }
  }
});

test('unitsByTask lists products before general tools', () => {
  const sol = (name, kind, ...sections) => ({ name, kind, url: 'https://x.test', domain: 'x.test', placements: sections.map((section) => ({ section, use: name + ' use' })) });
  const units = unitsByTask({ solutions: [sol('Sheets', 'tool', 't1'), sol('A', 'product', 't1', 't2'), sol('B', 'product', 't1')] });
  expect(units.get('t1').map((u) => u.sol.name)).toEqual(['A', 'B', 'Sheets']);
  expect(units.get('t2')[0].use).toBe('A use');
});

test('logoUrlFor only points at logos that exist', () => {
  const logos = ['dovetail.com.png', 'miro.com.png'];
  expect(logoUrlFor('/problem-space-map/', logos, 'miro.com')).toBe('/problem-space-map/logos/miro.com.png');
  expect(logoUrlFor('/problem-space-map/', logos, 'nologo.example')).toBeNull();
  expect(logoUrlFor('/', [], 'miro.com')).toBeNull();
});
