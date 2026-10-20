import { csvParse } from 'd3-dsv';
import { parseMap } from '../../src/schema.js';

const LEVELS = { level1: 1, level2: 2, level3: 3 };

export function convert({ groupsCsv, satisfactionCsv, solutions = [], meta }) {
  const sections = csvParse(groupsCsv).map((r) => {
    const level = LEVELS[r.level];
    if (!level) throw new Error(`group ${r.group_id}: unknown level "${r.level}"`);
    return {
      id: r.group_id,
      level,
      label: r.label,
      parent: r.parent_id ? r.parent_id : null,
      people: Number.parseInt(r.people, 10),
    };
  });
  if (satisfactionCsv) {
    const byId = new Map(sections.map((s) => [s.id, s]));
    for (const r of csvParse(satisfactionCsv)) {
      const s = byId.get(r.group_id);
      if (!s) throw new Error(`satisfaction.csv: unknown group_id "${r.group_id}"`);
      // A blank cell is not a measure: skip it so the task keeps the default.
      const v = (r.satisfaction ?? '').trim();
      if (v === '') continue;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 10) throw new Error(`satisfaction.csv: group ${r.group_id}: "${v}" is not a number from 0 to 10`);
      s.satisfaction = n;
    }
  }
  const { title, description, levels, note, siteUrl } = meta;
  const out = { title, description, levels, sections, solutions };
  if (note) out.note = note;
  if (siteUrl) out.siteUrl = siteUrl;
  return parseMap(out);
}
