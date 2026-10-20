// One-off, kept for provenance. Builds examples/ux-research/map.json from local research
// files (data/, git-ignored, not committed). Run: node scripts/build-ux-example.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { convert } from './lib/convert.mjs';

// Path to the purpose graph's groups.csv (not included in this repo).
const GROUPS = process.env.GROUPS_CSV || 'data/groups.csv';
const rd = (p) => JSON.parse(readFileSync(p, 'utf8'));

const model = rd('data/model.json');
const horizontal = rd('data/horizontal-tools.json').tools;
const uses = rd('data/solution-uses.json').uses;
const additions = existsSync('data/researchops-additions.json') ? rd('data/researchops-additions.json').tools : [];
if (!additions.length) console.warn('researchops-additions.json missing: skipped');

const useBy = new Map(uses.map((u) => [`${u.product}\u0000${u.group}`, u.use]));
const placement = (name, p, own) => {
  const use = own ?? useBy.get(`${name}\u0000${p.group}`);
  return use ? { section: p.group, use } : { section: p.group };
};

const solutions = [
  ...model.competitors.map((c) => ({
    name: c.name, kind: 'product', url: `https://${c.domain}`, domain: c.domain,
    placements: c.props.map((p) => placement(c.name, p)),
  })),
  ...horizontal.map((c) => ({
    name: c.name, kind: 'tool', url: `https://${c.domain}`, domain: c.domain,
    placements: c.props.map((p) => placement(c.name, p)),
  })),
  ...additions.map((c) => ({
    name: c.name, kind: c.kind, url: c.url, domain: c.domain,
    placements: c.props.map((p) => placement(c.name, p, p.use)),
  })),
];

const satisfactionCsv = 'group_id,satisfaction\n' +
  Object.entries(model.satisfaction).map(([id, v]) => `${id},${v}`).join('\n') + '\n';

const map = convert({
  groupsCsv: readFileSync(GROUPS, 'utf8'),
  satisfactionCsv,
  solutions,
  meta: {
    title: 'UX Research Problem Space Map',
    description: 'Shows how many UX practitioners raised each research task, where needs go unmet, and which products and tools serve each task.',
    levels: ['Purpose', 'Goal', 'Task'],
    siteUrl: 'https://miguel.design/problem-space-map/',
    note: 'Satisfaction values are illustrative, authored from interview language; a real map needs a survey.',
  },
});

mkdirSync('examples/ux-research', { recursive: true });
writeFileSync('examples/ux-research/map.json', JSON.stringify(map, null, 2) + '\n');
const noUse = solutions.flatMap((s) => s.placements).filter((p) => !p.use).length;
const kinds = {};
for (const s of map.solutions) kinds[s.kind] = (kinds[s.kind] || 0) + 1;
console.log(`sections ${map.sections.length}, solutions ${map.solutions.length}`, kinds, `placements without use: ${noUse}`);
