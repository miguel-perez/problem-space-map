import { z } from 'zod';

const section = z.strictObject({
  id: z.string().min(1),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  label: z.string().min(1),
  parent: z.string().nullable(),
  people: z.number().int().min(0),
  satisfaction: z.number().min(0).max(10).default(5),
});

const placement = z.strictObject({
  section: z.string().min(1),
  use: z.string().optional(),
});

const solution = z.strictObject({
  name: z.string().min(1),
  kind: z.enum(['product', 'tool']),
  url: z.url().refine((u) => /^https?:\/\//i.test(u), 'url must start with http:// or https://'),
  domain: z.string().regex(/^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$/, 'domain must be a hostname (letters, digits, dots, hyphens)'),
  placements: z.array(placement),
});

export const mapSchema = z
  .strictObject({
    title: z.string(),
    description: z.string(),
    siteUrl: z.string().regex(/^https?:\/\/[^\s/]+\S*\/$/, 'siteUrl must be an http(s) URL ending with /').optional(),
    levels: z.tuple([z.string(), z.string(), z.string()]),
    note: z.string().optional(),
    sections: z.array(section),
    solutions: z.array(solution),
  })
  .superRefine((map, ctx) => {
    const add = (path, message) => ctx.addIssue({ code: 'custom', path, message });
    const byId = new Map();
    map.sections.forEach((s, i) => {
      if (byId.has(s.id)) add(['sections', i, 'id'], `duplicate section id "${s.id}"`);
      else byId.set(s.id, s);
    });
    map.sections.forEach((s, i) => {
      if (s.parent === null) {
        if (s.level !== 3) add(['sections', i, 'parent'], `level-${s.level} section "${s.id}" needs a parent`);
        return;
      }
      if (s.level === 3) add(['sections', i, 'parent'], `level-3 section "${s.id}" must have parent null`);
      const p = byId.get(s.parent);
      if (!p) add(['sections', i, 'parent'], `parent "${s.parent}" of section "${s.id}" does not exist`);
      else if (p.level !== s.level + 1)
        add(['sections', i, 'parent'], `parent "${p.id}" is level ${p.level}, expected level ${s.level + 1} for section "${s.id}"`);
    });
    const names = new Set();
    map.solutions.forEach((sol, i) => {
      if (names.has(sol.name)) add(['solutions', i, 'name'], `duplicate solution name "${sol.name}"`);
      names.add(sol.name);
      sol.placements.forEach((pl, j) => {
        const t = byId.get(pl.section);
        if (!t) add(['solutions', i, 'placements', j, 'section'], `placement section "${pl.section}" does not exist`);
        else if (t.level !== 1)
          add(['solutions', i, 'placements', j, 'section'], `placement section "${pl.section}" must be a level-1 section (is level ${t.level})`);
      });
    });
  });

export function parseMap(json) {
  const r = mapSchema.safeParse(json);
  if (!r.success) {
    const lines = r.error.issues.map((i) => {
      const path = i.path.join('.') || '(root)';
      return `${path}: ${i.message}`;
    });
    throw new Error(`Invalid map.json:\n${lines.join('\n')}`);
  }
  return r.data;
}
