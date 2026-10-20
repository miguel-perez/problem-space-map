import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { convert } from './lib/convert.mjs';

const { values: v } = parseArgs({
  options: {
    groups: { type: 'string' },
    satisfaction: { type: 'string' },
    solutions: { type: 'string' },
    title: { type: 'string' },
    description: { type: 'string' },
    levels: { type: 'string', default: 'Purpose,Goal,Task' },
    note: { type: 'string' },
    'site-url': { type: 'string' },
    out: { type: 'string' },
  },
});

try {
  if (!v.groups || !v.title || !v.out) {
    throw new Error('usage: --groups groups.csv --title "..." --out map.json [--satisfaction s.csv] [--solutions s.json] [--description "..."] [--levels Purpose,Goal,Task] [--note "..."] [--site-url url]');
  }
  const levels = v.levels.split(',').map((s) => s.trim());
  if (levels.length !== 3) throw new Error('--levels needs exactly 3 comma-separated names');
  const map = convert({
    groupsCsv: readFileSync(v.groups, 'utf8'),
    satisfactionCsv: v.satisfaction && readFileSync(v.satisfaction, 'utf8'),
    solutions: v.solutions ? JSON.parse(readFileSync(v.solutions, 'utf8')) : [],
    meta: { title: v.title, description: v.description ?? v.title, levels, note: v.note, siteUrl: v['site-url'] },
  });
  mkdirSync(dirname(v.out), { recursive: true });
  writeFileSync(v.out, JSON.stringify(map, null, 2) + '\n');
  console.log(`wrote ${v.out} (${map.sections.length} sections, ${map.solutions.length} solutions)`);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
