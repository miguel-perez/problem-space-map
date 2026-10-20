// Pure model: opportunity heights and the treemap layout. No DOM, no three.js.
import { hierarchy, treemap, treemapSquarify } from 'd3-hierarchy';

// Each block rises above its parent's top by its own value.
export const BASE = 0.35, STEP = 0.3;
// The treemap covers a 2·WORLD square centred on the origin.
export const WORLD = 100;
// Height per level: tasks stand at their full opportunity, goals and purposes at a fraction of it.
const A_SCALE = { 1: 1, 2: 0.3, 3: 0.22 };

// Sections by id, each with its children in map order.
export function indexSections(map) {
  const byId = new Map();
  for (const s of map.sections) byId.set(s.id, { ...s, children: [] });
  for (const s of byId.values()) if (s.parent && byId.has(s.parent)) byId.get(s.parent).children.push(s);
  return byId;
}

// Importance comes from reach (people relative to the busiest section at the same level); opportunity adds the
// gap between importance and satisfaction. Task satisfaction comes from the map; a goal or purpose takes the
// people-weighted mean of its children.
export function computeHeights(map) {
  const byId = indexSections(map);
  const sat = new Map();
  const satOf = (s) => {
    if (sat.has(s.id)) return sat.get(s.id);
    let v = s.satisfaction ?? 5;
    if (s.level > 1 && s.children.length) {
      const ps = s.children.reduce((t, c) => t + c.people, 0);
      v = ps > 0
        ? s.children.reduce((t, c) => t + satOf(c) * c.people, 0) / ps
        : s.children.reduce((t, c) => t + satOf(c), 0) / s.children.length;
    }
    sat.set(s.id, v);
    return v;
  };
  const out = new Map();
  for (const level of [1, 2, 3]) {
    const secs = [...byId.values()].filter((s) => s.level === level);
    const maxP = Math.max(0, ...secs.map((s) => s.people));
    for (const s of secs) {
      const rr = maxP ? s.people / maxP : 0;
      const imp = 1 + 9 * Math.pow(rr, 0.6);
      const st = satOf(s);
      const opp = imp + Math.max(imp - st, 0);
      out.set(s.id, { rr, imp, sat: st, opp, A: A_SCALE[level] * opp });
    }
  }
  return out;
}

// A squarified treemap: purposes split into goals, goals into tasks; area is people, with streets between
// blocks and a margin inside each parent so its own top shows around its children. Children are sorted by
// the tallest point inside them; the treemap lays the first ones out in the far corner, so tall blocks stand
// behind short ones. Returns each section's footprint centre, size and roof height.
export function layout(map, heights) {
  const byId = indexSections(map);
  const out = new Map();
  const roots = [...byId.values()].filter((s) => !s.parent);
  if (!roots.length) return out;
  const node = (s) => (s.children.length ? { s, children: s.children.map(node) } : { s });
  const stackA = (s) => {
    let a = 0;
    for (let x = s; x; x = x.parent && byId.get(x.parent)) a += heights.get(x.id).A;
    return a;
  };
  const tallest = (n) => (n.children ? Math.max(...n.children.map(tallest)) : stackA(n.data.s));
  const root = hierarchy({ children: roots.map(node) })
    .sum((d) => (d.children ? 0 : Math.max(d.s.people, 0.004)))
    .sort((a, b) => tallest(b) - tallest(a));
  treemap().tile(treemapSquarify).size([2 * WORLD, 2 * WORLD])
    .paddingInner((n) => [7, 3.5, 1.8][n.depth] || 0)
    .paddingOuter((n) => [0, 2.5, 1.6][n.depth] || 0)(root);
  // Parents come before children in breadth-first order, so a parent's top is known when its children need it.
  root.each((n) => {
    if (!n.data.s) return;
    const s = n.data.s, p = s.parent && out.get(s.parent);
    out.set(s.id, {
      x: (n.x0 + n.x1) / 2 - WORLD, z: (n.y0 + n.y1) / 2 - WORLD,
      w: n.x1 - n.x0, d: n.y1 - n.y0,
      top: (p ? p.top + STEP : BASE) + heights.get(s.id).A,
    });
  });
  return out;
}
